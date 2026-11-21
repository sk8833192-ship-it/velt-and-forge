'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Lightweight DOM fixture tests orchestration, not browser painting or decoding.
// Geometry is the real engine; Canvas/browser visual checks have a separate runner.
function fixture(search = '', options = {}) {
  const nodes = [], downloads = [], errors = [], paints = [], requests = [], scripts = [], redirects = [], blobs = [];
  function context() {
    return new Proxy({
      getImageData(x, y, w, h) {
        const data = new Uint8ClampedArray(w * h * 4); data.fill(255);
        for (let yy = Math.floor(h * .35); yy < h * .65; yy++) for (let xx = Math.floor(w * .22); xx < w * .78; xx++) { const i = (yy * w + xx) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
        return { data };
      },
      createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
      createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; }
    }, { get(target, name) { return target[name] || (() => {}); } });
  }
  class Node {
    constructor(tag, attributes = '') {
      this.tag = tag; this.dataset = {}; this.handlers = {}; this.attributes = {}; this.children = []; this.open = false; this.hidden = /(?:^|\s)hidden(?:\s|$)/.test(attributes); this.value = ''; this.textContent = ''; this.lastChild = { textContent: '' }; this.files = [];
      this.style = { setProperty() {} }; const classes = new Set(); this.classList = { add: (...v) => v.forEach(x => classes.add(x)), remove: (...v) => v.forEach(x => classes.delete(x)), toggle: (v, on) => on ? classes.add(v) : classes.delete(v), contains: v => classes.has(v) };
      for (const m of attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) { this.attributes[m[1]] = m[2] ?? ''; if (m[1] === 'id') this.id = m[2]; if (m[1].startsWith('data-')) this.dataset[m[1].slice(5).replace(/-([a-z])/g, (_,c) => c.toUpperCase())] = m[2] ?? ''; if (['value','min','max'].includes(m[1])) this[m[1]] = m[2]; }
    }
    addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
    emit(name, extra = {}) { return Promise.all((this.handlers[name] || []).map(fn => fn({ target: this, preventDefault() {}, stopPropagation() {}, ...extra }))); }
    setAttribute(key, value) { this.attributes[key] = value; }
    append(...items) { this.children.push(...items); for (const item of items) if (item.tag === 'script') { scripts.push(item); if (options.sdk) queueMicrotask(() => { window.paypal = options.sdk; item.onload(); }); if (options.sdkError) queueMicrotask(() => item.onerror()); } }
    replaceChildren(...items) { this.children = items; }
    getContext() { return this.ctx ||= context(); }
    showModal() { this.open = true; }
    close() { this.open = false; }
    closest() { return this.parent; }
    getBoundingClientRect() { return { left: 0, right: 100, top: 0, bottom: 100 }; }
    setPointerCapture() {}
    click() { if (this.tag === 'a') downloads.push({ name: this.download, url: this.href }); return this.emit('click'); }
    remove() {}
    toBlob(fn) { queueMicrotask(() => fn(new Blob(['png'], { type: 'image/png' }))); }
  }
  for (const m of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/g)) { const node = new Node(m[1], m[2]); if (node.id || node.tag === 'dialog' || Object.keys(node.dataset).length) nodes.push(node); }
  const select = selector => selector.startsWith('#') ? nodes.filter(n => n.id === selector.slice(1)) : selector === 'dialog' ? nodes.filter(n => n.tag === 'dialog') : /^\[data-/.test(selector) ? nodes.filter(n => Object.hasOwn(n.attributes, selector.slice(1, -1))) : [];
  const document = { querySelector: s => select(s)[0] || null, querySelectorAll: select, body: new Node('body'), head: new Node('head'), createElement: tag => new Node(tag) };
  const window = { addEventListener() {} };
  class Image { constructor() { this.naturalWidth = this.naturalHeight = 600; } set src(v) { this.source = v; queueMicrotask(() => this.onload()); } }
  class DOMParser { parseFromString() { return { documentElement: { localName: 'svg' }, querySelector() { return null; }, querySelectorAll() { return []; } }; } }
  const engine = options.engine || require('../engine.js');
  const sandbox = { window, document, Image, Blob, URL: { createObjectURL: blob => { const url = `blob:fixture-${downloads.length}`; blobs.push(blob); return url; }, revokeObjectURL() {} }, DOMParser, XMLSerializer: class { serializeToString() { return '<svg xmlns="http://www.w3.org/2000/svg"/>'; } }, StampEngine: engine, StampRenderer: class { setArtwork(m) { this.mask = m; } render(o) { paints.push({ ...o }); } }, console: { error: e => errors.push(e) }, setTimeout: (fn, ms) => { if (ms > 500) return 0; return setTimeout(fn, ms); }, clearTimeout, requestAnimationFrame: fn => { queueMicrotask(fn); return 1; }, cancelAnimationFrame() {}, Uint8Array, Uint8ClampedArray, Float32Array, Math, Date, Intl, Object, Number, String, Promise };
  sandbox.location = { search, protocol: options.protocol || 'file:', hostname: options.hostname || '', assign: url => redirects.push(url) }; if (options.fetch) sandbox.fetch = async (url, init) => { requests.push({ url, init }); return options.fetch(url, init); }; sandbox.URLSearchParams = URLSearchParams;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), sandbox, { filename: 'app.js' });
  return { get: s => document.querySelector(s), nodes, downloads, errors, paints, requests, scripts, redirects, blobs, api: () => window.VeltStudio, tick: async () => { await new Promise(resolve => setImmediate(resolve)); } };
}

