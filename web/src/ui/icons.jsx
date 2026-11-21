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
