// Animated goal icons, the same drawing style as the landing page's tiles. Motion stops for reduced-motion users.
const S = { strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
const ICONS = {
  traffic: (
    <>
      <circle className="g-ripple" cx="25" cy="25" r="13" fill="none" stroke="#7FB0D9" strokeWidth="2.5" />
      <circle cx="25" cy="25" r="5" fill="#7FB0D9" />
      <g className="g-press"><path d="M27 27 29.5 53 36 46 41.5 57 47 54.5 41.5 43.5 51 43Z" fill="#DCEAF6" stroke="#2F6FA3" {...S} /></g>
    </>
  ),
  sales: (
    <>
      <g className="g-coin"><circle cx="32" cy="12" r="7" fill="#E9C46A" stroke="#B9800A" strokeWidth="2.2" /><path d="M32 8.5v7" stroke="#B9800A" strokeWidth="2.2" strokeLinecap="round" /></g>
      <path d="M14 24h36l-3 30a3 3 0 0 1-3 2.7H20a3 3 0 0 1-3-2.7Z" fill="#F8E7B5" stroke="#B9800A" {...S} />
      <path d="M24 30v-3a8 8 0 0 1 16 0v3" fill="none" stroke="#B9800A" {...S} />
    </>
  ),
  newsletter: (
    <>
      <g className="g-letter"><rect x="18" y="12" width="28" height="28" rx="3" fill="#fff" stroke="#C9562A" strokeWidth="2.2" /><path d="M23 20h18M23 26h13" stroke="#EFAE8C" strokeWidth="2.6" strokeLinecap="round" /></g>
      <path d="M10 28 32 42 54 28V50a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4Z" fill="#FBE1D3" stroke="#C9562A" {...S} />
      <path d="M11 52 26 39M53 52 38 39" stroke="#C9562A" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  story: (
    <>
      <circle className="g-ring" cx="32" cy="30" r="21" fill="none" stroke="#C2477B" strokeWidth="3.5" strokeDasharray="10 5" strokeLinecap="round" />
      <circle cx="32" cy="30" r="15" fill="#F8D9E6" />
      <circle cx="32" cy="26" r="5" fill="#C2477B" />
      <path d="M23.5 39a9 7 0 0 1 17 0" fill="#C2477B" />
      <rect x="22" y="54" width="20" height="5" rx="2.5" fill="#C2477B" className="g-bar" />
    </>
  ),
  review: (
    <>
      <rect x="6" y="18" width="38" height="30" rx="7" fill="#E6DEF7" stroke="#6B4FB8" {...S} />
      <path d="M44 28 58 20v26l-14-8Z" fill="#B9A4E0" stroke="#6B4FB8" {...S} />
      <circle className="g-rec" cx="15" cy="27" r="3.5" fill="#E0533D" />
      <path className="g-star" d="M25 30.5l2 4 4.4.6-3.2 3.1.8 4.4-4-2.1-4 2.1.8-4.4-3.2-3.1 4.4-.6z" fill="#E9C46A" stroke="#B9800A" strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
};
export const GoalIcon = ({ k, className = '' }) => (
  <svg viewBox="0 0 64 64" aria-hidden className={'g-ic overflow-visible ' + className}>{ICONS[k] || ICONS.traffic}</svg>
);
