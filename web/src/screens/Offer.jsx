import { useEffect, useState } from 'react';
import { useStore, offerOf, prodOf, elig } from '../lib/store.jsx';
import { go, back } from '../lib/router.js';
import { CATS, TYPES, money, FEE, PLATFORMS, GOALS, kindOf } from '../lib/data.js';
import { factsOf } from '../ui/wizard.jsx';
import { Page, Card, Rows, Button, IconButton, Status, Chip, Ic, Avatar, Sheet, Verified, Empty, ProductArt } from '../ui/index.jsx';
import { Gallery, Steps, Player } from '../ui/parts.jsx';

const HOW = {
  commission: [['Apply', 'Send a short note. The seller reviews it.'], ['Share your link', 'Promote it to your audience in your own words.'], ['Earn per sale', 'Each verified sale pays your commission.']],
  attention: [['Apply', 'Send a short note. The seller reviews it.'], ['Post it', 'Share it and report the proof link or video.'], ['Get paid per result', 'Each verified click or view earns the rate.']],
  introduction: [['Apply', 'Tell the seller who you can introduce.'], ['Make the intro', 'Connect them with a real buyer.'], ['Share the contract', 'When it signs, you earn your share.']],
};
export const fieldLabel = (k) => ({ percent: 'Commission', cookie_days: 'Attribution window', rate_cents: 'Rate', per: 'Paid per', share_percent: 'Your share', min_contract_cents: 'Minimum contract' }[k] || k.replace(/_/g, ' '));
export const fmtTerm = (k, v, cur = 'USD') => { switch (k) {
  case 'percent': case 'share_percent': return v + '%';
  case 'cookie_days': return v + ' days';
  case 'rate_cents': case 'min_contract_cents': return money(v, cur);
  case 'per': return String(v).charAt(0).toUpperCase() + String(v).slice(1);
  default: return String(v); } };
export const Bar = ({ pct }) => <div className="h-1.5 overflow-hidden rounded-full bg-cream-100"><i className="block h-full rounded-full bg-sage-700" style={{ width: Math.max(0, Math.min(100, pct || 0)) + '%' }} /></div>;
// one plain sentence about what a creator earns
export const earnLine = (type, t, cur) => type === 'attention' ? 'Earn ' + money(t.rate_cents || 0, cur) + ' for every ' + (t.per || 'click') + ' you bring.'
  : type === 'commission' ? 'Earn ' + t.percent + '% of every sale you bring' + (t.cookie_days ? ', counted for ' + t.cookie_days + ' days after a click.' : '.')
  : 'Earn ' + t.share_percent + '% of any contract you help sign' + (t.min_contract_cents ? ' (from ' + money(t.min_contract_cents, cur) + ').' : '.');
const plat = (k) => PLATFORMS.find((p) => p[0] === k)?.[1] || k;

