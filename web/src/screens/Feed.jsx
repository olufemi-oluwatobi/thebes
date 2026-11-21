import { useEffect } from 'react';
import { useStore, prodOf, elig } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { CATS, TYPES, money, bgFor, artFor } from '../lib/data.js';
import { Ic, Chip, Avatar, Art, Button, Verified, LogoMark, cx } from '../ui/index.jsx';

const TONE = {
  apply: 'bg-[#6E9A2F] text-white shadow-[0_8px_20px_-6px_rgb(110_154_47/.7)]',
  applied: 'bg-sage text-army shadow-[0_8px_20px_-6px_rgb(203_214_168/.6)]',
  visit: 'bg-[#2F6FA3] text-white shadow-[0_8px_20px_-6px_rgb(47_111_163/.7)]',
  details: 'bg-[#E0B06A] text-army shadow-[0_8px_20px_-6px_rgb(224_176_106/.6)]',
  share: 'bg-white text-army shadow-[0_8px_20px_-6px_rgb(0_0_0/.45)]',
  manage: 'bg-army text-sage ring-1 ring-sage/40 shadow-[0_8px_20px_-6px_rgb(0_0_0/.5)]',
};
function RailButton({ label, tone, disabled, onClick, children }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} disabled={disabled} className="group flex flex-col items-center gap-1.5 disabled:opacity-40" aria-label={label}>
      <span className={cx('grid h-[52px] w-[52px] place-items-center rounded-full transition group-hover:scale-105 group-active:scale-95', TONE[tone])}>{children}</span>
      <span className="text-[11px] font-semibold text-white [text-shadow:0_1px_3px_rgb(0_0_0/.5)]">{label}</span>
    </button>
  );
}

