import { useEffect, useState } from 'react';
const parse = () => { const h = (location.hash || '#feed').slice(1); const [n, ...r] = h.split('-'); return { n, a: r[0] || '', b: r.slice(1).join('-') }; };
export const go = (h) => { location.hash = h; };
export const back = (fallback = 'feed') => { if (history.length > 1) history.back(); else go(fallback); };
export function useRoute() { const [r, set] = useState(parse); useEffect(() => { const f = () => set(parse()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []); return r; }
