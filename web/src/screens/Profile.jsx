import { useEffect, useState } from 'react';
import { useStore, prodOf, offerOf } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { CATS, TYPES, PLATFORMS, money } from '../lib/data.js';
import { Page, Card, StatGroup, Tabs, Button, Status, Avatar, Ic, ProductArt, Verified, Segmented, Empty, Sheet, Field, Input, ThemePicker, cx } from '../ui/index.jsx';
import { Bar } from './Offer.jsx';
import { afterSeller } from '../ui/wizard.jsx';
import { CreatorDetails, VerifySheet } from '../ui/creatorEdit.jsx';

const Row = ({ onClick, lead, title, sub, trail, first }) => (
  <button onClick={onClick} className={cx('flex min-h-[76px] w-full items-center gap-4 px-5 py-3 text-left transition hover:bg-cream-50 sm:px-6', !first && 'border-t border-cream-100')}>{lead}<div className="min-w-0 flex-1"><div className="truncate font-semibold">{title}</div><div className="mt-0.5 truncate text-small text-ink-soft">{sub}</div></div>{trail}</button>
);
const Thumb = ({ p }) => <ProductArt p={p || { category: 'other' }} fit="80%" className="h-12 w-16 shrink-0 rounded-xl" />;
const SOC = { instagram: '#C13584', youtube: '#C4302B', tiktok: '#111', x: '#111', linkedin: '#0A66C2', facebook: '#1877F2' };
const Spinner = () => <div className="grid h-32 place-items-center"><span className="h-7 w-7 animate-spin rounded-full border-2 border-cream-200 border-t-army" /></div>;

