import { useEffect, useState } from 'react';
import { useStore, prodOf } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { TYPES, GOALS, SYM, FEE, money, kindOf, bgFor, PLATFORMS, COUNTRIES } from '../lib/data.js';
import { Page, PageTitle, Card, Rows, Button, Input, Textarea, Field, Switch, Segmented, Pills, Select, Radio, Ic, ProductArt, Art, Sheet, Avatar, Chip, cx } from '../ui/index.jsx';
import { Stepper, useGate, takeDraft, fileToData, dataToFile } from '../ui/wizard.jsx';
import { CropSheet } from '../ui/crop.jsx';

const GOAL_ICON = { attention: Ic.Share, commission: Ic.Wallet, introduction: Ic.Me };
const DEFAULTS = { attention: { rate: '0.10', per: 'click' }, commission: { percent: '15', cookie_days: '30' }, introduction: { share_percent: '10', min_contract: '' } };
const TITLE = { attention: (p) => 'Get the word out about ' + p, commission: (p) => 'Sell ' + p + ' and earn on every sale', introduction: (p) => 'Introduce ' + p + ' to companies that need it' };
const TODO = { attention: 'e.g. Post a short video or story showing how you use it. Add your link in the caption. No spam groups.', commission: 'e.g. Share your link with people who would actually buy it. Tell them what you like about it.', introduction: 'e.g. Connect us with the person who buys tools like this at your company or a client\'s.' };
const empty = (pid) => ({ step: pid ? 2 : 1, pid: pid || null, type: null, terms: {}, budgetOn: false, cur: 'USD', budget: '', cap: '', platforms: [], minf: 0, countries: [], verified: false, title: '', desc: '', thumb: 'product', thumbFile: null, thumbUrl: null });
// the terms the API stores (money in cents)
const termsOf = (L) => { const t = { ...DEFAULTS[L.type], ...L.terms };
  if (L.type === 'attention') return { rate_cents: Math.round(+t.rate * 100), per: t.per };
  if (L.type === 'commission') return { percent: +t.percent, ...(t.cookie_days ? { cookie_days: +t.cookie_days } : {}) };
  return { share_percent: +t.share_percent, ...(t.min_contract ? { min_contract_cents: Math.round(+t.min_contract * 100) } : {}) }; };
const cents = (v) => Math.round((+v || 0) * 100);

