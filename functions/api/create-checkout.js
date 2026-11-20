import { json, readJSON, priceConfiguration, RequestError, requestError, estimatedShipDate, requireLiveShipDate } from '../_lib/pricing.js';

export async function onRequest({ request, env = {} }) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  try {
    const input = await readJSON(request);
    const pricing = priceConfiguration(input);
    const key = env.STRIPE_SECRET_KEY?.trim();
    if (!key) throw new RequestError('Card checkout is temporarily unavailable.', 503);
    const shipDate = estimatedShipDate(env);
    requireLiveShipDate(key.startsWith('sk_live_'), shipDate);
    const origin = new URL(request.url).origin;
    const params = new URLSearchParams({ mode: 'payment',
      success_url: `${origin}/studio/index.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/studio/index.html?checkout=cancelled`,
      'metadata[material]': pricing.spec.material, 'metadata[size_mm]': String(pricing.spec.size),
      'metadata[handle]': pricing.spec.handle, 'metadata[medium]': pricing.spec.medium, 'metadata[extra_head]': String(pricing.spec.extraHead) });
    if (shipDate) params.set('metadata[estimated_ship_date]', shipDate);
    pricing.items.forEach((item, index) => {
      const prefix = `line_items[${index}]`;
      params.set(`${prefix}[quantity]`, '1'); params.set(`${prefix}[price_data][currency]`, 'usd');
      params.set(`${prefix}[price_data][unit_amount]`, String(item.unitCents));
      params.set(`${prefix}[price_data][product_data][name]`, item.name);
      params.set(`${prefix}[price_data][product_data][description]`, item.description);
    });
    ['US', 'CA', 'GB', 'AU'].forEach((country, index) => params.set(`shipping_address_collection[allowed_countries][${index}]`, country));
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params, signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Stripe creation failed');
    const session = await response.json();
    const checkoutURL = new URL(session.url);
    if (typeof session.id !== 'string' || !session.id.startsWith('cs_') || checkoutURL.protocol !== 'https:' || checkoutURL.hostname !== 'checkout.stripe.com' || checkoutURL.username || checkoutURL.password || checkoutURL.port) throw new Error('Invalid checkout response');
    return json({ id: session.id, url: checkoutURL.href });
  } catch (error) { return requestError(error, 'Unable to create card checkout. Please try again.'); }
}
