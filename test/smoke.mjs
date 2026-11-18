// End-to-end against a running Worker (npm run dev, then npm test). Uses local mode: sign-in links are returned, not emailed.
//   BASE=http://127.0.0.1:8787 node test/smoke.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../vendor/godtongue/index.js';
import game from '../vendor/godtongue/engines/game.js';
import { varsFor } from '../public/fill.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { cond ? pass++ : fail++; console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : '  ' + info}`); };

// a tiny cookie jar per person
function person() {
  const jar = new Map();
  const req = async (p, opts = {}) => {
    const r = await fetch(BASE + p, { redirect: 'manual', ...opts, headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(opts.body && typeof opts.body === 'string' ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) } });
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const [k, ...v] = kv.split('='); v.join('=') ? jar.set(k.trim(), v.join('=')) : jar.delete(k.trim()); }
    return r;
  };
  const j = async (p, opts) => { const r = await req(p, opts); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  return { req, j, post: (p, b) => j(p, { method: 'POST', body: JSON.stringify(b || {}) }) };
}
async function signIn(who, email) {
  const s = await who.post('/api/auth/start', { email });
  const link = new URL(s.body.link);
  const r = await who.req(link.pathname + link.search);
  return r.status === 302;
}
async function buildPage(id, brand) {
  const src = fs.readFileSync(path.join(ROOT, 'public/templates/pop-player.gt'), 'utf8');
  const r = compile(src, { vars: varsFor('pop-player', { id, word: null, tries: 6, time: 0, series: id, brand }) });
  if (!r.ok) throw new Error(JSON.stringify(r.diagnostics));
  const out = path.join('/tmp', 'thebes-smoke-' + id);
  await game.build(r.doc, { outDir: out });
  return fs.readFileSync(path.join(out, 'index.html'), 'utf8');
}

const admin = person(), owner = person(), p1 = person(), p2 = person(), anon = person();
ok('admin signs in by link', await signIn(admin, 'admin@thebes.local'));
ok('admin is an admin', (await admin.j('/api/me')).body.user?.role === 'admin');
ok('owner signs in', await signIn(owner, `owner${Date.now()}@diner.example`));
ok('not signed in: cannot like', (await anon.post('/api/contests/x/like')).status === 401);

const co = await owner.post('/api/companies', { name: "Mama's Diner" });
ok('company created', co.status === 200 && co.body.id, JSON.stringify(co.body));
const coId = co.body.id;
ok('outsider cannot make contests for it', (await p1.post('/api/contests', { company_id: coId, type: 'contest', word: 'toast' })).status === 401);

const design = await owner.post('/api/design', { template_id: 'pop-player', brand: "Mama's Diner", colors: ['#e65078', '#141414'], prize: 'Lunch for two', tries: 6, time: 0, title: 'The Daily Word' });
ok('design fills slots and checks them', design.status === 200 && design.body.slots.sponsor === '#e65078' && design.body.slots.win?.length <= 48, JSON.stringify(design.body));

ok('word must be in the list', (await owner.post('/api/contests', { company_id: coId, type: 'contest', word: 'zzzzz' })).status === 400);
const k = await owner.post('/api/contests', { company_id: coId, brand: "Mama's Diner", type: 'contest', title: 'The Daily Word', word: 'toast', tries: 6, prize: 'Lunch for two', winners: 2, ends_at: Date.now() + 3600e3, contact_fields: ['email', 'name'] });
ok('contest draft created', k.status === 200 && k.body.id, JSON.stringify(k.body));
const kid = k.body.id;

// the local-mode page (word inside) must be refused; the server-mode page accepted
const srcLocal = compile(fs.readFileSync(path.join(ROOT, 'public/templates/pop-player.gt'), 'utf8'), { vars: varsFor('pop-player', { id: kid, word: 'toast', brand: 'X' }) });
const outL = '/tmp/thebes-smoke-local'; await game.build(srcLocal.doc, { outDir: outL });
ok('a page with the word in it is refused', (await owner.j(`/api/contests/${kid}/page`, { method: 'PUT', body: JSON.stringify({ html: fs.readFileSync(outL + '/index.html', 'utf8'), template_id: 'pop-player' }) })).status === 400);
const html = await buildPage(kid, "Mama's Diner");
ok('built page keeps the word out', !html.includes('"toast"'));
const put = await owner.j(`/api/contests/${kid}/page`, { method: 'PUT', body: JSON.stringify({ html, template_id: 'pop-player', slot_values: design.body.slots }) });
ok('page uploaded', put.status === 200, JSON.stringify(put.body));
ok('draft is not in the feed', !(await anon.j('/api/feed')).body.items.some((x) => x.id === kid));
ok('draft page hidden from strangers', (await anon.req(`/play/${kid}`)).status === 404);
const pub = await owner.post(`/api/contests/${kid}/publish`);
ok('published live', pub.body.status === 'live', JSON.stringify(pub.body));