export default function NewListing({ pid }) {
  const { S, a } = useStore(), gate = useGate();
  const [L, setL] = useState(() => empty(pid)), [busy, setBusy] = useState(false), [prev, setPrev] = useState(false), [cropFile, setCropFile] = useState(null);
  const set = (x) => setL(q => ({ ...q, ...x }));
  useEffect(() => { if (S.auth === 'in' && a.hasSeller && !S.myProductIds) a.loadSeller(); }, [S.auth, a.hasSeller]);
  useEffect(() => { if (pid && !prodOf(S, pid)?.full) a.loadProduct(pid); }, [pid]);
  useEffect(() => { const d = takeDraft(); if (!d?.L) return; const { thumbData, ...rest } = d.L; setL({ ...empty(pid), ...rest }); if (thumbData) dataToFile(thumbData).then(f => setL(q => ({ ...q, thumbFile: f, thumbUrl: URL.createObjectURL(f) }))); a.toast('Welcome back. Your listing is still here.'); }, []);
  const p = L.pid ? prodOf(S, L.pid) : null, products = (S.myProductIds || []).map(id => prodOf(S, id)).filter(Boolean);
  const steps = pid ? ['Goal', 'Reward', 'Creators', 'Details', 'Review'] : ['Product', 'Goal', 'Reward', 'Creators', 'Details', 'Review'];
  const st = L.step, idx = pid ? st - 1 : st, T = L.type ? TYPES[L.type] : null, t = L.type ? termsOf(L) : null;
  const budget = L.budgetOn ? cents(L.budget) : null, cap = L.budgetOn && L.cap ? cents(L.cap) : null, fee = budget ? Math.round(budget * FEE / 10000) : 0;
  const tv = (k) => (L.terms[k] ?? DEFAULTS[L.type]?.[k] ?? '');
  const setT = (k, v) => set({ terms: { ...L.terms, [k]: v } });
  const thumb = L.thumb === 'upload' ? L.thumbUrl : L.thumb === 'product' ? p?.img : L.thumb;

  const valid = () => {
    if (st === 1) return !L.pid && 'Pick a product, or add a new one';
    if (st === 2) return !L.type && 'Pick what you want creators to do';
    if (st === 3) {
      if (L.type === 'attention' && !(+tv('rate') >= 0.01)) return 'The rate must be at least ' + SYM[L.cur].trim() + '0.01';
      if (L.type === 'commission' && !(+tv('percent') >= 1 && +tv('percent') <= 90)) return 'Commission is between 1% and 90%';
      if (L.type === 'introduction' && !(+tv('share_percent') >= 1 && +tv('share_percent') <= 50)) return 'The share is between 1% and 50%';
      if (L.budgetOn && !(+L.budget >= 1)) return 'Enter a budget, or turn it off';
      if (cap && cap > budget) return 'The cap per creator cannot be more than the budget';
    }
    if (st === 5 && L.title.trim() && L.title.trim().length < 3) return 'The title needs at least 3 characters';
    return null;
  };
  const publish = async () => { setBusy(true); const id = await a.addOffer({ ...L, title: L.title.trim() || TITLE[L.type](p.name), desc: L.desc.trim(), terms: t, budget, cap, thumbFile: L.thumb === 'upload' ? L.thumbFile : null, thumbMediaId: !['product', 'upload'].includes(L.thumb) ? (L.thumb.match(/media\/([^/]+)\/file/) || [])[1] : null }, p); setBusy(false); if (id) go('offer/' + id); };
  const next = () => {
    const err = valid(); if (err) return a.toast(err);
    if (st < 6) return set({ step: st + 1 });
    if (busy) return;
    if (gate('seller', publish, async () => ({ L: { ...L, thumbFile: null, thumbUrl: null, thumbData: await fileToData(L.thumbFile) } }))) publish();
  };
  const back = () => st > (pid ? 2 : 1) ? set({ step: st - 1 }) : go('plus');
  const titles = { 1: ['Which product is this listing for?', 'A listing is one ask for one product. You can make several per product.'], 2: ['What do you want the community to do?', 'Pick one. You can make another listing for a different ask.'], 3: ['How do you want to reward them?', 'What a creator earns, and whether you put in a budget.'], 4: ['What kind of creator?', 'Leave it open to get more applicants. You still accept each one.'], 5: ['Listing details', 'The title and brief creators see before they apply.'], 6: ['Review and publish', budget ? "We'll email you how to pay the budget. The listing goes live once it lands." : 'No payment needed. Your listing goes live right away.'] }[st];
  const label = st === 6 ? (busy ? 'Publishing…' : budget ? 'Submit · pay ' + money(budget + fee, L.cur) : 'Publish listing') : 'Continue';

  return (
    <Page crumb="Create" onBack={back} sub={<Stepper steps={steps} st={idx} />} barDesktop
      bar={<><Button tone="secondary" onClick={back}>Back</Button>{st > 1 && st < 6 && <Button tone="ghost" className="lg:hidden" onClick={() => setPrev(true)}>Preview</Button>}<span className="flex-1" /><Button disabled={busy} onClick={next}>{label}</Button></>}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {p && st > 1 && <button onClick={() => !pid && set({ step: 1 })} className="flex items-center gap-3 self-start rounded-full bg-white py-1.5 pl-1.5 pr-4 shadow-card"><ProductArt p={p} fit="80%" className="h-8 w-8 rounded-full" /><span className="text-small font-semibold">{p.name}</span>{!pid && <span className="text-caption text-ink-faint">Change</span>}</button>}
          <PageTitle h={titles[0]} p={titles[1]} className="!mb-0" />
          {st === 1 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <button onClick={() => go('plus/product')} className="flex flex-col overflow-hidden rounded-3xl bg-army text-left text-white shadow-card"><span className="grid aspect-[4/3] place-items-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-sage text-army"><Ic.Plus /></span></span><span className="p-4 font-semibold">New product</span></button>
              {products.map(x => <button key={x.id} onClick={() => set({ pid: x.id, step: 2 })} className={cx('relative flex flex-col overflow-hidden rounded-3xl bg-white text-left shadow-card transition hover:shadow-lift', L.pid === x.id && 'ring-2 ring-army')}><ProductArt p={x} fit="70%" className="aspect-[4/3] w-full" /><span className="p-4"><span className="line-clamp-1 block font-semibold">{x.name}</span><span className="text-caption text-ink-soft">{kindOf(x.kind)[1]}</span></span></button>)}
            </div>)}
          {st === 2 && (
            <div className="flex flex-col gap-4">{GOALS.map(([k, h, d, , ex]) => { const I = GOAL_ICON[k], on = L.type === k; return (
              <button key={k} onClick={() => set({ type: k, terms: {}, step: 3 })} className={cx('flex items-start gap-4 rounded-3xl bg-white p-5 text-left shadow-card transition hover:shadow-lift', on && 'ring-2 ring-army')}>
                <span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', on ? 'bg-army text-sage' : 'bg-sage-50 text-army')}><I /></span>
                <span className="min-w-0 flex-1"><span className="block text-subhead font-semibold">{h}</span><span className="mt-0.5 block text-small text-ink-soft">{d}</span><span className="mt-2 block text-caption text-ink-faint">{ex}</span></span><Radio on={on} />
              </button>); })}</div>)}
          {st === 3 && T && (<>
            <Card title={L.type === 'attention' ? 'Pay per result' : L.type === 'commission' ? 'Commission' : 'Share of the contract'} sub={GOALS.find(g => g[0] === L.type)[2]}>
              {L.type === 'attention' && <div className="grid gap-5 sm:grid-cols-2"><Field label="Rate" help="What one result earns a creator."><Input type="number" min="0.01" step="0.01" pre={SYM[L.cur].trim()} value={tv('rate')} onChange={e => setT('rate', e.target.value)} /></Field><Field label="For each"><Segmented value={tv('per')} onChange={v => setT('per', v)} items={[['click', 'Click'], ['view', 'View'], ['post', 'Post']]} /></Field></div>}
              {L.type === 'commission' && <div className="grid gap-5 sm:grid-cols-2"><Field label="Commission" help="Of each sale a creator brings."><Input type="number" min="1" max="90" suf="%" value={tv('percent')} onChange={e => setT('percent', e.target.value)} /></Field><Field label="Attribution window" help="How long a click counts."><Input type="number" min="1" max="365" suf="days" value={tv('cookie_days')} onChange={e => setT('cookie_days', e.target.value)} /></Field></div>}
              {L.type === 'introduction' && <div className="grid gap-5 sm:grid-cols-2"><Field label="Creator's share" help="Of a contract they help you sign."><Input type="number" min="1" max="50" suf="%" value={tv('share_percent')} onChange={e => setT('share_percent', e.target.value)} /></Field><Field label="Minimum contract" aside={<span className="text-caption text-ink-faint">Optional</span>}><Input type="number" min="0" pre={SYM[L.cur].trim()} placeholder="Any size" value={tv('min_contract')} onChange={e => setT('min_contract', e.target.value)} /></Field></div>}
            </Card>
            <Card><div className="flex flex-col gap-5">
              <Switch on={L.budgetOn} onChange={v => set({ budgetOn: v })} label="Put in a budget" sub="Creators trust funded listings more. Off means you pay each creator directly." />
              {L.budgetOn && <><div className="h-px bg-cream-100" /><div className="grid gap-5 sm:grid-cols-2"><Field label="Currency"><Select value={L.cur} onChange={v => set({ cur: v })} options={Object.keys(SYM).map(c => [c, c])} /></Field><Field label="Total budget"><Input type="number" min="1" pre={SYM[L.cur].trim()} placeholder="1,000" value={L.budget} onChange={e => set({ budget: e.target.value })} /></Field></div>
                <div className="grid gap-5 sm:grid-cols-2"><Field label="Max per creator" aside={<span className="text-caption text-ink-faint">Optional</span>} help="Stops one creator using it all."><Input type="number" min="1" pre={SYM[L.cur].trim()} placeholder="No limit" value={L.cap} onChange={e => set({ cap: e.target.value })} /></Field></div>
                {budget > 0 && <div className="rounded-2xl bg-cream-50 p-4"><Rows rows={[['Budget', money(budget, L.cur)], ['Listing fee (' + FEE / 100 + '%)', money(fee, L.cur)], ['Total to pay', <span className="text-heading">{money(budget + fee, L.cur)}</span>]]} /><p className="mt-3 text-small text-sage-700">{L.type === 'attention' ? 'Pays for about ' + Math.floor(budget / Math.max(1, t.rate_cents)).toLocaleString() + ' ' + t.per + 's.' : L.type === 'commission' ? 'Covers ' + money(Math.round(budget / (t.percent / 100)), L.cur) + ' in sales.' : 'Covers ' + money(budget, L.cur) + ' in contract shares.'}</p></div>}</>}
            </div></Card>
          </>)}
          {st === 4 && (
            <Card><div className="flex flex-col gap-6">
              <Field label="Where should they post?" help="Leave all off to accept any platform."><Pills multi value={L.platforms} onChange={c => set({ platforms: L.platforms.includes(c) ? L.platforms.filter(x => x !== c) : [...L.platforms, c] })} items={PLATFORMS} /></Field>
              <Field label="Audience size"><Pills value={String(L.minf)} onChange={v => set({ minf: +v })} items={[['0', 'Any size'], ['1000', '1k+'], ['10000', '10k+'], ['50000', '50k+'], ['100000', '100k+']]} /></Field>
              <Field label="Where they're based" help="Leave all off to accept creators anywhere."><Pills multi value={L.countries} onChange={c => set({ countries: L.countries.includes(c) ? L.countries.filter(x => x !== c) : [...L.countries, c] })} items={COUNTRIES} /></Field>
              <div className="h-px bg-cream-100" />
              <Switch on={L.verified} onChange={v => set({ verified: v })} label="Verified creators only" sub="Only accounts an admin has checked can apply." />
            </div></Card>)}
          {st === 5 && p && (<>
            <Card><div className="flex flex-col gap-5">
              <Field label="Title"><Input value={L.title} maxLength={120} onChange={e => set({ title: e.target.value })} placeholder={TITLE[L.type](p.name)} /></Field>
              <Field label="What should creators do?" help="Where to share it, what to say, what to avoid." aside={<span className="text-caption text-ink-faint">{L.desc.length}/2000</span>}><Textarea maxLength={2000} value={L.desc} onChange={e => set({ desc: e.target.value })} placeholder={TODO[L.type]} /></Field>
            </div></Card>
            <Card title="Thumbnail" sub="What people see in the feed.">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[['product', p.img], ...(p.images || []).filter(u => u && u !== p.img).map(u => [u, u])].map(([key, src]) => (
                  <button key={key} onClick={() => set({ thumb: key })} className={cx('relative aspect-[4/3] overflow-hidden rounded-2xl transition', L.thumb === key ? '' : 'opacity-70 hover:opacity-100')}>{L.thumb === key && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-army text-white"><Ic.Check width="13" height="13" /></span>}{src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <ProductArt p={p} fit="70%" className="h-full w-full" />}{key === 'product' && <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/50 px-1.5 text-[11px] font-semibold text-white">Cover</span>}</button>))}
                {L.thumbUrl && <button onClick={() => set({ thumb: 'upload' })} className={cx('relative aspect-[4/3] overflow-hidden rounded-2xl', L.thumb === 'upload' ? '' : 'opacity-70 hover:opacity-100')}>{L.thumb === 'upload' && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-army text-white"><Ic.Check width="13" height="13" /></span>}<img src={L.thumbUrl} alt="" className="h-full w-full object-cover" /></button>}
                <label className="grid aspect-[4/3] cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-cream-300 text-center text-caption font-semibold text-ink-soft hover:border-army/40"><span className="flex flex-col items-center gap-1"><Ic.Up width="18" height="18" />Upload</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > 5 * 1048576) return a.toast('Images can be up to 5 MB'); setCropFile(f); }} /></label>
              </div>
            </Card>
          </>)}
          {st === 6 && p && (<>
            <div className="lg:hidden"><FeedPreview L={L} p={p} thumb={thumb} /></div>
            <Card title="What you're asking" action={<button className="text-small font-semibold text-sage-700 hover:underline" onClick={() => set({ step: 2 })}>Edit</button>}><Rows rows={[['Product', p.name], ['Goal', GOALS.find(g => g[0] === L.type)[1]], ['Reward', T.reward(t, L.cur) + ' ' + T.sub(t, L.cur)]]} /></Card>
            <Card title="Who can apply" action={<button className="text-small font-semibold text-sage-700 hover:underline" onClick={() => set({ step: 4 })}>Edit</button>}><Rows rows={[['Platforms', L.platforms.length ? L.platforms.map(x => PLATFORMS.find(q => q[0] === x)[1]).join(', ') : 'Any'], ['Audience', L.minf ? L.minf.toLocaleString() + '+ followers' : 'Any size'], ['Based in', L.countries.length ? L.countries.join(', ') : 'Anywhere'], ['Verified only', L.verified ? 'Yes' : 'No']]} /></Card>
            <Card title="Payment" action={<button className="text-small font-semibold text-sage-700 hover:underline" onClick={() => set({ step: 3 })}>Edit</button>}>{budget ? <Rows rows={[['Budget', money(budget, L.cur)], cap && ['Max per creator', money(cap, L.cur)], ['Listing fee (' + FEE / 100 + '%)', money(fee, L.cur)], ['Total to pay', <span className="text-heading">{money(budget + fee, L.cur)}</span>]]} /> : <Rows rows={[['Budget', 'None, you pay creators directly']]} />}</Card>
          </>)}
        </div>
        <aside className="hidden lg:block"><div className="sticky top-0">{p && st > 1 ? <FeedPreview L={L} p={p} thumb={thumb} /> : null}</div></aside>
      </div>
      <Sheet open={prev} onClose={() => setPrev(false)} title="Feed preview">{p && <FeedPreview L={L} p={p} thumb={thumb} />}</Sheet>
      <CropSheet file={cropFile} title="Fit your thumbnail" onCancel={(m) => { if (m) a.toast(m); setCropFile(null); }} onDone={(f, url) => { setCropFile(null); set({ thumb: 'upload', thumbFile: f, thumbUrl: url }); }} />
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
