import { useState } from 'react';
import { CATS } from '../lib/data.js';
import { Ic, Chip, ProductArt, Card, cx } from './index.jsx';

export function Gallery({ p, onDemo }) {
  const [k, setK] = useState(p.gallery[0]);
  const items = [...p.gallery.map(g => ({ g })), ...(p.video ? [{ video: true }] : [])];
  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-3xl shadow-card">
        <ProductArt p={p} k={k} fit="70%" className="aspect-[4/3] w-full sm:aspect-[16/10]" />
        {p.video && <button onClick={onDemo} className="absolute bottom-4 left-4 inline-flex h-10 items-center gap-2 rounded-full bg-white pl-1.5 pr-4 text-small font-semibold text-army shadow-lift transition hover:scale-[1.02]"><span className="grid h-7 w-7 place-items-center rounded-full bg-army text-white"><Ic.Play width="12" height="12" /></span>Watch demo · {p.video}</button>}
      </div>
      {items.length > 1 && (
        <div className="no-scrollbar -m-1 flex gap-3 overflow-x-auto p-1">
          {items.map((it, i) => (
            <button key={i} onClick={() => it.video ? onDemo() : setK(it.g)} className={cx('relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-2xl transition', !it.video && k === it.g ? 'ring-2 ring-army ring-offset-2 ring-offset-cream-50' : 'opacity-80 hover:opacity-100')}>
              <ProductArt p={p} k={it.g || p.art} fit="80%" className="h-full w-full" />
              {it.video && <span className="absolute inset-0 grid place-items-center bg-black/30 text-white"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-army"><Ic.Play width="12" height="12" /></span></span>}
              {it.video && <span className="absolute bottom-1 right-1.5 text-[11px] font-semibold text-white">{p.video}</span>}
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
export const Player = ({ p, sub }) => (
  <div><div className="relative overflow-hidden rounded-2xl"><ProductArt p={p} fit="60%" className="aspect-video w-full" /><span className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-army shadow-lift"><Ic.Play /></span></span></div><div className="mt-3 text-small text-ink-soft">{sub}</div></div>
);
