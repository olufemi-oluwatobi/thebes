import { useState } from 'react';
import { artFor } from '../lib/data.js';
import { Ic, ProductArt, Card, cx } from './index.jsx';

// the product's images (uploaded), or our category art when there are none; a demo video tile when there is one
export function Gallery({ p, onDemo }) {
  const imgs = p.images?.length ? p.images : [null];
  const [k, setK] = useState(0);
  const items = [...imgs.map((src, i) => ({ src, i })), ...(p.videoUrl ? [{ video: true }] : [])];
  const cur = imgs[k] ?? imgs[0];
  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-card">
        {cur ? <div className="grid aspect-[4/3] w-full place-items-center bg-cream-100"><img src={cur} alt="" className="h-full w-full object-cover" /></div>
          : <ProductArt p={{ ...p, img: null }} k={artFor(p.category)} fit="70%" className="aspect-[4/3] w-full" />}
        {p.videoUrl && <button onClick={onDemo} className="absolute bottom-4 left-4 inline-flex h-10 items-center gap-2 rounded-full bg-white pl-1.5 pr-4 text-small font-semibold text-forest shadow-lift transition hover:scale-[1.02]"><span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-white"><Ic.Play width="12" height="12" /></span>Watch demo</button>}
      </div>
      {items.length > 1 && (
        <div className="no-scrollbar -m-1 flex gap-3 overflow-x-auto p-1">
          {items.map((it, i) => (
            <button key={i} onClick={() => it.video ? onDemo() : setK(it.i)} className={cx('relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-2xl bg-cream-100 transition', !it.video && k === it.i ? '' : 'opacity-55 hover:opacity-100')}>
              {it.src ? <img src={it.src} alt="" className="h-full w-full object-cover" /> : <ProductArt p={{ ...p, img: imgs.find(Boolean) || null }} k={artFor(p.category)} fit="80%" className="h-full w-full" />}
              {it.video && <span className="absolute inset-0 grid place-items-center bg-black/35 text-white"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-army"><Ic.Play width="12" height="12" /></span></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export const Steps = ({ title, sub, steps }) => (
  <Card title={title} sub={sub}>
    <ol className="grid gap-5 sm:grid-cols-3 sm:gap-4">
      {steps.map(([h, t], i) => (
        <li key={h} className="flex gap-3 sm:flex-col sm:gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sage-50 text-small font-bold text-sage-700">{i + 1}</span><div><div className="text-body font-semibold">{h}</div><div className="mt-0.5 text-small text-ink-soft">{t}</div></div></li>
      ))}
    </ol>
  </Card>
);
export const Player = ({ src, sub }) => (
  <div>{src ? <video src={src} controls playsInline className="aspect-video w-full rounded-2xl bg-black" /> : <div className="grid aspect-video place-items-center rounded-2xl bg-cream-100 text-small text-ink-soft">No video</div>}{sub && <div className="mt-3 text-small text-ink-soft">{sub}</div>}</div>
);
