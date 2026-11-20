// Thebes Worker: the API, the game pages (/play/:id), uploaded files (/files/…), sign-in (/auth/…) and the cron.
// The app itself is static (public/), served by Workers assets.
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import WORDS_TXT from '../vendor/godtongue/web/games/words5.txt';
import { squadRoutes } from './squad-routes.js';

const WORDS = new Set(WORDS_TXT.split('\n').map((w) => w.trim()).filter(Boolean));
const app = new Hono();
const now = () => Date.now();
const DAY = 86400000;
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const rand = (n = 24) => hex(crypto.getRandomValues(new Uint8Array(n)));
const uid = (p) => p + '-' + now().toString(36) + rand(6);
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const fail = (c, status, error, code) => c.json({ error, ...(code ? { code } : {}) }, status);
const json = (s, d = {}) => { try { return JSON.parse(s || ''); } catch { return d; } };
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
const ROLE_RANK = { analyst: 1, editor: 2, admin: 3, owner: 4 };
const hasBoard = (k) => k.type !== 'challenge';
const isClosed = (k) => k.status === 'ended' || (k.status === 'live' && k.ends_at && k.ends_at <= now());

// ---------- who is asking ----------
app.use('*', async (c, next) => {
  const sid = getCookie(c, 'ts');
  if (sid) {
    const row = await c.env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ? AND s.expires_at > ? AND u.deleted_at IS NULL')
      .bind(await sha(sid), now()).first();
    if (row) c.set('user', row);
  }
  await next();
});
const user = (c) => c.get('user') || null;
const needUser = (c) => { const u = user(c); if (!u) throw new HttpError(401, 'sign in first', 'signin'); return u; };
const needAdmin = (c) => { const u = needUser(c); if (u.role !== 'admin') throw new HttpError(403, 'admins only'); return u; };
class HttpError extends Error { constructor(status, msg, code) { super(msg); this.status = status; this.code = code; } }
app.onError((e, c) => e instanceof HttpError ? fail(c, e.status, e.message, e.code) : (console.error(e), fail(c, 500, 'something went wrong')));

// the player: the signed-in user's, or this device's until they sign in
async function player(c) {
  const DB = c.env.DB, u = user(c), t = now();
  if (u) {
    let p = await DB.prepare('SELECT * FROM players WHERE user_id = ?').bind(u.id).first();
    if (!p) { p = { id: uid('p') }; await DB.prepare('INSERT INTO players (id, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)').bind(p.id, u.id, t, t).run(); }
    return p;
  }
  let dev = getCookie(c, 'td');
  if (!dev) { dev = rand(16); setCookie(c, 'td', dev, { path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 400 * 86400 }); }
  const h = await sha('device:' + dev);
  let p = await DB.prepare('SELECT * FROM players WHERE device_hash = ?').bind(h).first();
  if (!p) { p = { id: uid('p') }; await DB.prepare('INSERT INTO players (id, device_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?)').bind(p.id, h, t, t).run(); }
  return p;
}
const shown = (r) => r.handle ? '@' + r.handle : 'Guest ' + String(r.player_id || r.id || '').slice(-4).toUpperCase();

async function memberRole(DB, companyId, userId) {
  const m = await DB.prepare('SELECT role FROM company_members WHERE company_id = ? AND user_id = ?').bind(companyId, userId).first();
  return m?.role || null;
}
async function needMember(c, companyId, min = 'editor') {
  const u = needUser(c);
  if (u.role === 'admin') return 'admin';
  const r = await memberRole(c.env.DB, companyId, u.id);
  if (!r || ROLE_RANK[r] < ROLE_RANK[min]) throw new HttpError(403, 'you are not allowed to do that for this company');
  return r;
}

