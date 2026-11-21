import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go, back } from '../lib/router.js';
import { CATS, TYPES, money, FEE, prodOf, offerOf, elig, PEOPLE } from '../lib/data.js';
import { Page, Card, Rows, Button, IconButton, Status, Chip, Ic, Avatar, Sheet, ProductArt, Verified, Empty } from '../ui/index.jsx';
import { Gallery, Steps, Player } from '../ui/parts.jsx';

const HOW = {
  commission: [['Apply', 'Send a short note. The seller reviews it.'], ['Share your link', 'Promote it to your audience in your own words.'], ['Earn per sale', 'Each verified sale pays your commission.']],
  attention: [['Apply', 'Send a short note. The seller reviews it.'], ['Post it', 'Share it and report the proof link or video.'], ['Get paid per result', 'Each verified click or view earns the rate.']],
  introduction: [['Apply', 'Tell the seller who you can introduce.'], ['Make the intro', 'Connect them with a real buyer.'], ['Share the contract', 'When it signs, you earn your share.']],
};
export const fieldLabel = (k) => ({ percent: 'Commission', cookie_days: 'Attribution window', rate_cents: 'Rate', per: 'Paid per', share_percent: 'Your share', min_contract_cents: 'Minimum contract' }[k] || k);
export const fmtTerm = (k, v, cur = 'USD') => ({ percent: v + '%', cookie_days: v + ' days', rate_cents: money(v, cur), per: 'per ' + v, share_percent: v + '%', min_contract_cents: money(v, cur) }[k] ?? v);
export const Bar = ({ pct }) => <div className="h-1.5 overflow-hidden rounded-full bg-cream-100"><i className="block h-full rounded-full bg-sage-700" style={{ width: Math.min(100, pct) + '%' }} /></div>;

