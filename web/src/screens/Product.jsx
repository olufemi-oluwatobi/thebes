import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go, back } from '../lib/router.js';
import { CATS, TYPES, prodOf } from '../lib/data.js';
import { Page, Card, Button, Status, Chip, Sheet, Avatar, Verified, Ic, Empty } from '../ui/index.jsx';
import { Gallery, Steps, Player } from '../ui/parts.jsx';

export default function Product({ id }) {
  const { S, a } = useStore();
  const [demo, setDemo] = useState(false);
  const p = prodOf(S, id); if (!p) { go('me'); return null; }
  const offers = S.offers.filter(o => o.pid === p.id), own = p.owner === 'u-kofi' || p.mine;
  const co = (S.offers.find(o => o.owner === p.owner) || {}).co || "Kofi's Hot Sauce";
  const visit = () => { try { window.open(p.url, '_blank', 'noopener'); } catch {} a.toast('Opening ' + p.url.replace('https://', '')); };
  const post = <Button size="lg" block onClick={() => go('plus-' + p.id)}><Ic.Plus width="18" height="18" />Post an offer for this</Button>;
  return (
    <Page crumb={own ? 'Profile' : 'Back'} onBack={() => back('me')} bar={own ? post : p.url && <Button tone="secondary" size="lg" block onClick={visit}><Ic.Visit width="18" height="18" />Visit website</Button>}>
      <div className="mb-8"><div className="mb-3"><Chip>{CATS[p.category]}</Chip></div><h1 className="font-serif text-[26px] leading-[34px] sm:text-title">{p.name}</h1><p className="mt-2 max-w-2xl text-body text-ink-soft">{p.desc}</p></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <Gallery p={p} onDemo={() => setDemo(true)} />
          <Steps title="What marketers see" sub="Everything here shows on the feed card and offer page." steps={[['Cover image', 'The first image is the feed card.'], ['Gallery and demo', 'Extra images and a video show it working.'], ['Creator videos', 'Marketers add reviews once a deal is live.']]} />
        </div>
        <aside className="flex flex-col gap-6 lg:sticky lg:top-0 lg:self-start">
          <Card>
            <div className="flex items-center gap-3"><Avatar name={co} size={48} /><div className="min-w-0"><div className="flex items-center gap-1.5 font-semibold">{co}<Verified /></div><div className="truncate text-small text-ink-soft">{p.url ? p.url.replace('https://', '') : 'No website yet'}</div></div></div>
            {p.url && <Button tone="secondary" block className="mt-5 hidden lg:flex" onClick={visit}><Ic.Visit width="18" height="18" />Visit website</Button>}
          </Card>
          <Card title="Offers" sub={offers.length ? offers.length + ' running on this product' : undefined}>
            {offers.length ? <div className="-mx-3 flex flex-col">{offers.map(o => <button key={o.id} onClick={() => go('offer-' + o.id)} className="flex min-h-[64px] items-center gap-3 rounded-2xl px-3 text-left transition hover:bg-cream-50"><div className="min-w-0 flex-1"><div className="truncate font-semibold">{o.title}</div><div className="mt-0.5 flex items-center gap-2 text-small text-ink-soft">{TYPES[o.type].name}<Status s={o.status} /></div></div><span className="font-serif text-heading">{TYPES[o.type].reward(o.terms)}</span></button>)}</div>
              : <Empty icon={<Ic.Tag />} title="No offers yet" text="Post an offer so marketers can promote this." />}
          </Card>
          {own && <div className="hidden lg:block">{post}</div>}
        </aside>
      </div>
      <Sheet open={demo} onClose={() => setDemo(false)} title={p.name + ' demo'}><Player p={p} sub={(p.video || '0:30') + ' · product demo'} /></Sheet>
    </Page>
  );
}
