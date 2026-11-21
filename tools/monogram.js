/* Velt & Forge — outlined local-first artwork. No fonts, fetches or dependencies. */
(function (root) {
  'use strict';
  const TEMPLATES = Object.freeze([
    { id: 'classic-crest', name: 'Classic Double-Ring Crest', short: 'Classic Crest' },
    { id: 'art-deco', name: 'Art Deco Diamond', short: 'Art Deco' },
    { id: 'laurel', name: 'Minimal Laurel Wreath', short: 'Laurel' },
    { id: 'editorial-box', name: 'Modern Editorial Square', short: 'Editorial' },
    { id: 'estate-seal', name: 'Round Estate Seal', short: 'Estate Seal' }
  ]);
  const WEIGHTS = ['Standard', 'Bold for Clear Ice', 'Extra Bold'];
  const escapeXML = value => String(value).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
  const chars = value => Array.from(String(value));
  const upper = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '').toUpperCase();
  function normalize(input = {}) {
    return {
      initial1: chars(upper(input.initial1 == null ? 'A' : input.initial1))[0] || 'A',
      initial2: chars(upper(input.initial2 == null ? 'M' : input.initial2))[0] || 'M',
      separator: ['&', '+', '·', ''].includes(input.separator) ? input.separator : '&',
      subtitle: chars(upper(input.subtitle || '')).slice(0, 12).join(''),
      showSubtitle: input.showSubtitle === true,
      template: TEMPLATES.some(t => t.id === input.template) ? input.template : 'classic-crest',
      size: [38, 50, 63].includes(Number(input.size)) ? Number(input.size) : 50,
      weight: Number.isFinite(Number(input.weight)) ? Math.max(0, Math.min(2, Math.round(Number(input.weight)))) : 0
    };
  }
  // Small editorial skeleton alphabet: each glyph is actual SVG path geometry.
  // Uniform strokes preserve machining widths instead of relying on font hairlines.
  const GLYPHS = Object.freeze({
    A: 'M0 8 3 0 6 8M1 5.3h4', B: 'M0 8V0h3.3C7 0 7 4 3.3 4H0m3.3 0C7 4 7 8 3.3 8H0',
    C: 'M6 1C4-1 0-.4 0 4s4 5 6 3', D: 'M0 0h2c5.3 0 5.3 8 0 8H0Z', E: 'M6 0H0v8h6M0 4h4.5',
    F: 'M6 0H0v8M0 4h4.5', G: 'M6 1C4-1 0-.4 0 4s4 5 6 3V4H3.5', H: 'M0 0v8M6 0v8M0 4h6',
    I: 'M1 0h4M3 0v8M1 8h4', J: 'M1 0h5v5.5C6 9 0 9 0 6', K: 'M0 0v8M6 0 0 4l6 4',
    L: 'M0 0v8h6', M: 'M0 8V0l3 4 3-4v8', N: 'M0 8V0l6 8V0',
    O: 'M3 0C-1 0-1 8 3 8S7 0 3 0Z', P: 'M0 8V0h3.3C7 0 7 4.5 3.3 4.5H0',
    Q: 'M3 0C-1 0-1 8 3 8S7 0 3 0ZM3.6 5.5 6.5 8.5', R: 'M0 8V0h3.3C7 0 7 4.3 3.3 4.3H0m3.3 0L6 8',
    S: 'M6 1C2-2-2 2.3 3 4s3.5 6-3 3', T: 'M0 0h6M3 0v8', U: 'M0 0v5c0 4 6 4 6 0V0',
    V: 'M0 0 3 8 6 0', W: 'M0 0 1 8 3 4l2 4 1-8', X: 'M0 0 6 8M6 0 0 8', Y: 'M0 0 3 4 6 0M3 4v4', Z: 'M0 0h6L0 8h6',
    '0': 'M3 0C-1 0-1 8 3 8S7 0 3 0Z', '1': 'M1 2 3 0v8M1 8h4', '2': 'M0 1C2-1 6-.2 6 2S1 6 0 8h6',
    '3': 'M0 1C4-2 9 3 3 4c6 0 3 7-3 3', '4': 'M5 8V0L0 5h6', '5': 'M6 0H0v4c8-3 8 7 0 3',
    '6': 'M6 1C1-2 0 2 0 5c0 4 6 4 6 0 0-3-6-3-6 0', '7': 'M0 0h6L2 8',
    '8': 'M3 0C-1 0-1 4 3 4S7 0 3 0Zm0 4c-4 0-4 4 0 4s4-4 0-4Z', '9': 'M0 7c5 3 6-1 6-4 0-4-6-4-6 0 0 3 6 3 6 0',
    '&': 'M6 8 1 3C-2-1 7-1 4 2L1 5c-4 5 6 4 5 0', '+': 'M0 4h6M3 1v6',
    '·': 'M2.9 4h.2', '.': 'M2.9 7.8h.2', '-': 'M1 4h4', '/': 'M0 8 6 0',
    "'": 'M3 0v2', '"': 'M1.5 0v2M4.5 0v2', '<': 'M5 0 1 4l4 4', '>': 'M1 0 5 4 1 8', ' ': ''
  });
  const f = n => Number(n.toFixed(3));
  const stroke = options => 14 + options.weight * 3;
  function glyph(character, x, y, scale, width, serif) {
    const path = GLYPHS[character] == null ? 'M0 0h6v8H0Z' : GLYPHS[character];
    const serifs = { A: 'M-.65 8h1.3M5.35 8h1.3', H: 'M-.65 8h1.3M5.35 8h1.3M-.65 0h1.3M5.35 0h1.3', K: 'M-.65 8h1.3M5.35 8h1.3M-.65 0h1.3M5.35 0h1.3', M: 'M-.65 8h1.3M5.35 8h1.3M-.65 0h1.3M5.35 0h1.3', N: 'M-.65 8h1.3M5.35 8h1.3M-.65 0h1.3M5.35 0h1.3', P: 'M-.65 0h1.3M-.65 8h1.3', R: 'M-.65 0h1.3M-.65 8h1.3M5.35 8h1.3' };
    const tips = serif && serifs[character] ? `<path d="${serifs[character]}"/>` : '';
    return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(scale)})" stroke-width="${f(width / scale)}"><path d="${path}"/>${tips}</g>`;
  }
  function subtitleLayout(options) {
    const count = chars(options.subtitle).length;
    // Allow a conservative -1…7 glyph envelope, including curved overshoots.
    // Reserve at least four viewBox units of clear space after stroke expansion.
    const sw = stroke(options);
    const available = options.template === 'editorial-box' ? 440 : options.template === 'laurel' ? 400 : 500;
    const scale = Math.min(10, available / Math.max(1, count * 12 - 4), (available - Math.max(0, count - 1) * (sw + 4)) / Math.max(1, count * 8));
    const advance = Math.max(12 * scale, 8 * scale + sw + 4);
    return { scale, advance, width: Math.max(0, count - 1) * advance + 8 * scale, clearance: advance - 8 * scale - sw };
  }
  function frame(options) {
    switch (options.template) {
      case 'art-deco': return '<path d="M500 82 795 205 918 500 795 795 500 918 205 795 82 500 205 205Z"/><path d="M500 126 764 236 874 500 764 764 500 874 236 764 126 500 236 236Z"/><path d="M500 82v90M500 828v90M82 500h90M828 500h90"/>';
      case 'laurel': {
        let leaves = '<path d="M388 810C155 690 155 310 388 190M612 810c233-120 233-500 0-620M430 865h140"/>';
        for (let side = 0; side < 2; side++) {
          leaves += `<g${side ? ' transform="translate(1000 0) scale(-1 1)"' : ''}>`;
          for (let i = 0; i < 6; i++) {
            const t = .1 + i * .16, u = 1 - t;
            const x = u ** 3 * 388 + 3 * u * u * t * 155 + 3 * u * t * t * 155 + t ** 3 * 388 - 18;
            const y = u ** 3 * 810 + 3 * u * u * t * 690 + 3 * u * t * t * 310 + t ** 3 * 190 - 11;
            leaves += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="35" ry="17" transform="rotate(35 ${f(x)} ${f(y)})"/>`;
          }
          leaves += '</g>';
        }
        return leaves;
      }
      case 'editorial-box': return '<rect x="210" y="210" width="580" height="580"/><rect x="251" y="251" width="498" height="498"/><path d="M185 250v-65h65M750 185h65v65M185 750v65h65M750 815h65v-65"/>';
      case 'estate-seal': return `<circle cx="500" cy="500" r="416" stroke-width="${stroke(options) + 6}"/><path d="M192 675Q500 820 808 675M382 190h236"/>`;
      default: return '<circle cx="500" cy="500" r="416"/><circle cx="500" cy="500" r="376"/><path d="M448 205h104M448 795h104"/>';
    }
  }
  function artwork(options, color = 'black') {
    const sw = stroke(options), isBox = options.template === 'editorial-box';
    const scale = isBox ? 22 : 29, gap = options.separator ? (isBox ? 48 : 78) : 28;
    const total = scale * 12 + gap + (options.separator ? scale * 3 : 0);
    const start = (1000 - total) / 2;
    const hasDate = options.showSubtitle && options.subtitle;
    const y = (hasDate ? 458 : 500) - scale * 4;
    const serif = ['classic-crest', 'estate-seal'].includes(options.template);
    let result = `<g fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round">${frame(options)}`;
    result += glyph(options.initial1, start, y, scale, sw, serif);
    if (options.separator) result += glyph(options.separator, start + scale * 6 + gap / 2, y + scale * 2, scale / 2, sw, false);
    result += glyph(options.initial2, start + total - scale * 6, y, scale, sw, serif);
    if (hasDate) {
      const layout = subtitleLayout(options);
      const subtitleY = isBox ? 622 : options.template === 'estate-seal' ? 610 : 632;
      chars(options.subtitle).forEach((c, i) => { result += glyph(c, (1000 - layout.width) / 2 + layout.scale + i * layout.advance, subtitleY, layout.scale, sw, false); });
    }
    return result + '</g>';
  }
  function generateSVG(input) {
    const options = normalize(input);
    const title = `${options.initial1}${options.separator}${options.initial2} wedding monogram${options.showSubtitle && options.subtitle ? ' · ' + options.subtitle : ''}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size}mm" height="${options.size}mm" viewBox="0 0 1000 1000"><title>${escapeXML(title)}</title><desc>${escapeXML(TEMPLATES.find(t => t.id === options.template).name)}; ${options.size} mm; black marks are raised metal. Artwork proof; confirm with your workshop before cutting.</desc><rect width="1000" height="1000" fill="white"/>${artwork(options)}</svg>`;
  }
  function checkReadability(input) {
    const options = normalize(input), minStrokeMM = stroke(options) * options.size / 1000;
    const hasDate = options.showSubtitle && options.subtitle.trim().length > 0;
    const minGapMM = hasDate ? subtitleLayout(options).clearance * options.size / 1000 : 26 * options.size / 1000;
    const unsupported = chars(options.initial1 + options.initial2 + (hasDate ? options.subtitle : '')).some(c => GLYPHS[c] == null);
    const warning = minStrokeMM < .5 || minGapMM < .8 || unsupported;
    const message = unsupported ? 'Use A–Z, 0–9 and simple date punctuation; unsupported characters appear as boxes.' : warning ? 'Date / subtitle spacing is tight. Try 2.0″ (50 mm), shorten or remove the date, then inspect in Studio.' : 'A clear starting point. Inspect stroke widths and gaps in Studio before machining.';
    return { minStrokeMM, minGapMM, warning, message };
  }
  function filename(input) {
    const options = normalize(input), initials = (options.initial1 + options.initial2).replace(/[^A-Z0-9]/g, '') || 'AM';
    return `${initials}-wedding-monogram-${options.size}mm.svg`;
  }
  function buildHandoff(input, studio = '../../studio/index.html') {
    const options = normalize(input);
    return { payload: { svg: generateSVG(options), name: filename(options), size: options.size, medium: 'ice' }, url: `${studio}?size=${options.size}&medium=ice&fromTool=monogram&src=monogram-tool` };
  }
  // Self-contained visual scenes use the exact same outlined artwork as the SVG.
  function generateSceneSVG(input, mode = 'ice') {
    const options = normalize(input), open = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">';
    if (mode === 'vector') return `${open}<title>Vector SVG proof</title><rect width="1080" height="1080" fill="white"/><g transform="translate(80 80) scale(.92)">${artwork(options)}</g></svg>`;
    if (mode === 'brass') return `${open}<title>Satin brass die preview</title><defs><linearGradient id="brass" x2="1" y2="1"><stop stop-color="#e9cf8c"/><stop offset=".35" stop-color="#b08a45"/><stop offset=".65" stop-color="#ecd9a1"/><stop offset="1" stop-color="#80602c"/></linearGradient><radialGradient id="bg"><stop stop-color="#f3eee5"/><stop offset="1" stop-color="#e2dbcf"/></radialGradient></defs><rect width="1080" height="1080" fill="url(#bg)"/><ellipse cx="540" cy="838" rx="345" ry="55" fill="#1c1b19" opacity=".13"/><circle cx="540" cy="555" r="354" fill="#81602d"/><circle cx="540" cy="531" r="354" fill="url(#brass)" stroke="#f2dfae" stroke-width="4"/><g transform="translate(217 208) scale(.646)">${artwork(options, '#f4dfaa')}</g><g transform="translate(215 205) scale(.646)">${artwork(options, '#62471e')}</g></svg>`;
    // Faceted clear cube, slate bar, internal fractures and a soft frosted impression.
    // Size scales the mark against a nominal 2-inch (50.8mm) cube for a useful visual fit.
    const mark = options.size / 50.8 * .62, origin = 540 - mark * 500;
    return `${open}<title>Wedding monogram on clear ice — concept preview</title><defs><radialGradient id="slate"><stop stop-color="#40505a"/><stop offset="1" stop-color="#111a20"/></radialGradient><linearGradient id="clear-ice" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e6f4f4" stop-opacity=".58"/><stop offset=".25" stop-color="#8baab7" stop-opacity=".12"/><stop offset=".55" stop-color="#e5f8ff" stop-opacity=".25"/><stop offset="1" stop-color="#a9c9d5" stop-opacity=".65"/></linearGradient><linearGradient id="rim"><stop stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="#bbd7e1" stop-opacity=".12"/><stop offset="1" stop-color="#e8faff" stop-opacity=".75"/></linearGradient><filter id="frost" x="-.1" y="-.1" width="1.2" height="1.2"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="shadow"><feGaussianBlur stdDeviation="22"/></filter></defs><rect width="1080" height="1080" fill="url(#slate)"/><ellipse cx="550" cy="855" rx="340" ry="58" fill="#050b10" opacity=".65" filter="url(#shadow)"/><g transform="rotate(-8 540 530)"><path d="M222 301 291 230H813l60 78-20 453-70 75H300l-75-69Z" fill="#a5cad5" fill-opacity=".16" stroke="#d6eff6" stroke-opacity=".27" stroke-width="3"/><rect x="222" y="242" width="620" height="550" rx="65" fill="url(#clear-ice)" stroke="url(#rim)" stroke-width="5"/><rect x="240" y="260" width="584" height="514" rx="52" fill="none" stroke="#e6f8ff" stroke-opacity=".2" stroke-width="2"/><path d="M266 308 295 285 431 274M775 291l33 27-8 145M272 728l35 31 162 5M801 673l-10 53-23 20" fill="none" stroke="#efffff" stroke-opacity=".66" stroke-width="5" stroke-linecap="round"/><path d="m252 555 48 26-25 94m480-351-41 32 45 35m-359 355 48-27 35 21" fill="none" stroke="#d4ecf8" stroke-opacity=".26" stroke-width="2"/><g transform="translate(${f(origin)} ${f(origin - 16)}) scale(${f(mark)})" opacity=".4" filter="url(#frost)">${artwork(options, '#efffff')}</g><g transform="translate(${f(origin)} ${f(origin - 18)}) scale(${f(mark)})" opacity=".91">${artwork(options, '#ecfaff')}</g></g><g fill="#e5eceb" text-anchor="middle" font-family="Georgia,serif"><text x="540" y="945" font-size="26" letter-spacing="5">${escapeXML(options.initial1 + ' ' + options.separator + ' ' + options.initial2)}</text><text x="540" y="992" font-size="15" letter-spacing="3">VELT &amp; FORGE · A MARK WORTH MAKING.</text></g></svg>`;
  }
  function mount(document) {
    const form = document.querySelector('#monogram-controls');
    if (!form) return;
    const $ = id => document.getElementById(id);
    let mode = 'ice';
    function read() {
      return normalize({ initial1: $('initial-1').value, initial2: $('initial-2').value, separator: $('separator').value, subtitle: $('subtitle').value, showSubtitle: $('show-subtitle').checked, template: form.querySelector('input[name="template"]:checked').value, size: $('stamp-size').value, weight: $('weight').value });
    }
    function update() {
      const options = read(), check = checkReadability(options);
      $('subtitle').disabled = !options.showSubtitle;
      $('weight-label').textContent = WEIGHTS[options.weight];
      $('weight').setAttribute('aria-valuetext', WEIGHTS[options.weight]);
      $('preview-art').innerHTML = generateSceneSVG(options, mode);
      $('preview-art').setAttribute('aria-label', `${options.initial1} ${options.separator} ${options.initial2}, ${TEMPLATES.find(t => t.id === options.template).name}, ${options.size} mm. ${mode === 'ice' ? 'Clear ice concept' : mode === 'brass' ? 'Brass die concept' : 'Vector proof'}.`);
      $('readability-pill').textContent = `${check.warning ? 'Review details' : 'Ice-readability check'} · est. ${check.minStrokeMM.toFixed(2)} mm min. stroke`;
      $('readability-pill').classList.toggle('is-warning', check.warning);
      $('readability-note').textContent = check.message;
      $('preview-dimension').textContent = `Ø ${options.size} mm · ${mode === 'ice' ? '2-inch cube' : mode === 'brass' ? 'die concept' : 'vector proof'}`;
      $('fit-note').hidden = mode !== 'ice' || options.size <= 50;
    }
    form.addEventListener('input', update);
    form.addEventListener('submit', event => event.preventDefault());
    document.querySelectorAll('[data-preview-mode]').forEach(button => button.addEventListener('click', () => {
      mode = button.dataset.previewMode;
      document.querySelectorAll('[data-preview-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      update();
    }));
    document.querySelectorAll('[data-template-thumb]').forEach(item => {
      const svg = generateSVG({ template: item.dataset.templateThumb });
      item.innerHTML = svg.replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
    });
    function status(message) { $('tool-status').textContent = message; }
    function download(blob, name) {
      const url = root.URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      root.setTimeout(() => root.URL.revokeObjectURL(url), 15000);
    }
    $('download-svg').addEventListener('click', () => {
      download(new Blob([generateSVG(read())], { type: 'image/svg+xml;charset=utf-8' }), filename(read()));
      status('Your free vector SVG is ready. Share it with your planner or bring it to Studio.');
    });
    $('open-studio').addEventListener('click', () => {
      const handoff = buildHandoff(read(), document.body.dataset.studio);
      try { root.sessionStorage.setItem('velt_pending_monogram', JSON.stringify(handoff.payload)); }
      catch (_) {
        download(new Blob([handoff.payload.svg], { type: 'image/svg+xml;charset=utf-8' }), filename(read()));
        status('Browser storage is unavailable. Your SVG has been downloaded; upload it in Studio.');
        // Give the browser its download before navigating to the wedding fallback.
        root.setTimeout(() => root.location.assign(handoff.url), 300);
        return;
      }
      root.location.assign(handoff.url);
    });
    $('download-png').addEventListener('click', async () => {
      const button = $('download-png'), options = read();
      button.disabled = true; status('Preparing your 1080 × 1080 clear-ice preview…');
      const url = root.URL.createObjectURL(new Blob([generateSceneSVG(options, 'ice')], { type: 'image/svg+xml;charset=utf-8' }));
      try {
        const image = new root.Image();
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Preview decoding failed')); image.src = url; });
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1080;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        context.drawImage(image, 0, 0, 1080, 1080);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('PNG encoding failed');
        download(blob, filename(options).replace('.svg', '-clear-ice.png'));
        status('Your 1080 × 1080 ice preview is ready to share. Concept image; actual impressions vary.');
      } catch (_) { status('We could not create the PNG in this browser. Try again or download the vector SVG.'); }
      finally { root.URL.revokeObjectURL(url); button.disabled = false; }
    });
    update();
  }
  const api = { TEMPLATES, normalize, escapeXML, generateSVG, checkReadability, filename, buildHandoff, generateSceneSVG, mount };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.VeltMonogram = api; if (root.document) mount(root.document); }
})(typeof window === 'object' ? window : globalThis);
