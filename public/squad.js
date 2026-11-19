// Gorilla Squad app: the board (marketers), links and wallet, the seller's campaigns, profile and admin.
// Plain modules, no build step (like the rest of the Worker's static files). Talks only to /api/squad/*, /api/me and /api/admin/squad.

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const campaigns = new Map();        // id -> campaign, from the last board load
let me = null;                      // { user, companies } or null when signed out
let scope = 'local';
let route = '';
let pollTimer = null;

// ---------- small helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (c) => '$' + (Number(c || 0) / 100).toFixed(2);
const dollarsToCents = (v) => Math.round(parseFloat(String(v || '').replace(/[^\d.]/g, '')) * 100) || 0;
const RULE = { click: 'per click', signup: 'per sign-up', snippet: 'per snippet' };
const rule = (r) => RULE[r] || r;
const day = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const ID_CHECK_CENTS = 5000;
const MIN_FUND = 1000;
const MIN_PAYOUT = 1000;
const STATUS = { draft: 'Draft', review: 'In review', live: 'Live', paused: 'Paused', ended: 'Ended' };
const where = (locs) => (locs || []).map((l) => {
  if (l === '*') return 'Everywhere';
  const [cc, city] = String(l).split(':');
  return city ? `${city}, ${cc}` : cc;
}).join(' · ') || 'Everywhere';

async function api(path, opts = {}) {
  const init = { credentials: 'same-origin', headers: { ...(opts.headers || {}) } };
  init.method = opts.method || (opts.body !== undefined ? 'POST' : 'GET');
  if (opts.body instanceof Blob) init.body = opts.body;
  else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers['content-type'] = 'application/json'; }
  let r;
  try { r = await fetch(path, init); } catch { throw new Error('No connection. Try again.'); }
  const body = (r.headers.get('content-type') || '').includes('json') ? await r.json().catch(() => ({})) : {};
  if (!r.ok) { const e = new Error(body.error || 'Something went wrong'); e.status = r.status; e.code = body.code; throw e; }
  return body;
}
const send = (p, body, method) => api(p, { body: body ?? {}, method });

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
  }
  toast('Copied');
}

// "Lagos, NG" or "NG:Lagos" or "NG" or "*" -> the form the server stores
function normLoc(s) {
  s = String(s).trim();
  if (!s) return null;
  if (s === '*') return '*';
  if (s.includes(',')) { const [city, cc] = s.split(',').map((x) => x.trim()); return `${cc.toUpperCase()}:${city}`; }
  if (s.includes(':')) { const [cc, city] = s.split(':').map((x) => x.trim()); return `${cc.toUpperCase()}:${city}`; }
  return s.toUpperCase();
}

function qr(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag(4, 2);
}

// ---------- session ----------
async function loadMe() {
  const d = await api('/api/me');
  me = d.user ? { user: d.user, companies: d.companies || [] } : null;
}

function drawNav() {
  if (!me) {
    nav.innerHTML = `<a href="#board" data-tab="board">Board</a><a href="#signin" data-tab="signin">Sign in</a>`;
  } else {
    const admin = me.user.role === 'admin' ? `<a href="#admin" data-tab="admin">Admin</a>` : '';
    nav.innerHTML = `<a href="#board" data-tab="board">Board</a><a href="#links" data-tab="links">Links</a><a href="#sell" data-tab="sell">Sell</a><a href="#wallet" data-tab="wallet">Wallet</a><a href="#me" data-tab="me">Me</a>${admin}`;
  }
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.tab === route));
}

