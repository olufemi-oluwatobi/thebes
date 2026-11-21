import { useEffect, useState } from 'react';
import { useStore, prodOf } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { CATS, TYPES, SYM, FEE, money, artFor, PLATFORMS } from '../lib/data.js';
import { Page, PageTitle, Card, Rows, Button, Input, Textarea, Field, Switch, Segmented, Pills, Select, Radio, Ic, ProductArt, Art, Sheet, Empty, cx } from '../ui/index.jsx';

const STEPS = ['Type', 'Product', 'Details', 'Budget', 'Review'];
const FIELDS = { percent: ['Commission', null, '%', 15], cookie_days: ['Attribution window', null, 'days', 30], rate_cents: ['Rate', 'cur', null, 0.05], per: ['Paid per'], share_percent: ['Your share', null, '%', 10], min_contract_cents: ['Minimum contract', 'cur', null, 20000] };
const CUR_NAME = { USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', NGN: 'Nigerian naira', GHS: 'Ghanaian cedi', KES: 'Kenyan shilling', ZAR: 'South African rand' };
const newP = (pid) => ({ step: pid ? 3 : 1, type: 'commission', pid: pid || null, newProd: false, np: { name: '', category: 'software', desc: '', url: '', img: null, file: null, video: null, videoFile: null, sample: false }, title: '', desc: '', terms: {}, minf: 0, countries: [], verified: false, cur: 'USD', budget: '', cap: '', nocap: false });
const tv = (P, k) => P.terms[k] ?? FIELDS[k]?.[3] ?? (k === 'per' ? 'click' : '');
const termsOf = (P) => Object.fromEntries(TYPES[P.type].fields.map(([k]) => [k, k.endsWith('_cents') ? Math.round(+tv(P, k) * 100) : k === 'per' ? tv(P, k) : +tv(P, k)]));
const bC = (P) => P.nocap ? null : Math.round((+P.budget || 0) * 100);
const cC = (P) => P.nocap || !P.cap ? null : Math.round((+P.cap || 0) * 100);

function Stepper({ st }) {
  return (<>
    <ol className="hidden h-14 items-center sm:flex">{STEPS.map((l, i) => { const n = i + 1, done = n < st, cur = n === st; return (
      <li key={l} className={cx('flex items-center gap-2.5 text-small font-semibold', i < 4 && 'flex-1', cur ? 'text-ink' : done ? 'text-ink' : 'text-ink-faint')}>
        <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full text-caption font-bold', cur ? 'bg-army text-white' : done ? 'bg-sage text-army' : 'bg-cream-100 text-ink-faint')}>{done ? <Ic.Check width="14" height="14" /> : n}</span>{l}
        {i < 4 && <span className={cx('mx-3 h-px flex-1', done ? 'bg-sage-700/40' : 'bg-cream-200')} />}
      </li>); })}</ol>
    <div className="flex h-12 items-center gap-3 sm:hidden"><span className="text-small font-semibold">{STEPS[st - 1]}</span><span className="text-caption text-ink-faint">Step {st} of 5</span><div className="ml-auto flex gap-1">{STEPS.map((_, i) => <span key={i} className={cx('h-1.5 w-6 rounded-full', i < st ? 'bg-army' : 'bg-cream-200')} />)}</div></div>
  </>);
}

function ProductForm({ P, set }) {
  const n = P.np, up = (k, v) => set({ np: { ...n, [k]: v } });
  const file = (e, k) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (k === 'img') { if (f.size > 5 * 1048576) return alert('Images can be up to 5 MB'); set({ np: { ...n, img: URL.createObjectURL(f), file: f, sample: false } }); } else { if (f.size > 30 * 1048576) return alert('Videos can be up to 30 MB'); set({ np: { ...n, video: f.name, videoFile: f } }); } };
  return (
    <div className="flex flex-col gap-6">
      <Card title="Product"><div className="flex flex-col gap-5">
        <Field label="Name"><Input placeholder="e.g. Pepper Tracker" value={n.name} onChange={e => up('name', e.target.value)} /></Field>
        <Field label="Category"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(CATS).map(([k, l]) => <button key={k} type="button" onClick={() => up('category', k)} className={cx('flex h-[88px] flex-col items-center justify-center gap-2 rounded-2xl text-small font-semibold ring-1 ring-inset transition', n.category === k ? 'bg-sage-50 ring-2 ring-army' : 'bg-white ring-cream-300 hover:ring-army/40')}><Art k={artFor(k)} className="h-8 w-11 [&>svg]:h-full [&>svg]:w-full" />{l}</button>)}</div></Field>
        <Field label="Description" help="At least 10 characters." aside={<span className="text-caption text-ink-faint">{n.desc.length}/1000</span>}><Textarea maxLength={1000} placeholder="What is it, and who is it for?" value={n.desc} onChange={e => up('desc', e.target.value)} /></Field>
        <Field label="Website or store link" aside={<span className="text-caption text-ink-faint">Optional</span>}><Input type="url" placeholder="https://" value={n.url} onChange={e => up('url', e.target.value)} /></Field>
      </div></Card>
      <Card title="Media" sub="Marketers decide from the image, so make it count.">
        <div className="flex flex-col gap-5">
          <Field label="Placement image" help="PNG, JPEG, WebP or GIF up to 5 MB. 4:3 works best.">
            <label className={cx('relative grid aspect-[16/9] cursor-pointer place-items-center overflow-hidden rounded-2xl transition sm:aspect-[21/9]', n.img || n.sample ? '' : 'border-2 border-dashed border-cream-300 bg-cream-50 hover:border-army/40')}>
              {n.img ? <img src={n.img} alt="" className="h-full w-full object-cover" /> : n.sample ? <ProductArt p={{ category: n.category, art: artFor(n.category) }} fit="70%" className="h-full w-full" /> : <span className="flex flex-col items-center gap-2 text-small text-ink-soft"><span className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-card text-army"><Ic.Image width="20" height="20" /></span><span><b className="text-ink">Upload an image</b> or drag it here</span></span>}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={e => file(e, 'img')} />
            </label>
            {!n.img && <button type="button" className="self-start text-small font-semibold text-sage-700 hover:underline" onClick={() => up('sample', true)}>Use a sample image</button>}
          </Field>
          <Field label="Demo video" aside={<span className="text-caption text-ink-faint">Optional</span>}>
            <label className="flex h-14 cursor-pointer items-center gap-3 rounded-xl px-4 ring-1 ring-inset ring-cream-300 transition hover:ring-army/40"><span className="grid h-8 w-8 place-items-center rounded-full bg-cream-100 text-army">{n.video ? <Ic.Play width="12" height="12" /> : <Ic.Up width="16" height="16" />}</span><span className="flex-1 text-small">{n.video || <span className="text-ink-soft">MP4, MOV or WebM up to 30 MB</span>}</span><span className="text-small font-semibold">{n.video ? 'Replace' : 'Choose'}</span><input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={e => file(e, 'video')} /></label>
          </Field>
        </div>
      </Card>
    </div>
  );
}

