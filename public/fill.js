// Template + slot values → the $vars godtongue compiles with. Shared by the wizard (browser) and the tests (node).
export const DEFAULTS = {
  'pop-player': { ink: '#141414', field: '#1f8bff', band: '#ffd21f', sponsor: '#e65078', glass: '#ffe3ea', deck: '#10d27a', correct: '#10d27a', present: '#ffd21f',
    title: 'THE DAILY WORD', subtitle: 'SIX TRIES', win: 'You got it!', lose: 'So close. Come back tomorrow.', timeout: 'Time! Come back tomorrow.' },
  'trivia-classic': { ink: '#050515', field: '#050515', accent: '#D0BCFF', sponsor: '#D0BCFF', card: '#F3F1F7',
    title: 'Trivia Sprint', subtitle: 'QUICK QUESTIONS · ONE CLOCK', win: 'Nicely done!', lose: 'Not this time. Try the next one.', timeout: "Time's up!" },
  'analog-player': { ink: '#ffb347', tagline: 'THE DAILY WORD', win: 'You got it!', lose: 'So close. Come back tomorrow.' },
};
// questions: [{ q, options: [right, …wrong] }] → the .gt form "Q | right | wrong; …"
export const quizText = (qs) => (qs || []).map((x) => [x.q, ...x.options].join(' | ')).join('; ');
export function varsFor(templateId, { id, word, questions, tries = 6, time = 0, series, brand, slots = {} }) {
  const s = { ...DEFAULTS[templateId], ...Object.fromEntries(Object.entries(slots).filter(([, v]) => v != null && String(v).trim() !== '')) };
  const B = String(s.brand || brand || 'THEBES').toUpperCase();
  const row = (n) => Array(n).fill(B).join('  •  ');
  return {
    id: id || 'game', word: word || 'kept by the server', questions: questions?.length ? quizText(questions) : 'kept by the server', tries, time: time || 0, series: series || id || 'game',
    brand: B, brandrow: row(Math.max(2, Math.ceil(64 / (B.length + 5)))), brandcol: row(Math.max(3, Math.ceil(100 / (B.length + 5)))),
    ...Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'brand')),
    prize: s.win, // the analog template calls it $prize in older copies
  };
}
