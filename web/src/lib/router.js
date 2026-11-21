import { useEffect, useState } from 'react';
// #name or #name/id — ids from the API contain dashes, so "/" separates them
const parse = () => { const h = decodeURIComponent((location.hash || '#feed').slice(1)); const i = h.indexOf('/'); return i < 0 ? { n: h || 'feed', a: '' } : { n: h.slice(0, i), a: h.slice(i + 1) }; };
export const go = (h) => { location.hash = h; };
export const back = (fallback = 'feed') => { if (history.length > 1) history.back(); else go(fallback); };
export function useRoute() { const [r, set] = useState(parse); useEffect(() => { const f = () => set(parse()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []); return r; }