export default function Offer({ id }) {
  const { S, a } = useStore();
  const [demo, setDemo] = useState(false), [pick, setPick] = useState(null);
  const o = offerOf(S, id); if (!o) { go('feed'); return null; }
  const p = prodOf(S, o.pid), T = TYPES[o.type], F = o.fin, mine = a.isMine(o), e = elig(o);
  const ints = S.interests.filter(i => i.offer === o.id), deal = a.dealFor(o), mi = a.myInterest(o);
  const left = F.budget == null ? null : Math.max(0, F.budget - F.spent), full = F.budget != null && left === 0;
  const fee = F.budget ? Math.round(F.budget * FEE / 10000) : 0;
  const cvs = S.deals.filter(d => d.offer === o.id).flatMap(d => d.dels.filter(x => x.video));
  const visitFn = () => { try { window.open(p.url, '_blank', 'noopener'); } catch {} a.toast('Opening ' + p.url.replace('https://', '')); };

  const primary = mine ? <Button tone="secondary" size="lg" block onClick={() => a.toggleOffer(o)}>{o.status === 'open' ? 'Pause offer' : 'Reopen offer'}</Button>
    : deal ? <Button size="lg" block onClick={() => go('chats-' + deal.id)}><Ic.Chat width="20" height="20" />Open chat</Button>
    : mi ? <Button tone="sage" size="lg" block onClick={() => a.withdraw(o)}><Ic.Check width="20" height="20" />Applied · withdraw</Button>
    : !e.ok ? <Button size="lg" block disabled>You don't qualify yet</Button>
    : full ? <Button size="lg" block disabled>Budget used up</Button>
    : <Button size="lg" block onClick={() => a.apply(o)}>Apply</Button>;

  return (
    <Page crumb="Feed" onBack={() => back('feed')} bar={<>{p.url && <IconButton tone="secondary" size="lg" label="Visit website" onClick={visitFn}><Ic.Visit width="20" height="20" /></IconButton>}<div className="flex-1">{primary}</div></>}>
      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2"><Status s={o.status} /><Chip>{CATS[p.category]}</Chip><Chip>{T.name}</Chip></div>
        <h1 className="font-serif text-[26px] leading-[34px] sm:text-title">{o.title}</h1>
        <div className="mt-3 flex items-center gap-2.5 text-small text-ink-soft"><Avatar name={o.co} size={28} /><span className="font-semibold text-ink">{o.co}</span>{o.coV && <Verified />}{p.name !== o.co && <span>· {p.name}</span>}</div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <Gallery p={p} onDemo={() => setDemo(true)} />
          <Card title="About this offer"><p className="text-body text-ink/90">{o.desc}</p></Card>
          {mine ? (
            <Card title="Applications" sub={ints.length ? 'Review each one to accept or deny.' : undefined} action={ints.length ? <span className="text-small font-semibold text-ink-soft">{ints.filter(i => i.status === 'pending').length} pending</span> : null}>
              {ints.length ? <div className="-mx-3 flex flex-col">{ints.map(i => { const q = PEOPLE[i.from] || { name: i.from }; return (
                <button key={i.id} onClick={() => setPick(i)} className="flex min-h-[68px] items-center gap-3 rounded-2xl px-3 text-left transition hover:bg-cream-50"><Avatar name={q.name} size={44} /><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 font-semibold">{q.name}{q.verified && <Verified />}</div><div className="text-small text-ink-soft">{(q.followers || 0).toLocaleString()} followers · {q.country}</div></div><Status s={i.status} /><Ic.Chev width="18" height="18" className="text-ink-faint" /></button>); })}</div>
                : <Empty icon={<Ic.Me />} title="No applications yet" text="Marketers who apply show up here for you to review." />}
            </Card>
          ) : <Steps title="How it works" sub="Terms are frozen the moment the seller accepts you." steps={HOW[o.type]} />}
          {!mine && (
            <Card title="Who can apply">
              <ul className="flex flex-col">{(e.res.length ? e.res : [{ ok: true, t: 'Open to every marketer', you: 'No requirements' }]).map((x, i) => (
                <li key={x.t} className={'flex min-h-[56px] items-center gap-3 ' + (i ? 'border-t border-cream-100' : '')}><span className={'grid h-7 w-7 shrink-0 place-items-center rounded-full ' + (x.ok ? 'bg-sage-50 text-sage-700' : 'bg-[#FBEAE4] text-[#A23B17]')}>{x.ok ? <Ic.Check width="15" height="15" /> : <Ic.X width="15" height="15" />}</span><span className="flex-1 font-semibold">{x.t}</span><span className="text-small text-ink-soft">{x.you}</span></li>))}</ul>
            </Card>
          )}
          {cvs.length > 0 && <Card title="Creator videos" sub="Made by marketers on this offer"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{cvs.map(v => <button key={v.id} onClick={() => setDemo(true)} className="group text-left"><div className="relative overflow-hidden rounded-2xl"><ProductArt p={p} fit="62%" className="aspect-video w-full" /><span className="absolute inset-0 grid place-items-center"><span className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-army shadow-lift transition group-hover:scale-110"><Ic.Play width="14" height="14" /></span></span><span className="absolute bottom-2 right-2 rounded-md bg-black/50 px-1.5 text-[11px] font-semibold text-white">{v.video}</span></div><div className="mt-2 text-small font-semibold">{v.by || 'Marketer'}</div></button>)}</div></Card>}
          <Card title="Terms"><Rows rows={Object.entries(o.terms).map(([k, v]) => [fieldLabel(k), fmtTerm(k, v, F.cur)])} /></Card>
        </div>
        <aside className="flex flex-col gap-6 lg:sticky lg:top-0 lg:self-start">
          <Card>
            <div className="text-caption font-semibold uppercase tracking-wider text-ink-faint">You earn</div>
            <div className="mt-2 font-serif text-[48px] leading-none">{T.reward(o.terms)}</div>
            <div className="mt-2 text-small text-ink-soft">{T.sub(o.terms)}</div>
            <div className="my-5 h-px bg-cream-100" />
            <div className="mb-2 flex items-baseline justify-between text-body"><span className="text-ink-soft">Budget left</span><b className="tnum">{left == null ? 'Open' : money(left, F.cur)}</b></div>
            {F.budget && <Bar pct={left / F.budget * 100} />}
            <div className="mt-3"><Rows rows={[['Max per marketer', F.cap ? money(F.cap, F.cur) : 'No limit']]} /></div>
            <div className="mt-5 hidden flex-col gap-2.5 lg:flex">{primary}{p.url && <Button tone="secondary" size="lg" block onClick={visitFn}><Ic.Visit width="18" height="18" />Visit website</Button>}</div>
            <p className="mt-4 flex gap-2 text-caption text-ink-soft"><Ic.Shield width="16" height="16" className="shrink-0" />{mine ? 'You can pause or reopen this any time.' : 'The seller reviews every application. Terms are frozen once accepted.'}</p>
          </Card>
          {mine && (
            <Card title="Financials" action={<Status s={F.budget ? (F.funded ? 'funded' : 'unfunded') : 'ended'} />}>
              {F.budget ? (<><div className="mb-2 flex justify-between text-small"><span className="text-ink-soft">{Math.round(F.spent / F.budget * 100)}% spent</span><span className="tnum font-semibold">{money(F.spent, F.cur)} / {money(F.budget, F.cur)}</span></div><Bar pct={F.spent / F.budget * 100} />
                <div className="mt-3"><Rows rows={[['Listing fee (' + FEE / 100 + '%)', money(fee, F.cur)], ['Paid in', money(F.funded ? F.budget + fee : 0, F.cur)]]} /></div></>) : <p className="text-small text-ink-soft">No budget set. You settle payouts directly with each marketer.</p>}
            </Card>
          )}
        </aside>
      </div>
      <Sheet open={demo} onClose={() => setDemo(false)} title={p.name + ' demo'}><Player p={p} sub={(p.video || '0:30') + ' · from ' + o.co} /></Sheet>
      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick && (PEOPLE[pick.from] || { name: pick.from }).name} sub={pick && 'Applied to ' + o.title}
        footer={pick?.status === 'pending' && <><Button size="lg" block onClick={() => { const d = a.accept(pick); setPick(null); go('chats-' + d); }}>Accept and open chat</Button><Button tone="secondary" size="lg" block onClick={() => { a.deny(pick); setPick(null); }}>Deny</Button></>}>
        {pick && (() => { const q = PEOPLE[pick.from] || { name: pick.from }; return (<>
          <div className="grid grid-cols-3 divide-x divide-cream-100 rounded-2xl bg-cream-50 py-3 text-center">{[[(q.followers || 0).toLocaleString(), 'Followers'], [q.country, 'Country'], [q.verified ? 'Yes' : 'No', 'Verified']].map(([v, l]) => <div key={l}><div className="tnum font-semibold">{v}</div><div className="text-caption text-ink-soft">{l}</div></div>)}</div>
          <div><div className="mb-1.5 text-small font-semibold">Their note</div><p className="rounded-2xl bg-cream-50 p-4 text-body">{pick.msg}</p></div>
          <div><div className="mb-1.5 text-small font-semibold">Socials</div><p className="text-small text-ink-soft">{q.socials}</p></div>
          {pick.status === 'pending' ? <p className="text-caption text-ink-soft">Accepting freezes today's terms and opens a chat.</p> : <Status s={pick.status} />}</>); })()}
      </Sheet>
    </Page>
  );
}
