/* VELT & FORGE — local-first studio. Classic scripts work over file://. */
(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const N = 512;
  const MEDIUMS = Object.freeze({
    ice: { name: 'Clear Ice Block', minStroke: 0.50, minGap: 0.80 },
    leather: { name: 'Vegetable-Tanned Leather', minStroke: 0.40, minGap: 0.65 },
    wood: { name: 'Hardwood Torch', minStroke: 0.55, minGap: 0.90 }
  });
  const PRICES = { 38: 69, 50: 89, 63: 109 };
  const state = { material: 'brass', size: 50, handle: 'walnut', medium: 'ice', mode: 'die', threshold: 160, boldness: 0, invert: false, overlay: true, artwork: 'Bar Crest.svg', demo: 'crest', yaw: -0.12, pitch: 0.4, light: -1.0 };
  const svgStart = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">';
  const serif = 'font-family="Georgia,Times New Roman,serif"';
  const sans = 'font-family="Arial,Helvetica,sans-serif"';
  const demoNames = { crest: 'Bar Crest.svg', wedding: 'Wedding Monogram A & M.svg', leather: 'Leather Studio Badge.svg' };
  const DEMOS = {
    crest: svgStart + `<rect width="600" height="600" fill="white"/><g fill="none" stroke="#171412"><circle cx="300" cy="300" r="257" stroke-width="4"/><circle cx="300" cy="300" r="246" stroke-width="1.3"/><circle cx="300" cy="300" r="225" stroke-width="1" stroke-dasharray="1 8"/><path id="crest-arch" d="M90 300a210 210 0 0 1 420 0" stroke="none"/><path d="M150 355h300 M173 368h254" stroke-width="1.2"/><path d="M235 235q65 63 130 0 M235 235h130 M300 268v65 M270 333h60" stroke-width="4"/><path d="M250 241q50 37 100 0 M281 271h38" stroke-width="1.2"/><path d="M300 147v28 M280 152l7 24 M320 152l-7 24 M263 165l13 19 M337 165l-13 19 M251 184l17 11 M349 184l-17 11" stroke-width="1"/><path d="M174 300q-35-45-10-90 M164 258q-25-6-19-24 22 7 19 24 M165 239q16-12 8-25-18 13-8 25 M426 300q35-45 10-90 M436 258q25-6 19-24-22 7-19 24 M435 239q-16-12-8-25 18 13 8 25" stroke-width="2.2"/></g><g fill="#171412" text-anchor="middle" ${serif}><text font-size="17" letter-spacing="5"><textPath href="#crest-arch" startOffset="50%">DISTILLED IN GOOD COMPANY</textPath></text><text x="300" y="217" font-size="16" letter-spacing="7">THE</text><text x="300" y="311" font-size="31" letter-spacing="3">NIGHTJAR</text><text x="300" y="402" font-size="18" letter-spacing="6">SOCIAL CLUB</text><text x="300" y="445" font-size="12" letter-spacing="4">EST. MMXXIV</text></g><g fill="#171412"><path d="m206 424 3 7 7 3-7 3-3 7-3-7-7-3 7-3z M394 424l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></g></svg>`,
    wedding: svgStart + `<rect width="600" height="600" fill="white"/><g fill="none" stroke="#171412"><ellipse cx="300" cy="300" rx="215" ry="245" stroke-width="5"/><ellipse cx="300" cy="300" rx="203" ry="232" stroke-width="1.8"/><path d="M111 340q-55-110 25-185 M119 278q-33-8-31-34 33 7 31 34 M116 246q29-18 18-45-31 18-18 45 M123 202q-23-18-10-40 24 16 10 40 M489 340q55-110-25-185 M481 278q33-8 31-34-33 7-31 34 M484 246q-29-18-18-45 31 18 18 45 M477 202q23-18 10-40-24 16-10 40" stroke-width="3.5"/><path d="M220 408h160 M253 172h94" stroke-width="2"/></g><g fill="#171412" text-anchor="middle" ${serif}><text x="262" y="304" font-size="158" font-style="italic">A</text><text x="348" y="365" font-size="150">M</text><text x="308" y="305" font-size="48" font-style="italic">&amp;</text><text x="300" y="153" font-size="14" letter-spacing="5">FOREVER STARTS HERE</text><text x="300" y="451" font-size="20" letter-spacing="5">06 · 21 · 2026</text></g></svg>`,
    leather: svgStart + `<rect width="600" height="600" fill="white"/><g fill="none" stroke="#171412"><path d="M300 49 517 139v206q-17 125-217 210Q100 470 83 345V139Z" stroke-width="10"/><path d="M300 72 495 153v190q-18 110-195 189Q123 453 105 343V153Z" stroke-width="3"/><path d="m210 208 67-79 47 65 29-38 50 52 M234 181l43-52 28 38-27-7-16 20z" stroke-width="5"/><path d="M165 241h270 M165 366h270 M215 418l170 55 M385 418l-170 55" stroke-width="6"/><path d="m209 414-11 2 4 9 M391 414l11 2-4 9" stroke-width="5"/></g><g fill="#171412" text-anchor="middle" ${serif}><text x="300" y="294" font-size="49" font-weight="bold" letter-spacing="5">NORTH</text><text x="300" y="345" font-size="48" font-weight="bold" letter-spacing="10">HIDE</text><text x="300" y="401" font-size="20" letter-spacing="6" ${sans}>WORKSHOP</text><text x="300" y="490" font-size="13" letter-spacing="3">CRAFTED TO ENDURE</text></g></svg>`
  };
  let sourceCanvas, baseMask, mask, analysis, suggestion = null, processTimer = 0, renderFrame = 0, uploadVersion = 0, toastTimer = 0, suggestionVersion = 0;
  const renderer = new StampRenderer($('#relief-canvas'));
  const inspection = $('#inspection-canvas');
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  const total = () => PRICES[state.size] + (state.material === 'steel' ? 15 : 0) + (state.handle === 'steel' ? 18 : 0);
  const materialName = () => state.material === 'brass' ? 'Lead-Free Brass Option' : '304 Stainless Steel';
  const handleName = () => ({ walnut: 'Walnut Wood Handle', steel: 'Solid 304 Stainless Handle', arbor: 'Leather Arbor / Hammer Rod' })[state.handle];
  function toast(message) {
    $('#toast').textContent = message; $('#toast').classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3500);
  }
  function selected(selector, attribute, value) {
    $$(selector).forEach(button => { const active = button.dataset[attribute] === String(value); button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
  }
  function render() {
    cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(() => renderer.render({ mode: state.mode, material: state.material, handle: state.handle, yaw: state.yaw, pitch: state.pitch, light: state.light, diameter: state.size }));
  }
  function syncConfiguration() {
    selected('[data-material]', 'material', state.material); selected('[data-size]', 'size', state.size); selected('[data-mode]', 'mode', state.mode); selected('[data-demo]', 'demo', state.demo);
    $('#handle').value = state.handle; $('#medium').value = state.medium;
    $('#price').innerHTML = `$${total()}<span>.00</span>`;
    $('#preview-material').textContent = state.mode === 'die' ? materialName().toUpperCase() : state.mode === 'ice' ? 'CLEAR COCKTAIL ICE · FROSTED IMPRESSION' : 'VEGETABLE-TANNED LEATHER · DEBOSS';
    $('#preview-size').textContent = `Ø ${state.size} MM · ${state.mode === 'die' ? 'MIRRORED DIE' : 'IMPRESSION'}`;
    $('#material-cert').lastChild.textContent = state.material === 'brass' ? ' Lead-free brass option · batch sheet published before dispatch' : ' 304 stainless steel · +$15 material upgrade';
    const medium = MEDIUMS[state.medium];
    $('#medium-spec').textContent = `${state.medium === 'wood' ? 'HARDWOOD' : state.medium.toUpperCase()} TOLERANCE: ${medium.minStroke.toFixed(2)} MM STROKE / ${medium.minGap.toFixed(2)} MM GAP`;
    $('#stroke-spec').textContent = `Under ${medium.minStroke.toFixed(2)} mm`;
    $('#gap-spec').textContent = `Under ${medium.minGap.toFixed(2)} mm`;
    $('#inspection-dimension').textContent = `Ø ${state.size} mm`;
    $('#relief-canvas').setAttribute('aria-label', `${state.mode === 'die' ? materialName() + ' deep CNC relief (≥2.8mm target)' : state.mode === 'ice' ? 'Clear ice frosted imprint' : 'Vegetable-tanned leather deboss'}. Drag to tilt and move the light, or use arrow keys.`);
    render();
  }
  function syncTuning() {
    $('#threshold').value = state.threshold; $('#boldness').value = state.boldness; $('#invert').checked = state.invert;
    $('#threshold-value').value = String(state.threshold); $('#boldness-value').value = `+${state.boldness.toFixed(2)} mm`;
    for (const id of ['threshold', 'boldness']) { const input = $('#' + id); input.style.setProperty('--range', `${(Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100}%`); }
  }
  function clipToDie(input) {
    const radius2 = (N * 0.485) ** 2, center = (N - 1) / 2;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x - center) ** 2 + (y - center) ** 2 > radius2) input[y * N + x] = 0;
    return input;
  }
  function makeMask() {
    const pixels = sourceCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, N, N).data;
    baseMask = new Uint8Array(N * N);
    for (let i = 0; i < baseMask.length; i++) {
      const p = i * 4, black = pixels[p] * .2126 + pixels[p + 1] * .7152 + pixels[p + 2] * .0722 < state.threshold;
      baseMask[i] = (state.invert ? !black : black) ? 1 : 0;
    }
    clipToDie(baseMask);
    mask = clipToDie(StampEngine.dilate(baseMask, N, N, state.boldness * N / state.size));
  }
  function drawInspection() {
    if (!mask || !analysis) return;
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const ctx = c.getContext('2d'), output = ctx.createImageData(N, N);
    for (let i = 0; i < mask.length; i++) {
      const p = i * 4;
      const color = state.overlay && analysis.strokeRisk[i] ? [239, 102, 89] : state.overlay && analysis.gapRisk[i] ? [227, 163, 60] : mask[i] ? [41, 36, 29] : [250, 248, 244];
      output.data[p] = color[0]; output.data[p + 1] = color[1]; output.data[p + 2] = color[2]; output.data[p + 3] = 255;
    }
    ctx.putImageData(output, 0, 0);
    const view = inspection.getContext('2d'); view.clearRect(0, 0, 700, 700);
    view.save(); view.beginPath(); view.arc(350, 350, 321, 0, Math.PI * 2); view.clip(); view.drawImage(c, 24, 24, 652, 652); view.restore();
    view.strokeStyle = '#c4b69f'; view.lineWidth = 1; view.setLineDash([4, 5]); view.beginPath(); view.arc(350, 350, 321, 0, Math.PI * 2); view.stroke(); view.setLineDash([]);
    inspection.setAttribute('aria-label', `${state.artwork} at ${state.size}mm. Printability ${analysis.score} of 100. Thin strokes ${analysis.strokeRiskPercent.toFixed(1)} percent of metal; narrow cavities ${analysis.gapRiskPercent.toFixed(1)} percent of gap area. Coral=thin metal, amber=narrow gaps.`);
  }
  function displayAnalysis() {
    const good = analysis.score >= 90, moderate = analysis.score >= 70;
    $('#score').textContent = analysis.score; $('#score-bar').style.width = `${analysis.score}%`; $('#score-bar').style.background = good ? '#61745a' : analysis.score < 50 ? '#cf7e51' : '#b88a44';
    $('#score-status').textContent = analysis.empty ? 'No raised artwork' : good ? 'Looking crisp' : moderate ? 'A few fine details' : 'Details at risk'; $('#score-status').classList.toggle('good', good);
    $('#stroke-risk').textContent = `${analysis.strokeRiskPercent.toFixed(1)}%`;
    $('#gap-risk').textContent = `${analysis.gapRiskPercent.toFixed(1)}%`;
    $('#score-description').textContent = analysis.empty ? 'No metal remains at this threshold. Adjust the threshold, invert, or choose another design.' : good ? `Your ${state.size}mm design meets most ${MEDIUMS[state.medium].name.toLowerCase()} geometry tolerances. A workshop proof confirms the final result.` : `Fine details may merge or disappear on ${MEDIUMS[state.medium].name.toLowerCase()}. Highlighted pixels show where to refine your mark.`;
    drawInspection();
    $('#open-export').disabled = analysis.empty;
    suggestFix();
  }
  function processArtwork() {
    if (!sourceCanvas) return;
    clearTimeout(processTimer); processTimer = 0;
    document.body.classList.add('busy');
    try {
      makeMask(); analysis = StampEngine.analyze(mask, N, N, state.size, MEDIUMS[state.medium]);
      renderer.setArtwork(mask, N, N); displayAnalysis(); render();
    } catch (error) { toast('Artwork analysis could not finish. Try another image.'); console.error(error); }
    finally { document.body.classList.remove('busy'); }
  }
  function scheduleProcess() { ++suggestionVersion; suggestion = null; $('#smart-fix').disabled = true; clearTimeout(processTimer); processTimer = setTimeout(processArtwork, 110); }
  function flush() { if (processTimer) processArtwork(); }
  // Every proposed geometry change is measured before being offered. An apparent
  // stroke fix can damage cavities; compare complete scores rather than guessing.
  async function suggestFix() {
    const version = ++suggestionVersion;
    const original = analysis, originalMask = baseMask, current = { ...state };
    suggestion = null; $('#smart-fix').disabled = false;
    if (original.empty) {
      suggestion = { kind: 'reset' }; $('#fix-label').textContent = 'Reset artwork adjustments';
      $('#fix-explanation').textContent = 'Restore the original threshold and polarity to recover the artwork.'; return;
    }
    if (original.score >= 95) {
      suggestion = { kind: 'export' }; $('#fix-label').textContent = 'Your details look crisp — get the proof';
      $('#fix-explanation').textContent = 'Geometry looks good at this size. Export your mirrored proof for workshop review.'; return;
    }
    $('#smart-fix').disabled = true; $('#fix-label').textContent = 'Comparing precision improvements…';
    $('#fix-explanation').textContent = 'Testing larger sizes and compensation against both stroke and cavity limits.';
    const candidates = [], options = [];
    for (const size of [38, 50, 63].filter(value => value > current.size)) options.push({ kind: 'size', size, boldness: current.boldness, price: PRICES[size] - PRICES[current.size] });
    if (original.strokeRiskPixels && current.boldness < .6) {
      const tried = new Set();
      for (const amount of [0.10, 0.20, 0.25, 0.35]) {
        const boldness = Math.min(.6, Math.round((current.boldness + amount) * 20) / 20);
        if (!tried.has(boldness)) { options.push({ kind: 'boldness', size: current.size, boldness, price: 0 }); tried.add(boldness); }
      }
    }
    try {
      // Yield between candidate scans so the preview paints immediately and
      // controls remain usable. A generation discards outdated recommendations.
      for (const option of options) {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (version !== suggestionVersion) return;
        const candidateMask = clipToDie(StampEngine.dilate(originalMask, N, N, option.boldness * N / option.size));
        const result = StampEngine.analyze(candidateMask, N, N, option.size, MEDIUMS[current.medium]);
        if (option.kind === 'size' || (result.gapRiskPercent <= original.gapRiskPercent + 1.5 && result.metalPixels > original.metalPixels)) candidates.push({ ...option, score: result.score });
      }
      if (version !== suggestionVersion) return;
      candidates.sort((a, b) => (b.score - b.price * .03) - (a.score - a.price * .03));
      const best = candidates[0];
      if (best && best.score > original.score + 1) {
        suggestion = best;
        $('#fix-label').textContent = best.kind === 'boldness' ? `Auto-thicken +${(best.boldness - current.boldness).toFixed(2)} mm` : `Upgrade to ${best.size === 50 ? '2.0' : '2.5'}″ (${best.size}mm) · +$${best.price}`;
        $('#fix-explanation').textContent = `Measured improvement: ${original.score} → ${best.score}/100. ${best.kind === 'boldness' ? 'Adds radial metal compensation while checking cavity clearance.' : 'More physical space for fine details, with your artwork kept in proportion.'}`;
      } else {
        suggestion = { kind: 'download' }; $('#fix-label').textContent = 'Download proof to refine fine details';
        $('#fix-explanation').textContent = 'No automatic change improves the geometry safely. Simplify highlighted details in your source artwork.';
      }
    } catch (error) {
      if (version !== suggestionVersion) return;
      suggestion = { kind: 'download' }; $('#fix-label').textContent = 'Review your production proof';
      $('#fix-explanation').textContent = 'Review highlighted details with your workshop.'; console.error(error);
    }
    if (version === suggestionVersion) $('#smart-fix').disabled = false;
  }
  function validateSVG(text) {
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('SVG entity declarations are not supported. Export a plain SVG.');
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('This SVG could not be read. Export a valid plain SVG and try again.');
    const forbidden = new Set(['script', 'foreignobject', 'iframe', 'image', 'use', 'style', 'animate', 'animatetransform', 'animatemotion', 'set', 'audio', 'video']);
    const nodes = [...doc.querySelectorAll('*')];
    if (nodes.length > 15000) throw new Error('This SVG is too complex. Flatten or simplify it before uploading.');
    for (const element of nodes) {
      if (forbidden.has(element.localName.toLowerCase())) throw new Error('Use a self-contained SVG with outlined shapes; scripts, embedded images, animation and external styles are not supported.');
      for (const attribute of [...element.attributes]) {
        const value = attribute.value.trim();
        if (/^on/i.test(attribute.name) || /(?:javascript:|data:|https?:|file:|@import|expression\s*\()/i.test(value)) throw new Error('External resources and active content are not allowed. Use a self-contained SVG.');
        if ((attribute.localName === 'href' && !value.startsWith('#')) || /url\(\s*['"]?(?!#)/i.test(value)) throw new Error('The SVG must use only local shapes, fonts and colors.');
      }
    }
    return new XMLSerializer().serializeToString(doc);
  }
  async function loadArtwork(blob, name, demo = null, version = ++uploadVersion) {
    if (version !== uploadVersion) return;
    const url = URL.createObjectURL(blob);
    const input = $('#file-input');
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('The image could not be decoded. Please use a valid SVG, PNG or JPG.')); image.src = url; });
      if (version !== uploadVersion) return;
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 80000000) throw new Error('Image dimensions are too large. Resize below 80 megapixels.');
      // Fit visible content into the circular die, including all corner details.
      // White and transparent padding are ignored, without cropping any dark art.
      const scratch = document.createElement('canvas'); scratch.width = scratch.height = 768;
      const ctx = scratch.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 768, 768);
      const ratio = Math.min(748 / image.naturalWidth, 748 / image.naturalHeight);
      ctx.drawImage(image, (768 - image.naturalWidth * ratio) / 2, (768 - image.naturalHeight * ratio) / 2, image.naturalWidth * ratio, image.naturalHeight * ratio);
      const data = ctx.getImageData(0, 0, 768, 768).data;
      let minX = 768, minY = 768, maxX = -1, maxY = -1;
      for (let y = 0; y < 768; y++) for (let x = 0; x < 768; x++) { const i = (y * 768 + x) * 4; if (data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722 < 245) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); } }
      if (maxX < 0) throw new Error('This image is blank or completely white. Upload a dark logo on a light or transparent background.');
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      let radius = 1;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) { const i = (y * 768 + x) * 4; if (data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722 < 245) radius = Math.max(radius, Math.hypot(x - cx, y - cy)); }
      const next = document.createElement('canvas'); next.width = next.height = N;
      const out = next.getContext('2d', { willReadFrequently: true }); out.fillStyle = 'white'; out.fillRect(0, 0, N, N);
      const scale = N * .44 / radius; out.drawImage(scratch, N / 2 - cx * scale, N / 2 - cy * scale, 768 * scale, 768 * scale);
      sourceCanvas = next; state.artwork = name; state.demo = demo; state.threshold = 160; state.boldness = 0; state.invert = false;
      $('#artwork-name').textContent = name;
      $('#upload-status').textContent = `${name} loaded. Artwork fitted to the circular die; ${demo ? 'studio design ready' : 'your file stays on this device'}.`;
      $('#upload-status').classList.remove('error'); syncTuning(); syncConfiguration(); processArtwork();
    } catch (error) {
      if (version === uploadVersion) { $('#upload-status').textContent = error.message; $('#upload-status').classList.add('error'); toast(error.message); }
    } finally { URL.revokeObjectURL(url); if (version === uploadVersion) input.value = ''; }
  }
  async function upload(file) {
    if (!file) return;
    const version = ++uploadVersion;
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error('Choose a file smaller than 12 MB.');
      const extension = file.name.split('.').pop().toLowerCase();
      if (!['png', 'jpg', 'jpeg', 'svg'].includes(extension)) throw new Error('Please choose an SVG, PNG or JPG image.');
      let blob = file;
      if (extension === 'svg') {
        const text = await file.text();
        if (version !== uploadVersion) return;
        blob = new Blob([validateSVG(text)], { type: 'image/svg+xml' });
      }
      await loadArtwork(blob, file.name, null, version);
    } catch (error) { if (version !== uploadVersion) return; $('#upload-status').textContent = error.message; $('#upload-status').classList.add('error'); toast(error.message); }
  }
  function configJSON() {
    flush();
    return {
      studio: 'VELT & FORGE', schemaVersion: 1, artwork: state.artwork,
      material: { id: state.material, name: materialName(), specification: state.material === 'brass' ? 'Lead-free brass option; batch sheet published before dispatch' : '304 stainless steel' },
      diameterMM: state.size, nominalSizeInches: ({38: 1.5, 50: 2, 63: 2.5})[state.size], targetReliefDepthMinMM: 2.8, reliefDepthStatus: 'target; confirmed in workshop proof',
      handle: { id: state.handle, name: handleName() },
      targetMedium: { id: state.medium, ...MEDIUMS[state.medium] },
      artworkProcessing: { threshold: state.threshold, inverted: state.invert, radialDilationMM: state.boldness, maskResolution: [N, N], pixelPitchMM: state.size / N, mirroredProductionExport: true, blackMeans: 'raised metal', whiteMeans: 'carved cavity' },
      inspection: analysis ? { score: analysis.score, thinStrokePercent: Number(analysis.strokeRiskPercent.toFixed(3)), narrowGapPercent: Number(analysis.gapRiskPercent.toFixed(3)), method: analysis.method } : null,
      pricing: { currency: 'USD', base: PRICES[state.size], materialUpgrade: state.material === 'steel' ? 15 : 0, handleUpgrade: state.handle === 'steel' ? 18 : 0, total: total(), monthlyFees: 0 },
      fulfillment: { madeToOrder: true, shipDate: 'shown before checkout', orderSubmitted: false }
    };
  }
  function showDialog(dialog) { if (!dialog.open) dialog.showModal(); }
  function openSummary() {
    if (!analysis) { toast('Your artwork is still loading. Please try again in a moment.'); return; }
    const configuration = configJSON();
    $('#summary-artwork').textContent = state.artwork;
    const list = $('#summary-list'); list.replaceChildren();
    for (const [label, value] of [['Material', materialName()], ['Diameter / relief depth', `${state.size} mm / ≥2.8 mm target`], ['Handle', handleName()], ['Target medium', MEDIUMS[state.medium].name], ['Art compensation', `+${state.boldness.toFixed(2)} mm radial · ${state.invert ? 'inverted' : 'original polarity'}`], ['Printability', `${analysis.score}/100 · ${analysis.score >= 90 ? 'workshop review' : 'details need review'}`]]) {
      const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; row.append(dt, dd); list.append(row);
    }
    $('#summary-price').textContent = money(total()); $('#summary-json').textContent = JSON.stringify(configuration, null, 2); showDialog($('#summary-dialog'));
  }
  function openExport() {
    flush();
    if (!analysis || analysis.empty) { toast('Add visible artwork before exporting a proof.'); return; }
    $('#export-warning').textContent = `Ø ${state.size} mm · ${materialName()} · ${analysis.score}/100 printability.${analysis.score < 90 ? ' Review the highlighted details with your workshop before machining.' : ' Confirm the proof with your workshop before machining.'}`;
    showDialog($('#export-dialog'));
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 15000); toast(`${name} prepared for download.`);
  }
  function exportName(extension) { return `velt-forge-${state.size}mm-${state.material}-mirrored-proof.${extension}`; }
  function exportSVG() {
    flush(); if (!mask || analysis.empty) return;
    const metadata = configJSON();
    download(new Blob([StampEngine.mirroredSVG(mask, N, N, state.size, { title: `${state.artwork} — ${state.size} mm ${materialName()}`, configuration: metadata })], { type: 'image/svg+xml;charset=utf-8' }), exportName('svg'));
  }
  function exportPNG() {
    flush(); if (!mask || analysis.empty) return;
    const filename = exportName('png');
    const c = document.createElement('canvas'); c.width = 2428; c.height = 2560;
    const ctx = c.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, c.width, c.height);
    const source = document.createElement('canvas'); source.width = source.height = N;
    const sctx = source.getContext('2d'), pixels = sctx.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const p = (y * N + x) * 4, value = mask[y * N + (N - 1 - x)] ? 0 : 255; pixels.data[p] = pixels.data[p + 1] = pixels.data[p + 2] = value; pixels.data[p + 3] = 255; }
    sctx.putImageData(pixels, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(source, 190, 220, 2048, 2048);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.setLineDash([12, 12]); ctx.strokeRect(190, 220, 2048, 2048); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(190, 190); ctx.lineTo(190, 130); ctx.moveTo(2238, 190); ctx.lineTo(2238, 130); ctx.moveTo(190, 155); ctx.lineTo(2238, 155); ctx.stroke();
    ctx.fillStyle = '#171412'; ctx.font = '32px Arial'; ctx.textAlign = 'center'; ctx.fillText(`DIAMETER ${state.size} mm  /  2048 px`, 1214, 105);
    ctx.textAlign = 'left'; ctx.font = '25px Arial'; ctx.fillText('VELT & FORGE — MIRRORED CNC DIE FACE', 190, 2340);
    ctx.font = '22px Arial'; ctx.fillText(`${materialName()} · Target relief depth ≥2.8 mm · ${state.artwork.slice(0, 70)}`, 190, 2385, 2048);
    ctx.fillText('BLACK = RAISED METAL   |   WHITE = CARVED CAVITY', 190, 2425);
    ctx.font = '19px Arial'; ctx.fillText(`Threshold ${state.threshold} · Invert ${state.invert} · Radial dilation +${state.boldness.toFixed(2)} mm · Score ${analysis.score}/100`, 190, 2465);
    ctx.fillText('Dimension guides and text are outside the artwork; exclude them from machining.', 190, 2500);
    c.toBlob(blob => { if (blob) download(blob, filename); else toast('PNG export failed. Try the vector SVG export.'); }, 'image/png');
  }
  // Pointer capture keeps drag coherent even outside the preview. Arrow keys
  // expose the same view and light adjustment for keyboard users.
  const preview = $('#relief-canvas'); let drag = null;
  preview.addEventListener('pointerdown', event => { if (event.button !== 0) return; drag = { x: event.clientX, y: event.clientY, yaw: state.yaw, pitch: state.pitch, light: state.light }; preview.setPointerCapture(event.pointerId); });
  preview.addEventListener('pointermove', event => { if (!drag) return; const dx = event.clientX - drag.x, dy = event.clientY - drag.y; state.yaw = drag.yaw + dx * .006; state.pitch = Math.max(-.7, Math.min(1.2, drag.pitch + dy * .004)); state.light = drag.light + dx * .009 + dy * .003; render(); });
  const endDrag = () => { drag = null; }; preview.addEventListener('pointerup', endDrag); preview.addEventListener('pointercancel', endDrag); preview.addEventListener('lostpointercapture', endDrag);
  preview.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return; event.preventDefault(); if (event.key === 'Home') resetView(); else { state.yaw += event.key === 'ArrowLeft' ? -.12 : event.key === 'ArrowRight' ? .12 : 0; state.pitch = Math.max(-.7, Math.min(1.2, state.pitch + (event.key === 'ArrowUp' ? -.1 : event.key === 'ArrowDown' ? .1 : 0))); state.light += event.key === 'ArrowLeft' ? -.15 : event.key === 'ArrowRight' ? .15 : .08; render(); } });
  function resetView() { state.yaw = -.12; state.pitch = .4; state.light = -1; render(); }
  $('#reset-view').addEventListener('click', resetView);
  $$('[data-mode]').forEach(button => button.addEventListener('click', () => { state.mode = button.dataset.mode; syncConfiguration(); }));
  $$('[data-material]').forEach(button => button.addEventListener('click', () => { state.material = button.dataset.material; syncConfiguration(); }));
  $$('[data-size]').forEach(button => button.addEventListener('click', () => { state.size = Number(button.dataset.size); syncConfiguration(); processArtwork(); }));
  $('#handle').addEventListener('change', event => { state.handle = event.target.value; syncConfiguration(); });
  $('#medium').addEventListener('change', event => { state.medium = event.target.value; if (state.medium === 'ice' || state.medium === 'leather') state.mode = state.medium; syncConfiguration(); processArtwork(); });
  $$('[data-demo]').forEach(button => button.addEventListener('click', () => loadArtwork(new Blob([DEMOS[button.dataset.demo]], { type: 'image/svg+xml' }), demoNames[button.dataset.demo], button.dataset.demo)));
  $('#upload-zone').addEventListener('click', () => $('#file-input').click());
  $('#file-input').addEventListener('change', event => upload(event.target.files[0]));
  const zone = $('#upload-zone'); let dragDepth = 0;
  for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) zone.addEventListener(type, event => { event.preventDefault(); event.stopPropagation(); if (type === 'dragenter') dragDepth++; if (type === 'dragleave') dragDepth = Math.max(0, dragDepth - 1); if (type === 'drop') { dragDepth = 0; const files = event.dataTransfer.files; if (files.length > 1) toast('Loading the first image. One artwork per stamp.'); upload(files[0]); } zone.classList.toggle('dragover', dragDepth > 0); });
  // Stop a missed drop from navigating away and losing the current configuration.
  window.addEventListener('dragover', event => event.preventDefault()); window.addEventListener('drop', event => event.preventDefault());
  $('#threshold').addEventListener('input', event => { state.threshold = Number(event.target.value); syncTuning(); scheduleProcess(); });
  $('#boldness').addEventListener('input', event => { state.boldness = Number(event.target.value); syncTuning(); scheduleProcess(); });
  $('#invert').addEventListener('change', event => { state.invert = event.target.checked; processArtwork(); });
  $('#show-overlay').addEventListener('change', event => { state.overlay = event.target.checked; drawInspection(); });
  $('#smart-fix').addEventListener('click', () => {
    flush(); if (!suggestion) return;
    const action = suggestion;
    if (action.kind === 'export' || action.kind === 'download') { openExport(); return; }
    if (action.kind === 'reset') { state.threshold = 160; state.invert = false; state.boldness = 0; }
    if (action.kind === 'boldness') state.boldness = action.boldness;
    if (action.kind === 'size') state.size = action.size;
    syncTuning(); syncConfiguration(); processArtwork(); toast(`Artwork updated. Printability: ${analysis.score}/100.`);
  });
  $$('[data-open-summary]').forEach(button => button.addEventListener('click', openSummary)); $('#review-order').addEventListener('click', openSummary);
  $('#open-export').addEventListener('click', openExport); $('#download-svg').addEventListener('click', exportSVG); $('#download-png').addEventListener('click', exportPNG);
  $('#download-json').addEventListener('click', () => download(new Blob([JSON.stringify(configJSON(), null, 2)], { type: 'application/json' }), `velt-forge-${state.size}mm-configuration.json`));
  $$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $$('dialog').forEach(dialog => dialog.addEventListener('click', event => { const box = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close(); }));
  for (const key of Object.keys(DEMOS)) $('#thumb-' + key).innerHTML = DEMOS[key].replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
  $('#year').textContent = String(new Date().getFullYear());
  // Apply optional hand-off query params from storefront/SEO pages (?material=steel&size=63&handle=steel&medium=leather&demo=wedding)
  if (typeof location !== 'undefined' && location.search) {
    const q = new URLSearchParams(location.search);
    if (['brass', 'steel'].includes(q.get('material'))) state.material = q.get('material');
    if (['38', '50', '63'].includes(q.get('size'))) state.size = Number(q.get('size'));
    if (['walnut', 'steel', 'arbor'].includes(q.get('handle'))) state.handle = q.get('handle');
    if (['ice', 'leather', 'wood'].includes(q.get('medium'))) {
      state.medium = q.get('medium');
      if (state.medium === 'leather') state.mode = 'leather';
    }
    if (['die', 'ice', 'leather'].includes(q.get('mode'))) state.mode = q.get('mode');
    if (['crest', 'wedding', 'leather'].includes(q.get('demo'))) state.demo = q.get('demo');
    else if (state.medium === 'leather') state.demo = 'leather';
  }
  syncTuning(); syncConfiguration();
  window.VeltStudio = Object.freeze({ getConfiguration: configJSON, getAnalysis: () => analysis ? { score: analysis.score, strokeRiskPixels: analysis.strokeRiskPixels, gapRiskPixels: analysis.gapRiskPixels, metalPixels: analysis.metalPixels, gapPixels: analysis.gapPixels } : null });
  loadArtwork(new Blob([DEMOS[state.demo]], { type: 'image/svg+xml' }), demoNames[state.demo], state.demo);
})();