// ---------- sign in (email link) ----------
app.post('/api/auth/start', async (c) => {
  const { email } = await c.req.json().catch(() => ({}));
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return fail(c, 400, 'that does not look like an email address');
  const token = rand(24);
  await c.env.DB.prepare('INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)').bind(await sha(token), e, now() + 20 * 60000).run();
  const link = `${c.env.APP_URL || new URL(c.req.url).origin}/auth/verify?t=${token}`;
  if (c.env.EMAIL_MODE === 'show') return c.json({ sent: false, link });
  if (!c.env.RESEND_API_KEY) return fail(c, 503, 'email sign-in is not set up yet (RESEND_API_KEY)');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: `Bearer ${c.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: c.env.EMAIL_FROM, to: e, subject: 'Your Gorilla Squad sign-in link', text: `Sign in to Gorilla Squad:\n\n${link}\n\nThe link works once, for 20 minutes.` }),
  });
  if (!r.ok) return fail(c, 502, 'the email could not be sent');
  return c.json({ sent: true });
});

app.get('/auth/verify', async (c) => {
  const DB = c.env.DB, t = now(), token = c.req.query('t') || '';
  const row = await DB.prepare('SELECT * FROM login_tokens WHERE token_hash = ?').bind(await sha(token)).first();
  if (!row || row.used_at || row.expires_at < t) return c.redirect('/app/#signin');
  await DB.prepare('UPDATE login_tokens SET used_at = ? WHERE token_hash = ?').bind(t, row.token_hash).run();
  let u = await DB.prepare('SELECT * FROM users WHERE email = ?').bind(row.email).first();
  const admins = String(c.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  if (!u) {
    let handle = slugify(row.email.split('@')[0]).replace(/-/g, '.').slice(0, 16) || 'player';
    if (await DB.prepare('SELECT 1 FROM users WHERE handle = ?').bind(handle).first()) handle = handle.slice(0, 12) + rand(2).slice(0, 4);
    u = { id: uid('u') };
    await DB.prepare('INSERT INTO users (id, email, handle, role, verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(u.id, row.email, handle, admins.includes(row.email) ? 'admin' : 'user', t, t, t).run();
  } else if (admins.includes(row.email) && u.role !== 'admin') await DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(u.id).run();
  // this device's plays become the user's, if the user has none yet
  const dev = getCookie(c, 'td');
  if (dev && !(await DB.prepare('SELECT 1 FROM players WHERE user_id = ?').bind(u.id).first()))
    await DB.prepare('UPDATE players SET user_id = ? WHERE device_hash = ? AND user_id IS NULL').bind(u.id, await sha('device:' + dev)).run();
  const sid = rand(32);
  await DB.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha(sid), u.id, t, t + 30 * DAY, (c.req.header('user-agent') || '').slice(0, 200)).run();
  setCookie(c, 'ts', sid, { path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 30 * 86400 });
  return c.redirect('/app/#board');
});

app.post('/api/auth/signout', async (c) => {
  const sid = getCookie(c, 'ts');
  if (sid) await c.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await sha(sid)).run();
  deleteCookie(c, 'ts', { path: '/' });
  return c.json({ ok: true });
});

// ---------- me ----------
app.get('/api/me', async (c) => {
  const u = user(c);
  if (!u) return c.json({ user: null });
  const companies = (await c.env.DB.prepare(`SELECT co.id, co.name, co.slug, co.brand, m.role, a.r2_key logo_key FROM company_members m JOIN companies co ON co.id = m.company_id
    LEFT JOIN assets a ON a.id = co.logo_asset_id WHERE m.user_id = ? AND co.deleted_at IS NULL ORDER BY m.joined_at`).bind(u.id).all()).results
    .map((r) => ({ ...r, brand: json(r.brand), logo: r.logo_key ? '/files/' + r.logo_key : null }));
  const p = await c.env.DB.prepare('SELECT id FROM players WHERE user_id = ?').bind(u.id).first();
  const stats = p ? await c.env.DB.prepare("SELECT COUNT(*) played, SUM(status = 'won') wins, MIN(CASE WHEN status = 'won' THEN tries END) best FROM plays WHERE player_id = ?").bind(p.id).first() : {};
  return c.json({ user: { id: u.id, email: u.email, handle: u.handle, display_name: u.display_name, role: u.role, first_name: u.first_name, last_name: u.last_name,
    is_verified: !!u.is_verified, is_blocked: !!u.is_blocked }, companies, stats });
});

app.patch('/api/me', async (c) => {
  const u = needUser(c), b = await c.req.json().catch(() => ({}));
  if (b.handle != null) {
    const h = String(b.handle).toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_.]{3,20}$/.test(h)) return fail(c, 400, 'handles are 3 to 20 letters, digits, dots or underscores');
    if (await c.env.DB.prepare('SELECT 1 FROM users WHERE handle = ? AND id <> ?').bind(h, u.id).first()) return fail(c, 409, 'that handle is taken');
    await c.env.DB.prepare('UPDATE users SET handle = ?, updated_at = ? WHERE id = ?').bind(h, now(), u.id).run();
  }
  if (b.display_name != null) await c.env.DB.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').bind(String(b.display_name).slice(0, 60), now(), u.id).run();
  return c.json({ ok: true });
});

app.get('/api/me/plays', async (c) => {
  const p = await player(c);
  const rows = (await c.env.DB.prepare(`SELECT p.status, p.tries, p.ms, p.started_at, k.id contest_id, k.title, k.settings, co.name company, b.template_id
    FROM plays p JOIN contests k ON k.id = p.contest_id JOIN companies co ON co.id = k.company_id LEFT JOIN contest_builds b ON b.id = k.current_build_id
    WHERE p.player_id = ? ORDER BY p.started_at DESC LIMIT 60`).bind(p.id).all()).results;
  return c.json({ plays: rows.map((r) => ({ ...r, of: json(r.settings).tries || 6, settings: undefined, poster: posterOf(r.template_id) })) });
});
const posterOf = (t) => `/img/${['analog-player', 'trivia-classic'].includes(t) ? t : 'pop-player'}.jpg`;

// ---------- companies and assets ----------
app.post('/api/companies', async (c) => {
  const u = needUser(c), DB = c.env.DB, t = now();
  const b = await c.req.json().catch(() => ({}));
  const name = String(b.name || '').trim().slice(0, 60);
  if (name.length < 2) return fail(c, 400, 'give the company a name');
  let slug = slugify(name), n = 1;
  while (await DB.prepare('SELECT 1 FROM companies WHERE slug = ?').bind(slug).first()) slug = `${slugify(name)}-${++n}`;
  const id = uid('co');
  await DB.batch([
    DB.prepare('INSERT INTO companies (id, slug, name, brand, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, slug, name, JSON.stringify(b.brand || {}), u.id, t, t),
    DB.prepare("INSERT INTO company_members (company_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)").bind(id, u.id, t),
    DB.prepare("INSERT INTO subscriptions (company_id, plan_id, period_start, updated_at) VALUES (?, 'free', ?, ?)").bind(id, t, t),
    DB.prepare('INSERT INTO company_counters (company_id, period_start, updated_at) VALUES (?, ?, ?)').bind(id, t, t),
  ]);
  return c.json({ id, slug, name });
});

app.patch('/api/companies/:id', async (c) => {
  const id = c.req.param('id'); await needMember(c, id, 'admin');
  const b = await c.req.json().catch(() => ({}));
  const co = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(id).first();
  if (!co) return fail(c, 404, 'no such company');
  const brand = { ...json(co.brand), ...(b.brand || {}) };
  await c.env.DB.prepare('UPDATE companies SET name = ?, description = ?, website = ?, brand = ?, updated_at = ? WHERE id = ?')
    .bind(String(b.name ?? co.name).slice(0, 60), b.description ?? co.description, b.website ?? co.website, JSON.stringify(brand), now(), id).run();
  return c.json({ ok: true });
});

app.post('/api/companies/:id/assets', async (c) => {
  const id = c.req.param('id'); await needMember(c, id, 'editor');
  const kind = ['logo', 'logo-mark', 'photo', 'product', 'pattern'].includes(c.req.query('kind')) ? c.req.query('kind') : 'photo';
  const mime = (c.req.header('content-type') || '').split(';')[0];
  if (!/^image\/(png|jpeg|webp|svg\+xml|gif)$/.test(mime)) return fail(c, 415, 'upload a PNG, JPEG, WebP, GIF or SVG');
  const body = await c.req.arrayBuffer();
  if (!body.byteLength || body.byteLength > 5 * 1024 * 1024) return fail(c, 413, 'files can be up to 5 MB');
  const aid = uid('a'), key = `assets/${id}/${aid}`, t = now();
  await c.env.BUCKET.put(key, body, { httpMetadata: { contentType: mime, cacheControl: 'public, max-age=31536000, immutable' } });
  const colors = c.req.query('colors') ? c.req.query('colors').split(',').filter((x) => /^#[0-9a-f]{6}$/i.test(x)).slice(0, 6) : null;
  await c.env.DB.prepare('INSERT INTO assets (id, company_id, kind, r2_key, mime, bytes, sha256, colors, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(aid, id, kind, key, mime, body.byteLength, hex(await crypto.subtle.digest('SHA-256', body)), colors ? JSON.stringify(colors) : null, user(c).id, t).run();
  if (kind === 'logo') await c.env.DB.prepare('UPDATE companies SET logo_asset_id = ?, updated_at = ? WHERE id = ?').bind(aid, t, id).run();
  return c.json({ id: aid, url: '/files/' + key });
});

app.get('/files/*', async (c) => {
  const key = c.req.path.slice('/files/'.length);
  if (!/^assets\/[\w-]+\/[\w-]+$/.test(key)) return c.notFound();
  const o = await c.env.BUCKET.get(key);
  if (!o) return c.notFound();
  return new Response(o.body, { headers: { 'content-type': o.httpMetadata?.contentType || 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" } });
});

app.get('/api/companies/:id/dashboard', async (c) => {
  const id = c.req.param('id'); await needMember(c, id, 'analyst');
  const DB = c.env.DB;
  const co = await DB.prepare(`SELECT co.*, s.plan_id, a.r2_key logo_key, (SELECT COUNT(*) FROM company_members WHERE company_id = co.id) members,
    (SELECT COUNT(*) FROM follows WHERE company_id = co.id) followers FROM companies co LEFT JOIN subscriptions s ON s.company_id = co.id LEFT JOIN assets a ON a.id = co.logo_asset_id WHERE co.id = ?`).bind(id).first();
  const contests = (await DB.prepare(`SELECT k.id, k.title, k.type, k.status, k.ends_at, k.starts_at, k.updated_at, b.template_id, cc.views, cc.plays, cc.wins, cc.entries, cc.likes,
    (SELECT COUNT(*) FROM entries e WHERE e.contest_id = k.id AND e.mailing_opt_in = 1 AND e.withdrawn_at IS NULL AND e.mailing_unsubscribed_at IS NULL) mailing
    FROM contests k LEFT JOIN contest_counters cc ON cc.contest_id = k.id LEFT JOIN contest_builds b ON b.id = k.current_build_id
    WHERE k.company_id = ? AND k.deleted_at IS NULL ORDER BY k.created_at DESC LIMIT 100`).bind(id).all()).results;
  const totals = contests.reduce((a, k) => ({ views: a.views + (k.views || 0), plays: a.plays + (k.plays || 0), wins: a.wins + (k.wins || 0), entries: a.entries + (k.entries || 0) }), { views: 0, plays: 0, wins: 0, entries: 0 });
  const mailing = (await c.env.DB.prepare('SELECT COUNT(*) n FROM entries WHERE company_id = ? AND mailing_opt_in = 1 AND withdrawn_at IS NULL AND mailing_unsubscribed_at IS NULL').bind(id).first())?.n || 0;
  return c.json({ company: { ...co, brand: json(co.brand), logo: co.logo_key ? '/files/' + co.logo_key : null }, totals: { ...totals, mailing },
    contests: contests.map((k) => ({ ...k, status: isClosed(k) ? 'ended' : k.status, poster: posterOf(k.template_id) })) });
});

const csvOf = (rows) => { const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`; return ['date,contest,email,name,phone,draw,mailing_list,agreed_to', ...rows.map((r) => [new Date(r.created_at).toISOString(), r.contest, r.email, r.name, r.phone, r.consent ? 'yes' : 'no', r.mailing_opt_in ? 'yes' : 'no', r.consent_text].map(q).join(','))].join('\n'); };
const entryRows = (DB, company, onlyMailing) => DB.prepare(`SELECT e.created_at, k.title contest, e.email, e.name, e.phone, e.consent, e.mailing_opt_in, e.consent_text FROM entries e JOIN contests k ON k.id = e.contest_id
  WHERE e.company_id = ? AND e.withdrawn_at IS NULL ${onlyMailing ? 'AND e.mailing_opt_in = 1 AND e.mailing_unsubscribed_at IS NULL' : ''} ORDER BY e.created_at DESC`).bind(company).all().then((r) => r.results);
const csvRes = (csv, name) => new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"` } });
// everyone who entered a draw, with what each agreed to
app.get('/api/companies/:id/entries.csv', async (c) => { const id = c.req.param('id'); await needMember(c, id, 'analyst'); return csvRes(csvOf(await entryRows(c.env.DB, id, false)), 'entries.csv'); });
// only players who opted in to the sponsor's mailing list
app.get('/api/companies/:id/mailing-list.csv', async (c) => { const id = c.req.param('id'); await needMember(c, id, 'analyst'); return csvRes(csvOf(await entryRows(c.env.DB, id, true)), 'mailing-list.csv'); });

// ---------- templates and the design step ----------
app.get('/api/templates', async (c) => {
  const rows = (await c.env.DB.prepare(`SELECT t.id, t.game_type_id game, t.name, t.family, t.description, t.min_plan_id, t.current_version, v.source_key, v.slots FROM templates t
    JOIN template_versions v ON v.template_id = t.id AND v.version = t.current_version WHERE t.status = 'live' ORDER BY t.sort`).all()).results;
  return c.json({ templates: rows.map((r) => ({ ...r, slots: json(r.slots), source: '/' + r.source_key, poster: posterOf(r.id) })) });
});

const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');

// the AI only fills the template's slots; every value is checked, and anything that fails falls back to the default
app.post('/api/design', async (c) => {
  needUser(c);
  const b = await c.req.json().catch(() => ({}));
  const tv = await c.env.DB.prepare('SELECT v.slots FROM templates t JOIN template_versions v ON v.template_id = t.id AND v.version = t.current_version WHERE t.id = ?').bind(b.template_id).first();
  if (!tv) return fail(c, 404, 'no such template');
  const manifest = json(tv.slots).slots || {}, rules = json(tv.slots).rules || [];
  const colors = (b.colors || []).filter(isHex);
  const tries = b.tries || 6, mins = b.time ? Math.round(b.time / 60) : 0;
  const N = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];
  const base = {
    brand: String(b.brand || '').toUpperCase().slice(0, 30) || null,
    title: (b.title || 'The Daily Word').toUpperCase(),
    subtitle: [N[tries] ? `${N[tries]} TRIES` : `${tries} TRIES`, mins ? `${N[mins] || mins} MINUTE${mins === 1 ? '' : 'S'}` : null].filter(Boolean).join('  ·  '),
    tagline: (b.title || 'The Daily Word').toUpperCase(),
    win: b.prize ? `You got it! ${b.prize} is yours.` : 'You got it!', lose: 'So close. Come back tomorrow.', timeout: 'Time! Come back tomorrow.',
    ...(colors[0] ? { sponsor: colors[0] } : {}),
  };
  if (b.game === 'trivia') {
    const q = Math.max(1, parseInt(b.questions) || 10);
    Object.assign(base, { title: String(b.title || 'Trivia Sprint').slice(0, 22), subtitle: [`${N[q] || q} QUESTIONS`, mins ? `${N[mins] || mins} MINUTE${mins === 1 ? '' : 'S'}` : 'ONE CLOCK'].join('  ·  '),
      win: b.prize ? `Nicely done! You're in the draw for ${b.prize}.` : 'Nicely done!', lose: 'Not this time. Try the next one.', timeout: "Time's up!", ...(colors[0] ? { accent: colors[0], sponsor: colors[0] } : {}) });
  }
  let ai = {}, aiUsed = false;
  if (c.env.AI_MODE === 'live' && c.env.AI) {
    try {
      const want = Object.entries(manifest).filter(([, s]) => s.ai).map(([k, s]) => `${k}: ${s.type}${s.max ? ` (at most ${s.max} characters${s.case === 'upper' ? ', capitals' : ''})` : ''}${s.role ? ` (role: ${s.role})` : ''}${s.help ? ` — ${s.help}` : ''}`).join('\n');
      const r = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', { max_tokens: 500, messages: [
        { role: 'system', content: 'You fill the slots of a game design template for a small business contest. Reply with one JSON object only: slot name to value. Colours are #rrggbb. Keep text short and warm. Never mention the answer word.' },
        { role: 'user', content: `Business: ${b.brand}\nBrief: ${String(b.brief || '').slice(0, 600)}\nPrize: ${b.prize || 'none'}\nBrand colours: ${colors.join(', ') || 'none'}\nTries: ${tries}, time limit: ${mins ? mins + ' minutes' : 'none'}\n\nSlots:\n${want}` },
      ] });
      const m = String(r?.response || '').match(/\{[\s\S]*\}/); if (m) { ai = json(m[0]); aiUsed = true; }
    } catch (e) { console.log('design: AI failed', e.message); }
  }
  // check every value against its slot
  const out = {};
  for (const [k, s] of Object.entries(manifest)) {
    if (!s.ai) continue;
    let v = ai[k] ?? base[k];
    if (v == null) continue;
    if (s.type === 'color') { if (!isHex(v)) v = base[k]; if (!isHex(v)) continue; out[k] = v.toLowerCase(); continue; }
    v = String(v).replace(/\s+/g, ' ').trim();
    if (s.case === 'upper') v = v.toUpperCase();
    if (s.max && v.length > s.max) v = (base[k] && String(base[k]).length <= s.max) ? base[k] : v.slice(0, s.max).replace(/\s+\S*$/, '');
    out[k] = v.replace(/"/g, "'");
  }
  const failed = [];
  for (const r of rules) {
    if (!r.contrast) continue;
    const [a, bb] = r.contrast.map((x) => x.startsWith('#') ? x : out[x]);
    if (isHex(a) && isHex(bb) && contrast(a, bb) < r.min) { failed.push(r.contrast.join('/')); for (const x of r.contrast) if (!x.startsWith('#')) delete out[x]; }
  }
  return c.json({ slots: out, ai: aiUsed, reverted: failed });
});

