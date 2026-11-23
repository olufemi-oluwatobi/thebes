// Stripe: hosted Checkout for wallet top-ups and signed webhooks. Amounts are already whole cents, like ours.
export const stripeOn = (env) => !!env.STRIPE_SECRET_KEY;
const base = (env) => env.STRIPE_API_BASE || 'https://api.stripe.com';

// Stripe takes form-encoded bodies with bracketed keys: line_items[0][price_data][currency]=usd
export function formEncode(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out); else out.append(key, String(v));
  }
  return out;
}

export async function stripe(env, method, path, body, { idem } = {}) {
  const r = await fetch(base(env) + path, {
    method,
    headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2025-03-31.basil', ...(idem ? { 'Idempotency-Key': idem } : {}) },
    body: body ? formEncode(body).toString() : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || 'the payment provider refused the request'), { status: 502, code: 'provider_error', provider: { status: r.status, code: j?.error?.code } });
  return j;
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const same = (a, b) => { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };
export async function stripeSign(secret, t, raw) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`)));
}
// Stripe-Signature: t=…,v1=…[,v1=… during a secret roll]. HMAC-SHA256 of "{t}.{raw body}", within 5 minutes.
export async function verifyStripe(env, raw, headers, nowSec = Math.floor(Date.now() / 1000)) {
  const secret = env.STRIPE_WEBHOOK_SECRET, h = headers.get('stripe-signature');
  if (!secret || !h) return false;
  let t; const sigs = [];
  for (const part of h.split(',')) { const [k, v] = part.split('=', 2).map((x) => (x || '').trim()); if (k === 't') t = v; else if (k === 'v1' && v) sigs.push(v); }
  if (!t || !/^\d+$/.test(t) || !sigs.length || Math.abs(nowSec - +t) > 300) return false;
  const want = await stripeSign(secret, t, raw);
  return sigs.some((s) => same(want, s));
}
