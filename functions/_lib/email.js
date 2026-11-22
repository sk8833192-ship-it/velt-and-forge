import { priceConfiguration } from './pricing.js';

const REPLY_TO = 'orders@veltandforge.com';
const FROM = `Velt & Forge <${REPLY_TO}>`;
const WORKSHOP_ADDRESS = 'Room 3104, No. 7 Xingying Street, Guangzhou, Guangdong, China';
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ESCAPES[character]);
const hasText = value => typeof value === 'string' && Boolean(value.trim());

function validEmail(value) {
  return typeof value === 'string' && value === value.trim() && value.length <= 254 &&
    /^[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(value);
}

function renderEmail(heading, intro, rows, closing = []) {
  return {
    text: ['Velt & Forge', '', heading, '', intro, '', ...rows.map(([label, value]) => `${label}: ${value}`), ...closing.flatMap(paragraph => ['', paragraph])].join('\n'),
    html: `<div lang="en" style="background:#f6f3ec;color:#29251e;padding:24px 16px;font:16px/1.5 Georgia,serif">
      <div style="max-width:560px;margin:0 auto;padding:24px;background:#fffdf8;border-top:2px solid #96734a">
        <p style="font:12px Arial,sans-serif;letter-spacing:3px;color:#60472e">VELT &amp; FORGE</p>
        <h1 style="font-size:29px;font-weight:normal;margin:12px 0">${escapeHTML(heading)}</h1>
        <p>${escapeHTML(intro)}</p>
        <table style="width:100%;border-collapse:collapse;font-size:15px">
          ${rows.map(([label, value]) => `<tr><th scope="row" style="text-align:left;vertical-align:top;padding:8px 12px 8px 0;border-bottom:1px solid #e6dfd1">${escapeHTML(label)}</th><td style="padding:8px 0;border-bottom:1px solid #e6dfd1">${escapeHTML(value)}</td></tr>`).join('')}
        </table>
        ${closing.map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join('')}
      </div>
    </div>`
  };
}

async function sendEmail(apiKey, idempotencyKey, to, subject, content) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [to], subject, ...content }),
      redirect: 'error',
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendOrderEmails({ env, orderId, captureId, amount, currency, payerEmail, shippingName, shippingAddress, spec, estimatedShipDate, artworkSaved } = {}) {
  const notSent = { buyerEmailSent: false, merchantEmailSent: false };
  try {
    const apiKey = env?.RESEND_API_KEY?.trim();
    if (!apiKey) return { ...notSent, skipped: true };

    const merchant = env.MERCHANT_ALERT_EMAIL?.trim() || 'sk8833192@gmail.com';
    const address = [shippingAddress?.address_line_1, shippingAddress?.address_line_2, shippingAddress?.admin_area_2,
      shippingAddress?.admin_area_1, shippingAddress?.postal_code, shippingAddress?.country_code].filter(hasText).join(', ');
    const total = `$${amount} ${currency}`;
    const rows = [
      ['Order ID', orderId], ['Capture ID', captureId],
      ...priceConfiguration(spec).items.map(item => [item.name, `${item.description} · $${(item.unitCents / 100).toFixed(2)}`]),
      ['Total paid', total], ['Estimated ship date', estimatedShipDate || 'To be confirmed'],
      ['Shipping recipient', hasText(shippingName) ? shippingName : 'Not provided'], ['Shipping address', address || 'Not provided']
    ];
    const buyer = validEmail(payerEmail) ? renderEmail('Your order is confirmed', 'Thank you for choosing Velt & Forge. We’ve received your payment and will prepare your workshop proof.', rows, [
      'Next: we’ll email your proof for approval before machining begins. Free cancellation anytime before proof approval and machining.',
      `Questions about your artwork? Reply to ${REPLY_TO}.`,
      WORKSHOP_ADDRESS
    ]) : null;
    const alert = renderEmail('New paid order', 'Prepare the workshop proof and confirm fulfillment using the details below.', [...rows,
      ['Payer email', hasText(payerEmail) ? payerEmail : 'Not provided'],
      ['Artwork name', hasText(spec.artworkName) ? spec.artworkName : 'Not provided'],
      ['Bleed score', Number.isFinite(spec.bleedScore) ? spec.bleedScore : 'Not available'],
      ['R2 artwork saved', artworkSaved ? 'Yes' : 'No']
    ]);
    const [buyerEmailSent, merchantEmailSent] = await Promise.all([
      buyer ? sendEmail(apiKey, `buyer-receipt/${orderId}/${captureId}`, payerEmail, `Order confirmed — Velt & Forge (#${orderId})`, buyer) : false,
      sendEmail(apiKey, `merchant-alert/${orderId}/${captureId}`, merchant, `[NEW ORDER] ${total} — Velt & Forge #${orderId}`, alert)
    ]);
    return { buyerEmailSent, merchantEmailSent };
  } catch {
    return notSent;
  }
}
