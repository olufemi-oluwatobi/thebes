// Bachs (bachs.io): hosted checkout for wallet top-ups, signed webhooks, and (next) Connect payouts to creators.
// Money in Bachs is a decimal string ("29.00") with an ISO currency; we keep whole cents everywhere else.
// Off until BACHS_SECRET_KEY is set: top-ups then fall back to a reference an admin credits by hand.

export const bachsOn = (env) => !!env.BACHS_SECRET_KEY;
const base = (env) => env.BACHS_API_BASE || (String(env.BACHS_SECRET_KEY || '').startsWith('sk_live_') ? 'https://api.bachs.io' : 'https://sandbox-api.bachs.io');
export const toDecimal = (cents) => (cents / 100).toFixed(2);
export const toCents = (s) => Math.round(parseFloat(String(s)) * 100);

// one call to the Bachs API. idem: Idempotency-Key for POSTs; account: act as a connected account (X-Account-Id)
export async function bachs(env, method, path, body, { idem, account } = {}) {
  const r = await fetch(base(env) + path, {
    method,
    headers: { Authorization: 'Bearer ' + env.BACHS_SECRET_KEY, 'Content-Type': 'application/json', ...(idem ? { 'Idempotency-Key': idem } : {}), ...(account ? { 'X-Account-Id': account } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.error?.message || j?.message || 'the payment provider refused the request';
    throw Object.assign(new Error(msg), { status: 502, code: 'provider_error', provider: { status: r.status, code: j?.error?.code || j?.error_code } });
  }
  return j;
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const same = (a, b) => { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };
export async function sign(secret, t, raw) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`)));
}
// a delivery is genuine if its HMAC-SHA256 over "{timestamp}.{raw body}" matches, and it is under 5 minutes old.
// Prefers X-Bachs-Signature-V2 (t=…,v1=…[,v1=…] during a secret rotation), falls back to the older pair of headers.
export async function verifyWebhook(env, raw, headers, nowSec = Math.floor(Date.now() / 1000)) {
  const secret = env.BACHS_WEBHOOK_SECRET;
  if (!secret) return false;
  let t, sigs = [];
  const v2 = headers.get('x-bachs-signature-v2');
  if (v2) for (const part of v2.split(',')) { const [k, v] = part.split('=', 2).map((x) => (x || '').trim()); if (k === 't') t = v; else if (k === 'v1' && v) sigs.push(v); }
  else { t = headers.get('x-bachs-timestamp'); const s = headers.get('x-bachs-signature'); if (s) sigs = [s.trim()]; }
  if (!t || !/^\d+$/.test(t) || !sigs.length) return false;
  if (Math.abs(nowSec - parseInt(t, 10)) > 300) return false;
  const want = await sign(secret, t, raw);
  return sigs.some((s) => same(want, s.toLowerCase()));
}
