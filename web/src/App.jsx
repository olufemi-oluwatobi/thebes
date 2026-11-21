import { useEffect } from 'react';
import { useRoute, go } from './lib/router.js';
import { useStore } from './lib/store.jsx';
import { Ic, Toast, Logo, LogoMark, Avatar, Segmented, Button, cx } from './ui/index.jsx';
import { SignInSheet, SetupSheet, ApplySheet } from './ui/sheets.jsx';
import Feed from './screens/Feed.jsx';
import Offer from './screens/Offer.jsx';
import Chats from './screens/Chats.jsx';
import Create from './screens/Create.jsx';
import Profile from './screens/Profile.jsx';
import Product from './screens/Product.jsx';

const TABS = [['feed', 'Feed', Ic.Feed], ['plus', 'Create', Ic.Plus], ['chats', 'Chats', Ic.Chat], ['me', 'Profile', Ic.Me]];
const tabOf = (n) => ({ offer: 'feed', deal: 'chats', product: 'me', signin: 'feed', '': 'feed' }[n] ?? n);

export default function App() {
  const r = useRoute();
  const { S, a } = useStore();
  useEffect(() => { if (r.n === 'signin') { if (S.auth === 'out') a.openSignin(); else if (S.auth === 'in') go('feed'); } if (r.n === 'sell') go('plus'); if (r.n === 'board') go('feed'); }, [r.n, S.auth]);
  useEffect(() => { if (S.auth === 'in' && !S.deals) a.loadDeals(); }, [S.auth, S.role, !!S.deals]);
  if (S.auth === 'loading') return <div className="grid h-full place-items-center"><span className="animate-pulse"><LogoMark size={48} /></span></div>;
  const tab = tabOf(r.n);
  const counts = { me: S.role === 'seller' ? S.me?.counts?.pending_interests || 0 : 0, chats: (S.deals || []).reduce((n, d) => n + (d.unread ? 1 : 0), 0) };
  let view;
  if (r.n === 'offer') view = <Offer key={r.a} id={r.a} />;
  else if (r.n === 'product') view = <Product key={r.a} id={r.a} />;
  else if (r.n === 'plus') view = <Create key={r.a} pid={r.a} />;
  else if (r.n === 'chats') view = <Chats id={r.a} />;
  else if (r.n === 'me') view = <Profile />;
  else view = <Feed />;
  const dark = tab === 'feed' && r.n !== 'offer';
  const u = a.me, both = a.hasSeller && a.hasMarketer;
  return (
    <div className="flex h-full w-full flex-col lg:flex-row">
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-cream-200 bg-white px-4 pb-4 pt-5 lg:flex">
        <a href="#feed" className="mb-8 px-2"><Logo /></a>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {TABS.map(([k, l, I]) => { const on = tab === k, n = counts[k]; return (
            <button key={k} onClick={() => go(k)} aria-current={on ? 'page' : undefined} className={cx('flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition', on ? 'bg-sage-50 text-army' : 'text-ink-soft hover:bg-cream-50 hover:text-ink')}>
              <I width="20" height="20" />{l}<span className="flex-1" />{n ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1.5 text-[11px] font-bold text-white">{n}</span> : null}
            </button>); })}
        </nav>
        <div className="flex-1" />
        {u ? (
          <div className="rounded-2xl bg-cream-50 p-3">
            <button onClick={() => go('me')} className="flex w-full items-center gap-3 text-left"><Avatar name={u.name} size={36} /><div className="min-w-0"><div className="truncate text-small font-semibold">{u.name}</div><div className="truncate text-caption text-ink-soft">{u.email}</div></div></button>
            {both ? <><div className="mt-3 text-caption font-semibold uppercase tracking-wider text-ink-faint">Working as</div>
              <div className="mt-1.5 [&>div]:h-9 [&_button]:text-caption"><Segmented value={S.role} onChange={(v) => v !== S.role && a.setRole(v)} items={[['marketer', 'Marketer'], ['seller', 'Seller']]} /></div></>
              : <button onClick={() => a.openSetup(a.hasSeller ? 'marketer' : 'seller')} className="mt-3 text-caption font-semibold text-sage-700 hover:underline">{a.hasSeller ? 'Also promote offers' : a.hasMarketer ? 'Also sell products' : 'Set up your profile'}</button>}
          </div>
        ) : (
          <div className="rounded-2xl bg-cream-50 p-4"><div className="text-small font-semibold">Join Gorilla Squad</div><p className="mt-1 text-caption text-ink-soft">Post offers or promote them and get paid.</p><Button size="sm" block className="mt-3" onClick={() => a.openSignin()}>Sign in</Button></div>
        )}
      </aside>
      <main className="relative order-1 min-h-0 flex-1 overflow-hidden bg-cream-50 lg:order-2">{view}</main>
      <nav aria-label="Main" className={cx('order-2 grid h-[64px] shrink-0 grid-cols-4 border-t pb-[env(safe-area-inset-bottom)] lg:hidden', dark ? 'border-white/10 bg-army-900' : 'border-cream-200 bg-white')}>
        {TABS.map(([k, l, I]) => { const on = tab === k, n = counts[k]; return (
          <button key={k} onClick={() => go(k)} aria-current={on ? 'page' : undefined} className={cx('relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition', on ? (dark ? 'text-white' : 'text-army') : (dark ? 'text-white/50' : 'text-ink-faint'))}>
            <span className={cx('grid h-7 w-12 place-items-center rounded-full transition', on && (dark ? 'bg-white/15' : 'bg-sage-100'))}><I width="20" height="20" /></span>{l}
            {n ? <span className="absolute left-1/2 top-1.5 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-ember px-1 text-[10px] font-bold text-white">{n}</span> : null}
          </button>); })}
      </nav>
      <SignInSheet /><SetupSheet /><ApplySheet />
      <Toast t={S.toast} />
    </div>
  );
}
