import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { money, day } from '../lib/data.js';
import { Page, PageTitle, Card, Button, Tabs, Empty, Ic, cx } from '../ui/index.jsx';
import { platName } from '../ui/creator.jsx';

/* #admin: the work only our team does. Credit top-ups, mark jobs done or cancel them, send payouts, check account codes. */
export default function Admin() {
  const { a } = useStore();
  const [d, setD] = useState(null), [tab, setTab] = useState('jobs'), [busy, setBusy] = useState('');
  const load = () => api('/admin/squad/money').then(setD).catch(() => setD({ denied: true }));
  useEffect(() => { load(); }, []);
  const act = async (path, body, msg) => { setBusy(path); const r = await a.run(() => api(path, { method: 'POST', body: body || {} })); setBusy(''); if (r) { a.toast(msg); load(); } };
  if (!a.isAdmin || d?.denied) return <Page crumb="Admin"><Empty icon={<Ic.Shield />} title="Admins only" text="This page is for the Gorilla Squad team." /></Page>;
  const row = (key, i, main, sub, actions) => <li key={key} className={cx('flex flex-col gap-3 py-4 sm:flex-row sm:items-center', i && 'border-t border-cream-100')}><div className="min-w-0 flex-1"><div className="font-semibold">{main}</div><div className="text-small text-ink-soft">{sub}</div></div><div className="flex gap-2">{actions}</div></li>;
  const B = (label, path, body, msg, tone) => <Button size="sm" tone={tone} disabled={busy === path} onClick={() => act(path, body, msg)}>{label}</Button>;
  const lists = d && {
    jobs: d.holds.map((h, i) => row(h.id, i, <>{money(h.amount_cents, h.currency)} · {h.offer_title}</>, <>{h.seller} → {h.other} · held {day(h.created_at)}</>,
      <>{B('Cancel, refund', `/admin/squad/holds/${h.id}/refund`, {}, 'Refunded to the seller', 'secondary')}{B('Job done', `/admin/squad/holds/${h.id}/release`, {}, 'Paid to the marketer')}</>)),
    topups: d.topups.map((t, i) => row(t.id, i, <>{money(t.amount_cents, t.currency)} · <span className="font-mono">{t.reference}</span></>, <>{t.who} · {day(t.created_at)}</>,
      <>{B('Cancel', `/admin/squad/topups/${t.id}/cancel`, {}, 'Cancelled', 'secondary')}{B('Money received', `/admin/squad/topups/${t.id}/credit`, {}, 'Wallet credited')}</>)),
    payouts: d.payouts.map((p, i) => row(p.id, i, <>{money(p.amount_cents, p.currency)} · {p.method === 'mobile_money' ? 'Mobile money' : p.method}</>, <>{p.who} · {p.details}</>,
      <>{B('Cancel', `/admin/squad/payouts/${p.id}/cancel`, {}, 'Returned to their wallet', 'secondary')}{B('Sent', `/admin/squad/payouts/${p.id}/paid`, {}, 'Marked paid')}</>)),
    accounts: d.checks.map((s, i) => row(s.id, i, <>{platName(s.platform)} · {s.url ? <a className="underline" href={s.url} target="_blank" rel="noreferrer">@{s.handle}</a> : '@' + s.handle}</>, <>{s.who} · look for <b className="font-mono text-ink">{s.verify_code}</b> · {s.followers.toLocaleString()} followers claimed</>,
      <>{B('Code not found', `/admin/squad/socials/${s.id}`, { action: 'unverify' }, 'Request cleared', 'secondary')}{B('Verify', `/admin/squad/socials/${s.id}`, { action: 'verify', note: 'bio code found' }, 'Account verified')}</>)),
  };
  const n = (k) => d?.[{ jobs: 'holds', topups: 'topups', payouts: 'payouts', accounts: 'checks' }[k]]?.length || 0;
  return (
    <Page crumb="Admin">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageTitle h="Admin" p="Money and checks waiting for the team." className="!mb-0" />
        <Tabs value={tab} onChange={setTab} items={[['jobs', 'Jobs', n('jobs')], ['topups', 'Top-ups', n('topups')], ['payouts', 'Payouts', n('payouts')], ['accounts', 'Accounts', n('accounts')]]} />
        <Card>{!d ? <div className="grid h-24 place-items-center"><span className="h-7 w-7 animate-spin rounded-full border-2 border-cream-200 border-t-army" /></div>
          : lists[tab].length ? <ul className="-my-4">{lists[tab]}</ul> : <Empty icon={<Ic.Check />} title="All clear" text="Nothing waiting here." />}</Card>
      </div>
    </Page>
  );
}
