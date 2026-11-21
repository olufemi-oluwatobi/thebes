import { useEffect, useState } from 'react';
import { useStore, prodOf } from '../lib/store.jsx';
import { go, back } from '../lib/router.js';
import { TYPES, kindOf } from '../lib/data.js';
import { factsOf } from '../ui/wizard.jsx';
import { Page, Card, Rows, Button, Status, Chip, Sheet, Avatar, Verified, Ic, Empty } from '../ui/index.jsx';
import { Gallery, Steps, Player } from '../ui/parts.jsx';

export default function Product({ id }) {
  const { S, a } = useStore();
  const [demo, setDemo] = useState(false);
  useEffect(() => { a.loadProduct(id); }, [id, S.auth]);
  const p = prodOf(S, id);
  if (!p || (!p.full && !p.missing)) return <Page crumb="Back" onBack={() => back('me')}><div className="grid h-64 place-items-center"><span className="h-8 w-8 animate-spin rounded-full border-2 border-cream-200 border-t-army" /></div></Page>;
  if (p.missing) return <Page crumb="Back" onBack={() => back('me')}><Empty icon={<Ic.Box />} title="This product isn't available" text="It may have been removed." /></Page>;
  const offers = (S.prodOffers?.[id] || []).map(x => S.offers[x]).filter(Boolean), own = p.owner;
  const co = p.company?.name || p.name;
  const visit = () => window.open(p.url, '_blank', 'noopener');
  const post = <Button size="lg" block onClick={() => go('plus/' + p.id)}><Ic.Plus width="18" height="18" />Create a listing</Button>;
  return (
    <Page crumb={own ? 'Profile' : 'Back'} onBack={() => back('me')} bar={own ? post : p.url && <Button tone="secondary" size="lg" block onClick={visit}><Ic.Visit width="18" height="18" />Visit website</Button>}>
      <div className="mb-8"><div className="mb-3"><Chip>{kindOf(p.kind)[1]}</Chip></div><h1 className="font-serif text-[26px] leading-[34px] sm:text-title">{p.name}</h1>{p.desc && <p className="mt-2 max-w-2xl whitespace-pre-line text-body text-ink-soft">{p.desc}</p>}</div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <Gallery p={p} onDemo={() => setDemo(true)} />
          {own && <Steps title="What marketers see" sub="Everything here shows on the feed card and offer page." steps={[['Cover image', 'The first image is the feed card.'], ['Gallery and demo', 'Extra images and a video show it working.'], ['Creator videos', 'Marketers add reviews once a deal is live.']]} />}
        </div>
        <aside className="flex flex-col gap-6 lg:sticky lg:top-0 lg:self-start">
          <Card>
            <div className="flex items-center gap-3"><Avatar name={co} size={48} /><div className="min-w-0"><div className="flex items-center gap-1.5 font-semibold">{co}{p.company?.is_verified && <Verified />}</div><div className="truncate text-small text-ink-soft">{p.url ? p.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'No website yet'}</div></div></div>
            {p.url && <Button tone="secondary" block className="mt-5 hidden lg:flex" onClick={visit}><Ic.Visit width="18" height="18" />Visit website</Button>}
          </Card>
          {factsOf(p).length > 0 && <Card title="Quick facts"><Rows rows={factsOf(p)} /></Card>}
          <Card title="Listings" sub={offers.length ? offers.length + ' on this product' : undefined}>
            {offers.length ? <div className="-mx-3 flex flex-col">{offers.map(o => <button key={o.id} onClick={() => go('offer/' + o.id)} className="flex min-h-[64px] items-center gap-3 rounded-2xl px-3 text-left transition hover:bg-cream-50"><div className="min-w-0 flex-1"><div className="truncate font-semibold">{o.title}</div><div className="mt-0.5 flex items-center gap-2 text-small text-ink-soft">{TYPES[o.type]?.name}<Status s={o.status} /></div></div><span className="font-serif text-heading">{TYPES[o.type]?.reward(o.terms, o.fin.cur)}</span></button>)}</div>
              : <Empty icon={<Ic.Tag />} title="No listings yet" text={own ? 'Create a listing so creators can promote this.' : 'Nothing open right now.'} />}
          </Card>
          {own && <div className="hidden lg:block">{post}</div>}
        </aside>
      </div>
      <Sheet open={demo} onClose={() => setDemo(false)} title={p.name + ' demo'}><Player src={p.videoUrl} /></Sheet>
    </Page>
  );
}
