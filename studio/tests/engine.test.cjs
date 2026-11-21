'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
let E;
try { E = require('../engine.js'); } catch (_) { E = {}; }
const rect = (a,w,x0,y0,x1,y1) => { for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++) a[y*w+x]=1; };

test('exact Euclidean distance transform preserves diagonal distances', () => {
  assert.equal(typeof E.distanceTransform, 'function');
  const a = new Uint8Array(30).fill(1); a[1*6+1]=0;
  const d=E.distanceTransform(a,6,5);
  assert.ok(d instanceof Float32Array);
  assert.equal(d[7],0);
  assert.ok(Math.abs(d[4*6+5]-5)<1e-6);
  assert.ok(Math.abs(d[2*6+2]-Math.SQRT2)<1e-6);
});
test('transform is exact against brute force on non-square masks', () => {
  const a=Uint8Array.from({length:91},(_,i)=>i%13===2 || i%17===4?0:1);
  const d=E.distanceTransform(a,13,7);
  for(let y=0;y<7;y++) for(let x=0;x<13;x++) {
    let expected=Infinity;
    for(let j=0;j<91;j++) if(!a[j]) expected=Math.min(expected, Math.hypot(x-j%13,y-Math.floor(j/13)));
    assert.ok(Math.abs(d[y*13+x]-expected)<1e-5);
  }
});
test('absent distance target yields Infinity without NaNs', () => {
  assert.deepEqual([...E.distanceTransform(new Uint8Array(9).fill(1),3,3)],new Array(9).fill(Infinity));
});
test('dilation uses Euclidean circles and does not mutate source', () => {
  const a=new Uint8Array(49); a[24]=1;
  const d=E.dilate(a,7,7,1.5);
  assert.equal(d.reduce((s,v)=>s+v,0),9);
  assert.equal(d[3*7+5],0);
  assert.equal(a.reduce((s,v)=>s+v,0),1);
});
test('thickness scan flags entire narrow strokes but preserves wide-stroke side edges', () => {
  const a=new Uint8Array(10000);
  rect(a,100,10,10,22,90); rect(a,100,60,10,62,90);
  const r=E.analyze(a,100,100,10,{minStroke:.5,minGap:.8});
  assert.equal(r.strokeRisk[50*100+60],1);
  assert.equal(r.strokeRisk[50*100+61],1);
  assert.equal(r.strokeRisk[50*100+10],0);
  assert.equal(r.mmPerPixel,.1);
  assert.ok(r.score<100);
});
test('physical size changes risk without changing artwork pixels', () => {
  const a=new Uint8Array(10000);rect(a,100,30,20,34,80);
  const small=E.analyze(a,100,100,10,{minStroke:.5,minGap:.8});
  const large=E.analyze(a,100,100,20,{minStroke:.5,minGap:.8});
  assert.ok(small.strokeRiskPixels>large.strokeRiskPixels);
  assert.ok(small.score<large.score);
});
test('gap scan detects narrow internal cavity and ignores unbounded exterior', () => {
  const a=new Uint8Array(10000);rect(a,100,20,20,80,80);rect(a,100,29,29,31,71);
  for(let y=29;y<71;y++) for(let x=29;x<31;x++)a[y*100+x]=0;
  const r=E.analyze(a,100,100,10,{minStroke:.4,minGap:.65});
  assert.equal(r.gapRisk[50*100+30],1);
  assert.equal(r.gapRisk[50*100+19],0);
  assert.equal(r.gapRisk[0],0);
  assert.ok(r.gapRiskPixels>0);
});
test('blank artwork has zero printability and no risk pixels', () => {
  const r=E.analyze(new Uint8Array(400),20,20,38,{minStroke:.5,minGap:.8});
  assert.equal(r.score,0);assert.equal(r.metalPixels,0);assert.equal(r.gapRiskPixels,0);
});
test('mirrored SVG uses physical units, vector paths, dimension notes and escaped metadata', () => {
  const a=new Uint8Array([1,1,0,0,0,0,0,1]);
  const svg=E.mirroredSVG(a,4,2,50,{title:'A & M <Proof>',material:'Brass'});
  assert.match(svg,/width="[\d.]+mm"/);
  assert.match(svg,/scale\(-1 1\)/);
  assert.match(svg,/translate\(50 0\)/);
  assert.match(svg,/<path[^>]+d="M/);
  assert.match(svg,/50 mm/);
  assert.match(svg,/A &amp; M &lt;Proof&gt;/);
  assert.doesNotMatch(svg,/<image/);
});
test('invalid geometry inputs fail explicitly', () => {
  assert.throws(()=>E.distanceTransform(new Uint8Array(3),2,2),/mask|dimensions/i);
  assert.throws(()=>E.analyze(new Uint8Array(4),2,2,0),/size|diameter/i);
});
test('tiny proofs constrain every footer note and preserve long exact metadata titles', () => {
  const title='Very long production customer label '.repeat(20);
  const svg=E.mirroredSVG(new Uint8Array([1,0,0,1]),2,2,10,{title});
  const group=svg.match(/<g id="proof-notes-not-for-machining"[\s\S]*?<\/g>/)[0];
  const notes=[...group.matchAll(/<text[^>]*y="(?:1[3-9]|2[0-9])"[^>]*>(.*?)<\/text>/g)];
  assert.ok(notes.length>=3);
  for(const match of notes) {
    assert.match(match[0],/textLength="[\d.]+"/);
    assert.match(match[0],/lengthAdjust="spacingAndGlyphs"/);
    assert.ok(Number(match[0].match(/textLength="([\d.]+)"/)[1])<=10);
    assert.ok(match[1].length<100);
  }
  const metadata=svg.match(/<metadata>([\s\S]*?)<\/metadata>/)[1].replace(/&quot;/g,'"');
  assert.equal(JSON.parse(metadata).title,title);
  assert.match(svg,/transform="translate\(10 0\) scale\(-1 1\)"/);
  assert.match(svg,/<rect x="0" y="0" width="10" height="10"/);
});
for (const minStroke of [.50,.55]) {
  test(`512px physical calibration rejects 5px strokes and accepts 6px at ${minStroke}mm`, () => {
    const w=512,h=96,a=new Uint8Array(w*h);
    rect(a,w,30,10,35,86);rect(a,w,80,10,86,86);
    const result=E.analyze(a,w,h,50,{minStroke,minGap:.8});
    assert.equal(result.strokeRisk[48*w+32],1,'5px physical stroke is below the medium minimum');
    assert.equal(result.strokeRisk[48*w+30],1,'whole thin stroke must be flagged');
    assert.equal(result.strokeRisk[48*w+80],0,'6px stroke side edge should remain safe');
    assert.equal(result.strokeRisk[48*w+82],0,'6px stroke center should remain safe');
  });
}
test('odd and even strokes pass at exact nominal pixel-cell widths', () => {
  for(const width of [3,4,5,6,7,8]) {
    const a=new Uint8Array(100*60);rect(a,100,20,5,20+width,55);
    const result=E.analyze(a,100,60,10,{minStroke:width*.1,minGap:.65});
    assert.equal(result.strokeRisk[30*100+20],0,`${width}px nominal stroke side edge`);
    assert.equal(result.strokeRisk[30*100+20+Math.floor(width/2)],0,`${width}px nominal stroke center`);
  }
});
test('odd and even strokes fail just above nominal pixel-cell widths', () => {
  for(const width of [3,4,5,6,7,8]) {
    const a=new Uint8Array(100*60);rect(a,100,20,5,20+width,55);
    const result=E.analyze(a,100,60,10,{minStroke:(width+.05)*.1,minGap:.65});
    assert.equal(result.strokeRisk[30*100+20],1,`${width}px subminimum stroke side edge`);
    assert.equal(result.strokeRisk[30*100+20+Math.floor(width/2)],1,`${width}px subminimum stroke center`);
  }
});
