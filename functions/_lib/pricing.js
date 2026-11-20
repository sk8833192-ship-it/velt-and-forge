// One authoritative USD price table for both payment providers.
const BASE_CENTS = new Map([[38, 6900], [50, 8900], [63, 10900]]);
const MATERIAL_CENTS = new Map([['brass', 0], ['steel', 1500]]);
const HANDLE_CENTS = new Map([['walnut', 0], ['steel', 1800], ['arbor', 0]]);
const MEDIUMS = new Set(['ice', 'leather', 'wood']);
export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_ARTWORK_BODY_BYTES = 256 * 1024;
export const MAX_SVG_BYTES = 200 * 1024;

export class RequestError extends Error {
  constructor(message, status = 400, code) { super(message); this.status = status; this.code = code; }
}
export function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", ...extraHeaders
  } });
}
export function assertSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    throw new RequestError('Cross-origin requests are not allowed.', 403);
  }
}
// Content-Length is optional and untrusted; bound bytes while consuming the stream.
export async function readBody(request, maxBytes = MAX_BODY_BYTES) {
  if (Number(request.headers.get('Content-Length')) > maxBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); return null; }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}
export async function readJSON(request, maxBytes = MAX_BODY_BYTES, maxBytesWithoutSVG = maxBytes) {
  assertSameOrigin(request);
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError('Content-Type must be application/json.', 415);
  }
  let text;
  try { text = await readBody(request, maxBytes); }
  catch { throw new RequestError('Invalid JSON body.'); }
  if (text === null) throw new RequestError('Request body is too large.', 413);
  try {
    const input = JSON.parse(text);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error();
    if (input.mirroredSvg === undefined && new TextEncoder().encode(text).byteLength > maxBytesWithoutSVG) throw new RequestError('Request body is too large.', 413);
    return input;
  } catch (error) { if (error instanceof RequestError) throw error; throw new RequestError('Invalid JSON body.'); }
}
export function priceConfiguration(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RequestError('Invalid stamp configuration.');
  const material = typeof input.material === 'string' ? input.material : input.material?.id;
  const handle = typeof input.handle === 'string' ? input.handle : input.handle?.id;
  const medium = input.medium ?? input.targetMedium?.id;
  const rawSize = input.size ?? input.diameterMM;
  const size = typeof rawSize === 'string' && /^(38|50|63)$/.test(rawSize) ? Number(rawSize) : rawSize;
  if (!BASE_CENTS.has(size) || !MATERIAL_CENTS.has(material) || !HANDLE_CENTS.has(handle) || !MEDIUMS.has(medium) || typeof input.extraHead !== 'boolean') {
    throw new RequestError('Invalid material, size, handle, medium or extraHead.');
  }
  const spec = { material, size, handle, medium, extraHead: input.extraHead };
  const mainCents = BASE_CENTS.get(size) + MATERIAL_CENTS.get(material) + HANDLE_CENTS.get(handle);
  const materialLabel = material === 'steel' ? '304 stainless steel' : 'Lead-free brass';
  const handleLabel = { walnut: 'Walnut handle', steel: '304 steel handle', arbor: 'Arbor / hammer rod' }[handle];
  const items = [{ name: `Velt & Forge ${size} mm custom stamp`, description: `${materialLabel} · ${handleLabel} · ${medium}`, unitCents: mainCents }];
  if (spec.extraHead) items.push({ name: 'Second interchangeable custom stamp head', description: `${size} mm · shared M8 handle`, unitCents: 4900 });
  const totalCents = mainCents + (spec.extraHead ? 4900 : 0);
  return { spec, items, mainCents, totalCents, totalUSD: (totalCents / 100).toFixed(2), currency: 'USD' };
}
export function requestError(error, fallback = 'Unable to process payment. Please try again.') {
  return error instanceof RequestError ? json({ error: error.message, ...(error.code ? { code: error.code } : {}) }, error.status) : json({ error: fallback }, 502);
}

// A workshop-owned date is required before live payment can promise dispatch.
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function estimatedShipDate(env = {}) {
  const value = env.ESTIMATED_SHIP_DATE;
  return isCalendarDate(value) && value >= new Date().toISOString().slice(0, 10) ? value : null;
}
export function requireLiveShipDate(isLive, date) {
  if (isLive && !date) throw new RequestError('Live checkout opens once the workshop confirms an estimated ship date.', 503);
}
