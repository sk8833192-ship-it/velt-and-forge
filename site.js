/* VELT & FORGE — storefront behaviour
   Vanilla JS, no dependencies, works over file://.
   Modules: nav, smooth anchors, FAQ accordion, gallery, configurator + studio handoff,
   troubleshooting checklist, copy-to-clipboard, table-of-contents highlight. */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function store(key, value) {
    try {
      if (value === undefined) { return window.localStorage.getItem(key); }
      if (value === null) { window.localStorage.removeItem(key); } else { window.localStorage.setItem(key, value); }
    } catch (e) { /* storage unavailable (private mode / file policy) */ }
    return null;
  }

  /* ---------- Year ---------- */
  $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Mobile navigation ---------- */
  var header = $('.site-header');
  var toggle = $('.nav-toggle');
  var nav = $('#main-nav');

  function setNav(open) {
    if (!toggle || !nav) { return; }
    if (open && header) {
      var bottom = Math.max(0, Math.round(header.getBoundingClientRect().bottom));
      root.style.setProperty('--nav-top', bottom + 'px');
    }
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setNav(toggle.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
        setNav(false);
        toggle.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 960) { setNav(false); }
    });
  }

  /* ---------- Smooth in-page anchors ---------- */
  document.addEventListener('click', function (e) {
    var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!link) { return; }
    var id = link.getAttribute('href').slice(1);
    if (!id) { return; }
    var target = document.getElementById(id);
    if (!target) { return; }
    e.preventDefault();
    setNav(false);
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (!target.hasAttribute('tabindex')) { target.setAttribute('tabindex', '-1'); }
    target.focus({ preventScroll: true });
    if (window.history && window.history.pushState) {
      try { window.history.pushState(null, '', '#' + id); } catch (err) { /* file:// edge cases */ }
    }
  });

  /* ---------- FAQ accordion ---------- */
  function openPanel(btn, panel, animate) {
    btn.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    if (!animate || reduceMotion) { panel.style.height = 'auto'; return; }
    panel.style.height = '0px';
    var h = panel.scrollHeight;
    requestAnimationFrame(function () { panel.style.height = h + 'px'; });
    panel.addEventListener('transitionend', function done(ev) {
      if (ev.propertyName !== 'height') { return; }
      panel.removeEventListener('transitionend', done);
      if (btn.getAttribute('aria-expanded') === 'true') { panel.style.height = 'auto'; }
    });
  }

  function closePanel(btn, panel, animate) {
    btn.setAttribute('aria-expanded', 'false');
    if (!animate || reduceMotion) { panel.style.height = '0px'; panel.hidden = true; return; }
    panel.style.height = panel.scrollHeight + 'px';
    void panel.offsetHeight; // reflow
    panel.style.height = '0px';
    panel.addEventListener('transitionend', function done(ev) {
      if (ev.propertyName !== 'height') { return; }
      panel.removeEventListener('transitionend', done);
      if (btn.getAttribute('aria-expanded') === 'false') { panel.hidden = true; }
    });
  }

  $$('[data-faq]').forEach(function (faq) {
    var buttons = $$('.faq-q button', faq);
    buttons.forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) { return; }
      if (btn.getAttribute('aria-expanded') === 'true') { openPanel(btn, panel, false); } else { closePanel(btn, panel, false); }
      btn.addEventListener('click', function () {
        var isOpen = btn.getAttribute('aria-expanded') === 'true';
        if (isOpen) { closePanel(btn, panel, true); } else { openPanel(btn, panel, true); }
      });
    });
    var all = $('[data-faq-toggle-all]', faq.parentNode);
    if (all) {
      all.addEventListener('click', function () {
        var expand = all.getAttribute('data-state') !== 'open';
        buttons.forEach(function (btn) {
          var panel = document.getElementById(btn.getAttribute('aria-controls'));
          if (!panel) { return; }
          if (expand) { openPanel(btn, panel, true); } else { closePanel(btn, panel, true); }
        });
        all.setAttribute('data-state', expand ? 'open' : 'closed');
        all.textContent = expand ? 'Collapse all answers' : 'Expand all answers';
      });
    }
  });

  // Open a FAQ answer when its anchor is targeted (e.g. #faq-prop65)
  function openFromHash() {
    if (!location.hash) { return; }
    var target = document.getElementById(location.hash.slice(1));
    if (!target || !target.classList.contains('faq-item')) { return; }
    var btn = $('.faq-q button', target);
    var panel = btn && document.getElementById(btn.getAttribute('aria-controls'));
    if (btn && panel && btn.getAttribute('aria-expanded') !== 'true') { openPanel(btn, panel, false); }
  }
  openFromHash();
  window.addEventListener('hashchange', openFromHash);

  /* ---------- Product gallery ---------- */
  $$('[data-gallery]').forEach(function (gallery) {
    var tabs = $$('[role="tab"]', gallery);
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var fig = document.getElementById(t.getAttribute('aria-controls'));
        if (fig) { fig.classList.toggle('active', on); fig.hidden = !on; }
      });
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') { next = tabs[(i + 1) % tabs.length]; }
        if (e.key === 'ArrowLeft') { next = tabs[(i - 1 + tabs.length) % tabs.length]; }
        if (next) { e.preventDefault(); select(next); next.focus(); }
      });
    });
    var initial = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    if (initial) { select(initial); }
  });

  /* ---------- Configurator + studio handoff ----------
     Price logic mirrors studio/app.js: size base + $15 for 304 steel + $18 for steel handle,
     plus the optional +$49 second interchangeable head (M8 thread).
     Configurator options (data attributes on [data-configurator]):
       data-default-material / -size / -handle / -mount, data-lock-material (ignore ?material=),
       data-handles="walnut,steel" (allowed handles), data-medium, data-demo, data-omit-material,
       data-material-label (summary override).
     Only non-sensitive configuration goes into the URL (never artwork, names or email). */
  var SIZES = {
    '38': { price: 69, label: '1.5-inch', mm: '38.1 mm' },
    '50': { price: 89, label: '2-inch', mm: '50.8 mm' },
    '63': { price: 109, label: '2.5-inch', mm: '63.5 mm' }
  };
  var MATERIALS = {
    brass: { add: 0, label: 'Lead-free brass', note: 'Lead-free brass. Alloy grade, test scope and batch documentation will be published before orders open.' },
    steel: { add: 15, label: '304 stainless steel', note: '304 stainless steel. Conducts heat more slowly than brass, so expect a different contact time on ice.' }
  };
  var HANDLES = {
    walnut: { add: 0, label: 'Walnut handle' },
    steel: { add: 18, label: '304 stainless handle' },
    arbor: { add: 0, label: 'Leather fitting (M8)' }
  };
  var MOUNTS = {
    rod: 'Brass mallet rod (M8)',
    press: 'Head only · M8-tapped for arbor press'
  };
  var EXTRA_HEAD = 49;
  var MEDIUMS = { ice: 1, leather: 1 };
  var DEMOS = { crest: 1, wedding: 1, leather: 1 };

  var state = null;
  var configurator = $('[data-configurator]');

  function readParams() {
    var out = {};
    try {
      var p = new URLSearchParams(window.location.search);
      if (MATERIALS[p.get('material')]) { out.material = p.get('material'); }
      if (SIZES[p.get('size')]) { out.size = p.get('size'); }
      if (HANDLES[p.get('handle')]) { out.handle = p.get('handle'); }
      if (MOUNTS[p.get('mount')]) { out.mount = p.get('mount'); }
      if (p.get('extraHead') === '1') { out.extra = 1; }
    } catch (e) { /* older browsers */ }
    return out;
  }

  function priceOf(s) {
    return SIZES[s.size].price + MATERIALS[s.material].add + HANDLES[s.handle].add + (s.extra ? EXTRA_HEAD : 0);
  }

  function studioBase() {
    return document.body.getAttribute('data-studio') || '../studio/index.html';
  }

  function cleanSrc(value) { return String(value).replace(/[^a-z0-9-]/gi, '').slice(0, 40); }

  function updateStudioLinks() {
    var cfgMedium = configurator ? configurator.getAttribute('data-medium') : null;
    var cfgDemo = configurator ? configurator.getAttribute('data-demo') : null;
    var pageDemo = document.body.getAttribute('data-studio-demo');
    $$('a[data-studio-link]').forEach(function (a) {
      var params = new URLSearchParams();
      var useConfig = !!state && a.getAttribute('data-use-config') !== 'false';
      var medium = a.getAttribute('data-medium') || (useConfig && cfgMedium) || 'ice';
      if (!MEDIUMS[medium]) { medium = 'ice'; }
      params.set('medium', medium);
      var demo = a.getAttribute('data-demo') || (useConfig && cfgDemo) || (medium === 'ice' ? pageDemo : null);
      if (demo && DEMOS[demo]) { params.set('demo', demo); }
      var forceExtra = a.getAttribute('data-force-extra') === '1';
      if (useConfig) {
        if (!configurator.hasAttribute('data-omit-material')) { params.set('material', state.material); }
        params.set('size', state.size);
        params.set('handle', state.handle);
        if (state.mount) { params.set('mount', state.mount); }
        params.set('extraHead', forceExtra ? '1' : String(state.extra));
      } else if (forceExtra) {
        params.set('extraHead', '1');
      }
      var src = a.getAttribute('data-src');
      if (src) { params.set('src', cleanSrc(src)); }
      a.setAttribute('href', studioBase() + '?' + params.toString());
    });
  }

  function pressGroup(selector, attr, value) {
    $$(selector, configurator).forEach(function (b) {
      var on = b.getAttribute(attr) === value;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderConfig() {
    if (!configurator || !state) { return; }
    var total = priceOf(state);
    pressGroup('[data-material]', 'data-material', state.material);
    pressGroup('[data-size]', 'data-size', state.size);
    pressGroup('[data-head-option]', 'data-head-option', String(state.extra));
    var handle = $('[data-handle]', configurator);
    if (handle) { handle.value = state.handle; }
    var mount = $('[data-mount]', configurator);
    if (mount && state.mount) { mount.value = state.mount; }
    $$('[data-price]').forEach(function (el) { el.innerHTML = '$' + total + '<span>.00</span>'; });
    $$('[data-cta-price]').forEach(function (el) { el.textContent = 'US$' + total; });
    var materialLabel = configurator.getAttribute('data-material-label') || MATERIALS[state.material].label;
    var fitting = state.mount ? MOUNTS[state.mount] : HANDLES[state.handle].label;
    $$('[data-config-summary]').forEach(function (el) {
      el.textContent = SIZES[state.size].label + ' (' + SIZES[state.size].mm + ') · ' + materialLabel + ' · ' + fitting + (state.extra ? ' · + 2nd custom head' : '');
    });
    $$('[data-material-note]').forEach(function (el) { el.textContent = MATERIALS[state.material].note; });
    updateStudioLinks();
  }

  if (configurator) {
    var fromUrl = readParams();
    var allowedHandles = (configurator.getAttribute('data-handles') || 'walnut,steel').split(',');
    var defaultMount = configurator.getAttribute('data-default-mount');
    state = {
      material: (!configurator.hasAttribute('data-lock-material') && fromUrl.material) || configurator.getAttribute('data-default-material') || 'brass',
      size: fromUrl.size || configurator.getAttribute('data-default-size') || '50',
      handle: (fromUrl.handle && allowedHandles.indexOf(fromUrl.handle) !== -1 ? fromUrl.handle : null) || configurator.getAttribute('data-default-handle') || 'walnut',
      mount: defaultMount ? (fromUrl.mount || defaultMount) : null,
      extra: fromUrl.extra === 1 ? 1 : 0
    };
    configurator.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || !configurator.contains(b)) { return; }
      if (b.hasAttribute('data-material') && MATERIALS[b.getAttribute('data-material')]) {
        state.material = b.getAttribute('data-material');
      } else if (b.hasAttribute('data-size') && SIZES[b.getAttribute('data-size')]) {
        state.size = b.getAttribute('data-size');
      } else if (b.hasAttribute('data-head-option')) {
        state.extra = b.getAttribute('data-head-option') === '1' ? 1 : 0;
      } else { return; }
      renderConfig();
    });
    var handleSelect = $('[data-handle]', configurator);
    if (handleSelect) {
      handleSelect.addEventListener('change', function () {
        if (HANDLES[handleSelect.value]) { state.handle = handleSelect.value; renderConfig(); }
      });
    }
    var mountSelect = $('[data-mount]', configurator);
    if (mountSelect) {
      mountSelect.addEventListener('change', function () {
        if (MOUNTS[mountSelect.value]) { state.mount = mountSelect.value; renderConfig(); }
      });
    }
    renderConfig();
  } else {
    updateStudioLinks();
  }

  /* ---------- Subtle reveals ---------- */
  var reveals = $$('[data-reveal]');
  if (reveals.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      reveals.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
      reveals.forEach(function (el) { revealObserver.observe(el); });
    }
  }

  /* ---------- Lead-free metallurgy scale: linear / log toggle ---------- */
  $$('[data-pb-scale]').forEach(function (scale) {
    var buttons = $$('[data-pb-mode]', scale);
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var log = btn.getAttribute('data-pb-mode') === 'log';
        scale.classList.toggle('is-log', log);
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      });
    });
  });

  /* ---------- Wedding date reverse-planner ----------
     Planning targets only. Never promises a delivery date: the estimated ship date is shown before checkout. */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseIso(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    if (!m) { return null; }
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function dayDiff(a, b) { return Math.round((a.getTime() - b.getTime()) / 86400000); }
  function fmtDate(d) {
    try { return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return d.toDateString(); }
  }
  function spanText(n) {
    if (n < 14) { return n + ' day' + (n === 1 ? '' : 's'); }
    return Math.round(n / 7) + ' weeks';
  }
  function relText(days) {
    if (days === 0) { return 'Today'; }
    if (days < 0) { return spanText(-days) + ' ago · passed'; }
    return 'In ' + spanText(days);
  }

  $$('[data-wedding-planner]').forEach(function (planner) {
    var input = $('[data-planner-date]', planner);
    var status = $('[data-planner-status]', planner);
    var steps = $$('[data-weeks]', planner);
    if (!input || !steps.length) { return; }
    var key = 'vf-wedding-date';
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    input.min = isoDate(today);
    var saved = parseIso(store(key));
    input.value = isoDate(saved && saved >= today ? saved : addDays(today, 7 * 20));

    function render(persist) {
      var wedding = parseIso(input.value);
      if (!wedding) {
        if (status) { status.textContent = 'Choose your wedding date to see your milestones.'; status.removeAttribute('data-tone'); }
        steps.forEach(function (li) { li.removeAttribute('data-state'); $('[data-date]', li).textContent = '—'; $('[data-rel]', li).textContent = ''; });
        return;
      }
      var untilWedding = dayDiff(wedding, today);
      var nextSet = false;
      steps.forEach(function (li) {
        var d = addDays(wedding, -7 * Number(li.getAttribute('data-weeks')));
        var diff = dayDiff(d, today);
        $('[data-date]', li).textContent = fmtDate(d);
        $('[data-rel]', li).textContent = relText(diff);
        var st = diff < 0 ? 'past' : (nextSet ? 'future' : 'next');
        if (st === 'next') { nextSet = true; }
        li.setAttribute('data-state', st);
      });
      var approveBy = addDays(wedding, -7 * Number(steps[0].getAttribute('data-weeks')));
      var approveDiff = dayDiff(approveBy, today);
      var tone; var msg;
      if (untilWedding < 0) {
        tone = 'past';
        msg = '<strong>That date has passed.</strong> Choose your upcoming wedding date.';
      } else if (approveDiff < 0) {
        tone = 'tight';
        msg = '<strong>Tight timeline: ' + spanText(untilWedding) + ' to go.</strong> Tell us your date before ordering and we will confirm whether the current schedule can accommodate it. Your estimated ship date is shown before checkout. Please don’t treat it as an event-delivery guarantee.';
      } else {
        tone = 'ok';
        msg = '<strong>Comfortable: ' + spanText(untilWedding) + ' to go.</strong> Approve your artwork by ' + fmtDate(approveBy) + ' (' + spanText(approveDiff) + ' from today). Your estimated ship date is shown before checkout, so compare it with this plan before you commit.';
      }
      if (status) { status.innerHTML = msg; status.setAttribute('data-tone', tone); }
      if (persist) { store(key, input.value); }
    }
    input.addEventListener('change', function () { render(true); });
    input.addEventListener('input', function () { render(true); });
    render(false);
  });

  /* ---------- Bar & hospitality tier calculator ----------
     Same unit pricing as the studio. Volume tiers: 1 set list | 2–4 sets −10% | 5–12 sets −18%.
     No payment form: the output is a spec brief to copy, plus a studio handoff. */
  function money(n) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function clampInt(v, lo, hi, fallback) {
    var n = parseInt(v, 10);
    if (isNaN(n)) { n = fallback; }
    return Math.min(hi, Math.max(lo, n));
  }
  function tierOf(n) {
    if (n >= 5) { return { index: 2, rate: 0.18, name: 'Program tier', range: '5–12 sets' }; }
    if (n >= 2) { return { index: 1, rate: 0.10, name: 'Hospitality tier', range: '2–4 sets' }; }
    return { index: 0, rate: 0, name: 'Standard', range: '1 set' };
  }

  $$('[data-bar-calc]').forEach(function (calc) {
    function q(sel) { return $(sel, calc); }
    var inputs = {
      handles: q('[data-calc="handles"]'),
      extra: q('[data-calc="extra"]'),
      handle: q('[data-calc="handle"]'),
      pours: q('[data-calc="pours"]'),
      disposable: q('[data-calc="disposable"]')
    };
    var st = {
      handles: clampInt(inputs.handles && inputs.handles.value, 1, 12, 3),
      size: '50',
      alloy: 'brass',
      handle: (inputs.handle && inputs.handle.value) || 'walnut',
      extra: clampInt(inputs.extra && inputs.extra.value, 0, 24, 2),
      pours: clampInt(inputs.pours && inputs.pours.value, 100, 100000, 1000),
      disposable: 0.10
    };
    var studioLink = q('[data-calc-studio]');
    var copyBtn = q('[data-calc-copy]');
    var copyStatus = q('[data-calc-status]');

    function compute() {
      var steel = st.alloy === 'steel';
      var perSet = SIZES[st.size].price + (steel ? MATERIALS.steel.add : 0) + (st.handle === 'steel' ? HANDLES.steel.add : 0);
      var sets = perSet * st.handles;
      var heads = EXTRA_HEAD * st.extra;
      var subtotal = sets + heads;
      var tier = tierOf(st.handles);
      var discount = Math.round(subtotal * tier.rate * 100) / 100;
      var total = Math.round((subtotal - discount) * 100) / 100;
      var pours = st.handles * st.pours;
      return {
        steel: steel, perSet: perSet, sets: sets, heads: heads, subtotal: subtotal, tier: tier,
        discount: discount, total: total, pours: pours, cpp: total / pours,
        disposableTotal: Math.round(pours * st.disposable * 100) / 100
      };
    }

    function cppText(v) { return '~$' + (v >= 0.01 ? v.toFixed(2) : v.toFixed(3)); }

    function studioHref(c) {
      var p = new URLSearchParams();
      p.set('demo', 'crest');
      p.set('size', st.size);
      if (c.steel) { p.set('material', 'steel'); }
      if (st.handle === 'steel') { p.set('handle', 'steel'); }
      p.set('medium', 'ice');
      if (st.extra > 0) { p.set('extraHead', '1'); }
      p.set('src', 'bar-calc');
      return studioBase() + '?' + p.toString();
    }

    function set(sel, text) { var el = q(sel); if (el) { el.textContent = text; } }

    function render() {
      var c = compute();
      $$('[data-calc-size]', calc).forEach(function (b) {
        var on = b.getAttribute('data-calc-size') === st.size;
        b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      $$('[data-calc-alloy]', calc).forEach(function (b) {
        var on = b.getAttribute('data-calc-alloy') === st.alloy;
        b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      $$('[data-tier]', calc).forEach(function (t) { t.classList.toggle('active', Number(t.getAttribute('data-tier')) === c.tier.index); });
      set('[data-calc-out="handles"]', String(st.handles));
      set('[data-calc-set-desc]', '(' + SIZES[st.size].label + ', ' + (c.steel ? '304 steel' : 'lead-free brass') + ', ' + (st.handle === 'steel' ? 'steel handle' : 'walnut') + ')');
      set('[data-calc-perset]', money(c.perSet));
      set('[data-calc-n]', String(st.handles));
      set('[data-calc-sets]', money(c.sets));
      set('[data-calc-x]', String(st.extra));
      set('[data-calc-heads]', money(c.heads));
      set('[data-calc-subtotal]', money(c.subtotal));
      set('[data-calc-tier-name]', c.tier.name + (c.tier.rate ? ' (' + Math.round(c.tier.rate * 100) + '%)' : ' (list price)'));
      set('[data-calc-discount]', c.discount ? '−' + money(c.discount) : '$0.00');
      set('[data-calc-total]', money(c.total));
      set('[data-calc-summary]', st.handles + ' set' + (st.handles === 1 ? '' : 's') + ' · ' + st.extra + ' extra head' + (st.extra === 1 ? '' : 's') + ' · ' + c.tier.name);
      set('[data-calc-cpp]', cppText(c.cpp));
      var nudge = '';
      if (st.handles === 1) { nudge = 'Add one more set to unlock the 10% hospitality tier.'; }
      else if (st.handles < 5) { nudge = 'Add ' + (5 - st.handles) + ' more set' + (5 - st.handles === 1 ? '' : 's') + ' to reach the 18% program tier.'; }
      else { nudge = 'Program tier unlocked: 18% off every set and head.'; }
      set('[data-calc-nudge]', nudge);
      var note = 'Across ' + st.handles + ' handle' + (st.handles === 1 ? '' : 's') + ' × ' + st.pours.toLocaleString('en-US') + ' stamped pours each (' + c.pours.toLocaleString('en-US') + ' pours), paid once.';
      if (st.disposable > 0) {
        note += ' At your ' + money(st.disposable) + ' per pour for branded disposables (picks, printed napkins), the same pours cost ' + money(c.disposableTotal) + ', and you pay it again with every restock.';
      }
      set('[data-calc-pour-note]', note);
      if (studioLink) { studioLink.setAttribute('href', studioHref(c)); }
      if (copyStatus) { copyStatus.textContent = ''; }
    }

    function brief() {
      var c = compute();
      var studioUrl = studioHref(c);
      try { studioUrl = new URL(studioUrl, window.location.href).href; } catch (e) { /* keep relative */ }
      return [
        'VELT & FORGE: HOSPITALITY SPEC BRIEF (pre-launch estimate)',
        '',
        'Sets (handle + custom head): ' + st.handles + ' × ' + SIZES[st.size].label + ' (' + SIZES[st.size].mm + ') face',
        'Contact-face alloy: ' + (c.steel ? '304 stainless steel (+$15 per head)' : 'Lead-free bismuth brass (included)'),
        'Handle: ' + (st.handle === 'steel' ? 'Solid 304 stainless (+$18 per set)' : 'Turned walnut (included)'),
        'Extra interchangeable heads (M8 thread): ' + st.extra + ' × $49',
        'Volume tier: ' + c.tier.name + ' (' + c.tier.range + (c.tier.rate ? ', ' + Math.round(c.tier.rate * 100) + '% off' : ', list price') + ')',
        '',
        'Per set: ' + money(c.perSet),
        'Subtotal: ' + money(c.subtotal),
        'Tier saving: ' + (c.discount ? '-' + money(c.discount) : '$0.00'),
        'Estimated total: ' + money(c.total) + ' USD (before shipping and taxes)',
        'Cost per stamped pour: ' + cppText(c.cpp) + ' over ' + c.pours.toLocaleString('en-US') + ' pours',
        '',
        'Artwork: to be uploaded and checked at final size in the Studio. Digital proof approved before machining.',
        'Notes: Proposed pre-launch pricing. Volume tier, shipping, taxes and the estimated ship date are confirmed in writing before any order. No payment taken.',
        'Studio: ' + studioUrl
      ].join('\n');
    }

    if (inputs.handles) {
      inputs.handles.addEventListener('input', function () { st.handles = clampInt(inputs.handles.value, 1, 12, 1); render(); });
    }
    if (inputs.extra) {
      inputs.extra.addEventListener('input', function () { st.extra = clampInt(inputs.extra.value, 0, 24, 0); render(); });
      inputs.extra.addEventListener('blur', function () { inputs.extra.value = String(st.extra); });
    }
    if (inputs.handle) {
      inputs.handle.addEventListener('change', function () { st.handle = inputs.handle.value === 'steel' ? 'steel' : 'walnut'; render(); });
    }
    if (inputs.pours) {
      inputs.pours.addEventListener('change', function () { st.pours = clampInt(inputs.pours.value, 100, 100000, 1000); render(); });
    }
    if (inputs.disposable) {
      inputs.disposable.addEventListener('input', function () {
        var v = parseFloat(inputs.disposable.value);
        st.disposable = isNaN(v) || v < 0 ? 0 : Math.min(v, 100);
        render();
      });
      var dv = parseFloat(inputs.disposable.value);
      if (!isNaN(dv) && dv >= 0) { st.disposable = dv; }
    }
    calc.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || !calc.contains(b)) { return; }
      if (b.hasAttribute('data-calc-size') && SIZES[b.getAttribute('data-calc-size')]) {
        st.size = b.getAttribute('data-calc-size'); render();
      } else if (b.hasAttribute('data-calc-alloy')) {
        st.alloy = b.getAttribute('data-calc-alloy') === 'steel' ? 'steel' : 'brass'; render();
      } else if (b.hasAttribute('data-step')) {
        st.extra = clampInt(st.extra + Number(b.getAttribute('data-step')), 0, 24, 0);
        if (inputs.extra) { inputs.extra.value = String(st.extra); }
        render();
      }
    });
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyText(brief(), function (ok) {
          if (copyStatus) { copyStatus.textContent = ok ? 'Spec brief copied. Paste it into an email to your team or to us.' : 'Copy was blocked by the browser. Select the figures above and copy them manually.'; }
        });
      });
    }
    render();
  });

  /* ---------- Troubleshooting checklist ---------- */
  $$('[data-checklist]').forEach(function (list) {
    var key = 'vf-checklist-' + (list.id || 'default');
    var boxes = $$('input[type="checkbox"]', list);
    var bar = $('[data-progress-bar]', list);
    var count = $('[data-progress-count]', list);
    var message = $('[data-checklist-message]', list);
    var reset = $('[data-checklist-reset]', list);
    var saved = (store(key) || '').split(',');

    boxes.forEach(function (box) { if (saved.indexOf(box.value) !== -1) { box.checked = true; } });

    function update(persist) {
      var done = boxes.filter(function (b) { return b.checked; });
      var n = done.length;
      var total = boxes.length;
      boxes.forEach(function (b) {
        var item = b.closest('.check-item');
        if (item) { item.classList.toggle('done', b.checked); }
      });
      if (bar) { bar.style.width = (total ? (n / total) * 100 : 0) + '%'; }
      if (count) { count.textContent = n + ' of ' + total + ' checked'; }
      if (message) {
        var unchecked = boxes.filter(function (b) { return !b.checked; }).map(function (b) { return b.getAttribute('data-short'); });
        if (n === 0) {
          message.innerHTML = list.getAttribute('data-msg-empty') || 'Tick each check you have <strong>confirmed on a spare cube</strong>. We will point to what is left.';
        } else if (n < total) {
          message.innerHTML = '<strong>Still to confirm:</strong> ' + unchecked.join(', ') + '. ' + (list.getAttribute('data-msg-partial') || 'Change one variable at a time.');
        } else {
          message.innerHTML = list.getAttribute('data-msg-done') || '<strong>Your setup checks out.</strong> If fine details still blur, the artwork may need more room at this size. Check it next.';
        }
      }
      if (persist) { store(key, done.map(function (b) { return b.value; }).join(',') || null); }
    }

    boxes.forEach(function (b) { b.addEventListener('change', function () { update(true); }); });
    if (reset) {
      reset.addEventListener('click', function () {
        boxes.forEach(function (b) { b.checked = false; });
        update(true);
        if (boxes[0]) { boxes[0].focus(); }
      });
    }
    update(false);
  });

  /* ---------- Copy vendor questions ---------- */
  function copyText(text, done) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    } else { fallback(); }
  }

  $$('[data-copy-questions]').forEach(function (btn) {
    var status = document.getElementById(btn.getAttribute('aria-describedby'));
    btn.addEventListener('click', function () {
      var scope = document.getElementById(btn.getAttribute('data-copy-questions'));
      if (!scope) { return; }
      var lines = $$('.ask', scope).map(function (el, i) { return (i + 1) + '. ' + el.textContent.replace(/\s+/g, ' ').trim(); });
      var text = 'Questions about your ice stamp material:\n' + lines.join('\n');
      copyText(text, function (ok) {
        if (status) { status.textContent = ok ? 'Copied. Paste the questions into your message to the seller.' : 'Copy was blocked by the browser. Select the questions above and copy them manually.'; }
      });
    });
  });

  /* ---------- Table of contents highlight ---------- */
  var tocLinks = $$('.toc a[href^="#"]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && map[entry.target.id]) {
          tocLinks.forEach(function (a) { a.classList.remove('active'); });
          map[entry.target.id].classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { observer.observe(el); }
    });
  }
})();