test('zero-build entry points reference existing local assets only', () => {
  for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) { assert.ok(!/^(https?:)?\/\//.test(m[1])); assert.ok(fs.existsSync(path.join(root, m[1]))); }
  assert.ok(!/<script[^>]*type="module"/.test(html), 'classic scripts must load from file protocol');
});

test('extra head adds exactly $49 across all brass and steel sizes and handles', async () => {
  const f = fixture(); await f.tick();
  assert.equal(f.api().getConfiguration().extraHead, false);
  assert.equal(f.get('#extra-head').checked, false);
  for (const material of ['brass', 'steel']) {
    await f.nodes.find(n => n.dataset.material === material).click();
    for (const [size, base] of [[38, 69], [50, 89], [63, 109]]) {
      await f.nodes.find(n => n.dataset.size === String(size)).click();
      for (const handle of ['walnut', 'steel', 'arbor']) {
        f.get('#handle').value = handle; await f.get('#handle').emit('change');
        const singleHeadTotal = base + (material === 'steel' ? 15 : 0) + (handle === 'steel' ? 18 : 0);
        assert.equal(f.api().getConfiguration().pricing.total, singleHeadTotal);
        f.get('#extra-head').checked = true; await f.get('#extra-head').emit('change');
        assert.equal(f.api().getConfiguration().pricing.total, singleHeadTotal + 49);
        assert.equal(f.get('#price').innerHTML, `$${singleHeadTotal + 49}<span>.00</span>`);
        f.get('#extra-head').checked = false; await f.get('#extra-head').emit('change');
        assert.equal(f.api().getConfiguration().pricing.total, singleHeadTotal);
        assert.equal(f.get('#price').innerHTML, `$${singleHeadTotal}<span>.00</span>`);
      }
    }
  }
  assert.equal(f.errors.length, 0);
});

test('extraHead URL parameter accepts 1 and true and leaves other values unselected', async () => {
  for (const [search, enabled] of [['?extraHead=1', true], ['?extraHead=true', true], ['', false], ['?extraHead=0', false], ['?extraHead=false', false], ['?extraHead=', false], ['?extraHead=invalid', false]]) {
    const f = fixture(search); await f.tick();
    assert.equal(f.api().getConfiguration().extraHead, enabled, search);
    assert.equal(f.get('#extra-head').checked, enabled, search);
    assert.equal(f.api().getConfiguration().pricing.total, enabled ? 138 : 89, search);
    assert.equal(f.get('#price').innerHTML, `$${enabled ? 138 : 89}<span>.00</span>`, search);
    assert.equal(f.errors.length, 0);
  }
});

test('configuration JSON and summary record the extra head selection and itemized total', async () => {
  const f = fixture('?material=steel&size=63&handle=steel&extraHead=1'); await f.tick();
  const config = f.api().getConfiguration();
  assert.equal(config.extraHead, true);
  assert.deepEqual(JSON.parse(JSON.stringify(config.pricing)), { currency: 'USD', base: 109, materialUpgrade: 15, handleUpgrade: 18, extraHead: 49, total: 191, monthlyFees: 0 });
  await f.get('#review-order').click();
  assert.equal(f.get('#summary-price').textContent, '$191.00');
  assert.equal(JSON.parse(f.get('#summary-json').textContent).extraHead, true);
  assert.equal(JSON.parse(f.get('#summary-json').textContent).pricing.total, 191);
  const headRow = () => f.get('#summary-list').children.find(row => row.children[0].textContent === 'Stamp heads');
  assert.match(headRow().children[1].textContent, /2 custom heads.*M8.*\+\$49/);
  f.get('#summary-dialog').close();
  f.get('#extra-head').checked = false; await f.get('#extra-head').emit('change');
  const single = f.api().getConfiguration();
  assert.equal(single.extraHead, false); assert.equal(single.pricing.extraHead, 0); assert.equal(single.pricing.total, 142);
  await f.get('#review-order').click();
  assert.equal(f.get('#summary-price').textContent, '$142.00');
  assert.equal(JSON.parse(f.get('#summary-json').textContent).extraHead, false);
  assert.equal(headRow().children[1].textContent, '1 custom head');
  assert.equal(f.errors.length, 0);
});

test('configuration, inspection tuning, previews and exports use live selections', async () => {
  const f = fixture(); await f.tick(); assert.equal(f.errors.length, 0);
  assert.equal(f.api().getConfiguration().pricing.total, 89);
  await f.nodes.find(n => n.dataset.material === 'steel').click();
  await f.nodes.find(n => n.dataset.size === '63').click();
  f.get('#handle').value = 'steel'; await f.get('#handle').emit('change');
  assert.equal(f.api().getConfiguration().pricing.total, 142);
  f.get('#medium').value = 'wood'; await f.get('#medium').emit('change');
  assert.equal(f.api().getConfiguration().targetMedium.minStroke, .55);
  f.get('#boldness').value = '.25'; await f.get('#boldness').emit('input');
  f.get('#threshold').value = '190'; await f.get('#threshold').emit('input');
  f.get('#invert').checked = true; await f.get('#invert').emit('change');
  const config = f.api().getConfiguration();
  assert.equal(config.artworkProcessing.radialDilationMM, .25); assert.equal(config.artworkProcessing.threshold, 190); assert.equal(config.artworkProcessing.inverted, true);
  for (const mode of ['ice', 'leather', 'die']) { await f.nodes.find(n => n.dataset.mode === mode).click(); await f.tick(); assert.equal(f.paints.at(-1).mode, mode); }
  await f.get('#review-order').click(); assert.equal(f.get('#summary-dialog').open, true); assert.equal(JSON.parse(f.get('#summary-json').textContent).pricing.total, 142);
  await f.get('#open-export').click(); assert.equal(f.get('#export-dialog').open, true);
  await f.get('#download-svg').click(); await f.get('#download-png').click(); await f.tick(); await f.get('#download-json').click();
  assert.equal(f.downloads.length, 3); assert.match(f.downloads[0].name, /63mm-steel-mirrored-proof.svg$/); assert.match(f.downloads[1].name, /\.png$/); assert.match(f.downloads[2].name, /configuration.json$/);
  assert.equal(f.errors.length, 0);
});

test('a slow earlier SVG read never replaces a subsequently chosen studio design', async () => {
  const f = fixture(); await f.tick(); let resolveText;
  f.get('#file-input').files = [{ name: 'older.svg', size: 100, text: () => new Promise(resolve => { resolveText = resolve; }) }];
  const pendingUpload = f.get('#file-input').emit('change');
  await f.nodes.find(n => n.dataset.demo === 'wedding').click(); await f.tick();
  assert.equal(f.api().getConfiguration().artwork, 'Wedding Monogram A & M.svg');
  resolveText('<svg/>'); await pendingUpload; await f.tick(); await f.tick();
  assert.equal(f.api().getConfiguration().artwork, 'Wedding Monogram A & M.svg');
});

const paymentConfig = (extra = {}) => ({ paypalEnabled: false, stripeEnabled: false, paypalEnv: 'sandbox', currency: 'USD', ...extra });
const jsonResponse = (data, ok = true, status = ok ? 200 : 500) => ({ ok, status, headers: { get: () => 'application/json' }, json: async () => data });

test('checkout remains calm and makes no network requests on file and GitHub Pages', async () => {
  for (const options of [{ protocol: 'file:' }, { protocol: 'https:', hostname: 'peng.github.io' }]) {
    const f = fixture('', { ...options, fetch: () => { throw new Error('Static checkout must not fetch'); } }); await f.tick();
    await f.get('#review-order').click(); await f.tick();
    assert.equal(f.requests.length, 0); assert.equal(f.errors.length, 0);
    assert.match(f.get('#checkout-note').textContent, /Online PayPal & Card checkout activates/);
    assert.equal(f.get('#stripe-checkout').hidden, true); assert.equal(f.scripts.length, 0);
    await f.get('#summary-download-proof').click(); assert.equal(f.downloads.length, 1);
  }
});

test('missing, non-JSON, offline and unconfigured APIs cleanly fall back to preview', async () => {
  for (const fetch of [async () => jsonResponse({}, false), async () => ({ ok: true, headers: { get: () => 'text/html' }, json: () => { throw new Error('HTML'); } }), async () => { throw new Error('Offline'); }, async () => jsonResponse(paymentConfig())]) {
    const f = fixture('', { protocol: 'https:', fetch }); await f.tick(); await f.get('#review-order').click(); await f.tick();
    assert.match(f.get('#checkout-note').textContent, /Online PayPal & Card checkout activates/);
    assert.equal(f.errors.length, 0); assert.equal(f.get('#stripe-checkout').hidden, true); assert.equal(f.scripts.length, 0);
  }
});

test('PayPal freezes the reviewed spec and proof and only confirms a completed capture', async () => {
  let callbacks; const posts = [];
  const sdk = { Buttons: options => { callbacks = options; return { render: async () => {} }; } };
  const f = fixture('?extraHead=1', { protocol: 'https:', sdk, fetch: async (url, init) => {
    if (!init || !init.body) return jsonResponse(paymentConfig({ paypalEnabled: true, paypalClientId: 'public-client' }));
    posts.push({ url, body: JSON.parse(init.body) });
    return jsonResponse(url.endsWith('create-order') ? { id: 'ORDER123456789', totalCents: 13800 } : { status: 'COMPLETED', orderId: 'ORDER123456789', captureId: 'CAPTURE12345', payerEmail: 'customer@example.com', amount: '138.00' });
  } });
  await f.tick(); await f.get('#review-order').click(); await f.tick(); await f.tick();
  assert.match(f.scripts[0].src, /client-id=public-client/); assert.match(f.scripts[0].src, /enable-funding=card%2Cvenmo/);
  assert.equal(await callbacks.createOrder(), 'ORDER123456789');
  await f.nodes.find(n => n.dataset.size === '63').click();
  f.get('#summary-dialog').close(); await f.get('#review-order').click();
  assert.equal(f.get('#summary-price').textContent, '$138.00');
  await f.get('#download-json').click(); assert.equal(JSON.parse(await f.blobs.at(-1).text()).diameterMM, 50);
  await callbacks.onApprove({ orderID: 'ORDER123456789' });
  assert.equal(posts[0].body.diameterMM, 50); assert.equal(posts[0].body.extraHead, true); assert.match(posts[0].body.mirroredSvg, /^<(?:svg|\?xml)/);
  assert.deepEqual(posts[1].body, { orderId: 'ORDER123456789' });
  assert.equal(f.get('#checkout-receipt').hidden, false); assert.equal(f.get('#receipt-order-id').textContent, 'ORDER123456789');
  assert.equal(f.get('#receipt-capture-id').textContent, 'CAPTURE12345'); assert.equal(f.get('#receipt-email').textContent, 'customer@example.com');
  await f.get('#receipt-download-proof').click(); assert.match(f.downloads.at(-1).name, /50mm-brass/);
  assert.equal(await f.blobs.at(-1).text(), posts[0].body.mirroredSvg); assert.equal(f.errors.length, 0);
});

test('pending capture stays unconfirmed and retries the same order without another payment', async () => {
  let callbacks, captures = 0;
  const f = fixture('', { protocol: 'https:', sdk: { Buttons: opts => { callbacks = opts; return { render: async () => {} }; } }, fetch: async (url, init) => {
    if (!init || !init.body) return jsonResponse(paymentConfig({ paypalEnabled: true, paypalClientId: 'id' }));
    if (url.endsWith('create-order')) return jsonResponse({ id: 'ORDER123456789' });
    return jsonResponse(++captures === 1 ? { status: 'PENDING' } : { status: 'COMPLETED', orderId: 'ORDER123456789', captureId: 'CAPTURE12345', payerEmail: 'paid@example.com' });
  } });
  await f.tick(); await f.get('#review-order').click(); await f.tick(); await f.tick();
  await callbacks.createOrder(); await callbacks.onApprove({ orderID: 'ORDER123456789' });
  assert.equal(f.get('#checkout-receipt').hidden, true); assert.equal(f.get('#checkout-retry-capture').hidden, false);
  await f.get('#checkout-retry-capture').click(); assert.equal(f.get('#checkout-receipt').hidden, false);
  assert.equal(f.requests.filter(r => r.url.endsWith('create-order')).length, 1);
});

test('PayPal cancellation and SDK errors preserve proof tools and allow retry', async () => {
  let callbacks;
  const f = fixture('', { protocol: 'https:', sdk: { Buttons: opts => { callbacks = opts; return { render: async () => {} }; } }, fetch: async () => jsonResponse(paymentConfig({ paypalEnabled: true, paypalClientId: 'id' })) });
  await f.tick(); await f.get('#review-order').click(); await f.tick(); await f.tick();
  callbacks.onCancel(); assert.match(f.get('#checkout-note').textContent, /cancelled/i); assert.equal(f.get('#checkout-receipt').hidden, true);
  callbacks.onError(new Error('SDK error')); assert.match(f.get('#checkout-note').textContent, /try again/i); assert.equal(f.errors.length, 0);
  const broken = fixture('', { protocol: 'https:', sdkError: true, fetch: async () => jsonResponse(paymentConfig({ paypalEnabled: true, paypalClientId: 'id' })) });
  await broken.tick(); await broken.get('#review-order').click(); await broken.tick(); await broken.tick();
  assert.equal(broken.get('#checkout-retry').hidden, false); assert.equal(broken.get('#checkout-receipt').hidden, true); assert.equal(broken.errors.length, 0);
  await broken.get('#summary-download-proof').click(); assert.equal(broken.downloads.length, 1);
});

test('Stripe appears only when enabled and redirects using the reviewed configuration', async () => {
  let submitted;
  const f = fixture('?extraHead=1', { protocol: 'https:', fetch: async (url, init) => {
    if (!init || !init.body) return jsonResponse(paymentConfig({ stripeEnabled: true }));
    submitted = JSON.parse(init.body); return jsonResponse({ url: 'https://checkout.stripe.com/c/pay/session' });
  } });
  await f.tick(); await f.get('#review-order').click(); await f.tick();
  assert.equal(f.get('#stripe-checkout').hidden, false); await f.get('#stripe-checkout').click();
  assert.equal(submitted.extraHead, true); assert.equal(submitted.pricing.total, 138); assert.deepEqual(f.redirects, ['https://checkout.stripe.com/c/pay/session']);
});

test('SDK load failure can be retried without losing the reviewed proof', async () => {
  let callbacks;
  const options = { protocol: 'https:', sdkError: true, fetch: async () => jsonResponse(paymentConfig({ paypalEnabled: true, paypalClientId: 'id' })) };
  const f = fixture('', options); await f.tick(); await f.get('#review-order').click(); await f.tick(); await f.tick();
  assert.equal(f.get('#checkout-retry').hidden, false);
  options.sdkError = false; options.sdk = { Buttons: opts => { callbacks = opts; return { render: async () => {} }; } };
  await f.get('#checkout-retry').click(); await f.tick(); await f.tick();
  assert.equal(typeof callbacks.createOrder, 'function'); assert.equal(f.get('#checkout-retry').hidden, true); assert.equal(f.scripts.length, 2);
});

test('cancelling an unpaid PayPal order permits a fresh reviewed configuration', async () => {
  let callbacks; const created = [];
  const f = fixture('', { protocol: 'https:', sdk: { Buttons: opts => { callbacks = opts; return { render: async () => {} }; } }, fetch: async (url, init) => {
    if (!init.body) return jsonResponse(paymentConfig({ paypalEnabled: true, paypalClientId: 'id' }));
    created.push(JSON.parse(init.body)); return jsonResponse({ id: 'ORDER123456789' });
  } });
  await f.tick(); await f.get('#review-order').click(); await f.tick(); await f.tick();
  await callbacks.createOrder(); callbacks.onCancel(); f.get('#summary-dialog').close();
  await f.nodes.find(n => n.dataset.size === '63').click(); await f.get('#review-order').click(); await f.tick();
  await callbacks.createOrder(); assert.equal(created.length, 2); assert.equal(created[0].diameterMM, 50); assert.equal(created[1].diameterMM, 63);
});

test('capture network failure never confirms payment and a mismatched order never captures', async () => {
  let callbacks, captures = 0;
  const f = fixture('', { protocol: 'https:', sdk: { Buttons: opts => { callbacks = opts; return { render: async () => {} }; } }, fetch: async (url, init) => {
    if (!init.body) return jsonResponse(paymentConfig({ paypalEnabled: true, paypalClientId: 'id' }));
    if (url.endsWith('create-order')) return jsonResponse({ id: 'ORDER123456789' });
    captures++; throw new Error('Network lost after capture');
  } });
  await f.tick(); await f.get('#review-order').click(); await f.tick(); await f.tick();
  await callbacks.createOrder(); await callbacks.onApprove({ orderID: 'WRONGORDER1234' }); assert.equal(captures, 0);
  await callbacks.onApprove({ orderID: 'ORDER123456789' }); assert.equal(captures, 1);
  assert.equal(f.get('#checkout-receipt').hidden, true); assert.equal(f.get('#checkout-retry-capture').hidden, false); assert.equal(f.errors.length, 0);
});

test('Stripe rejects an unsafe redirect or server failure and restores retry', async () => {
  for (const fetchResult of [async () => jsonResponse({ url: 'https://checkout.stripe.com.evil.example/pay' }), async () => { throw new Error('offline'); }]) {
    const f = fixture('', { protocol: 'https:', fetch: async (url, init) => !init.body ? jsonResponse(paymentConfig({ stripeEnabled: true })) : fetchResult() });
    await f.tick(); await f.get('#review-order').click(); await f.tick(); await f.get('#stripe-checkout').click();
    assert.equal(f.redirects.length, 0); assert.equal(f.get('#stripe-checkout').disabled, false); assert.match(f.get('#checkout-note').textContent, /try again/i);
    assert.equal(f.errors.length, 0);
  }
});

test('PayPal create retries reuse an idempotency ID until explicit cancellation or a new specification', async () => {
  let callbacks, failFirst = true; const attempts = [];
  const f = fixture('', { protocol: 'https:', sdk: { Buttons: opts => { callbacks = opts; return { render: async () => {} }; } }, fetch: async (url, init) => {
    if (!init.body) return jsonResponse(paymentConfig({ paypalEnabled: true, paypalClientId: 'id' }));
    attempts.push(JSON.parse(init.body));
    if (failFirst) { failFirst = false; throw new Error('Ambiguous network failure'); }
    return jsonResponse({ id: 'ORDER123456789' });
  } });
  await f.tick(); await f.get('#review-order').click(); await f.tick(); await f.tick();
  await assert.rejects(callbacks.createOrder()); callbacks.onError();
  f.get('#summary-dialog').close(); await f.get('#review-order').click(); await f.tick();
  await callbacks.createOrder();
  assert.match(attempts[0].requestId, /^[A-Za-z0-9_-]{16,64}$/);
  assert.equal(attempts[1].requestId, attempts[0].requestId);
  callbacks.onCancel(); await callbacks.createOrder(); assert.notEqual(attempts[2].requestId, attempts[1].requestId);
  callbacks.onCancel(); f.get('#summary-dialog').close(); await f.nodes.find(n => n.dataset.size === '63').click(); await f.get('#review-order').click(); await f.tick();
  await callbacks.createOrder(); assert.notEqual(attempts[3].requestId, attempts[2].requestId);
});

test('oversized artwork is preserved for backup and explicitly omitted from optional order upload', async () => {
  let callbacks, submitted; const largeSvg = '<svg>' + 'é'.repeat(110 * 1024) + '</svg>';
  const f = fixture('', { protocol: 'https:', engine: { ...require('../engine.js'), mirroredSVG: () => largeSvg }, sdk: { Buttons: opts => { callbacks = opts; return { render: async () => {} }; } }, fetch: async (url, init) => {
    if (!init.body) return jsonResponse(paymentConfig({ paypalEnabled: true, paypalClientId: 'id' }));
    if (url.endsWith('create-order')) { submitted = JSON.parse(init.body); return jsonResponse({ id: 'ORDER123456789', artworkStored: false }); }
    return jsonResponse({ status: 'COMPLETED', orderId: 'ORDER123456789', captureId: 'CAPTURE12345', artworkSaved: false });
  } });
  await f.tick(); await f.get('#review-order').click(); await f.tick(); await f.tick();
  assert.equal(f.get('#checkout-artwork-note').hidden, false); assert.match(f.get('#checkout-artwork-note').textContent, /email.*proof.*after payment/i);
  await callbacks.createOrder(); assert.equal(Object.hasOwn(submitted, 'mirroredSvg'), false);
  await callbacks.onApprove({ orderID: 'ORDER123456789' }); assert.match(f.get('#receipt-artwork-note').textContent, /Email it with your Order ID/);
  await f.get('#receipt-download-proof').click(); assert.equal(await f.blobs.at(-1).text(), largeSvg);
});

test('live checkout without a confirmed ship date keeps proof tools and never loads providers', async () => {
  for (const config of [paymentConfig({ paypalEnabled: true, paypalClientId: 'id', paypalEnv: 'live' }), paymentConfig({ stripeEnabled: true, checkoutReady: false }), paymentConfig({ paypalEnabled: true, paypalClientId: 'id', paypalEnv: 'live', estimatedShipDate: '2020-01-01' })]) {
    const f = fixture('', { protocol: 'https:', fetch: async () => jsonResponse(config) });
    await f.tick(); await f.get('#review-order').click(); await f.tick();
    assert.match(f.get('#checkout-note').textContent, /confirm your estimated ship date/);
    assert.equal(f.get('#checkout-methods').hidden, true); assert.equal(f.scripts.length, 0);
    await f.get('#summary-download-proof').click(); assert.equal(f.downloads.length, 1);
  }
});

test('confirmed estimated ship date is shown before available live payment methods', async () => {
  let callbacks;
  const f = fixture('', { protocol: 'https:', sdk: { Buttons: opts => { callbacks = opts; return { render: async () => {} }; } }, fetch: async () => jsonResponse(paymentConfig({ paypalEnabled: true, paypalClientId: 'id', paypalEnv: 'live', estimatedShipDate: '2099-12-20', checkoutReady: true })) });
  await f.tick(); await f.get('#review-order').click(); await f.tick(); await f.tick();
  assert.equal(f.get('#checkout-shipping').hidden, false); assert.equal(f.get('#checkout-ship-date').textContent, '2099-12-20');
  assert.equal(f.get('#checkout-methods').hidden, false); assert.equal(typeof callbacks.createOrder, 'function');
});

test('an explicitly declined instrument restarts funding while ambiguous failures never restart', async () => {
  let callbacks, restarted = 0, declined = true;
  const f = fixture('', { protocol: 'https:', sdk: { Buttons: opts => { callbacks = opts; return { render: async () => {} }; } }, fetch: async (url, init) => {
    if (!init.body) return jsonResponse(paymentConfig({ paypalEnabled: true, paypalClientId: 'id' }));
    if (url.endsWith('create-order')) return jsonResponse({ id: 'ORDER123456789' });
    if (declined) return jsonResponse({ error: 'Declined', code: 'INSTRUMENT_DECLINED' }, false, 422);
    throw new Error('Ambiguous network response');
  } });
  await f.tick(); await f.get('#review-order').click(); await f.tick(); await f.tick();
  await callbacks.createOrder(); const firstRequest = JSON.parse(f.requests.find(r => r.url.endsWith('create-order')).init.body).requestId;
  await callbacks.onApprove({ orderID: 'ORDER123456789' }, { restart: async () => { restarted++; } });
  assert.equal(restarted, 1); assert.equal(f.get('#checkout-receipt').hidden, true); assert.equal(f.get('#checkout-methods').hidden, false);
  assert.match(f.get('#checkout-note').textContent, /different payment method/);
  await callbacks.createOrder(); const nextRequest = JSON.parse(f.requests.filter(r => r.url.endsWith('create-order')).at(-1).init.body).requestId;
  assert.notEqual(firstRequest, nextRequest); declined = false;
  await callbacks.onApprove({ orderID: 'ORDER123456789' }, { restart: async () => { restarted++; } });
  assert.equal(restarted, 1); assert.equal(f.get('#checkout-retry-capture').hidden, false);
});

test('only a confirmed stale unapproved order refreshes schedule and request ID for explicit review', async () => {
  let callbacks, configReads = 0, stale = true; const attempts = [];
  const f = fixture('', { protocol: 'https:', sdk: { Buttons: opts => { callbacks = opts; return { render: async () => {} }; } }, fetch: async (url, init) => {
    if (!init.body) return jsonResponse(paymentConfig({ paypalEnabled: true, paypalClientId: 'id', paypalEnv: 'live', checkoutReady: true, estimatedShipDate: ++configReads === 1 ? '2099-12-20' : '2099-12-24' }));
    attempts.push(JSON.parse(init.body));
    if (stale) return jsonResponse({ error: 'Review required', code: 'ORDER_REVIEW_REQUIRED' }, false, 409);
    return jsonResponse({ id: 'ORDER123456789' });
  } });
  await f.tick(); await f.get('#review-order').click(); await f.tick(); await f.tick();
  await assert.rejects(callbacks.createOrder()); callbacks.onError();
  assert.match(f.get('#checkout-note').textContent, /review.*again/i); assert.equal(f.get('#checkout-methods').hidden, true); assert.equal(f.get('#checkout-retry').hidden, false);
  assert.equal(configReads, 1, 'refresh waits for an explicit review action');
  stale = false; await f.get('#checkout-retry').click(); await f.tick();
  assert.equal(configReads, 2); assert.equal(f.get('#checkout-ship-date').textContent, '2099-12-24'); assert.equal(f.get('#checkout-methods').hidden, false);
  await callbacks.createOrder(); assert.notEqual(attempts[0].requestId, attempts[1].requestId);
});

test('ambiguous order-review errors retain the same request ID and cached review', async () => {
  for (const status of [422, 500]) {
    let callbacks, configReads = 0; const attempts = [];
    const f = fixture('', { protocol: 'https:', sdk: { Buttons: opts => { callbacks = opts; return { render: async () => {} }; } }, fetch: async (url, init) => {
      if (!init.body) { configReads++; return jsonResponse(paymentConfig({ paypalEnabled: true, paypalClientId: 'id' })); }
      attempts.push(JSON.parse(init.body)); return jsonResponse({ error: 'Ambiguous', code: 'ORDER_REVIEW_REQUIRED' }, false, status);
    } });
    await f.tick(); await f.get('#review-order').click(); await f.tick(); await f.tick();
    await assert.rejects(callbacks.createOrder()); callbacks.onError(); await assert.rejects(callbacks.createOrder());
    assert.equal(attempts[0].requestId, attempts[1].requestId); assert.equal(configReads, 1); assert.equal(f.get('#checkout-methods').hidden, false);
  }
});

test('checkout recovery remains outside the provider container hidden during review', () => {
  assert.match(html, /id="stripe-checkout"[^>]*>[\s\S]*?<\/button><\/div>\s*<button[^>]*id="checkout-retry"/);
});