const feed = (await anon.j('/api/feed')).body.items, card = feed.find((x) => x.id === kid);
ok('in the feed with a leaderboard', card && card.leaderboard === true && card.closed === false && card.prize === 'Lunch for two');
const page = await (await anon.req(`/play/${kid}`)).text();
ok('play page served with the guess endpoint', page.includes(`window.GAME_API="/api/contests/${kid}/play"`));

// player 1: solves in 2; player 2: solves in 3; anonymous: plays and misses
ok('p1 signs in', await signIn(p1, `kofi${Date.now()}@example.com`));
ok('p2 signs in', await signIn(p2, `ada${Date.now()}@example.com`));
const st = await p1.post(`/api/contests/${kid}/play/start`);
ok('start a play', st.status === 200 && st.body.status === 'playing' && Array.isArray(st.body.moves) && !st.body.answer);
const notWord = await p1.post(`/api/contests/${kid}/play/guess`, { guess: 'qxzvj' });
ok('not a word is refused', notWord.status === 400 && notWord.body.code === 'not_a_word');
const g1 = await p1.post(`/api/contests/${kid}/play/guess`, { guess: 'crane' });
ok('guess scored on the server', JSON.stringify(g1.body.result) === JSON.stringify(['absent', 'absent', 'correct', 'absent', 'absent']) && g1.body.status === 'playing' && !g1.body.answer, JSON.stringify(g1.body));
const g2 = await p1.post(`/api/contests/${kid}/play/guess`, { guess: 'toast' });
ok('solved', g2.body.status === 'won' && g2.body.tries === 2, JSON.stringify(g2.body));
ok('no more guesses after solving', (await p1.post(`/api/contests/${kid}/play/guess`, { guess: 'crane' })).status === 409);
const resume = await p1.post(`/api/contests/${kid}/play/start`);
ok('resume returns the moves', resume.body.moves.length === 2 && resume.body.status === 'won');
await p2.post(`/api/contests/${kid}/play/start`);
for (const w of ['crane', 'stout', 'toast']) await p2.post(`/api/contests/${kid}/play/guess`, { guess: w });
await anon.post(`/api/contests/${kid}/play/start`);
let last; for (const w of ['crane', 'stout', 'blink', 'chair', 'dwell', 'frump']) last = await anon.post(`/api/contests/${kid}/play/guess`, { guess: w });
ok('missing all tries loses and shows the word', last.body.status === 'lost' && last.body.answer === 'toast', JSON.stringify(last.body));

const lb = (await p2.j(`/api/contests/${kid}/leaderboard`)).body;
ok('leaderboard ranks by tries', lb.rows.length === 2 && lb.rows[0].tries === 2 && lb.rows[1].tries === 3 && lb.rows[1].you === true, JSON.stringify(lb.rows));
ok('my rank', lb.me?.rank === 2);
ok('totals', lb.totals.players === 3 && lb.totals.winners === 2, JSON.stringify(lb.totals));
const pl = (await anon.j(`/api/contests/${kid}/players`)).body;
ok('participants listed, guests too', pl.total === 3 && pl.players.some((x) => x.name.startsWith('Guest')) && pl.players.some((x) => x.status === 'won'), JSON.stringify(pl));

// social and contacts
ok('like', (await p1.post(`/api/contests/${kid}/like`)).body.liked === true);
ok('comment', (await p1.post(`/api/contests/${kid}/comments`, { body: 'Got it in two!' })).status === 200);
ok('follow', (await p1.post(`/api/companies/${coId}/follow`)).body.following === true);
ok('entry needs a tick', (await p1.post(`/api/contests/${kid}/entry`, { email: 'kofi@example.com' })).status === 400);
ok('entry saved without the mailing list', (await p1.post(`/api/contests/${kid}/entry`, { email: 'kofi@example.com', name: 'Kofi', consent: true })).status === 200);
const csv = await (await owner.req(`/api/companies/${coId}/entries.csv`)).text();
ok('owner exports entries with what they agreed to', csv.includes('kofi@example.com') && csv.includes('Enter me in the draw'));
let ml = await (await owner.req(`/api/companies/${coId}/mailing-list.csv`)).text();
ok('mailing list is empty until someone opts in', !ml.includes('kofi@example.com'));
ok('player opts in to the mailing list', (await p1.post(`/api/contests/${kid}/entry`, { email: 'kofi@example.com', name: 'Kofi', consent: true, mailing: true })).status === 200);
ml = await (await owner.req(`/api/companies/${coId}/mailing-list.csv`)).text();
ok('mailing list has only opted-in players', ml.includes('kofi@example.com') && ml.includes('mailing list'));
ok('mailing list is members only', (await p1.req(`/api/companies/${coId}/mailing-list.csv`)).status === 403);
ok('players cannot export', (await p1.req(`/api/companies/${coId}/entries.csv`)).status === 403);
const card2 = (await p1.j(`/api/contests/${kid}`)).body.item;
ok('card shows counts and participants', card2.liked && card2.counts.likes === 1 && card2.counts.comments === 1 && card2.counts.players === 3 && card2.participants.length === 3 && card2.company.followed, JSON.stringify(card2.counts));
const dash = (await owner.j(`/api/companies/${coId}/dashboard`)).body;
ok('business dashboard', dash.totals.plays === 3 && dash.totals.entries === 1 && dash.contests[0].id === kid, JSON.stringify(dash.totals));

