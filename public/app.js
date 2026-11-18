// Thebes app: feed, create, profile, admin. Plain modules, no build step.
import { varsFor, DEFAULTS } from '/fill.js';
import { shareCard } from '/share.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (v) => v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(v || 0);
const clock = (ms) => { const s = Math.round((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const TINTS = ['#EFE8FF', '#f9d26a', '#cfe3ff', '#d4f5e4', '#ede2ff', '#ffe0c7', '#e6e6e6'];
const tint = (s) => TINTS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
const initials = (s) => String(s).replace(/^@/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const toast = (t, ms = 1800) => { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), ms); };
function endsText(k) {
  if (k.closed) return 'Closed';
  if (!k.ends_at) return 'No end date';
  const d = k.ends_at - Date.now(); if (d <= 0) return 'Closing';
  const m = Math.floor(d / 60000), h = Math.floor(m / 60), dd = Math.floor(h / 24);
  return 'Ends in ' + (dd ? `${dd}d ${h % 24}h` : h ? `${h}h ${m % 60}m` : `${m}m`);
}

async function api(path, opts = {}) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), opts.timeout || 12000);
  let r;
  try {
    r = await fetch(path, { credentials: 'include', signal: ctl.signal, ...opts, headers: { ...(opts.body && !(opts.body instanceof Blob) && !(opts.body instanceof ArrayBuffer) ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) } });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Thebes is taking too long to answer. Check your connection and try again.' : 'Could not reach Thebes. Check your connection and try again.');
  } finally { clearTimeout(timer); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || `request failed (${r.status})`); e.code = j.code; e.status = r.status; throw e; }
  return j;
}
const post = (p, b) => api(p, { method: 'POST', body: JSON.stringify(b || {}) });

const I = {
  heart: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  chat: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  trophy: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/></svg>',
  share: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4l7 7-7 7M21 11H9a5 5 0 0 0-5 5v3"/></svg>',
  people: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg>',
  x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
  up: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  upload: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>',
  down: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></svg>',
};

// ---------- session ----------
let ME = { user: null, companies: [] };
async function loadMe() { try { ME = await api('/api/me'); } catch { ME = { user: null, companies: [] }; } if (!ME.companies) ME.companies = []; return ME; }

// ---------- sheets ----------
function openSheet(html, { tall = false } = {}) {
  const s = $('#sheet'); s.innerHTML = `<span class="grab"></span>${html}`; s.classList.toggle('tall', tall);
  s.classList.add('on'); $('#veil').classList.add('on');
  return s;
}
function closeSheet() { $('#sheet').classList.remove('on'); $('#veil').classList.remove('on'); }
$('#veil').addEventListener('click', closeSheet);
const sheetHead = (title, sub = '') => `<div class="sh-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button type="button" class="x" aria-label="Close" data-act="close">${I.x}</button></div>`;

function signIn(reason = 'Sign in to keep your streaks, like, comment and run contests.') {
  const s = openSheet(`${sheetHead('Sign in', esc(reason))}
    <form class="form" id="signinf"><div class="fld"><label for="em">Email</label><input class="in" id="em" type="email" autocomplete="email" required placeholder="you@example.com"></div>
    <button class="cta" type="submit">Send me a sign-in link</button><div id="signmsg" class="note"></div></form>`);
  $('#signinf', s).addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#signmsg', s);
    try {
      const r = await post('/api/auth/start', { email: $('#em', s).value });
      m.innerHTML = r.link ? `Local mode: <a href="${esc(r.link)}" style="font-weight:700">open your sign-in link</a>.` : 'Check your email for a sign-in link. It works once, for 20 minutes.';
    } catch (err) { m.innerHTML = `<span class="err">${esc(err.message)}</span>`; }
  });
}
const needSignIn = (why) => { if (ME.user) return false; signIn(why); return true; };

// ---------- feed ----------
const F = { items: [], tab: 'foryou', active: -1, entered: new Set() };
async function loadFeed() {
  const slides = $('#slides');
  slides.innerHTML = `<div class="empty">Loading games…</div>`;
  try {
    const { items } = await api('/api/feed?tab=' + (F.tab === 'following' ? 'following' : 'foryou'));
    const deep = location.pathname.match(/^\/c\/([\w-]+)/)?.[1];
    if (deep && F.tab === 'foryou') {
      const have = items.findIndex((k) => k.id === deep);
      if (have > 0) items.unshift(items.splice(have, 1)[0]);
      else if (have < 0) { try { items.unshift((await api('/api/contests/' + deep)).item); } catch { } }
    }
    F.items = items;
  } catch (e) { F.items = []; slides.innerHTML = `<div class="empty"><h2>Could not load games</h2><p>${esc(e.message)}</p><button type="button" class="btn pink" data-act="reload">Try again</button></div>`; return; }
  renderFeed();
}
function slideHTML(k, i) {
  const faces = k.participants.slice(0, 3).map((p) => `<span style="background:${tint(p.name)}">${esc(initials(p.name))}</span>`).join('');
  const closed = k.closed ? `<div class="closedcard"><span class="chip dark" style="align-self:flex-start">Closed</span><h3>${esc(k.title)}</h3>
      <div class="sub">${k.counts.players} played · ${k.counts.wins} solved it${k.prize ? ` · Prize: ${esc(k.prize)}` : ''}</div>
      ${k.leaderboard ? (k.winners.length ? `<div class="podium">${k.winners.slice(0, 3).map((w) => `<div class="w"><b>${w.rank}</b><span>${esc(w.name)}</span><em>${w.tries}/${k.tries} · ${clock(w.ms)}</em></div>`).join('')}</div>` : '<div class="sub">Nobody solved it, so there is no winner.</div>') : ''}
      ${k.leaderboard ? '<button type="button" class="btn pink" data-act="board" style="align-self:flex-start">Full leaderboard</button>' : ''}</div>` : '';
  return `<article class="slide${k.closed ? ' closed' : ''}" data-i="${i}">
    <img class="poster" src="${esc(k.poster)}" alt="${esc(k.company.name)}: ${esc(k.title)}" loading="${i ? 'lazy' : 'eager'}">
    <div class="chrome">
      <div class="scrim"></div>
      ${k.closed ? closed : `<button type="button" class="playbtn" data-act="play">${I.play}Play</button>`}
      <div class="rail">
        <div class="it"><button type="button" aria-label="Like" data-act="like" class="${k.liked ? 'liked' : ''}">${I.heart}</button><span data-n="likes">${fmt(k.counts.likes)}</span></div>
        <div class="it"><button type="button" aria-label="Comments" data-act="comments">${I.chat}</button><span>${fmt(k.counts.comments)}</span></div>
        ${k.leaderboard ? `<div class="it"><button type="button" aria-label="Leaderboard" data-act="board">${I.trophy}</button><span>Ranks</span></div>` : ''}
        <div class="it"><button type="button" aria-label="Players" data-act="players" class="people">${faces ? `<span class="faces">${faces}</span>` : I.people}</button><span data-n="players">${fmt(k.counts.players)}</span></div>
        <div class="it"><button type="button" aria-label="Share" data-act="share">${I.share}</button><span>Share</span></div>
        <button type="button" class="reportbtn" data-act="report">Report</button>
      </div>
      <div class="cap">
        <div class="who"><span class="av" style="background:${esc(k.company.color)}">${k.company.logo ? `<img src="${esc(k.company.logo)}" alt="">` : esc(initials(k.company.name))}</span><b>${esc(k.company.name)}</b>
          <button type="button" class="follow ${k.company.followed ? 'on' : ''}" data-act="follow">${k.company.followed ? 'Following' : 'Follow'}</button></div>
        <div class="t">${esc(k.title)}</div>
        <div class="chips">${k.prize ? `<span class="chip pink">Prize · ${esc(k.prize)}</span>` : ''}<span class="chip${k.closed ? ' dark' : ''}">${endsText(k)}</span><span class="chip">${fmt(k.counts.players)} played</span></div>
      </div>
    </div>
  </article>`;
}
let observer;
function renderFeed() {
  const slides = $('#slides');
  if (!F.items.length) {
    slides.innerHTML = F.tab === 'following'
      ? `<div class="empty"><h2>Nothing here yet</h2><p>Follow businesses from the For you feed and their games show up here.</p></div>`
      : `<div class="empty"><h2>No games yet</h2><p>Be the first: tap + to make a contest for your business.</p></div>`;
    return;
  }
  slides.innerHTML = F.items.map(slideHTML).join('');
  slides.scrollTop = 0; F.active = -1;
  observer?.disconnect();
  observer = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting && e.intersectionRatio > 0.6) activate(+e.target.dataset.i); }, { root: slides, threshold: [0.6] });
  $$('.slide', slides).forEach((el) => observer.observe(el));
}
function activate(i) {
  if (F.active === i) return;
  F.active = i; app.classList.remove('playing');
  $$('.slide').forEach((el) => {
    const on = +el.dataset.i === i, fr = $('iframe', el);
    el.classList.toggle('active', on);
    if (!on && fr) fr.remove();
  });
  const k = F.items[i], el = $(`.slide[data-i="${i}"]`);
  if (!k || !el) return;
  api(`/api/contests/${k.id}/view`, { method: 'POST' }).catch(() => { });
  if (!k.closed && !$('iframe', el)) {
    const fr = document.createElement('iframe');
    fr.src = k.play; fr.title = `${k.company.name}: ${k.title}`; fr.allow = 'clipboard-write';
    el.insertBefore(fr, $('.chrome', el));
  }
}
const activeItem = () => F.items[F.active];
addEventListener('message', (e) => {
  const d = e.data; if (!d || d.source !== 'gt-game') return;
  const fr = $('.slide.active iframe'); if (!fr || e.source !== fr.contentWindow) return;
  const k = activeItem(); if (!k) return;
  if (d.type === 'started') { k.counts.players = Math.max(k.counts.players, 1); }
  if (d.type === 'won' || d.type === 'lost') {
    setTimeout(() => {
      if (k.contact_fields?.length && !F.entered.has(k.id) && (k.prize || (!k.company.mailing_joined && !k.company.mailing_left))) entrySheet(k, d.type === 'won');
      else if (k.leaderboard && d.type === 'won') boardSheet(k);
    }, 1800);
  }
});

