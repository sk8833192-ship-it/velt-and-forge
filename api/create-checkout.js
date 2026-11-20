// Vercel Node Function: adapt its request to the shared Cloudflare Web handler.
import { onRequest } from '../functions/api/create-checkout.js';

export default async function handler(req, res) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  let body;
  if (req.method === 'POST') {
    if (req.body !== undefined) {
      body = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
    } else {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > 16384) {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.end(JSON.stringify({ error: 'Request body is too large.' }));
          return;
        }
        chunks.push(buffer);
      }
      body = Buffer.concat(chunks);
    }
  }
  const request = new Request(`https://${req.headers.host}/api/create-checkout`, {
    method: req.method,
    headers,
    ...(body === undefined ? {} : { body })
  });
  const response = await onRequest({ request, env: { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY } });
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(await response.text());
}
