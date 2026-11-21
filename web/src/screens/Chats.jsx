import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { TYPES, SYM, money, ME, PEOPLE, prodOf, offerOf } from '../lib/data.js';
import { Ic, IconButton, Button, Avatar, Tag, Tabs, Rows, Stat, Field, Input, Sheet, ProductArt, cx } from '../ui/index.jsx';
import { fieldLabel, fmtTerm } from './Offer.jsx';
import { Player } from '../ui/parts.jsx';

const whoName = (S, id) => PEOPLE[id]?.name || (id === 'u-kofi' ? 'Kofi Mensah' : id === 'u-ada' ? 'Ada Okafor' : (S.offers.find(o => o.owner === id) || {}).co || id);
const useDealCtx = (S, a, d) => {
  const o = offerOf(S, d.offer), seller = S.role === 'seller';
  const other = seller ? whoName(S, d.marketer) : o.co;
  return { o, p: prodOf(S, o.pid), seller, other, earned: d.dels.filter(x => x.status === 'verified').reduce((n, x) => n + (x.amount || 0), 0) };
};

function List({ deals, active }) {
  const { S, a } = useStore();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center px-5"><h1 className="font-serif text-2xl text-army">Chats</h1></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-24 md:pb-4">
        {deals.length === 0 && <p className="px-3 py-6 text-sm text-ink-soft">No chats yet. When a seller accepts an application, the chat opens here.</p>}
        {deals.map(d => {
          const { o, other } = useDealCtx(S, a, d), last = d.msgs[d.msgs.length - 1], pend = d.dels.filter(x => x.status === 'pending').length;
          return (
            <button key={d.id} onClick={() => go('chats-' + d.id)} className={cx('flex min-h-[76px] w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition', active === d.id ? 'bg-white shadow-card' : 'hover:bg-white/60')}>
              <Avatar name={other} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{other}</span><span className="shrink-0 text-xs text-ink-soft">{last?.at}</span></div>
                <div className="truncate text-sm text-ink-soft">{last ? (last.f === ME[S.role].id ? 'You: ' : '') + last.t : 'No messages yet'}</div>
                <div className="mt-0.5 truncate text-xs font-medium text-army/60">{o.title}</div>
              </div>
              {pend > 0 && S.role === 'seller' && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1.5 text-[10px] font-bold text-white">{pend}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Conversation({ d, onInfo, onBack }) {
  const { S, a } = useStore();
  const { o, other } = useDealCtx(S, a, d);
  const [t, setT] = useState(''); const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [d.msgs.length, d.id]);
  const submit = (e) => { e.preventDefault(); if (!t.trim()) return; a.send(d, t); setT(''); };
  const mineId = ME[S.role].id;
  return (
    <div className="flex h-full min-h-0 flex-col bg-cream-50">
      <header className="flex h-16 shrink-0 items-center gap-3 bg-white px-4">
        {onBack && <IconButton size="sm" label="Back" className="md:hidden" onClick={onBack}><Ic.Back width="20" height="20" /></IconButton>}
        <Avatar name={other} size={40} />
        <div className="min-w-0 flex-1"><div className="truncate font-semibold leading-5">{other}</div><div className="truncate text-xs text-ink-soft">{o.title}</div></div>
        <Tag s={d.status} />
        {onInfo && <IconButton size="sm" label="Details" className="xl:hidden" onClick={onInfo}><Ic.Info width="20" height="20" /></IconButton>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <div className="mx-auto mb-2 rounded-full bg-cream-100 px-4 py-1.5 text-center text-xs text-ink-soft">Deal started {d.since}. Terms are frozen.</div>
          {d.msgs.map((m, i) => { const me = m.f === mineId; return (
            <div key={i} className={cx('flex flex-col', me ? 'items-end' : 'items-start')}>
              <div className={cx('max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] leading-6', me ? 'rounded-br-md bg-army text-white' : 'rounded-bl-md bg-white text-army shadow-card')}>{m.t}</div>
              <span className="mt-1 px-1 text-[11px] text-ink-soft">{m.at}</span>
            </div>); })}
          <div ref={end} />
        </div>
      </div>
      <form onSubmit={submit} className="shrink-0 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Input wrap="flex-1" className="!rounded-full !px-5" placeholder="Write a message" value={t} onChange={e => setT(e.target.value)} />
          <IconButton type="submit" size="md" tone="primary" label="Send" disabled={!t.trim()}><Ic.Send width="22" height="22" /></IconButton>
        </div>
      </form>
    </div>
  );
}

function Panel({ d }) {
  const { S, a } = useStore();
  const { o, p, seller, earned } = useDealCtx(S, a, d), T = TYPES[o.type], F = o.fin;
  const [tab, setTab] = useState('overview'), [ver, setVer] = useState(null), [amt, setAmt] = useState(''), [proof, setProof] = useState(''), [vid, setVid] = useState(null);
  const left = F.budget == null ? null : Math.max(0, F.budget - F.spent);
  const pend = d.dels.filter(x => x.status === 'pending').length;
  const marketer = !seller;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4"><ProductArt p={p} className="h-16 w-20 shrink-0 rounded-2xl" /><div className="min-w-0"><div className="font-semibold leading-5">{o.title}</div><div className="mt-1 text-xs text-ink-soft">{T.name} · {p.name}</div></div></div>
      <div className="grid grid-cols-2 gap-3"><Stat v={money(earned, F.cur)} l="Earned" /><Stat v={left == null ? 'No cap' : money(left, F.cur)} l="Budget left" /></div>
      <Tabs value={tab} onChange={setTab} items={[['overview', 'Overview'], ['dels', 'Deliveries', seller ? pend : 0], ['terms', 'Terms']]} className="-mx-1" />
      {tab === 'overview' && (<>
        <Rows rows={[['Status', <Tag s={d.status} />], ['Reward', T.reward(d.terms) + ' ' + T.sub(d.terms).split(' · ')[0]], ['Max you can earn', F.cap ? money(F.cap, F.cur) : 'No cap'], ['Started', d.since]]} />
        <Button tone="soft" block onClick={() => go('offer-' + o.id)}>View offer</Button>
      </>)}
      {tab === 'dels' && (<div className="flex flex-col gap-4">
        {marketer && d.status === 'active' && (
          <div className="flex flex-col gap-3 rounded-2xl bg-cream-50 p-4">
            <Field label="Report a delivery" help="Paste a proof link, or upload a creator video."><Input placeholder="https://link-to-your-post" value={proof} onChange={e => setProof(e.target.value)} /></Field>
            <div className="flex gap-2"><Button size="sm" className="flex-1" disabled={!proof.trim()} onClick={() => { a.report(d, proof.trim()); setProof(''); }}>Report link</Button><Button size="sm" tone="soft" className="flex-1" onClick={() => a.uploadVideo(d)}><Ic.Up width="18" height="18" /> Video</Button></div>
          </div>)}
        {d.dels.length === 0 && <p className="text-sm text-ink-soft">No deliveries yet.</p>}
        {d.dels.map(x => (
          <div key={x.id} className="flex items-center gap-3">
            {x.video ? <button onClick={() => setVid(x)} className="relative h-12 w-16 shrink-0 overflow-hidden rounded-xl"><ProductArt p={p} className="h-full w-full" /><span className="absolute inset-0 grid place-items-center text-white"><Ic.Play width="16" height="16" /></span></button> : null}
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{x.kind}{x.amount ? ' · ' + money(x.amount, F.cur) : ''}</div><div className="truncate text-xs text-ink-soft">{x.proof}</div></div>
            {seller && x.status === 'pending' ? <Button size="sm" onClick={() => { setVer(x); setAmt(''); }}>Review</Button> : <Tag s={x.status} />}
          </div>))}
        <p className="text-xs leading-4 text-ink-soft">The seller verifies each delivery before it earns anything.</p>
      </div>)}
      {tab === 'terms' && (<div className="flex flex-col gap-4">
        <p className="rounded-2xl bg-cream-50 p-4 text-sm leading-5 text-ink-soft">Frozen when the application was accepted. Later edits to the offer do not change this deal.</p>
        <Rows rows={Object.entries(d.terms).map(([k, v]) => [fieldLabel(k), fmtTerm(k, v, F.cur)])} />
        {d.status !== 'ended' && <div className="flex gap-2">{seller && <Button size="sm" tone="soft" className="flex-1" onClick={() => a.pauseDeal(d)}>{d.status === 'paused' ? 'Resume' : 'Pause'} deal</Button>}<Button size="sm" tone="danger" className="flex-1" onClick={() => a.endDeal(d)}>End deal</Button></div>}
      </div>)}
      <Sheet open={!!ver} onClose={() => setVer(null)} title="Verify delivery" sub={ver && ver.kind + ' · ' + ver.proof}>
        <Field label="What did it earn?" help={F.budget ? 'Budget left ' + money(left, F.cur) : 'No budget on this offer, so this is only a record.'}><Input type="number" min="0" pre={SYM[F.cur] || '$'} suf={F.cur} value={amt} onChange={e => setAmt(e.target.value)} placeholder="0" /></Field>
        <Button block onClick={() => { if (a.verify(d, ver, Math.round((+amt || 0) * 100))) setVer(null); }}>Verify</Button>
        <Button tone="soft" block onClick={() => { a.reject(d, ver); setVer(null); }}>Reject</Button>
      </Sheet>
      <Sheet open={!!vid} onClose={() => setVid(null)} title="Creator video"><Player p={p} sub={vid && (vid.by || 'You') + ' · ' + vid.video} /></Sheet>
    </div>
  );
}

export default function Chats({ id }) {
  const { S, a } = useStore();
  const [info, setInfo] = useState(false);
  const deals = a.myDeals(), d = deals.find(x => x.id === id) || null;
  useEffect(() => { setInfo(false); }, [id]);
  // desktop: always show a conversation
  const sel = d || (typeof window !== 'undefined' && window.matchMedia('(min-width:768px)').matches ? deals[0] : null);
  return (
    <div className="grid h-full grid-cols-1 bg-cream-50 md:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_360px]">
      <div className={cx('min-h-0 bg-cream-100/70', d ? 'hidden md:block' : 'block')}><List deals={deals} active={sel?.id} /></div>
      {sel ? (
        <>
          <div className={cx('min-h-0', d ? 'block' : 'hidden md:block')}><Conversation d={sel} onBack={() => go('chats')} onInfo={() => setInfo(true)} /></div>
          <aside className="hidden min-h-0 overflow-y-auto bg-white p-6 xl:block"><Panel d={sel} /></aside>
          <Sheet open={info} onClose={() => setInfo(false)} title="Deal details"><Panel d={sel} /></Sheet>
        </>
      ) : <div className="hidden place-items-center text-ink-soft md:grid">Pick a chat</div>}
    </div>
  );
}
