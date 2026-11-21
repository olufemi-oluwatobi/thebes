import { useEffect } from 'react';
import { ART } from '../lib/art.js';
import { bgFor, initials } from '../lib/data.js';
import * as Ic from './icons.jsx';
export { Ic };
export const cx = (...a) => a.filter(Boolean).join(' ');

/* ---- Button: height is fixed by size, never by content ---- */
const B = {
  base: 'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none select-none',
  size: { md: 'h-12 px-5 text-[15px]', sm: 'h-10 px-4 text-sm', lg: 'h-14 px-6 text-base' },
  tone: {
    primary: 'bg-army text-white hover:bg-army-600',
    sage: 'bg-sage text-army hover:bg-sage-200',
    soft: 'bg-cream-100 text-army hover:bg-cream-200',
    ghost: 'text-army hover:bg-cream-100',
    danger: 'bg-[#FBE6DF] text-[#8A2E12] hover:bg-[#f6d6cb]',
    dark: 'bg-white/15 text-white hover:bg-white/25 backdrop-blur',
  },
};
export const Button = ({ tone = 'primary', size = 'md', block, className, ...p }) => (
  <button className={cx(B.base, B.size[size], B.tone[tone], block && 'w-full', className)} {...p} />
);
/* Round icon button: always a perfect circle (h = w) */
export const IconButton = ({ tone = 'soft', size = 'md', className, label, children, ...p }) => (
  <button aria-label={label} className={cx(B.base, '!rounded-full !px-0', { sm: 'h-10 w-10', md: 'h-12 w-12', lg: 'h-14 w-14' }[size], B.tone[tone], className)} {...p}>{children}</button>
);

/* ---- Inputs: h-12 single-line, rounded-xl, ring on focus ---- */
const field = 'w-full rounded-xl bg-cream-50 text-[16px] text-army placeholder:text-ink-soft/60 outline-none ring-1 ring-inset ring-cream-200 transition focus:bg-white focus:ring-2 focus:ring-army';
export const Input = ({ pre, suf, className, wrap, ...p }) => (
  <div className={cx('relative flex h-12 items-center', wrap)}>
    {pre && <span className="pointer-events-none absolute left-4 text-[15px] font-semibold text-ink-soft">{pre}</span>}
    <input className={cx(field, 'h-12', pre ? 'pl-9' : 'px-4', suf ? 'pr-14' : 'pr-4', className)} {...p} />
    {suf && <span className="pointer-events-none absolute right-4 text-sm font-semibold text-ink-soft">{suf}</span>}
  </div>
);
export const Textarea = ({ className, ...p }) => <textarea className={cx(field, 'min-h-[112px] resize-y px-4 py-3 leading-6', className)} {...p} />;
export const Field = ({ label, help, children }) => (
  <label className="flex flex-col gap-2">
    <span className="text-[13px] font-semibold text-army">{label}</span>
    {children}
    {help && <span className="text-xs leading-4 text-ink-soft">{help}</span>}
  </label>
);