export default function Profile() {
  const [ver, setVer] = useState(null);
  const { S, a } = useStore();
  const seller = S.role === 'seller', u = a.me;
  const [tab, setTab] = useState('deals'), [edit, setEdit] = useState(false), [name, setName] = useState('');
  useEffect(() => { if (S.auth !== 'in') return; a.loadDeals(); if (seller && a.hasSeller) a.loadSeller(); if (!seller && a.hasMarketer) a.loadSent(); }, [S.auth, seller, a.hasSeller, a.hasMarketer]);
  if (S.auth === 'out') return <Page crumb="Profile"><Empty icon={<Ic.Me />} title="Your profile" text="Sign in to post offers, apply to promote them and track what you earn." action={<Button onClick={() => a.openSignin()}>Sign in</Button>} /><Card title="Appearance" className="mx-auto mt-8 max-w-md"><ThemePicker /></Card></Page>;
  const hasRole = seller ? a.hasSeller : a.hasMarketer;
  const deals = S.deals || [];
  const earned = deals.reduce((n, d) => n + (d.earned || 0), 0);
  const recv = S.recv || [], sent = S.sent || [], pend = recv.filter(i => i.status === 'pending').length;
  const myOffers = (S.myOfferIds || []).map(id => offerOf(S, id)).filter(Boolean), myProducts = (S.myProductIds || []).map(id => prodOf(S, id)).filter(Boolean);
  const tabs = seller ? [['deals', 'Deals'], ['inbox', 'Applications', pend], ['offers', 'Listings'], ['products', 'Products']] : [['deals', 'Deals'], ['inbox', 'Applications'], ['socials', 'Socials']];
  const t = tabs.some(x => x[0] === tab) ? tab : 'deals';

  const list = !hasRole ? null : {
    deals: !S.deals ? <Spinner /> : deals.length ? deals.map((d, i) => { const nm = seller ? d.marketerName : d.sellerName; return <Row key={d.id} first={!i} onClick={() => go('chats/' + d.id)} lead={<Avatar name={nm} size={44} />} title={nm} sub={d.offerTitle} trail={<Status s={d.status} />} />; })
      : <Empty icon={<Ic.Chat />} title="No deals yet" text={seller ? 'Accept an application and it becomes a deal with a chat.' : 'When a seller accepts your application, it becomes a deal.'} action={!seller && <Button tone="secondary" onClick={() => go('feed')}>Browse offers</Button>} />,
    inbox: seller ? (!S.recv ? <Spinner /> : recv.length ? recv.map((i, k) => <Row key={i.id} first={!k} onClick={() => go('applicant/' + i.id)} lead={<Avatar name={i.who?.name} size={44} />} title={i.who?.name} sub={offerOf(S, i.offer)?.title} trail={<Status s={i.status} />} />) : <Empty icon={<Ic.Me />} title="No applications yet" text="Marketers who apply to your offers show up here." />)
      : (!S.sent ? <Spinner /> : sent.length ? sent.map((i, k) => <Row key={i.id} first={!k} onClick={() => go(i.relId ? 'chats/' + i.relId : 'offer/' + i.offer)} lead={<span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cream-100 text-army"><Ic.Tag width="20" height="20" /></span>} title={i.offerTitle} sub={'Applied ' + new Date(i.at).toLocaleDateString([], { day: 'numeric', month: 'short' })} trail={<Status s={i.status} />} />) : <Empty icon={<Ic.Tag />} title="No applications yet" text="Find an offer in the feed and tap Apply." action={<Button tone="secondary" onClick={() => go('feed')}>Browse offers</Button>} />),
    offers: !S.myOfferIds ? <Spinner /> : myOffers.length ? myOffers.map((o, i) => { const F = o.fin; return <Row key={o.id} first={!i} onClick={() => go('offer/' + o.id)} lead={<Thumb p={prodOf(S, o.pid)} />} title={o.title} sub={<span className="flex items-center gap-3"><span>{TYPES[o.type]?.name} · {TYPES[o.type]?.reward(o.terms, F.cur)}</span>{F.budget ? <span className="hidden w-20 sm:inline-block"><Bar pct={F.spent / F.budget * 100} /></span> : null}</span>} trail={<Status s={F.budget && !F.funded ? 'unfunded' : o.status} />} />; })
      : <Empty icon={<Ic.Tag />} title="No listings yet" text="List a product and creators will see it in the feed." action={<Button onClick={() => go('plus')}>List a product</Button>} />,
    products: !S.myProductIds ? <Spinner /> : myProducts.length ? myProducts.map((p, i) => <Row key={p.id} first={!i} onClick={() => go('product/' + p.id)} lead={<Thumb p={p} />} title={p.name} sub={(CATS[p.category] || 'Other') + ' · ' + myOffers.filter(o => o.pid === p.id).length + ' listing(s)'} trail={<Ic.Chev width="18" height="18" className="text-ink-faint" />} />)
      : <Empty icon={<Ic.Box />} title="No products yet" text="Add a product, then create listings for it." action={<Button onClick={() => go('plus/product')}>Add a product</Button>} />,
    socials: u.socials.length ? u.socials.map((s, i) => <Row key={s.id} first={!i} lead={<span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-small font-bold text-white" style={{ background: SOC[s.platform] || '#26331F' }}>{(PLATFORMS.find(p => p[0] === s.platform)?.[1] || s.platform)[0]}</span>} title={'@' + s.handle} sub={(PLATFORMS.find(p => p[0] === s.platform)?.[1] || s.platform) + ' · ' + (s.followers || 0).toLocaleString() + ' followers'} onClick={() => !s.is_verified && setVer(s)} trail={s.is_verified ? <Status s="verified" /> : s.verify_requested_at ? <span className="rounded-full bg-cream-100 px-2.5 py-1 text-caption font-semibold text-ink-soft">Checking</span> : <span className="rounded-full bg-army px-3 py-1.5 text-caption font-semibold text-onarmy">Verify</span>} />)
      : <Empty icon={<Ic.At />} title="No accounts yet" text="Add the accounts you promote on. Offers check your followers here." action={<Button onClick={() => go('plus/social')}>Add a social</Button>} />,
  }[t];

  return (
    <Page crumb="Profile">
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
        <aside className="flex flex-col gap-6 lg:sticky lg:top-0 lg:self-start">
          <Card>
            <div className="flex items-center gap-4 lg:flex-col lg:items-start"><Avatar name={u.name} size={72} /><div className="min-w-0"><h1 className="flex items-center gap-2 font-serif text-[24px] leading-8">{u.name}{u.verified && <Verified />}</h1><div className="truncate text-small text-ink-soft">{u.email}</div></div></div>
            <div className="mt-5 flex flex-col gap-2.5 text-small text-ink-soft">
              {u.company && <div className="flex items-center gap-2.5"><Ic.Box width="16" height="16" />{u.company}</div>}
              {a.hasMarketer && <div className="flex items-center gap-2.5"><Ic.Me width="16" height="16" />{u.followers.toLocaleString()} followers</div>}
              {u.country && <div className="flex items-center gap-2.5"><Ic.Globe width="16" height="16" />{[u.city, u.country].filter(Boolean).join(', ')}</div>}
              <div className="flex items-center gap-2.5"><Ic.Shield width="16" height="16" />{u.verified ? 'Verified ' + (seller ? 'seller' : 'marketer') : 'Not verified yet'}</div>
            </div>
            <Button tone="secondary" size="sm" block className="mt-5" onClick={() => { setName(u.name); setEdit(true); }}>Edit profile</Button>
            {a.hasSeller && <Button tone="ghost" size="sm" block className="mt-2" onClick={() => go('plus/seller')}><Ic.Store width="16" height="16" />Edit seller account</Button>}
          </Card>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {a.hasSeller && a.hasMarketer && <Card className="lg:hidden"><div className="mb-2 text-caption font-semibold uppercase tracking-wider text-ink-faint">Working as</div><Segmented value={S.role} onChange={(v) => v !== S.role && a.setRole(v)} items={[['marketer', 'Marketer'], ['seller', 'Seller']]} /></Card>}
          {!hasRole ? (
            <Card><Empty icon={seller ? <Ic.Box /> : <Ic.Tag />} title={seller ? 'Sell with Gorilla Squad' : 'Promote offers and get paid'} text={seller ? 'Create a seller account to add products and post listings.' : 'Set up a marketer profile to apply to offers.'} action={<Button onClick={() => seller ? (afterSeller.set('plus/product'), go('plus/seller')) : a.openSetup('marketer')}>{seller ? 'Create seller account' : 'Create marketer account'}</Button>} /></Card>
          ) : (<>
            <StatGroup items={[[money(earned), seller ? 'Paid out' : 'Earned'], [deals.filter(d => d.status === 'active').length, 'Active deals'], seller ? [pend, 'To review'] : [sent.filter(i => i.status === 'pending').length, 'Pending']]} />
            <div><Tabs value={t} onChange={setTab} items={tabs} className="mb-3" /><Card pad={false} className="overflow-hidden">{list}</Card></div>
          </>)}
          {!seller && a.hasMarketer && <CreatorDetails key={(a.me?.marketer?.niches || []).join() + (a.me?.marketer?.city || "")} />}
          {a.isAdmin && <button onClick={() => go('admin')} className="flex items-center gap-3.5 rounded-card bg-army p-3 pr-4 text-left text-onarmy"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sage text-army"><Ic.Shield width="22" height="22" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">Admin</span><span className="block truncate text-small text-onarmy/65">Jobs, top-ups, payouts, account checks</span></span><Ic.Chev width="18" height="18" className="text-onarmy/50" /></button>}
          {(a.hasSeller || a.hasMarketer) && <button onClick={() => go('wallet')} className="flex items-center gap-3.5 rounded-card bg-paper p-3 pr-4 text-left"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sage-50 text-sage-700"><Ic.Wallet width="22" height="22" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">Wallet</span><span className="block truncate text-small text-ink-soft">{seller ? 'Top up and pay creators' : 'What you earn, and withdrawals'}</span></span><Ic.Chev width="18" height="18" className="text-ink-faint" /></button>}
          <Card title="Appearance" sub="Light, dark, or match your device."><ThemePicker /></Card>
          <div className="flex flex-wrap gap-3">
            {!(a.hasSeller && a.hasMarketer) && hasRole && <Button tone="secondary" onClick={() => seller ? a.openSetup('marketer') : go('plus/seller')}>{seller ? 'Also promote offers' : 'Create a seller account'}</Button>}
            <Button tone="ghost" onClick={a.signOut}><Ic.Out width="18" height="18" />Sign out</Button>
          </div>
        </div>
      </div>
      <Sheet open={edit} onClose={() => setEdit(false)} title="Edit profile" footer={<Button size="lg" block disabled={!name.trim()} onClick={async () => { if (await a.saveName(name.trim())) setEdit(false); }}>Save</Button>}>
        <Field label="Display name"><Input value={name} onChange={e => setName(e.target.value)} maxLength={60} /></Field>
      </Sheet>
      <VerifySheet s={ver} onClose={() => setVer(null)} />
    </Page>
  );
}
