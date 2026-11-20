// Vercel Node Function: adapt to the exact same validation, pricing and provider handler.
import { onRequest } from '../functions/api/create-checkout.js';
import { json, MAX_BODY_BYTES } from '../functions/_lib/pricing.js';

export default async function handler(req, res) {
  let response;
  try {
    const host = req.headers.host;
    if (typeof host !== 'string' || !/^[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$/.test(host)) throw new Error('Invalid host');
    const origin = new URL(`https://${host}`);
    if (origin.host.toLowerCase() !== host.toLowerCase()) throw new Error('Invalid host');
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    let body;
    if (req.method === 'POST') {
      if (req.body !== undefined) {
        body = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
        if (Buffer.byteLength(body) > MAX_BODY_BYTES) response = json({ error: 'Request body is too large.' }, 413);
      } else {
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > MAX_BODY_BYTES) { response = json({ error: 'Request body is too large.' }, 413); break; }
          chunks.push(buffer);
        }
        if (!response) body = Buffer.concat(chunks);
      }
    }
    if (!response) {
      const request = new Request(new URL('/api/create-checkout', origin), {
        method: req.method, headers, ...(body === undefined ? {} : { body })
      });
      response = await onRequest({ request, env: { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY, ESTIMATED_SHIP_DATE: process.env.ESTIMATED_SHIP_DATE } });
    }
  } catch { response = json({ error: 'Invalid checkout request.' }, 400); }
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(await response.text());
}
