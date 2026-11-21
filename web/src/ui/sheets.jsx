import { useState, useEffect } from 'react';
import { useStore, offerOf } from '../lib/store.jsx';
import { COUNTRIES, PLATFORMS, TYPES } from '../lib/data.js';
import { Sheet, Button, Input, Field, Textarea, Select, Ic, LogoMark } from './index.jsx';

export function SignInSheet() {
  const { S, a } = useStore();
  const [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [res, setRes] = useState(null);
  useEffect(() => { if (!S.signin) { setRes(null); setBusy(false); } }, [S.signin]);
  const submit = async (e) => { e.preventDefault(); setBusy(true); const r = await a.signIn(email.trim()); setBusy(false); if (r) setRes(r); };
  return (
    <Sheet open={!!S.signin} onClose={a.closeSignin} title={res ? (res.link ? 'Your sign-in link' : 'Check your email') : S.signin?.why || 'Sign in'} sub={res ? (res.link ? 'Email is off on this server, so here is the link.' : 'We sent a link to ' + email + '. It works once, for 20 minutes.') : 'We email you a link. No password needed.'}>
      {!res ? (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Email"><Input type="email" required autoFocus placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Button size="lg" block disabled={busy || !email.includes('@')}>{busy ? 'Sending…' : 'Email me a sign-in link'}</Button>
        </form>
      ) : res.link ? <a href={res.link} className="inline-flex h-12 items-center justify-center rounded-xl bg-army font-semibold text-white">Open sign-in link</a>
        : <div className="flex flex-col items-center gap-3 py-4 text-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-sage-50 text-sage-700"><Ic.Send /></span><p className="text-small text-ink-soft">Open the email on this device to finish signing in.</p><Button tone="secondary" onClick={() => setRes(null)}>Use another email</Button></div>}
    </Sheet>
  );
}

export function SetupSheet() {
  const { S, a } = useStore();
  const kind = S.setup, seller = kind === 'seller';
  const [f, setF] = useState({ name: '', company: '', website: '', country: 'NG', city: '' }), [busy, setBusy] = useState(false);
  useEffect(() => { if (kind) setF((x) => ({ ...x, name: S.me?.user?.display_name || '' })); }, [kind]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e });
  const submit = async (e) => { e.preventDefault(); setBusy(true); await a.setupProfile(kind, f); setBusy(false); };
  const need = seller ? f.name.trim() && (a.me?.company || f.company.trim().length >= 2) : f.name.trim() && f.country;
  return (
    <Sheet open={!!kind} onClose={a.closeSetup} title={seller ? 'Set up selling' : 'Set up promoting'} sub={seller ? 'Tell marketers who they are working with.' : 'Sellers see this when you apply.'}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Your name"><Input autoFocus placeholder="e.g. Ada Okafor" value={f.name} onChange={set('name')} /></Field>
        {seller ? (!a.me?.company && <>
          <Field label="Company or brand"><Input placeholder="e.g. Kofi's Hot Sauce" value={f.company} onChange={set('company')} /></Field>
          <Field label="Website" aside={<span className="text-caption text-ink-faint">Optional</span>}><Input placeholder="https://" value={f.website} onChange={set('website')} /></Field>
        </>) : <div className="grid grid-cols-2 gap-4"><Field label="Country"><Select value={f.country} onChange={set('country')} options={COUNTRIES} /></Field><Field label="City"><Input placeholder="Lagos" value={f.city} onChange={set('city')} /></Field></div>}
        <Button size="lg" block disabled={busy || !need}>{busy ? 'Saving…' : 'Continue'}</Button>
      </form>
    </Sheet>
  );
}

export function ApplySheet() {
  const { S, a } = useStore();
  const o = S.applyTo ? offerOf(S, S.applyTo) : null;
  const socials = a.me?.socials?.filter((x) => !x.is_blocked) || [];
  const [msg, setMsg] = useState(''), [soc, setSoc] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { if (o) { setMsg(''); setSoc(socials[0]?.id || ''); } }, [S.applyTo]);
  if (!o) return null;
  return (
    <Sheet open onClose={a.closeApply} title="Apply to promote" sub={o.title}
      footer={<Button size="lg" block disabled={busy} onClick={async () => { setBusy(true); await a.sendApply(o, msg.trim(), soc); setBusy(false); }}>{busy ? 'Sending…' : 'Send application'}</Button>}>
      <div className="flex items-baseline gap-2 rounded-2xl bg-cream-50 p-4"><span className="font-serif text-[28px] leading-none">{TYPES[o.type]?.reward(o.terms, o.fin.cur)}</span><span className="text-small text-ink-soft">{TYPES[o.type]?.sub(o.terms, o.fin.cur)}</span></div>
      {socials.length > 0 && <Field label="Which account will you use?"><Select value={soc} onChange={setSoc} options={socials.map((x) => [x.id, (PLATFORMS.find((p) => p[0] === x.platform)?.[1] || x.platform) + ' · @' + x.handle + ' · ' + (x.followers || 0).toLocaleString()])} /></Field>}
      <Field label="Note to the seller" help="Who your audience is and how you'd promote it."><Textarea maxLength={2000} value={msg} onChange={e => setMsg(e.target.value)} placeholder="e.g. I run a food page in Lagos with 4k followers. I'd share it in stories and my weekly roundup." /></Field>
    </Sheet>
  );
}
