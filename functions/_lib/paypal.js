import { RequestError, priceConfiguration, isCalendarDate } from './pricing.js';
export const ORDER_ID = /^[A-Z0-9]{10,36}$/;
export function paypalSettings(env = {}) {
  const clientId = env.PAYPAL_CLIENT_ID?.trim();
  const secret = env.PAYPAL_CLIENT_SECRET?.trim();
  const mode = env.PAYPAL_ENV?.trim() || 'sandbox';
  return { clientId, secret, mode, enabled: Boolean(clientId && secret && ['sandbox', 'live'].includes(mode)),
    baseURL: mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com' };
}
export async function paypalClient(env) {
  const settings = paypalSettings(env);
  if (!settings.enabled) throw new RequestError('PayPal checkout is temporarily unavailable.', 503);
  // Encode credentials as UTF-8 before HTTP Basic encoding, including non-ASCII secrets.
  const credentials = new TextEncoder().encode(`${settings.clientId}:${settings.secret}`);
  const authorization = btoa(Array.from(credentials, byte => String.fromCharCode(byte)).join(''));
  const tokenResponse = await fetch(`${settings.baseURL}/v1/oauth2/token`, {
    method: 'POST', headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials', signal: AbortSignal.timeout(10000)
  });
  if (!tokenResponse.ok) throw new Error('PayPal authorization failed');
  const token = await tokenResponse.json();
  if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Invalid OAuth response');
  return async (path, options = {}) => fetch(`${settings.baseURL}${path}`, {
    ...options, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(15000)
  });
}
// Trusted provider metadata allows amount/spec verification even without optional R2.
export function encodeSpec(spec, shipDate = null, artworkFingerprint = null) {
  return JSON.stringify({ v: 1, m: spec.material, s: spec.size, h: spec.handle, d: spec.medium, e: spec.extraHead, ...(shipDate ? { t: shipDate } : {}), ...(artworkFingerprint ? { a: artworkFingerprint } : {}) });
}
export function decodeSpec(text) {
  const value = JSON.parse(text);
  if (value.v !== 1) throw new Error('Unknown order metadata');
  return { ...priceConfiguration({ material: value.m, size: value.s, handle: value.h, medium: value.d, extraHead: value.e }), estimatedShipDate: isCalendarDate(value.t) ? value.t : null };
}

// A compact 128-bit content identity fits PayPal's 127-character custom_id limit.
export async function fingerprintArtwork(configuration, svg) {
  const canonical = JSON.stringify({ configuration, svg: svg ?? null }, (_, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))).slice(0, 16);
  return btoa(Array.from(digest, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
