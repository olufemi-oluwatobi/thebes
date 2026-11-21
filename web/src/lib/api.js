// Thin client for the Worker API. Errors carry { code, status } from the server's { error, code }.
export async function api(path, { method = 'GET', body, file } = {}) {
  const init = { method, credentials: 'same-origin', headers: {} };
  if (file) { init.body = file; init.headers['content-type'] = file.type || 'application/octet-stream'; }
  else if (body !== undefined) { init.body = JSON.stringify(body); init.headers['content-type'] = 'application/json'; }
  const r = await fetch('/api' + path, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Something went wrong. Try again.'); e.code = j.code; e.status = r.status; e.reasons = j.reasons; throw e; }
  return j;
}
export const qs = (o) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v != null && v !== '') p.set(k, v); const s = p.toString(); return s ? '?' + s : ''; };
