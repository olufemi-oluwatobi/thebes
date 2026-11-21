import { useRoute, go } from './lib/router.js';
import { useStore } from './lib/store.jsx';
import { Ic, Toast, cx } from './ui/index.jsx';
import Feed from './screens/Feed.jsx';
import Offer from './screens/Offer.jsx';
import Chats from './screens/Chats.jsx';
import Create from './screens/Create.jsx';
import Profile from './screens/Profile.jsx';
import Product from './screens/Product.jsx';

const TABS = [['feed', 'Feed', Ic.Feed], ['plus', 'Create', Ic.Plus], ['chats', 'Chats', Ic.Chat], ['me', 'Profile', Ic.Me]];
const tabOf = (n) => ({ offer: 'feed', deal: 'chats', product: 'me' }[n] || n);

export default function App() {
  const r = useRoute();
  const { S } = useStore();
  const tab = tabOf(r.n);
  const pending = S.role === 'seller' ? S.interests.filter(i => i.status === 'pending').length : 0;
  let view;
  if (r.n === 'offer') view = <Offer id={r.a} />;
  else if (r.n === 'product') view = <Product id={r.a} />;
  else if (r.n === 'plus') view = <Create />;
  else if (r.n === 'chats') view = <Chats id={r.a} />;
  else if (r.n === 'deal') { go('chats-' + r.a); view = null; }
  else if (r.n === 'me') view = <Profile />;
  else view = <Feed />;
  const dark = r.n === 'feed' || !r.n;
  return (
    <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col md:flex-row md:p-4 md:pl-0">
      <nav className={cx('order-2 flex h-[68px] shrink-0 items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] md:order-1 md:h-auto md:w-[88px] md:flex-col md:justify-start md:gap-3 md:bg-transparent md:px-0 md:pt-4', dark ? 'bg-army-900 text-white/60 md:text-ink-soft' : 'bg-white text-ink-soft')} aria-label="Main">
        {TABS.map(([k, l, I]) => {
          const on = tab === k, badge = k === 'me' && pending;
          return (
            <button key={k} onClick={() => go(k)} className={cx('relative flex h-14 w-16 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition md:h-14 md:w-14', k === 'plus' ? (on ? 'bg-sage text-army' : 'bg-sage/80 text-army') : on ? (dark ? 'text-white md:bg-white md:text-army md:shadow-card' : 'text-army md:bg-white md:shadow-card') : 'hover:text-army')} aria-current={on ? 'page' : undefined}>
              <I width="24" height="24" />
              <span className="md:hidden">{l}</span>
              {badge ? <span className="absolute right-2 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-ember px-1 text-[10px] font-bold text-white">{badge}</span> : null}
            </button>
          );
        })}
      </nav>
      <main className="relative order-1 min-h-0 flex-1 overflow-hidden bg-cream-50 md:order-2 md:rounded-[28px] md:shadow-pop">{view}</main>
      <Toast t={S.toast} />
    </div>
  );
}
