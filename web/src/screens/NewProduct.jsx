import { useEffect, useState } from 'react';
import { useStore, prodOf } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { KINDS, kindOf, SYM, bgFor } from '../lib/data.js';
import { Page, PageTitle, Card, Rows, Button, Input, Textarea, Field, Pills, Select, Ic, ProductArt, Art, Chip, Avatar, cx } from '../ui/index.jsx';
import { Stepper, useGate, takeDraft, fileToData, dataToFile, factsOf, sellerReady, afterSeller, sellerDraft } from '../ui/wizard.jsx';
import { CropSheet } from '../ui/crop.jsx';

const STEPS = ['Type', 'Details', 'Media', 'Preview'];
const LINK = { physical: ['Store link', 'https://yourstore.com/product'], software: ['Website or app link', 'https://yourapp.com'], ebook: ['Where to buy it', 'https://gumroad.com/…'], course: ['Course page', 'https://…'],
  newsletter: ['Subscribe page', 'https://yournewsletter.substack.com'], playlist: ['Playlist link', 'https://open.spotify.com/playlist/…'], service: ['Website', 'https://…'], other: ['Link', 'https://…'] };
const NAME = { physical: 'e.g. Glow Serum', software: 'e.g. Notely', ebook: 'e.g. The Quiet Founder', course: 'e.g. Pricing in 30 Days', newsletter: 'e.g. Lagos Food Weekly', playlist: 'e.g. Afro Focus Mix', service: 'e.g. Brand design sprint', other: 'Name it' };
const empty = () => ({ step: 1, kind: null, name: '', desc: '', url: '', details: { currency: 'USD' }, file: null, img: null, orig: null, sample: false, gallery: [], videoFile: null, video: null });

