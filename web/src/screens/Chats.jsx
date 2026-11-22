import { useEffect, useRef, useState } from 'react';
import { Stars } from '../ui/creator.jsx';
import { api } from '../lib/api.js';
import { useStore, offerOf, prodOf } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { TYPES, SYM, money, ago, clock } from '../lib/data.js';
import { Ic, IconButton, Button, Avatar, Status, Tabs, Rows, Field, Input, Textarea, Sheet, ProductArt, Verified, Empty, cx } from '../ui/index.jsx';
import { fieldLabel, fmtTerm, Bar } from './Offer.jsx';
import { Player } from '../ui/parts.jsx';

const ctx = (S, d) => {
  const o = offerOf(S, d.offer) || { id: d.offer, title: d.offerTitle, type: d.type, terms: d.terms, fin: { cur: d.currency || 'USD', budget: null, cap: d.cap, spent: 0 }, co: d.sellerName };
  const p = prodOf(S, d.productId) || { name: d.productName, category: 'other' };
  const seller = d.side === 'seller';
  return { o, p, seller, other: seller ? d.marketerName : d.sellerName, verified: seller ? d.marketerVerified : o.coV };
};
const Spinner = () => <div className="grid h-40 place-items-center"><span className="h-7 w-7 animate-spin rounded-full border-2 border-cream-200 border-t-army" /></div>;

function List({ deals, active }) {
  const { S } = useStore();
  const [q, setQ] = useState('');
  const shown = (deals || []).filter(d => { const c = ctx(S, d); return !q || ((c.other || '') + (d.offerTitle || '')).toLowerCase().includes(q.toLowerCase()); });
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pb-3 pt-[max(28px,env(safe-area-inset-top))] sm:pt-8"><h1 className="mb-4 px-1 font-serif text-[26px] leading-[34px] sm:text-title">Chats</h1>
        <div className="relative"><Ic.Search width="18" height="18" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search chats" className="h-11 w-full rounded-xl bg-paper pl-10 pr-4 text-[15px] outline-none placeholder:text-ink-faint focus:bg-paper focus:ring-2 focus:ring-army" /></div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-32 md:pb-4">
        {!deals ? <Spinner /> : shown.length === 0 && <Empty icon={<Ic.Chat />} title={q ? 'No matches' : 'No chats yet'} text={q ? 'Try another name.' : S.role === 'seller' ? 'When you accept an application, the chat opens here.' : 'When a seller accepts your application, the chat opens here.'} action={!q && <Button tone="secondary" onClick={() => go(S.role === 'seller' ? 'me' : 'feed')}>{S.role === 'seller' ? 'See applications' : 'Browse offers'}</Button>} />}
        {shown.map(d => { const { other } = ctx(S, d); return (
          <button key={d.id} onClick={() => go('chats/' + d.id)} className={cx('flex w-full items-start gap-3 rounded-card px-3 py-3 text-left transition', active === d.id ? 'bg-paper' : 'hover:bg-white/70')}>
            <Avatar name={other} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><span className={cx('truncate', d.unread ? 'font-bold' : 'font-semibold')}>{other}</span><span className="tnum shrink-0 text-caption text-ink-faint">{ago(d.lastAt)}</span></div>
              <div className="mt-0.5 flex items-center gap-2"><span className={cx('truncate text-small', d.unread ? 'font-semibold text-ink' : 'text-ink-soft')}>{d.offerTitle}</span>{d.status !== 'active' && <Status s={d.status} />}{d.unread > 0 && <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-ember px-1.5 text-[11px] font-bold text-white">{d.unread}</span>}</div>
            </div>
          </button>); })}
      </div>
    </div>
  );
}

