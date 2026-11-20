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
     Price logic mirrors studio/app.js: size base + $15 for 304 steel + $18 for steel handle.
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
    steel: { add: 18, label: '304 stainless handle' }
  };
  var MEDIUMS = { ice: 1, leather: 1 };

  var state = null;
  var configurator = $('[data-configurator]');

  function readParams() {
    var out = {};
    try {
      var p = new URLSearchParams(window.location.search);
      if (MATERIALS[p.get('material')]) { out.material = p.get('material'); }
      if (SIZES[p.get('size')]) { out.size = p.get('size'); }
      if (HANDLES[p.get('handle')]) { out.handle = p.get('handle'); }
    } catch (e) { /* older browsers */ }
    return out;
  }

  function priceOf(s) {
    return SIZES[s.size].price + MATERIALS[s.material].add + HANDLES[s.handle].add;
  }

  function studioBase() {
    return document.body.getAttribute('data-studio') || '../studio/index.html';
  }

  function updateStudioLinks() {
    $$('a[data-studio-link]').forEach(function (a) {
      var params = new URLSearchParams();
      var medium = a.getAttribute('data-medium');
      params.set('medium', MEDIUMS[medium] ? medium : 'ice');
      if (state && a.getAttribute('data-use-config') !== 'false') {
        params.set('material', state.material);
        params.set('size', state.size);
        params.set('handle', state.handle);
      }
      var src = a.getAttribute('data-src');
      if (src) { params.set('src', src.replace(/[^a-z0-9-]/gi, '').slice(0, 40)); }
      a.setAttribute('href', studioBase() + '?' + params.toString());
    });
  }

  function renderConfig() {
    if (!configurator || !state) { return; }
    var total = priceOf(state);
    $$('[data-material]', configurator).forEach(function (b) {
      var on = b.getAttribute('data-material') === state.material;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $$('[data-size]', configurator).forEach(function (b) {
      var on = b.getAttribute('data-size') === state.size;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var handle = $('[data-handle]', configurator);
    if (handle) { handle.value = state.handle; }
    $$('[data-price]').forEach(function (el) { el.innerHTML = '$' + total + '<span>.00</span>'; });
    $$('[data-cta-price]').forEach(function (el) { el.textContent = 'US$' + total; });
    $$('[data-config-summary]').forEach(function (el) {
      el.textContent = SIZES[state.size].label + ' (' + SIZES[state.size].mm + ') · ' + MATERIALS[state.material].label + ' · ' + HANDLES[state.handle].label;
    });
    $$('[data-material-note]').forEach(function (el) { el.textContent = MATERIALS[state.material].note; });
    updateStudioLinks();
  }

  if (configurator) {
    var fromUrl = readParams();
    state = {
      material: fromUrl.material || configurator.getAttribute('data-default-material') || 'brass',
      size: fromUrl.size || configurator.getAttribute('data-default-size') || '50',
      handle: fromUrl.handle || configurator.getAttribute('data-default-handle') || 'walnut'
    };
    configurator.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || !configurator.contains(b)) { return; }
      if (b.hasAttribute('data-material') && MATERIALS[b.getAttribute('data-material')]) {
        state.material = b.getAttribute('data-material');
      } else if (b.hasAttribute('data-size') && SIZES[b.getAttribute('data-size')]) {
        state.size = b.getAttribute('data-size');
      } else { return; }
      renderConfig();
    });
    var handleSelect = $('[data-handle]', configurator);
    if (handleSelect) {
      handleSelect.addEventListener('change', function () {
        if (HANDLES[handleSelect.value]) { state.handle = handleSelect.value; renderConfig(); }
      });
    }
    renderConfig();
  } else {
    updateStudioLinks();
  }

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