/* ---- Surfaces: borderless cards on a tinted page ---- */
export const Card = ({ title, sub, action, children, className, pad = true }) => (
  <section className={cx('rounded-3xl bg-white shadow-card', pad && 'p-5 md:p-6', className)}>
    {(title || action) && (
      <header className="mb-4 flex items-start justify-between gap-3">
        <div><h3 className="font-serif text-[17px] leading-6 text-army">{title}</h3>{sub && <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">{sub}</p>}</div>
        {action}
      </header>
    )}
    {children}
  </section>
);
export const Rows = ({ rows }) => (
  <dl className="divide-y divide-cream-100">
    {rows.map(([k, v]) => (
      <div key={k} className="flex min-h-[44px] items-center justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0"><dt className="text-ink-soft">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
    ))}
  </dl>
);
export const Stat = ({ v, l }) => (
  <div className="rounded-2xl bg-white p-4 shadow-card"><div className="text-2xl font-bold leading-7">{v}</div><div className="mt-1 text-xs text-ink-soft">{l}</div></div>
);
export const Chip = ({ children, tone = 'soft', className }) => (
  <span className={cx('inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold', { soft: 'bg-cream-100 text-army', sage: 'bg-sage text-army', dark: 'bg-white/15 text-white', glass: 'bg-black/30 text-white backdrop-blur' }[tone], className)}>{children}</span>
);
const TAGS = { open: 'sage', active: 'sage', verified: 'sage', accepted: 'sage', funded: 'sage', pending: 'amber', unfunded: 'amber', paused: 'blue', denied: 'red', rejected: 'red', ended: 'dark', withdrawn: 'dark' };
export const Tag = ({ s }) => (
  <span className={cx('inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold capitalize', { sage: 'bg-sage-100 text-[#2f5a14]', amber: 'bg-[#FBE9CF] text-[#8a5a10]', blue: 'bg-[#DDE9F2] text-[#25506d]', red: 'bg-[#F6D9CF] text-[#9b3a1c]', dark: 'bg-cream-200 text-ink-soft' }[TAGS[s] || 'dark'])}>{s}</span>
);
export const Avatar = ({ name, size = 40, tone = 'sage' }) => (
  <span style={{ width: size, height: size, fontSize: size * 0.36 }} className={cx('inline-grid shrink-0 place-items-center rounded-full font-bold', tone === 'sage' ? 'bg-sage text-army' : 'bg-army text-white')}>{initials(name)}</span>
);
export const Switch = ({ on, onChange, label, sub }) => (
  <div className="flex items-center justify-between gap-4">
    <div><div className="text-sm font-semibold">{label}</div>{sub && <div className="text-xs leading-4 text-ink-soft">{sub}</div>}</div>
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cx('relative h-8 w-14 shrink-0 rounded-full transition', on ? 'bg-army' : 'bg-cream-200')}>
      <span className={cx('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-7' : 'left-1')} />
    </button>
  </div>
);
export const Segmented = ({ value, onChange, items }) => (
  <div className="flex h-12 gap-1 rounded-xl bg-cream-100 p-1">
    {items.map(([k, l]) => <button key={k} type="button" onClick={() => onChange(k)} className={cx('flex-1 rounded-lg text-sm font-semibold capitalize transition', value === k ? 'bg-white text-army shadow-sm' : 'text-ink-soft')}>{l}</button>)}
  </div>
);
export const Pills = ({ value, onChange, items, multi }) => (
  <div className="flex flex-wrap gap-2">
    {items.map(([k, l]) => { const on = multi ? value.includes(k) : value === k; return <button key={k} type="button" onClick={() => onChange(k)} className={cx('h-10 rounded-full px-4 text-sm font-semibold transition', on ? 'bg-army text-white' : 'bg-cream-100 text-army hover:bg-cream-200')}>{l}</button>; })}
  </div>
);
/* borderless tabs: text with a soft pill behind the active one */
export const Tabs = ({ value, onChange, items, className }) => (
  <div className={cx('no-scrollbar flex gap-1 overflow-x-auto', className)}>
    {items.map(([k, l, n]) => (
      <button key={k} type="button" onClick={() => onChange(k)} className={cx('inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition', value === k ? 'bg-sage-100 text-army' : 'text-ink-soft hover:text-army')}>
        {l}{n ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1.5 text-[10px] font-bold text-white">{n}</span> : null}
      </button>
    ))}
  </div>
);
export const Art = ({ k, className }) => <div className={className} dangerouslySetInnerHTML={{ __html: ART[k] }} />;
export const ProductArt = ({ p, className, k }) => (
  <div className={cx('grid place-items-center overflow-hidden', className)} style={{ background: bgFor(p) }}>
    {p.img ? <img src={p.img} alt="" className="h-full w-full object-cover" /> : <Art k={k || p.art} className="h-[78%] w-[78%] [&>svg]:h-full [&>svg]:w-full" />}
  </div>
);
export function Sheet({ open, onClose, title, sub, children }) {
  useEffect(() => { if (!open) return; const f = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button aria-label="Close" className="absolute inset-0 bg-army-900/60" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-pop md:max-w-md md:rounded-3xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-cream-200 md:hidden" />
        <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="font-serif text-xl text-army">{title}</h2>{sub && <p className="mt-1 text-sm text-ink-soft">{sub}</p>}</div><IconButton size="sm" label="Close" onClick={onClose}><Ic.X width="18" height="18" /></IconButton></div>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}
export const Toast = ({ t }) => (
  <div className={cx('pointer-events-none fixed left-1/2 top-4 z-[60] w-max max-w-[88vw] -translate-x-1/2 rounded-full bg-army px-5 py-3 text-center text-sm font-semibold text-white shadow-pop transition-all', t ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0')}>{t?.m}</div>
);
/* page chrome */
export const Page = ({ title, crumb, onBack, right, children, wide }) => (
  <div className="flex h-full min-h-0 flex-col bg-cream-50">
    <header className="flex h-16 shrink-0 items-center gap-3 bg-white/80 px-4 backdrop-blur md:px-8">
      {onBack && <IconButton size="sm" label="Back" onClick={onBack}><Ic.Back width="20" height="20" /></IconButton>}
      <div className="min-w-0 flex-1"><div className="text-xs font-semibold text-ink-soft">{crumb}</div><div className="truncate font-serif text-[17px] leading-5 text-army">{title}</div></div>
      {right}
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto"><div className={cx('mx-auto w-full px-4 pb-32 pt-6 md:px-8 md:pt-8', wide ? 'max-w-6xl' : 'max-w-3xl')}>{children}</div></div>
  </div>
);
export const Heading = ({ h, p, right }) => (
  <div className="mb-6 flex items-end justify-between gap-4"><div><h1 className="font-serif text-[28px] leading-9 text-army md:text-[32px]">{h}</h1>{p && <p className="mt-1.5 max-w-xl text-[15px] leading-6 text-ink-soft">{p}</p>}</div>{right}</div>
);
