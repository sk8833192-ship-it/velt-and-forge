/* VELT & FORGE — deterministic, dependency-free production geometry.
 * Binary masks use 1 = raised metal, 0 = carved cavity. Units are millimeters.
 */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  root.StampEngine = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function validate(mask, width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || !mask || mask.length !== width * height) {
      throw new RangeError('Mask dimensions must match a nonempty rectangular mask.');
    }
  }

  // Felzenszwalb/Huttenlocher lower-envelope transform: exact Euclidean, O(w*h).
  function distanceTransform(mask, width, height, targetValue = 0) {
    validate(mask, width, height);
    const size = width * height;
    const result = new Float32Array(size);
    const intermediate = new Float64Array(size);
    const length = Math.max(width, height);
    const f = new Float64Array(length);
    const d = new Float64Array(length);
    const v = new Int32Array(length);
    const z = new Float64Array(length + 1);
    const infinity = 1e15;
    let hasTarget = false;
    for (let i = 0; i < size; i++) if (Number(Boolean(mask[i])) === Number(Boolean(targetValue))) { hasTarget = true; break; }
    if (!hasTarget) { result.fill(Infinity); return result; }

    function transform1D(n) {
      let k = 0;
      v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
      for (let q = 1; q < n; q++) {
        let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * (q - v[k]));
        while (s <= z[k]) {
          k--;
          s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * (q - v[k]));
        }
        v[++k] = q; z[k] = s; z[k + 1] = Infinity;
      }
      k = 0;
      for (let q = 0; q < n; q++) {
        while (z[k + 1] < q) k++;
        d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
      }
    }
    const target = Number(Boolean(targetValue));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) f[x] = Number(Boolean(mask[y * width + x])) === target ? 0 : infinity;
      transform1D(width);
      for (let x = 0; x < width; x++) intermediate[y * width + x] = d[x];
    }
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) f[y] = intermediate[y * width + x];
      transform1D(height);
      for (let y = 0; y < height; y++) result[y * width + x] = Math.sqrt(d[y]);
    }
    return result;
  }

  function dilate(mask, width, height, radiusPx) {
    validate(mask, width, height);
    if (!Number.isFinite(radiusPx) || radiusPx < 0) throw new RangeError('Dilation radius must be finite and nonnegative.');
    if (radiusPx === 0) return Uint8Array.from(mask, value => value ? 1 : 0);
    const distance = distanceTransform(mask, width, height, 1);
    return Uint8Array.from(distance, value => value <= radiusPx + 1e-6 ? 1 : 0);
  }

  // Test the continuous union of square pixel cells on a half-pixel lattice.
  // Lattice zeros include every cell-boundary segment endpoint and midpoint,
  // so the EDT measures actual boundary distance, rather than distance to the
  // center of the next white pixel. Half-pixel medial centers represent BOTH
  // odd- and even-width bars correctly: N pixels always have width N.
  // Rolling-disk opening then tests entire features, not merely their edges.
  function thicknessRisk(mask, width, height, minWidthPx) {
    const risk = new Uint8Array(mask.length);
    if (minWidthPx <= 1) return risk;
    const latticeW = width * 2 + 1, latticeH = height * 2 + 1;
    const interior = new Uint8Array(latticeW * latticeH);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      const center = (y * 2 + 1) * latticeW + x * 2 + 1;
      interior[center] = 1;
      const right = x + 1 < width && mask[i + 1];
      const below = y + 1 < height && mask[i + width];
      if (right) interior[center + 1] = 1;
      if (below) interior[center + latticeW] = 1;
      if (right && below && mask[i + width + 1]) interior[center + latticeW + 1] = 1;
    }
    const boundaryDistance = distanceTransform(interior, latticeW, latticeH, 0);
    const centers = new Uint8Array(interior.length);
    // A lattice step is half a pixel. Therefore a disk of radius minWidth/2
    // pixels has radius minWidth lattice steps, without off-by-one offsets.
    for (let i = 0; i < centers.length; i++) centers[i] = interior[i] && boundaryDistance[i] >= minWidthPx - 1e-6 ? 1 : 0;
    const centerDistance = distanceTransform(centers, latticeW, latticeH, 1);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      risk[i] = mask[i] && centerDistance[(y * 2 + 1) * latticeW + x * 2 + 1] > minWidthPx + 1e-6 ? 1 : 0;
    }
    return risk;
  }

  // Include enclosed counters and open channels bracketed by artwork. Do not
  // score the infinite white exterior, which has no opposing metal wall.
  function gapDomain(mask, width, height) {
    const domain = new Uint8Array(mask.length);
    for (let y = 0; y < height; y++) {
      let first = -1, last = -1;
      for (let x = 0; x < width; x++) if (mask[y * width + x]) { if (first < 0) first = x; last = x; }
      for (let x = first + 1; first >= 0 && x < last; x++) if (!mask[y * width + x]) domain[y * width + x] = 1;
    }
    for (let x = 0; x < width; x++) {
      let first = -1, last = -1;
      for (let y = 0; y < height; y++) if (mask[y * width + x]) { if (first < 0) first = y; last = y; }
      for (let y = first + 1; first >= 0 && y < last; y++) if (!mask[y * width + x]) domain[y * width + x] = 1;
    }
    return domain;
  }

  function analyze(mask, width, height, diameterMM, medium = { minStroke: 0.5, minGap: 0.8 }) {
    validate(mask, width, height);
    if (!(diameterMM > 0) || !Number.isFinite(diameterMM)) throw new RangeError('Physical diameter must be positive.');
    if (!(medium.minStroke > 0) || !(medium.minGap > 0)) throw new RangeError('Medium stroke and gap limits must be positive.');
    const mmPerPixel = diameterMM / width;
    const metal = Uint8Array.from(mask, value => value ? 1 : 0);
    const cavity = Uint8Array.from(metal, value => value ? 0 : 1);
    const strokeRisk = thicknessRisk(metal, width, height, medium.minStroke / mmPerPixel);
    const gapRisk = thicknessRisk(cavity, width, height, medium.minGap / mmPerPixel);
    const domain = gapDomain(metal, width, height);
    let metalPixels = 0, gapPixels = 0, strokeRiskPixels = 0, gapRiskPixels = 0;
    for (let i = 0; i < mask.length; i++) {
      metalPixels += metal[i]; gapPixels += domain[i]; strokeRiskPixels += strokeRisk[i];
      gapRisk[i] = gapRisk[i] && domain[i] ? 1 : 0;
      gapRiskPixels += gapRisk[i];
    }
    const strokeRiskPercent = metalPixels ? strokeRiskPixels / metalPixels * 100 : 0;
    const gapRiskPercent = gapPixels ? gapRiskPixels / gapPixels * 100 : 0;
    // Geometry-based heuristic, not a manufacturing guarantee. Square-root
    // weighting keeps small but meaningful fine-detail defects visible.
    const score = metalPixels ? Math.max(0, Math.min(100, Math.round(100 - 68 * Math.sqrt(strokeRiskPercent / 100) - 32 * Math.sqrt(gapRiskPercent / 100)))) : 0;
    return { score, strokeRisk, gapRisk, mmPerPixel, strokeRiskPixels, gapRiskPixels, metalPixels, gapPixels, strokeRiskPercent, gapRiskPercent, empty: metalPixels === 0, method: 'Exact Euclidean distance transform / rolling-disk local thickness' };
  }

  function escapeXML(value) {
    return String(value).replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
  }

  function mirroredSVG(mask, width, height, diameterMM, metadata = {}) {
    validate(mask, width, height);
    if (!(diameterMM > 0) || !Number.isFinite(diameterMM)) throw new RangeError('Physical diameter must be positive.');
    const scale = diameterMM / width;
    const artworkHeight = height * scale;
    const number = value => Number(value.toFixed(6));
    const rows = [];
    // Run-length rectangles are closed vector paths, never an embedded bitmap.
    for (let y = 0; y < height; y++) {
      let x = 0;
      while (x < width) {
        if (!mask[y * width + x]) { x++; continue; }
        const start = x;
        while (x < width && mask[y * width + x]) x++;
        const x0 = number(start * scale), y0 = number(y * scale), run = number((x - start) * scale), cell = number(scale);
        rows.push(`M${x0} ${y0}h${run}v${cell}h-${run}Z`);
      }
    }
    const title = metadata.title || 'VELT & FORGE mirrored CNC production proof';
    const note = escapeXML(`MIRRORED DIE FACE | Black = raised metal | White = cavity | CNC depth: 3.2 mm`);
    // Proof labels stay inside the artwork width at every physical size. Keep
    // customer names exact in title/metadata, but bound the visible footer.
    const visibleTitle = String(title).length > 56 ? `${String(title).slice(0, 55)}…` : String(title);
    const footerFont = Math.min(2, diameterMM / 25);
    const footerText = (label, offset) => {
      const length = number(Math.min(diameterMM, label.length * footerFont * 0.56));
      return `<text x="0" y="${number(artworkHeight + offset)}" font-size="${number(footerFont)}" textLength="${length}" lengthAdjust="spacingAndGlyphs">${escapeXML(label)}</text>`;
    };
    const footer = [
      footerText('MIRRORED DIE FACE | CNC depth: 3.2 mm', 3),
      footerText('Black = raised metal | White = cavity', 6),
      footerText(visibleTitle, 9),
      footerText('Remove dimension-guides and proof-notes groups', 12),
      footerText('before toolpath generation.', 15)
    ].join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${number(diameterMM + 20)}mm" height="${number(artworkHeight + 32)}mm" viewBox="-10 -14 ${number(diameterMM + 20)} ${number(artworkHeight + 32)}">
<title>${escapeXML(title)}</title>
<desc>${note}. Dimension guides and labels are on a separate non-production group. Artwork contains no fonts.</desc>
<metadata>${escapeXML(JSON.stringify({ ...metadata, diameterMM, artworkHeightMM: artworkHeight, depthMM: 3.2, mirrored: true, pixelPitchMM: scale }))}</metadata>
<rect x="-10" y="-14" width="${number(diameterMM + 20)}" height="${number(artworkHeight + 32)}" fill="white"/>
<g id="production-artwork" transform="translate(${number(diameterMM)} 0) scale(-1 1)" fill="black"><path d="${rows.join('')}"/></g>
<g id="dimension-guides-not-for-machining" fill="none" stroke="#777" stroke-width="0.15"><rect x="0" y="0" width="${number(diameterMM)}" height="${number(artworkHeight)}" stroke-dasharray="1 1"/><path d="M0 -2V-6M${number(diameterMM)} -2V-6M0 -4H${number(diameterMM)}M-2 0H-6M-2 ${number(artworkHeight)}H-6M-4 0V${number(artworkHeight)}"/></g>
<g id="proof-notes-not-for-machining" fill="#333" font-family="Arial,sans-serif" font-size="2"><text x="${number(diameterMM / 2)}" y="-7" text-anchor="middle">${number(diameterMM)} mm</text>${footer}</g>
</svg>`;
  }

  return Object.freeze({ distanceTransform, dilate, analyze, mirroredSVG });
});
