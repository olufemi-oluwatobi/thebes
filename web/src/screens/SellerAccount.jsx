import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { COUNTRIES } from '../lib/data.js';
import { Page, PageTitle, Card, Button, Input, Textarea, Field, Select, Pills, Avatar, Ic } from '../ui/index.jsx';
import { sellerDraft, afterSeller } from '../ui/wizard.jsx';

const WHAT = ['Online store', 'Software', 'Digital products', 'Courses', 'Newsletter', 'Music', 'Services', 'Food & drink', 'Beauty', 'Fashion'];
const NAMES = Object.fromEntries(COUNTRIES);

/* #plus/seller — create (or edit) the seller account: the brand creators see on every listing.
   It opens filled in with a starting point, so it is one tap to continue and easy to change later. */
export default function SellerAccount() {
  const { S, a } = useStore();
  const editing = S.auth === 'in' && a.hasSeller;
  const start = () => {
    const co = a.me?.co, d = sellerDraft.get(), first = (a.me?.name || '').split(/[\s.]/)[0];
    if (co) return { name: a.me?.name || '', company: co.name || '', industry: co.industry || '', description: co.description || '', website: co.website || '', country: co.country || 'NG', city: co.city || '' };
    if (d) return d;
    return { name: a.me?.name || '', company: first ? first.charAt(0).toUpperCase() + first.slice(1) + "'s Store" : 'My Store', industry: 'Online store',
      description: 'We make things people love to share. Tell creators what you sell, who buys it and why it stands out.', website: '', country: 'NG', city: 'Lagos' };
  };
  const [f, setF] = useState(start), [busy, setBusy] = useState(false), [touched, setTouched] = useState(false);
  useEffect(() => { if (!touched) setF(start()); }, [S.auth, a.me?.co?.id, a.me?.name]);
  const set = (k) => (e) => { setTouched(true); setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e })); };

  const next = afterSeller.get() || 'plus/product';
  const leave = () => { afterSeller.clear(); go(editing ? 'me' : 'plus'); };
  const err = f.company.trim().length < 2 ? 'Give your brand a name' : f.website.trim() && !/^(https?:\/\/)?[^\s.]+\.\S+$/.test(f.website.trim()) ? 'That website does not look right' : null;
  const submit = async () => {
    if (err) return a.toast(err);
    const v = { ...f, website: f.website.trim() && !/^https?:\/\//.test(f.website.trim()) ? 'https://' + f.website.trim() : f.website.trim() };
    if (S.auth !== 'in') { sellerDraft.set(v); afterSeller.clear(); a.toast('Seller details saved. Your account is created when you sign in.'); return go(next); }
    setBusy(true); const ok = await a.saveSeller(v); setBusy(false);
    if (ok) { sellerDraft.clear(); afterSeller.clear(); go(editing ? 'me' : next); }
  };
  const where = [f.city.trim(), NAMES[f.country]].filter(Boolean).join(', ');

  return (
    <Page crumb={editing ? 'Profile' : 'Create'} onBack={leave} barDesktop
      bar={<><Button tone="secondary" onClick={leave}>{editing ? 'Cancel' : 'Back'}</Button><span className="flex-1" /><Button disabled={busy} onClick={submit}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create seller account'}</Button></>}>
      <PageTitle eyebrow={<span className="inline-flex items-center gap-2 text-small font-semibold text-sage-700"><Ic.Store width="18" height="18" />Seller account</span>}
        h={editing ? 'Your seller account' : 'Create your seller account'}
        p={editing ? 'This is who creators see on your products and listings.' : "Creators see this on every product and listing you post. We've filled in a starting point: change anything, now or later."} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Your brand">
            <div className="flex flex-col gap-5">
              <Field label="Brand or company name"><Input maxLength={80} placeholder="e.g. Kofi's Hot Sauce" value={f.company} onChange={set('company')} /></Field>
              <Field label="What you sell"><Pills value={f.industry} onChange={(v) => set('industry')(f.industry === v ? '' : v)} items={WHAT.map((w) => [w, w])} /></Field>
              <Field label="About" help="What you make, who it's for, and why people like it." aside={<span className="text-caption text-ink-faint">{f.description.length}/1000</span>}><Textarea maxLength={1000} value={f.description} onChange={set('description')} /></Field>
            </div>
          </Card>
          <Card title="Where to find you">
            <div className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2"><Field label="Country"><Select value={f.country} onChange={set('country')} options={COUNTRIES} /></Field><Field label="City" aside={<span className="text-caption text-ink-faint">Optional</span>}><Input maxLength={60} placeholder="Lagos" value={f.city} onChange={set('city')} /></Field></div>
              <Field label="Website" aside={<span className="text-caption text-ink-faint">Optional</span>}><Input inputMode="url" placeholder="yourbrand.com" value={f.website} onChange={set('website')} /></Field>
            </div>
          </Card>
          <Card title="You" sub="Shown to creators in chats.">
            <Field label="Your name"><Input maxLength={60} placeholder="e.g. Ada Okafor" value={f.name} onChange={set('name')} /></Field>
          </Card>
        </div>
        <aside className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
          <div className="text-small font-semibold text-ink-soft">How creators see you</div>
          <Card>
            <div className="flex items-center gap-3"><Avatar name={f.company || 'Brand'} size={56} /><div className="min-w-0"><div className="truncate text-subhead font-semibold">{f.company || 'Your brand'}</div><div className="truncate text-small text-ink-soft">{[f.industry, where].filter(Boolean).join(' · ') || 'Seller'}</div></div></div>
            {f.description && <p className="mt-4 line-clamp-4 whitespace-pre-line text-small text-ink/80">{f.description}</p>}
            {f.website && <div className="mt-4 flex items-center gap-2 text-small font-semibold text-sage-700"><Ic.Globe width="16" height="16" /><span className="truncate">{f.website.replace(/^https?:\/\//, '')}</span></div>}
          </Card>
          {!editing && <p className="px-1 text-caption text-ink-faint">Next: add your first product.</p>}
        </aside>
      </div>
    </Page>
  );
}
