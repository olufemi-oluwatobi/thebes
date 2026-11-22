import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { PLATFORMS, COUNTRIES, day } from '../lib/data.js';
import { Card, Avatar, Chip, Ic, Empty, cx } from './index.jsx';

export const SOC = { instagram: '#C13584', tiktok: '#111', youtube: '#E0331F', x: '#111', linkedin: '#0A66C2', facebook: '#1877F2', newsletter: '#C9562A', whatsapp: '#25A244', website: '#26331F' };
export const platName = (k) => PLATFORMS.find((p) => p[0] === k)?.[1] || k;
export const countryName = (c) => COUNTRIES.find((x) => x[0] === c)?.[1] || c;
export const k = (n) => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n || 0);

/* stars: read-only, or tappable when onChange is given */
export function Stars({ value = 0, size = 16, onChange, className }) {
  return (
    <span className={cx('inline-flex items-center gap-0.5', className)} role={onChange ? 'radiogroup' : 'img'} aria-label={onChange ? 'Rating' : value + ' out of 5'}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value >= n - 0.25, half = !on && value >= n - 0.75;
        const star = <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><defs><linearGradient id={'h' + n}><stop offset="50%" stopColor="#E0B06A" /><stop offset="50%" stopColor="currentColor" /></linearGradient></defs><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2 6.4 20.2l1.1-6.3L2.9 9.5l6.3-.9z" fill={on ? '#E0B06A' : half ? `url(#h${n})` : 'currentColor'} className={on || half ? '' : 'text-cream-200'} /></svg>;
        return onChange ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={n + ' star' + (n > 1 ? 's' : '')} onClick={() => onChange(n)} className="p-1 transition active:scale-90">{star}</button> : <span key={n}>{star}</span>;
      })}
    </span>
  );
}

/* load a creator's public profile */
export function useCreator(id) {
  const [d, setD] = useState(null), [err, setErr] = useState(false);
  useEffect(() => { if (!id) return; setD(null); api('/squad/marketers/' + id).then(setD).catch(() => setErr(true)); }, [id]);
  return { d, err };
}

/* a social account, with what we checked and when */
export function SocialRow({ s, first, trail }) {
  const n = s.is_verified && s.verified_followers != null ? s.verified_followers : s.followers;
  return (
    <div className={cx('flex min-h-[64px] items-center gap-3 py-2.5', !first && 'border-t border-cream-100')}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-small font-bold text-white" style={{ background: SOC[s.platform] || '#26331F' }}>{platName(s.platform)[0]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-semibold"><span className="truncate">{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">@{s.handle}</a> : '@' + s.handle}</span>{s.is_verified && <Ic.Shield width="15" height="15" className="shrink-0 text-sage-700" aria-label="Verified account" />}</div>
        <div className="truncate text-small text-ink-soft">{platName(s.platform)} · <b className="font-semibold text-ink">{k(n)}</b> {s.is_verified ? 'verified' : 'claimed'}</div>
      </div>
      {trail}
    </div>
  );
}

const GOAL_NAME = { traffic: 'Traffic', sales: 'Sales', newsletter: 'Newsletter', story: 'Stories', review: 'Reviews', attention: 'Posts', commission: 'Sales', introduction: 'Introductions' };

/* who they are, where, their accounts, their work and how sellers rated it */
export function CreatorView({ d, highlight }) {
  const m = d.marketer, u = d.user || {}, st = d.stats || {}, name = u.display_name || (d.socials?.[0] ? '@' + d.socials[0].handle : 'Creator');
  const reach = (d.socials || []).reduce((n, s) => n + ((s.is_verified && s.verified_followers != null) ? s.verified_followers : s.followers || 0), 0);
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={name} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h2 className="truncate font-serif text-heading font-bold">{name}</h2>{m.is_verified && <Ic.Shield width="18" height="18" className="shrink-0 text-sage-700" aria-label="Verified creator" />}</div>
            <div className="text-small text-ink-soft">{[m.city, countryName(m.country)].filter(Boolean).join(', ')}{m.languages?.length ? ' · ' + m.languages.join(', ') : ''}</div>
            <div className="mt-1 flex items-center gap-1.5 text-small">{st.rating ? <><Stars value={st.rating.average} size={14} /><b>{st.rating.average.toFixed(1)}</b><span className="text-ink-soft">({st.rating.count})</span></> : <span className="text-ink-soft">No ratings yet</span>}</div>
          </div>
        </div>
        {m.niches?.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{m.niches.map((n) => <Chip key={n}>{n}</Chip>)}</div>}
        {m.bio && <p className="mt-4 whitespace-pre-line text-small text-ink/80">{m.bio}</p>}
      </Card>

      <Card title="Accounts" sub={k(reach) + ' total followers'}>
        {d.socials?.length ? <div className="-my-2">{d.socials.map((s, i) => <SocialRow key={s.id} s={s} first={!i} trail={highlight === s.id ? <span className="shrink-0 rounded-full bg-sage px-2.5 py-1 text-caption font-semibold text-army">Applying</span> : undefined} />)}</div>
          : <p className="text-small text-ink-soft">No accounts added yet.</p>}
      </Card>

      <Card title="Work on Gorilla Squad" sub={'Member since ' + day(d.member_since)}>
        <div className="grid grid-cols-3 divide-x divide-cream-100 text-center">
          {[[st.deals || 0, 'Deals'], [st.approved_results || 0, 'Approved'], [st.approval_rate == null ? '—' : st.approval_rate + '%', 'Approval rate']].map(([v, l]) => <div key={l}><div className="tnum text-heading font-semibold">{v}</div><div className="text-caption text-ink-soft">{l}</div></div>)}
        </div>
        {(st.by_goal?.length > 0 || st.by_delivery?.length > 0) && <div className="mt-5 flex flex-wrap gap-1.5">
          {st.by_goal.map((g) => <Chip key={'g' + g.slug}>{GOAL_NAME[g.slug] || g.name} · {g.n}</Chip>)}
          {st.by_delivery.map((x) => <Chip key={'d' + x.slug} tone="sage">{x.name} · {x.n} approved</Chip>)}
        </div>}
        {!st.deals && <p className="mt-4 text-small text-ink-soft">New to Gorilla Squad. No deals yet.</p>}
      </Card>

      {d.reviews?.length > 0 && <Card title="What sellers say">
        <ul className="-my-2">{d.reviews.map((r, i) => <li key={i} className={cx('py-3', i && 'border-t border-cream-100')}><div className="flex items-center justify-between gap-3"><Stars value={r.stars} size={14} /><span className="text-caption text-ink-faint">{r.who} · {day(r.created_at)}</span></div>{r.note && <p className="mt-1.5 text-small">{r.note}</p>}</li>)}</ul>
      </Card>}
    </div>
  );
}
