import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go, back } from '../lib/router.js';
import { CATS, TYPES, prodOf } from '../lib/data.js';
import { Page, Card, Button, Tag, Chip, Sheet } from '../ui/index.jsx';
import { Gallery, Steps, ActionBar, Player } from '../ui/parts.jsx';

export default function Product({ id }) {
  const { S } = useStore();
  const [demo, setDemo] = useState(false);
  const p = prodOf(S, id); if (!p) { go('me'); return null; }
  const offers = S.offers.filter(o => o.pid === p.id), own = p.owner === 'u-kofi' || p.mine;
  return (
    <Page title={p.name} crumb="Product" onBack={() => back('me')} wide>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <Gallery p={p} onDemo={() => setDemo(true)} />
          <div><h1 className="font-serif text-[28px] leading-9 text-army md:text-[32px]">{p.name}</h1><div className="mt-2 text-sm text-ink-soft">{CATS[p.category]}{p.url ? ' · ' + p.url.replace('https://', '') : ''}</div></div>
          <Card title="About"><p className="text-[15px] leading-7">{p.desc || 'No description yet.'}</p></Card>
          <Steps title="How it works" sub="What marketers see before they apply." steps={[['Placement image', 'The cover appears on the feed card and the offer page.'], ['Gallery and demo', 'Extra images and a demo video show what it really does.'], ['Creator videos', 'Marketers can upload review videos once a deal is active.']]} />
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
          <Card title="Offers on this product" sub={offers.length ? offers.length + ' running' : 'None yet'}>
            <div className="-mx-2 flex flex-col">{offers.map(o => <button key={o.id} onClick={() => go('offer-' + o.id)} className="flex min-h-[64px] items-center gap-3 rounded-2xl px-2 text-left hover:bg-cream-50"><div className="min-w-0 flex-1"><div className="truncate font-semibold">{o.title}</div><div className="text-xs text-ink-soft">{TYPES[o.type].name} · {TYPES[o.type].reward(o.terms)}</div></div><Tag s={o.status} /></button>)}</div>
          </Card>
          {own && <Button block className="hidden lg:flex" onClick={() => go('plus-' + p.id)}>Post an offer for this</Button>}
        </aside>
      </div>
      {own && <ActionBar><Button block onClick={() => go('plus-' + p.id)}>Post an offer for this</Button></ActionBar>}
      <Sheet open={demo} onClose={() => setDemo(false)} title={p.name + ' demo'}><Player p={p} sub={(p.video || '0:30') + ' · product demo'} /></Sheet>
    </Page>
  );
}