export default function NewProduct() {
  const { S, a } = useStore(), gate = useGate();
  const [P, setP] = useState(empty), [busy, setBusy] = useState(false), [done, setDone] = useState(null);
  const [crop, setCrop] = useState([]); // images waiting to be framed: [{ file, to: 'cover' | 'gallery' }]
  const set = (x) => setP(q => ({ ...q, ...x }));
  const det = (k, v) => set({ details: { ...P.details, [k]: v } });
  useEffect(() => { // draft kept across the sign-in email (or the seller account page)
    const d = takeDraft();
    if (!d?.P) { if (S.auth !== 'loading' && !sellerReady(S, a)) { afterSeller.set('plus/product'); go('plus/seller'); } return; }
    const { imgData, ...rest } = d.P; setP({ ...empty(), ...rest });
    if (imgData) dataToFile(imgData).then(f => setP(q => ({ ...q, file: f, img: URL.createObjectURL(f) })));
    a.toast('Welcome back. Your product is still here.');
  }, []);
  const k = P.kind ? kindOf(P.kind) : null, st = P.step;
  const preview = { name: P.name || 'Your product', desc: P.desc, url: P.url, kind: P.kind || 'other', category: k?.[4] || 'other', details: P.details, img: P.img, images: [P.img, ...P.gallery.map(g => g.url)].filter(Boolean) };

  const file = (e, kind) => { const fs = [...e.target.files]; e.target.value = ''; if (!fs.length) return;
    if (kind === 'video') { const f = fs[0]; if (f.size > 30 * 1048576) return a.toast('Videos can be up to 30 MB'); return set({ videoFile: f, video: f.name }); }
    const ok = fs.filter(f => f.size <= 5 * 1048576); if (ok.length < fs.length) a.toast('Images can be up to 5 MB each');
    if (kind === 'cover' && ok[0]) setCrop([{ file: ok[0], to: 'cover' }]);
    if (kind === 'gallery') setCrop(ok.slice(0, 6 - P.gallery.length).map(f => ({ file: f, to: 'gallery' })));
  };
  const cropped = (f, url) => { const c = crop[0]; setCrop(q => q.slice(1));
    if (c.to === 'cover') set({ file: f, img: url, orig: c.file, sample: false }); else setP(q => ({ ...q, gallery: [...q.gallery, { file: f, url, orig: c.file }].slice(0, 6) })); };
  const valid = () => {
    if (st === 1 && !P.kind) return 'Pick what you are adding';
    if (st === 2) { if (P.name.trim().length < 2) return 'Give it a name'; if (P.desc.trim().length < 10) return 'Describe it in at least 10 characters'; if (P.url && !/^https?:\/\/\S+\.\S+/.test(P.url.trim())) return 'The link should start with https://'; }
    if (st === 3 && !P.file && !P.sample) return 'Add a cover image, or use a sample';
    return null;
  };
  const save = async () => { setBusy(true); const id = await a.addProduct({ ...P, details: P.details }); setBusy(false); if (id) setDone(id); };
  const next = async () => {
    const err = valid(); if (err) return a.toast(err);
    if (st < 4) return set({ step: st + 1 });
    if (busy) return;
    if (gate('seller', save, async () => ({ P: { ...P, file: null, img: null, orig: null, gallery: [], videoFile: null, video: null, imgData: await fileToData(P.file) } }))) save();
  };
  const back = () => st > 1 ? set({ step: st - 1 }) : go('plus');

  if (done) { const p = prodOf(S, done) || preview; return (
    <Page crumb="Create" onBack={() => go('plus')} width="narrow">
      <div className="flex flex-col items-center text-center">
        <span className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-sage text-army shadow-[0_0_30px_-6px_rgb(203_214_168/.9)]"><Ic.Check width="26" height="26" /></span>
        <h1 className="font-serif text-[28px] leading-9 sm:text-title">{p.name} is ready</h1>
        <p className="mt-2 max-w-md text-body text-ink-soft">Now create a listing: tell creators what you want them to do and how you'll reward them.</p>
      </div>
      <Card pad={false} className="mx-auto mt-8 max-w-md overflow-hidden"><ProductArt p={p} fit="70%" className="aspect-[4/3] w-full" /><div className="flex items-center justify-between gap-3 p-5"><div><div className="font-semibold">{p.name}</div><div className="text-small text-ink-soft">{kindOf(p.kind)[1]}</div></div><Button tone="secondary" size="sm" onClick={() => go('product/' + done)}>View</Button></div></Card>
      <div className="mx-auto mt-6 flex max-w-md flex-col gap-3"><Button size="lg" block onClick={() => go('plus/' + done)}>Create a listing<Ic.Chev width="18" height="18" /></Button><Button tone="ghost" block onClick={() => { setDone(null); setP(empty()); }}>Add another product</Button></div>
    </Page>); }

  const titles = { 1: ['What are you adding?', 'Pick the closest fit. It shapes what marketers see.'], 2: [k ? 'About your ' + k[1].toLowerCase() : 'Details', 'Short and clear wins. Marketers read this before they apply.'], 3: ['Images and video', 'The cover is the first thing people see in the feed.'], 4: ['Preview', 'This is how marketers will see your product.'] }[st];
  return (
    <Page crumb="Create" onBack={back} sub={<Stepper steps={STEPS} st={st} />} barDesktop
      bar={<><Button tone="secondary" onClick={back}>Back</Button><span className="flex-1" /><Button disabled={busy} onClick={next}>{st === 4 ? (busy ? 'Saving…' : 'Save product') : 'Continue'}</Button></>}>
      <PageTitle h={titles[0]} p={titles[1]} />
      {st === 1 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {KINDS.map(([key, name, ex, art, cat]) => (
            <button key={key} onClick={() => set({ kind: key, step: 2 })} className={cx('group flex flex-col overflow-hidden rounded-3xl bg-white text-left shadow-card transition hover:shadow-lift', P.kind === key && 'ring-2 ring-army')}>
              <span className="grid aspect-[4/3] w-full place-items-center" style={{ background: bgFor({ category: cat }) }}><Art k={art} className="h-[62%] w-[62%] transition group-hover:scale-105 [&>svg]:h-full [&>svg]:w-full" /></span>
              <span className="p-4"><span className="block font-semibold leading-5">{name}</span><span className="mt-1 block text-caption text-ink-soft">{ex}</span></span>
            </button>))}
        </div>)}
      {st === 2 && k && (
        <div className="flex max-w-2xl flex-col gap-6">
          <Card><div className="flex flex-col gap-5">
            <Field label="Name"><Input placeholder={NAME[P.kind]} value={P.name} maxLength={120} onChange={e => set({ name: e.target.value })} /></Field>
            <Field label="Description" help="What it is, who it's for, and why people like it." aside={<span className="text-caption text-ink-faint">{P.desc.length}/1000</span>}><Textarea maxLength={1000} value={P.desc} onChange={e => set({ desc: e.target.value })} placeholder="e.g. A note app for busy people. Capture ideas in a tap and find them later." /></Field>
            <Field label={LINK[P.kind][0]} aside={<span className="text-caption text-ink-faint">Optional</span>}><Input type="url" placeholder={LINK[P.kind][1]} value={P.url} onChange={e => set({ url: e.target.value })} /></Field>
          </div></Card>
          {k[5].length > 0 && <Card title="Quick facts" sub="Shown on the product page."><div className="grid gap-5 sm:grid-cols-2">
            {k[5].map(([key, label, t, opts]) => t === 'pick' ? <div key={key} className="sm:col-span-2"><Field label={label}><Pills value={P.details[key] || ''} onChange={v => det(key, v)} items={opts.map(o => [o, o])} /></Field></div>
              : t === 'money' ? <Field key={key} label={label}><div className="flex gap-2"><Select className="w-28 shrink-0" value={P.details.currency} onChange={v => det('currency', v)} options={Object.keys(SYM).map(c => [c, c])} /><Input wrap="flex-1" type="number" min="0" step="0.01" pre={SYM[P.details.currency].trim()} placeholder="0" value={P.details[key] || ''} onChange={e => det(key, e.target.value)} /></div></Field>
              : <Field key={key} label={label}><Input type="number" min="0" placeholder="0" value={P.details[key] || ''} onChange={e => det(key, e.target.value)} /></Field>)}
          </div></Card>}
        </div>)}
      {st === 3 && (
        <div className="flex max-w-2xl flex-col gap-6">
          <Card title="Cover image" sub="PNG, JPEG or WebP up to 5 MB. You'll frame it to fit the feed.">
            <label className={cx('relative grid aspect-[4/3] cursor-pointer place-items-center overflow-hidden rounded-2xl transition', P.img || P.sample ? '' : 'border-2 border-dashed border-cream-300 bg-cream-50 hover:border-army/40')}>
              {P.img ? <img src={P.img} alt="" className="h-full w-full object-cover" /> : P.sample ? <ProductArt p={{ category: k[4], art: k[3] }} fit="62%" className="h-full w-full" /> : <span className="flex flex-col items-center gap-2 text-small text-ink-soft"><span className="grid h-12 w-12 place-items-center rounded-full bg-white text-army shadow-card"><Ic.Image /></span><b className="text-ink">Upload a cover</b><span>or drag it here</span></span>}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={e => file(e, 'cover')} />
            </label>
            {P.img ? <div className="mt-3 flex gap-4">{P.orig && <button type="button" className="inline-flex items-center gap-1.5 text-small font-semibold text-sage-700 hover:underline" onClick={() => setCrop([{ file: P.orig, to: 'cover' }])}><Ic.Crop width="16" height="16" />Adjust framing</button>}<label className="inline-flex cursor-pointer items-center gap-1.5 text-small font-semibold text-sage-700 hover:underline"><Ic.Up width="16" height="16" />Replace<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={e => file(e, 'cover')} /></label></div>
              : <button type="button" className="mt-3 text-small font-semibold text-sage-700 hover:underline" onClick={() => set({ sample: true })}>Use a sample image for now</button>}
          </Card>
          <Card title="More images" sub="Screenshots, angles, pages. Up to 6." action={<span className="text-caption text-ink-faint">Optional</span>}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {P.gallery.map((g, i) => <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-2xl"><img src={g.url} alt="" className="h-full w-full object-cover" /><button onClick={() => set({ gallery: P.gallery.filter((_, j) => j !== i) })} aria-label="Remove" className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white"><Ic.X width="14" height="14" /></button></div>)}
              {P.gallery.length < 6 && <label className="grid aspect-[4/3] cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-cream-300 text-ink-soft hover:border-army/40"><Ic.Plus /><input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={e => file(e, 'gallery')} /></label>}
            </div>
          </Card>
          <Card title="Demo video" sub="MP4, MOV or WebM up to 30 MB." action={<span className="text-caption text-ink-faint">Optional</span>}>
            <label className="flex h-14 cursor-pointer items-center gap-3 rounded-xl px-4 ring-1 ring-inset ring-cream-300 transition hover:ring-army/40"><span className="grid h-8 w-8 place-items-center rounded-full bg-cream-100 text-army">{P.video ? <Ic.Play width="12" height="12" /> : <Ic.Up width="16" height="16" />}</span><span className="flex-1 truncate text-small">{P.video || <span className="text-ink-soft">Show it working</span>}</span><span className="text-small font-semibold">{P.video ? 'Replace' : 'Choose'}</span><input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={e => file(e, 'video')} /></label>
          </Card>
        </div>)}
      {st === 4 && <ProductPreview p={preview} company={a.me?.company || sellerDraft.get()?.company} video={P.video} />}
      <CropSheet file={crop[0]?.file} title={crop[0]?.to === 'gallery' ? 'Fit this image' + (crop.length > 1 ? ' (' + crop.length + ' left)' : '') : 'Fit your cover'}
        cancelLabel={crop.length > 1 ? 'Skip' : 'Cancel'} onDone={cropped} onCancel={(m) => { if (m) a.toast(m); setCrop(q => q.slice(1)); }} />
    </Page>
  );
}

