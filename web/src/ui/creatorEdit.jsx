import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { go } from '../lib/router.js';
import { Card, Button, Input, Field, Pills, Sheet, Ic } from './index.jsx';
import { platName } from './creator.jsx';

const NICHES = ['Beauty', 'Fashion', 'Food', 'Tech', 'Gaming', 'Fitness', 'Music', 'Travel', 'Business', 'Parenting', 'Education', 'Comedy'];
const LANGS = ['English', 'French', 'Pidgin', 'Yoruba', 'Igbo', 'Hausa', 'Swahili', 'Twi', 'Spanish', 'Arabic'];

/* the creator's own details: where they are, what they cover, the languages they post in */
export function CreatorDetails() {
  const { a } = useStore(), m = a.me?.marketer || {};
  const [f, setF] = useState({ city: m.city || '', niches: m.niches || [], languages: m.languages || [] }), [busy, setBusy] = useState(false);
  const flip = (key, v) => setF((x) => ({ ...x, [key]: x[key].includes(v) ? x[key].filter((y) => y !== v) : [...x[key], v] }));
  const dirty = f.city !== (m.city || '') || f.niches.join() !== (m.niches || []).join() || f.languages.join() !== (m.languages || []).join();
  const save = async () => { setBusy(true); const r = await a.run(() => api('/squad/marketers', { method: 'POST', body: { city: f.city.trim() || undefined, niches: f.niches, languages: f.languages } })); setBusy(false); if (r) { await a.reloadMe(); a.toast('Saved'); } };
  return (
    <Card title="Creator details" sub="Sellers see this when you apply." action={m.id && <button onClick={() => go('creator/' + m.id)} className="text-small font-semibold text-sage-700 hover:underline">View profile</button>}>
      <div className="flex flex-col gap-5">
        <Field label="City"><Input maxLength={60} placeholder="Lagos" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
        <Field label="What you post about" help="Pick up to 8."><Pills multi value={f.niches} onChange={(v) => (f.niches.includes(v) || f.niches.length < 8) && flip('niches', v)} items={NICHES.map((n) => [n, n])} /></Field>
        <Field label="Languages"><Pills multi value={f.languages} onChange={(v) => (f.languages.includes(v) || f.languages.length < 6) && flip('languages', v)} items={LANGS.map((n) => [n, n])} /></Field>
        {dirty && <Button disabled={busy} onClick={save} className="self-start">{busy ? 'Saving…' : 'Save details'}</Button>}
      </div>
    </Card>
  );
}

/* proving an account is yours: a code in the bio, then we check */
export function VerifySheet({ s, onClose }) {
  const { a } = useStore();
  const [r, setR] = useState(null), [busy, setBusy] = useState(false);
  const open = !!s;
  const load = async (placed) => { setBusy(true); const x = await a.run(() => api(`/squad/socials/${s.id}/verify`, { method: 'POST', body: placed ? { placed: true } : {} })); setBusy(false); if (x) setR(x); if (x && placed) { await a.reloadMe(); a.toast("Thanks. We'll check it shortly."); onClose(); } };
  if (open && !r && !busy) load(false);
  const code = r?.social?.verify_code;
  return (
    <Sheet open={open} onClose={() => { setR(null); onClose(); }} title={'Verify @' + (s?.handle || '')} sub="Prove the account is yours, so sellers can trust your numbers."
      footer={<Button size="lg" block disabled={!code || busy} onClick={() => load(true)}>I've added it</Button>}>
      <ol className="flex flex-col gap-4 text-small">
        <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-army text-caption font-bold text-onarmy">1</span><span>Copy this code and add it anywhere in your {s ? platName(s.platform) : ''} bio.</span></li>
        <li><button type="button" onClick={() => { navigator.clipboard?.writeText(code || ''); a.toast('Copied'); }} className="flex w-full items-center justify-between rounded-xl bg-cream-50 px-4 py-3 font-mono text-[20px] font-bold tracking-wider">{code || '…'}<Ic.Copy width="18" height="18" className="text-ink-soft" /></button></li>
        <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-army text-caption font-bold text-onarmy">2</span><span>Tap "I've added it". We check the bio and record your follower count. You can remove the code once you're verified.</span></li>
      </ol>
    </Sheet>
  );
}