// trivia questions from the brief: AI writes them, every one is checked, the creator edits before publishing
const SAMPLE_QUIZ = (brand) => [
  { q: `What does ${brand} love most about its regulars?`, options: ['They keep coming back', 'They never tip', 'They never visit', 'They complain'] },
  { q: 'Which day is usually the busiest for a neighbourhood business?', options: ['Saturday', 'Tuesday', 'Wednesday', 'Monday'] },
  { q: 'What is the best way to hear about our next contest?', options: ['Join the mailing list', 'Guess', 'Wait a year', 'Ask a stranger'] },
];
app.post('/api/design/quiz', async (c) => {
  needUser(c);
  const b = await c.req.json().catch(() => ({}));
  const n = Math.min(20, Math.max(3, parseInt(b.count) || 10)), brand = String(b.brand || 'the business').slice(0, 60);
  if (c.env.AI_MODE === 'live' && c.env.AI) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', { max_tokens: 1800, messages: [
          { role: 'system', content: 'You write multiple-choice trivia for a small business contest. Reply with one JSON array only. Each item: {"q": question (max 120 characters), "options": [the right answer, then 3 wrong answers]} (each answer max 40 characters, all different). Only ask what the brief says or what is general knowledge about the kind of business. No made-up facts about the business. No | or ; characters.' },
          { role: 'user', content: `Business: ${brand}\nBrief: ${String(b.brief || '').slice(0, 1000)}\nWrite ${n} questions.` },
        ] });
        const m = String(r?.response || '').match(/\[[\s\S]*\]/);
        const list = (m ? json(m[0]) : null) || [];
        const good = (Array.isArray(list) ? list : []).filter((x) => typeof checkQuiz([x, x, x]) !== 'string').slice(0, n);
        if (good.length >= 3) return c.json({ questions: good, ai: true });
      } catch (e) { console.log('quiz: AI failed', e.message); }
    }
  }
  return c.json({ questions: SAMPLE_QUIZ(brand), ai: false });
});

