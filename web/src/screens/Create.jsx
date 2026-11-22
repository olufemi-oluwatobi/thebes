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
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <button onClick={newProduct} className="group flex items-center gap-3.5 rounded-card bg-army p-3 pr-4 text-left text-white">
          <span className="grid h-12 w-16 shrink-0 place-items-center rounded-xl bg-sage text-army transition group-hover:scale-105"><Ic.Plus width="22" height="22" /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">New product</span><span className="block truncate text-small text-white/65">Add something to list</span></span>
          <Ic.Chev width="18" height="18" className="text-white/50" />
        </button>
        {products.map(p => { const n = offersOn(p.id); return (
          <button key={p.id} onClick={() => go('plus/' + p.id)} className="group flex items-center gap-3.5 rounded-card bg-white p-3 pr-4 text-left">
            <ProductArt p={p} fit="76%" className="h-12 w-16 shrink-0 rounded-xl" />
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{p.name}</span>
              <span className="block truncate text-small text-sage-700">{n ? n + ' listing' + (n > 1 ? 's' : '') + ' · add another' : 'Create a listing'}</span></span>
            <Ic.Chev width="18" height="18" className="text-ink-faint transition group-hover:translate-x-0.5" />
          </button>); })}
      </div>
      {S.auth === 'in' && a.hasSeller && !S.myProductIds && <div className="mt-6 h-8 w-8 animate-spin rounded-full border-2 border-cream-200 border-t-army" />}
      <button onClick={() => go('plus/social')} className="mt-6 flex w-full items-center gap-3.5 rounded-card bg-white p-3 pr-4 text-left sm:max-w-md">
        <span className="grid h-12 w-16 shrink-0 place-items-center rounded-xl bg-cream-100 text-army"><Ic.At width="22" height="22" /></span>
        <span className="min-w-0 flex-1"><span className="block font-semibold">Promoting instead?</span><span className="block truncate text-small text-ink-soft">Add your socials to qualify for listings</span></span><Ic.Chev width="18" height="18" className="text-ink-faint" />
      </button>
    </Page>
  );
}