export default function Offer({ id }) {
  const { S, a } = useStore();
  const [demo, setDemo] = useState(false), [pick, setPick] = useState(null), [busy, setBusy] = useState(false);
  useEffect(() => { a.loadOffer(id); }, [id, S.auth]);
  const o = offerOf(S, id), mine = a.isMine(o);
  useEffect(() => { if (mine && !S.recv) a.loadSeller(); }, [mine]);
  if (!o || (!o.title && !o.missing)) return <Page crumb="Feed" onBack={() => back('feed')}><div className="grid h-64 place-items-center"><span className="h-8 w-8 animate-spin rounded-full border-2 border-cream-200 border-t-army" /></div></Page>;
  if (o.missing && !o.title) return <Page crumb="Feed" onBack={() => back('feed')}><Empty icon={<Ic.Tag />} title="This listing isn't available" text="It may be paused, closed or removed." action={<Button tone="secondary" onClick={() => go('feed')}>Back to the feed</Button>} /></Page>;
  const p = prodOf(S, o.pid) || { name: o.co, category: 'other', images: [] }, T = TYPES[o.type] || TYPES.commission, F = o.fin, e = elig(o, a);
  const ints = (S.recv || []).filter(i => i.offer === o.id);
  const accepted = o.myInterest?.status === 'accepted' || !!o.myRel, deal = a.dealFor(o), mi = a.myInterest(o);
  const left = F.budget == null ? null : Math.max(0, F.budget - F.spent), full = (F.budget != null && left === 0) || o.full;
  const visitFn = () => window.open(p.url, '_blank', 'noopener');

  const primary = mine ? <Button tone="secondary" size="lg" block disabled={o.status === 'draft' || o.status === 'closed'} onClick={() => a.toggleOffer(o)}>{o.status === 'draft' ? 'Opens once paid' : o.status === 'open' ? 'Pause listing' : o.status === 'closed' ? 'Closed' : 'Reopen listing'}</Button>
    : accepted ? <Button size="lg" block onClick={() => go(deal ? 'chats/' + deal.id : 'chats')}><Ic.Chat width="20" height="20" />Open chat</Button>
    : mi ? <Button tone="sage" size="lg" block onClick={() => a.withdraw(o)}><Ic.Check width="20" height="20" />Applied · withdraw</Button>
    : e.known && !e.ok ? <Button size="lg" block disabled>You don't qualify yet</Button>
    : full ? <Button size="lg" block disabled>{o.full ? 'This offer is full' : 'Budget used up'}</Button>
    : o.status !== 'open' ? <Button size="lg" block disabled>Not taking applications</Button>
    : <Button size="lg" block onClick={() => a.apply(o)}>Apply</Button>;

  return (
    <Page crumb={mine ? 'Your listing' : 'Feed'} onBack={() => back(mine ? 'me' : 'feed')} bar={<>{p.url && <IconButton tone="secondary" size="lg" label="Visit website" onClick={visitFn}><Ic.Visit width="20" height="20" /></IconButton>}<div className="flex-1">{primary}</div></>}>
      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2"><Status s={mine && F.budget && !F.funded ? 'unfunded' : o.status} /><Chip tone="sage">{GOALS.find(g => g[0] === o.type)?.[1] || T.name}</Chip><Chip>{kindOf(p.kind)[1]}</Chip></div>
        <h1 className="font-serif text-[26px] leading-[34px] sm:text-title">{o.title}</h1>
        <div className="mt-3 flex items-center gap-2.5 text-small text-ink-soft"><Avatar name={o.co} size={28} /><span className="font-semibold text-ink">{o.co}</span>{o.coV && <Verified />}{p.name && p.name !== o.co && <button onClick={() => go('product/' + o.pid)} className="hover:text-ink hover:underline">· {p.name}</button>}</div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <Gallery p={o.cover ? { ...p, images: [o.cover, ...(p.images || []).filter(u => u !== o.cover)] } : p} onDemo={() => setDemo(true)} />
          <Card title={mine ? 'Your brief' : 'The brief'} sub={mine ? 'What creators are asked to do.' : 'What the seller wants you to do.'}>
            <p className="whitespace-pre-line text-body text-ink/90">{o.desc || (o.type === 'attention' ? 'Post about ' + p.name + ' to your audience and share your link.' : o.type === 'commission' ? 'Share your link with people who would buy ' + p.name + '.' : 'Introduce ' + p.name + ' to a company that needs it.')}</p>
            <div className="mt-4 flex gap-3 rounded-2xl bg-sage-50 p-4"><Ic.Wallet width="20" height="20" className="shrink-0 text-sage-700" /><p className="text-small font-semibold text-sage-700">{earnLine(o.type, o.terms, F.cur)}</p></div>
          </Card>
          {mine ? (
            <Card title="Applications" sub={ints.length ? 'Review each one to accept or deny.' : undefined} action={ints.length ? <span className="text-small font-semibold text-ink-soft">{ints.filter(i => i.status === 'pending').length} pending</span> : null}>
              {ints.length ? <div className="-mx-3 flex flex-col">{ints.map(i => (
                <button key={i.id} onClick={() => setPick(i)} className="flex min-h-[68px] items-center gap-3 rounded-2xl px-3 text-left transition hover:bg-cream-50"><Avatar name={i.who?.name} size={44} /><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 font-semibold">{i.who?.name}{i.who?.verified && <Verified />}</div><div className="truncate text-small text-ink-soft">{i.who?.social ? plat(i.who.social.platform) + ' · ' + (i.who.social.followers || 0).toLocaleString() + ' followers' : 'No account picked'}{i.who?.country ? ' · ' + i.who.country : ''}</div></div><Status s={i.status} /><Ic.Chev width="18" height="18" className="text-ink-faint" /></button>))}</div>
                : <Empty icon={<Ic.Me />} title="No applications yet" text={o.status === 'open' ? 'Marketers who apply show up here for you to review.' : 'Applications open once the offer is live.'} />}
            </Card>
          ) : <Steps title="How it works" sub="Terms are frozen the moment the seller accepts you." steps={HOW[o.type] || HOW.commission} />}
          {!mine && (
            <Card title="Who can apply">
              <ul className="flex flex-col">{(e.res.length ? e.res : [{ ok: true, t: 'Open to every marketer', you: 'No requirements' }]).map((x, i) => (
                <li key={x.t} className={'flex min-h-[56px] items-center gap-3 py-2 ' + (i ? 'border-t border-cream-100' : '')}><span className={'grid h-7 w-7 shrink-0 place-items-center rounded-full ' + (x.ok ? 'bg-sage-50 text-sage-700' : 'bg-[#FBEAE4] text-[#A23B17]')}>{x.ok ? <Ic.Check width="15" height="15" /> : <Ic.X width="15" height="15" />}</span><span className="min-w-0 flex-1"><span className="block font-semibold">{x.t}</span>{x.you && <span className="block text-small text-ink-soft">{x.you}</span>}</span></li>))}</ul>
              {e.known && !e.ok && <p className="mt-3 rounded-2xl bg-[#FBEAE4] p-3 text-small text-[#A23B17]">{o.reasons[0]}</p>}
            </Card>
          )}
          <Card title="About the product" action={<button onClick={() => go('product/' + o.pid)} className="text-small font-semibold text-sage-700 hover:underline">View</button>}>
            <div className="flex items-start gap-4"><ProductArt p={p} fit="78%" className="h-16 w-[85px] shrink-0 rounded-2xl" /><div className="min-w-0"><div className="font-semibold">{p.name}</div><div className="text-small text-ink-soft">{kindOf(p.kind)[2]}</div>{p.desc && <p className="mt-2 line-clamp-3 text-small text-ink/80">{p.desc}</p>}</div></div>
            {factsOf(p).length > 0 && <div className="mt-4"><Rows rows={factsOf(p)} /></div>}
          </Card>
          <Card title="Terms"><Rows rows={Object.entries(o.terms).map(([k, v]) => [fieldLabel(k), fmtTerm(k, v, F.cur)])} /></Card>
        </div>
        <aside className="flex flex-col gap-6 lg:sticky lg:top-0 lg:self-start">
          <Card>
            <div className="text-caption font-semibold uppercase tracking-wider text-ink-faint">{mine ? 'Creators earn' : 'You earn'}</div>
            <div className="mt-2 font-serif text-[48px] leading-none">{T.reward(o.terms, F.cur)}</div>
            <div className="mt-2 text-small text-ink-soft">{T.sub(o.terms, F.cur)}</div>
            <p className="mt-3 text-small text-ink/80">{earnLine(o.type, o.terms, F.cur)}</p>
            <div className="my-5 h-px bg-cream-100" />
            <div className="mb-2 flex items-baseline justify-between text-body"><span className="text-ink-soft">Budget left</span><b className="tnum">{left == null ? 'Open' : money(left, F.cur)}</b></div>
            {F.budget ? <Bar pct={left / F.budget * 100} /> : null}
            <div className="mt-3"><Rows rows={[['Max per marketer', F.cap ? money(F.cap, F.cur) : 'No limit']]} /></div>
            <div className="mt-5 hidden flex-col gap-2.5 lg:flex">{primary}{p.url && <Button tone="secondary" size="lg" block onClick={visitFn}><Ic.Visit width="18" height="18" />Visit website</Button>}</div>
            <p className="mt-4 flex gap-2 text-caption text-ink-soft"><Ic.Shield width="16" height="16" className="shrink-0" />{mine ? 'You can pause or reopen this any time.' : 'The seller reviews every application. Terms are frozen once accepted.'}</p>
          </Card>
          {mine && (
            <Card title="Financials" action={F.budget ? <Status s={F.funded ? 'funded' : 'unfunded'} /> : null}>
              {F.budget ? (<>
                {!F.funded && <p className="mb-4 rounded-2xl bg-[#FBF1DE] p-3 text-small text-[#8A5A10]">Pay {money(F.due, F.cur)} to put the budget in. We'll email you how to pay, and the offer opens once it lands.</p>}
                <div className="mb-2 flex justify-between text-small"><span className="text-ink-soft">{Math.round(F.spent / F.budget * 100)}% spent</span><span className="tnum font-semibold">{money(F.spent, F.cur)} / {money(F.budget, F.cur)}</span></div><Bar pct={F.spent / F.budget * 100} />
                <div className="mt-3"><Rows rows={[['Listing fee (' + FEE / 100 + '%)', money(F.fee, F.cur)], ['Total to pay', money(F.due, F.cur)]]} /></div></>) : <p className="text-small text-ink-soft">No budget set. You settle payouts directly with each marketer.</p>}
            </Card>
          )}
        </aside>
      </div>
      <Sheet open={demo} onClose={() => setDemo(false)} title={p.name + ' demo'}><Player src={p.videoUrl} /></Sheet>
      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick?.who?.name} sub={pick && 'Applied to ' + o.title}
        footer={pick?.status === 'pending' && <><Button size="lg" block disabled={busy} onClick={async () => { setBusy(true); const d = await a.accept(pick); setBusy(false); setPick(null); if (d) go('chats/' + d); }}>Accept and open chat</Button><Button tone="secondary" size="lg" block disabled={busy} onClick={async () => { await a.deny(pick); setPick(null); }}>Deny</Button></>}>
        {pick && (<>
          <div className="grid grid-cols-3 divide-x divide-cream-100 rounded-2xl bg-cream-50 py-3 text-center">{[[(pick.who?.social?.followers || 0).toLocaleString(), 'Followers'], [pick.who?.country || '—', 'Country'], [pick.who?.verified ? 'Yes' : 'No', 'Verified']].map(([v, l]) => <div key={l}><div className="tnum font-semibold">{v}</div><div className="text-caption text-ink-soft">{l}</div></div>)}</div>
          <div><div className="mb-1.5 text-small font-semibold">Their note</div><p className="rounded-2xl bg-cream-50 p-4 text-body">{pick.msg || 'No note.'}</p></div>
          {pick.who?.social && <div><div className="mb-1.5 text-small font-semibold">Account</div><p className="text-small text-ink-soft">{plat(pick.who.social.platform)} · @{pick.who.social.handle}{pick.who.social.is_verified ? ' · verified' : ''}</p></div>}
          {pick.status === 'pending' ? <p className="text-caption text-ink-soft">Accepting freezes today's terms and opens a chat.</p> : <Status s={pick.status} />}</>)}
      </Sheet>
    </Page>
  );
}
