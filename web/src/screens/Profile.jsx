import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { CATS, TYPES, ME, PEOPLE, money, prodOf, offerOf } from '../lib/data.js';
import { Page, Card, Stat, Tabs, Button, Tag, Avatar, Ic, ProductArt } from '../ui/index.jsx';

const Row = ({ onClick, lead, title, sub, trail }) => (
  <button onClick={onClick} className="flex min-h-[72px] w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-cream-50">{lead}<div className="min-w-0 flex-1"><div className="truncate font-semibold">{title}</div><div className="truncate text-xs text-ink-soft">{sub}</div></div>{trail}</button>
);
export default function Profile() {
  const { S, a } = useStore();
  const seller = S.role === 'seller', u = ME[S.role];
  const mine = S.offers.filter(o => o.owner === 'u-kofi'), recv = S.interests.filter(i => mine.some(o => o.id === i.offer)), pend = recv.filter(i => i.status === 'pending').length;
  const deals = a.myDeals(), sent = S.interests.filter(i => i.from === 'u-ada');
  const earn = deals.reduce((n, d) => n + d.dels.filter(x => x.status === 'verified').reduce((m, x) => m + (x.amount || 0), 0), 0);
  const tabs = seller ? [['deals', 'Deals'], ['inbox', 'Applications', pend], ['offers', 'Offers'], ['products', 'Products']] : [['deals', 'Deals'], ['inbox', 'Requests'], ['socials', 'Socials']];
  const [tab, setTab] = useState('deals'); const t = tabs.some(x => x[0] === tab) ? tab : 'deals';
  const empty = (m) => <p className="py-4 text-sm text-ink-soft">{m}</p>;
  return (
    <Page title={'@' + u.handle} crumb="Profile" wide right={<Button size="sm" tone="soft" onClick={a.setRole}>Demo: {seller ? 'marketer' : 'seller'}</Button>}>
      <div className="mb-6 flex items-center gap-5"><Avatar name={u.name} size={80} tone="dark" /><div><h1 className="font-serif text-[28px] leading-9 text-army">{u.name}</h1><p className="mt-1 text-sm text-ink-soft">{seller ? ME.seller.company + ' · seller' : ME.marketer.followers.toLocaleString() + ' followers · ' + ME.marketer.country} · verified</p></div></div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4"><Stat v={deals.filter(d => d.status === 'active').length} l="Active deals" /><Stat v={money(earn)} l={seller ? 'Paid out' : 'Earned'} /><Stat v={deals.reduce((n, d) => n + d.dels.filter(x => x.status === 'pending').length, 0)} l="To verify" /><Stat v={seller ? mine.length : sent.length} l={seller ? 'Offers' : 'Requests'} /></div>
      <Tabs value={t} onChange={setTab} items={tabs} className="mb-4" />
      <Card>
        <div className="-mx-2 flex flex-col">
          {t === 'deals' && (deals.length ? deals.map(d => { const o = offerOf(S, d.offer), nm = seller ? (PEOPLE[d.marketer]?.name || d.marketer) : o.co; return <Row key={d.id} onClick={() => go('chats-' + d.id)} lead={<Avatar name={nm} size={44} />} title={nm} sub={o.title} trail={<Tag s={d.status} />} />; }) : empty('No deals yet. Accepted applications become deals.'))}
          {t === 'inbox' && seller && (recv.length ? recv.map(i => { const q = PEOPLE[i.from] || { name: i.from }; return <Row key={i.id} onClick={() => go('offer-' + i.offer)} lead={<Avatar name={q.name} size={44} />} title={q.name} sub={offerOf(S, i.offer).title} trail={<Tag s={i.status} />} />; }) : empty('No applications yet.'))}
          {t === 'inbox' && !seller && (sent.length ? sent.map(i => <Row key={i.id} onClick={() => go('offer-' + i.offer)} title={offerOf(S, i.offer).title} sub={offerOf(S, i.offer).co} trail={<Tag s={i.status} />} />) : empty('You have not applied to any offer yet. Find one in the feed.'))}
          {t === 'offers' && mine.map(o => { const p = prodOf(S, o.pid), F = o.fin; return <Row key={o.id} onClick={() => go('offer-' + o.id)} lead={<ProductArt p={p} className="h-14 w-[72px] shrink-0 rounded-xl" />} title={o.title} sub={TYPES[o.type].name + ' · ' + (F.budget ? money(F.spent, F.cur) + ' of ' + money(F.budget, F.cur) + ' spent' : 'no budget')} trail={<Tag s={F.budget && !F.funded ? 'unfunded' : o.status} />} />; })}
          {t === 'products' && S.products.filter(p => p.owner === 'u-kofi' || p.mine).map(p => <Row key={p.id} onClick={() => go('product-' + p.id)} lead={<ProductArt p={p} className="h-14 w-[72px] shrink-0 rounded-xl" />} title={p.name} sub={CATS[p.category] + (p.video ? ' · demo video' : '') + ' · ' + S.offers.filter(o => o.pid === p.id).length + ' offer(s)'} trail={<Ic.Chev className="text-ink-soft" />} />)}
          {t === 'socials' && ME.marketer.socials.map(s => <Row key={s[1]} title={s[0] + ' · ' + s[1]} sub={s[2].toLocaleString() + ' followers'} trail={<Tag s="verified" />} />)}
        </div>
      </Card>
    </Page>
  );
}
