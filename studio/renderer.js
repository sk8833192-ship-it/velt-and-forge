/* VELT & FORGE — local Canvas relief renderer. No network or dependencies. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const noise = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function distance(mask, w, h, target) {
    const d = new Float32Array(w * h), far = w + h;
    for (let i = 0; i < d.length; i++) d[i] = mask[i] === target ? 0 : far;
    const diag = Math.SQRT2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (y) d[i] = Math.min(d[i], d[i - w] + 1);
      if (x && y) d[i] = Math.min(d[i], d[i - w - 1] + diag);
      if (x < w - 1 && y) d[i] = Math.min(d[i], d[i - w + 1] + diag);
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (x < w - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (y < h - 1) d[i] = Math.min(d[i], d[i + w] + 1);
      if (x < w - 1 && y < h - 1) d[i] = Math.min(d[i], d[i + w + 1] + diag);
      if (x && y < h - 1) d[i] = Math.min(d[i], d[i + w - 1] + diag);
    }
    return d;
  }
  class StampRenderer {
    constructor(target) {
      this.canvas = target;
      this.ctx = target.getContext('2d');
      this.n = 512;
      this.texture = canvas(this.n, this.n);
      this.mask = new Uint8Array(this.n * this.n);
      this.heights = new Float32Array(this.mask.length);
      this.nx = new Float32Array(this.mask.length);
      this.ny = new Float32Array(this.mask.length);
      this.options = {};
      this.setArtwork(this.mask, this.n, this.n);
    }
    resize(w, h) { this.canvas.width = w; this.canvas.height = h; this.render(this.options); }
    setArtwork(mask, w, h) {
      if (!mask || !w || !h) return;
      const n = this.n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        this.mask[y * n + x] = mask[Math.min(h - 1, Math.floor(y / n * h)) * w + Math.min(w - 1, Math.floor(x / n * w))] ? 1 : 0;
      }
      const toWhite = distance(this.mask, n, n, 0), toBlack = distance(this.mask, n, n, 1);
      for (let i = 0; i < this.mask.length; i++) this.heights[i] = smooth((toWhite[i] - toBlack[i] + 2.5) / 5);
      for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
        const i = y * n + x;
        this.nx[i] = (this.heights[i - 1] - this.heights[i + 1]) * 4;
        this.ny[i] = (this.heights[i - n] - this.heights[i + n]) * 4;
      }
      this.cacheKey = '';
    }
    shade(mode, material, light, yaw, diameter) {
      const key = [mode, material, light.toFixed(3), yaw.toFixed(3), diameter].join(':');
      if (key === this.cacheKey) return this.texture;
      this.cacheKey = key;
      const n = this.n, ctx = this.texture.getContext('2d');
      const out = ctx.createImageData(n, n), data = out.data;
      // The die face is mirrored in drawDie; reflect incident light into that local space.
      const a = light - yaw, lx = Math.cos(a) * 0.65 * (mode === 'die' ? -1 : 1), ly = Math.sin(a) * 0.65, lz = 0.76;
      const hx = lx * 0.55, hy = ly * 0.55, hz = 0.94;
      const depthPixels = 3.2 / clamp(Number(diameter) || 50, 20, 100) * n;
      const reliefScale = depthPixels / 16;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x, p = i * 4, raised = this.heights[i];
        const sign = mode === 'die' ? 1 : -1;
        const nx = this.nx[i] * sign * reliefScale, ny = this.ny[i] * sign * reliefScale;
        const len = Math.hypot(nx, ny, 1), diffuse = Math.max(0, (nx * lx + ny * ly + lz) / len);
        const spec = Math.pow(Math.max(0, (nx * hx + ny * hy + hz) / len), mode === 'leather' ? 18 : 42);
        const grain = noise(x, y), brushed = Math.sin(y * 4.3 + Math.sin(x * 0.025) * 0.6) * 2.4;
        let r, g, b, alpha = 255;
        if (mode === 'die') {
          const radial = Math.hypot(x - n / 2, y - n / 2) / (n / 2);
          if (radial > 0.999) alpha = 0;
          const sweep = 0.10 * Math.cos((x + y * 0.25) / n * TAU - light) + 0.1 * Math.sin(y / n * 8);
          const ambient = 0.56 + diffuse * 0.30 + raised * 0.20 + sweep;
          let occlusion = 0;
          if (raised < .99) {
            for (let step = 1; step <= 6; step++) {
              const reach = step / 6 * depthPixels;
              const sx = Math.round(x + lx * reach), sy = Math.round(y + ly * reach);
              if (sx >= 0 && sx < n && sy >= 0 && sy < n && this.mask[sy * n + sx]) { occlusion = (1 - step / 8) * (1 - raised); break; }
            }
          }
          const cavity = (raised < 0.01 ? 0.79 : 1) * (1 - occlusion * .35);
          const edge = 1 - smooth((radial - 0.955) / 0.044);
          const rim = radial > 0.956 ? 0.84 + Math.sin((radial - 0.95) * 97) * 0.27 : 1;
          const base = material === 'steel' ? [181, 185, 183] : [190, 143, 67];
          const shine = spec * (material === 'steel' ? 110 : 95);
          const milling = brushed + (grain - 0.5) * 5 + Math.sin(radial * 1700) * 1.5;
          r = base[0] * ambient * cavity * rim + shine + milling;
          g = base[1] * ambient * cavity * rim + shine * 0.88 + milling;
          b = base[2] * ambient * cavity * rim + shine * 0.67 + milling;
          if (edge < 0.3) { r += 16; g += 15; b += 10; }
        } else if (mode === 'ice') {
          const frost = raised * (0.70 + grain * 0.30);
          const facet = Math.sin(x * 0.017 + y * 0.01) * Math.sin(y * 0.025) * 8;
          r = 167 + frost * 69 + spec * 33 + facet;
          g = 191 + frost * 48 + spec * 25 + facet;
          b = 194 + frost * 42 + spec * 25 + facet;
          const edge = Math.hypot(this.nx[i], this.ny[i]);
          r -= Math.min(edge, 2) * 20; g -= Math.min(edge, 2) * 13; b -= Math.min(edge, 2) * 10;
          alpha = 150 + raised * 102;
        } else {
          const pores = grain > 0.86 ? -13 : (grain - 0.5) * 11;
          const marbling = Math.sin(x * 0.08 + Math.sin(y * 0.03) * 4) * 2;
          const dark = raised * 0.55;
          const lighting = (0.70 + diffuse * 0.34) * (1 - dark);
          r = 164 * lighting + pores + marbling + spec * 10;
          g = 98 * lighting + pores * 0.55 + marbling + spec * 6;
          b = 53 * lighting + pores * 0.25 + marbling + spec * 3;
        }
        data[p] = clamp(r, 0, 255); data[p + 1] = clamp(g, 0, 255); data[p + 2] = clamp(b, 0, 255); data[p + 3] = alpha;
      }
      ctx.putImageData(out, 0, 0);
      return this.texture;
    }
    render(options) {
      const o = this.options = Object.assign({ mode: 'die', material: 'brass', handle: 'walnut', yaw: -0.12, pitch: 0.4, light: -1.0, diameter: 50 }, this.options, options || {});
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.save(); ctx.scale(w / 1100, h / 850);
      const bg = ctx.createRadialGradient(520, 330, 40, 550, 450, 690);
      bg.addColorStop(0, '#eee9e0'); bg.addColorStop(0.65, '#e8e2d8'); bg.addColorStop(1, '#dcd5c9');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 1100, 850);
      // A quiet studio floor and grounded contact shadow.
      const shadow = ctx.createRadialGradient(560, 665, 10, 560, 665, 340);
      shadow.addColorStop(0, 'rgba(43,32,19,.21)'); shadow.addColorStop(0.55, 'rgba(43,32,19,.09)'); shadow.addColorStop(1, 'rgba(43,32,19,0)');
      ctx.save(); ctx.translate(0, 180); ctx.scale(1, .72); ctx.fillStyle = shadow; ctx.fillRect(100, 450, 900, 450); ctx.restore();
      const yaw = Number(o.yaw) || 0, pitch = clamp(Number(o.pitch) || .4, -.7, 1.2);
      const sy = clamp(0.72 - pitch * 0.18, .42, .9);
      const tex = this.shade(o.mode, o.material, Number.isFinite(o.light) ? o.light : -1, yaw, o.diameter);
      if (o.mode === 'ice') this.drawIce(ctx, tex, yaw, sy);
      else if (o.mode === 'leather') this.drawLeather(ctx, tex, yaw, sy);
      else this.drawDie(ctx, tex, o, yaw, sy);
      ctx.restore();
    }
    drawDie(ctx, tex, o, yaw, sy) {
      const steel = o.material === 'steel';
      ctx.save(); ctx.translate(545, 476); ctx.rotate(yaw * .38);
      // Handle is turned wood or solid steel, with a machined metal collar.
      ctx.save(); ctx.translate(18, -97); ctx.rotate(.37 + yaw * .3);
      ctx.shadowColor = 'rgba(55,35,13,.17)'; ctx.shadowBlur = 24; ctx.shadowOffsetX = 12; ctx.shadowOffsetY = 14;
      const wood = ctx.createLinearGradient(-55, 0, 55, 0);
      if (o.handle === 'steel' || o.handle === 'arbor') { wood.addColorStop(0, '#5c6565'); wood.addColorStop(.28, '#d3d6d2'); wood.addColorStop(.45, '#faf9f1'); wood.addColorStop(.65, '#929a97'); wood.addColorStop(1, '#4a5353'); }
      else { wood.addColorStop(0, '#36231a'); wood.addColorStop(.24, '#654332'); wood.addColorStop(.47, '#876047'); wood.addColorStop(.65, '#61412e'); wood.addColorStop(1, '#2e1e16'); }
      ctx.fillStyle = wood;
      if (o.handle === 'arbor') { ctx.beginPath(); ctx.roundRect(-25, -260, 50, 274, 9); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(-30, 4); ctx.bezierCurveTo(-28, -47, -53, -100, -55, -171); ctx.bezierCurveTo(-60, -254, 56, -257, 55, -171); ctx.bezierCurveTo(53, -100, 28, -47, 30, 4); ctx.closePath(); ctx.fill(); }
      ctx.shadowColor = 'transparent';
      if (o.handle === 'walnut') {
        ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = '#c19465'; ctx.lineWidth = 1;
        for (let i = -42; i < 45; i += 7) { ctx.beginPath(); ctx.moveTo(i * .5, -10); ctx.bezierCurveTo(i * 1.1, -90, i * .88, -160, i * .7, -220 + Math.abs(i) * .18); ctx.stroke(); } ctx.restore();
      }
      const collar = ctx.createLinearGradient(-40, 0, 40, 0); collar.addColorStop(0, steel ? '#666e6b' : '#876024'); collar.addColorStop(.35, steel ? '#e9ece4' : '#f1d696'); collar.addColorStop(.6, steel ? '#a8b1ac' : '#b58942'); collar.addColorStop(1, steel ? '#3d4747' : '#624013');
      ctx.fillStyle = collar; ctx.beginPath(); ctx.roundRect(-38, -16, 76, 59, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-32, -10); ctx.lineTo(32, -10); ctx.stroke();
      ctx.restore();
      // Cylindrical die sidewall with a continuous metallic bevel.
      const r = 263, ry = r * sy, depth = 56;
      const body = ctx.createLinearGradient(-r, 0, r, 0);
      const stops = steel ? ['#48514f', '#b5bcb7', '#e1e3d8', '#929b96', '#4b5652'] : ['#72501e', '#bb8b3f', '#e0bb73', '#a4742a', '#684719'];
      [0, .22, .48, .75, 1].forEach((s, i) => body.addColorStop(s, stops[i]));
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, depth, r, ry, 0, 0, TAU); ctx.fill(); ctx.fillRect(-r, 0, r * 2, depth);
      ctx.strokeStyle = steel ? '#62706a' : '#80602e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, depth, r, ry, 0, 0, Math.PI); ctx.stroke();
      for (let k = 7; k < depth - 4; k += 6) { ctx.strokeStyle = k % 2 ? 'rgba(255,241,198,.1)' : 'rgba(51,32,8,.12)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.ellipse(0, k, r, ry, 0, 0, Math.PI); ctx.stroke(); }
      ctx.save(); ctx.scale(1, sy); ctx.rotate(yaw);
      ctx.save(); ctx.scale(-1, 1); ctx.drawImage(tex, -r, -r, r * 2, r * 2); ctx.restore();
      ctx.strokeStyle = steel ? 'rgba(247,250,239,.8)' : 'rgba(255,226,162,.8)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, r - 3, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(62,42,15,.27)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r - 12, 0, TAU); ctx.stroke();
      ctx.restore(); ctx.restore();
    }
    drawIce(ctx, tex, yaw, sy) {
      ctx.save(); ctx.translate(550, 390); ctx.rotate(-.16 + yaw * .25);
      const rx = 286, ry = 250 * sy, depth = 170;
      const front = ctx.createLinearGradient(0, 0, 0, depth + ry); front.addColorStop(0, 'rgba(176,200,199,.72)'); front.addColorStop(.5, 'rgba(129,160,160,.62)'); front.addColorStop(1, 'rgba(209,224,216,.8)');
      ctx.fillStyle = front; ctx.beginPath(); ctx.moveTo(-rx, -ry); ctx.lineTo(rx, -ry); ctx.lineTo(rx, ry + depth); ctx.quadraticCurveTo(0, ry + depth + 18, -rx, ry + depth); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,246,.72)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(-rx, ry, rx * 2, depth); ctx.clip();
      const facet = ctx.createLinearGradient(-rx, 0, rx, 0); facet.addColorStop(0, 'rgba(255,255,255,.5)'); facet.addColorStop(.16, 'rgba(255,255,255,0)'); facet.addColorStop(.72, 'rgba(73,121,123,.13)'); facet.addColorStop(1, 'rgba(255,255,255,.4)'); ctx.fillStyle = facet; ctx.fillRect(-rx, ry, rx * 2, depth);
      ctx.strokeStyle = 'rgba(247,255,255,.35)'; ctx.lineWidth = 1;
      [[-225, 60, -183, 170], [200, 10, 160, 140], [-95, 80, -65, 160], [98, 40, 155, 172]].forEach(v => { ctx.beginPath(); ctx.moveTo(v[0], ry + v[1]); ctx.lineTo(v[2], ry + v[3]); ctx.stroke(); }); ctx.restore();
      ctx.save(); ctx.scale(1, sy); ctx.beginPath(); ctx.roundRect(-rx, -250, rx * 2, 500, 29); ctx.clip();
      const top = ctx.createLinearGradient(-rx, -250, rx, 250); top.addColorStop(0, '#e7ede5'); top.addColorStop(.45, '#bacdcb'); top.addColorStop(1, '#dae7df'); ctx.fillStyle = top; ctx.fillRect(-rx, -250, rx * 2, 500);
      ctx.save(); ctx.rotate(yaw); ctx.drawImage(tex, -238, -238, 476, 476); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-270, 175); ctx.lineTo(-245, 120); ctx.lineTo(-258, 70); ctx.moveTo(220, -205); ctx.lineTo(193, -175); ctx.lineTo(245, -132); ctx.stroke();
      for (let i = 0; i < 38; i++) { const x = (noise(i, 2) - .5) * 550, y = (noise(i, 5) - .5) * 470; ctx.fillStyle = 'rgba(255,255,255,.27)'; ctx.beginPath(); ctx.ellipse(x, y, 1 + noise(i, 7) * 2, 3 + noise(i, 8) * 4, 0, 0, TAU); ctx.fill(); }
      ctx.restore(); ctx.save(); ctx.scale(1, sy); ctx.strokeStyle = 'rgba(255,255,249,.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-rx, -250, rx * 2, 500, 29); ctx.stroke(); ctx.restore(); ctx.restore();
    }
    drawLeather(ctx, tex, yaw, sy) {
      ctx.save(); ctx.translate(550, 446); ctx.rotate(-.12 + yaw * .25); ctx.transform(1, 0, -.14, .7 + sy * .28, 0, 0);
      ctx.shadowColor = 'rgba(53,29,12,.26)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 22;
      ctx.fillStyle = '#674022'; ctx.beginPath(); ctx.roundRect(-353, -274, 706, 552, 18); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#9b6237'; ctx.beginPath(); ctx.roundRect(-352, -281, 704, 550, 17); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.roundRect(-351, -280, 702, 549, 17); ctx.clip();
      // Grain fills the hide; the square artwork retains its physical aspect ratio.
      if (!this.leatherGrain) {
        this.leatherGrain = canvas(128, 128);
        const grainCtx = this.leatherGrain.getContext('2d'), grainImage = grainCtx.createImageData(128, 128);
        for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
          const p = (y * 128 + x) * 4, value = noise(x, y), pore = value > .86 ? -13 : (value - .5) * 11;
          grainImage.data[p] = 157 + pore; grainImage.data[p + 1] = 94 + pore * .55; grainImage.data[p + 2] = 51 + pore * .25; grainImage.data[p + 3] = 255;
        }
        grainCtx.putImageData(grainImage, 0, 0);
      }
      ctx.fillStyle = ctx.createPattern(this.leatherGrain, 'repeat'); ctx.fillRect(-351, -280, 702, 549);
      ctx.drawImage(tex, -250, -250, 500, 500);
      const light = ctx.createLinearGradient(-340, -280, 340, 280); light.addColorStop(0, 'rgba(252,205,144,.12)'); light.addColorStop(1, 'rgba(40,17,5,.1)'); ctx.fillStyle = light; ctx.fillRect(-352, -281, 704, 550);
      ctx.restore();
      ctx.strokeStyle = 'rgba(70,35,13,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(-329, -258, 658, 502, 12); ctx.stroke();
      ctx.strokeStyle = 'rgba(224,173,110,.7)'; ctx.setLineDash([5, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-336, -265, 672, 516, 13); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(240,190,126,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-330, -279); ctx.lineTo(330, -279); ctx.stroke(); ctx.restore();
    }
  }
  root.StampRenderer = StampRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
