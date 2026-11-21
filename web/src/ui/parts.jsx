import { useState } from 'react';
import { ART } from '../lib/art.js';
import { CATS, bgFor } from '../lib/data.js';
import { Ic, Chip, ProductArt, Card, cx } from './index.jsx';

export function Gallery({ p, onDemo }) {
  const [k, setK] = useState(p.gallery[0]);
  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-3xl shadow-card">
        <ProductArt p={p} k={k} className="aspect-[4/3] w-full md:aspect-[16/10]" />
        <Chip tone="sage" className="absolute left-4 top-4">{CATS[p.category]}</Chip>
        {p.video && <button onClick={onDemo} className="absolute bottom-4 right-4 inline-flex h-10 items-center gap-2 rounded-full bg-black/40 px-4 text-sm font-semibold text-white backdrop-blur"><Ic.Play width="16" height="16" /> Watch demo · {p.video}</button>}
      </div>
      {(p.gallery.length > 1 || p.video) && (
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto p-1">
          {p.gallery.map(g => (
            <button key={g} onClick={() => setK(g)} className={cx('h-16 w-[84px] shrink-0 overflow-hidden rounded-2xl transition', k === g ? 'ring-2 ring-army ring-offset-2 ring-offset-cream-50' : 'opacity-70')} style={{ background: bgFor(p) }}>
              <div className="grid h-full place-items-center p-1.5 [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: ART[g] }} />
            </button>
          ))}
          {p.video && <button onClick={onDemo} className="relative grid h-16 w-[84px] shrink-0 place-items-center overflow-hidden rounded-2xl text-white" style={{ background: bgFor(p) }}><Ic.Play /><span className="absolute bottom-1 right-2 text-[10px] font-bold">{p.video}</span></button>}
        </div>
      )}
    </div>
  );
}
export const Steps = ({ title, sub, steps }) => (
  <Card title={title} sub={sub}>
    <ol className="flex flex-col gap-5">
      {steps.map(([h, t], i) => (
        <li key={h} className="flex gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-army text-sm font-bold text-white">{i + 1}</span><div><div className="text-[15px] font-semibold leading-8">{h}</div><div className="text-sm leading-5 text-ink-soft">{t}</div></div></li>
      ))}
    </ol>
  </Card>
);
export const ActionBar = ({ children }) => (
  <div className="absolute inset-x-0 bottom-0 z-20 bg-white/90 px-4 py-3 backdrop-blur md:hidden"><div className="mx-auto flex max-w-3xl gap-3">{children}</div></div>
);
export const Player = ({ p, title, sub }) => (
  <div className="overflow-hidden rounded-2xl"><ProductArt p={p} className="aspect-video w-full" /><div className="mt-3 text-sm text-ink-soft">{sub}</div></div>
);
