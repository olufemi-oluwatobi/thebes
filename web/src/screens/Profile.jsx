import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { CATS, TYPES, ME, PEOPLE, money, prodOf, offerOf } from '../lib/data.js';
import { Page, Card, StatGroup, Tabs, Button, Status, Avatar, Ic, ProductArt, Verified, Segmented, Empty, cx } from '../ui/index.jsx';
import { Bar } from './Offer.jsx';

const Row = ({ onClick, lead, title, sub, trail, first }) => (
  <button onClick={onClick} className={cx('flex min-h-[76px] w-full items-center gap-4 px-5 py-3 text-left transition hover:bg-cream-50 sm:px-6', !first && 'border-t border-cream-100')}>{lead}<div className="min-w-0 flex-1"><div className="truncate font-semibold">{title}</div><div className="mt-0.5 truncate text-small text-ink-soft">{sub}</div></div>{trail}</button>
);
const Thumb = ({ p }) => <ProductArt p={p} fit="80%" className="h-12 w-12 shrink-0 rounded-xl" />;
const SOC = { Instagram: '#C13584', YouTube: '#C4302B', TikTok: '#111' };

export default function Profile() {
  const { S, a } = useStore();
  const seller = S.role === 'seller', u = ME[S.role];
  const mine = S.offers.filter(o => o.owner === 'u-kofi'), recv = S.interests.filter(i => mine.some(o => o.id === i.offer)), pend = recv.filter(i => i.status === 'pending').length;
  const deals = a.myDeals(), sent = S.interests.filter(i => i.from === 'u-ada');
  const earnOf = (d) => d.dels.filter(x => x.status === 'verified').reduce((m, x) => m + (x.amount || 0), 0);
  const earn = deals.reduce((n, d) => n + earnOf(d), 0), toVerify = deals.reduce((n, d) => n + d.dels.filter(x => x.status === 'pending').length, 0);
  const tabs = seller ? [['deals', 'Deals'], ['inbox', 'Applications', pend], ['offers', 'Offers'], ['products', 'Products']] : [['deals', 'Deals'], ['inbox', 'Applications'], ['socials', 'Socials']];
  const [tab, setTab] = useState('deals'); const t = tabs.some(x => x[0] === tab) ? tab : 'deals';
  const myProducts = S.products.filter(p => p.owner === 'u-kofi' || p.mine);

  const list = {
    deals: deals.length ? deals.map((d, i) => { const o = offerOf(S, d.offer), nm = seller ? (PEOPLE[d.marketer]?.name || d.marketer) : o.co; return <Row key={d.id} first={!i} onClick={() => go('chats-' + d.id)} lead={<Avatar name={nm} size={44} />} title={nm} sub={o.title} trail={<div className="flex flex-col items-end gap-1"><span className="tnum text-small font-semibold">{money(earnOf(d), o.fin.cur)}</span><Status s={d.status} /></div>} />; })
      : <Empty icon={<Ic.Chat />} title="No deals yet" text="Accepted applications become deals with a chat." action={<Button tone="secondary" onClick={() => go('feed')}>Browse offers</Button>} />,
    inbox: seller ? (recv.length ? recv.map((i, k) => { const q = PEOPLE[i.from] || { name: i.from }; return <Row key={i.id} first={!k} onClick={() => go('offer-' + i.offer)} lead={<Avatar name={q.name} size={44} />} title={q.name} sub={offerOf(S, i.offer).title} trail={<Status s={i.status} />} />; }) : <Empty icon={<Ic.Me />} title="No applications yet" text="Marketers who apply to your offers show up here." />)
      : (sent.length ? sent.map((i, k) => { const o = offerOf(S, i.offer); return <Row key={i.id} first={!k} onClick={() => go('offer-' + i.offer)} lead={<Thumb p={prodOf(S, o.pid)} />} title={o.title} sub={o.co} trail={<Status s={i.status} />} />; }) : <Empty icon={<Ic.Tag />} title="No applications yet" text="Find an offer in the feed and tap Apply." action={<Button tone="secondary" onClick={() => go('feed')}>Browse offers</Button>} />),
    offers: mine.map((o, i) => { const p = prodOf(S, o.pid), F = o.fin; return <Row key={o.id} first={!i} onClick={() => go('offer-' + o.id)} lead={<Thumb p={p} />} title={o.title} sub={<span className="flex items-center gap-3"><span>{TYPES[o.type].name} · {TYPES[o.type].reward(o.terms)}</span>{F.budget && <span className="hidden w-20 sm:inline-block"><Bar pct={F.spent / F.budget * 100} /></span>}</span>} trail={<Status s={F.budget && !F.funded ? 'unfunded' : o.status} />} />; }),
    products: myProducts.map((p, i) => <Row key={p.id} first={!i} onClick={() => go('product-' + p.id)} lead={<Thumb p={p} />} title={p.name} sub={CATS[p.category] + ' · ' + S.offers.filter(o => o.pid === p.id).length + ' offer(s)' + (p.video ? ' · demo video' : '')} trail={<Ic.Chev width="18" height="18" className="text-ink-faint" />} />),
    socials: ME.marketer.socials.map((s, i) => <Row key={s[1]} first={!i} lead={<span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-small font-bold text-white" style={{ background: SOC[s[0]] }}>{s[0][0]}</span>} title={s[1]} sub={s[0] + ' · ' + s[2].toLocaleString() + ' followers'} trail={<Status s="verified" />} />),
  }[t];

  return (
    <Page crumb="Profile" right={<Button size="sm" tone="secondary" onClick={() => a.toast('Profile editing comes next')}>Edit profile</Button>}>
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
        <aside className="flex flex-col gap-6 lg:sticky lg:top-0 lg:self-start">
          <Card>
            <div className="flex items-center gap-4 lg:flex-col lg:items-start"><Avatar name={u.name} size={72} /><div className="min-w-0"><h1 className="flex items-center gap-2 font-serif text-[24px] leading-8">{u.name}<Verified /></h1><div className="text-small text-ink-soft">@{u.handle}</div></div></div>
            <div className="mt-5 flex flex-col gap-2.5 text-small text-ink-soft">
              {seller ? <div className="flex items-center gap-2.5"><Ic.Box width="16" height="16" />{ME.seller.company}</div> : <div className="flex items-center gap-2.5"><Ic.Me width="16" height="16" />{ME.marketer.followers.toLocaleString()} followers</div>}
              <div className="flex items-center gap-2.5"><Ic.Globe width="16" height="16" />{seller ? 'Accra, Ghana' : 'Lagos, Nigeria'}</div>
              <div className="flex items-center gap-2.5"><Ic.Shield width="16" height="16" />Verified {seller ? 'seller' : 'marketer'}</div>
            </div>
          </Card>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          <StatGroup items={[[money(earn), seller ? 'Paid out' : 'Earned'], [deals.filter(d => d.status === 'active').length, 'Active deals'], [seller ? toVerify : sent.filter(i => i.status === 'pending').length, seller ? 'To verify' : 'Pending']]} />
          <div><Tabs value={t} onChange={setTab} items={tabs} className="mb-3" /><Card pad={false} className="overflow-hidden">{list}</Card></div>
          <Card className="lg:hidden"><div className="mb-2 text-caption font-semibold uppercase tracking-wider text-ink-faint">Demo view</div><Segmented value={S.role} onChange={(v) => v !== S.role && a.setRole()} items={[['marketer', 'Marketer'], ['seller', 'Seller']]} /></Card>
        </div>
      </div>
    </Page>
  );
}