export function ProductPreview({ p, company, video }) {
  const facts = factsOf(p);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="relative overflow-hidden rounded-3xl shadow-card">{p.img ? <img src={p.img} alt="" className="aspect-[4/3] w-full object-cover" /> : <ProductArt p={{ category: p.category, art: kindOf(p.kind)[3] }} fit="62%" className="aspect-[4/3] w-full" />}
          {video && <span className="absolute bottom-4 left-4 inline-flex h-10 items-center gap-2 rounded-full bg-white pl-1.5 pr-4 text-small font-semibold text-army shadow-lift"><span className="grid h-7 w-7 place-items-center rounded-full bg-army text-white"><Ic.Play width="12" height="12" /></span>Watch demo</span>}</div>
        {p.images.length > 1 && <div className="flex gap-3 overflow-x-auto">{p.images.map((u, i) => <img key={i} src={u} alt="" className="h-[72px] w-[96px] shrink-0 rounded-2xl object-cover" />)}</div>}
        <div><Chip>{kindOf(p.kind)[1]}</Chip><h2 className="mt-3 font-serif text-[26px] leading-[34px]">{p.name}</h2>{p.desc && <p className="mt-2 whitespace-pre-line text-body text-ink-soft">{p.desc}</p>}</div>
      </div>
      <div className="flex flex-col gap-4">
        <Card><div className="flex items-center gap-3"><Avatar name={company || p.name} size={44} /><div className="min-w-0"><div className="font-semibold">{company || 'Your brand'}</div><div className="truncate text-small text-ink-soft">{p.url ? p.url.replace(/^https?:\/\//, '') : 'No link yet'}</div></div></div></Card>
        {facts.length > 0 && <Card title="Quick facts"><Rows rows={facts} /></Card>}
      </div>
    </div>
  );
}