function Conversation({ d, onInfo, onBack }) {
  const { S, a } = useStore();
  const { o, p, other, verified } = ctx(S, d);
  const msgs = S.msgs[d.id];
  const [t, setT] = useState(''); const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs?.length, d.id]);
  const submit = (e) => { e.preventDefault(); if (!t.trim()) return; a.send(d, t); setT(''); };
  const mineId = a.me?.id;
  return (
    <div className="flex h-full min-h-0 flex-col bg-cream-50">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-cream-200/70 bg-cream-50/85 px-3 backdrop-blur-md sm:px-5">
        <IconButton size="sm" label="Back" className="md:hidden" onClick={onBack}><Ic.Back width="20" height="20" /></IconButton>
        <Avatar name={other} size={40} />
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 font-semibold leading-5"><span className="truncate">{other}</span>{verified && <Verified />}</div><button onClick={() => go('offer/' + o.id)} className="block max-w-full truncate text-caption text-ink-soft hover:text-ink">{o.title}</button></div>
        <IconButton size="sm" tone="soft" label="Deal details" className="xl:hidden" onClick={onInfo}><Ic.Info width="20" height="20" /></IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[720px] flex-col justify-end gap-1.5 px-4 py-6 sm:px-6">
          <div className="mb-4 flex flex-col items-center gap-2 text-center"><ProductArt p={p} fit="80%" className="h-14 w-14 rounded-2xl" /><div className="text-small font-semibold">Deal started {d.since}</div><div className="max-w-xs text-caption text-ink-soft">Terms are frozen. Report deliveries and get them verified in the deal details.</div></div>
          {!msgs ? <Spinner /> : msgs.map((m, i) => { const me = m.sender_id === mineId, prev = msgs[i - 1], grouped = prev && prev.sender_id === m.sender_id; return (
            <div key={m.id} className={cx('flex', me ? 'justify-end' : 'justify-start', !grouped && i > 0 && 'mt-3')}>
              <div className={cx('max-w-[78%] whitespace-pre-line break-words rounded-[20px] px-4 py-2.5 text-[15px] leading-[22px]', me ? 'rounded-br-md bg-army text-onarmy' : 'rounded-bl-md bg-paper text-ink shadow-[0_1px_2px_rgb(31_42_25/.08)]', m.is_deleted && 'italic opacity-60')}>
                {m.is_deleted ? 'Message deleted' : m.body}<span className={cx('tnum float-right ml-3 mt-1.5 text-[11px] leading-none', me ? 'text-onarmy/60' : 'text-ink-faint')}>{clock(m.created_at)}</span>
              </div>
            </div>); })}
          <div ref={end} />
        </div>
      </div>
      {d.status === 'ended' ? <div className="shrink-0 border-t border-cream-200/70 bg-cream-50 px-5 py-4 text-center text-small text-ink-soft">This deal has ended.</div> : (
        <form onSubmit={submit} className="shrink-0 border-t border-cream-200/70 bg-cream-50 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-5">
          <div className="mx-auto flex max-w-[720px] items-center gap-2">
            <input value={t} onChange={e => setT(e.target.value)} maxLength={4000} placeholder={'Message ' + (other || '').split(' ')[0]} className="h-12 min-w-0 flex-1 rounded-full bg-paper px-5 text-[15px] outline-none transition placeholder:text-ink-faint focus:ring-2 focus:ring-army/30" />
            <button type="submit" aria-label="Send" className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-full transition active:scale-95', t.trim() ? 'bg-army text-onarmy hover:bg-army-600' : 'bg-sage-100 text-army/60')}><Ic.Send width="20" height="20" /></button>
          </div>
        </form>)}
    </div>
  );
}