function Preview({ P, p }) {
  const T = TYPES[P.type], t = termsOf(P), b = bC(P);
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between"><span className="text-caption font-semibold uppercase tracking-wider text-ink-faint">Feed preview</span><span className="h-2 w-2 rounded-full bg-sage-700" /></div>
      {p ? <ProductArt p={p} fit="72%" className="mb-4 aspect-[4/3] w-full rounded-2xl" />
        : <div className="mb-4 flex aspect-[4/3] flex-col justify-end gap-2 rounded-2xl bg-cream-50 p-4"><span className="mb-auto grid h-10 w-10 place-items-center rounded-xl bg-white text-ink-faint shadow-card"><Ic.Image width="20" height="20" /></span><span className="h-2.5 w-2/3 rounded-full bg-cream-200" /><span className="h-2.5 w-1/3 rounded-full bg-cream-200" /></div>}
      <div className="font-semibold leading-5">{P.title || (p ? 'Promote ' + p.name : 'Your offer title')}</div>
      <div className="mb-4 mt-2 flex items-baseline gap-2"><span className="font-serif text-[32px] leading-none">{T.reward(t, P.cur)}</span><span className="text-small text-ink-soft">{T.sub(t, P.cur)}</span></div>
      <Rows rows={[['Budget', b ? money(b, P.cur) : P.nocap ? 'Open' : '—'], ['Max per marketer', cC(P) ? money(cC(P), P.cur) : '—'], ['Who can apply', +P.minf ? (+P.minf).toLocaleString() + '+ followers' : 'Anyone']]} />
    </Card>
  );
}

