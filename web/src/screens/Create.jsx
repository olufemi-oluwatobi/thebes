import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go, back, useRoute } from '../lib/router.js';
import { CATS, TYPES, SYM, FEE, money, artFor, prodOf } from '../lib/data.js';
import { ART } from '../lib/art.js';
import { Page, Heading, Card, Rows, Button, Input, Textarea, Field, Switch, Segmented, Pills, Ic, ProductArt, Art, cx } from '../ui/index.jsx';

const STEPS = ['Type', 'Product', 'Details', 'Budget', 'Review'];
const FIELDS = { percent: ['Commission', null, '%', 15], cookie_days: ['Attribution window', null, 'days', 30], rate_cents: ['Rate', 'cur', null, 0.05], per: ['Paid per'], share_percent: ['Your share', null, '%', 10], min_contract_cents: ['Minimum contract', 'cur', null, 20000] };
const newP = (pid) => ({ step: pid ? 3 : 1, type: 'commission', pid: pid || null, newProd: false, np: { name: '', category: 'software', desc: '', img: null, video: null, sample: false }, title: '', desc: '', terms: {}, minf: 1000, countries: [], verified: false, cur: 'USD', budget: '', cap: '', nocap: false });
const tv = (P, k) => P.terms[k] ?? FIELDS[k]?.[3] ?? (k === 'per' ? 'click' : '');
const termsOf = (P) => Object.fromEntries(Object.keys(TYPES[P.type].fields.reduce((o, f) => ({ ...o, [f[0]]: 1 }), {})).map(k => [k, k.endsWith('_cents') ? Math.round(+tv(P, k) * 100) : k === 'per' ? tv(P, k) : +tv(P, k)]));
const bC = (P) => P.nocap ? null : Math.round((+P.budget || 0) * 100);
const cC = (P) => P.nocap || !P.cap ? null : Math.round((+P.cap || 0) * 100);

function Stepper({ st }) {
  return (
    <>
      <ol className="mb-8 hidden items-center md:flex">{STEPS.map((l, i) => { const n = i + 1, done = n < st, cur = n === st; return (
        <li key={l} className={cx('flex items-center gap-3 text-sm font-semibold', i < 4 && 'flex-1', cur || done ? 'text-army' : 'text-ink-soft')}>
          <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold', cur ? 'bg-army text-white' : done ? 'bg-sage text-army' : 'bg-cream-100')}>{done ? '✓' : n}</span>{l}
          {i < 4 && <span className={cx('mx-2 h-0.5 flex-1 rounded-full', done ? 'bg-sage' : 'bg-cream-100')} />}
        </li>); })}</ol>
      <div className="mb-6 md:hidden"><div className="mb-2 text-xs font-semibold text-ink-soft">Step {st} of 5 · {STEPS[st - 1]}</div><div className="h-1.5 overflow-hidden rounded-full bg-cream-100"><i className="block h-full rounded-full bg-army transition-all" style={{ width: st * 20 + '%' }} /></div></div>
    </>
  );
}

function ProductForm({ P, set }) {
  const n = P.np, up = (k, v) => set({ np: { ...n, [k]: v } });
  const file = (e, k) => { const f = e.target.files[0]; if (!f) return; if (k === 'img') { const r = new FileReader(); r.onload = () => set({ np: { ...n, img: r.result, sample: false } }); r.readAsDataURL(f); } else up('video', f.name); };
  return (
    <Card title="New product" sub="Add a placement image so marketers can see what they are promoting.">
      <div className="flex flex-col gap-5">
        <Field label="Name"><Input placeholder="e.g. Pepper Tracker" value={n.name} onChange={e => up('name', e.target.value)} /></Field>
        <Field label="Category"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Object.entries(CATS).map(([k, l]) => <button key={k} type="button" onClick={() => up('category', k)} className={cx('flex h-24 flex-col items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition', n.category === k ? 'bg-sage-100 ring-2 ring-army' : 'bg-cream-50 hover:bg-cream-100')}><Art k={artFor(k)} className="h-9 w-12 [&>svg]:h-full [&>svg]:w-full" />{l}</button>)}</div></Field>
        <Field label="Description"><Textarea placeholder="What is it, and who is it for?" value={n.desc} onChange={e => up('desc', e.target.value)} /></Field>
        <Field label="Placement image" help="PNG, JPEG, WebP or GIF up to 5 MB.">
          <div className="relative grid h-44 place-items-center overflow-hidden rounded-2xl bg-cream-50 text-sm text-ink-soft ring-1 ring-inset ring-cream-200">
            {n.img ? <img src={n.img} alt="" className="h-full w-full object-cover" /> : n.sample ? <ProductArt p={{ category: n.category, art: artFor(n.category) }} className="h-full w-full" /> : <div className="flex flex-col items-center gap-2"><Ic.Up /><span>Add a screenshot, product photo or cover</span></div>}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="absolute inset-0 cursor-pointer opacity-0" onChange={e => file(e, 'img')} />
          </div>
          <button type="button" className="self-start text-sm font-semibold underline" onClick={() => up('sample', true)}>Use a sample</button>
        </Field>
        <Field label="Demo video (optional)" help="MP4, MOV or WebM up to 30 MB.">
          <div className="relative flex h-14 items-center justify-center gap-2 rounded-xl bg-cream-50 text-sm text-ink-soft ring-1 ring-inset ring-cream-200">{n.video ? <><Ic.Play width="16" height="16" />{n.video}</> : <><Ic.Up width="18" height="18" />Add a demo video</>}<input type="file" accept="video/mp4,video/quicktime,video/webm" className="absolute inset-0 cursor-pointer opacity-0" onChange={e => file(e, 'video')} /></div>
        </Field>
      </div>
    </Card>
  );
}

