import { useRoute, go } from './lib/router.js';
import { useStore } from './lib/store.jsx';
import { Ic, Toast, Logo, Avatar, Segmented, cx } from './ui/index.jsx';
import Feed from './screens/Feed.jsx';
import Offer from './screens/Offer.jsx';
import Chats from './screens/Chats.jsx';
import Create from './screens/Create.jsx';
import Profile from './screens/Profile.jsx';
import Product from './screens/Product.jsx';

const TABS = [['feed', 'Feed', Ic.Feed], ['plus', 'Create', Ic.Plus], ['chats', 'Chats', Ic.Chat], ['me', 'Profile', Ic.Me]];
const tabOf = (n) => ({ offer: 'feed', deal: 'chats', product: 'me', '': 'feed' }[n] ?? n);

export default function App() {
  const r = useRoute();
  const { S, a } = useStore();
  const tab = tabOf(r.n);
  const counts = { me: S.role === 'seller' ? S.interests.filter(i => i.status === 'pending').length : 0, chats: a.myDeals().filter(d => S.role === 'seller' && d.dels.some(x => x.status === 'pending')).length };
  let view;
  if (r.n === 'offer') view = <Offer key={r.a} id={r.a} />;
  else if (r.n === 'product') view = <Product key={r.a} id={r.a} />;
  else if (r.n === 'plus') view = <Create key={r.a} />;
  else if (r.n === 'chats') view = <Chats id={r.a} />;
  else if (r.n === 'deal') { go('chats-' + r.a); view = null; }
  else if (r.n === 'me') view = <Profile />;
  else view = <Feed />;
  const dark = tab === 'feed' && r.n !== 'offer';
  const u = a.me;
  return (
    <div className="flex h-full w-full flex-col lg:flex-row">
      {/* desktop sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-cream-200 bg-white px-4 pb-4 pt-5 lg:flex">
        <a href="#feed" className="mb-8 px-2"><Logo /></a>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {TABS.map(([k, l, I]) => { const on = tab === k, n = counts[k]; return (
            <button key={k} onClick={() => go(k)} aria-current={on ? 'page' : undefined} className={cx('flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition', on ? 'bg-sage-50 text-army' : 'text-ink-soft hover:bg-cream-50 hover:text-ink')}>
              <I width="20" height="20" className={on ? 'text-army' : ''} />{l}<span className="flex-1" />{n ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1.5 text-[11px] font-bold text-white">{n}</span> : null}
            </button>); })}
        </nav>
        <div className="flex-1" />
        <div className="rounded-2xl bg-cream-50 p-3">
          <button onClick={() => go('me')} className="flex w-full items-center gap-3 text-left"><Avatar name={u.name} size={36} /><div className="min-w-0"><div className="truncate text-small font-semibold">{u.name}</div><div className="truncate text-caption text-ink-soft">@{u.handle}</div></div></button>
          <div className="mt-3 text-caption font-semibold uppercase tracking-wider text-ink-faint">Demo view</div>
          <div className="mt-1.5 [&>div]:h-9 [&_button]:text-caption"><Segmented value={S.role} onChange={(v) => v !== S.role && a.setRole()} items={[['marketer', 'Marketer'], ['seller', 'Seller']]} /></div>
        </div>
      </aside>
      <main className="relative order-1 min-h-0 flex-1 overflow-hidden bg-cream-50 lg:order-2">{view}</main>
      {/* mobile bottom nav */}
      <nav aria-label="Main" className={cx('order-2 grid h-[64px] shrink-0 grid-cols-4 border-t pb-[env(safe-area-inset-bottom)] lg:hidden', dark ? 'border-white/10 bg-army-900' : 'border-cream-200 bg-white')}>
        {TABS.map(([k, l, I]) => { const on = tab === k, n = counts[k]; return (
          <button key={k} onClick={() => go(k)} aria-current={on ? 'page' : undefined} className={cx('relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition', on ? (dark ? 'text-white' : 'text-army') : (dark ? 'text-white/50' : 'text-ink-faint'))}>
            <span className={cx('grid h-7 w-12 place-items-center rounded-full transition', on && (dark ? 'bg-white/15' : 'bg-sage-100'))}><I width="20" height="20" /></span>{l}
            {n ? <span className="absolute left-1/2 top-1.5 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-ember px-1 text-[10px] font-bold text-white">{n}</span> : null}
          </button>); })}
      </nav>
      <Toast t={S.toast} />
    </div>
  );
}