function Panel({ d }) {
  const { S, a } = useStore();
  const { o, p, seller } = ctx(S, d), T = TYPES[o.type] || TYPES.commission, F = o.fin;
  const dels = S.dels[d.id];
  const [tab, setTab] = useState('overview'), [ver, setVer] = useState(null), [amt, setAmt] = useState(''), [note, setNote] = useState(''), [proof, setProof] = useState(''), [vid, setVid] = useState(null), [busy, setBusy] = useState(false);
  const file = useRef(null);
  useEffect(() => { if (tab !== 'dels') return; a.loadDels(d.id); const t = setInterval(() => a.loadDels(d.id), 15000); return () => clearInterval(t); }, [tab, d.id]);
  const left = F.budget == null ? null : Math.max(0, F.budget - F.spent), cur = d.currency || F.cur;
  const pend = (dels || []).filter(x => x.status === 'pending').length;
  const earned = d.earned ?? (dels || []).filter(x => x.status === 'verified').reduce((n, x) => n + (x.amount || 0), 0);
  const cap = d.cap ?? F.cap;
  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => go('offer/' + o.id)} className="flex items-center gap-3 rounded-2xl text-left transition hover:opacity-80"><ProductArt p={p} fit="80%" className="h-14 w-14 shrink-0 rounded-2xl" /><div className="min-w-0 flex-1"><div className="line-clamp-2 font-semibold leading-5">{o.title}</div><div className="mt-1 text-caption text-ink-soft">{T.name} · {T.reward(d.terms, cur)}</div></div><Ic.Chev width="18" height="18" className="text-ink-faint" /></button>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card bg-paper p-4"><div className="text-caption text-ink-soft">{seller ? 'Paid out' : 'Earned'}</div><div className="tnum mt-1 text-heading font-semibold">{money(earned, cur)}</div></div>
        <div className="rounded-card bg-paper p-4"><div className="text-caption text-ink-soft">Budget left</div><div className="tnum mt-1 text-heading font-semibold">{left == null ? <span className="text-subhead">Open</span> : money(left, cur)}</div></div>
      </div>
      <Tabs value={tab} onChange={setTab} items={[['overview', 'Overview'], ['dels', 'Deliveries', seller ? pend : 0], ['terms', 'Terms']]} />
      {tab === 'overview' && <Rows rows={[['Status', <Status s={d.status} />], ['Reward', T.reward(d.terms, cur) + ' ' + T.sub(d.terms, cur).split(' · ')[0]], ['Max you can earn', cap ? money(cap, cur) : 'No limit'], cap && ['Progress', <span className="inline-block w-24"><Bar pct={earned / cap * 100} /></span>], ['Started', d.since]]} />}
      {tab === 'overview' && seller && <RateCard d={d} />}
      {tab === 'dels' && (<div className="flex flex-col gap-4">
        {!seller && d.status === 'active' && (
          <div className="flex flex-col gap-3 rounded-2xl bg-cream-50 p-4">
            <Field label="Report a delivery" help="Paste the link to your post, or upload a video (up to 30 MB)."><Input placeholder="https://" value={proof} onChange={e => setProof(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2"><Button size="sm" disabled={!/^https?:\/\/\S+\.\S+/.test(proof.trim()) || busy} onClick={async () => { setBusy(true); if (await a.report(d, proof.trim())) setProof(''); setBusy(false); }}>Report link</Button><Button size="sm" tone="secondary" disabled={busy} onClick={() => file.current.click()}><Ic.Up width="16" height="16" />Video</Button></div>
            <input ref={file} type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > 30 * 1048576) return a.toast('Videos can be up to 30 MB'); setBusy(true); await a.uploadVideo(d, f); setBusy(false); }} />
          </div>)}
        {!dels ? <Spinner /> : dels.length === 0 ? <Empty icon={<Ic.Box />} title="No deliveries yet" text={seller ? 'Deliveries the marketer reports show up here.' : 'Report your first post above.'} /> :
          <div className="flex flex-col">{dels.map((x, i) => (
            <div key={x.id} className={cx('flex min-h-[64px] items-center gap-3', i && 'border-t border-cream-100')}>
              {x.media ? <button onClick={() => setVid(x)} className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-army text-onarmy"><Ic.Play width="14" height="14" /></button> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cream-100 text-ink-soft"><Ic.Globe width="18" height="18" /></span>}
              <div className="min-w-0 flex-1"><div className="text-small font-semibold">{x.kind}{x.amount ? <span className="tnum text-sage-700"> · {money(x.amount, cur)}</span> : ''}</div>{x.url ? <a href={x.url} target="_blank" rel="noopener" className="block truncate text-caption text-ink-soft hover:underline">{x.url.replace(/^https?:\/\//, '')}</a> : <div className="truncate text-caption text-ink-soft">{x.status === 'rejected' && x.note ? x.note : x.proof}</div>}</div>
              {seller && x.status === 'pending' ? <Button size="sm" onClick={() => { setVer(x); setAmt(o.terms?.fee_cents ? (o.terms.fee_cents / 100).toFixed(2) : ''); setNote(''); }}>Review</Button> : <Status s={x.status} />}
            </div>))}</div>}
        <p className="text-caption text-ink-soft">The seller verifies each delivery before it earns anything.</p>
      </div>)}
      {tab === 'terms' && (<div className="flex flex-col gap-4">
        <p className="flex gap-2 rounded-2xl bg-cream-50 p-4 text-small text-ink-soft"><Ic.Shield width="18" height="18" className="shrink-0" />Frozen when the application was accepted. Edits to the offer don't change this deal.</p>
        <Rows rows={Object.entries(d.terms).map(([k, v]) => [fieldLabel(k), fmtTerm(k, v, cur)])} />
        {d.status !== 'ended' && <div className="grid grid-cols-2 gap-2">{seller ? <Button size="sm" tone="secondary" onClick={() => a.pauseDeal(d)}>{d.status === 'paused' ? 'Resume' : 'Pause'} deal</Button> : <span />}<Button size="sm" tone="danger" onClick={() => a.endDeal(d)}>End deal</Button></div>}
      </div>)}
      <Sheet open={!!ver} onClose={() => setVer(null)} title="Review delivery" sub={ver && ver.kind}
        footer={<><Button size="lg" block disabled={busy} onClick={async () => { setBusy(true); if (await a.verify(d, ver, Math.round((+amt || 0) * 100))) setVer(null); setBusy(false); }}>Verify{+amt ? ' · ' + money(Math.round(+amt * 100), cur) : ''}</Button><Button tone="secondary" size="lg" block disabled={busy} onClick={async () => { setBusy(true); if (await a.reject(d, ver, note.trim())) setVer(null); setBusy(false); }}>Reject</Button></>}>
        {ver?.media ? <Player src={ver.media} /> : ver?.url && <a href={ver.url} target="_blank" rel="noopener" className="flex items-center gap-2 break-all rounded-2xl bg-cream-50 p-4 text-small font-semibold text-army hover:underline"><Ic.Visit width="16" height="16" className="shrink-0" />{ver.url}</a>}
        <Field label="What did it earn?" help={F.budget ? 'Budget left ' + money(left, cur) + (cap ? ' · up to ' + money(cap, cur) + ' per marketer' : '') : 'No budget on this offer, so this is a record only.'}><Input type="number" min="0" step="0.01" pre={(SYM[cur] || '$').trim()} value={amt} onChange={e => setAmt(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Note" aside={<span className="text-caption text-ink-faint">Shown if you reject</span>}><Textarea className="!min-h-[80px]" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. The post was removed." /></Field>
      </Sheet>
      <Sheet open={!!vid} onClose={() => setVid(null)} title="Creator video"><Player src={vid?.media} /></Sheet>
    </div>
  );
}

export default function Chats({ id }) {
  const { S, a } = useStore();
  const [info, setInfo] = useState(false);
  const deals = S.deals, d = (deals || []).find(x => x.id === id) || null;
  const wide = typeof window !== 'undefined' && window.matchMedia('(min-width:768px)').matches;
  const sel = d || (wide && deals ? deals[0] : null);
  useEffect(() => { setInfo(false); }, [id]);
  useEffect(() => { if (S.auth !== 'in') return; a.loadDeals(); const t = setInterval(() => a.loadDeals(), 20000); return () => clearInterval(t); }, [S.auth, S.role]);
  useEffect(() => { if (id && deals && !d) a.loadDeal(id); }, [id, !!deals]);
  useEffect(() => { if (!sel) return; a.loadDeal(sel.id); const t = setInterval(() => a.pollMsgs(sel.id), 5000); return () => clearInterval(t); }, [sel?.id]);
  if (S.auth === 'out') return <div className="grid h-full place-items-center"><Empty icon={<Ic.Chat />} title="Your chats live here" text="Sign in to talk with sellers and marketers you work with." action={<Button onClick={() => a.openSignin()}>Sign in</Button>} /></div>;
  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_360px]">
      <div className={cx('min-h-0 border-r border-cream-200/70 bg-cream-50', id ? 'hidden md:block' : 'block')}><List deals={deals} active={sel?.id} /></div>
      {sel ? (<>
        <div className={cx('min-h-0', id ? 'block' : 'hidden md:block')}><Conversation d={sel} onBack={() => go('chats')} onInfo={() => setInfo(true)} /></div>
        <aside className="hidden min-h-0 overflow-y-auto border-l border-cream-200/70 bg-cream-50 p-6 xl:block"><Panel d={sel} /></aside>
        <Sheet open={info} onClose={() => setInfo(false)} title="Deal details"><Panel d={sel} /></Sheet>
      </>) : <div className={cx('place-items-center', id ? 'grid' : 'hidden md:grid')}>{id ? <Spinner /> : <Empty icon={<Ic.Chat />} title="Pick a chat" text="Your conversations with sellers and marketers live here." />}</div>}
    </div>
  );
}

