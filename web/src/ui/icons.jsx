const P = (d, extra = {}) => (props) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>{d}</svg>
);
export const Back = P(<path d="M15 5l-7 7 7 7" />);
export const Chev = P(<path d="M9 6l6 6-6 6" />);
export const Plus = P(<path d="M12 5v14M5 12h14" />);
export const X = P(<path d="M6 6l12 12M18 6L6 18" />);
export const Check = P(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const Send = P(<path d="M5 12l14-7-5 14-2.5-5.5z" />);
export const Share = P(<path d="M14 4l7 7-7 7M21 11H9a5 5 0 0 0-5 5v3" />);
export const Visit = P(<><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>);
export const Play = (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}><path d="M7 4l13 8-13 8z" /></svg>;
export const Up = P(<path d="M12 16V4M7 9l5-5 5 5M4 20h16" />);
export const Info = P(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>);
export const Shield = P(<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />);
export const Feed = P(<><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor" /></>);
export const Chat = P(<path d="M4 5h16v11H9l-5 4z" />);
export const Me = P(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" /></>);
export const Dots = P(<><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>);
export const Tag = P(<><path d="M3 12V4h8l9 9-8 8z" /><circle cx="7.5" cy="8.5" r="1.3" /></>);
export const Box = P(<><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></>);
export const At = P(<><circle cx="12" cy="12" r="4" /><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1" /></>);
export const Search = P(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
export const Bell = P(<><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></>);
export const Swap = P(<><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></>);
export const Image = P(<><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>);
export const Globe = P(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>);
export const Wallet = P(<><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M16 13h2M3 10h18" /></>);
export const Clock = P(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
