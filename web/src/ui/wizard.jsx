import { useStore } from '../lib/store.jsx';
import { Ic, cx } from './index.jsx';
import { kindOf, SYM } from '../lib/data.js';
import { go } from '../lib/router.js';

export function Stepper({ steps, st }) {
  return (<>
    <ol className="hidden h-14 items-center sm:flex">{steps.map((l, i) => { const n = i + 1, done = n < st, cur = n === st; return (
      <li key={l} className={cx('flex items-center gap-2.5 text-small font-semibold', i < steps.length - 1 && 'flex-1', cur || done ? 'text-ink' : 'text-ink-faint')}>
        <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full text-caption font-bold', cur ? 'bg-army text-onarmy' : done ? 'bg-sage text-army' : 'bg-cream-100 text-ink-faint')}>{done ? <Ic.Check width="14" height="14" /> : n}</span>{l}
        {i < steps.length - 1 && <span className={cx('mx-3 h-px flex-1', done ? 'bg-sage-700/40' : 'bg-cream-200')} />}
      </li>); })}</ol>
    <div className="flex h-12 items-center gap-3 sm:hidden"><span className="text-small font-semibold">{steps[st - 1]}</span><span className="text-caption text-ink-faint">Step {st} of {steps.length}</span><div className="ml-auto flex gap-1">{steps.map((_, i) => <span key={i} className={cx('h-1.5 w-5 rounded-full', i < st ? 'bg-army' : 'bg-cream-200')} />)}</div></div>
  </>);
}

/* Ask for sign-in, then a seller/marketer account, only when something is saved.
   Before the sign-in email, the draft is kept in this browser and restored when the person comes back.
   A seller account is its own full page (#plus/seller); details filled in before signing in are kept and
   turned into the account the first time something is saved. */
export function useGate() {
  const { S, a } = useStore();
  const keep = async (draft) => { try { const d = draft ? await draft() : null; if (d) localStorage.setItem('gs_draft', JSON.stringify({ hash: location.hash, ...d })); } catch {} };
  return (kind, then, draft) => {
    if (S.auth !== 'in') {
      keep(draft).then(() => localStorage.setItem('gs_next', location.hash));
      a.openSignin('Sign in to save this'); return false;
    }
    if (kind === 'seller' && !a.hasSeller) {
      const d = sellerDraft.get();
      if (d) { a.saveSeller(d).then((ok) => { if (ok) { sellerDraft.clear(); then?.(); } }); return false; }
      const here = location.hash; keep(draft).then(() => { afterSeller.set(here); go('plus/seller'); }); return false;
    }
    if (kind === 'marketer' && !a.hasMarketer) { a.openSetup('marketer', then); return false; }
    return true;
  };
}
const kept = (k, store = localStorage) => ({ get: () => { try { return JSON.parse(store.getItem(k) || 'null'); } catch { return null; } }, set: (v) => { try { store.setItem(k, JSON.stringify(v)); } catch {} }, clear: () => { try { store.removeItem(k); } catch {} } });
export const sellerDraft = kept('gs_seller');            // seller details filled in before signing in
export const afterSeller = kept('gs_after_seller', sessionStorage); // where to go once the seller account is done
/* does this person have (or have started) a seller account? */
export const sellerReady = (S, a) => S.auth === 'in' ? a.hasSeller || !!sellerDraft.get() : !!sellerDraft.get();
export function takeDraft() {
  try { const d = JSON.parse(localStorage.getItem('gs_draft') || 'null'); if (!d || d.hash !== location.hash) return null; localStorage.removeItem('gs_draft'); return d; } catch { return null; }
}
export const fileToData = (f) => new Promise((r) => { if (!f || f.size > 1.5e6) return r(null); const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(null); fr.readAsDataURL(f); });
export const dataToFile = async (d, name = 'image') => { const b = await (await fetch(d)).blob(); return new File([b], name, { type: b.type }); };

/* the facts a product kind carries (price, subscribers, platform …) as label/value rows */
export function factsOf(p) {
  const k = kindOf(p.kind), d = p.details || {};
  return k[5].filter(([key]) => d[key] !== undefined && d[key] !== '').map(([key, label, t]) => [label, t === 'money' ? (SYM[d.currency] || '$').trim() + Number(d[key]).toLocaleString(undefined, { maximumFractionDigits: 2 }) : t === 'number' ? Number(d[key]).toLocaleString() : d[key]]);
}
