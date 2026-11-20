// Shared Web API handler: Cloudflare Pages and the Vercel adapter use this pricing.
const BASE_CENTS = new Map([[38, 6900], [50, 8900], [63, 10900]]);
const MATERIAL_CENTS = new Map([['brass', 0], ['steel', 1500]]);
const HANDLE_CENTS = new Map([['walnut', 0], ['steel', 1800], ['arbor', 0]]);
const MAX_BODY_BYTES = 16384;

function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      ...extraHeaders
    }
  });
}

// Bound the stream itself; Content-Length is optional and cannot be trusted.
async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let bytes = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  }
  const key = env?.STRIPE_SECRET_KEY?.trim();
  if (!key) return json({ error: 'Checkout is temporarily unavailable.' }, 503);

  const origin = new URL(request.url).origin;
  const callerOrigin = request.headers.get('Origin');
  if (callerOrigin && callerOrigin !== origin) {
    return json({ error: 'Cross-origin requests are not allowed.' }, 403);
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ error: 'Content-Type must be application/json.' }, 415);
  }
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) {
    return json({ error: 'Request body is too large.' }, 413);
  }

  let input;
  try {
    const text = await readBody(request);
    if (text === null) return json({ error: 'Request body is too large.' }, 413);
    input = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: 'Invalid stamp configuration.' }, 400);
  }

  // Support both compact API input and the Studio's exported configuration.
  const material = typeof input.material === 'string' ? input.material : input.material?.id;
  const handle = typeof input.handle === 'string' ? input.handle : input.handle?.id;
  const rawSize = input.size ?? input.diameterMM;
  const size = typeof rawSize === 'string' && /^(38|50|63)$/.test(rawSize) ? Number(rawSize) : rawSize;
  if (!BASE_CENTS.has(size) || !MATERIAL_CENTS.has(material) || !HANDLE_CENTS.has(handle)) {
    return json({ error: 'Invalid material, size or handle.' }, 400);
  }
  const cents = BASE_CENTS.get(size) + MATERIAL_CENTS.get(material) + HANDLE_CENTS.get(handle);
  const materialLabel = material === 'steel' ? '304 stainless steel' : 'Lead-free brass';
  const handleLabel = { walnut: 'Walnut handle', steel: '304 steel handle', arbor: 'Arbor / hammer rod' }[handle];
  const params = new URLSearchParams({
    mode: 'payment',
    // Redirect destinations come from the server, never from client input.
    success_url: `${origin}/studio/index.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/studio/index.html?checkout=cancelled`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(cents),
    'line_items[0][price_data][product_data][name]': `VELT & FORGE ${size} mm custom stamp`,
    'line_items[0][price_data][product_data][description]': `${materialLabel} · ${handleLabel}`,
    'metadata[material]': material,
    'metadata[size_mm]': String(size),
    'metadata[handle]': handle
  });

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return json({ error: 'Unable to create checkout. Please try again.' }, 502);
    const session = await response.json();
    const checkoutURL = new URL(session.url);
    if (typeof session.id !== 'string' || !session.id.startsWith('cs_') ||
        checkoutURL.protocol !== 'https:' || checkoutURL.hostname !== 'checkout.stripe.com' ||
        checkoutURL.username || checkoutURL.password || checkoutURL.port) {
      throw new Error('Invalid checkout response');
    }
    return json({ id: session.id, url: checkoutURL.href });
  } catch {
    // Never expose Stripe diagnostics, credentials or upstream response bodies.
    return json({ error: 'Unable to create checkout. Please try again.' }, 502);
  }
}