async function boardSheet(k) {
  const s = openSheet(`${sheetHead('Leaderboard', esc(`${k.title} · ${k.company.name}`))}<div class="list" style="padding:24px;text-align:center;color:var(--sub)">Loading…</div>`, { tall: true });
  try {
    const b = await api(`/api/contests/${k.id}/leaderboard`);
    const me = b.me;
    const head = b.closed
      ? `<div class="banner"><b>This contest has closed.</b> ${b.winners.length ? `${b.winners.length === 1 ? 'The winner is' : 'The winners are'} below.` : 'Nobody solved it, so there is no winner.'}${k.prize ? ` Prize: ${esc(k.prize)}.` : ''}</div>`
      : `<div class="banner"><b>${esc(endsText(k))}.</b> ${b.totals.players} played, ${b.totals.winners || 0} solved it. Fewest tries wins; the faster time breaks a tie.</div>`;
    const winners = b.winners.length ? `<div class="h3" style="padding:8px 12px 4px">Winners</div>${b.winners.map((w) => `<div class="row${w.you ? ' you' : ''}"><b style="color:var(--pink)">${w.rank}</b><span class="nm"><span class="mini" style="background:${tint(w.name)}">${esc(initials(w.name))}</span><span>${esc(w.name)}${w.prize ? ` · ${esc(w.prize)}` : ''}</span></span><span class="n">${w.tries}/${k.tries}</span><span class="tm">${clock(w.ms)}</span></div>`).join('')}` : '';
    const mine = me ? `<div class="row me"><b>${me.rank ?? '–'}</b><b>You</b><span class="n">${me.status === 'won' ? `${me.tries}/${k.tries}` : me.status === 'playing' ? 'playing' : me.status}</span><span class="tm">${me.status === 'won' ? clock(me.ms) : ''}</span></div>` : '';
    $('.list', s).outerHTML = `${head}<div class="list">${mine}${winners}
      <div class="row hd"><span>#</span><span>PLAYER</span><span class="n" style="font-weight:700">TRIES</span><span class="tm">TIME</span></div>
      ${b.rows.length ? b.rows.map((r) => `<div class="row${r.you ? ' you' : ''}"><b style="color:${r.rank <= 3 ? 'var(--ink)' : 'var(--sub)'}">${r.rank}</b><span class="nm"><span class="mini" style="background:${tint(r.name)}">${esc(initials(r.name))}</span><span>${esc(r.name)}</span></span><span class="n">${r.tries}/${k.tries}</span><span class="tm">${clock(r.ms)}</span></div>`).join('') : '<p style="color:var(--sub);text-align:center;padding:20px">No one has solved it yet. Be first.</p>'}</div>`;
  } catch (e) { $('.list', s).innerHTML = `<span class="err">${esc(e.message)}</span>`; }
}

async function playersSheet(k) {
  const s = openSheet(`${sheetHead('Players', esc(`${k.title} · ${k.company.name}`))}<div class="list" style="padding:24px;text-align:center;color:var(--sub)">Loading…</div>`, { tall: true });
  try {
    const p = await api(`/api/contests/${k.id}/players`);
    const label = { won: 'Solved', lost: 'Missed', timeout: 'Out of time', playing: 'Playing', abandoned: 'Left' };
    const color = { won: '#0d6b43', lost: 'var(--sub)', timeout: 'var(--sub)', playing: 'var(--pink)' };
    $('.list', s).outerHTML = `<div class="banner"><b>${p.total} ${p.total === 1 ? 'person has' : 'people have'} played.</b> ${p.players.filter((x) => x.status === 'won').length} of the latest solved it.</div>
      <div class="list">${p.players.length ? p.players.map((r) => `<div class="row" style="grid-template-columns:1fr auto"><span class="nm"><span class="mini" style="background:${tint(r.name)}">${esc(initials(r.name))}</span><span>${esc(r.name)}</span></span><span class="status" style="color:${color[r.status] || 'var(--sub)'}">${label[r.status] || r.status}${r.status === 'won' ? ` · ${r.tries}/${k.tries}` : ''}</span></div>`).join('') : '<p style="color:var(--sub);text-align:center;padding:20px">No one has played yet.</p>'}</div>`;
  } catch (e) { $('.list', s).innerHTML = `<span class="err">${esc(e.message)}</span>`; }
}

async function commentsSheet(k) {
  const s = openSheet(`${sheetHead(`${k.counts.comments} comments`)}<div class="list" id="cms"></div>
    <form class="composer" id="cform"><label for="cin" class="sr">Add a comment</label><input id="cin" placeholder="${ME.user ? 'Add a comment' : 'Sign in to comment'}" maxlength="500"><button class="btn pink" type="submit">Post</button></form>`, { tall: true });
  const draw = (list) => { $('#cms', s).innerHTML = list.length ? list.map((c) => `<div class="cm"><span class="mini" style="background:${tint(c.name)};width:34px;height:34px;margin:0">${esc(initials(c.name))}</span><div class="body"><span class="meta"><b>${esc(c.name)}</b> · ${new Date(c.at).toLocaleDateString()}</span><span class="txt">${esc(c.body)}</span></div></div>`).join('') : '<p style="color:var(--sub);text-align:center;padding:24px">No comments yet.</p>'; };
  let list = [];
  try { list = (await api(`/api/contests/${k.id}/comments`)).comments; draw(list); } catch (e) { $('#cms', s).innerHTML = `<span class="err">${esc(e.message)}</span>`; }
  $('#cform', s).addEventListener('submit', async (e) => {
    e.preventDefault(); if (needSignIn('Sign in to comment.')) return;
    const inp = $('#cin', s), body = inp.value.trim(); if (!body) return;
    try { const c = await post(`/api/contests/${k.id}/comments`, { body }); list.unshift(c); k.counts.comments++; inp.value = ''; draw(list); $('h2', s).textContent = `${k.counts.comments} comments`; }
    catch (err) { toast(err.message); }
  });
}