// ---------- contests ----------
const TYPES = ['challenge', 'contest', 'daily'];
app.post('/api/contests', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const u = needUser(c); await needMember(c, b.company_id, 'editor');
  const DB = c.env.DB, t = now();
  const game = b.game === 'trivia' ? 'trivia' : 'wordle';
  let secret, word = '';
  if (game === 'wordle') {
    word = String(b.word || '').toLowerCase().trim();
    if (!/^[a-z]{5}$/.test(word)) return fail(c, 400, 'the word must be five letters');
    if (!WORDS.has(word)) return fail(c, 400, 'that word is not in the word list players can guess from');
    secret = { word };
  } else {
    const qs = checkQuiz(b.questions);
    if (typeof qs === 'string') return fail(c, 400, qs);
    secret = { questions: qs };
  }
  if (!TYPES.includes(b.type)) return fail(c, 400, 'type is challenge, contest or daily');
  const tries = game === 'trivia' ? secret.questions.length : Math.min(10, Math.max(1, parseInt(b.tries) || 6)), time = b.time ? Math.min(3600, Math.max(10, parseInt(b.time))) : 0;
  const ends = b.ends_at ? +new Date(b.ends_at) : (b.type === 'challenge' ? null : t + (b.type === 'daily' ? DAY : 7 * DAY));
  const starts = b.starts_at ? +new Date(b.starts_at) : null;
  if (ends && ends <= (starts || t)) return fail(c, 400, 'the end has to be after the start');
  const id = uid('k'), title = String(b.title || 'The Daily Word').slice(0, 60);
  let slug = slugify(title) + '-' + rand(2);
  const fields = (Array.isArray(b.contact_fields) ? b.contact_fields : ['email']).filter((f) => ['email', 'name', 'phone'].includes(f));
  const series = b.type === 'daily' ? slugify(b.series || title) : null;
  let seriesId = null;   // a daily belongs to a series (its streaks and episodes); made on first use
  if (series) {
    seriesId = (await DB.prepare('SELECT id FROM series WHERE company_id = ? AND slug = ?').bind(b.company_id, series).first())?.id;
    if (!seriesId) { seriesId = uid('s'); await DB.prepare("INSERT INTO series (id, company_id, game_type_id, slug, name, cadence, created_at) VALUES (?, ?, ?, ?, ?, 'daily', ?)").bind(seriesId, b.company_id, game, series, title, t).run(); }
  }
  const episode = seriesId ? ((await DB.prepare('SELECT MAX(episode) n FROM contests WHERE series_id = ?').bind(seriesId).first())?.n || 0) + 1 : null;
  await DB.batch([
    DB.prepare(`INSERT INTO contests (id, company_id, created_by, type, game_type_id, series_id, episode, slug, title, description, status, visibility, starts_at, ends_at, settings, prize_summary, win_message, lose_message, contact_fields, consent_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'public', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, b.company_id, u.id, b.type, game, seriesId, episode, slug, title, String(b.brief || '').slice(0, 500), starts, ends, JSON.stringify({ tries, time: time || null, series, game }),
        b.prize ? String(b.prize).slice(0, 80) : null, b.win ? String(b.win).slice(0, 80) : null, b.lose ? String(b.lose).slice(0, 80) : null, JSON.stringify(fields),
        `I agree to share these details with ${b.brand || 'the business'} so they can contact me about this contest and their offers.`, t, t),
    DB.prepare('INSERT INTO contest_secrets (contest_id, secrets) VALUES (?, ?)').bind(id, JSON.stringify(secret)),
    DB.prepare('INSERT INTO contest_counters (contest_id, updated_at) VALUES (?, ?)').bind(id, t),
    ...(b.prize && b.type !== 'challenge' ? [DB.prepare('INSERT INTO contest_prizes (contest_id, rank_from, rank_to, title) VALUES (?, 1, ?, ?)').bind(id, Math.min(100, Math.max(1, parseInt(b.winners) || 1)), String(b.prize).slice(0, 80))] : []),
  ]);
  return c.json({ id, slug, episode, game, settings: { tries, time, series } });
});

// the page the creator's browser built: must keep the word on the server
app.put('/api/contests/:id/page', async (c) => {
  const id = c.req.param('id'), DB = c.env.DB;
  const k = await DB.prepare('SELECT * FROM contests WHERE id = ?').bind(id).first();
  if (!k) return fail(c, 404, 'no such contest');
  await needMember(c, k.company_id, 'editor');
  const b = await c.req.json().catch(() => ({}));
  const html = String(b.html || '');
  if (html.length < 1000 || html.length > 4_000_000 || !html.startsWith('<!doctype html>')) return fail(c, 400, 'that is not a game page');
  if (!/window\.GAME=\{[^<]*"values":\{"server":true/.test(html)) return fail(c, 400, 'a published game must keep its answers on the server');
  const sec = json((await DB.prepare('SELECT secrets FROM contest_secrets WHERE contest_id = ?').bind(id).first())?.secrets);
  const game = (html.match(/window\.GAME=(\{.*?\});\n/)?.[1] || '').toLowerCase();
  if (!game.includes(`"kind":"${k.game_type_id}"`)) return fail(c, 400, `this contest plays ${k.game_type_id}`);
  if (sec.word && game.includes(`"${sec.word}"`)) return fail(c, 400, 'the page gives the word away');
  if (sec.questions && (game.includes('"questions"') || sec.questions.some((x) => game.includes(JSON.stringify(x.q.toLowerCase()))))) return fail(c, 400, 'the page gives the questions away');
  const v = ((await DB.prepare('SELECT MAX(version) v FROM contest_builds WHERE contest_id = ?').bind(id).first())?.v || 0) + 1;
  const bid = uid('b'), key = `pages/${id}/v${v}.html`, t = now();
  await c.env.BUCKET.put(key, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
  const tmpl = k.game_type_id === 'trivia' ? 'trivia-classic' : b.template_id === 'analog-player' ? 'analog-player' : 'pop-player';
  await DB.batch([
    DB.prepare(`INSERT INTO contest_builds (id, contest_id, version, template_id, template_version, slot_values, source_key, page_key, engine, status, made_by, created_by, created_at)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'game@1', 'ok', 'wizard', ?, ?)`).bind(bid, id, v, tmpl, JSON.stringify(b.slot_values || {}), `templates/${tmpl}.gt`, key, user(c).id, t),
    DB.prepare('UPDATE contests SET current_build_id = ?, updated_at = ? WHERE id = ?').bind(bid, t, id),
  ]);
  return c.json({ build: bid, version: v });
});

app.post('/api/contests/:id/publish', async (c) => {
  const id = c.req.param('id'), DB = c.env.DB, t = now();
  const k = await DB.prepare('SELECT * FROM contests WHERE id = ?').bind(id).first();
  if (!k) return fail(c, 404, 'no such contest');
  await needMember(c, k.company_id, 'editor');
  if (!k.current_build_id) return fail(c, 400, 'design the game before publishing');
  const status = k.starts_at && k.starts_at > t ? 'scheduled' : 'live';
  await DB.prepare('UPDATE contests SET status = ?, published_at = ?, updated_at = ? WHERE id = ?').bind(status, t, t, id).run();
  await DB.prepare('UPDATE company_counters SET contests = contests + 1, updated_at = ? WHERE company_id = ?').bind(t, k.company_id).run();
  return c.json({ status, url: `${c.env.APP_URL || new URL(c.req.url).origin}/c/${id}` });
});

// the ids of the companies whose mailing list this person is on (by their player, or by their signed-in email)
async function mailingCompanies(c) {
  const DB = c.env.DB, u = user(c);
  let pid = '';
  if (u) pid = (await DB.prepare('SELECT id FROM players WHERE user_id = ?').bind(u.id).first())?.id || '';
  else { const dev = getCookie(c, 'td'); if (dev) pid = (await DB.prepare('SELECT id FROM players WHERE device_hash = ?').bind(await sha('device:' + dev)).first())?.id || ''; }
  // joined: on the list now; left: unsubscribed and not back since (we stop asking them)
  const rows = (await DB.prepare(`SELECT e.company_id, MAX(e.mailing_opt_in = 1 AND e.mailing_unsubscribed_at IS NULL) joined, MAX(e.mailing_unsubscribed_at IS NOT NULL) left_ FROM entries e
    WHERE e.withdrawn_at IS NULL AND (e.player_id = ? OR e.email = ?) GROUP BY e.company_id`).bind(pid, u?.email || '').all()).results;
  const set = new Set(rows.filter((r) => r.joined).map((r) => r.company_id));
  set.left = new Set(rows.filter((r) => !r.joined && r.left_).map((r) => r.company_id));
  return set;
}

// a contest as the feed shows it
async function cards(c, rows) {
  if (!rows.length) return [];
  const DB = c.env.DB, u = user(c), ids = rows.map((r) => r.id);
  const marks = ids.map(() => '?').join(',');
  const [likes, follows, people, counts, winners] = await DB.batch([
    DB.prepare(`SELECT contest_id FROM likes WHERE user_id = ? AND contest_id IN (${marks})`).bind(u?.id || '', ...ids),
    DB.prepare('SELECT company_id FROM follows WHERE user_id = ?').bind(u?.id || ''),
    DB.prepare(`SELECT * FROM (SELECT p.contest_id, p.player_id, p.status, u.handle, ROW_NUMBER() OVER (PARTITION BY p.contest_id ORDER BY p.started_at DESC) n
      FROM plays p JOIN players pl ON pl.id = p.player_id LEFT JOIN users u ON u.id = pl.user_id WHERE p.contest_id IN (${marks})) WHERE n <= 5`).bind(...ids),
    DB.prepare(`SELECT contest_id, COUNT(*) players FROM plays WHERE contest_id IN (${marks}) GROUP BY contest_id`).bind(...ids),
    DB.prepare(`SELECT w.contest_id, w.rank, w.prize_title, p.tries, p.ms, p.player_id, u.handle FROM contest_winners w JOIN plays p ON p.id = w.play_id JOIN players pl ON pl.id = w.player_id
      LEFT JOIN users u ON u.id = pl.user_id WHERE w.contest_id IN (${marks}) ORDER BY w.rank`).bind(...ids),
  ]);
  const liked = new Set(likes.results.map((r) => r.contest_id)), followed = new Set(follows.results.map((r) => r.company_id)), joined = await mailingCompanies(c);
  return rows.map((k) => {
    const closed = isClosed(k), s = json(k.settings), brand = json(k.brand);
    return {
      id: k.id, title: k.title, type: k.type, status: closed ? 'ended' : k.status, closed, featured: !!k.featured, ends_at: k.ends_at, starts_at: k.starts_at,
      tries: s.tries || 6, time: s.time || null, prize: k.prize_summary, contact_fields: json(k.contact_fields, []), consent_text: k.consent_text,
      leaderboard: hasBoard(k),
      company: { id: k.company_id, name: k.company, slug: k.company_slug, color: brand.colors?.primary || '#D0BCFF', logo: k.logo_key ? '/files/' + k.logo_key : null, followed: followed.has(k.company_id), mailing_joined: joined.has(k.company_id), mailing_left: !!joined.left?.has(k.company_id) },
      counts: { views: k.views || 0, plays: k.plays || 0, wins: k.wins || 0, likes: k.likes || 0, comments: k.comments || 0, shares: k.shares || 0, players: counts.results.find((r) => r.contest_id === k.id)?.players || 0 },
      liked: liked.has(k.id), play: `/play/${k.id}`, poster: posterOf(k.template_id),
      participants: people.results.filter((r) => r.contest_id === k.id).map((r) => ({ name: shown(r), status: r.status })),
      winners: winners.results.filter((r) => r.contest_id === k.id).map((r) => ({ rank: r.rank, name: shown(r), tries: r.tries, ms: r.ms, prize: r.prize_title })),
    };
  });
}
const CARD_SQL = `SELECT k.*, co.name company, co.slug company_slug, co.brand, a.r2_key logo_key, cc.views, cc.plays, cc.wins, cc.likes, cc.comments, cc.shares, b.template_id
  FROM contests k JOIN companies co ON co.id = k.company_id LEFT JOIN contest_counters cc ON cc.contest_id = k.id
  LEFT JOIN contest_builds b ON b.id = k.current_build_id LEFT JOIN assets a ON a.id = co.logo_asset_id`;

app.get('/api/feed', async (c) => {
  const t = now(), tab = c.req.query('tab'), u = user(c);
  let where = `k.deleted_at IS NULL AND k.visibility = 'public' AND co.status = 'active' AND (k.status = 'live' OR (k.status = 'ended' AND k.closed_at > ?))`;
  const args = [t - 3 * DAY];
  if (tab === 'following') { if (!u) return c.json({ items: [] }); where += ' AND k.company_id IN (SELECT company_id FROM follows WHERE user_id = ?)'; args.push(u.id); }
  const rows = (await c.env.DB.prepare(`${CARD_SQL} WHERE ${where}
    ORDER BY (k.status = 'live' AND (k.ends_at IS NULL OR k.ends_at > ?)) DESC, k.featured DESC, k.published_at DESC LIMIT 40`).bind(...args, t).all()).results;
  c.executionCtx.waitUntil(closeDue(c.env));
  return c.json({ items: await cards(c, rows) });
});

app.get('/api/contests/:id', async (c) => {
  const k = await c.env.DB.prepare(`${CARD_SQL} WHERE k.id = ? AND k.deleted_at IS NULL`).bind(c.req.param('id')).first();
  if (!k || (k.status === 'draft' && !(user(c) && (user(c).role === 'admin' || await memberRole(c.env.DB, k.company_id, user(c).id))))) return fail(c, 404, 'no such contest');
  if (k.status === 'removed') return fail(c, 410, 'this contest was removed');
  return c.json({ item: (await cards(c, [k]))[0] });
});

// the game page: the stored page, told where to send guesses
app.get('/play/:id', async (c) => {
  const id = c.req.param('id');
  const k = await c.env.DB.prepare('SELECT k.status, k.company_id, b.page_key FROM contests k JOIN contest_builds b ON b.id = k.current_build_id WHERE k.id = ? AND k.deleted_at IS NULL').bind(id).first();
  if (!k || k.status === 'removed') return c.text('This game is not available.', 404);
  if (k.status === 'draft' && !(user(c) && (user(c).role === 'admin' || await memberRole(c.env.DB, k.company_id, user(c).id)))) return c.text('This game is not published yet.', 404);
  const o = await c.env.BUCKET.get(k.page_key);
  if (!o) return c.text('This game is missing.', 404);
  const html = (await o.text()).replace('<head>', `<head><script>window.GAME_API=${JSON.stringify(`/api/contests/${id}/play`)};</script>`);
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'SAMEORIGIN' } });
});

// ---------- play: every guess is scored here ----------
function score(guess, word) {
  const out = Array(5).fill('absent'), left = {};
  for (let i = 0; i < 5; i++) guess[i] === word[i] ? (out[i] = 'correct') : (left[word[i]] = (left[word[i]] || 0) + 1);
  for (let i = 0; i < 5; i++) if (out[i] !== 'correct' && left[guess[i]]) { out[i] = 'present'; left[guess[i]]--; }
  return out;
}
async function playCtx(c) {
  const id = c.req.param('id'), DB = c.env.DB;
  const k = await DB.prepare('SELECT k.*, s.secrets FROM contests k JOIN contest_secrets s ON s.contest_id = k.id WHERE k.id = ? AND k.deleted_at IS NULL').bind(id).first();
  if (!k || !['live', 'ended'].includes(k.status)) throw new HttpError(404, 'this contest is not open');
  if (k.status === 'live' && k.ends_at && k.ends_at <= now()) { await closeContest(c.env, k.id); k.status = 'ended'; }
  const p = await player(c);
  const play = await DB.prepare('SELECT * FROM plays WHERE contest_id = ? AND player_id = ?').bind(id, p.id).first();
  const sec = json(k.secrets);
  return { k, p, play, word: sec.word, quiz: sec.questions, s: json(k.settings) };
}

// ---------- trivia: questions held here, the options shuffled the same way for everyone ----------
function checkQuiz(list) {
  if (!Array.isArray(list) || list.length < 3 || list.length > 20) return 'write 3 to 20 questions';
  const out = [];
  for (const [i, x] of list.entries()) {
    const q = String(x?.q || '').trim(), options = (Array.isArray(x?.options) ? x.options : []).map((o) => String(o || '').trim()).filter(Boolean);
    if (!q || q.length > 140) return `question ${i + 1} needs words, at most 140 letters`;
    if (options.length < 2 || options.length > 4) return `question ${i + 1} needs the right answer and 1 to 3 wrong ones`;
    if (options.some((o) => o.length > 60)) return `question ${i + 1}: answers are at most 60 letters`;
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return `question ${i + 1} has the same answer twice`;
    if (/[|;]/.test(q + options.join(''))) return `question ${i + 1}: leave out | and ;`;
    out.push({ q, options });
  }
  return out;
}
const orderOf = (kid, n, len) => {                 // the shuffled order of question n's options
  let h = 7; for (const ch of `${kid}:${n}`) h = (h * 31 + ch.charCodeAt(0)) % 2147483646;
  let seed = h + 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const a = [...Array(len).keys()]; for (let i = len - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const quizFor = (k, quiz) => quiz.map((x, n) => ({ q: x.q, options: orderOf(k.id, n, x.options.length).map((i) => x.options[i]) }));
const rightOf = (k, quiz, n) => orderOf(k.id, n, quiz[n].options.length).indexOf(0);
const triviaMoves = async (DB, play) => play ? (await DB.prepare('SELECT n, move, result FROM play_moves WHERE play_id = ? ORDER BY n').bind(play.id).all()).results.map((m) => ({ n: m.n - 1, pick: +m.move, right: json(m.result).right, ok: json(m.result).ok })) : [];
// a finished trivia play: tries holds how many were right; rank is most right, then fastest
async function finishTrivia(c, k, play, quiz, ms, timedOut) {
  const DB = c.env.DB, t = now(), moves = await triviaMoves(DB, play), right = moves.filter((m) => m.ok).length;
  const status = right > 0 ? 'won' : timedOut ? 'timeout' : 'lost';
  const q = [DB.prepare('UPDATE plays SET tries = ?, status = ?, ms = ?, score = ?, finished_at = ? WHERE id = ? AND status = ?')
    .bind(right, status, ms, status === 'won' ? (quiz.length - right) * 10_000_000 + Math.min(ms, 9_999_999) : null, t, play.id, 'playing')];
  if (status === 'won') q.push(DB.prepare('UPDATE contest_counters SET wins = wins + 1, updated_at = ? WHERE contest_id = ?').bind(t, k.id));
  await DB.batch(q);
  return status;
}
const movesOf = async (DB, play) => play ? (await DB.prepare('SELECT move guess, result FROM play_moves WHERE play_id = ? ORDER BY n').bind(play.id).all()).results.map((m) => ({ guess: m.guess, result: json(m.result) })) : [];

app.post('/api/contests/:id/play/start', async (c) => {
  const DB = c.env.DB, ctx = await playCtx(c), { k, p, word, quiz } = ctx, t = now();
  let play = ctx.play;
  const movesFor = (pl) => quiz ? triviaMoves(DB, pl) : movesOf(DB, pl), extra = quiz ? { questions: quizFor(k, quiz) } : {};
  if (k.status === 'ended') return c.json({ closed: true, moves: await movesFor(play), status: play?.status || null, ...(quiz ? extra : { answer: word }) });
  if (!play) {
    play = { id: uid('pl'), status: 'playing', started_at: t };
    await DB.batch([
      DB.prepare("INSERT INTO plays (id, contest_id, player_id, build_id, status, started_at, source) VALUES (?, ?, ?, ?, 'playing', ?, ?)").bind(play.id, k.id, p.id, k.current_build_id, t, (c.req.query('src') || 'feed').slice(0, 10)),
      DB.prepare('UPDATE contest_counters SET plays = plays + 1, updated_at = ? WHERE contest_id = ?').bind(t, k.id),
      DB.prepare('UPDATE company_counters SET plays = plays + 1, plays_this_period = plays_this_period + 1, updated_at = ? WHERE company_id = ?').bind(t, k.company_id),
    ]);
  }
  const done = play.status !== 'playing';
  return c.json({ play: play.id, status: play.status, moves: await movesFor(play), ms: done ? play.ms : t - play.started_at, ...extra, ...(!quiz && done && play.status !== 'won' ? { answer: word } : {}) });
});

app.post('/api/contests/:id/play/guess', async (c) => {
  const DB = c.env.DB, ctx = await playCtx(c), { k, play, word, s } = ctx, t = now();
  if (k.status === 'ended') return fail(c, 409, 'this contest has closed', 'closed');
  if (!play) return fail(c, 400, 'start the game first');
  if (play.status !== 'playing') return fail(c, 409, 'this game is over', 'over');
  const body = await c.req.json().catch(() => ({}));
  if (ctx.quiz) {
    const quiz = ctx.quiz, n = parseInt(body.n), pick = parseInt(body.pick), ms = t - play.started_at;
    if (n !== play.tries) return fail(c, 409, 'answer the questions in order', 'order');
    if (!(n >= 0 && n < quiz.length) || !(pick >= 0 && pick < quiz[n].options.length)) return fail(c, 400, 'pick one of the answers');
    if (s.time && ms > s.time * 1000 + 3000) return c.json({ status: 'timeout', final: await finishTrivia(c, k, play, quiz, s.time * 1000, true), right: null });
    const right = rightOf(k, quiz, n), ok = pick === right;
    const r = await DB.batch([
      DB.prepare('UPDATE plays SET tries = ? WHERE id = ? AND tries = ?').bind(n + 1, play.id, n),
      DB.prepare('INSERT INTO play_moves (play_id, n, move, result, at_ms) SELECT ?, ?, ?, ?, ? WHERE changes() = 1').bind(play.id, n + 1, String(pick), JSON.stringify({ right, ok }), ms),
    ]);
    if (!r[0].meta.changes) return fail(c, 409, 'answer the questions in order', 'order');
    const status = n + 1 >= quiz.length ? await finishTrivia(c, k, play, quiz, ms, false) : 'playing';
    return c.json({ right, correct: ok, status, n });
  }
  const guess = String(body.guess || '').toLowerCase();
  if (!/^[a-z]{5}$/.test(guess)) return fail(c, 400, 'five letters', 'not_a_word');
  if (!WORDS.has(guess) && guess !== word) return fail(c, 400, 'not in word list', 'not_a_word');
  const ms = t - play.started_at, max = s.tries || 6;
  if (s.time && ms > s.time * 1000 + 3000) {
    await DB.prepare("UPDATE plays SET status = 'timeout', ms = ?, finished_at = ? WHERE id = ? AND status = 'playing'").bind(s.time * 1000, t, play.id).run();
    return c.json({ result: null, status: 'timeout', answer: word });
  }
  const n = play.tries + 1, result = score(guess, word);
  const status = guess === word ? 'won' : n >= max ? 'lost' : 'playing';
  const q = [
    DB.prepare('INSERT INTO play_moves (play_id, n, move, result, at_ms) VALUES (?, ?, ?, ?, ?)').bind(play.id, n, guess, JSON.stringify(result), ms),
    DB.prepare('UPDATE plays SET tries = ?, status = ?, ms = ?, score = ?, finished_at = ? WHERE id = ? AND tries = ?')
      .bind(n, status, status === 'playing' ? null : ms, status === 'won' ? n * 10_000_000 + Math.min(ms, 9_999_999) : null, status === 'playing' ? null : t, play.id, play.tries),
  ];
  if (status === 'won') q.push(DB.prepare('UPDATE contest_counters SET wins = wins + 1, updated_at = ? WHERE contest_id = ?').bind(t, k.id));
  await DB.batch(q);
  return c.json({ result, status, tries: n, ...(status === 'lost' ? { answer: word } : {}) });
});

app.post('/api/contests/:id/play/timeout', async (c) => {
  const DB = c.env.DB, { k, play, word, quiz, s } = await playCtx(c), t = now();
  if (!play || play.status !== 'playing' || !s.time) return c.json({ status: play?.status || null });
  if (t - play.started_at < s.time * 1000 - 2000) return fail(c, 400, 'there is still time');
  if (quiz) return c.json({ status: await finishTrivia(c, k, play, quiz, s.time * 1000, true) });
  await DB.prepare("UPDATE plays SET status = 'timeout', ms = ?, finished_at = ? WHERE id = ? AND status = 'playing'").bind(s.time * 1000, t, play.id).run();
  return c.json({ status: 'timeout', answer: word });
});

// ---------- leaderboard and participants ----------
app.get('/api/contests/:id/leaderboard', async (c) => {
  const id = c.req.param('id'), DB = c.env.DB;
  const k = await DB.prepare('SELECT * FROM contests WHERE id = ?').bind(id).first();
  if (!k) return fail(c, 404, 'no such contest');
  const rows = (await DB.prepare(`SELECT p.player_id, p.tries, p.ms, p.score, p.finished_at, u.handle FROM plays p JOIN players pl ON pl.id = p.player_id LEFT JOIN users u ON u.id = pl.user_id
    WHERE p.contest_id = ? AND p.status = 'won' AND p.flagged = 0 ORDER BY p.score, p.finished_at LIMIT 100`).bind(id).all()).results;
  const p = await player(c);
  const mine = await DB.prepare('SELECT * FROM plays WHERE contest_id = ? AND player_id = ?').bind(id, p.id).first();
  let me = null;
  if (mine) {
    me = { status: mine.status, tries: mine.tries, ms: mine.ms, rank: null };
    if (mine.status === 'won') me.rank = (await DB.prepare("SELECT COUNT(*) n FROM plays WHERE contest_id = ? AND status = 'won' AND flagged = 0 AND (score < ? OR (score = ? AND finished_at < ?))").bind(id, mine.score, mine.score, mine.finished_at).first()).n + 1;
  }
  const totals = await DB.prepare("SELECT COUNT(*) players, SUM(status = 'won') winners FROM plays WHERE contest_id = ?").bind(id).first();
  const winners = (await DB.prepare(`SELECT w.rank, w.prize_title prize, p.tries, p.ms, w.player_id, u.handle FROM contest_winners w JOIN plays p ON p.id = w.play_id JOIN players pl ON pl.id = w.player_id
    LEFT JOIN users u ON u.id = pl.user_id WHERE w.contest_id = ? ORDER BY w.rank`).bind(id).all()).results;
  return c.json({ closed: isClosed(k), ends_at: k.ends_at, leaderboard: hasBoard(k), totals: { players: totals.players || 0, winners: totals.winners || 0 }, me,
    rows: rows.map((r, i) => ({ rank: i + 1, name: shown(r), tries: r.tries, ms: r.ms, you: r.player_id === p.id })),
    winners: winners.map((w) => ({ rank: w.rank, name: shown(w), tries: w.tries, ms: w.ms, prize: w.prize, you: w.player_id === p.id })) });
});

app.get('/api/contests/:id/players', async (c) => {
  const id = c.req.param('id');
  const rows = (await c.env.DB.prepare(`SELECT p.player_id, p.status, p.tries, p.started_at, u.handle FROM plays p JOIN players pl ON pl.id = p.player_id LEFT JOIN users u ON u.id = pl.user_id
    WHERE p.contest_id = ? ORDER BY p.started_at DESC LIMIT 200`).bind(id).all()).results;
  const total = (await c.env.DB.prepare('SELECT COUNT(*) n FROM plays WHERE contest_id = ?').bind(id).first()).n;
  return c.json({ total, players: rows.map((r) => ({ name: shown(r), status: r.status, tries: r.tries, at: r.started_at })) });
});

// ---------- closing: winners are written once ----------
async function closeContest(env, id) {
  const DB = env.DB, t = now();
  const k = await DB.prepare('SELECT * FROM contests WHERE id = ?').bind(id).first();
  if (!k || k.status === 'ended') return;
  const r = await DB.prepare("UPDATE contests SET status = 'ended', closed_at = ?, updated_at = ? WHERE id = ? AND status = 'live'").bind(t, t, id).run();
  if (!r.meta.changes || !hasBoard(k)) return;
  const prizes = (await DB.prepare('SELECT * FROM contest_prizes WHERE contest_id = ? ORDER BY rank_from').bind(id).all()).results;
  const N = Math.max(1, ...prizes.map((p) => p.rank_to));
  const top = (await DB.prepare("SELECT id, player_id FROM plays WHERE contest_id = ? AND status = 'won' AND flagged = 0 ORDER BY score, finished_at LIMIT ?").bind(id, N).all()).results;
  if (top.length) await DB.batch(top.map((p, i) => DB.prepare('INSERT OR IGNORE INTO contest_winners (contest_id, rank, play_id, player_id, prize_title, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, i + 1, p.id, p.player_id, prizes.find((z) => z.rank_from <= i + 1 && z.rank_to >= i + 1)?.title || null, t)));
}
async function closeDue(env) {
  const t = now();
  await env.DB.prepare("UPDATE contests SET status = 'live', updated_at = ? WHERE status = 'scheduled' AND starts_at <= ?").bind(t, t).run();
  const due = (await env.DB.prepare("SELECT id FROM contests WHERE status = 'live' AND ends_at IS NOT NULL AND ends_at <= ? LIMIT 50").bind(t).all()).results;
  for (const d of due) await closeContest(env, d.id);
}

// ---------- social ----------
app.post('/api/contests/:id/like', async (c) => {
  const u = needUser(c), id = c.req.param('id'), DB = c.env.DB, t = now();
  const had = await DB.prepare('SELECT 1 FROM likes WHERE contest_id = ? AND user_id = ?').bind(id, u.id).first();
  await DB.batch(had
    ? [DB.prepare('DELETE FROM likes WHERE contest_id = ? AND user_id = ?').bind(id, u.id), DB.prepare('UPDATE contest_counters SET likes = MAX(0, likes - 1), updated_at = ? WHERE contest_id = ?').bind(t, id)]
    : [DB.prepare('INSERT INTO likes (contest_id, user_id, created_at) VALUES (?, ?, ?)').bind(id, u.id, t), DB.prepare('UPDATE contest_counters SET likes = likes + 1, updated_at = ? WHERE contest_id = ?').bind(t, id)]);
  return c.json({ liked: !had });
});
app.post('/api/companies/:id/follow', async (c) => {
  const u = needUser(c), id = c.req.param('id'), DB = c.env.DB;
  const had = await DB.prepare('SELECT 1 FROM follows WHERE company_id = ? AND user_id = ?').bind(id, u.id).first();
  await (had ? DB.prepare('DELETE FROM follows WHERE company_id = ? AND user_id = ?').bind(id, u.id) : DB.prepare('INSERT INTO follows (user_id, company_id, created_at) VALUES (?, ?, ?)').bind(u.id, id, now())).run();
  return c.json({ following: !had });
});
app.post('/api/contests/:id/:what{view|share}', async (c) => {
  const col = c.req.param('what') === 'view' ? 'views' : 'shares';
  await c.env.DB.prepare(`UPDATE contest_counters SET ${col} = ${col} + 1, updated_at = ? WHERE contest_id = ?`).bind(now(), c.req.param('id')).run();
  return c.json({ ok: true });
});
app.get('/api/contests/:id/comments', async (c) => {
  const rows = (await c.env.DB.prepare(`SELECT cm.id, cm.body, cm.created_at, u.handle, u.id user_id FROM comments cm JOIN users u ON u.id = cm.user_id
    WHERE cm.contest_id = ? AND cm.status = 'visible' ORDER BY cm.created_at DESC LIMIT 100`).bind(c.req.param('id')).all()).results;
  return c.json({ comments: rows.map((r) => ({ id: r.id, body: r.body, at: r.created_at, name: '@' + r.handle })) });
});
app.post('/api/contests/:id/comments', async (c) => {
  const u = needUser(c), id = c.req.param('id'), DB = c.env.DB, t = now();
  const body = String((await c.req.json().catch(() => ({}))).body || '').trim();
  if (!body || body.length > 500) return fail(c, 400, 'comments are 1 to 500 characters');
  const cid = uid('cm');
  await DB.batch([DB.prepare('INSERT INTO comments (id, contest_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(cid, id, u.id, body, t),
    DB.prepare('UPDATE contest_counters SET comments = comments + 1, updated_at = ? WHERE contest_id = ?').bind(t, id)]);
  return c.json({ id: cid, body, at: t, name: '@' + u.handle });
});

// contacts, after a game. Entering the draw and joining the sponsor's mailing list are two separate choices, stored with the exact words agreed to
const entryWords = (co, prize) => `Enter me in the draw. ${co} can use my details to contact me about ${prize ? 'the prize' : 'this contest'}.`;
const mailWords = (co) => `Add me to the ${co} mailing list. I can unsubscribe any time.`;
app.post('/api/contests/:id/entry', async (c) => {
  const id = c.req.param('id'), DB = c.env.DB, t = now();
  const k = await DB.prepare('SELECT k.*, co.name company FROM contests k JOIN companies co ON co.id = k.company_id WHERE k.id = ?').bind(id).first();
  if (!k) return fail(c, 404, 'no such contest');
  const b = await c.req.json().catch(() => ({}));
  const draw = b.consent === true, mail = b.mailing === true;
  if (!draw && !mail) return fail(c, 400, 'tick a box to continue');
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(c, 400, 'that does not look like an email address');
  const p = await player(c), play = await DB.prepare('SELECT id FROM plays WHERE contest_id = ? AND player_id = ?').bind(id, p.id).first();
  const had = await DB.prepare('SELECT 1 FROM entries WHERE contest_id = ? AND player_id = ?').bind(id, p.id).first();
  const words = [draw && entryWords(k.company, k.prize_summary), mail && mailWords(k.company)].filter(Boolean).join(' ');
  await DB.prepare(`INSERT INTO entries (id, contest_id, company_id, player_id, play_id, email, name, phone, consent, consent_text, mailing_opt_in, mailing_opt_in_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (contest_id, player_id) DO UPDATE SET email = excluded.email, name = excluded.name, phone = excluded.phone, consent = excluded.consent, consent_text = excluded.consent_text,
      mailing_opt_in = excluded.mailing_opt_in, mailing_opt_in_at = CASE WHEN excluded.mailing_opt_in = 1 THEN COALESCE(entries.mailing_opt_in_at, excluded.mailing_opt_in_at) END,
      mailing_unsubscribed_at = CASE WHEN excluded.mailing_opt_in = 1 THEN NULL ELSE entries.mailing_unsubscribed_at END`)
    .bind(uid('e'), id, k.company_id, p.id, play?.id || null, email, String(b.name || '').slice(0, 80) || null, String(b.phone || '').slice(0, 30) || null, draw ? 1 : 0, words, mail ? 1 : 0, mail ? t : null, t).run();
  if (!had) await DB.batch([DB.prepare('UPDATE contest_counters SET entries = entries + 1, updated_at = ? WHERE contest_id = ?').bind(t, id),
    DB.prepare('UPDATE company_counters SET entries = entries + 1, updated_at = ? WHERE company_id = ?').bind(t, k.company_id)]);
  return c.json({ ok: true });
});

// a player's own mailing lists, for the profile page
app.get('/api/me/mailing', async (c) => {
  const u = needUser(c), DB = c.env.DB;
  const pid = (await DB.prepare('SELECT id FROM players WHERE user_id = ?').bind(u.id).first())?.id || '';
  const lists = (await DB.prepare(`SELECT e.company_id, co.name company, MIN(e.mailing_opt_in_at) joined_at FROM entries e JOIN companies co ON co.id = e.company_id
    WHERE e.mailing_opt_in = 1 AND e.mailing_unsubscribed_at IS NULL AND e.withdrawn_at IS NULL AND (e.player_id = ? OR e.email = ?)
    GROUP BY e.company_id ORDER BY joined_at DESC`).bind(pid, u.email).all()).results;
  return c.json({ lists });
});
// a player leaves a sponsor's mailing list: the opt-in is cleared and the time kept
app.post('/api/mailing/unsubscribe', async (c) => {
  const u = needUser(c), DB = c.env.DB, t = now(), b = await c.req.json().catch(() => ({}));
  const co = String(b.company_id || '');
  if (!co) return fail(c, 400, 'unsubscribe from which company?');
  const pid = (await DB.prepare('SELECT id FROM players WHERE user_id = ?').bind(u.id).first())?.id || '';
  const r = await DB.prepare(`UPDATE entries SET mailing_opt_in = 0, mailing_unsubscribed_at = ? WHERE company_id = ? AND mailing_opt_in = 1 AND (player_id = ? OR email = ?)`)
    .bind(t, co, pid, u.email).run();
  return c.json({ ok: true, removed: r.meta?.changes || 0 });
});

// a player reports a game: each player reports a game once; guests can report too
app.post('/api/contests/:id/report', async (c) => {
  const id = c.req.param('id'), DB = c.env.DB, t = now(), b = await c.req.json().catch(() => ({}));
  const k = await DB.prepare('SELECT id FROM contests WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!k) return fail(c, 404, 'no such contest');
  const reason = { offensive: 'offensive', misleading: 'scam', spam: 'spam', other: 'other' }[b.reason] || 'other';
  const p = await player(c), u = user(c);
  await DB.prepare('INSERT OR IGNORE INTO reports (id, target_type, target_id, reporter_id, player_id, reason, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(uid('r'), 'contest', id, u?.id || null, p.id, reason, String(b.note || '').trim().slice(0, 500) || null, t).run();
  return c.json({ ok: true });
});

app.post('/api/reports', async (c) => {
  const u = needUser(c), b = await c.req.json().catch(() => ({}));
  if (!['contest', 'comment', 'company', 'user'].includes(b.target_type) || !b.target_id) return fail(c, 400, 'report what?');
  const reason = ['spam', 'scam', 'offensive', 'copyright', 'other'].includes(b.reason) ? b.reason : 'other';
  await c.env.DB.prepare('INSERT INTO reports (id, target_type, target_id, reporter_id, reason, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(uid('r'), b.target_type, String(b.target_id), u.id, reason, String(b.note || '').slice(0, 500) || null, now()).run();
  return c.json({ ok: true });
});

// ---------- admin ----------
app.get('/api/admin/overview', async (c) => {
  needAdmin(c); const DB = c.env.DB, t = now();
  const [u, co, k, pl, rp] = await DB.batch([
    DB.prepare('SELECT COUNT(*) n, SUM(created_at > ?) week FROM users WHERE deleted_at IS NULL').bind(t - 7 * DAY),
    DB.prepare("SELECT COUNT(*) n, SUM(status = 'suspended') suspended FROM companies WHERE deleted_at IS NULL"),
    DB.prepare('SELECT status, COUNT(*) n FROM contests WHERE deleted_at IS NULL GROUP BY status'),
    DB.prepare("SELECT COUNT(*) n, SUM(started_at > ?) today, SUM(status = 'won') wins FROM plays").bind(t - DAY),
    DB.prepare("SELECT COUNT(*) n FROM reports WHERE status = 'open'"),
  ]);
  return c.json({ users: u.results[0], companies: co.results[0], contests: Object.fromEntries(k.results.map((r) => [r.status, r.n])), plays: pl.results[0], reports: rp.results[0].n });
});
app.get('/api/admin/contests', async (c) => {
  needAdmin(c);
  const rows = (await c.env.DB.prepare(`SELECT k.id, k.title, k.type, k.status, k.featured, k.ends_at, k.created_at, co.name company, cc.plays, cc.entries
    FROM contests k JOIN companies co ON co.id = k.company_id LEFT JOIN contest_counters cc ON cc.contest_id = k.id WHERE k.deleted_at IS NULL ORDER BY k.created_at DESC LIMIT 200`).all()).results;
  return c.json({ contests: rows.map((k) => ({ ...k, status: isClosed(k) ? 'ended' : k.status })) });
});
app.post('/api/admin/contests/:id', async (c) => {
  needAdmin(c); const id = c.req.param('id'), b = await c.req.json().catch(() => ({})), t = now();
  if (b.action === 'end') await closeContest(c.env, id);
  else if (b.action === 'remove') await c.env.DB.prepare("UPDATE contests SET status = 'removed', updated_at = ? WHERE id = ?").bind(t, id).run();
  else if (b.action === 'restore') await c.env.DB.prepare("UPDATE contests SET status = 'live', updated_at = ? WHERE id = ? AND status = 'removed'").bind(t, id).run();
  else if (b.action === 'feature' || b.action === 'unfeature') await c.env.DB.prepare('UPDATE contests SET featured = ?, updated_at = ? WHERE id = ?').bind(b.action === 'feature' ? 1 : 0, t, id).run();
  else return fail(c, 400, 'actions: end, remove, restore, feature, unfeature');
  return c.json({ ok: true });
});
app.get('/api/admin/users', async (c) => {
  needAdmin(c); const q = '%' + (c.req.query('q') || '') + '%';
  const rows = (await c.env.DB.prepare('SELECT id, email, handle, role, created_at FROM users WHERE deleted_at IS NULL AND (email LIKE ? OR handle LIKE ?) ORDER BY created_at DESC LIMIT 200').bind(q, q).all()).results;
  return c.json({ users: rows });
});
app.post('/api/admin/users/:id', async (c) => {
  const me = needAdmin(c), b = await c.req.json().catch(() => ({}));
  if (!['user', 'staff', 'admin'].includes(b.role)) return fail(c, 400, 'roles: user, staff, admin');
  if (c.req.param('id') === me.id && b.role !== 'admin') return fail(c, 400, 'you cannot remove your own admin role');
  await c.env.DB.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').bind(b.role, now(), c.req.param('id')).run();
  return c.json({ ok: true });
});
app.get('/api/admin/companies', async (c) => {
  needAdmin(c);
  const rows = (await c.env.DB.prepare(`SELECT co.id, co.name, co.slug, co.status, co.created_at, s.plan_id, (SELECT COUNT(*) FROM contests WHERE company_id = co.id) contests
    FROM companies co LEFT JOIN subscriptions s ON s.company_id = co.id WHERE co.deleted_at IS NULL ORDER BY co.created_at DESC LIMIT 200`).all()).results;
  return c.json({ companies: rows });
});
app.post('/api/admin/companies/:id', async (c) => {
  needAdmin(c); const b = await c.req.json().catch(() => ({})), t = now(), id = c.req.param('id');
  if (['active', 'suspended'].includes(b.status)) await c.env.DB.prepare('UPDATE companies SET status = ?, updated_at = ? WHERE id = ?').bind(b.status, t, id).run();
  if (['free', 'pro', 'business'].includes(b.plan)) await c.env.DB.prepare("UPDATE subscriptions SET plan_id = ?, provider = 'manual', updated_at = ? WHERE company_id = ?").bind(b.plan, t, id).run();
  return c.json({ ok: true });
});
app.get('/api/admin/reports', async (c) => {
  needAdmin(c);
  const rows = (await c.env.DB.prepare(`SELECT r.*, u.handle reporter FROM reports r LEFT JOIN users u ON u.id = r.reporter_id ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT 200`).all()).results;
  return c.json({ reports: rows });
});
app.post('/api/admin/reports/:id', async (c) => {
  const me = needAdmin(c), b = await c.req.json().catch(() => ({})), DB = c.env.DB, t = now();
  const r = await DB.prepare('SELECT * FROM reports WHERE id = ?').bind(c.req.param('id')).first();
  if (!r) return fail(c, 404, 'no such report');
  if (b.action === 'hide' && r.target_type === 'comment') await DB.prepare("UPDATE comments SET status = 'hidden' WHERE id = ?").bind(r.target_id).run();
  if (b.action === 'hide' && r.target_type === 'contest') await DB.prepare("UPDATE contests SET status = 'removed', updated_at = ? WHERE id = ?").bind(t, r.target_id).run();
  await DB.prepare('UPDATE reports SET status = ?, handled_by = ?, handled_at = ? WHERE id = ?').bind(b.action === 'dismiss' ? 'dismissed' : 'actioned', me.id, t, r.id).run();
  return c.json({ ok: true });
});

// Gorilla Squad: offers, interests, relationships, deliveries and messages (see src/squad-routes.js)
squadRoutes(app, { needUser, needAdmin, fail, uid, now, json, HttpError });

app.all('/api/*', (c) => fail(c, 404, 'no such endpoint'));

export default {
  fetch: app.fetch,
  scheduled: (event, env, ctx) => ctx.waitUntil(closeDue(env)),
};
