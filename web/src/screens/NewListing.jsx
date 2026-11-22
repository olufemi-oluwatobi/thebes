import { useEffect, useState } from 'react';
import { useStore, prodOf } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { TYPES, GOALS, NEW_GOALS, SYM, FEE, money, kindOf, bgFor, PLATFORMS, COUNTRIES } from '../lib/data.js';
import { GoalIcon } from '../ui/goals.jsx';
import { Page, PageTitle, Card, Rows, Button, Input, Textarea, Field, Switch, Segmented, Pills, Select, Radio, Ic, ProductArt, Art, Sheet, Avatar, Chip, cx } from '../ui/index.jsx';
import { Stepper, useGate, takeDraft, fileToData, dataToFile } from '../ui/wizard.jsx';

// each goal: its reward fields (entered in currency units), suggested amounts and who it suits by default
const DEF = {
  traffic: { terms: { rate: '0.10', daily_cap: '' }, job: '20', platforms: [], minf: 0, delivery: null },
  sales: { terms: { mode: 'percent', percent: '15', amount: '' }, job: '50', platforms: [], minf: 0, delivery: null },
  newsletter: { terms: { rate: '0.50' }, job: '25', platforms: [], minf: 0, delivery: null },
  story: { terms: { fee: '10' }, job: '10', platforms: ['instagram', 'whatsapp', 'tiktok', 'facebook'], minf: 0, delivery: 'social_post' },
  review: { terms: { fee: '50' }, job: '50', platforms: ['youtube', 'tiktok', 'instagram'], minf: 1000, delivery: 'video' },
};
const TITLE = { traffic: (p) => 'Send people to ' + p, sales: (p) => 'Sell ' + p + ' and earn on every order', newsletter: (p) => 'Grow the ' + p + ' newsletter', story: (p) => 'Put ' + p + ' in your story', review: (p) => 'Review ' + p + ' on video' };
const UNIT = { traffic: 'click', sales: 'sale', newsletter: 'subscriber', story: 'story', review: 'video' };
const PROOF = { traffic: 'Counted automatically through their link.', sales: 'Counted through their link. Paid once the order clears.', newsletter: 'Counted through their sign-up link.', story: 'They send a screenshot and link. You approve it.', review: 'They send the video link. You approve it.' };
const empty = (pid) => ({ step: pid ? 2 : 1, pid: pid || null, type: null, terms: {}, budgetOn: false, cur: 'USD', budget: '', cap: '', platforms: [], minf: 0, countries: [], verified: false, verifiedSocials: false, max: 0, delivery: null, title: '', files: [], job: '' });
const cents = (v) => Math.round((+v || 0) * 100);
// the terms the API stores (money in cents)
const termsOf = (L) => { const t = { ...DEF[L.type]?.terms, ...L.terms };
  if (L.type === 'traffic') return { rate_cents: cents(t.rate), ...(+t.daily_cap ? { daily_cap: Math.round(+t.daily_cap) } : {}) };
  if (L.type === 'sales') return t.mode === 'fixed' ? { amount_cents: cents(t.amount) } : { percent: +t.percent };
  if (L.type === 'newsletter') return { rate_cents: cents(t.rate) };
  return { fee_cents: cents(t.fee) }; };
const unitCents = (t) => t.rate_cents || t.amount_cents || t.fee_cents || 0;