/* the seller rates the creator on this deal (one rating per deal, can be changed) */
function RateCard({ d }) {
  const { a } = useStore();
  const [r, setR] = useState(undefined), [note, setNote] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api(`/squad/relationships/${d.id}/rating`).then((x) => { setR(x.rating); setNote(x.rating?.note || ''); }).catch(() => setR(null)); }, [d.id]);
  const save = async (stars, n = note) => { setBusy(true); const x = await a.run(() => api(`/squad/relationships/${d.id}/rating`, { method: 'PUT', body: { stars, note: n.trim() || undefined } })); setBusy(false); if (x) { setR(x.rating); a.toast('Rating saved'); } };
  if (r === undefined) return null;
  return (
    <div className="rounded-card bg-paper p-4">
      <div className="flex items-center justify-between gap-3"><div><div className="font-semibold">Rate {d.marketerName?.split(' ')[0] || 'this creator'}</div><div className="text-caption text-ink-soft">Shown on their profile.</div></div>
        {d.marketerId && <button onClick={() => go('creator/' + d.marketerId)} className="text-small font-semibold text-sage-700 hover:underline">Profile</button>}</div>
      <Stars value={r?.stars || 0} size={30} onChange={(n) => !busy && save(n)} className="mt-2 -ml-1" />
      {r && <div className="mt-2 flex gap-2"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Add a short note (optional)" className="h-10 flex-1 rounded-xl bg-cream-50 px-3 text-small outline-none ring-1 ring-inset ring-cream-200 focus:ring-army" />{note !== (r.note || '') && <Button size="sm" disabled={busy} onClick={() => save(r.stars)}>Save</Button>}</div>}
    </div>
  );
}