// admin closes it: winners are picked, play stops, the feed shows it closed
ok('non-admin cannot end', (await owner.post(`/api/admin/contests/${kid}`, { action: 'end' })).status === 403);
ok('admin ends it', (await admin.post(`/api/admin/contests/${kid}`, { action: 'end' })).status === 200);
const closed = (await anon.j(`/api/contests/${kid}`)).body.item;
ok('closed with two winners in order', closed.closed && closed.winners.length === 2 && closed.winners[0].tries === 2 && closed.winners[0].prize === 'Lunch for two', JSON.stringify(closed.winners));
ok('no more play once closed', (await p2.post(`/api/contests/${kid}/play/start`)).body.closed === true);
const p3 = person(); const late = await p3.post(`/api/contests/${kid}/play/start`);
ok('a newcomer sees it closed', late.body.closed === true);
const ov = (await admin.j('/api/admin/overview')).body;
ok('admin overview', ov.users.n >= 4 && ov.contests.ended >= 1, JSON.stringify(ov));

// dailies belong to a series and are numbered
const d1 = await owner.post('/api/contests', { company_id: coId, brand: "Mama's Diner", type: 'daily', title: 'The Daily Word', word: 'crane' });
const d2 = await owner.post('/api/contests', { company_id: coId, brand: "Mama's Diner", type: 'daily', title: 'The Daily Word', word: 'stout' });
ok('dailies are created as episodes 1 and 2 of one series', d1.status === 200 && d2.status === 200 && d1.body.episode === 1 && d2.body.episode === 2, JSON.stringify([d1.body, d2.body]));

// a challenge has no leaderboard and no winners
const ch = await owner.post('/api/contests', { company_id: coId, brand: "Mama's Diner", type: 'challenge', title: 'Quick one', word: 'crane' });
await owner.j(`/api/contests/${ch.body.id}/page`, { method: 'PUT', body: JSON.stringify({ html: await buildPage(ch.body.id, "Mama's Diner"), template_id: 'pop-player' }) });
await owner.post(`/api/contests/${ch.body.id}/publish`);
ok('a challenge has no leaderboard', (await anon.j(`/api/contests/${ch.body.id}`)).body.item.leaderboard === false);
ok('admin removes it', (await admin.post(`/api/admin/contests/${ch.body.id}`, { action: 'remove' })).status === 200 && (await anon.j(`/api/contests/${ch.body.id}`)).status === 410);

