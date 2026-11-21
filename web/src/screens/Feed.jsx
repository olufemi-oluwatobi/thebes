import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { CATS, TYPES, money, bgFor, prodOf, elig } from '../lib/data.js';
import { Ic, Chip, Avatar, Art, cx } from '../ui/index.jsx';

function RailButton({ label, on, disabled, onClick, children }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} disabled={disabled} className="group flex w-14 flex-col items-center gap-1.5 disabled:opacity-40" aria-label={label}>
      <span className={cx('grid h-12 w-12 place-items-center rounded-full transition group-active:scale-95', on ? 'bg-sage text-army' : 'bg-black/30 text-white backdrop-blur')}>{children}</span>
      <span className={cx('text-[11px] font-semibold', on ? 'text-sage' : 'text-white/80')}>{label}</span>
    </button>
  );
}

function Slide({ o }) {
  const { S, a } = useStore();
  const p = prodOf(S, o.pid), T = TYPES[o.type], mine = a.isMine(o), e = elig(o);
  const applied = !!a.myInterest(o) || !!a.dealFor(o);
  const left = o.fin.budget == null ? null : Math.max(0, o.fin.budget - o.fin.spent);
  const visit = () => { if (p.url) { try { window.open(p.url, '_blank', 'noopener'); } catch {} a.toast('Opening ' + p.url.replace('https://', '')); } else a.toast('This product has no link yet'); };
  return (
    <article onClick={() => go('offer-' + o.id)} className="relative h-full w-full cursor-pointer overflow-hidden text-white" style={{ background: bgFor(p) }}>
      <div className="absolute inset-0 opacity-[.18] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="relative mx-auto flex h-full w-full max-w-[560px] flex-col px-5 pb-6 pt-24">
        <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-[.14em] text-white/60">{o.co} · {CATS[p.category]}</div>
        <div className="flex min-h-0 flex-1 items-center justify-center pl-14">
          {p.img ? <img src={p.img} alt="" className="max-h-[300px] rounded-3xl object-cover" /> : <Art k={p.art} className="h-full max-h-[300px] w-full max-w-[340px] [&>svg]:h-full [&>svg]:w-full" />}
        </div>
        <div className="text-center">
          <div className="font-serif text-[44px] leading-none">{T.reward(o.terms)}</div>
          <div className="mt-1 text-sm text-white/70">{T.sub(o.terms)}</div>
        </div>
        <div className="mt-5 flex items-center gap-3"><Avatar name={o.co} size={36} tone="dark" /><div className="min-w-0 text-sm font-bold">{o.co}{o.coV ? ' ✓' : ''}</div></div>
        <h2 className="mt-2 text-xl font-bold leading-6">{o.title}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone="sage">{T.name}</Chip>
          <Chip tone="glass">{left == null ? 'No cap' : money(left, o.fin.cur) + ' left'}</Chip>
          {e.res.map(x => <Chip key={x.t} tone="glass">{x.ok ? '✓' : '✕'} {x.t}</Chip>)}
        </div>
        {/* action rail, left side, no counts */}
        <div className="absolute left-3 top-1/2 flex -translate-y-1/2 flex-col gap-5">
          <RailButton label="Visit" onClick={visit}><Ic.Visit /></RailButton>
          {mine ? <RailButton label="Manage" onClick={() => go('offer-' + o.id)}><Ic.Check /></RailButton>
            : <RailButton label={applied ? 'Applied' : 'Apply'} on={applied} disabled={!applied && !e.ok} onClick={() => applied ? a.dealFor(o) ? go('chats-' + a.dealFor(o).id) : a.withdraw(o) : a.apply(o)}><Ic.Check width="24" height="24" /></RailButton>}
          {p.video && <RailButton label="Demo" onClick={() => go('product-' + p.id)}><Ic.Play /></RailButton>}
          <RailButton label="Share" onClick={() => a.toast('Link copied')}><Ic.Share /></RailButton>
        </div>
      </div>
    </article>
  );
}

export default function Feed() {
  const { S } = useStore();
  const [fc, setFc] = useState('all');
  const list = S.offers.filter(o => o.status === 'open' && (fc === 'all' || prodOf(S, o.pid).category === fc));
  const cats = [['all', 'For you'], ...Object.entries(CATS)];
  return (
    <div className="relative h-full bg-army-900">
      <div className="no-scrollbar absolute inset-x-0 top-0 z-10 flex gap-6 overflow-x-auto bg-gradient-to-b from-black/50 to-transparent px-5 pb-6 pt-5">
        {cats.map(([k, l]) => <button key={k} onClick={() => setFc(k)} className={cx('relative shrink-0 pb-2 text-[15px] font-bold transition', fc === k ? 'text-white' : 'text-white/55')}>{l}{fc === k && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-sage" />}</button>)}
      </div>
      <div className="snap-feed no-scrollbar h-full overflow-y-auto">
        {list.length ? list.map(o => <div key={o.id} className="h-full"><Slide o={o} /></div>) : <div className="grid h-full place-items-center text-white/60">Nothing here yet</div>}
      </div>
    </div>
  );
}