// a company's list: everyone in the feed for it now shows as joined, so the prompt does not come back this session
const markJoined = (companyId, joined = true) => F.items.filter((x) => x.company.id === companyId).forEach((x) => { x.company.mailing_joined = joined; });
function entrySheet(k, won) {
  const f = k.contact_fields || ['email'], co = k.company.name, draw = !!k.prize;
  const ask = !k.company.mailing_joined && !k.company.mailing_left;   // on the list already, or left it: only the draw
  const oneTap = ME.user?.email && ask ? `<div class="oneTap">
      ${draw ? `<label class="check" style="margin-bottom:12px"><input type="checkbox" id="eq"><span>Enter me in the draw. ${esc(co)} can use my details to contact me about the prize.</span></label>` : ''}
      <button class="cta" type="button" id="joinone">Join ${esc(co)} mailing list</button>
      <p class="note" style="margin:8px 0 0">As ${esc(ME.user.email)}. You can unsubscribe any time from your profile.</p></div>` : '';
  const s = openSheet(`${sheetHead(won ? 'You solved it' : 'Thanks for playing', esc(draw ? `${co} is giving away ${k.prize}. Enter the draw${ask ? ', and join their mailing list if you like' : ''}.` : `Hear from ${co} about new contests and offers.`))}
    ${oneTap}
    <form class="form" id="entryf">
      <div class="fld"><label for="ee">Email</label><input class="in" id="ee" type="email" autocomplete="email" required value="${esc(ME.user?.email || '')}"></div>
      ${f.includes('name') ? '<div class="fld"><label for="en">Name</label><input class="in" id="en" autocomplete="name"></div>' : ''}
      ${f.includes('phone') ? '<div class="fld"><label for="ep">Phone</label><input class="in" id="ep" type="tel" autocomplete="tel"></div>' : ''}
      ${draw ? `<label class="check"><input type="checkbox" id="ec" required><span>Enter me in the draw. ${esc(co)} can use my details to contact me about the prize.</span></label>` : ''}
      ${ask ? '' : '<!--'}<label class="check"><input type="checkbox" id="em" ${draw ? '' : 'required'}><span>Add me to the ${esc(co)} mailing list. I can unsubscribe any time.${draw ? ' <i style="color:var(--sub);font-style:normal">Optional.</i>' : ''}</span></label>${ask ? '' : '-->'}
      <button class="cta" type="submit">${draw ? 'Send' : 'Join mailing list'}</button><button class="cta ghost" type="button" data-act="close">No thanks</button><div id="emsg"></div></form>`);
  F.entered.add(k.id);
  const done = (mailing) => { closeSheet(); toast(mailing ? `You joined the ${co} mailing list` : `Sent to ${co}`); if (mailing) markJoined(k.company.id); if (k.leaderboard && won) setTimeout(() => boardSheet(k), 600); };
  $('#joinone', s)?.addEventListener('click', async () => {
    try { await post(`/api/contests/${k.id}/entry`, { email: ME.user.email, consent: draw ? !!$('#eq', s)?.checked : false, mailing: true }); done(true); }
    catch (err) { $('#emsg', s).innerHTML = `<span class="err">${esc(err.message)}</span>`; }
  });
  $('#entryf', s).addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const mail = !!$('#em', s)?.checked;
      await post(`/api/contests/${k.id}/entry`, { email: $('#ee', s).value, name: $('#en', s)?.value, phone: $('#ep', s)?.value, consent: draw ? $('#ec', s).checked : false, mailing: mail });
      done(mail);
    } catch (err) { $('#emsg', s).innerHTML = `<span class="err">${esc(err.message)}</span>`; }
  });
}

// a subtle report: a reason and an optional note; one report per player per game
function reportSheet(k) {
  const s = openSheet(`${sheetHead('Report this game', esc(k.title))}
    <form class="form" id="repf">
      ${[['offensive', 'Offensive'], ['misleading', 'Misleading prize'], ['spam', 'Spam'], ['other', 'Something else']].map(([v, l], i) => `<label class="check"><input type="radio" name="rr" value="${v}" ${i ? '' : 'checked'}><span>${l}</span></label>`).join('')}
      <div class="fld"><label for="rn">Note (optional)</label><input class="in" id="rn" maxlength="500"></div>
      <button class="cta" type="submit">Send report</button><div id="remsg"></div></form>`);
  $('#repf', s).addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await post(`/api/contests/${k.id}/report`, { reason: $('input[name="rr"]:checked', s)?.value || 'other', note: $('#rn', s).value });
      closeSheet(); toast("Thanks, we'll take a look.");
    } catch (err) { $('#remsg', s).innerHTML = `<span class="err">${esc(err.message)}</span>`; }
  });
}

$('#feed').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act],[data-feedtab]'); if (!b) return;
  if (b.dataset.act === 'reload') return loadFeed();
  if (b.dataset.feedtab) { F.tab = b.dataset.feedtab; $$('[data-feedtab]').forEach((x) => x.classList.toggle('on', x === b)); return loadFeed(); }
  const slide = b.closest('.slide'); if (slide && +slide.dataset.i !== F.active) activate(+slide.dataset.i);
  const k = activeItem(), a = b.dataset.act; if (!k && a !== 'stop') return;
  if (a === 'play') { app.classList.add('playing'); $('.slide.active iframe')?.focus(); }
  if (a === 'stop') app.classList.remove('playing');
  if (a === 'board') boardSheet(k);
  if (a === 'players') playersSheet(k);
  if (a === 'report') reportSheet(k);
  if (a === 'comments') commentsSheet(k);
  if (a === 'like') {
    if (needSignIn('Sign in to like games.')) return;
    try { const r = await post(`/api/contests/${k.id}/like`); k.liked = r.liked; k.counts.likes += r.liked ? 1 : -1; b.classList.toggle('liked', r.liked); $('[data-n="likes"]', slide).textContent = fmt(k.counts.likes); } catch (err) { toast(err.message); }
  }
  if (a === 'follow') {
    if (needSignIn('Sign in to follow businesses.')) return;
    try { const r = await post(`/api/companies/${k.company.id}/follow`); F.items.filter((x) => x.company.id === k.company.id).forEach((x) => { x.company.followed = r.following; });
      $$('.slide').forEach((el) => { const x = F.items[+el.dataset.i]; if (x?.company.id === k.company.id) { const f = $('.follow', el); f.classList.toggle('on', r.following); f.textContent = r.following ? 'Following' : 'Follow'; } });
    } catch (err) { toast(err.message); }
  }
  if (a === 'share') {
    const url = `${location.origin}/c/${k.id}`;
    api(`/api/contests/${k.id}/share`, { method: 'POST' }).catch(() => { });
    shareSheet(k, url);
  }
});
$('#sheet').addEventListener('click', (e) => { if (e.target.closest('[data-act="close"]')) closeSheet(); });