export default function NewListing({ pid }) {
  const { S, a } = useStore(), gate = useGate();
  const [L, setL] = useState(() => empty(pid)), [busy, setBusy] = useState(false), [prev, setPrev] = useState(false);
  const set = (x) => setL(q => ({ ...q, ...x }));
  useEffect(() => { if (S.auth === 'in' && a.hasSeller && !S.myProductIds) a.loadSeller(); }, [S.auth, a.hasSeller]);
  useEffect(() => { if (pid && !prodOf(S, pid)?.full) a.loadProduct(pid); }, [pid]);
  useEffect(() => { const d = takeDraft(); if (!d?.L) return; const { fileData, ...rest } = d.L; setL({ ...empty(pid), ...rest, files: [] });
    if (fileData?.length) Promise.all(fileData.map(dataToFile)).then(fs => setL(q => ({ ...q, files: fs.filter(Boolean).map(f => ({ file: f, url: URL.createObjectURL(f) })) })));
    a.toast('Welcome back. Your listing is still here.'); }, []);
  const p = L.pid ? prodOf(S, L.pid) : null, products = (S.myProductIds || []).map(id => prodOf(S, id)).filter(Boolean);
  const steps = pid ? ['Goal', 'Reward', 'Creators', 'Brief', 'Review'] : ['Product', 'Goal', 'Reward', 'Creators', 'Brief', 'Review'];
  const st = L.step, idx = pid ? st - 1 : st, T = L.type ? TYPES[L.type] : null, t = L.type ? termsOf(L) : null;
  const budget = null, cap = null;
  const job = cents(L.job || DEF[L.type]?.job), jobFee = Math.round(job * FEE / 10000), wal = S.wallet?.balance?.USD ?? null;
  useEffect(() => { if (S.auth === 'in') a.loadWallet(); }, [S.auth]);
  const tv = (k) => (L.terms[k] ?? DEF[L.type]?.terms?.[k] ?? '');
  const setT = (k, v) => set({ terms: { ...L.terms, [k]: v } });
  const thumb = p?.img;
  const pickGoal = (k) => set({ type: k, terms: {}, job: '', platforms: DEF[k].platforms, minf: DEF[k].minf, delivery: DEF[k].delivery, step: 3 });
  const addFiles = (e) => { const fs = [...e.target.files]; e.target.value = '';
    const ok = fs.filter(f => /^(image|video)\//.test(f.type) && f.size <= (f.type.startsWith('video/') ? 50 : 5) * 1048576);
    if (ok.length < fs.length) a.toast('Images up to 5 MB, videos up to 50 MB');
    set({ files: [...L.files, ...ok.map(f => ({ file: f, url: URL.createObjectURL(f) }))].slice(0, 6) }); };

  const valid = () => {
    if (st === 1) return !L.pid && 'Pick a product, or add a new one';
    if (st === 2) return !L.type && 'Pick what you want creators to do';
    if (st === 3) {
      if (L.type === 'sales' && tv('mode') === 'percent' && !(+tv('percent') >= 1 && +tv('percent') <= 90)) return 'Commission is between 1% and 90%';
      if (L.type === 'sales' && tv('mode') === 'fixed' && !(+tv('amount') >= 0.01)) return 'Enter what each sale pays';
      if (['traffic', 'newsletter'].includes(L.type) && !(+tv('rate') >= 0.01)) return 'The rate must be at least ' + SYM[L.cur].trim() + '0.01';
      if (['story', 'review'].includes(L.type) && !(+tv('fee') >= 1)) return 'The fee must be at least ' + SYM[L.cur].trim() + '1';
      if (!(job >= 100)) return 'The budget per creator is at least ' + SYM[L.cur].trim() + '1';
    }
    if (st === 5 && L.title.trim() && L.title.trim().length < 3) return 'The name needs at least 3 characters';
    return null;
  };
  const publish = async () => { setBusy(true); const id = await a.addOffer({ ...L, title: L.title.trim() || TITLE[L.type](p.name), terms: t, budget: null, cap: null, job }, p); setBusy(false); if (id) go('offer/' + id); };
  const next = () => {
    const err = valid(); if (err) return a.toast(err);
    if (st < 6) return set({ step: st + 1 });
    if (busy) return;
    if (gate('seller', publish, async () => ({ L: { ...L, files: [], fileData: (await Promise.all(L.files.filter(f => f.file.size < 2 * 1048576).map(f => fileToData(f.file)))).filter(Boolean) } }))) publish();
  };
  const back = () => st > (pid ? 2 : 1) ? set({ step: st - 1 }) : go('plus');
  const titles = { 1: ['Which product is this listing for?', 'A listing is one ask for one product. You can make several per product.'], 2: ['What do you want the community to do for you?', 'One goal per listing. Make another listing for a different goal.'], 3: ['How do you want to reward them?', 'What a result earns, and the budget each creator gets.'], 4: ['What kind of creator?', 'Leave it open to get more applicants. You still accept each one.'], 5: ['Name your listing', 'Links and details come from your product. Attach anything that helps.'], 6: ['Review and publish', 'It goes live right away. Money is only held when you take someone on.'] }[st];
  const label = st === 6 ? (busy ? 'Publishing…' : 'Publish listing') : 'Continue';

  return (
    <Page crumb="Create" onBack={back} sub={<Stepper steps={steps} st={idx} />} barDesktop
      bar={<><Button tone="secondary" onClick={back}>Back</Button>{st > 1 && st < 6 && <Button tone="ghost" className="lg:hidden" onClick={() => setPrev(true)}>Preview</Button>}<span className="flex-1" /><Button disabled={busy} onClick={next}>{label}</Button></>}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {p && st > 1 && <button onClick={() => !pid && set({ step: 1 })} className="flex items-center gap-3 self-start rounded-full bg-paper py-1.5 pl-1.5 pr-4"><ProductArt p={p} fit="80%" className="h-8 w-8 rounded-full" /><span className="text-small font-semibold">{p.name}</span>{!pid && <span className="text-caption text-ink-faint">Change</span>}</button>}
          <PageTitle h={titles[0]} p={titles[1]} className="!mb-0" />
          {st === 1 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <button onClick={() => go('plus/product')} className="flex flex-col overflow-hidden rounded-card bg-army text-left text-onarmy"><span className="grid aspect-[4/3] place-items-center"><span className="grid h-12 w-12 place-items-center rounded-card bg-sage text-army"><Ic.Plus /></span></span><span className="p-4 font-semibold">New product</span></button>
              {products.map(x => <button key={x.id} onClick={() => set({ pid: x.id, step: 2 })} className={cx('relative flex flex-col overflow-hidden rounded-card bg-paper text-left transition hover:shadow-lift', L.pid === x.id && 'ring-2 ring-army')}><ProductArt p={x} fit="70%" className="aspect-[4/3] w-full" /><span className="p-4"><span className="line-clamp-1 block font-semibold">{x.name}</span><span className="text-caption text-ink-soft">{kindOf(x.kind)[1]}</span></span></button>)}
            </div>)}
          {st === 2 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{NEW_GOALS.map(([k, h, d]) => { const on = L.type === k; return (
              <button key={k} onClick={() => pickGoal(k)} aria-pressed={on} className={cx('flex aspect-square flex-col items-center justify-center gap-3 rounded-card bg-paper p-4 text-center transition', on ? 'ring-2 ring-army' : 'hover:bg-cream-100')}>
                <GoalIcon k={k} className="h-16 w-16 sm:h-20 sm:w-20" />
                <span><span className="block font-semibold leading-tight">{h}</span><span className="mt-1 hidden text-caption text-ink-soft sm:block">{d}</span></span>
              </button>); })}</div>)}
          {st === 3 && T && (<>
            <Card title={GOALS.find(g => g[0] === L.type)[1]} sub={'You pay for: ' + GOALS.find(g => g[0] === L.type)[3].toLowerCase() + '. ' + PROOF[L.type]}>
              {L.type === 'traffic' && <div className="grid gap-5 sm:grid-cols-2"><Field label="Per click"><Input type="number" min="0.01" step="0.01" pre={SYM[L.cur].trim()} value={tv('rate')} onChange={e => setT('rate', e.target.value)} /></Field><Field label="Daily limit per creator" aside={<span className="text-caption text-ink-faint">Optional</span>}><Input type="number" min="1" suf="clicks" placeholder="No limit" value={tv('daily_cap')} onChange={e => setT('daily_cap', e.target.value)} /></Field></div>}
              {L.type === 'sales' && <div className="flex flex-col gap-5"><Segmented value={tv('mode')} onChange={v => setT('mode', v)} items={[['percent', '% of each order'], ['fixed', 'Fixed per sale']]} />
                {tv('mode') === 'percent' ? <Field label="Commission" help="Of each order a creator brings."><Input type="number" min="1" max="90" suf="%" value={tv('percent')} onChange={e => setT('percent', e.target.value)} /></Field>
                  : <Field label="Per sale"><Input type="number" min="0.01" step="0.01" pre={SYM[L.cur].trim()} placeholder="5.00" value={tv('amount')} onChange={e => setT('amount', e.target.value)} /></Field>}</div>}
              {L.type === 'newsletter' && <Field label="Per subscriber"><Input type="number" min="0.01" step="0.01" pre={SYM[L.cur].trim()} value={tv('rate')} onChange={e => setT('rate', e.target.value)} /></Field>}
              {(L.type === 'story' || L.type === 'review') && <Field label={L.type === 'story' ? 'Per story' : 'Per video'}><Input type="number" min="1" step="1" pre={SYM[L.cur].trim()} value={tv('fee')} onChange={e => setT('fee', e.target.value)} /></Field>}
            </Card>
            <Card title="Budget per creator" sub="Held from your wallet when you take someone on. Paid to them when the job is done, or returned if it's cancelled.">
              <Field label="Each creator gets up to"><Input type="number" min="1" step="1" pre={SYM[L.cur].trim()} value={L.job || DEF[L.type].job} onChange={e => set({ job: e.target.value })} /></Field>
              {job > 0 && <div className="mt-4 rounded-2xl bg-cream-50 p-4"><Rows rows={[['Budget per creator', money(job, L.cur)], ['Fee (' + FEE / 100 + '%)', money(jobFee, L.cur)], ['Held per creator', <b>{money(job + jobFee, L.cur)}</b>]]} />
                {unitCents(t) > 0 && !t.percent && <p className="mt-3 text-small text-sage-700">That's about {Math.max(1, Math.floor(job / unitCents(t))).toLocaleString()} {UNIT[L.type] === 'story' ? (Math.floor(job / unitCents(t)) === 1 ? 'story' : 'stories') : UNIT[L.type] + (Math.floor(job / unitCents(t)) === 1 ? '' : 's')} per creator.</p>}
                {wal != null && <p className={cx('mt-2 text-small', wal >= job + jobFee ? 'text-ink-soft' : 'text-[#8A6414]')}>Your wallet: {money(wal, L.cur)}{wal >= job + jobFee ? ' · enough for ' + Math.floor(wal / (job + jobFee)) + ' creator' + (Math.floor(wal / (job + jobFee)) === 1 ? '' : 's') : ' · top up before you accept anyone'}</p>}
              </div>}
            </Card>
          </>)}
          {st === 4 && (
            <Card><div className="flex flex-col gap-6">
              <Field label="Where should they post?" help={L.delivery ? 'Suggested for this goal. Leave all off to accept any platform.' : 'Leave all off to accept any platform.'}><Pills multi value={L.platforms} onChange={c => set({ platforms: L.platforms.includes(c) ? L.platforms.filter(x => x !== c) : [...L.platforms, c] })} items={PLATFORMS} /></Field>
              <Field label="Audience size"><Pills value={String(L.minf)} onChange={v => set({ minf: +v })} items={[['0', 'Any size'], ['1000', '1k+'], ['10000', '10k+'], ['50000', '50k+'], ['100000', '100k+']]} /></Field>
              <Field label="Where they're based" help="Leave all off to accept creators anywhere."><Pills multi value={L.countries} onChange={c => set({ countries: L.countries.includes(c) ? L.countries.filter(x => x !== c) : [...L.countries, c] })} items={COUNTRIES} /></Field>
              <Field label="How many creators"><Pills value={String(L.max)} onChange={v => set({ max: +v })} items={[['0', 'No limit'], ['5', '5'], ['10', '10'], ['25', '25'], ['50', '50']]} /></Field>
              <div className="h-px bg-cream-100" />
              <Switch on={L.verifiedSocials} onChange={v => set({ verifiedSocials: v })} label="Verified accounts only" sub="Follower counts are checked by us, not just claimed." />
              <Switch on={L.verified} onChange={v => set({ verified: v })} label="Verified creators only" sub="The creator's identity has been checked." />
            </div></Card>)}
          {st === 5 && p && (<>
            <Card><Field label="Listing name"><Input value={L.title} maxLength={120} onChange={e => set({ title: e.target.value })} placeholder={TITLE[L.type](p.name)} /></Field></Card>
            <Card title="Attachments" sub="Optional. Photos, clips or anything creators should see. Up to 6.">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {L.files.map((f, i) => (
                  <div key={f.url} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-cream-100">
                    {f.file.type.startsWith('video/') ? <video src={f.url} muted playsInline className="h-full w-full object-cover" /> : <img src={f.url} alt="" className="h-full w-full object-cover" />}
                    <button aria-label="Remove" onClick={() => set({ files: L.files.filter((_, j) => j !== i) })} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white"><Ic.X_ width="14" height="14" /></button>
                  </div>))}
                {L.files.length < 6 && <label className="grid aspect-[4/3] cursor-pointer place-items-center rounded-xl border-2 border-dashed border-cream-300 text-center text-caption font-semibold text-ink-soft hover:border-army/40"><span className="flex flex-col items-center gap-1"><Ic.Up width="18" height="18" />Add</span><input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm" className="sr-only" onChange={addFiles} /></label>}
              </div>
            </Card>
          </>)}
          {st === 6 && p && (<>
            <div className="lg:hidden"><FeedPreview L={L} p={p} thumb={thumb} /></div>
            <Card title="What you're asking" action={<button className="text-small font-semibold text-sage-700 hover:underline" onClick={() => set({ step: 2 })}>Edit</button>}><Rows rows={[['Product', p.name], ['Goal', GOALS.find(g => g[0] === L.type)[1]], ['Reward', T.reward(t, L.cur) + ' ' + T.sub(t, L.cur)], ['Name', L.title.trim() || TITLE[L.type](p.name)], L.files.length > 0 && ['Attachments', L.files.length + ' file' + (L.files.length > 1 ? 's' : '')]]} /></Card>
            <Card title="Who can apply" action={<button className="text-small font-semibold text-sage-700 hover:underline" onClick={() => set({ step: 4 })}>Edit</button>}><Rows rows={[['Platforms', L.platforms.length ? L.platforms.map(x => PLATFORMS.find(q => q[0] === x)[1]).join(', ') : 'Any'], ['Audience', L.minf ? L.minf.toLocaleString() + '+ followers' : 'Any size'], ['Based in', L.countries.length ? L.countries.join(', ') : 'Anywhere'], ['How many', L.max ? 'Up to ' + L.max : 'No limit'], ['Verified', [L.verifiedSocials && 'Accounts', L.verified && 'Creators'].filter(Boolean).join(' and ') || 'Not required']]} /></Card>
            <Card title="Payment" action={<button className="text-small font-semibold text-sage-700 hover:underline" onClick={() => set({ step: 3 })}>Edit</button>}><Rows rows={[['Budget per creator', money(job, L.cur)], ['Fee (' + FEE / 100 + '%)', money(jobFee, L.cur)], ['Held when you accept someone', <b>{money(job + jobFee, L.cur)}</b>], wal != null && ['Your wallet', money(wal, L.cur)]]} />{wal != null && wal < job + jobFee && <button onClick={() => go('topup')} className="mt-3 text-small font-semibold text-sage-700 hover:underline">Top up your wallet</button>}</Card>
          </>)}
        </div>
        <aside className="hidden lg:block"><div className="sticky top-0">{p && st > 1 ? <FeedPreview L={L} p={p} thumb={thumb} /> : null}</div></aside>
      </div>
      <Sheet open={prev} onClose={() => setPrev(false)} title="Feed preview">{p && <FeedPreview L={L} p={p} thumb={thumb} />}</Sheet>
    </Page>
  );
}

// how the listing will look in the feed
function FeedPreview({ L, p, thumb }) {
  const { a } = useStore();
  const T = L.type ? TYPES[L.type] : null, t = L.type ? termsOf(L) : null;
  return (
    <div className="overflow-hidden rounded-3xl text-white shadow-lift" style={{ background: bgFor(p) }}>
      <div className="flex items-center justify-between px-5 pt-4 text-caption font-semibold uppercase tracking-wider text-white/60"><span>Feed preview</span><span className="h-2 w-2 rounded-full bg-sage shadow-[0_0_8px_rgb(203_214_168)]" /></div>
      <div className="grid aspect-[4/3] place-items-center px-6 py-4">{thumb ? <img src={thumb} alt="" className="max-h-full max-w-full rounded-2xl object-cover shadow-pop" /> : <Art k={kindOf(p.kind)[3]} className="h-[80%] w-[80%] [&>svg]:h-full [&>svg]:w-full" />}</div>
      <div className="bg-gradient-to-t from-black/50 to-transparent px-5 pb-5 pt-2">
        <div className="flex items-center gap-2 text-small font-semibold"><Avatar name={a.me?.company || p.name} size={24} ring />{a.me?.company || p.name}</div>
        <div className="mt-2 font-semibold leading-5">{L.title || (L.type ? TITLE[L.type](p.name) : p.name)}</div>
        {T && <div className="mt-2 flex items-baseline gap-2"><span className="font-serif text-[30px] leading-none">{T.reward(t, L.cur)}</span><span className="text-small text-white/70">{T.sub(t, L.cur)}</span></div>}
        <div className="mt-3 flex flex-wrap gap-2">{T && <Chip tone="sage">{GOALS.find(g => g[0] === L.type)[1]}</Chip>}{L.platforms.slice(0, 2).map(x => <Chip key={x} tone="glass">{PLATFORMS.find(q => q[0] === x)[1]}</Chip>)}</div>
      </div>
    </div>
  );
}
