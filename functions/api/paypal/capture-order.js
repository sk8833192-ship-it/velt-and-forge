import { json, readJSON, priceConfiguration, RequestError, requestError } from '../../_lib/pricing.js';
import { paypalClient, ORDER_ID, decodeSpec } from '../../_lib/paypal.js';

function verifiedPayment(order, orderId, draft) {
  if (order.id !== orderId || order.status !== 'COMPLETED' || order.purchase_units?.length !== 1) throw new Error('Order is not completed');
  const unit = order.purchase_units[0];
  // Metadata originates in our create-order handler, never in this capture request.
  const pricing = unit.custom_id ? decodeSpec(unit.custom_id) : draft?.spec ? priceConfiguration(draft.spec) : null;
  const captures = unit.payments?.captures;
  if (!pricing || captures?.length !== 1) throw new Error('Missing payment metadata');
  const capture = captures[0];
  if (capture.status !== 'COMPLETED' || typeof capture.id !== 'string' || !ORDER_ID.test(capture.id) || capture.amount?.currency_code !== 'USD' || capture.amount.value !== pricing.totalUSD) throw new Error('Invalid captured amount');
  if (draft?.spec && JSON.stringify(priceConfiguration(draft.spec).spec) !== JSON.stringify(pricing.spec)) throw new Error('Draft/payment mismatch');
  return { unit, pricing, capture };
}

export async function onRequest({ request, env = {} }) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  try {
    const { orderId } = await readJSON(request);
    if (typeof orderId !== 'string' || !ORDER_ID.test(orderId)) throw new RequestError('Invalid PayPal order ID.');
    const paypal = await paypalClient(env);
    let draft = null;
    if (env.ORDERS_BUCKET) {
      try { const stored = await env.ORDERS_BUCKET.get(`drafts/${orderId}.json`); if (stored) draft = await stored.json(); }
      catch { /* Provider custom_id remains the authoritative storage-independent fallback. */ }
    }
    let order, instrumentDeclined = false;
    try {
      const response = await paypal(`/v2/checkout/orders/${orderId}/capture`, { method: 'POST', headers: { 'PayPal-Request-Id': `${orderId}-capture`, Prefer: 'return=representation' }, body: '{}' });
      if (response.ok) order = await response.json();
      else {
        const diagnostic = await response.json();
        instrumentDeclined = diagnostic.details?.some(detail => detail.issue === 'INSTRUMENT_DECLINED') === true;
      }
    } catch { /* A timeout may follow a successful capture. Recover from PayPal before reporting failure. */ }
    if (!order || order.status !== 'COMPLETED' || !order.purchase_units?.[0]?.payments?.captures || (!order.purchase_units[0].custom_id && !draft?.spec)) {
      const recovered = await paypal(`/v2/checkout/orders/${orderId}`, { method: 'GET' });
      if (!recovered.ok) throw new Error('Unable to recover order');
      order = await recovered.json();
    }
    if (instrumentDeclined && order.id === orderId && order.status === 'APPROVED' && !order.purchase_units?.some(unit => unit.payments?.captures?.length)) {
      throw new RequestError('Payment was declined. Please select another funding method.', 422, 'INSTRUMENT_DECLINED');
    }
    const { unit, pricing, capture } = verifiedPayment(order, orderId, draft);
    const payerEmail = order.payer?.email_address || order.payment_source?.paypal?.email_address || '';
    const shippingName = unit.shipping?.name?.full_name || '';
    const record = { estimatedShipDate: pricing.estimatedShipDate || draft?.estimatedShipDate || null, orderId, capturedAt: capture.create_time || new Date().toISOString(), spec: pricing.spec, pricing,
      configuration: draft?.configuration || null,
      customer: { payerEmail, payerId: order.payer?.payer_id || '', shippingName, shippingAddress: unit.shipping?.address || null },
      payment: { provider: 'paypal', status: 'COMPLETED', captureId: capture.id, amount: capture.amount.value, currency: 'USD' },
      artwork: { supplied: Boolean(draft?.artwork?.supplied), saved: false } };
    let artworkSaved = false;
    if (env.ORDERS_BUCKET) {
      try {
        const artwork = await env.ORDERS_BUCKET.get(`drafts/${orderId}.svg`);
        if (artwork) {
          await env.ORDERS_BUCKET.put(`paid/${orderId}/artwork-mirrored.svg`, artwork.body, { httpMetadata: { contentType: 'image/svg+xml', contentDisposition: 'attachment; filename="artwork-mirrored.svg"' } });
          record.artwork.saved = true;
        }
      } catch { /* A failed artwork copy must not prevent the paid customer/order record. */ }
      try {
        await env.ORDERS_BUCKET.put(`paid/${orderId}/order.json`, JSON.stringify(record), { httpMetadata: { contentType: 'application/json' } });
        artworkSaved = record.artwork.saved;
      } catch { /* Capture already succeeded; buyer receives a receipt and keeps a local proof backup. */ }
    }
    if (env.ORDER_WEBHOOK_URL) {
      try {
        const url = new URL(env.ORDER_WEBHOOK_URL);
        if (url.protocol === 'https:' && !url.username && !url.password) await fetch(url.href, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `${orderId}-${capture.id}` },
          body: JSON.stringify(record), signal: AbortSignal.timeout(5000)
        });
      } catch { /* Notifications are best effort and must not invalidate a successful payment. */ }
    }
    return json({ status: 'COMPLETED', orderId, captureId: capture.id, amount: capture.amount.value, payerEmail, shippingName, artworkSaved });
  } catch (error) { return requestError(error, 'Unable to confirm PayPal payment. Please retry confirmation for this order.'); }
}