const OptionCard = ({ on, onClick, title, text, icon }) => (
  <button onClick={onClick} className={cx('flex min-h-[84px] items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-card transition hover:shadow-lift', on && 'ring-2 ring-army')}>
    {icon}<span className="min-w-0 flex-1"><span className="block text-subhead font-semibold">{title}</span><span className="text-small text-ink-soft">{text}</span></span>{on !== undefined ? <Radio on={on} /> : <Ic.Chev width="20" height="20" className="text-ink-faint" />}
  </button>
);
const TypeIcon = { commission: Ic.Wallet, attention: Ic.Share, introduction: Ic.Me };

export default function Create({ pid: arg }) {
  const { S, a } = useStore();
  const pid = arg && !['social', 'product', 'offer'].includes(arg) ? arg : null;
  const mode = arg === 'social' ? 'social' : arg === 'product' ? 'product' : arg ? 'offer' : null;
  const setMode = (m) => go(m ? 'plus/' + m : 'plus');
  const [P, setP] = useState(() => newP(pid));
  const [prev, setPrev] = useState(false), [busy, setBusy] = useState(false);
  const [soc, setSoc] = useState({ platform: 'instagram', handle: '', followers: '' });
  const set = (x) => setP(q => ({ ...q, ...x }));
  useEffect(() => { if (S.auth === 'in' && a.hasSeller && !S.myProductIds) a.loadSeller(); }, [S.auth, a.hasSeller]);
  // a draft saved before the sign-in email comes back here
  useEffect(() => {
    let d = null; try { d = JSON.parse(localStorage.getItem('gs_draft') || 'null'); } catch {}
    if (!d || d.hash !== location.hash) return;
    try { localStorage.removeItem('gs_draft'); } catch {}
    const np = { ...d.P.np };
    if (np.imgData) { fetch(np.imgData).then(r => r.blob()).then(b => { const f = new File([b], 'image', { type: b.type }); setP(q => ({ ...q, np: { ...q.np, file: f, img: URL.createObjectURL(f) } })); }); }
    delete np.imgData; setP({ ...d.P, np }); if (d.soc) setSoc(d.soc);
    a.toast('Welcome back. Your draft is here.');
  }, []);
  const stash = async () => {
    const d = { hash: location.hash, P: { ...P, np: { ...P.np, file: null, img: null, videoFile: null, video: null } }, soc };
    if (P.np.file && P.np.file.size < 1.5e6) d.P.np.imgData = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(null); fr.readAsDataURL(P.np.file); });
    try { localStorage.setItem('gs_draft', JSON.stringify(d)); localStorage.setItem('gs_next', location.hash); } catch {}
  };
  // ask for sign-in, then a seller or marketer profile, only when something is saved
  const gate = (kind, then) => {
    if (S.auth !== 'in') { stash(); a.openSignin('Sign in to save this'); return false; }
    if (kind === 'seller' && !a.hasSeller) { a.openSetup('seller', then); return false; }
    if (kind === 'marketer' && !a.hasMarketer) { a.openSetup('marketer', then); return false; }
    return true;
  };
  const p = P.pid ? prodOf(S, P.pid) : null, T = TYPES[P.type], st = P.step;
  const mineProducts = (S.myProductIds || []).map(id => prodOf(S, id)).filter(Boolean);

  if (!mode) return (
    <Page crumb="Create" width="narrow">
      <PageTitle h="What do you want to add?" p="Offers are what marketers see in the feed. Each offer is for one of your products." />
      <div className="flex flex-col gap-4">
        <OptionCard onClick={() => setMode('offer')} title="Post an offer" text="Pick a type, a product and a budget" icon={<span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-army text-sage"><Ic.Tag /></span>} />
        <OptionCard onClick={() => setMode('product')} title="Add a product" text="Software, digital, physical or a service" icon={<span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sage-100 text-army"><Ic.Box /></span>} />
        <OptionCard onClick={() => setMode('social')} title="Add a social" text="Connect an account to qualify for offers" icon={<span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cream-100 text-army"><Ic.At /></span>} />
      </div>
    </Page>
  );

  const doSaveProduct = async () => { setBusy(true); try { return await a.addProduct(P.np); } finally { setBusy(false); } };
  const saveProduct = async (after) => { const n = P.np; if (n.name.trim().length < 2) { a.toast('Give the product a name'); return null; } if (n.desc.trim().length < 10) { a.toast('Describe it in at least 10 characters'); return null; } if (n.url && !/^https?:\/\//.test(n.url.trim())) { a.toast('The link should start with https://'); return null; } if (!n.file && !n.sample) { a.toast('Add a placement image'); return null; } if (!gate('seller', async () => { const id = await doSaveProduct(); if (id) after(id); })) return null; return doSaveProduct(); };
  if (mode === 'product') return (
    <Page crumb="Create" onBack={() => setMode(null)} width="narrow" barDesktop bar={<><Button tone="secondary" onClick={() => setMode(null)}>Cancel</Button><span className="flex-1" /><Button disabled={busy} onClick={async () => { const done = (id) => go('product/' + id); const id = await saveProduct(done); if (id) done(id); }}>{busy ? 'Saving…' : 'Save product'}</Button></>}>
      <PageTitle h="Add a product" p="Add it once, then post as many offers for it as you like." />
      <ProductForm P={P} set={set} />
    </Page>
  );
  if (mode === 'social') return (
    <Page crumb="Create" onBack={() => setMode(null)} width="narrow" barDesktop bar={<><Button tone="secondary" onClick={() => setMode(null)}>Cancel</Button><span className="flex-1" /><Button disabled={busy || !soc.handle.trim()} onClick={async () => { const run = async () => { setBusy(true); const ok = await a.addSocial(soc); setBusy(false); if (ok) go('me'); }; if (gate('marketer', run)) run(); }}>{busy ? 'Saving…' : 'Submit for review'}</Button></>}>
      <PageTitle h="Add a social" p="An admin checks each account before it counts toward offer requirements." />
      <Card><div className="flex flex-col gap-5"><Field label="Platform"><Pills value={soc.platform} onChange={v => setSoc({ ...soc, platform: v })} items={PLATFORMS} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Handle"><Input pre="@" placeholder="yourhandle" value={soc.handle} onChange={e => setSoc({ ...soc, handle: e.target.value })} /></Field><Field label="Followers"><Input type="number" min="0" placeholder="e.g. 4200" value={soc.followers} onChange={e => setSoc({ ...soc, followers: e.target.value })} /></Field></div></div></Card>
    </Page>
  );

  const b = bC(P), fee = b ? Math.round(b * FEE / 10000) : 0, t = termsOf(P);
  const next = async () => {
    if (st === 2 && P.newProd) { const done = (id) => set({ pid: id, newProd: false }); const id = await saveProduct(done); return id && done(id); }
    if (st === 2 && !P.pid) return a.toast('Pick a product first');
    if (st === 4 && !P.nocap) { if (!(+P.budget >= 1)) return a.toast('Enter a budget, or turn it off'); if (P.cap && +P.cap > +P.budget) return a.toast('The cap cannot be more than the budget'); }
    if (st < 5) return set({ step: st + 1 });
    const publish = async () => { setBusy(true); const id = await a.addOffer(P, p, t, b, cC(P)); setBusy(false); if (id) go('offer/' + id); };
    if (busy || !gate('seller', publish)) return; publish();
  };
  const back_ = () => { if (P.newProd) set({ newProd: false }); else if (st > 1) set({ step: st - 1 }); else setMode(null); };
  const label = st === 5 ? (busy ? 'Publishing…' : b ? 'Submit · pay ' + money(b + fee, P.cur) : 'Publish offer') : st === 2 && P.newProd ? 'Save product' : 'Continue';
  const titles = { 1: ['What kind of offer?', 'This decides how marketers get paid.'], 2: [P.newProd ? 'New product' : 'Which product?', P.newProd ? 'Add it once and reuse it for future offers.' : 'Marketers see its placement image first.'], 3: ['Offer details', T.name + ' offer for ' + (p ? p.name : 'your product')], 4: ['Budget', 'The total you will spend. Verified results draw it down.'], 5: ['Review and publish', b ? "We'll email you how to pay the budget. Your offer goes live once the payment lands." : 'No payment needed. Your offer goes live right away.'] }[st];

  return (
    <Page crumb="Create" onBack={back_} sub={<Stepper st={st} />} barDesktop
      bar={<><Button tone="secondary" onClick={back_}>Back</Button>{st < 5 && !P.newProd && <Button tone="ghost" className="lg:hidden" onClick={() => setPrev(true)}>Preview</Button>}<span className="flex-1" /><Button disabled={busy} onClick={next}>{label}</Button></>}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <PageTitle h={titles[0]} p={titles[1]} className="!mb-2" />
          {st === 1 && <div className="flex flex-col gap-4">{Object.entries(TYPES).map(([k, v]) => { const I = TypeIcon[k]; return <OptionCard key={k} on={P.type === k} onClick={() => set({ type: k, terms: {} })} title={v.name} text={v.blurb} icon={<span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition', P.type === k ? 'bg-army text-sage' : 'bg-cream-100 text-army')}><I /></span>} />; })}</div>}
          {st === 2 && (P.newProd ? <ProductForm P={P} set={set} /> : (
            <div className="grid auto-rows-fr grid-cols-2 gap-4 sm:grid-cols-3">
              {mineProducts.map(x => <button key={x.id} onClick={() => set({ pid: x.id })} className={cx('relative flex flex-col overflow-hidden rounded-3xl bg-white text-left shadow-card transition hover:shadow-lift', P.pid === x.id && 'ring-2 ring-army')}><ProductArt p={x} fit="72%" className="aspect-[4/3] w-full" /><div className="flex flex-1 flex-col p-4"><div className="line-clamp-2 text-small font-semibold leading-5">{x.name}</div><div className="mt-1 text-caption text-ink-soft">{CATS[x.category]}{x.video ? ' · demo' : ''}</div></div>{P.pid === x.id && <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white text-army shadow-lift"><Ic.Check width="16" height="16" /></span>}</button>)}
              <button onClick={() => set({ newProd: true })} className="flex flex-col overflow-hidden rounded-3xl border-2 border-dashed border-cream-300 text-left transition hover:border-army/40 hover:bg-white"><span className="grid aspect-[4/3] w-full place-items-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-white text-army shadow-card"><Ic.Plus width="20" height="20" /></span></span><span className="p-4"><span className="block text-small font-semibold">New product</span><span className="text-caption text-ink-soft">Add one now</span></span></button>
            </div>))}
          {st === 3 && (<>
            <Card title="The basics"><div className="flex flex-col gap-5"><Field label="Title"><Input value={P.title} onChange={e => set({ title: e.target.value })} placeholder={'Promote ' + (p ? p.name : 'my product')} /></Field><Field label="What should marketers do?" help="Where to share it, what to say, what to avoid."><Textarea value={P.desc} onChange={e => set({ desc: e.target.value })} placeholder="e.g. Share your link in food groups and stories. Please don't post in unrelated groups." /></Field></div></Card>
            <Card title="Payout" sub="What a marketer earns."><div className="grid gap-5 sm:grid-cols-2">{T.fields.map(([k]) => k === 'per' ? <Field key={k} label="Paid per"><Segmented value={tv(P, 'per')} onChange={v => set({ terms: { ...P.terms, per: v } })} items={['click', 'view', 'post'].map(x => [x, x])} /></Field> : <Field key={k} label={FIELDS[k][0]}><Input type="number" min="0" step="any" pre={FIELDS[k][1] ? SYM[P.cur].trim() : null} suf={FIELDS[k][2]} value={tv(P, k)} onChange={e => set({ terms: { ...P.terms, [k]: e.target.value } })} /></Field>)}</div></Card>
            <Card title="Who can apply" sub="Fewer rules means more applications."><div className="flex flex-col gap-5"><div className="grid gap-5 sm:grid-cols-2"><Field label="Minimum followers"><Input type="number" min="0" value={P.minf} onChange={e => set({ minf: e.target.value })} /></Field></div><Field label="Countries" help="Leave all off to accept marketers anywhere."><Pills multi value={P.countries} onChange={c => set({ countries: P.countries.includes(c) ? P.countries.filter(x => x !== c) : [...P.countries, c] })} items={[['NG', 'Nigeria'], ['GH', 'Ghana'], ['KE', 'Kenya'], ['ZA', 'South Africa']]} /></Field><div className="h-px bg-cream-100" /><Switch on={P.verified} onChange={v => set({ verified: v })} label="Verified marketers only" sub="Only accounts an admin has checked can apply." /></div></Card>
          </>)}
          {st === 4 && (<>
            <Card><div className="flex flex-col gap-5"><Switch on={!P.nocap} onChange={v => set({ nocap: !v })} label="Set a budget" sub="Off means you pay each marketer directly." />
              {!P.nocap && (<><div className="h-px bg-cream-100" /><div className="grid gap-5 sm:grid-cols-2"><Field label="Currency"><Select value={P.cur} onChange={v => set({ cur: v })} options={Object.keys(SYM).map(c => [c, c + ' · ' + CUR_NAME[c]])} /></Field><Field label="Total budget"><Input type="number" min="1" pre={SYM[P.cur].trim()} placeholder="1,000" value={P.budget} onChange={e => set({ budget: e.target.value })} /></Field></div>
                <div className="grid gap-5 sm:grid-cols-2"><Field label="Max per marketer" aside={<span className="text-caption text-ink-faint">Optional</span>} help="Stops one marketer using it all."><Input type="number" min="1" pre={SYM[P.cur].trim()} placeholder="No limit" value={P.cap} onChange={e => set({ cap: e.target.value })} /></Field></div></>)}</div></Card>
            {!P.nocap && <Card title="What it costs"><Rows rows={[['Budget', b ? money(b, P.cur) : '—'], ['Listing fee (' + FEE / 100 + '%)', b ? money(fee, P.cur) : '—'], ['Total to pay', <span className="text-heading">{b ? money(b + fee, P.cur) : '—'}</span>]]} />{b ? <p className="mt-4 rounded-2xl bg-sage-50 p-4 text-small text-sage-700">{P.type === 'attention' ? 'Pays for about ' + Math.floor(b / Math.max(1, t.rate_cents)).toLocaleString() + ' ' + t.per + 's.' : P.type === 'commission' ? 'At ' + t.percent + '% commission, this covers ' + money(Math.round(b / (t.percent / 100)), P.cur) + ' in sales.' : 'Covers ' + money(b, P.cur) + ' in shares of signed contracts.'}</p> : null}</Card>}
          </>)}
          {st === 5 && (<>
            <div className="lg:hidden"><Preview P={P} p={p} /></div>
            <Card title="Offer" action={<button className="text-small font-semibold text-sage-700 hover:underline" onClick={() => set({ step: 3 })}>Edit</button>}><Rows rows={[['Title', P.title || 'Promote ' + p.name], ['Product', p.name], ['Type', T.name], ['Reward', T.reward(t, P.cur) + ' ' + T.sub(t, P.cur).split(' · ')[0]], ['Who can apply', (+P.minf ? (+P.minf).toLocaleString() + '+ followers' : 'Anyone') + (P.countries.length ? ' · ' + P.countries.join(', ') : '') + (P.verified ? ' · verified' : '')]]} /></Card>
            <Card title="Payment" action={<button className="text-small font-semibold text-sage-700 hover:underline" onClick={() => set({ step: 4 })}>Edit</button>}>{b ? <Rows rows={[['Budget', money(b, P.cur)], cC(P) && ['Max per marketer', money(cC(P), P.cur)], ['Listing fee (' + FEE / 100 + '%)', money(fee, P.cur)], ['Total to pay', <span className="text-heading">{money(b + fee, P.cur)}</span>]]} /> : <Rows rows={[['Budget', 'Open, paid directly']]} />}</Card>
          </>)}
        </div>
        <aside className="hidden lg:block"><div className="sticky top-0"><Preview P={P} p={p} /></div></aside>
      </div>
      <Sheet open={prev} onClose={() => setPrev(false)} title="Feed preview"><div className="-mx-6 -mt-2 [&>section]:shadow-none"><Preview P={P} p={p} /></div></Sheet>
    </Page>
  );
}
