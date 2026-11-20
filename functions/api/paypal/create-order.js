import { json, readJSON, priceConfiguration, RequestError, requestError, MAX_ARTWORK_BODY_BYTES, MAX_BODY_BYTES, MAX_SVG_BYTES, estimatedShipDate, requireLiveShipDate } from '../../_lib/pricing.js';
import { paypalClient, paypalSettings, ORDER_ID, encodeSpec, fingerprintArtwork } from '../../_lib/paypal.js';

export async function onRequest({ request, env = {} }) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  try {
    const input = await readJSON(request, MAX_ARTWORK_BODY_BYTES, MAX_BODY_BYTES);
    const pricing = priceConfiguration(input);
    const svg = input.mirroredSvg;
    if (svg !== undefined && (typeof svg !== 'string' || new TextEncoder().encode(svg).byteLength > MAX_SVG_BYTES || !/^(<svg(?:\s|>)|<\?xml(?:\s|\?))/.test(svg))) {
      throw new RequestError('Artwork must be an SVG of at most 200 KB.');
    }
    if (input.requestId !== undefined && (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,64}$/.test(input.requestId))) throw new RequestError('Invalid request identifier.');
    const shipDate = estimatedShipDate(env);
    requireLiveShipDate(paypalSettings(env).mode === 'live', shipDate);
    const { mirroredSvg: omittedSVG, requestId: omittedRequestId, ...submittedConfiguration } = input;
    const configuration = { ...submittedConfiguration, pricing };
    const artworkFingerprint = await fingerprintArtwork(configuration, svg);
    const metadata = encodeSpec(pricing.spec, shipDate, artworkFingerprint);
    const paypal = await paypalClient(env);
    const response = await paypal('/v2/checkout/orders', {
      method: 'POST', headers: { 'PayPal-Request-Id': input.requestId || crypto.randomUUID(), Prefer: 'return=representation' },
      body: JSON.stringify({ intent: 'CAPTURE', application_context: { shipping_preference: 'GET_FROM_FILE', brand_name: 'Velt & Forge', user_action: 'PAY_NOW' },
        purchase_units: [{ reference_id: 'stamp', custom_id: metadata,
          amount: { currency_code: 'USD', value: pricing.totalUSD, breakdown: { item_total: { currency_code: 'USD', value: pricing.totalUSD } } },
          items: pricing.items.map(item => ({ name: item.name, description: item.description, quantity: '1', category: 'PHYSICAL_GOODS', unit_amount: { currency_code: 'USD', value: (item.unitCents / 100).toFixed(2) } })) }] })
    });
    if (!response.ok) throw new Error('PayPal creation failed');
    let order = await response.json();
    if (typeof order.id !== 'string' || !ORDER_ID.test(order.id)) throw new Error('Invalid PayPal order');
    const expectedOrderId = order.id;
    if (!order.purchase_units?.length) {
      const details = await paypal(`/v2/checkout/orders/${order.id}`, { method: 'GET' });
      if (!details.ok) throw new Error('Unable to verify order');
      order = await details.json();
    }
    const unit = order.purchase_units?.[0];
    if (order.id !== expectedOrderId || order.status !== 'CREATED') {
      throw new RequestError('This order has already advanced beyond creation. Please confirm its payment status before retrying.', 409);
    }
    if (order.purchase_units?.length !== 1 || unit.custom_id !== metadata || unit.amount?.currency_code !== 'USD' || unit.amount.value !== pricing.totalUSD) {
      throw new RequestError('This checkout request refers to a different configuration. Please review your order again.', 409, 'ORDER_REVIEW_REQUIRED');
    }
    let artworkStored = false;
    if (env.ORDERS_BUCKET) {
      try {
        const existing = await env.ORDERS_BUCKET.get(`drafts/${order.id}.json`);
        if (existing) {
          const previous = await existing.json();
          if (previous.artworkFingerprint !== artworkFingerprint) throw new RequestError('This order already has a different artwork draft. Please review your order again.', 409, 'ORDER_REVIEW_REQUIRED');
          artworkStored = svg !== undefined && Boolean(await env.ORDERS_BUCKET.get(`drafts/${order.id}.svg`));
          return json({ id: order.id, totalCents: pricing.totalCents, totalUSD: pricing.totalUSD, currency: 'USD', artworkStored });
        }
        const existingSVG = await env.ORDERS_BUCKET.get(`drafts/${order.id}.svg`);
        if (existingSVG && await existingSVG.text() !== svg) throw new RequestError('This order already has a different artwork draft. Please review your order again.', 409, 'ORDER_REVIEW_REQUIRED');
        const draft = { artworkFingerprint, estimatedShipDate: shipDate, configuration, orderId: order.id, createdAt: new Date().toISOString(), spec: pricing.spec, pricing,
          artwork: { supplied: svg !== undefined, filename: `drafts/${order.id}.svg` } };
        await env.ORDERS_BUCKET.put(`drafts/${order.id}.json`, JSON.stringify(draft), { httpMetadata: { contentType: 'application/json' } });
        if (svg !== undefined) {
          await env.ORDERS_BUCKET.put(`drafts/${order.id}.svg`, svg, { httpMetadata: { contentType: 'image/svg+xml', contentDisposition: 'attachment; filename="artwork-mirrored.svg"' } });
          artworkStored = true;
        }
      } catch (error) { if (error instanceof RequestError) throw error; /* Optional storage must not turn an authorized provider order into a failed checkout. */ }
    }
    return json({ id: order.id, totalCents: pricing.totalCents, totalUSD: pricing.totalUSD, currency: 'USD', artworkStored });
  } catch (error) { return requestError(error, 'Unable to create PayPal checkout. Please try again.'); }
}
