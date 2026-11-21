import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { TYPES, SYM, money, ME, PEOPLE, prodOf, offerOf } from '../lib/data.js';
import { Ic, IconButton, Button, Avatar, Status, Tabs, Rows, Field, Input, Sheet, ProductArt, Verified, Empty, cx } from '../ui/index.jsx';
import { fieldLabel, fmtTerm, Bar } from './Offer.jsx';
import { Player } from '../ui/parts.jsx';

const whoName = (S, id) => PEOPLE[id]?.name || (id === 'u-kofi' ? 'Kofi Mensah' : id === 'u-ada' ? 'Ada Okafor' : (S.offers.find(o => o.owner === id) || {}).co || id);
const ctx = (S, d) => {
  const o = offerOf(S, d.offer), seller = S.role === 'seller';
  return { o, p: prodOf(S, o.pid), seller, other: seller ? whoName(S, d.marketer) : o.co, verified: seller ? PEOPLE[d.marketer]?.verified : o.coV, earned: d.dels.filter(x => x.status === 'verified').reduce((n, x) => n + (x.amount || 0), 0) };
};

function List({ deals, active }) {
  const { S } = useStore();
  const [q, setQ] = useState('');
  const shown = deals.filter(d => { const c = ctx(S, d); return !q || (c.other + c.o.title).toLowerCase().includes(q.toLowerCase()); });
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pb-3 pt-5"><h1 className="mb-4 px-1 font-serif text-[24px] leading-8">Chats</h1>
        <div className="relative"><Ic.Search width="18" height="18" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search chats" className="h-11 w-full rounded-xl bg-cream-100 pl-10 pr-4 text-[15px] outline-none placeholder:text-ink-faint focus:bg-white focus:ring-2 focus:ring-army" /></div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {shown.length === 0 && <Empty icon={<Ic.Chat />} title={q ? 'No matches' : 'No chats yet'} text={q ? 'Try another name.' : 'When a seller accepts your application, the chat opens here.'} action={!q && <Button tone="secondary" onClick={() => go('feed')}>Browse offers</Button>} />}
        {shown.map(d => {
          const { o, other } = ctx(S, d), last = d.msgs[d.msgs.length - 1], pend = d.dels.filter(x => x.status === 'pending').length;
          return (
            <button key={d.id} onClick={() => go('chats-' + d.id)} className={cx('flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition', active === d.id ? 'bg-sage-50' : 'hover:bg-cream-50')}>
              <Avatar name={other} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{other}</span><span className="tnum shrink-0 text-caption text-ink-faint">{last?.at}</span></div>
                <div className="mt-0.5 truncate text-small text-ink-soft">{last ? (last.f === ME[S.role].id ? 'You: ' : '') + last.t : 'No messages yet'}</div>
                <div className="mt-1.5 flex items-center gap-2"><span className="truncate text-caption text-ink-faint">{o.title}</span>{d.status !== 'active' && <Status s={d.status} />}{pend > 0 && S.role === 'seller' && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1.5 text-[11px] font-bold text-white">{pend}</span>}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Conversation({ d, onInfo, onBack }) {
  const { S, a } = useStore();
  const { o, other, verified } = ctx(S, d);
  const [t, setT] = useState(''); const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [d.msgs.length, d.id]);
  const submit = (e) => { e.preventDefault(); if (!t.trim()) return; a.send(d, t); setT(''); };
  const mineId = ME[S.role].id;
  return (
    <div className="flex h-full min-h-0 flex-col bg-cream-50">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-cream-200 bg-white px-3 sm:px-5">
        <IconButton size="sm" label="Back" className="md:hidden" onClick={onBack}><Ic.Back width="20" height="20" /></IconButton>
        <Avatar name={other} size={40} />
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 font-semibold leading-5"><span className="truncate">{other}</span>{verified && <Verified />}</div><button onClick={() => go('offer-' + o.id)} className="block max-w-full truncate text-caption text-ink-soft hover:text-ink">{o.title}</button></div>
        <IconButton size="sm" tone="soft" label="Deal details" className="xl:hidden" onClick={onInfo}><Ic.Info width="20" height="20" /></IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[720px] flex-col justify-end gap-1.5 px-4 py-6 sm:px-6">
          <div className="mb-4 flex flex-col items-center gap-2 text-center"><ProductArt p={prodOf(S, o.pid)} fit="80%" className="h-14 w-14 rounded-2xl" /><div className="text-small font-semibold">Deal started {d.since}</div><div className="max-w-xs text-caption text-ink-soft">Terms are frozen. Report deliveries and get them verified from the details panel.</div></div>
          {d.msgs.map((m, i) => { const me = m.f === mineId, prev = d.msgs[i - 1], grouped = prev && prev.f === m.f; return (
            <div key={i} className={cx('flex', me ? 'justify-end' : 'justify-start', !grouped && i > 0 && 'mt-3')}>
              <div className={cx('max-w-[78%] rounded-[20px] px-4 py-2.5 text-[15px] leading-[22px]', me ? 'bg-army text-white' : 'bg-white text-ink shadow-[0_1px_2px_rgb(31_42_25/.08)]', me ? 'rounded-br-md' : 'rounded-bl-md')}>
                {m.t}<span className={cx('tnum float-right ml-3 mt-1.5 text-[11px] leading-none', me ? 'text-white/60' : 'text-ink-faint')}>{m.at}</span>
              </div>
            </div>); })}
          <div ref={end} />
        </div>
      </div>
      <form onSubmit={submit} className="shrink-0 border-t border-cream-200 bg-white px-3 py-3 sm:px-5">
        <div className="mx-auto flex max-w-[720px] items-center gap-2">
          <input value={t} onChange={e => setT(e.target.value)} placeholder={'Message ' + other.split(' ')[0]} className="h-12 min-w-0 flex-1 rounded-full bg-cream-100 px-5 text-[15px] outline-none transition placeholder:text-ink-faint focus:bg-white focus:ring-2 focus:ring-army" />
          <button type="submit" aria-label="Send" className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-full transition active:scale-95', t.trim() ? 'bg-army text-white hover:bg-army-600' : 'bg-sage-100 text-army/60')}><Ic.Send width="20" height="20" /></button>
        </div>
      </form>
    </div>
  );
}

function Panel({ d }) {
  const { S, a } = useStore();
  const { o, p, seller, earned } = ctx(S, d), T = TYPES[o.type], F = o.fin;
  const [tab, setTab] = useState('overview'), [ver, setVer] = useState(null), [amt, setAmt] = useState(''), [proof, setProof] = useState(''), [vid, setVid] = useState(null);
  const left = F.budget == null ? null : Math.max(0, F.budget - F.spent);
  const pend = d.dels.filter(x => x.status === 'pending').length;
  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => go('offer-' + o.id)} className="flex items-center gap-3 rounded-2xl text-left transition hover:opacity-80"><ProductArt p={p} fit="80%" className="h-14 w-14 shrink-0 rounded-2xl" /><div className="min-w-0 flex-1"><div className="line-clamp-2 font-semibold leading-5">{o.title}</div><div className="mt-1 text-caption text-ink-soft">{T.name} · {T.reward(d.terms)}</div></div><Ic.Chev width="18" height="18" className="text-ink-faint" /></button>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-cream-50 p-4"><div className="text-caption text-ink-soft">{seller ? 'Paid out' : 'Earned'}</div><div className="tnum mt-1 text-heading font-semibold">{money(earned, F.cur)}</div></div>
        <div className="rounded-2xl bg-cream-50 p-4"><div className="text-caption text-ink-soft">Budget left</div><div className="tnum mt-1 text-heading font-semibold">{left == null ? <span className="text-subhead">Open</span> : money(left, F.cur)}</div></div>
      </div>
      <Tabs value={tab} onChange={setTab} items={[['overview', 'Overview'], ['dels', 'Deliveries', seller ? pend : 0], ['terms', 'Terms']]} />
      {tab === 'overview' && <Rows rows={[['Status', <Status s={d.status} />], ['Reward', T.reward(d.terms) + ' ' + T.sub(d.terms).split(' · ')[0]], ['Max you can earn', F.cap ? money(F.cap, F.cur) : 'No limit'], F.cap && ['Progress', <span className="inline-block w-24"><Bar pct={earned / F.cap * 100} /></span>], ['Started', d.since]]} />}
      {tab === 'dels' && (<div className="flex flex-col gap-4">
        {!seller && d.status === 'active' && (
          <div className="flex flex-col gap-3 rounded-2xl bg-cream-50 p-4">
            <Field label="Report a delivery" help="Paste the link to your post, or upload a video."><Input placeholder="https://" value={proof} onChange={e => setProof(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2"><Button size="sm" disabled={!proof.trim()} onClick={() => { a.report(d, proof.trim()); setProof(''); }}>Report link</Button><Button size="sm" tone="secondary" onClick={() => a.uploadVideo(d)}><Ic.Up width="16" height="16" />Video</Button></div>
          </div>)}
        {d.dels.length === 0 ? <Empty icon={<Ic.Box />} title="No deliveries yet" text={seller ? 'Deliveries the marketer reports show up here.' : 'Report your first post above.'} /> :
          <div className="flex flex-col">{d.dels.map((x, i) => (
            <div key={x.id} className={cx('flex min-h-[64px] items-center gap-3', i && 'border-t border-cream-100')}>
              {x.video ? <button onClick={() => setVid(x)} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl"><ProductArt p={p} fit="80%" className="h-full w-full" /><span className="absolute inset-0 grid place-items-center bg-black/25 text-white"><Ic.Play width="14" height="14" /></span></button> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cream-100 text-ink-soft"><Ic.Globe width="18" height="18" /></span>}
              <div className="min-w-0 flex-1"><div className="text-small font-semibold">{x.kind}{x.amount ? <span className="tnum text-sage-700"> · {money(x.amount, F.cur)}</span> : ''}</div><div className="truncate text-caption text-ink-soft">{x.proof}</div></div>
              {seller && x.status === 'pending' ? <Button size="sm" onClick={() => { setVer(x); setAmt(''); }}>Review</Button> : <Status s={x.status} />}
            </div>))}</div>}
      </div>)}
      {tab === 'terms' && (<div className="flex flex-col gap-4">
        <p className="flex gap-2 rounded-2xl bg-cream-50 p-4 text-small text-ink-soft"><Ic.Shield width="18" height="18" className="shrink-0" />Frozen when the application was accepted. Edits to the offer don't change this deal.</p>
        <Rows rows={Object.entries(d.terms).map(([k, v]) => [fieldLabel(k), fmtTerm(k, v, F.cur)])} />
        {d.status !== 'ended' && <div className="grid grid-cols-2 gap-2">{seller ? <Button size="sm" tone="secondary" onClick={() => a.pauseDeal(d)}>{d.status === 'paused' ? 'Resume' : 'Pause'} deal</Button> : <span />}<Button size="sm" tone="danger" onClick={() => a.endDeal(d)}>End deal</Button></div>}
      </div>)}
      <Sheet open={!!ver} onClose={() => setVer(null)} title="Verify delivery" sub={ver && ver.kind + ' · ' + ver.proof}
        footer={<><Button size="lg" block onClick={() => { if (a.verify(d, ver, Math.round((+amt || 0) * 100))) setVer(null); }}>Verify{+amt ? ' · ' + money(Math.round(+amt * 100), F.cur) : ''}</Button><Button tone="secondary" size="lg" block onClick={() => { a.reject(d, ver); setVer(null); }}>Reject</Button></>}>
        {ver?.video && <Player p={p} sub={'Creator video · ' + ver.video} />}
        <Field label="What did it earn?" help={F.budget ? 'Budget left ' + money(left, F.cur) + (F.cap ? ' · cap ' + money(F.cap, F.cur) + ' per marketer' : '') : 'No budget on this offer, so this is a record only.'}><Input type="number" min="0" pre={SYM[F.cur] || '$'} value={amt} onChange={e => setAmt(e.target.value)} placeholder="0.00" /></Field>
      </Sheet>
      <Sheet open={!!vid} onClose={() => setVid(null)} title="Creator video"><Player p={p} sub={vid && (vid.by || 'You') + ' · ' + vid.video} /></Sheet>
    </div>
  );
}

export default function Chats({ id }) {
  const { a } = useStore();
  const [info, setInfo] = useState(false);
  const deals = a.myDeals(), d = deals.find(x => x.id === id) || null;
  const wide = typeof window !== 'undefined' && window.matchMedia('(min-width:768px)').matches;
  const sel = d || (wide ? deals[0] : null);
  useEffect(() => { setInfo(false); }, [id]);
  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_360px]">
      <div className={cx('min-h-0 border-r border-cream-200 bg-white', d ? 'hidden md:block' : 'block')}><List deals={deals} active={sel?.id} /></div>
      {sel ? (<>
        <div className={cx('min-h-0', d ? 'block' : 'hidden md:block')}><Conversation d={sel} onBack={() => go('chats')} onInfo={() => setInfo(true)} /></div>
        <aside className="hidden min-h-0 overflow-y-auto border-l border-cream-200 bg-white p-6 xl:block"><Panel d={sel} /></aside>
        <Sheet open={info} onClose={() => setInfo(false)} title="Deal details"><Panel d={sel} /></Sheet>
      </>) : <div className="hidden md:grid md:place-items-center"><Empty icon={<Ic.Chat />} title="Pick a chat" text="Your conversations with sellers and marketers live here." /></div>}
    </div>
  );
}
