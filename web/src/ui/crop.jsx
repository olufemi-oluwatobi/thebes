import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Sheet, Button, Ic } from './index.jsx';

/* Product images are shown 4:3 everywhere (feed card, product page, listing preview),
   so every upload is framed to 4:3 here: drag to move, scroll / pinch / slider to zoom. */
export const ASPECT = 4 / 3;

export function CropSheet({ file, aspect = ASPECT, title = 'Fit your image', onDone, onCancel, cancelLabel = 'Cancel' }) {
  const box = useRef(), pts = useRef(new Map()), pinch = useRef(null);
  const [img, setImg] = useState(null), [W, setW] = useState(0), [z, setZ] = useState(1), [pos, setPos] = useState({ x: 0, y: 0 }), [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return; setImg(null); setZ(1); setPos({ x: 0, y: 0 });
    const url = URL.createObjectURL(file), el = new Image();
    el.onload = () => setImg({ el, w: el.naturalWidth, h: el.naturalHeight, url });
    el.onerror = () => onCancel?.('That image could not be opened');
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useLayoutEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width)); ro.observe(box.current);
    return () => ro.disconnect();
  }, [img]);

  const H = W / aspect;
  const base = img && W ? Math.max(W / img.w, H / img.h) : 1, s = base * z;
  const dw = img ? img.w * s : 0, dh = img ? img.h * s : 0;
  const clamp = (p, zz = z) => { const ss = base * zz, mx = Math.max(0, (img.w * ss - W) / 2), my = Math.max(0, (img.h * ss - H) / 2); return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) }; };
  const zoom = (nz) => { nz = Math.min(4, Math.max(1, nz)); setZ(nz); setPos((p) => clamp(p, nz)); };

  const down = (e) => { e.currentTarget.setPointerCapture(e.pointerId); pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.current.size === 2) { const [a, b] = [...pts.current.values()]; pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z }; } };
  const move = (e) => {
    const prev = pts.current.get(e.pointerId); if (!prev || !img) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2 && pinch.current) { const [a, b] = [...pts.current.values()]; return zoom(pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d); }
    setPos((p) => clamp({ x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }));
  };
  const up = (e) => { pts.current.delete(e.pointerId); if (pts.current.size < 2) pinch.current = null; };

  const done = async () => {
    if (!img || busy) return; setBusy(true);
    const sx = ((dw - W) / 2 - pos.x) / s, sy = ((dh - H) / 2 - pos.y) / s, sw = W / s, sh = H / s;
    const ow = Math.max(480, Math.min(1600, Math.round(sw))), oh = Math.round(ow / aspect);
    const c = document.createElement('canvas'); c.width = ow; c.height = oh;
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img.el, sx, sy, sw, sh, 0, 0, ow, oh);
    let blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.9));
    if (!blob || blob.type !== 'image/webp') { ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ow, oh); blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9)); }
    setBusy(false);
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg', out = new File([blob], (file.name || 'image').replace(/\.\w+$/, '') + '.' + ext, { type: blob.type });
    onDone(out, URL.createObjectURL(out));
  };

  return (
    <Sheet open={!!file} onClose={() => onCancel?.()} title={title} sub="Drag to move it, zoom to fill the frame. This is exactly how it shows in the feed."
      footer={<div className="flex gap-3"><Button tone="secondary" className="flex-1" onClick={() => onCancel?.()}>{cancelLabel}</Button><Button className="flex-1" disabled={!img || busy} onClick={done}>{busy ? 'Saving…' : 'Use image'}</Button></div>}>
      <div ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={(e) => zoom(z * (1 - e.deltaY * 0.0015))}
        className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-cream-100 active:cursor-grabbing" style={{ aspectRatio: String(aspect) }}>
        {img && W > 0 && <img src={img.url} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ width: dw, height: dh, left: (W - dw) / 2 + pos.x, top: (H - dh) / 2 + pos.y }} />}
        {!img && <div className="absolute inset-0 grid place-items-center"><span className="h-7 w-7 animate-spin rounded-full border-2 border-cream-200 border-t-army" /></div>}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-60">{Array.from({ length: 9 }, (_, i) => <span key={i} className="border-white/40 [&:not(:nth-child(3n))]:border-r [&:nth-child(-n+6)]:border-b" />)}</div>
      </div>
      <div className="mt-4 flex items-center gap-3 text-ink-soft">
        <button type="button" aria-label="Zoom out" onClick={() => zoom(z - 0.25)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-cream-100"><Ic.Minus width="18" height="18" /></button>
        <input type="range" min="1" max="4" step="0.01" value={z} onChange={(e) => zoom(+e.target.value)} aria-label="Zoom" className="h-1.5 flex-1 cursor-pointer accent-army" />
        <button type="button" aria-label="Zoom in" onClick={() => zoom(z + 0.25)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-cream-100"><Ic.Plus width="18" height="18" /></button>
      </div>
    </Sheet>
  );
}
