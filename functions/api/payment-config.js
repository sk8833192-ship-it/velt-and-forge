import { json, estimatedShipDate } from '../_lib/pricing.js';
import { paypalSettings } from '../_lib/paypal.js';
export function onRequest({ request, env = {} }) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET' });
  const settings = paypalSettings(env);
  const shipDate = estimatedShipDate(env);
  const liveEnabled = (settings.enabled && settings.mode === 'live') || Boolean(env.STRIPE_SECRET_KEY?.trim().startsWith('sk_live_'));
  return json({ estimatedShipDate: shipDate, checkoutReady: !liveEnabled || Boolean(shipDate), paypalEnabled: settings.enabled, ...(settings.enabled ? { paypalClientId: settings.clientId } : {}),
    paypalEnv: settings.mode === 'live' ? 'live' : 'sandbox', stripeEnabled: Boolean(env.STRIPE_SECRET_KEY?.trim()), currency: 'USD' });
}
