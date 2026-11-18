// Gorilla Squad end to end, against a running dev Worker (npm run dev, then node test/squad.mjs).
//   BASE=http://127.0.0.1:8787 node test/squad.mjs
// The admin is admin@thebes.local (ADMIN_EMAILS in the local config). Local mode returns sign-in links instead of emailing them.
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { cond ? pass++ : fail++; console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : '  ' + info}`); };
const TAG = Date.now().toString(36);

function person() {
  const jar = new Map();
  const req = async (p, opts = {}) => {
    const r = await fetch(BASE + p, {
      redirect: 'manual', ...opts,
      headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(opts.body && typeof opts.body === 'string' ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) },
    });
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const [k, ...v] = kv.split('='); v.join('=') ? jar.set(k.trim(), v.join('=')) : jar.delete(k.trim()); }
    return r;
  };
  const j = async (p, opts) => { const r = await req(p, opts); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  return { req, j, get: (p) => j(p), post: (p, b) => j(p, { method: 'POST', body: JSON.stringify(b || {}) }), patch: (p, b) => j(p, { method: 'PATCH', body: JSON.stringify(b || {}) }) };
}
async function signIn(who, email) {
  const s = await who.post('/api/auth/start', { email });
  const link = new URL(s.body.link);
  const r = await who.req(link.pathname + link.search);
  return r.status === 302;
}
const sql = (q) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'thebes', '--local', '--env', 'local', '--command', q], { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const ip = (n) => `10.20.${Math.floor(n / 250)}.${(n % 250) + 1}`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148 Safari/604.1';

const admin = person();
const seller = person();
const other = person();
const ama = person();   // a marketer in Lagos
const zed = person();   // a marketer in Zurich

ok('admin signs in', await signIn(admin, 'admin@thebes.local'));
ok('seller signs in', await signIn(seller, `seller-${TAG}@example.com`));
ok('other signs in', await signIn(other, `other-${TAG}@example.com`));
ok('marketer signs in', await signIn(ama, `ama-${TAG}@example.com`));
ok('zed signs in', await signIn(zed, `zed-${TAG}@example.com`));

// ---------- the seller and the campaign ----------
const co = await seller.post('/api/companies', { name: `Bread ${TAG}` });
ok('seller makes a business', co.status === 200 && co.body.id, JSON.stringify(co.body));
const cid = co.body.id;

const base = { company_id: cid, title: 'Morning loaf', product_url: 'https://shop.example/loaf', snippet: 'Fresh loaf, delivered by 9am. Order tonight.', reward_rule: 'click', reward_cents: 50, locations: ['NG:Lagos'] };
ok('a non-https product link is refused', (await seller.post('/api/squad/campaigns', { ...base, product_url: 'javascript:alert(1)' })).status === 400);
ok('a campaign needs a place to be shared', (await seller.post('/api/squad/campaigns', { ...base, locations: [] })).status === 400);
ok('reward must be a real amount', (await seller.post('/api/squad/campaigns', { ...base, reward_cents: 0 })).status === 400);
ok('reward rule must be one of the three', (await seller.post('/api/squad/campaigns', { ...base, reward_rule: 'lottery' })).status === 400);

const c1 = await seller.post('/api/squad/campaigns', base);
ok('seller creates a draft campaign', c1.status === 200 && c1.body.id, JSON.stringify(c1.body));
const CAMP = c1.body.id;

ok('an unfunded campaign cannot be sent for review', (await seller.post(`/api/squad/campaigns/${CAMP}/submit`)).status === 402);
ok('a draft is hidden from the board', !(await ama.get('/api/squad/board?scope=global')).body.campaigns.some((c) => c.id === CAMP));
ok('a stranger cannot see a draft', (await other.get(`/api/squad/campaigns/${CAMP}`)).status === 404);
ok('a stranger cannot fund it', (await other.post(`/api/admin/squad/campaigns/${CAMP}`, { action: 'fund', amount_cents: 1000 })).status === 403);

ok('admin funds $10', (await admin.post(`/api/admin/squad/campaigns/${CAMP}`, { action: 'fund', amount_cents: 1000, reference: 'BANK-1' })).status === 200);
ok('seller sends it for review', (await seller.post(`/api/squad/campaigns/${CAMP}/submit`)).body.status === 'review');
ok('a campaign in review is not on the board', !(await ama.get('/api/squad/board?scope=global')).body.campaigns.some((c) => c.id === CAMP));
ok('admin approves it live', (await admin.post(`/api/admin/squad/campaigns/${CAMP}`, { action: 'approve' })).status === 200);

// ---------- the board: local and global ----------
await ama.post('/api/me/profile', { city: 'Lagos', country: 'ng', phone: '+234 800 000 0001' });
await zed.post('/api/me/profile', { city: 'Zurich', country: 'CH', phone: '+41 79 000 00 02' });
const amaLocal = await ama.get('/api/squad/board?scope=local');
ok('a Lagos marketer sees the Lagos campaign locally', amaLocal.body.campaigns.some((c) => c.id === CAMP), JSON.stringify(amaLocal.body).slice(0, 200));
const zedLocal = await zed.get('/api/squad/board?scope=local');
ok('a Zurich marketer does not see it locally', !zedLocal.body.campaigns.some((c) => c.id === CAMP));
ok('a Zurich marketer sees it globally', (await zed.get('/api/squad/board?scope=global')).body.campaigns.some((c) => c.id === CAMP));
ok('the product link is hidden from marketers', !JSON.stringify(amaLocal.body).includes('shop.example'));
ok('a signed-out visitor gets no local list', (await person().get('/api/squad/board?scope=local')).body.campaigns.length === 0);

// ---------- a marketer's link and clicks ----------
const l1 = await ama.post(`/api/squad/campaigns/${CAMP}/link`);
ok('marketer gets a short link', l1.status === 200 && /\/s\/[a-z0-9]+$/i.test(l1.body.url), JSON.stringify(l1.body));
const l2 = await ama.post(`/api/squad/campaigns/${CAMP}/link`);
ok('asking again gives the same link', l2.body.code === l1.body.code);
const code = l1.body.code;

const click = async (n, ua = UA) => {
  const r = await fetch(`${BASE}/s/${code}`, { redirect: 'manual', headers: { 'user-agent': ua, 'cf-connecting-ip': ip(n) } });
  return r;
};
const r1 = await click(1);
ok('a click sends the shopper to the product', r1.status === 302 && (r1.headers.get('location') || '').startsWith('https://shop.example/loaf?gs_ref='), r1.headers.get('location'));
const w1 = await ama.get('/api/squad/wallet');
ok('a verified click is pending', w1.body.pending_cents === 50, JSON.stringify(w1.body));
await click(1);
const w2 = await ama.get('/api/squad/wallet');
ok('the same device again in 24h does not pay', w2.body.total_cents === 50, JSON.stringify(w2.body));
await click(2, 'Googlebot/2.1 (+http://www.google.com/bot.html)');
ok('a bot does not pay', (await ama.get('/api/squad/wallet')).body.total_cents === 50);
await click(3, '');
ok('no user agent does not pay', (await ama.get('/api/squad/wallet')).body.total_cents === 50);
ok('an unknown link is 404', (await fetch(`${BASE}/s/nope0000`, { redirect: 'manual' })).status === 404);

// the rest of the budget ($10 at 50 cents = 20 clicks)
for (let n = 10; n < 40; n++) await click(n);
const mine = (await seller.get('/api/squad/mine')).body.campaigns.find((c) => c.id === CAMP);
ok('the budget caps the clicks at 20 verified', mine?.stats?.verified === 20, JSON.stringify(mine?.stats));
ok('spend never goes past the budget', mine && mine.spent_cents <= mine.budget_cents, JSON.stringify(mine));
ok('an empty campaign leaves the board', !(await ama.get('/api/squad/board?scope=local')).body.campaigns.some((c) => c.id === CAMP));

// ---------- the wallet and payouts ----------
const pending = (await ama.get('/api/squad/wallet')).body;
ok('all the money is pending for a week', pending.pending_cents === 1000 && pending.available_cents === 0, JSON.stringify(pending));
ok('no payout from pending money', (await ama.post('/api/squad/payouts', { amount_cents: 1000, method: 'bank', account: '0123456789 Access' })).status === 402);
ok('the minimum payout is $10', (await ama.post('/api/squad/payouts', { amount_cents: 500, method: 'bank', account: '0123456789' })).status === 400);
sql(`UPDATE ledger SET created_at = created_at - ${8 * 86400000}`);
const cleared = (await ama.get('/api/squad/wallet')).body;
ok('after a week the money clears', cleared.available_cents === 1000 && cleared.pending_cents === 0, JSON.stringify(cleared));
const po = await ama.post('/api/squad/payouts', { amount_cents: 1000, method: 'bank', account: '0123456789 Access' });
ok('marketer requests a payout', po.status === 200 && po.body.status === 'requested', JSON.stringify(po.body));
ok('the request takes the money off the balance', (await ama.get('/api/squad/wallet')).body.available_cents === 0);
const queue = (await admin.get('/api/admin/squad')).body;
ok('admin sees the payout to send', queue.payouts.some((p) => p.id === po.body.id));
ok('admin pays it', (await admin.post(`/api/admin/squad/payouts/${po.body.id}`, { action: 'paid' })).status === 200);
ok('it cannot be paid twice', (await admin.post(`/api/admin/squad/payouts/${po.body.id}`, { action: 'paid' })).status === 409);

ok('a payout needs account details', (await ama.post('/api/squad/payouts', { amount_cents: 1000, method: 'bank', account: 'x' })).status === 400);

// ---------- sign-up campaigns: a postback from the seller's site ----------
const s2 = await seller.post('/api/squad/campaigns', { ...base, title: 'Sign up', reward_rule: 'signup', reward_cents: 300, locations: ['*'] });
const SIGN = s2.body.id;
await admin.post(`/api/admin/squad/campaigns/${SIGN}`, { action: 'fund', amount_cents: 1000 });
await seller.post(`/api/squad/campaigns/${SIGN}/submit`);
await admin.post(`/api/admin/squad/campaigns/${SIGN}`, { action: 'approve' });
const sKey = (await seller.get(`/api/squad/campaigns/${SIGN}`)).body.campaign.postback_key;
const sl = await zed.post(`/api/squad/campaigns/${SIGN}/link`);
const sr = await fetch(`${BASE}${new URL(sl.body.url).pathname}`, { redirect: 'manual', headers: { 'user-agent': UA, 'cf-connecting-ip': ip(200) } });
const gsRef = new URL(sr.headers.get('location')).searchParams.get('gs_ref');
ok('a sign-up click is recorded and pays nothing yet', !!gsRef && (await zed.get('/api/squad/wallet')).body.total_cents === 0);
ok('a postback with the wrong key is refused', (await fetch(`${BASE}/api/squad/postback?key=nope&ref=${gsRef}`)).status === 404);
const pb = await fetch(`${BASE}/api/squad/postback?key=${sKey}&ref=${gsRef}`);
ok('the seller reports the sign-up', pb.status === 200, String(pb.status));
ok('the marketer is paid for the sign-up', (await zed.get('/api/squad/wallet')).body.total_cents === 300);
const pb2 = await fetch(`${BASE}/api/squad/postback?key=${sKey}&ref=${gsRef}`);
ok('the same sign-up is only paid once', (await pb2.json()).duplicate === true && (await zed.get('/api/squad/wallet')).body.total_cents === 300);

// ---------- snippet campaigns: proof of a post ----------
const s3 = await seller.post('/api/squad/campaigns', { ...base, title: 'Post it', reward_rule: 'snippet', reward_cents: 200, locations: ['*'] });
const POST = s3.body.id;
await admin.post(`/api/admin/squad/campaigns/${POST}`, { action: 'fund', amount_cents: 1000 });
await seller.post(`/api/squad/campaigns/${POST}/submit`);
await admin.post(`/api/admin/squad/campaigns/${POST}`, { action: 'approve' });
const pl = await zed.post(`/api/squad/campaigns/${POST}/link`);
const pr = await zed.post(`/api/squad/links/${pl.body.code}/proof`, { post_url: 'https://social.example/p/123' });
ok('a marketer sends proof of a post', pr.status === 200 && pr.body.status === 'pending', JSON.stringify(pr.body));
ok('the same post cannot be sent twice', (await zed.post(`/api/squad/links/${pl.body.code}/proof`, { post_url: 'https://social.example/p/123' })).status === 409);
ok('someone else cannot send proof on your link', (await other.post(`/api/squad/links/${pl.body.code}/proof`, { post_url: 'https://social.example/p/999' })).status === 404);
const proofId = (await admin.get('/api/admin/squad')).body.proofs.find((p) => p.post_url === 'https://social.example/p/123')?.id;
ok('admin sees the post to check', !!proofId);
ok('admin pays the post', (await admin.post(`/api/admin/squad/proofs/${proofId}`, { decision: 'approve' })).status === 200);
ok('the post is paid into the wallet', (await zed.get('/api/squad/wallet')).body.total_cents === 300 + 200);

// ---------- access ----------
ok('a marketer cannot open the admin list', (await ama.get('/api/admin/squad')).status === 403);
ok('the wallet needs sign-in', (await person().get('/api/squad/wallet')).status === 401);
ok('another seller does not see the campaign in their list', !((await other.get('/api/squad/mine')).body.campaigns || []).some((c) => c.id === CAMP));
ok('a stranger cannot edit the campaign', (await other.patch(`/api/squad/campaigns/${CAMP}`, { title: 'Hacked title' })).status === 403);

// ---------- the marketer's dashboard ----------
const links = (await ama.get('/api/squad/me/links')).body.links;
const mine1 = links.find((l) => l.code === code);
ok('the dashboard shows verified and total clicks', mine1 && mine1.verified === 20 && mine1.total > mine1.verified, JSON.stringify(mine1));
ok('the dashboard shows what was earned', mine1 && mine1.earned === 1000, JSON.stringify(mine1));

// ---------- the home page and the app ----------
const home = await fetch(`${BASE}/`).then((r) => r.text());
ok('the home page is Gorilla Squad', home.includes('Gorilla Squad') && home.includes('Put your product in your customers'));
ok('the home page has the two sides', home.includes('Sell your work') && home.includes('Become a marketer'));
const app = await fetch(`${BASE}/app/`).then((r) => r.text());
ok('the app page loads the squad script', app.includes('/squad.js') && app.includes('/vendor/qrcode.js'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