// ---------- trivia ----------
const QUIZ = [
  { q: 'What do we bake every morning?', options: ['Sourdough', 'Rye', 'Brioche', 'Bagel'] },
  { q: 'What year did we open?', options: ['1987', '1999', '2005', '2012'] },
  { q: 'Which pie sells out first?', options: ['Apple', 'Pecan', 'Cherry'] },
];
ok('trivia needs 3 questions', (await owner.post('/api/contests', { company_id: coId, game: 'trivia', type: 'contest', questions: QUIZ.slice(0, 2) })).status === 400);
ok('trivia refuses a repeated answer', (await owner.post('/api/contests', { company_id: coId, game: 'trivia', type: 'contest', questions: [...QUIZ.slice(0, 2), { q: 'x?', options: ['a', 'A'] }] })).status === 400);
const qz = await owner.post('/api/design/quiz', { brand: "Mama's Diner", brief: 'a diner', count: 5 });
ok('quiz writer returns checked questions', qz.status === 200 && qz.body.questions.length >= 3, JSON.stringify(qz.body));
const tdesign = await owner.post('/api/design', { game: 'trivia', questions: 3, template_id: 'trivia-classic', brand: "Mama's Diner", colors: ['#D0BCFF'], prize: 'Pie', time: 90, title: 'Diner Trivia' });
ok('trivia design fills its slots', tdesign.status === 200 && /THREE QUESTIONS/.test(tdesign.body.slots.subtitle || ''), JSON.stringify(tdesign.body));
const tk = await owner.post('/api/contests', { company_id: coId, brand: "Mama's Diner", game: 'trivia', type: 'contest', title: 'Diner Trivia', questions: QUIZ, time: 90, prize: 'Pie', winners: 1, ends_at: Date.now() + 3600e3 });
ok('trivia contest created', tk.status === 200 && tk.body.game === 'trivia' && tk.body.settings.tries === 3, JSON.stringify(tk.body));
const tid = tk.body.id;
const tsrc = fs.readFileSync(path.join(ROOT, 'public/templates/trivia-classic.gt'), 'utf8');
const tLocal = compile(tsrc, { vars: varsFor('trivia-classic', { id: tid, questions: QUIZ, time: 90, brand: 'X' }) });
ok('trivia template compiles with questions', tLocal.ok, JSON.stringify(tLocal.diagnostics));
await game.build(tLocal.doc, { outDir: '/tmp/thebes-smoke-tl' });
ok('a trivia page with the questions in it is refused', (await owner.j(`/api/contests/${tid}/page`, { method: 'PUT', body: JSON.stringify({ html: fs.readFileSync('/tmp/thebes-smoke-tl/index.html', 'utf8') }) })).status === 400);
ok('a wordle page is refused for a trivia contest', (await owner.j(`/api/contests/${tid}/page`, { method: 'PUT', body: JSON.stringify({ html }) })).status === 400);
const tServer = compile(tsrc, { vars: varsFor('trivia-classic', { id: tid, questions: null, time: 90, brand: 'X' }) });
ok('server-mode trivia compiles', tServer.ok, JSON.stringify(tServer.diagnostics));
await game.build(tServer.doc, { outDir: '/tmp/thebes-smoke-ts' });
const thtml = fs.readFileSync('/tmp/thebes-smoke-ts/index.html', 'utf8');
ok('trivia page keeps the questions out', !thtml.includes('Sourdough') && thtml.includes('"server":true'));
ok('trivia page uploaded', (await owner.j(`/api/contests/${tid}/page`, { method: 'PUT', body: JSON.stringify({ html: thtml }) })).status === 200);
ok('trivia published', (await owner.post(`/api/contests/${tid}/publish`)).body.status === 'live');
const ts = await p1.post(`/api/contests/${tid}/play/start`);
ok('trivia start sends questions, not answers', ts.status === 200 && ts.body.questions.length === 3 && !JSON.stringify(ts.body).includes('"right"') && ts.body.questions[0].options.length === 4, JSON.stringify(ts.body));
const opts = ts.body.questions.map((x) => x.options);
const rightIx = (n) => opts[n].indexOf(QUIZ[n].options[0]);
ok('answers must come in order', (await p1.post(`/api/contests/${tid}/play/guess`, { n: 1, pick: 0 })).status === 409);
const a1 = await p1.post(`/api/contests/${tid}/play/guess`, { n: 0, pick: rightIx(0) });
ok('right answer scored', a1.body.correct === true && a1.body.right === rightIx(0) && a1.body.status === 'playing', JSON.stringify(a1.body));
const a2 = await p1.post(`/api/contests/${tid}/play/guess`, { n: 1, pick: (rightIx(1) + 1) % 4 });
ok('wrong answer scored', a2.body.correct === false && a2.body.right === rightIx(1));
const a3 = await p1.post(`/api/contests/${tid}/play/guess`, { n: 2, pick: rightIx(2) });
ok('last answer ends the game', a3.body.status === 'won', JSON.stringify(a3.body));
ok('no answers after the end', (await p1.post(`/api/contests/${tid}/play/guess`, { n: 3, pick: 0 })).status === 409);
const tr = await p1.post(`/api/contests/${tid}/play/start`);
ok('trivia resume returns the answers given', tr.body.status === 'won' && tr.body.moves.length === 3 && tr.body.moves[0].right === rightIx(0));
await p2.post(`/api/contests/${tid}/play/start`);
for (let n = 0; n < 3; n++) await p2.post(`/api/contests/${tid}/play/guess`, { n, pick: rightIx(n) });
const tlb = (await anon.j(`/api/contests/${tid}/leaderboard`)).body;
ok('trivia leaderboard: most right first', tlb.rows.length === 2 && tlb.rows[0].tries === 3 && tlb.rows[1].tries === 2, JSON.stringify(tlb.rows));
const tpl = (await anon.j('/api/templates')).body.templates;
ok('templates say which game', tpl.some((x) => x.id === 'trivia-classic' && x.game === 'trivia') && tpl.some((x) => x.id === 'pop-player' && x.game === 'wordle'));

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