// the skin as a card to post: the game, the sponsor, the prize and the Thebes logo
async function shareSheet(k, url) {
  const line = k.prize ? `Win ${k.prize}` : k.leaderboard ? 'Beat the leaderboard' : 'One word, one go';
  const s = openSheet(`${sheetHead('Share this contest', 'Post the card, or send the link.')}<div class="sharebox" id="sbox"><span style="color:var(--sub)">Making your card…</span></div>
    <div class="btns" id="sbtn"><button type="button" class="cta" data-s="send">Share</button><button type="button" class="cta ghost" data-s="copy">Copy link</button></div>`);
  let blob = null, file = null;
  try {
    const cv = await shareCard({ company: k.company.name, title: k.title, line, poster: k.poster, url });
    blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    file = new File([blob], `${(k.company.slug || 'thebes')}-${k.id}.png`, { type: 'image/png' });
    $('#sbox', s).innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="Share card for ${esc(k.title)}">`;
  } catch { $('#sbox', s).innerHTML = ''; }
  $('#sbtn', s).addEventListener('click', async (e) => {
    const w = e.target.closest('[data-s]')?.dataset.s; if (!w) return;
    const text = `${k.company.name}: ${k.title}`;
    try {
      if (w === 'copy') { await navigator.clipboard.writeText(url); toast('Link copied'); return; }
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: k.title, text, url });
      else if (navigator.share) await navigator.share({ title: k.title, text, url });
      else if (blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); toast('Card saved'); }
      else { await navigator.clipboard.writeText(url); toast('Link copied'); }
    } catch (err) { if (err?.name !== 'AbortError') toast(url, 4000); }
  });
}

// ---------- create ----------
let W, wid = 0, wready; const wpend = new Map();
function compiler(cmd, args) {
  if (!W) { W = new Worker('/runtime/compiler.worker.js'); W.onmessage = (e) => { const p = wpend.get(e.data.id); if (!p) return; wpend.delete(e.data.id); e.data.ok ? p.res(e.data.r) : p.rej(new Error(e.data.error)); }; }
  return new Promise((res, rej) => { const id = ++wid; wpend.set(id, { res, rej }); W.postMessage({ id, cmd, ...args }); });
}
const compilerReady = () => (wready ||= compiler('init', { base: location.origin + '/runtime/' }).catch((e) => { wready = null; throw e; }));
const sources = {};
const sourceOf = async (t) => (sources[t] ||= await (await fetch(`/templates/${t}.gt`)).text());

const C = { step: 0, game: 'wordle', template: 'pop-player', templates: null, companyId: null, companyName: '', logo: null, colors: [], brief: '', type: 'daily', title: 'The Daily Word', word: '', questions: [], quizText: '', tries: 6, time: 180, prize: '', winners: 1, ends: '', fields: { email: true, name: true, phone: false }, slots: null, previewing: false };
const GAMES = [['wordle', 'Daily Word', 'Guess the five-letter word.', ['#14a86a', '#f9d26a', '#fff', '#14a86a', '#fff'], 0], ['trivia', 'Trivia Sprint', 'Quick questions about your business.', ['#050515', '#D0BCFF', '#836CBB', '#D0BCFF', '#050515'], 0], ['memory', 'Memory Match', 'Flip and pair your products.', ['#ede2ff', '#fff', '#ede2ff', '#fff', '#ede2ff'], 1], ['sudoku', 'Sudoku', 'One grid, every digit once.', ['#fff', '#ffe0c7', '#fff', '#ffe0c7', '#fff'], 1], ['chess', 'Finish the Game', 'Find the winning moves.', ['#fff', '#050515', '#fff', '#050515', '#fff'], 1], ['letters', 'Letter Rack', 'Best word from seven tiles.', ['#D0BCFF', '#D0BCFF', '#fff', '#D0BCFF', '#fff'], 1]];
// trivia questions: "Q | right | wrong | wrong | wrong", one a line
const parseQuiz = (t) => String(t || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0]).map(([q, ...o]) => ({ q, options: o.filter(Boolean) }));
function quizProblem(t) {
  const qs = parseQuiz(t);
  if (qs.length < 3) return 'Write at least 3 questions';
  if (qs.length > 20) return 'At most 20 questions';
  for (const [i, x] of qs.entries()) {
    if (x.options.length < 2 || x.options.length > 4) return `Question ${i + 1}: give the right answer and 1 to 3 wrong ones, split by |`;
    if (x.q.length > 140 || x.options.some((o) => o.length > 60)) return `Question ${i + 1} is too long`;
    if (new Set(x.options.map((o) => o.toLowerCase())).size !== x.options.length) return `Question ${i + 1} has the same answer twice`;
    if (/;/.test(x.q + x.options.join(''))) return `Question ${i + 1}: leave out ;`;
  }
  return null;
}
const TNOTE = { challenge: 'One play, no end date, no leaderboard. Good for sharing anywhere.', contest: 'Runs until the end date. Leaderboard, and winners picked when it closes.', daily: 'Runs for a day, with a leaderboard and a winner at the end.' };
const pad = (n) => String(n).padStart(2, '0');
const localInput = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

async function renderCreate() {
  const v = $('#create');
  if (!ME.user) {
    v.innerHTML = `<header class="hdr"><a class="ib" href="#feed" aria-label="Close">${I.x.replace(/16/g, '20')}</a><span class="ttl">New contest</span><span class="ib"></span></header>
      <div class="main"><div><h1>Make a game for your business</h1><p class="lede">Pick a game, add your logo, write a line about it. We design it, people play it, you get their contacts.</p></div>
      <button type="button" class="cta" data-act="signin" style="flex:none">Sign in to start</button></div>`;
    return;
  }
  if (!C.companyId && ME.companies[0]) { C.companyId = ME.companies[0].id; C.companyName = ME.companies[0].name; const cols = ME.companies[0].brand?.colors; if (cols?.list) C.colors = cols.list; if (ME.companies[0].logo) C.logo = { url: ME.companies[0].logo }; }
  if (!C.templates) { try { C.templates = (await api('/api/templates')).templates; } catch { C.templates = []; } }
  const st = C.step;
  const head = (h, p) => `<div><h1>${h}</h1><p class="lede">${p}</p></div>`;
  let m = '';
  if (st === 0) m = head('Pick a game', 'Every contest starts from a game people already know how to play.') + `<div class="grid2">${GAMES.map(([id, n, t, mk, soon]) => `<button type="button" class="tile ${C.game === id ? 'sel' : ''}" ${soon ? 'disabled' : `data-act="game" data-v="${id}"`}><span class="marks">${mk.map((c) => `<i style="background:${c}"></i>`).join('')}</span><span style="display:flex;flex-direction:column;gap:4px"><span class="n1">${n}</span><span class="n2">${t}</span></span><span class="tag ${soon ? '' : 'live'}">${soon ? 'Coming soon' : 'Live'}</span></button>`).join('')}</div>`;
  if (st === 1) m = head('Choose a look', 'We fit your brand into it. You can change colours and words after.') + `<div class="grid2">${C.templates.filter((t) => (t.game || 'wordle') === C.game).map((t) => `<button type="button" class="look ${C.template === t.id ? 'sel' : ''}" data-act="look" data-v="${t.id}"><img src="${esc(t.poster)}" alt="${esc(t.name)}"><span class="info"><span class="top"><span class="n1" style="font-size:15px;font-weight:800">${esc(t.name)}</span><span class="tag ${t.min_plan_id === 'free' ? 'pink' : 'dark'}">${t.min_plan_id === 'free' ? 'Free' : 'Pro'}</span></span><span class="n2" style="font-size:12px;line-height:16px;color:var(--sub)">${esc(t.description)}</span></span></button>`).join('')}</div>`;
  if (st === 2) m = head('Your brand', 'Saved to your company, so the next contest is quicker.') + `
    <div class="fld"><label for="co">Company name</label><input class="in" id="co" value="${esc(C.companyName)}" ${C.companyId ? 'readonly' : ''} placeholder="Mama's Diner"></div>
    <div class="fld"><span class="lb">Logo</span><label class="upload ${C.logo ? 'done' : ''}" for="logo">${C.logo ? `<img src="${esc(C.logo.url)}" alt="Your logo"><span style="display:flex;flex-direction:column;gap:2px"><b style="font-size:14px">Logo added</b><span style="font-size:12px;color:var(--sub)">Tap to replace</span></span>` : `${I.upload}<span style="display:flex;flex-direction:column;gap:2px"><b style="font-size:14px">Upload your logo</b><span style="font-size:12px;color:var(--sub)">PNG, SVG or JPEG, up to 5 MB</span></span>`}</label><input type="file" id="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="sr"></div>
    <div class="fld"><span class="lb">Brand colours</span><div class="sw">${(C.colors.length ? C.colors : ['#D0BCFF', '#050515']).map((c, i) => `<label style="background:${c}" title="${c}"><span class="sr">Colour ${i + 1}</span><input type="color" value="${c}" data-color="${i}"></label>`).join('')}</div><span class="note">${C.colors.length ? 'Picked from your logo. Tap one to change it.' : 'Add a logo and we pick these from it, or tap to set them.'}</span></div>`;
  if (st === 3) m = head('Tell us about it', 'A line or two is enough. We write the words and set the colours.') + `
    <div class="fld"><label for="brief">Your brief</label><textarea class="in" id="brief" rows="3" placeholder="A daily word game for the diner. Playful. Top three each day eat lunch on us.">${esc(C.brief)}</textarea></div>
    <div class="fld"><span class="lb">Type</span><div class="seg">${[['challenge', 'Challenge'], ['contest', 'Contest'], ['daily', 'Daily']].map(([id, n]) => `<button type="button" class="${C.type === id ? 'on' : ''}" data-act="type" data-v="${id}">${n}</button>`).join('')}</div><span class="note">${TNOTE[C.type]}</span></div>
    <div class="fld"><label for="title">Title</label><input class="in" id="title" value="${esc(C.title)}" maxlength="40"></div>
    <div class="grid2">
      ${C.game === 'trivia' ? '' : `<div class="fld"><label for="word">Word</label><input class="in" id="word" value="${esc(C.word)}" maxlength="5" autocomplete="off" autocapitalize="none" style="letter-spacing:.14em;text-transform:uppercase"><span class="note">Five letters. Only your team sees it.</span></div>`}
      <div class="fld"><label for="time">Time limit</label><select class="in" id="time">${[[0, 'No limit'], [60, '1 minute'], [90, '90 seconds'], [180, '3 minutes'], [300, '5 minutes']].map(([v, n]) => `<option value="${v}" ${C.time === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      ${C.game === 'trivia' ? '' : `<div class="fld"><label for="tries">Tries</label><select class="in" id="tries">${[4, 5, 6, 8].map((n) => `<option ${C.tries === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`}
      ${C.type !== 'challenge' ? `<div class="fld"><label for="ends">Ends</label><input class="in" id="ends" type="datetime-local" value="${esc(C.ends || localInput(Date.now() + (C.type === 'daily' ? 864e5 : 7 * 864e5)))}"></div>` : ''}
      <div class="fld"><label for="prize">Prize <span style="font-weight:400;color:var(--sub)">· optional</span></label><input class="in" id="prize" value="${esc(C.prize)}" maxlength="60" placeholder="Lunch for two"></div>
      ${C.type !== 'challenge' ? `<div class="fld"><label for="winners">Winners</label><select class="in" id="winners">${[1, 3, 5, 10].map((n) => `<option ${C.winners === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>` : ''}
    </div>
    ${C.game === 'trivia' ? `<div class="fld"><label for="quiz">Questions</label><textarea class="in" id="quiz" rows="8" placeholder="What do we bake every morning? | Sourdough | Rye | Brioche | Bagel">${esc(C.quizText)}</textarea>
      <span class="note">One question a line: the question, then the right answer, then up to three wrong ones, split by |. We shuffle the answers. Only your team sees the right ones.</span>
      <button type="button" class="btn" data-act="quizai" style="align-self:flex-start">${C.quizText ? 'Write new questions' : 'Write them from my brief'}</button></div>` : ''}
    <div class="fld"><span class="lb">Collect from players</span><div class="togs">${Object.keys(C.fields).map((f) => `<button type="button" class="tog ${C.fields[f] ? 'on' : ''}" data-act="field" data-v="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div><span class="note">Players see what they share and tick a box to agree first.</span></div>`;
  if (st === 4) {
    const t = C.templates.find((x) => x.id === C.template), slotDefs = Object.entries(t?.slots?.slots || {}).filter(([, s]) => s.ai);
    m = head('Here’s your game', 'It’s playable. Try it, then change anything you like.') + `
      <div class="preview" id="pv"><div class="busy">Designing your game…</div></div>
      <form class="composer" id="askf" style="border:0;padding:0"><label for="ask" class="sr">Ask for a change</label><input id="ask" placeholder="Ask for a change, e.g. warmer colours" maxlength="200"><button class="btn pink" type="submit" aria-label="Send">${I.up}</button></form>
      ${C.slots ? `<div class="fld"><span class="lb">Colours</span><div class="sw">${slotDefs.filter(([, s]) => s.type === 'color').map(([k]) => { const c = C.slots[k] || DEFAULTS[C.template]?.[k] || '#D0BCFF'; return `<label style="background:${c}" title="${k}"><span class="sr">${k}</span><input type="color" value="${c}" data-slot="${k}"></label>`; }).join('')}</div></div>
      ${slotDefs.filter(([, s]) => s.type === 'text').map(([k, s]) => `<div class="fld"><label for="s-${k}">${esc(s.help ? s.help[0].toUpperCase() + s.help.slice(1) : k)}</label><input class="in" id="s-${k}" data-slot="${k}" value="${esc(C.slots[k] ?? '')}" maxlength="${s.max || 60}"></div>`).join('')}` : ''}`;
  }
  v.innerHTML = `<header class="hdr">${st ? `<button type="button" class="ib" aria-label="Back" data-act="cback">${I.back}</button>` : `<a class="ib" href="#feed" aria-label="Close">${I.x.replace(/16/g, '20')}</a>`}<span class="ttl">New contest</span><span class="ib" style="font-size:13px;color:var(--sub)">${st + 1}/5</span></header>
    <div class="prog">${[0, 1, 2, 3, 4].map((k) => `<span class="${k <= st ? 'on' : ''}"></span>`).join('')}</div>
    <div class="main" id="cmain">${m}</div>
    <div class="foot">${st < 4 ? `<button type="button" class="cta" data-act="cnext">${st === 3 ? 'Design my game' : 'Continue'}</button>` : `<button type="button" class="cta" data-act="publish" ${C.slots ? '' : 'disabled'}>Publish</button>`}</div>`;
  if (st === 4 && !C.slots) design();
  else if (st === 4) preview();
}

function readStep() {
  const v = (id) => $('#' + id)?.value;
  if (C.step === 3) {
    C.brief = v('brief') ?? C.brief; C.title = (v('title') || 'The Daily Word').trim(); C.word = (v('word') || '').trim().toLowerCase(); if ($('#quiz')) C.quizText = v('quiz');
    C.time = +v('time') || 0; C.tries = +v('tries') || 6; C.questions = parseQuiz(C.quizText); C.prize = (v('prize') || '').trim(); C.winners = +(v('winners') || 1); C.ends = v('ends') || '';
  }
  if (C.step === 4) $$('[data-slot]').forEach((el) => { if (el.type === 'color') return; const v = el.value.trim(); if (v) C.slots[el.dataset.slot] = v; else delete C.slots[el.dataset.slot]; });
}

async function design(extra = '') {
  const pv = $('#pv'); if (pv) pv.innerHTML = '<div class="busy">Designing your game…</div>';
  try {
    const r = await post('/api/design', { game: C.game, questions: C.questions.length, template_id: C.template, brief: [C.brief, extra].filter(Boolean).join('\n'), brand: C.companyName, colors: C.colors, prize: C.prize, tries: C.tries, time: C.time, title: C.title });
    C.slots = { ...(C.slots || {}), ...r.slots };
    if (r.reverted?.length) toast('Some colours were too hard to read, so we kept the defaults');
    renderCreate();
  } catch (e) { if (pv) pv.innerHTML = `<div class="busy">${esc(e.message)}</div>`; }
}
async function compileGame({ server, id }) {
  await compilerReady();
  const vars = varsFor(C.template, { id, word: server ? null : C.word, questions: server ? null : C.questions, tries: C.tries, time: C.time, series: id, brand: C.companyName, slots: C.slots || {} });
  const r = await compiler('compile', { source: await sourceOf(C.template), vars });
  if (!r.ok) throw new Error((r.diagnostics || []).find((d) => d.level === 'error')?.msg || 'the game did not build');
  return r.html;
}
let pvTimer;
async function preview() {
  clearTimeout(pvTimer);
  pvTimer = setTimeout(async () => {
    const pv = $('#pv'); if (!pv) return;
    pv.innerHTML = '<div class="busy">Building your game…</div>';
    try { const html = await compileGame({ server: false, id: 'preview-' + Date.now().toString(36) }); const fr = document.createElement('iframe'); fr.title = 'Your game'; fr.srcdoc = html; pv.innerHTML = ''; pv.appendChild(fr); }
    catch (e) { pv.innerHTML = `<div class="busy">${esc(e.message)}</div>`; }
  }, 250);
}

function dominantColors(img) {
  const cv = document.createElement('canvas'), n = 48; cv.width = n; cv.height = n;
  const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, n, n);
  const d = x.getImageData(0, 0, n, n).data, bins = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 240 && mn > 225) continue;   // paper white
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += r; e.g += g; e.b += b; bins.set(key, e);
  }
  const hexOf = (e) => '#' + [e.r, e.g, e.b].map((v) => Math.round(v / e.n).toString(16).padStart(2, '0')).join('');
  return [...bins.values()].sort((a, b) => b.n - a.n).slice(0, 4).map(hexOf);
}
async function uploadLogo(file) {
  if (!C.companyId) { toast('Name your company first'); return; }
  const url = URL.createObjectURL(file), img = new Image(); img.src = url;
  try { await img.decode(); C.colors = dominantColors(img); } catch { }
  try {
    const r = await api(`/api/companies/${C.companyId}/assets?kind=logo&colors=${encodeURIComponent(C.colors.join(','))}`, { method: 'POST', body: file, headers: { 'content-type': file.type } });
    C.logo = { url: r.url }; await api(`/api/companies/${C.companyId}`, { method: 'PATCH', body: JSON.stringify({ brand: { colors: { primary: C.colors[0], list: C.colors } } }) }).catch(() => { });
    await loadMe(); renderCreate();
  } catch (e) { toast(e.message); }
}

async function publish(btn) {
  btn.disabled = true; btn.textContent = 'Publishing…';
  try {
    readStep();
    const ends = C.type === 'challenge' ? null : (C.ends ? new Date(C.ends).getTime() : null);
    const k = await post('/api/contests', { company_id: C.companyId, brand: C.companyName, game: C.game, questions: C.questions, type: C.type, title: C.title, brief: C.brief, word: C.word, tries: C.tries, time: C.time || null, prize: C.prize || null,
      winners: C.winners, ends_at: ends, contact_fields: Object.keys(C.fields).filter((f) => C.fields[f]), win: C.slots?.win, lose: C.slots?.lose });
    const html = await compileGame({ server: true, id: k.id });
    await api(`/api/contests/${k.id}/page`, { method: 'PUT', body: JSON.stringify({ html, template_id: C.template, slot_values: C.slots }) });
    await post(`/api/contests/${k.id}/publish`);
    Object.assign(C, { step: 0, word: '', prize: '', brief: '', slots: null, ends: '' });
    toast('Published to the feed');
    history.replaceState(null, '', `/c/${k.id}#feed`); F.tab = 'foryou'; route(); loadFeed();
  } catch (e) { toast(e.message, 3500); btn.disabled = false; btn.textContent = 'Publish'; }
}

$('#create').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, v = b.dataset.v;
  if (a === 'signin') return signIn('Sign in to make a contest.');
  if (a === 'game') {
    if (C.game !== v) { C.game = v; C.slots = null; C.template = v === 'trivia' ? 'trivia-classic' : 'pop-player'; C.title = v === 'trivia' ? 'Trivia Sprint' : 'The Daily Word'; C.time = v === 'trivia' ? 90 : 180; }
    return renderCreate();
  }
  if (a === 'quizai') {
    readStep(); b.disabled = true; b.textContent = 'Writing…';
    try { const r = await post('/api/design/quiz', { brand: C.companyName, brief: C.brief, count: 10 }); C.quizText = r.questions.map((x) => [x.q, ...x.options].join(' | ')).join('\n'); if (!r.ai) toast('Sample questions: edit them to fit your business'); }
    catch (err) { toast(err.message); }
    return renderCreate();
  }
  if (a === 'look') { C.template = v; C.slots = null; return renderCreate(); }
  if (a === 'type') { readStep(); C.type = v; C.ends = ''; return renderCreate(); }
  if (a === 'field') { readStep(); if (v === 'email' && C.fields.email) return toast('Email is how the business reaches winners'); C.fields[v] = !C.fields[v]; return renderCreate(); }
  if (a === 'cback') { readStep(); C.step = Math.max(0, C.step - 1); return renderCreate(); }
  if (a === 'publish') return publish(b);
  if (a === 'cnext') {
    readStep();
    if (C.step === 2 && !C.companyId) {
      const name = $('#co').value.trim(); if (name.length < 2) return toast('Give your company a name');
      try { const co = await post('/api/companies', { name }); C.companyId = co.id; C.companyName = co.name; await loadMe(); } catch (err) { return toast(err.message); }
    }
    if (C.step === 3) {
      if (C.game === 'trivia') { const bad = quizProblem(C.quizText); if (bad) return toast(bad); }
      else if (!/^[a-z]{5}$/.test(C.word)) return toast('The word must be five letters, A to Z');
      if (C.type !== 'challenge' && C.ends && new Date(C.ends).getTime() <= Date.now()) return toast('The end has to be in the future');
      C.slots = null;
    }
    C.step = Math.min(4, C.step + 1); renderCreate();
  }
});
$('#create').addEventListener('change', (e) => {
  if (e.target.id === 'logo' && e.target.files[0]) uploadLogo(e.target.files[0]);
  if (e.target.dataset.color != null) { C.colors[+e.target.dataset.color] = e.target.value; if (!C.colors.length) C.colors = [e.target.value]; e.target.parentElement.style.background = e.target.value; }
  if (e.target.dataset.slot && e.target.type === 'color') { C.slots[e.target.dataset.slot] = e.target.value; e.target.parentElement.style.background = e.target.value; preview(); }
  if (e.target.dataset.slot && e.target.type !== 'color') { const v = e.target.value.trim(); if (v) C.slots[e.target.dataset.slot] = v; else delete C.slots[e.target.dataset.slot]; preview(); }
});
$('#create').addEventListener('submit', (e) => { if (e.target.id !== 'askf') return; e.preventDefault(); const t = $('#ask').value.trim(); if (t) design(t); });

// ---------- profile ----------
const P = { tab: 'player' };
async function renderProfile() {
  const v = $('#profile');
  if (!ME.user) {
    v.innerHTML = `<header class="hdr" style="padding-left:16px"><span class="ttl">Profile</span></header><div class="main"><div><h1>Your games, streaks and contests</h1><p class="lede">Play without an account. Sign in to keep your record across devices and to run contests for your business.</p></div><button type="button" class="cta" data-act="signin" style="flex:none">Sign in</button></div>`;
    return;
  }
  const u = ME.user, s = ME.stats || {};
  const tabs = [['player', 'Player'], ...ME.companies.map((c) => [c.id, c.name])];
  if (!tabs.some(([id]) => id === P.tab)) P.tab = 'player';
  v.innerHTML = `<header class="hdr" style="padding-left:16px"><span class="ttl">@${esc(u.handle)}</span><span style="display:flex;gap:4px">${u.role === 'admin' ? '<a class="mbtn" href="#admin" style="display:flex;align-items:center;text-decoration:none">Admin</a>' : ''}<button type="button" class="mbtn" data-act="signout">Sign out</button></span></header>
    <div class="main" style="padding-top:6px">
      <div class="me"><span class="big">${esc(initials(u.display_name || u.handle))}</span><div><div class="n1">${esc(u.display_name || '@' + u.handle)}</div><div class="n2">${esc(u.email)} · <button type="button" data-act="edit" style="border:0;background:none;padding:0;font-weight:700;color:var(--ink);text-decoration:underline">Edit</button></div></div></div>
      ${tabs.length > 1 ? `<div class="seg">${tabs.map(([id, n]) => `<button type="button" class="${P.tab === id ? 'on' : ''}" data-act="ptab" data-v="${esc(id)}">${esc(n)}</button>`).join('')}</div>` : ''}
      <div id="ptab" style="display:flex;flex-direction:column;gap:20px"></div>
      ${ME.companies.length ? '' : '<a class="linkbtn" href="#create">Run a contest for your business</a>'}
    </div>`;
  const box = $('#ptab', v);
  if (P.tab === 'player') {
    box.innerHTML = `<div class="stats"><div class="stat"><b>${s.played || 0}</b><span>Played</span></div><div class="stat"><b>${s.wins || 0}</b><span>Solved</span></div><div class="stat"><b>${s.best ? s.best : '–'}</b><span>Best tries</span></div></div><div class="fld"><div class="h3">Played</div><div class="played" id="pl"><span style="color:var(--sub)">Loading…</span></div></div>
      <div class="fld" style="gap:2px"><div class="h3">Mailing lists</div><div id="ml"><span style="color:var(--sub)">Loading…</span></div></div>`;
    api('/api/me/mailing').then(({ lists }) => { $('#ml', box).innerHTML = lists.length ? lists.map((l) => `<div class="cl" style="align-items:center"><span class="tx"><b>${esc(l.company)}</b><span>Joined ${new Date(l.joined_at).toLocaleDateString()}</span></span><button type="button" class="mbtn" data-act="unsub" data-v="${esc(l.company_id)}">Unsubscribe</button></div>`).join('') : '<span style="color:var(--sub)">You are not on any mailing lists.</span>'; })
      .catch((e) => { $('#ml', box).innerHTML = `<span class="err">${esc(e.message)}</span>`; });
    try {
      const { plays } = await api('/api/me/plays');
      $('#pl', box).innerHTML = plays.length ? plays.map((p) => { const won = p.status === 'won'; return `<a href="/c/${esc(p.contest_id)}#feed" title="${esc(p.title)}"><img src="${esc(p.poster)}" alt="${esc(p.company)}: ${esc(p.title)}" loading="lazy"><span style="background:${won ? 'var(--pink)' : 'var(--ink)'};color:${won ? 'var(--ink)' : '#fff'}">${won ? `Solved ${p.tries}/${p.of}` : p.status === 'playing' ? 'Playing' : 'Missed'}</span></a>`; }).join('') : '<span style="color:var(--sub);grid-column:1/-1">No games yet. Find one in the feed.</span>';
    } catch (e) { $('#pl', box).innerHTML = `<span class="err">${esc(e.message)}</span>`; }
    return;
  }
  box.innerHTML = '<span style="color:var(--sub)">Loading…</span>';
  try {
    const d = await api(`/api/companies/${P.tab}/dashboard`), co = d.company;
    const chip = { live: 'live', scheduled: 'blue', draft: '', ended: 'dark', removed: 'red' };
    box.innerHTML = `<div class="co"><span class="lg">${co.logo ? `<img src="${esc(co.logo)}" alt="">` : esc(initials(co.name))}</span><div style="flex:1;min-width:0"><b style="font-size:16px">${esc(co.name)}</b><div style="font-size:12px;color:var(--sub);margin-top:2px">${esc((co.plan_id || 'free').replace(/^./, (c) => c.toUpperCase()))} · ${co.members} member${co.members === 1 ? '' : 's'} · ${co.followers} follower${co.followers === 1 ? '' : 's'}</div></div></div>
      <div class="kpis"><div class="kpi"><span>Views</span><b>${fmt(d.totals.views)}</b></div><div class="kpi"><span>Plays</span><b>${fmt(d.totals.plays)}</b></div><div class="kpi"><span>Solved</span><b>${fmt(d.totals.wins)}</b></div><div class="kpi"><span>Mailing list</span><b>${fmt(d.totals.mailing)}</b></div><div class="kpi"><span>Opt-in rate</span><b>${d.totals.plays ? Math.round((d.totals.mailing / d.totals.plays) * 100) : 0}%</b></div></div>
      <div class="fld" style="gap:2px"><div class="h3" style="height:34px">Contests<a href="#create">New contest</a></div>
      ${d.contests.length ? d.contests.map((k) => `<a class="cl" href="/c/${esc(k.id)}#feed"><img src="${esc(k.poster)}" alt=""><span class="tx"><b>${esc(k.title)}</b><span>${k.type} · ${k.plays || 0} plays · ${k.entries || 0} entries · ${k.mailing || 0} joined list${k.ends_at ? ` · ${k.status === 'ended' ? 'ended' : 'ends'} ${new Date(k.ends_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</span></span><span class="tag ${chip[k.status] ?? ''}">${k.status}</span></a>`).join('') : '<span style="color:var(--sub)">No contests yet.</span>'}</div>
      <a class="linkbtn" href="/api/companies/${esc(co.id)}/mailing-list.csv" download>${I.down}Export mailing list · ${fmt(d.totals.mailing)} opted in (CSV)</a>
      <a class="linkbtn" href="/api/companies/${esc(co.id)}/entries.csv" download>${I.down}Export draw entries · ${fmt(d.totals.entries)} (CSV)</a>`;
  } catch (e) { box.innerHTML = `<span class="err">${esc(e.message)}</span>`; }
}
$('#profile').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'signin') signIn();
  if (a === 'ptab') { P.tab = b.dataset.v; renderProfile(); }
  if (a === 'unsub') {
    b.disabled = true;
    try { await post('/api/mailing/unsubscribe', { company_id: b.dataset.v }); markJoined(b.dataset.v, false); toast('Unsubscribed'); renderProfile(); }
    catch (err) { b.disabled = false; toast(err.message); }
  }
  if (a === 'signout') { await post('/api/auth/signout').catch(() => { }); await loadMe(); renderProfile(); toast('Signed out'); }
  if (a === 'edit') {
    const s = openSheet(`${sheetHead('Edit profile')}<form class="form" id="mef"><div class="fld"><label for="mh">Handle</label><input class="in" id="mh" value="${esc(ME.user.handle)}" maxlength="20" autocapitalize="none"></div><div class="fld"><label for="mn">Name</label><input class="in" id="mn" value="${esc(ME.user.display_name || '')}" maxlength="60"></div><button class="cta" type="submit">Save</button><div id="mem"></div></form>`);
    $('#mef', s).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try { await api('/api/me', { method: 'PATCH', body: JSON.stringify({ handle: $('#mh', s).value, display_name: $('#mn', s).value }) }); await loadMe(); closeSheet(); renderProfile(); toast('Saved'); }
      catch (err) { $('#mem', s).innerHTML = `<span class="err">${esc(err.message)}</span>`; }
    });
  }
});

// ---------- admin ----------
const A = { tab: 'contests' };
async function renderAdmin() {
  const v = $('#admin');
  if (ME.user?.role !== 'admin') { v.innerHTML = `<header class="hdr" style="padding-left:16px"><span class="ttl">Admin</span></header><div class="main"><p class="lede">This page is for Thebes admins.</p></div>`; return; }
  v.innerHTML = `<header class="hdr"><a class="ib" href="#profile" aria-label="Back">${I.back}</a><span class="ttl">Admin</span><span class="ib"></span></header><div class="main" style="padding-top:6px"><div class="adm-grid" id="ov"></div>
    <div class="seg">${[['contests', 'Contests'], ['users', 'Users'], ['companies', 'Businesses'], ['reports', 'Reports']].map(([id, n]) => `<button type="button" class="${A.tab === id ? 'on' : ''}" data-act="atab" data-v="${id}">${n}</button>`).join('')}</div><div id="alist"><span style="color:var(--sub)">Loading…</span></div></div>`;
  api('/api/admin/overview').then((o) => {
    $('#ov', v).innerHTML = [['Users', o.users.n, `${o.users.week || 0} this week`], ['Businesses', o.companies.n, `${o.companies.suspended || 0} suspended`], ['Live contests', o.contests.live || 0, `${o.contests.ended || 0} ended · ${o.contests.draft || 0} drafts`], ['Plays today', o.plays.today || 0, `${o.plays.n} in all · ${o.reports} open reports`]]
      .map(([k, n, s]) => `<div class="kpi"><span>${k}</span><b>${fmt(n)}</b><span>${s}</span></div>`).join('');
  }).catch((e) => toast(e.message));
  const L = $('#alist', v);
  try {
    if (A.tab === 'contests') {
      const { contests } = await api('/api/admin/contests');
      L.innerHTML = contests.map((k) => `<div class="adm-row"><span class="tx"><b>${esc(k.title)}${k.featured ? ' · featured' : ''}</b><span>${esc(k.company)} · ${k.type} · ${k.status} · ${k.plays || 0} plays · ${k.entries || 0} entries</span></span>
        ${k.status === 'live' ? `<button type="button" class="mbtn" data-aact="${k.featured ? 'unfeature' : 'feature'}" data-id="${k.id}">${k.featured ? 'Unpin' : 'Pin'}</button><button type="button" class="mbtn" data-aact="end" data-id="${k.id}">End</button>` : ''}
        ${k.status === 'removed' ? `<button type="button" class="mbtn" data-aact="restore" data-id="${k.id}">Restore</button>` : `<button type="button" class="mbtn red" data-aact="remove" data-id="${k.id}">Remove</button>`}</div>`).join('') || '<p class="lede">No contests yet.</p>';
    }
    if (A.tab === 'users') {
      const { users } = await api('/api/admin/users');
      L.innerHTML = users.map((u) => `<div class="adm-row"><span class="tx"><b>@${esc(u.handle)}</b><span>${esc(u.email)} · joined ${new Date(u.created_at).toLocaleDateString()}</span></span><select class="mselect" data-role="${u.id}" aria-label="Role for ${esc(u.handle)}">${['user', 'staff', 'admin'].map((r) => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>`).join('');
    }
    if (A.tab === 'companies') {
      const { companies } = await api('/api/admin/companies');
      L.innerHTML = companies.map((c) => `<div class="adm-row"><span class="tx"><b>${esc(c.name)}</b><span>${c.contests} contests · ${c.status}</span></span><select class="mselect" data-plan="${c.id}" aria-label="Plan for ${esc(c.name)}">${['free', 'pro', 'business'].map((p) => `<option ${c.plan_id === p ? 'selected' : ''}>${p}</option>`).join('')}</select><button type="button" class="mbtn ${c.status === 'active' ? 'red' : ''}" data-cstatus="${c.status === 'active' ? 'suspended' : 'active'}" data-id="${c.id}">${c.status === 'active' ? 'Suspend' : 'Restore'}</button></div>`).join('') || '<p class="lede">No businesses yet.</p>';
    }
    if (A.tab === 'reports') {
      const { reports } = await api('/api/admin/reports');
      L.innerHTML = reports.map((r) => `<div class="adm-row"><span class="tx"><b>${esc(r.reason)} · ${esc(r.target_type)}</b><span>${esc(r.note || '')} · by @${esc(r.reporter || '?')} · ${r.status}</span></span>${r.status === 'open' ? `<button type="button" class="mbtn red" data-ract="hide" data-id="${r.id}">Hide it</button><button type="button" class="mbtn" data-ract="dismiss" data-id="${r.id}">Dismiss</button>` : ''}</div>`).join('') || '<p class="lede">No reports.</p>';
    }
  } catch (e) { L.innerHTML = `<span class="err">${esc(e.message)}</span>`; }
}
$('#admin').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act],[data-aact],[data-ract],[data-cstatus]'); if (!b) return;
  try {
    if (b.dataset.act === 'atab') { A.tab = b.dataset.v; return renderAdmin(); }
    if (b.dataset.aact) { if (b.dataset.aact === 'remove' && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Sure?'; return; } await post(`/api/admin/contests/${b.dataset.id}`, { action: b.dataset.aact }); toast('Done'); }
    if (b.dataset.ract) { await post(`/api/admin/reports/${b.dataset.id}`, { action: b.dataset.ract }); toast('Done'); }
    if (b.dataset.cstatus) { await post(`/api/admin/companies/${b.dataset.id}`, { status: b.dataset.cstatus }); toast('Done'); }
    renderAdmin();
  } catch (err) { toast(err.message); }
});
$('#admin').addEventListener('change', async (e) => {
  try {
    if (e.target.dataset.role) { await post(`/api/admin/users/${e.target.dataset.role}`, { role: e.target.value }); toast('Role changed'); }
    if (e.target.dataset.plan) { await post(`/api/admin/companies/${e.target.dataset.plan}`, { plan: e.target.value }); toast('Plan changed'); }
  } catch (err) { toast(err.message); renderAdmin(); }
});

// ---------- routing ----------
function route() {
  let v = location.hash.slice(1);
  if (v === 'signin-expired') { v = 'profile'; setTimeout(() => signIn('That sign-in link has expired or was used. Send a new one.'), 50); }
  if (!['feed', 'create', 'profile', 'admin'].includes(v)) v = 'feed';
  $$('.view').forEach((el) => el.classList.toggle('on', el.id === v));
  $$('nav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === v));
  app.classList.toggle('is-light', v !== 'feed'); app.classList.remove('playing'); closeSheet();
  if (v === 'create') renderCreate(); if (v === 'profile') renderProfile(); if (v === 'admin') renderAdmin();
  if (v !== 'feed') { $$('.slide iframe').forEach((f) => f.remove()); F.active = -1; }
  else if (F.items.length && F.active < 0) { const sl = $('#slides'); activate(Math.round(sl.scrollTop / Math.max(1, sl.clientHeight))); }
}
addEventListener('hashchange', route);
// start: show the feed at once; who is signed in arrives alongside it
clearTimeout(window.__bootTimer); document.getElementById('boot')?.remove();
route();
loadFeed();
loadMe().then(() => { const v = location.hash.slice(1); if (v === 'profile' || v === 'create' || v === 'admin') route(); });
