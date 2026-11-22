// Light, dark or follow the system. The choice is kept in this browser; index.html applies it before first paint.
const KEY = 'gs_theme';
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
export const getTheme = () => { try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; } };
export function applyTheme(mode = getTheme()) {
  const dark = mode === 'dark' || (mode === 'system' && !!mq?.matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E130B' : '#F8F7F0');
  return dark;
}
export function setTheme(mode) { try { localStorage.setItem(KEY, mode); } catch {} applyTheme(mode); }
mq?.addEventListener?.('change', () => { if (getTheme() === 'system') applyTheme('system'); });
