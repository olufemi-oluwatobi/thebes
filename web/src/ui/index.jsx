import { useEffect } from 'react';
import { ART } from '../lib/art.js';
import { bgFor, initials, artFor } from '../lib/data.js';
import * as Ic from './icons.jsx';
export { Ic };
export const cx = (...a) => a.filter(Boolean).join(' ');

/* ---------- brand ---------- */
export const LogoMark = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
    <rect width="40" height="40" rx="11" fill="#26331F" />
    <path d="M27.5 15.5A9 9 0 1 0 29 21h-8" fill="none" stroke="#CBD6A8" strokeWidth="4" strokeLinecap="round" />
    <circle cx="29" cy="11" r="2.4" fill="#E0B06A" />
  </svg>
);
export const Logo = ({ light }) => (
  <div className="flex items-center gap-2.5"><LogoMark /><span className={cx('font-serif text-[18px] font-bold leading-none tracking-tight', light ? 'text-white' : 'text-army')}>Gorilla Squad</span></div>
);

/* ---------- buttons: height fixed by size ---------- */
const B = {
  base: 'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition duration-150 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 select-none',
  size: { sm: 'h-9 px-3.5 text-small', md: 'h-11 px-5 text-[15px]', lg: 'h-12 px-6 text-[15px]' },
  tone: {
    primary: 'bg-army text-white shadow-sm hover:bg-army-600',
    sage: 'bg-sage text-army hover:bg-sage-200',
    secondary: 'bg-white text-army ring-1 ring-inset ring-cream-300 hover:bg-cream-50',
    soft: 'bg-cream-100 text-army hover:bg-cream-200',
    ghost: 'text-army hover:bg-cream-100',
    danger: 'bg-white text-[#A23B17] ring-1 ring-inset ring-[#EBC2B3] hover:bg-[#FCF1EC]',
  },
};
export const Button = ({ tone = 'primary', size = 'md', block, className, ...p }) => <button className={cx(B.base, B.size[size], B.tone[tone], block && 'w-full', className)} {...p} />;
export const IconButton = ({ tone = 'ghost', size = 'md', className, label, children, ...p }) => (
  <button aria-label={label} title={label} className={cx(B.base, '!rounded-full !px-0', { sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-12 w-12' }[size], B.tone[tone], className)} {...p}>{children}</button>
);

/* ---------- fields: 48px controls ---------- */
const field = 'w-full rounded-xl bg-white text-[15px] text-ink placeholder:text-ink-faint outline-none ring-1 ring-inset ring-cream-300 transition hover:ring-cream-300/80 focus:ring-2 focus:ring-army';
export const Input = ({ pre, suf, className, wrap, ...p }) => (
  <div className={cx('relative flex h-12 items-center', wrap)}>
    {pre && <span className="pointer-events-none absolute left-4 text-[15px] font-medium text-ink-soft">{pre}</span>}
    <input className={cx(field, 'h-12', pre ? 'pl-10' : 'pl-4', suf ? 'pr-14' : 'pr-4', className)} {...p} />
    {suf && <span className="pointer-events-none absolute right-4 text-small font-medium text-ink-soft">{suf}</span>}
  </div>
);
export const Select = ({ value, onChange, options, className }) => (
  <div className={cx('relative h-12', className)}>
    <select value={value} onChange={e => onChange(e.target.value)} className={cx(field, 'h-12 appearance-none pl-4 pr-10')}>{options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    <Ic.Chev width="18" height="18" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-ink-soft" />
  </div>
);
export const Textarea = ({ className, ...p }) => <textarea className={cx(field, 'block min-h-[120px] resize-y px-4 py-3 leading-6', className)} {...p} />;
export const Field = ({ label, help, children, aside }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-baseline justify-between gap-3"><span className="text-small font-semibold text-ink">{label}</span>{aside}</div>
    {children}
    {help && <span className="text-caption text-ink-soft">{help}</span>}
  </div>
);

/* ---------- surfaces ---------- */
export const Card = ({ title, sub, action, children, className, pad = true, as: As = 'section' }) => (
  <As className={cx('rounded-3xl bg-white shadow-card', pad && 'p-5 sm:p-6', className)}>
    {(title || action) && (
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0"><h3 className="text-subhead font-semibold text-ink">{title}</h3>{sub && <p className="mt-0.5 text-small text-ink-soft">{sub}</p>}</div>
        {action}
      </header>
    )}
    {children}
  </As>
);
export const Rows = ({ rows }) => (
  <dl className="flex flex-col">
    {rows.filter(Boolean).map(([k, v], i) => (
      <div key={i} className={cx('flex min-h-[44px] items-center justify-between gap-6 text-body', i > 0 && 'border-t border-cream-100')}><dt className="text-ink-soft">{k}</dt><dd className="tnum text-right font-semibold text-ink">{v}</dd></div>
    ))}
  </dl>
);
export const StatGroup = ({ items, className }) => (
  <div className={cx('grid divide-x divide-cream-100 rounded-3xl bg-white py-4 shadow-card', className)} style={{ gridTemplateColumns: `repeat(${items.length},minmax(0,1fr))` }}>
    {items.map(([v, l]) => <div key={l} className="min-w-0 px-4 sm:px-6"><div className="tnum truncate text-heading font-semibold text-ink">{v}</div><div className="mt-0.5 truncate text-caption text-ink-soft">{l}</div></div>)}
  </div>
);
/* category chip: neutral outline; status: dot + label. They never look alike. */
export const Chip = ({ children, icon, tone = 'neutral', className }) => (
  <span className={cx('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-small font-medium', { neutral: 'bg-white text-ink ring-1 ring-inset ring-cream-300', sage: 'bg-sage text-army', glass: 'bg-white/12 text-white ring-1 ring-inset ring-white/20 backdrop-blur', solid: 'bg-white text-army' }[tone], className)}>{icon}{children}</span>
);
const ST = { open: ['Open', 'g'], active: ['Active', 'g'], verified: ['Verified', 'g'], accepted: ['Accepted', 'g'], funded: ['Funded', 'g'], pending: ['Pending', 'a'], unfunded: ['Awaiting payment', 'a'], paused: ['Paused', 'b'], denied: ['Denied', 'r'], rejected: ['Rejected', 'r'], ended: ['Ended', 'n'], withdrawn: ['Withdrawn', 'n'] };
export const Status = ({ s, className }) => { const [l, t] = ST[s] || [s, 'n']; return (
  <span className={cx('inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-caption font-semibold', { g: 'bg-sage-50 text-sage-700', a: 'bg-[#FBF1DE] text-[#8A5A10]', b: 'bg-[#E8F0F6] text-[#2C5877]', r: 'bg-[#FBEAE4] text-[#A23B17]', n: 'bg-cream-100 text-ink-soft' }[t], className)}>
    <i className={cx('h-1.5 w-1.5 rounded-full', { g: 'bg-sage-700', a: 'bg-[#C98A1E]', b: 'bg-[#3E7BA6]', r: 'bg-[#C9512A]', n: 'bg-ink-faint' }[t])} />{l}</span>); };
export const Tag = Status;
const HUES = [['#26331F', '#CBD6A8'], ['#6A3B2A', '#F3D9C9'], ['#2D4B55', '#CFE3E8'], ['#6B5A2E', '#EFE3BE'], ['#4A3B5C', '#E2D9EE'], ['#3B5A3F', '#D5E7CF']];
const hue = (n) => HUES[[...String(n)].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
export const Avatar = ({ name, size = 40, ring }) => { const [bg, fg] = hue(name); return (
  <span style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: bg, color: fg }} className={cx('inline-grid shrink-0 select-none place-items-center rounded-full font-semibold tracking-tight', ring && 'ring-2 ring-white')}>{initials(name)}</span>); };
export const Verified = () => <svg width="16" height="16" viewBox="0 0 24 24" className="inline shrink-0 align-[-2px]" aria-label="Verified"><path fill="#5E7A2E" d="M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-.9 2.9.9 2.9-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7.9-2.9-.9-2.9 2.5-1.7.9-2.9 3 .2z" /><path d="M8 12.2l2.6 2.6L16 9.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
export const Switch = ({ on, onChange, label, sub }) => (
  <div className="flex items-center justify-between gap-6">
    <div><div className="text-body font-semibold">{label}</div>{sub && <div className="text-small text-ink-soft">{sub}</div>}</div>
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cx('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-army' : 'bg-cream-300')}>
      <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  </div>
);
export const Segmented = ({ value, onChange, items }) => (
  <div className="flex h-12 gap-1 rounded-xl bg-cream-100 p-1">
    {items.map(([k, l]) => <button key={k} type="button" onClick={() => onChange(k)} className={cx('flex-1 rounded-[10px] text-small font-semibold capitalize transition', value === k ? 'bg-white text-army shadow-sm' : 'text-ink-soft hover:text-ink')}>{l}</button>)}
  </div>
);
export const Pills = ({ value, onChange, items, multi }) => (
  <div className="flex flex-wrap gap-2">
    {items.map(([k, l]) => { const on = multi ? value.includes(k) : value === k; return <button key={k} type="button" onClick={() => onChange(k)} className={cx('inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-small font-semibold transition', on ? 'bg-army text-white' : 'bg-white text-ink ring-1 ring-inset ring-cream-300 hover:ring-army/40')}>{on && multi && <Ic.Check width="14" height="14" />}{l}</button>; })}
  </div>
);
export const Radio = ({ on }) => <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full transition', on ? 'bg-army' : 'ring-2 ring-inset ring-cream-300')}>{on && <span className="h-2 w-2 rounded-full bg-white" />}</span>;
export const Tabs = ({ value, onChange, items, className }) => (
  <div className={cx('relative', className)}>
    <div className="no-scrollbar flex gap-1 overflow-x-auto pr-6">
      {items.map(([k, l, n]) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={cx('inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-small font-semibold transition', value === k ? 'bg-army text-white' : 'text-ink-soft hover:bg-white hover:text-ink')}>
          {l}{n ? <span className={cx('grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold', value === k ? 'bg-white text-army' : 'bg-ember text-white')}>{n}</span> : null}
        </button>
      ))}
    </div>
  </div>
);
export const Art = ({ k, className, style }) => <div className={className} style={style} dangerouslySetInnerHTML={{ __html: ART[k] }} />;
export const ProductArt = ({ p, className, k, fit = '78%' }) => (
  <div className={cx('relative grid place-items-center overflow-hidden', className)} style={{ background: bgFor(p) }}>
    <div className="absolute inset-0 opacity-[.10] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:18px_18px]" />
    {p.img ? <img src={p.img} alt="" className="relative h-full w-full object-cover" /> : <Art k={k || p.art || artFor(p.category)} className="relative [&>svg]:h-full [&>svg]:w-full" style={{ width: fit, height: fit }} />}
  </div>
);
export const Empty = ({ icon, title, text, action }) => (
  <div className="flex flex-col items-center px-6 py-12 text-center">
    <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-sage-50 text-sage-700">{icon}</span>
    <div className="text-subhead font-semibold">{title}</div>
    <p className="mt-1 max-w-xs text-small text-ink-soft">{text}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);
export function Sheet({ open, onClose, title, sub, children, footer }) {
  useEffect(() => { if (!open) return; const f = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button aria-label="Close" className="absolute inset-0 bg-army-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full flex-col rounded-t-3xl bg-white shadow-pop sm:max-w-[460px] sm:rounded-3xl">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-cream-200 sm:hidden" />
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5"><div className="min-w-0"><h2 className="text-heading font-semibold text-ink">{title}</h2>{sub && <p className="mt-0.5 text-small text-ink-soft">{sub}</p>}</div><IconButton size="sm" tone="soft" label="Close" onClick={onClose}><Ic.X width="18" height="18" /></IconButton></div>
        <div className="flex flex-col gap-5 overflow-y-auto px-6 pb-6 pt-3">{children}</div>
        {footer && <div className="flex flex-col gap-2 border-t border-cream-100 px-6 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}
export const Toast = ({ t }) => (
  <div role="status" className={cx('pointer-events-none fixed left-1/2 top-4 z-[60] flex w-max max-w-[90vw] -translate-x-1/2 items-center gap-2.5 rounded-2xl bg-army py-3 pl-3.5 pr-5 text-small font-semibold text-white shadow-pop transition-all duration-200', t ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0')}>
    <span className="grid h-6 w-6 place-items-center rounded-full bg-sage text-army"><Ic.Check width="14" height="14" /></span>{t?.m}
  </div>
);

/* ---------- page layout: top bar, optional sub bar, scroll body, action bar ---------- */
export const W = { narrow: 'max-w-[720px]', wide: 'max-w-[1120px]' };
export function Page({ crumb, onBack, right, sub, children, width = 'wide', bar, barDesktop = false }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="z-10 flex h-14 shrink-0 items-center border-b border-cream-200 bg-white/90 backdrop-blur sm:h-16">
        <div className={cx('mx-auto flex w-full items-center gap-2 px-4 sm:px-8', W[width])}>
          {onBack ? <button onClick={onBack} className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-xl pl-1.5 pr-3 text-small font-semibold text-ink-soft transition hover:bg-cream-100 hover:text-ink"><Ic.Back width="20" height="20" />{crumb}</button>
            : <span className="text-subhead font-semibold">{crumb}</span>}
          <span className="flex-1" />{right}
        </div>
      </header>
      {sub && <div className="shrink-0 border-b border-cream-200 bg-white"><div className={cx('mx-auto w-full px-4 sm:px-8', W[width])}>{sub}</div></div>}
      <div className="min-h-0 flex-1 overflow-y-auto"><div className={cx('mx-auto w-full px-4 pb-10 pt-6 sm:px-8 sm:pt-10', W[width])}>{children}</div></div>
      {bar && <div className={cx('shrink-0 border-t border-cream-200 bg-white', !barDesktop && 'lg:hidden')}><div className={cx('mx-auto flex w-full items-center gap-3 px-4 py-3 sm:px-8', W[width])}>{bar}</div></div>}
    </div>
  );
}
export const PageTitle = ({ eyebrow, h, p, right, className }) => (
  <div className={cx('mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div className="min-w-0">{eyebrow && <div className="mb-2">{eyebrow}</div>}<h1 className="font-serif text-[26px] leading-[34px] text-ink sm:text-title">{h}</h1>{p && <p className="mt-2 max-w-xl text-body text-ink-soft">{p}</p>}</div>
    {right}
  </div>
);