// ---------- routing ----------
const OPEN = ['board', 'campaign', 'signin'];
function parseHash() {
  const [name, id] = location.hash.replace(/^#/, '').split('/');
  return { name: name || 'board', id: id || null };
}

async function go() {
  stopPolling();
  const { name, id } = parseHash();
  route = name;
  if (!me && !OPEN.includes(name)) { location.hash = '#signin'; return; }
  if (name === 'admin' && me?.user.role !== 'admin') { location.hash = '#board'; return; }
  drawNav();
  try {
    if (name === 'board') await viewBoard();
    else if (name === 'campaign') await viewCampaign(id);
    else if (name === 'signin') viewSignIn();
    else if (name === 'links') { await viewLinks(); pollTimer = setInterval(() => viewLinks(true), 15000); }
    else if (name === 'sell') await viewSell();
    else if (name === 'new') await viewNew(id);
    else if (name === 'seller') await viewSeller(id);
    else if (name === 'wallet') await viewWallet();
    else if (name === 'me') viewMe();
    else if (name === 'admin') await viewAdmin();
    else location.hash = '#board';
  } catch (e) {
    app.innerHTML = `<section class="page"><h1>Something went wrong</h1><p class="err">${esc(e.message)}</p><p><a class="btn" href="#board">Back to the board</a></p></section>`;
  }
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
window.addEventListener('hashchange', go);

// ---------- the board: local or global, one card per campaign ----------
function slideHtml(c) {
  campaigns.set(c.id, c);
  const art = c.image
    ? `<img src="${esc(c.image)}" alt="Flyer for ${esc(c.title)}" loading="lazy">`
    : `<div class="fallback"><b>${esc(c.title)}</b></div>`;
  return `<article class="slide" data-id="${esc(c.id)}">
    <div class="art">${art}</div>
    <div class="info">
      <div class="row"><span class="chip">${money(c.reward_cents)} ${esc(rule(c.reward_rule))}</span><span class="left">${money(c.left_cents)} left</span></div>
      <h2>${esc(c.title)}</h2>
      <p class="by">${esc(c.company)} · ${esc(where(c.locations))}</p>
      <p class="snip">${esc(c.snippet)}</p>
      <div class="acts">
        <button class="pill solid" data-act="copy-post" data-id="${esc(c.id)}">Copy snippet and link</button>
        ${c.image ? `<a class="pill" href="${esc(c.image)}" download>Flyer</a>` : ''}
        <a class="pill" href="#campaign/${esc(c.id)}">Details and QR</a>
      </div>
    </div>
  </article>`;
}

async function viewBoard() {
  const data = await api(`/api/squad/board?scope=${scope}`);
  const loc = [me?.user.city, me?.user.country].filter(Boolean).join(', ');
  let note = '';
  if (scope === 'local' && !me) note = `<p class="note">Sign in and add your city to see campaigns near you. <a href="#signin">Sign in</a></p>`;
  else if (scope === 'local' && !me.user.country) note = `<p class="note">Add your city and country to see campaigns near you. <a href="#me">Add your location</a></p>`;
  const list = data.campaigns.length
    ? data.campaigns.map(slideHtml).join('')
    : `<div class="empty"><h2>Nothing here yet</h2><p>${scope === 'local' ? 'No campaigns near you yet. Try Global to see everything that is open.' : 'No open campaigns right now. Check back soon.'}</p></div>`;
  app.innerHTML = `<section class="board" aria-label="Campaigns">
    <header class="bh">
      <div class="seg" role="tablist">
        <button role="tab" aria-selected="${scope === 'local'}" class="${scope === 'local' ? 'on' : ''}" data-act="scope" data-v="local">Local</button>
        <button role="tab" aria-selected="${scope === 'global'}" class="${scope === 'global' ? 'on' : ''}" data-act="scope" data-v="global">Global</button>
      </div>
      ${scope === 'local' && loc ? `<span class="where">${esc(loc)}</span>` : ''}
    </header>
    ${note}
    <div class="feed">${list}</div>
  </section>`;
}

// ---------- one campaign: details, the link, the QR, proof ----------
async function viewCampaign(id) {
  const { campaign: c } = await api(`/api/squad/campaigns/${encodeURIComponent(id)}`);
  campaigns.set(c.id, c);
  const art = c.image ? `<img src="${esc(c.image)}" alt="Flyer for ${esc(c.title)}">` : `<div class="fallback"><b>${esc(c.title)}</b></div>`;
  app.innerHTML = `<section class="page">
    <a href="#board" class="back">← Board</a>
    <div class="detail-art">${art}</div>
    <div class="row"><span class="chip">${money(c.reward_cents)} ${esc(rule(c.reward_rule))}</span><span class="left">${money(c.left_cents)} left</span></div>
    <h1>${esc(c.title)}</h1>
    <p class="by">${esc(c.company)} · ${esc(where(c.locations))}</p>
    <p class="snip-big">${esc(c.snippet)}</p>
    ${me ? `<div class="stack">
      <button class="pill solid" data-act="copy-post" data-id="${esc(c.id)}">Copy snippet and link</button>
      <button class="pill" data-act="mylink" data-id="${esc(c.id)}">Get my link and QR</button>
      <div id="linkbox"></div>
      ${c.reward_rule === 'snippet' ? `<form data-form="proof" data-id="${esc(c.id)}" class="stack"><label>Link to your post<input name="post_url" type="url" required placeholder="https://"></label><button class="pill" type="submit">Send proof</button></form>` : ''}
    </div>` : `<p class="note"><a href="#signin">Sign in</a> to get your link and QR code.</p>`}
  </section>`;
}

async function showLink(id) {
  const { url } = await send(`/api/squad/campaigns/${encodeURIComponent(id)}/link`);
  const box = document.getElementById('linkbox');
  if (!box) return url;
  box.innerHTML = `<div class="linkbox">
    <code>${esc(url)}</code>
    <div class="acts"><button class="pill solid" data-act="copy" data-copy="${encodeURIComponent(url)}">Copy link</button></div>
    <div class="qr" aria-label="QR code for your link">${qr(url)}</div>
    <p class="note">Print it or show it. Scans count the same as taps.</p>
  </div>`;
  return url;
}

// ---------- marketer's links: live counters ----------
async function viewLinks(quiet) {
  const { links } = await api('/api/squad/me/links');
  if (route !== 'links') return;
  const body = links.length ? links.map((l) => `<article class="card-l">
      <div class="row"><b>${esc(l.title)}</b><span class="chip">${money(l.reward_cents)} ${esc(rule(l.reward_rule))}</span></div>
      <div class="counters">
        <div><span>${l.today}</span>today</div>
        <div><span>${l.verified}</span>verified</div>
        <div><span>${l.total - l.verified}</span>not counted</div>
        <div><span>${money(l.earned)}</span>earned</div>
      </div>
      <p class="note">${money(l.left_cents)} left in this campaign · <code>${esc(l.url)}</code></p>
      <div class="acts"><button class="pill" data-act="copy" data-copy="${encodeURIComponent(l.url)}">Copy link</button><a class="pill" href="#campaign/${esc(l.campaign_id)}">Open</a></div>
      ${l.reward_rule === 'snippet' ? `<form data-form="proof" data-id="${esc(l.campaign_id)}" class="stack"><label>Link to your post<input name="post_url" type="url" required placeholder="https://"></label><button class="pill" type="submit">Send proof</button></form>` : ''}
    </article>`).join('')
    : `<div class="empty"><h2>No links yet</h2><p>Open a campaign on the board and get your link. Your counters will show up here.</p><a class="pill solid" href="#board">Go to the board</a></div>`;
  const html = `<section class="page"><h1>Your links</h1><p class="lead">Updates every 15 seconds.</p>${body}</section>`;
  // do not redraw over a field the marketer is typing in
  if (quiet && document.activeElement && document.activeElement.tagName === 'INPUT') return;
  app.innerHTML = html;
}

// ---------- sellers ----------
async function viewSell() {
  if (!me.companies.length) {
    app.innerHTML = `<section class="page"><h1>Sell your work</h1>
      <p class="lead">Start with the business or product name. You can add more later.</p>
      <form data-form="company" class="stack"><label>Business name<input name="name" required maxlength="60" placeholder="Mama's Diner"></label><button class="pill solid" type="submit">Continue</button></form></section>`;
    return;
  }
  const { campaigns: mine } = await api('/api/squad/mine');
  const rows = mine.length ? mine.map((c) => `<a class="card-l" href="#seller/${esc(c.id)}">
      <div class="row"><b>${esc(c.title)}</b><span class="status s-${esc(c.status)}">${esc(STATUS[c.status] || c.status)}</span></div>
      <p class="note">${money(c.reward_cents)} ${esc(rule(c.reward_rule))} · ${money(c.budget_cents)} funded · ${c.stats.verified} verified · ${c.stats.marketers} marketers</p>
    </a>`).join('')
    : `<div class="empty"><h2>No campaigns yet</h2><p>Add a product link, a short pitch and a flyer. Marketers do the sharing.</p></div>`;
  app.innerHTML = `<section class="page"><h1>Sell your work</h1>
    <div class="acts"><a class="pill solid" href="#new">New campaign</a></div>
    ${rows}</section>`;
}

async function viewNew(id) {
  let c = null;
  if (id) {
    const { campaigns: mine } = await api('/api/squad/mine');
    c = mine.find((x) => x.id === id);
    if (!c) throw new Error('No such campaign of yours');
    if (!['draft', 'paused'].includes(c.status)) throw new Error('Pause the campaign before you change it');
  }
  const companies = me.companies.length > 1
    ? `<label>Business<select name="company_id">${me.companies.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label>` : '';
  const locs = c ? (c.locations || []).join(', ') : '';
  const cur = c?.reward_rule || 'click';
  app.innerHTML = `<section class="page"><a href="#sell" class="back">← Sell</a><h1>${c ? 'Edit campaign' : 'New campaign'}</h1>
    <form data-form="campaign" data-id="${esc(id || '')}" class="stack">
      ${companies}
      <label>Product name<input name="title" required maxlength="80" value="${esc(c?.title || '')}" placeholder="Spring menu special"></label>
      <label>Your product or affiliate link<input name="product_url" type="url" required value="${esc(c?.product_url || '')}" placeholder="https://"></label>
      <label>Pitch marketers copy and share<textarea name="snippet" required minlength="10" maxlength="500" rows="4" placeholder="Hand-poured candles, made in Lagos. Gift boxes from $12.">${esc(c?.snippet || '')}</textarea></label>
      <label>Flyer (optional, up to 5 MB)<input name="flyer" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>
      <fieldset><legend>Reward rule</legend>
        ${['click', 'signup', 'snippet'].map((r) => `<label class="radio-row"><input type="radio" name="reward_rule" value="${r}" ${r === cur ? 'checked' : ''}> ${esc(rule(r))}</label>`).join('')}
      </fieldset>
      <label>Reward in dollars<input name="reward" inputmode="decimal" required value="${c ? (c.reward_cents / 100).toFixed(2) : ''}" placeholder="0.50"></label>
      <label>Where it can be shared<input name="locations" required value="${esc(locs)}" placeholder="Lagos, NG · Zurich, CH · *"></label>
      <p class="note">Use a city and country like "Lagos, NG", a country code like "NG", or * for everywhere. Separate with commas.</p>
      <button class="pill solid" type="submit">${c ? 'Save changes' : 'Save as draft'}</button>
    </form></section>`;
}

async function viewSeller(id) {
  const { campaigns: mine } = await api('/api/squad/mine');
  const c = mine.find((x) => x.id === id);
  if (!c) throw new Error('No such campaign of yours');
  const left = Math.max(0, c.budget_cents - c.spent_cents);
  const pct = c.budget_cents ? Math.min(100, Math.round((c.spent_cents / c.budget_cents) * 100)) : 0;
  const canEdit = ['draft', 'paused'].includes(c.status);
  const canSubmit = canEdit && c.budget_cents >= MIN_FUND;
  const postback = `${location.origin}/api/squad/postback?key=${c.postback_key}&ref={gs_ref}`;
  app.innerHTML = `<section class="page"><a href="#sell" class="back">← Sell</a>
    <div class="row"><h1>${esc(c.title)}</h1><span class="status s-${esc(c.status)}">${esc(STATUS[c.status] || c.status)}</span></div>
    <p class="note">${money(c.reward_cents)} ${esc(rule(c.reward_rule))} · ${esc(where(c.locations))}</p>
    <div class="stats">
      <div><span>${c.stats.marketers}</span>marketers</div><div><span>${c.stats.verified}</span>verified clicks</div>
      <div><span>${c.stats.signups}</span>sign-ups</div><div><span>${c.stats.posts}</span>posts</div>
    </div>
    <div class="budget"><div style="width:${pct}%"></div></div>
    <p class="note">${money(c.spent_cents)} spent of ${money(c.budget_cents)} funded · ${money(left)} left</p>
    ${c.budget_cents < MIN_FUND ? `<div class="card-l"><h3>Fund the campaign</h3>
      <p>Send at least ${money(MIN_FUND)} by bank transfer and put this reference on it: <code>${esc(c.id.slice(-8).toUpperCase())}</code>. We confirm the transfer and add it here.</p>
      <p class="note">Card payments are not connected yet.</p></div>` : ''}
    <div class="acts">
      ${canEdit ? `<a class="pill" href="#new/${esc(c.id)}">Edit</a>` : ''}
      ${canSubmit ? `<button class="pill solid" data-act="submit" data-id="${esc(c.id)}">Send for review</button>` : ''}
    </div>
    ${c.reward_rule === 'signup' ? `<div class="card-l"><h3>Report sign-ups</h3><p>Call this from your thank-you page, with the <code>gs_ref</code> value you get on the link:</p><code class="wrap">${esc(postback)}</code><div class="acts"><button class="pill" data-act="copy" data-copy="${encodeURIComponent(postback)}">Copy URL</button></div></div>` : ''}
    <p class="note">Link to the product: <code class="wrap">${esc(c.product_url)}</code></p>
  </section>`;
}

// ---------- wallet ----------
async function viewWallet() {
  const w = await api('/api/squad/wallet');
  const rows = w.ledger.length ? w.ledger.map((r) => `<li><span>${esc(r.campaign || r.kind)}</span><span class="${r.amount_cents < 0 ? 'neg' : ''}">${r.amount_cents < 0 ? '−' : '+'}${money(Math.abs(r.amount_cents))}</span><small>${day(r.created_at)}${r.amount_cents > 0 && r.created_at > Date.now() - 7 * 86400000 ? ' · pending' : ''}</small></li>`).join('') : '<li class="note">No earnings yet.</li>';
  const pays = w.payouts.length ? w.payouts.map((p) => `<li><span>${money(p.amount_cents)} · ${esc(p.method)}</span><span class="status s-${esc(p.status)}">${esc(p.status)}</span></li>`).join('') : '<li class="note">No payouts yet.</li>';
  app.innerHTML = `<section class="page"><h1>Wallet</h1>
    <div class="stats big">
      <div><span>${money(w.available_cents)}</span>available</div>
      <div><span>${money(w.pending_cents)}</span>pending for 7 days</div>
    </div>
    <h2>Request a payout</h2>
    <form data-form="payout" class="stack">
      <label>Amount in dollars<input name="amount" inputmode="decimal" required placeholder="${(MIN_PAYOUT / 100).toFixed(2)}"></label>
      <label>Paid to<select name="method"><option value="bank">Local bank account</option><option value="paypal">PayPal</option><option value="usdt">USDT address</option></select></label>
      <label>Account details<input name="account" required maxlength="200" placeholder="Bank name, account number, PayPal email or USDT address"></label>
      <p class="note">Minimum ${money(MIN_PAYOUT)}. Payouts go out by hand in a weekly batch. Above ${money(ID_CHECK_CENTS)} we check your ID first.</p>
      <button class="pill solid" type="submit">Request payout</button>
    </form>
    <h2>Payouts</h2><ul class="list">${pays}</ul>
    <h2>Activity</h2><ul class="list">${rows}</ul>
  </section>`;
}

// ---------- profile ----------
function viewMe() {
  const u = me.user;
  const prefs = u.prefs || {};
  app.innerHTML = `<section class="page"><h1>Your profile</h1>
    <form data-form="profile" class="stack">
      <label>Name<input name="name" maxlength="60" value="${esc(u.display_name || '')}"></label>
      <label>City<input name="city" maxlength="60" value="${esc(u.city || '')}" placeholder="Lagos"></label>
      <label>Country code<input name="country" maxlength="2" value="${esc(u.country || '')}" placeholder="NG"></label>
      <label>Phone (with country code)<input name="phone" inputmode="tel" value="${esc(u.phone || '')}" placeholder="+234 800 000 0000"></label>
      <fieldset><legend>Board opens on</legend>
        <label class="radio-row"><input type="radio" name="scope" value="local" ${prefs.scope !== 'global' ? 'checked' : ''}> Local</label>
        <label class="radio-row"><input type="radio" name="scope" value="global" ${prefs.scope === 'global' ? 'checked' : ''}> Global</label>
      </fieldset>
      <label>Categories you want to see<input name="categories" value="${esc((prefs.categories || []).join(', '))}" placeholder="food, fitness, fashion"></label>
      <button class="pill solid" type="submit">Save</button>
    </form>
    <p class="note">Signed in as ${esc(u.email)}</p>
    <div class="acts"><button class="pill" data-act="signout">Sign out</button></div></section>`;
}

// ---------- sign in ----------
function viewSignIn() {
  app.innerHTML = `<section class="page signin">
    <h1>Sign in</h1>
    <p class="lead">We email you a link. No password to remember.</p>
    <form data-form="signin" class="stack"><label>Email<input name="email" type="email" required autocomplete="email" placeholder="you@example.com"></label><button class="pill solid" type="submit">Send me a link</button></form>
    <div id="signin-msg"></div>
  </section>`;
}

// ---------- admin ----------
async function viewAdmin() {
  const a = await api('/api/admin/squad');
  const review = a.review.length ? a.review.map((c) => `<article class="card-l">
      <div class="row"><b>${esc(c.title)}</b><span class="chip">${money(c.reward_cents)} ${esc(rule(c.reward_rule))}</span></div>
      <p class="note">${esc(c.company)} · ${esc(where(c.locations))} · funded ${money(c.budget_cents)}</p>
      <p class="snip">${esc(c.snippet)}</p>
      <p class="note"><a href="${esc(c.product_url)}" target="_blank" rel="noopener">Check the product link</a></p>
      <div class="acts"><button class="pill solid" data-act="camp" data-id="${esc(c.id)}" data-action="approve">Approve and go live</button><button class="pill" data-act="camp" data-id="${esc(c.id)}" data-action="pause">Pause</button></div>
    </article>`).join('') : '<p class="note">Nothing in review.</p>';
  const funds = `<p class="note">Add funds after a bank transfer is confirmed. Enter the transfer reference from the seller's page. Campaigns can be funded from the review list above.</p>
    <form data-form="fund" class="stack"><label>Campaign id<input name="id" required placeholder="cg-…"></label><label>Amount in dollars<input name="amount" inputmode="decimal" required></label><label>Transfer reference<input name="reference" maxlength="120"></label><button class="pill" type="submit">Add funds</button></form>`;
  const proofs = a.proofs.length ? a.proofs.map((p) => `<article class="card-l">
      <div class="row"><b>${esc(p.title)}</b><span class="chip">${money(p.reward_cents)}</span></div>
      <p class="note">${esc(p.handle ? '@' + p.handle : p.email)} · <a href="${esc(p.post_url)}" target="_blank" rel="noopener">Open the post</a></p>
      <div class="acts"><button class="pill solid" data-act="proof" data-id="${esc(p.id)}" data-decision="approve">Post is live: pay</button><button class="pill" data-act="proof" data-id="${esc(p.id)}" data-decision="reject">Reject</button></div>
    </article>`).join('') : '<p class="note">No posts to check.</p>';
  const pays = a.payouts.length ? a.payouts.map((p) => `<article class="card-l">
      <div class="row"><b>${money(p.amount_cents)} · ${esc(p.method)}</b>${p.amount_cents > a.id_check_cents ? '<span class="status s-review">ID check first</span>' : ''}</div>
      <p class="note">${esc(p.handle ? '@' + p.handle : p.email)} · ${esc([p.city, p.country].filter(Boolean).join(', '))} · ${esc(p.phone || 'no phone')}</p>
      <p class="wrap"><code>${esc(p.account)}</code></p>
      <div class="acts"><button class="pill solid" data-act="payout" data-id="${esc(p.id)}" data-action="paid">Mark paid</button><button class="pill" data-act="payout" data-id="${esc(p.id)}" data-action="reject">Reject, return to balance</button></div>
    </article>`).join('') : '<p class="note">No payouts requested.</p>';
  const fraud = a.fraud.length ? a.fraud.map((f) => `<article class="card-l"><b>${esc(f.handle ? '@' + f.handle : f.email)}</b><p class="note">${f.rejected} of ${f.total} clicks not counted this week · ${f.duplicates} repeat visits · ${f.suspicious} bot or datacenter</p></article>`).join('') : '<p class="note">No flags this week.</p>';
  app.innerHTML = `<section class="page"><h1>Admin</h1>
    <p class="lead">Live: ${a.live.campaigns} campaigns · ${money(a.live.spent_cents)} of ${money(a.live.budget_cents)} spent · paid this week ${money(a.paid_this_week_cents)}</p>
    <h2>Review</h2>${review}
    <h2>Fund a campaign</h2>${funds}
    <h2>Posts to check</h2>${proofs}
    <h2>Payouts to send</h2>${pays}
    <h2>Fraud flags</h2>${fraud}
  </section>`;
}

// ---------- actions (clicks) ----------
const acts = {
  async scope(el) { scope = el.dataset.v === 'global' ? 'global' : 'local'; await viewBoard(); },
  async 'copy-post'(el) {
    if (!me) { location.hash = '#signin'; return; }
    const c = campaigns.get(el.dataset.id);
    const url = await showLink(el.dataset.id);
    await copyText(`${c?.snippet || ''}\n\n${url}`);
  },
  async mylink(el) { if (!me) { location.hash = '#signin'; return; } await showLink(el.dataset.id); },
  async copy(el) { await copyText(decodeURIComponent(el.dataset.copy)); },
  async submit(el) {
    await send(`/api/squad/campaigns/${el.dataset.id}/submit`);
    toast('Sent for review. We will confirm soon.');
    await go();
  },
  async signout() { await send('/api/auth/signout'); me = null; toast('Signed out'); location.hash = '#board'; await go(); },
  async camp(el) { await send(`/api/admin/squad/campaigns/${el.dataset.id}`, { action: el.dataset.action }); toast('Done'); await go(); },
  async proof(el) { await send(`/api/admin/squad/proofs/${el.dataset.id}`, { decision: el.dataset.decision }); toast('Done'); await go(); },
  async payout(el) {
    if (el.dataset.action === 'reject' && !confirm('Reject this payout? The money goes back to the marketer\'s balance.')) return;
    await send(`/api/admin/squad/payouts/${el.dataset.id}`, { action: el.dataset.action }); toast('Done'); await go();
  },
};

// ---------- forms ----------
const forms = {
  async signin(f) {
    const email = new FormData(f).get('email');
    const r = await send('/api/auth/start', { email });
    const box = document.getElementById('signin-msg');
    if (r.link) box.innerHTML = `<p class="note">Local mode: <a href="${esc(r.link)}">open the sign-in link</a></p>`;
    else box.innerHTML = `<p class="note">Check your inbox for the link. It works once, for 20 minutes.</p>`;
  },
  async company(f) {
    const r = await send('/api/companies', { name: new FormData(f).get('name') });
    await loadMe(); toast('Business added'); location.hash = '#new';
    return r;
  },
  async campaign(f) {
    const fd = new FormData(f);
    const id = f.dataset.id || '';
    const company = fd.get('company_id') || me.companies[0].id;
    let image_asset_id;
    const file = fd.get('flyer');
    if (file && file.size) {
      if (file.size > 5 * 1024 * 1024) throw new Error('Flyers can be up to 5 MB');
      const up = await api(`/api/companies/${encodeURIComponent(company)}/assets?kind=product`, { method: 'POST', body: file, headers: { 'content-type': file.type } });
      image_asset_id = up.id;
    }
    const body = {
      title: fd.get('title'),
      product_url: fd.get('product_url'),
      snippet: fd.get('snippet'),
      reward_rule: fd.get('reward_rule'),
      reward_cents: dollarsToCents(fd.get('reward')),
      locations: String(fd.get('locations') || '').split(/[,;]/).map(normLoc).filter(Boolean),
      ...(image_asset_id ? { image_asset_id } : {}),
    };
    if (!body.locations.length) throw new Error('Say where it can be shared');
    if (id) { await send(`/api/squad/campaigns/${id}`, body, 'PATCH'); location.hash = `#seller/${id}`; }
    else { const r = await send('/api/squad/campaigns', { ...body, company_id: company }); location.hash = `#seller/${r.id}`; }
  },
  async proof(f) {
    // the form knows the campaign; the proof goes against the marketer's own link for it
    const { links } = await api('/api/squad/me/links');
    const l = links.find((x) => x.campaign_id === f.dataset.id);
    if (!l) throw new Error('Get your link for this campaign first');
    const r = await send(`/api/squad/links/${encodeURIComponent(l.code)}/proof`, { post_url: new FormData(f).get('post_url') });
    toast(`Proof sent. ${r.status === 'pending' ? 'We check it before paying.' : ''}`);
    f.reset();
  },
  async payout(f) {
    const fd = new FormData(f);
    const cents = dollarsToCents(fd.get('amount'));
    if (cents < MIN_PAYOUT) throw new Error(`The minimum payout is ${money(MIN_PAYOUT)}`);
    const r = await send('/api/squad/payouts', { amount_cents: cents, method: fd.get('method'), account: fd.get('account') });
    toast(r.id_check ? 'Requested. We will check your ID before we pay.' : 'Payout requested');
    await viewWallet();
  },
  async profile(f) {
    const fd = new FormData(f);
    const categories = String(fd.get('categories') || '').split(',').map((x) => x.trim()).filter(Boolean);
    await send('/api/me/profile', { name: fd.get('name'), city: fd.get('city'), country: fd.get('country'), phone: fd.get('phone'), prefs: { scope: fd.get('scope'), categories } });
    await loadMe();
    toast('Saved');
  },
  async fund(f) {
    const fd = new FormData(f);
    await send(`/api/admin/squad/campaigns/${encodeURIComponent(fd.get('id'))}`, { action: 'fund', amount_cents: dollarsToCents(fd.get('amount')), reference: fd.get('reference') });
    toast('Funds added'); await go();
  },
};

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  e.preventDefault();
  try { await acts[el.dataset.act]?.(el); }
  catch (err) { toast(err.message); }
});

document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const btn = f.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    await forms[f.dataset.form]?.(f);
  } catch (err) { toast(err.message); }
  finally { if (btn) btn.disabled = false; }
});

// ---------- start ----------
(async function boot() {
  try { await loadMe(); } catch { me = null; }
  if (!location.hash) location.hash = '#board';
  await go();
})();
