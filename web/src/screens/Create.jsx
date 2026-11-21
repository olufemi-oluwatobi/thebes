import { useEffect } from 'react';
import { useStore, prodOf } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { kindOf } from '../lib/data.js';
import { Page, PageTitle, Ic, ProductArt, cx } from '../ui/index.jsx';
import NewProduct from './NewProduct.jsx';
import NewListing from './NewListing.jsx';
import NewSocial from './NewSocial.jsx';
import SellerAccount from './SellerAccount.jsx';
import { sellerReady, afterSeller } from '../ui/wizard.jsx';

// #plus → pick a product to list (or make one) · #plus/seller → seller account (comes first) · #plus/product → product wizard · #plus/listing or #plus/<productId> → listing wizard · #plus/social
export default function Create({ pid: arg }) {
  if (arg === 'seller') return <SellerAccount />;
  if (arg === 'product') return <NewProduct />;
  if (arg === 'social') return <NewSocial />;
  if (arg === 'listing' || arg === 'offer') return <NewListing />;
  if (arg) return <NewListing pid={arg} />;
  return <Start />;
}

function Start() {
  const { S, a } = useStore();
  useEffect(() => { if (S.auth === 'in' && a.hasSeller) a.loadSeller(); }, [S.auth, a.hasSeller]);
  const products = (S.myProductIds || []).map(id => prodOf(S, id)).filter(Boolean);
  const newProduct = () => { if (sellerReady(S, a)) return go('plus/product'); afterSeller.set('plus/product'); go('plus/seller'); };
  const offersOn = (id) => (S.myOfferIds || []).map(x => S.offers[x]).filter(o => o && o.pid === id).length;
  return (
    <Page crumb="Create">
      <PageTitle h="What do you want to list?" p="Start with the product. Then create a listing that tells creators what you want them to do." />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <button onClick={newProduct} className="group flex flex-col overflow-hidden rounded-3xl bg-army text-left text-white shadow-card transition hover:shadow-lift">
          <span className="grid aspect-[4/3] w-full place-items-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-sage text-army transition group-hover:scale-105"><Ic.Plus width="26" height="26" /></span></span>
          <span className="p-4"><span className="block font-semibold">New product</span><span className="text-small text-white/65">Add something to list</span></span>
        </button>
        {products.map(p => { const n = offersOn(p.id); return (
          <button key={p.id} onClick={() => go('plus/' + p.id)} className="group flex flex-col overflow-hidden rounded-3xl bg-white text-left shadow-card transition hover:shadow-lift">
            <ProductArt p={p} fit="70%" className="aspect-[4/3] w-full" />
            <span className="flex flex-1 flex-col p-4"><span className="line-clamp-1 font-semibold">{p.name}</span><span className="text-small text-ink-soft">{kindOf(p.kind)[1]}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-small font-semibold text-sage-700">{n ? n + ' listing' + (n > 1 ? 's' : '') + ' · add another' : 'Create a listing'}<Ic.Chev width="16" height="16" /></span></span>
          </button>); })}
      </div>
      {S.auth === 'in' && a.hasSeller && !S.myProductIds && <div className="mt-6 h-8 w-8 animate-spin rounded-full border-2 border-cream-200 border-t-army" />}
      <button onClick={() => go('plus/social')} className="mt-10 flex w-full items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-card transition hover:shadow-lift">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cream-100 text-army"><Ic.At /></span>
        <span className="flex-1"><span className="block font-semibold">Promoting instead?</span><span className="text-small text-ink-soft">Add your social accounts to qualify for listings</span></span><Ic.Chev className="text-ink-faint" />
      </button>
    </Page>
  );
}
