/* Velt & Forge — local, dependency-free geometry and calculator controller. */
(function (root) {
  'use strict';
  // Studio IDs are nominal millimetres; physical envelopes follow catalog inches.
  var STAMPS = [
    { id: 38, mm: 38.1, inches: '1.5', price: 69 },
    { id: 50, mm: 50.8, inches: '2.0', price: 89 },
    { id: 63, mm: 63.5, inches: '2.5', price: 109 }
  ];
  var GAP = 8; // Total diametral clearance; 4 mm at each opposing glass wall.
  var MARGIN = 4; // Ice margin on each side of the complete physical stamp head.
  function floorMM(n) { return Math.floor(n * 10) / 10; }
  function number(n) { return Number(n.toFixed(2)).toString(); }
  function toMM(value, unit) { return Number(value) * (unit === 'in' ? 25.4 : 1); }
  function chooseStamp(face) {
    for (var i = STAMPS.length - 1; i >= 0; i--) {
      if (face >= STAMPS[i].mm + MARGIN * 2) { return STAMPS[i]; }
    }
    return null;
  }
  function calculate(input) {
    input = input || {};
    var diameter = Number(input.diameter);
    if (!Number.isFinite(diameter)) { diameter = 82; }
    diameter = Math.max(50, Math.min(110, diameter));
    var format = ['cube', 'sphere', 'block'].indexOf(input.format) >= 0 ? input.format : 'cube';
    var context = ['home', 'wedding', 'bar'].indexOf(input.context) >= 0 ? input.context : 'home';
    var material = input.material === 'steel' ? 'steel' : 'brass';
    var width, length, flat, diagonal, warnings = [];
    if (format === 'sphere') {
      width = floorMM(diameter - GAP); length = width; diagonal = width;
      flat = Number(input.flatDiameter) || 0;
      if (flat <= 0) {
        flat = 0;
        warnings.push('A sphere has a curved top. Cut a stable flat face and enter its measured diameter before choosing a stamp.');
      } else if (flat > width) {
        flat = 0;
        warnings.push('The measured flat face cannot exceed the sphere diameter. Re-measure after cutting.');
      }
    } else if (format === 'block') {
      // A rectangular top in a 1:1.5 aspect ratio, checked at its farthest corners.
      width = floorMM((diameter - GAP) / Math.sqrt(3.25));
      length = floorMM(width * 1.5); flat = width;
      diagonal = Math.hypot(width, length);
      warnings.push('Highball spear: this is the top cross-section only. Measure glass taper, height and fill level separately; the spear must sit on a stable flat face for stamping.');
    } else {
      width = floorMM((diameter - GAP) / Math.SQRT2); length = width; flat = width;
      diagonal = Math.SQRT2 * width;
    }
    var stamp = chooseStamp(flat);
    if (!stamp && flat > 0) {
      warnings.push('The narrow flat face cannot fit a 38 mm stamp with 4 mm of ice at each edge. Use wider glassware or stamp a larger cube before service.');
    }
    var protocol = 'Temper clear ice for about 3–5 minutes until frost clears and the surface looks glassy; timing varies with room and freezer temperature. Use a clean, dry, room-temperature stamp; press lightly, then lift vertically. Wipe dry between impressions. ';
    if (context === 'wedding') {
      protocol += 'Rehearse with the caterer’s exact glass and ice. Temper small batches just before cocktail hour, keep reserve ice frozen, and plan stamp recovery time between pours.';
    } else if (context === 'bar') {
      protocol += 'For continuous service, rotate clean stamps so chilled heads recover toward room temperature. Test one cube at each shift and after a freezer change; do not compensate with extra force.';
    } else {
      protocol += 'Practice on one spare cube and adjust contact time after inspecting it. Stamp plain water ice before adding the drink; never use a flame or torch.';
    }
    return { diameter: diameter, format: format, context: context, material: material,
      iceWidth: width, iceLength: length, flatFace: flat, diagonal: diagonal,
      glassClearance: diameter - diagonal, stamp: stamp,
      artworkDiameter: stamp ? stamp.mm - MARGIN * 2 : 0,
      price: stamp ? stamp.price + (material === 'steel' ? 15 : 0) : null,
      dwell: material === 'steel' ? '4–5 seconds' : '2–3 seconds',
      protocol: protocol, warnings: warnings };
  }
  function studioURL(result, base) {
    if (!result.stamp) { return null; }
    return (base || '../../studio/index.html') + '?size=' + result.stamp.id + '&material=' + result.material + '&medium=ice&src=size-calc';
  }
  function blueprint(r) {
    // One SVG coordinate unit = one mm. All shapes share the same centre.
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-70 -70 140 140" role="img" aria-labelledby="bp-title bp-desc"><title id="bp-title">Glass, ice and stamp — true-scale top view</title><desc id="bp-desc">Glass inner diameter ' + number(r.diameter) + ' millimetres. Ice ' + number(r.iceWidth) + ' by ' + number(r.iceLength) + ' millimetres. Total wall clearance ' + number(r.glassClearance) + ' millimetres.' + (r.stamp ? ' Stamp ' + r.stamp.mm + ' millimetres with at least 4 millimetres ice margin on every side.' : ' No safe stamp recommendation.') + '</desc>';
    svg += '<path d="M-65 0H65M0-65V65" class="bp-axis"/><circle id="glass-rim" cx="0" cy="0" r="' + r.diameter / 2 + '" class="bp-glass"/>';
    if (r.format === 'sphere') {
      svg += '<circle id="ice-footprint" cx="0" cy="0" r="' + r.iceWidth / 2 + '" class="bp-ice"/>';
      if (r.flatFace) { svg += '<circle id="flat-face" cx="0" cy="0" r="' + r.flatFace / 2 + '" class="bp-flat"/>'; }
    } else {
      svg += '<rect id="ice-footprint" x="' + -r.iceWidth / 2 + '" y="' + -r.iceLength / 2 + '" width="' + r.iceWidth + '" height="' + r.iceLength + '" class="bp-ice"/>';
    }
    if (r.stamp) {
      svg += '<circle id="stamp-outline" cx="0" cy="0" r="' + r.stamp.mm / 2 + '" class="bp-stamp"/><circle id="artwork-zone" cx="0" cy="0" r="' + r.artworkDiameter / 2 + '" class="bp-artwork"/>';
      svg += '<path d="M' + r.stamp.mm / 2 + ' 0H' + r.flatFace / 2 + '" class="bp-margin"/>';
    }
    svg += '<path d="M-50 62H0M-50 60V64M0 60V64" class="bp-scale"/><text x="-25" y="68" text-anchor="middle" class="bp-scale-label">50 mm</text></svg>';
    return svg;
  }
  function mount(document) {
    var form = document.getElementById('size-controls');
    if (!form) { return; }
    function el(id) { return document.getElementById(id); }
    var diameter = 82, invalid = false;
    function syncFields() {
      var inches = el('diameter-unit').value === 'in';
      el('custom-diameter').value = Number((inches ? diameter / 25.4 : diameter).toFixed(8));
      el('custom-diameter').setAttribute('min', inches ? String(50 / 25.4) : '50');
      el('custom-diameter').setAttribute('max', inches ? String(110 / 25.4) : '110');
      el('custom-diameter').setAttribute('step', 'any');
      el('diameter-slider').value = String(diameter);
    }
    function render() {
      var format = form.querySelector('input[name="ice-format"]:checked').value;
      var r = calculate({ diameter: diameter, format: format, flatDiameter: el('flat-diameter').value,
        context: el('service-context').value, material: el('stamp-material').value });
      el('custom-fields').hidden = el('glass-preset').value !== 'custom';
      el('sphere-fields').hidden = format !== 'sphere';
      el('diameter-readout').textContent = number(diameter) + ' mm / ' + (diameter / 25.4).toFixed(2) + '″ inner Ø';
      el('blueprint').innerHTML = blueprint(r); // Only normalized numbers and fixed markup.
      var iceLabel = format === 'sphere' ? 'sphere diameter' : format === 'block' ? 'block top (width × length)' : 'cube side';
      el('ice-result').textContent = format === 'block'
        ? (r.iceWidth / 25.4).toFixed(2) + '″ × ' + (r.iceLength / 25.4).toFixed(2) + '″ / ' + number(r.iceWidth) + ' × ' + number(r.iceLength) + ' mm ' + iceLabel
        : (r.iceWidth / 25.4).toFixed(2) + '″ / ' + number(r.iceWidth) + ' mm ' + iceLabel;
      el('stamp-result').textContent = r.stamp ? r.stamp.inches + '″ (' + r.stamp.id + ' mm) · $' + r.price + (r.material === 'steel' ? ' including +$15 steel head' : ' brass base price') : 'No safe stamp fit';
      var equation = format === 'sphere' ? number(r.iceWidth) : format === 'block' ? '√(' + number(r.iceWidth) + '² + ' + number(r.iceLength) + '²)' : '√2 × ' + number(r.iceWidth);
      var fit = equation + ' = ' + r.diagonal.toFixed(2) + ' mm inside Ø ' + number(r.diameter) + ' mm: ' + r.glassClearance.toFixed(2) + ' mm total wall clearance (at least 4 mm per opposing side). ';
      fit += r.stamp ? 'Physical head Ø ' + r.stamp.mm + ' mm fits the ' + number(r.flatFace) + ' mm flat face with ' + ((r.flatFace - r.stamp.mm) / 2).toFixed(2) + ' mm ice at each edge. Safe artwork Ø ' + number(r.artworkDiameter) + ' mm includes a further 4 mm inset inside the head.' : 'The smallest head needs at least 46.1 mm of flat ice (38.1 + 4 + 4).';
      el('fit-result').textContent = fit;
      el('dwell-result').textContent = r.dwell + ' estimated contact';
      el('protocol-result').textContent = r.protocol;
      var badFlat = format === 'sphere' && (el('flat-diameter').value.trim() === '' || !Number.isFinite(Number(el('flat-diameter').value)) || Number(el('flat-diameter').value) < 0);
      var warnings = r.warnings.slice();
      if (invalid) { warnings.unshift('Enter an inner diameter from 50 to 110 mm (1.9685–4.3307 inches) to get a valid recommendation.'); }
      if (badFlat) { warnings.unshift('Enter a valid measured flat-face diameter, or 0 for an uncut sphere.'); }
      el('warning-result').textContent = warnings.join(' ');
      el('warning-result').hidden = !warnings.length;
      var link = el('studio-cta');
      var url = invalid || badFlat ? null : studioURL(r, document.body.dataset.studio);
      if (url) {
        link.setAttribute('href', url); link.removeAttribute('aria-disabled'); link.removeAttribute('tabindex');
        link.textContent = 'Check this ' + r.stamp.id + ' mm stamp in Studio ↗';
      } else {
        link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); link.setAttribute('tabindex', '-1');
        link.textContent = 'Choose a safe fit to open Studio';
      }
      el('summary-result').textContent = invalid || badFlat ? 'Measurement needed. Order link unavailable.' : r.stamp ? r.stamp.id + ' mm stamp recommended. ' + r.dwell + ' starting dwell time.' : 'No safe fit. Read the sizing note before ordering.';
    }
    form.addEventListener('submit', function (event) { event.preventDefault(); });
    form.addEventListener('input', render);
    form.addEventListener('change', render);
    el('glass-preset').addEventListener('change', function () {
      if (this.value !== 'custom') { diameter = Number(this.value); }
      invalid = false; syncFields(); render();
    }.bind(el('glass-preset')));
    el('diameter-unit').addEventListener('change', function () { invalid = false; syncFields(); render(); });
    el('custom-diameter').addEventListener('input', function () {
      var raw = el('custom-diameter').value;
      var mm = toMM(raw, el('diameter-unit').value);
      invalid = raw.trim() === '' || !Number.isFinite(mm) || mm < 50 || mm > 110;
      if (!invalid) { diameter = mm; el('diameter-slider').value = String(diameter); }
      render();
    });
    el('diameter-slider').addEventListener('input', function () {
      diameter = Number(el('diameter-slider').value); invalid = false; syncFields(); render();
    });
    syncFields(); render();
  }
  var api = { STAMPS: STAMPS, calculate: calculate, chooseStamp: chooseStamp, toMM: toMM, studioURL: studioURL, blueprint: blueprint, mount: mount };
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.VeltSizeCalc = api; if (root.document) { mount(root.document); } }
}(typeof window !== 'undefined' ? window : null));