function Slide({ o }) {
  const { S, a } = useStore();
  const p = prodOf(S, o.pid) || { name: o.co, category: 'other' }, T = TYPES[o.type] || TYPES.commission, mine = a.isMine(o), e = elig(o, a);
  const accepted = o.myInterest?.status === 'accepted' || !!o.myRel, applied = !!a.myInterest(o) || accepted, deal = a.dealFor(o);
  const left = o.fin.budget == null ? null : Math.max(0, o.fin.budget - o.fin.spent);
  const visit = () => { if (p.url) window.open(p.url, '_blank', 'noopener'); else a.toast('This product has no website yet'); };
  const apply = () => accepted ? go(deal ? 'chats/' + deal.id : 'chats') : applied ? a.withdraw(o) : a.apply(o);
  const share = async () => { const url = location.origin + '/app/#offer/' + o.id; try { if (navigator.share) await navigator.share({ title: o.title, url }); else { await navigator.clipboard.writeText(url); a.toast('Link copied'); } } catch {} };
  const miss = e.res.filter(x => !x.ok);
  return (
    <article onClick={() => go('offer/' + o.id)} className="relative h-full w-full cursor-pointer overflow-hidden text-white" style={{ background: bgFor(p) }}>
      <div className="absolute inset-0 opacity-[.12] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 to-transparent lg:hidden" />
      <div className="relative mx-auto flex h-full w-full max-w-[1120px] flex-col px-5 pb-[104px] pt-[72px] lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center lg:gap-14 lg:px-10 lg:pb-10 lg:pt-24">
        {/* media + left rail */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center lg:h-full lg:max-h-[560px]">
          
          <div className="grid h-full max-h-[340px] w-full place-items-center lg:aspect-[4/3] lg:h-auto lg:max-h-none lg:rounded-[32px] lg:bg-black/15 lg:ring-1 lg:ring-inset lg:ring-white/10">
            {p.img ? <img src={p.img} alt="" className="max-h-full max-w-full rounded-3xl object-contain shadow-pop" /> : <Art k={artFor(p.category)} className="h-full max-h-[300px] w-full max-w-[320px] lg:h-[72%] lg:max-h-none lg:max-w-[440px] [&>svg]:h-full [&>svg]:w-full" />}
          </div>
        </div>
        {/* info */}
        <div className="relative mt-4 pr-[76px] lg:mt-0 lg:pr-0">
          <div className="flex items-center gap-2.5"><Avatar name={o.co} size={32} ring /><span className="truncate text-small font-semibold">{o.co}</span>{o.coV && <Verified />}<span className="text-small text-white/50">· {CATS[p.category] || 'Other'}</span></div>
          <h2 className="mt-3 text-[22px] font-semibold leading-7 lg:font-serif lg:text-title lg:font-normal">{o.title}</h2>
          <div className="mt-3 flex items-baseline gap-2"><span className="font-serif text-[40px] leading-none lg:text-[56px]">{T.reward(o.terms, o.fin.cur)}</span><span className="text-small text-white/75">{T.sub(o.terms, o.fin.cur)}</span></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip tone="sage">{T.name}</Chip>
            <Chip tone="glass" icon={<Ic.Wallet width="14" height="14" />}>{left == null ? 'Open budget' : money(left, o.fin.cur) + ' left'}</Chip>
            {!mine && e.known && (e.ok ? <Chip tone="glass" icon={<Ic.Check width="14" height="14" />}>You qualify</Chip> : <Chip tone="glass" className="!text-[#F6C9B6]" icon={<Ic.X width="14" height="14" />}>{miss[0]?.t || o.reasons[0] || 'Not eligible'}</Chip>)}
          </div>
          
        </div>
      </div>
        {/* action stack: bottom right, colour-coded */}
        <div className="absolute bottom-[104px] right-4 z-10 flex flex-col items-center gap-4 lg:bottom-10 lg:right-8" onClick={e => e.stopPropagation()}>
          {mine ? <RailButton label="Manage" tone="manage" onClick={() => go('offer/' + o.id)}><Ic.Tag width="22" height="22" /></RailButton>
            : <RailButton label={accepted ? 'Chat' : applied ? 'Applied' : 'Apply'} tone={applied ? 'applied' : 'apply'} disabled={!applied && e.known && !e.ok} onClick={apply}>{accepted ? <Ic.Chat width="22" height="22" /> : <Ic.Check width="24" height="24" />}</RailButton>}
          <RailButton label="Visit" tone="visit" onClick={visit}><Ic.Visit width="22" height="22" /></RailButton>
          <RailButton label="Details" tone="details" onClick={() => go('offer/' + o.id)}><Ic.Info width="22" height="22" /></RailButton>
          <RailButton label="Share" tone="share" onClick={share}><Ic.Share width="22" height="22" /></RailButton>
        </div>
    </article>
  );
}

export default function Feed() {
  const { S, a } = useStore();
  const fc = S.feedCat || 'all';
  useEffect(() => { if (!S.feed || S.feedCatLoaded !== fc) a.loadFeed(fc); }, [fc, !!S.feed, S.auth]);
  const list = (S.feed || []).map(id => S.offers[id]).filter(Boolean);
  const cats = [['all', 'For you'], ...Object.entries(CATS).filter(([k]) => k !== 'other')];
  return (
    <div className="relative h-full bg-army-900">
      <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/45 to-transparent">
        <div className="mx-auto flex max-w-[1120px] items-center gap-4 px-5 pb-6 pt-[max(16px,env(safe-area-inset-top))] lg:px-10 lg:pt-6">
          <span className="lg:hidden"><LogoMark size={30} /></span>
          <div className="no-scrollbar fade-r flex min-w-0 flex-1 gap-1 overflow-x-auto lg:[mask-image:none]">
            {cats.map(([k, l]) => <button key={k} onClick={() => a.loadFeed(k)} className={cx('h-9 shrink-0 rounded-full px-3.5 text-small font-semibold transition', fc === k ? 'bg-white text-army' : 'text-white/70 hover:text-white')}>{l}</button>)}
          </div>
          {S.auth === 'out' && <Button size="sm" tone="sage" onClick={() => a.openSignin()}>Sign in</Button>}
        </div>
      </div>
      <div className="snap-feed no-scrollbar h-full overflow-y-auto">
        {!S.feed ? <div className="grid h-full place-items-center"><span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-sage" /></div>
          : list.length ? list.map(o => <div key={o.id} className="h-full"><Slide o={o} /></div>)
          : <div className="grid h-full place-items-center px-8 text-center text-white"><div><span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-sage"><Ic.Tag /></span><div className="text-subhead font-semibold">No offers here yet</div><p className="mx-auto mt-1 max-w-xs text-small text-white/60">{fc === 'all' ? 'Be the first: post an offer and marketers will see it here.' : 'Nothing in this category yet. Try For you.'}</p><Button tone="sage" className="mt-5" onClick={() => go('plus')}>Post an offer</Button></div></div>}
      </div>
    </div>
  );
}