function Preview({ P, p }) {
  const T = TYPES[P.type], t = termsOf(P), b = bC(P);
  return (
    <Card>
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-soft">Live preview</div>
      {p ? <ProductArt p={p} className="mb-4 aspect-[16/10] w-full rounded-2xl" /> : <div className="mb-4 grid aspect-[16/10] place-items-center rounded-2xl bg-cream-50 px-6 text-center text-sm text-ink-soft">Pick a product and its placement image shows here.</div>}
      <div className="font-semibold leading-5">{P.title || (p ? 'Promote ' + p.name : 'Your offer title')}</div>
      <div className="mb-4 mt-1 font-serif text-3xl">{T.reward(t)}<span className="ml-2 font-sans text-sm font-semibold text-ink-soft">{T.sub(t)}</span></div>
      <Rows rows={[['Budget', b ? money(b, P.cur) : P.nocap ? 'None' : 'Not set'], ['Max per marketer', cC(P) ? money(cC(P), P.cur) : 'None'], ['Who can apply', (+P.minf ? (+P.minf).toLocaleString() + '+ followers' : 'Anyone') + (P.verified ? ' · verified' : '')]]} />
    </Card>
  );
}

export default function Create() {
  const { S, a } = useStore();
  const r = useRoute();
  const [mode, setMode] = useState(r.a ? 'offer' : null);
  const [P, setP] = useState(() => newP(r.a));
  const set = (x) => setP(prev => ({ ...prev, ...x }));
  const p = P.pid ? prodOf(S, P.pid) : null, T = TYPES[P.type], st = P.step;
  const mineProducts = S.products.filter(x => x.owner === 'u-kofi' || x.mine);

  if (!mode) return (
    <Page title="Create" crumb="New">
      <Heading h="What do you want to add?" p="Offers are what marketers see in the feed." />
      <div className="flex flex-col gap-4">{[['offer', 'Post an offer', 'Pick a type, a product and a budget'], ['product', 'Add a product', 'Software, digital, physical or a service'], ['social', 'Add a social', 'Get verified to apply for offers']].map(([k, h, s]) => (
        <button key={k} onClick={() => { setMode(k); setP(newP()); }} className="flex min-h-[88px] items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-card transition hover:shadow-pop"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-sage-100 text-army"><Ic.Plus /></span><span className="flex-1"><span className="block text-[17px] font-semibold">{h}</span><span className="text-sm text-ink-soft">{s}</span></span><Ic.Chev className="text-ink-soft" /></button>))}</div>
    </Page>
  );

  if (mode === 'product') return (
    <Page title="Add a product" crumb="Create" onBack={() => setMode(null)}>
      <Heading h="Add a product" p="Marketers decide from the image, so make it count." />
      <ProductForm P={P} set={set} />
      <div className="mt-6 flex justify-end"><Button size="lg" onClick={() => { if (!P.np.name.trim()) return a.toast('Give the product a name'); if (!P.np.img && !P.np.sample) return a.toast('Add a placement image'); a.addProduct(P.np); go('me'); }}>Save product</Button></div>
    </Page>
  );
  if (mode === 'social') return (
    <Page title="Add a social" crumb="Create" onBack={() => setMode(null)}>
      <Heading h="Add a social" p="An admin verifies each social before it counts." />
      <Card><div className="flex flex-col gap-5"><Field label="Platform"><Pills value="Instagram" onChange={() => {}} items={['Instagram', 'TikTok', 'YouTube', 'Newsletter'].map(x => [x, x])} /></Field><Field label="Handle or link"><Input placeholder="@yourhandle" /></Field></div></Card>
      <div className="mt-6 flex justify-end"><Button size="lg" onClick={() => { a.toast('Saved'); setMode(null); }}>Save</Button></div>
    </Page>
  );

  const b = bC(P), fee = b ? Math.round(b * FEE / 10000) : 0, t = termsOf(P);
  const next = () => {
    if (st === 2 && P.newProd) { const n = P.np; if (!n.name.trim()) return a.toast('Give the product a name'); if (!n.img && !n.sample) return a.toast('Add a placement image'); const id = a.addProduct(n); return set({ pid: id, newProd: false }); }
    if (st === 2 && !P.pid) return a.toast('Pick a product first');
    if (st === 4 && !P.nocap) { if (!(+P.budget >= 1)) return a.toast('Enter a budget, or turn it off'); if (P.cap && +P.cap > +P.budget) return a.toast('The cap cannot be more than the budget'); }
    if (st < 5) return set({ step: st + 1 });
    const id = a.addOffer(P, p, t, b, cC(P)); go('feed');
  };
  const prev = () => { if (P.newProd) set({ newProd: false }); else if (st > 1) set({ step: st - 1 }); else setMode(null); };
  const label = st === 5 ? (b ? 'Pay ' + money(b + fee, P.cur) + ' and publish' : 'Publish offer') : st === 2 && P.newProd ? 'Save product' : 'Continue';

  return (
    <Page title="Post an offer" crumb="Create" onBack={prev} wide>
      <Stepper st={st} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {st === 1 && (<><Heading h="What kind of offer?" p="This decides how marketers get paid." />
            <div className="flex flex-col gap-4">{Object.entries(TYPES).map(([k, v]) => <button key={k} onClick={() => set({ type: k, terms: {} })} className={cx('flex min-h-[88px] items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-card transition', P.type === k && 'ring-2 ring-army')}><span className="flex-1"><span className="block text-[17px] font-semibold">{v.name}</span><span className="text-sm text-ink-soft">{v.blurb}</span></span><span className={cx('grid h-7 w-7 place-items-center rounded-full', P.type === k ? 'bg-army text-white' : 'bg-cream-100')}>{P.type === k && <Ic.Check width="16" height="16" />}</span></button>)}</div></>)}
          {st === 2 && (<><Heading h="Which product?" p="Marketers see its placement image first." />
            {P.newProd ? <ProductForm P={P} set={set} /> : (
              <Card><div className="grid grid-cols-2 gap-4 md:grid-cols-3">{mineProducts.map(x => <button key={x.id} onClick={() => set({ pid: x.id })} className={cx('relative overflow-hidden rounded-2xl bg-cream-50 text-left transition', P.pid === x.id && 'ring-2 ring-army')}><ProductArt p={x} className="aspect-[4/3] w-full" /><div className="p-3"><div className="line-clamp-1 text-sm font-semibold">{x.name}</div><div className="text-xs text-ink-soft">{CATS[x.category]}{x.video ? ' · demo' : ''}</div></div>{P.pid === x.id && <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-army text-white"><Ic.Check width="16" height="16" /></span>}</button>)}
                <button onClick={() => set({ newProd: true })} className="grid min-h-[170px] place-items-center rounded-2xl bg-cream-50 text-sm font-semibold text-ink-soft hover:bg-cream-100"><span className="flex flex-col items-center gap-2"><span className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-card text-army"><Ic.Plus /></span>Add a new product</span></button></div></Card>)}</>)}
          {st === 3 && (<><Heading h="Offer details" p={T.name + ' offer for ' + (p ? p.name : 'your product')} />
            <Card title="The basics"><div className="flex flex-col gap-5"><Field label="Title"><Input value={P.title} onChange={e => set({ title: e.target.value })} placeholder={'Promote ' + (p ? p.name : 'my product')} /></Field><Field label="What should marketers do?"><Textarea value={P.desc} onChange={e => set({ desc: e.target.value })} placeholder="Where to share it, what to say, what to avoid" /></Field></div></Card>
            <Card title="Payout terms" sub="What a marketer earns."><div className="grid gap-5 md:grid-cols-2">{T.fields.map(([k]) => k === 'per' ? <Field key={k} label="Paid per"><Segmented value={tv(P, 'per')} onChange={v => set({ terms: { ...P.terms, per: v } })} items={['click', 'view', 'post'].map(x => [x, x])} /></Field> : <Field key={k} label={FIELDS[k][0]}><Input type="number" min="0" step="any" pre={FIELDS[k][1] ? SYM[P.cur] : null} suf={FIELDS[k][2]} value={tv(P, k)} onChange={e => set({ terms: { ...P.terms, [k]: e.target.value } })} /></Field>)}</div></Card>
            <Card title="Who can apply" sub="Leave open to get more applications."><div className="flex flex-col gap-5"><div className="grid gap-5 md:grid-cols-2"><Field label="Minimum followers"><Input type="number" min="0" value={P.minf} onChange={e => set({ minf: e.target.value })} /></Field><Field label="Countries" help="None selected means anywhere."><Pills multi value={P.countries} onChange={c => set({ countries: P.countries.includes(c) ? P.countries.filter(x => x !== c) : [...P.countries, c] })} items={[['NG', 'Nigeria'], ['GH', 'Ghana'], ['KE', 'Kenya'], ['ZA', 'S. Africa']]} /></Field></div><Switch on={P.verified} onChange={v => set({ verified: v })} label="Verified marketers only" sub="Only marketers an admin has verified can apply." /></div></Card></>)}
          {st === 4 && (<><Heading h="Budget" p="What you will spend in total. Results draw it down as they are verified." />
            <Card title="Spend"><div className="flex flex-col gap-5"><Switch on={!P.nocap} onChange={v => set({ nocap: !v })} label="Set a budget" sub="Off means you settle payouts directly with each marketer." />
              {!P.nocap && (<><Field label="Currency"><Pills value={P.cur} onChange={v => set({ cur: v })} items={Object.keys(SYM).map(c => [c, c])} /></Field>
                <div className="grid gap-5 md:grid-cols-2"><Field label="Total budget"><Input type="number" min="1" pre={SYM[P.cur]} suf={P.cur} placeholder="1,000" value={P.budget} onChange={e => set({ budget: e.target.value })} /></Field><Field label="Max per marketer" help="Stops one marketer taking it all."><Input type="number" min="1" pre={SYM[P.cur]} suf={P.cur} placeholder="Optional" value={P.cap} onChange={e => set({ cap: e.target.value })} /></Field></div></>)}</div></Card>
            <Card title="What it costs">{b ? <><Rows rows={[['Budget', money(b, P.cur)], ['Listing fee (' + FEE / 100 + '%)', money(fee, P.cur)], ['Total to pay', <span className="text-lg">{money(b + fee, P.cur)}</span>]]} /><p className="mt-3 text-xs text-ink-soft">{P.type === 'attention' ? 'Pays for about ' + Math.floor(b / Math.max(1, t.rate_cents)).toLocaleString() + ' ' + t.per + 's.' : P.type === 'commission' ? 'At ' + t.percent + '%, this covers ' + money(Math.round(b / (t.percent / 100)), P.cur) + ' in sales.' : 'Covers ' + money(b, P.cur) + ' in shares of signed contracts.'}</p></> : <p className="text-sm text-ink-soft">{P.nocap ? 'No budget, so no payment is needed to go live.' : 'Enter a budget to see what it costs.'}</p>}</Card></>)}
          {st === 5 && (<><Heading h="Review and publish" p={b ? 'Pay to put the budget in. Your offer goes live once it is received.' : 'No payment needed. Your offer goes live right away.'} />
            <Card title="Offer"><Rows rows={[['Title', P.title || 'Promote ' + p.name], ['Product', p.name], ['Type', T.name], ['Reward', T.reward(t) + ' ' + T.sub(t)], ['Who can apply', (+P.minf ? (+P.minf).toLocaleString() + '+ followers' : 'Anyone') + (P.countries.length ? ' · ' + P.countries.join(', ') : '') + (P.verified ? ' · verified' : '')]]} /></Card>
            <Card title="Payment">{b ? <Rows rows={[['Budget', money(b, P.cur)], ...(cC(P) ? [['Max per marketer', money(cC(P), P.cur)]] : []), ['Listing fee (' + FEE / 100 + '%)', money(fee, P.cur)], ['Total to pay', <span className="text-lg">{money(b + fee, P.cur)}</span>]]} /> : <Rows rows={[['Budget', 'None']]} />}</Card></>)}
          <div className="sticky bottom-0 -mx-4 mt-2 flex items-center justify-between gap-3 bg-gradient-to-t from-cream-50 via-cream-50 to-transparent px-4 pb-4 pt-8 md:static md:mx-0 md:bg-none md:px-0 md:pb-0 md:pt-2">
            <Button tone="soft" onClick={prev}>Back</Button><Button size="lg" onClick={next}>{label}</Button>
          </div>
        </div>
        <aside className="hidden lg:block"><div className="sticky top-0"><Preview P={P} p={p} /></div></aside>
      </div>
    </Page>
  );
}
