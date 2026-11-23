import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { go } from '../lib/router.js';
import { money, day } from '../lib/data.js';
import { Page, Card, Button, Tabs, Empty, Ic, Sheet, Field, Input, Pills, cx } from '../ui/index.jsx';
import { platName } from '../ui/creator.jsx';

/* #admin: the Gorilla Squad console. Overview, the queues only the team works, and every table with its actions. */
const SECTIONS = [['overview', 'Overview'], ['queues', 'Queues'], ['users', 'Users'], ['offers', 'Offers'], ['socials', 'Socials'], ['deals', 'Deals'], ['transactions', 'Transactions']];
const KIND = { topup: 'Top-up', hold: 'Job hold', fee: 'Fee', refund: 'Refund', earning: 'Job done', payout: 'Withdrawal', payout_return: 'Withdrawal returned', adjust: 'Adjustment' };
const Spin = () => <div className="grid h-24 place-items-center"><span className="h-7 w-7 animate-spin rounded-full border-2 border-cream-200 border-t-army" /></div>;
const Tag = ({ tone = 'neutral', children }) => <span className={cx('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-caption font-semibold', { neutral: 'bg-cream-100 text-ink-soft', good: 'bg-sage-50 text-sage-700', warn: 'bg-[#FBF3E4] text-[#8A6414]', bad: 'bg-[#FBEAE4] text-[#A23B17]', dark: 'bg-army text-onarmy' }[tone])}>{children}</span>;
const amt = (c, cur = 'USD') => (c < 0 ? '−' : '') + money(Math.abs(c || 0), cur);

export default function Admin() {
  const { a } = useStore();
  const [sec, setSec] = useState(() => sessionStorage.getItem('gs_admin') || 'overview');
  const [user, setUser] = useState(null);
  useEffect(() => { try { sessionStorage.setItem('gs_admin', sec); } catch {} }, [sec]);
  if (!a.isAdmin) return <Page crumb="Admin"><Empty icon={<Ic.Shield />} title="Admins only" text="This page is for the Gorilla Squad team." /></Page>;
  const act = async (path, body, msg) => { const r = await a.run(() => api(path, { method: 'POST', body: body || {} })); if (r) a.toast(msg); return r; };
  return (
    <Page crumb="Admin">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-army text-sage"><Ic.Shield width="20" height="20" /></span><h1 className="font-serif text-title">Console</h1></div>
        <Tabs value={sec} onChange={setSec} items={SECTIONS} />
        {sec === 'overview' && <Overview go={setSec} />}
        {sec === 'queues' && <Queues act={act} />}
        {sec === 'users' && <Table name="users" filters={[['', 'All'], ['sellers', 'Sellers'], ['creators', 'Creators'], ['admin', 'Admins'], ['blocked', 'Blocked'], ['deleted', 'Deleted']]}
          head={['Person', 'Role', 'Wallet', 'Joined']} row={(r) => [<><b className="block truncate">{r.display_name || r.email}</b>{r.display_name && <span className="block truncate text-caption text-ink-soft">{r.email}</span>}</>,
            <span className="flex flex-wrap gap-1">{r.role === 'admin' && <Tag tone="dark">Admin</Tag>}{r.seller_id && <Tag>Seller</Tag>}{r.marketer_id && <Tag>Creator</Tag>}{r.is_blocked ? <Tag tone="bad">Blocked</Tag> : null}{r.is_deleted ? <Tag tone="bad">Deleted</Tag> : null}</span>,
            <span className="tnum">{money(r.balance_cents || 0)}</span>, day(r.created_at)]} onOpen={(r) => setUser(r.id)} />}
        {sec === 'offers' && <Table name="offers" filters={[['', 'All'], ['open', 'Open'], ['paused', 'Paused'], ['closed', 'Closed'], ['blocked', 'Blocked'], ['deleted', 'Deleted']]}
          head={['Offer', 'Seller', 'Activity', '']} row={(r, reload) => [<><b className="block truncate">{r.title}</b><span className="block truncate text-caption text-ink-soft">{r.type} · {r.product}{r.job_budget_cents ? ' · ' + money(r.job_budget_cents, r.currency) + ' per creator' : ''}</span></>,
            <button className="truncate text-left text-small hover:underline" onClick={(e) => { e.stopPropagation(); setUser(r.seller_user_id); }}>{r.seller}</button>,
            <span className="flex flex-wrap gap-1">{r.is_blocked ? <Tag tone="bad">Removed</Tag> : r.is_deleted ? <Tag tone="bad">Deleted</Tag> : <Tag tone={r.status === 'open' ? 'good' : 'neutral'}>{r.status}</Tag>}<Tag>{r.pending} waiting</Tag><Tag>{r.deals} deals</Tag></span>,
            <span className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>{r.is_blocked ? <Button size="sm" tone="secondary" onClick={async () => (await act(`/admin/squad/offers/${r.id}`, { action: 'unblock' }, 'Restored')) && reload()}>Restore</Button> : <Button size="sm" tone="danger" onClick={async () => (await act(`/admin/squad/offers/${r.id}`, { action: 'block' }, 'Removed from the feed')) && reload()}>Remove</Button>}</span>]}
          onOpen={(r) => go('offer/' + r.id)} />}
        {sec === 'socials' && <Table name="socials" filters={[['', 'All'], ['waiting', 'Waiting for a check'], ['verified', 'Verified'], ['unverified', 'Not verified'], ['blocked', 'Blocked']]}
          head={['Account', 'Owner', 'Followers', '']} row={(r, reload) => [<><b className="block truncate">{platName(r.platform)} · {r.url ? <a className="underline" href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>@{r.handle}</a> : '@' + r.handle}</b><span className="block text-caption text-ink-soft">{r.is_verified ? 'Verified' : r.verify_requested_at ? 'Look for ' : 'Code '}{!r.is_verified && r.verify_code ? <b className="font-mono text-ink">{r.verify_code}</b> : null}</span></>,
            <button className="truncate text-left text-small hover:underline" onClick={(e) => { e.stopPropagation(); setUser(r.owner_user_id); }}>{r.owner}</button>,
            <span className="tnum text-small">{(r.verified_followers ?? r.followers).toLocaleString()} {r.is_verified ? 'verified' : 'claimed'}</span>,
            <span className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>{r.is_verified ? <Button size="sm" tone="secondary" onClick={async () => (await act(`/admin/squad/socials/${r.id}`, { action: 'unverify' }, 'Unverified')) && reload()}>Unverify</Button>
              : <Button size="sm" onClick={async () => (await act(`/admin/squad/socials/${r.id}`, { action: 'verify', note: 'checked by admin' }, 'Verified')) && reload()}>Verify</Button>}</span>]} />}
        {sec === 'deals' && <Table name="deals" filters={[['', 'All'], ['active', 'Active'], ['held', 'Money held'], ['ended', 'Ended']]}
          head={['Deal', 'People', 'Money', '']} row={(r, reload) => [<><b className="block truncate">{r.offer}</b><span className="text-caption text-ink-soft">{day(r.created_at)}</span></>,
            <span className="block truncate text-small">{r.seller} → {r.creator}</span>,
            r.hold_id ? <span className="flex items-center gap-2"><span className="tnum">{money(r.hold_cents, r.currency)}</span><Tag tone={r.hold_status === 'held' ? 'warn' : r.hold_status === 'released' ? 'good' : 'neutral'}>{r.hold_status === 'held' ? 'Held' : r.hold_status === 'released' ? 'Paid' : 'Refunded'}</Tag></span> : <span className="text-caption text-ink-faint">No hold</span>,
            <span className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>{r.hold_status === 'held' && <><Button size="sm" tone="secondary" onClick={async () => (await act(`/admin/squad/holds/${r.hold_id}/refund`, {}, 'Refunded to the seller')) && reload()}>Refund</Button><Button size="sm" onClick={async () => (await act(`/admin/squad/holds/${r.hold_id}/release`, {}, 'Paid to the creator')) && reload()}>Job done</Button></>}</span>]}
          onOpen={(r) => go('chats/' + r.id)} />}
        {sec === 'transactions' && <Table name="transactions" filters={[['', 'All'], ['topup', 'Top-ups'], ['hold', 'Holds & fees'], ['earning', 'Job done'], ['payout', 'Withdrawals'], ['refund', 'Refunds'], ['adjust', 'Adjustments']]}
          head={['What', 'Who', 'Amount', 'When']} row={(r) => [<><b className="block">{KIND[r.kind] || r.kind}</b><span className="block truncate text-caption text-ink-soft">{r.note}</span></>,
            <button className="truncate text-left text-small hover:underline" onClick={(e) => { e.stopPropagation(); setUser(r.user_id); }}>{r.email}</button>,
            <b className={cx('tnum', r.amount_cents > 0 && 'text-sage-700')}>{(r.amount_cents > 0 ? '+' : '') + amt(r.amount_cents, r.currency)}</b>, day(r.created_at)]} />}
      </div>
      <UserSheet id={user} onClose={() => setUser(null)} act={act} />
    </Page>
  );
}

/* which provider takes top-ups. Only providers with a key on the server can be picked; new top-ups use the switch at once. */
const PNAME = { stripe: 'Stripe', bachs: 'Bachs', manual: 'Manual (admin credits)' };
function Payments() {
  const { a } = useStore();
  const [d, setD] = useState(null);
  const load = () => api('/admin/squad/settings/payments').then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return null;
  const pick = async (k) => { if (k !== d.active && await a.run(() => api('/admin/squad/settings/payments', { method: 'POST', body: { provider: k } }))) { a.toast('Top-ups now use ' + PNAME[k]); load(); } };
  return (
    <Card title="Payments" sub="Which provider takes wallet top-ups. Switching affects new top-ups only.">
      <ul className="-my-2">{d.available.map((p, i) => (
        <li key={p.key} className={cx('flex items-center gap-3 py-3', i && 'border-t border-cream-100')}>
          <div className="min-w-0 flex-1"><b>{PNAME[p.key]}</b><div className="text-caption text-ink-soft">{p.key === 'manual' ? 'A reference to pay; an admin credits it' : !p.ready ? 'No API key on the server' : p.webhooks ? 'Ready' : 'Key set, webhook secret missing'}</div></div>
          {d.active === p.key ? <Tag tone="good">Active</Tag> : <Button size="sm" tone="secondary" disabled={!p.ready} onClick={() => pick(p.key)}>Use</Button>}
        </li>))}</ul>
    </Card>
  );
}

function Overview({ go: to }) {
  const [d, setD] = useState(null);
  useEffect(() => { api('/admin/squad/overview').then(setD).catch(() => {}); }, []);
  if (!d) return <Spin />;
  const tiles = [
    ['Users', d.users.n, (d.users.week || 0) + ' new this week', 'users'], ['Sellers', d.sellers.n, null, 'users'], ['Creators', d.creators.n, (d.creators.verified || 0) + ' verified', 'users'],
    ['Open offers', d.offers.open || 0, d.offers.n + ' in total', 'offers'], ['Applications waiting', d.applications.n, null, 'offers'], ['Active deals', d.deals.active || 0, d.deals.n + ' in total', 'deals'],
    ['In wallets', money(d.in_wallets), null, 'transactions'], ['Held in jobs', money(d.held.cents), d.held.n + ' jobs', 'queues'],
    ['Top-ups waiting', d.topups.n, money(d.topups.cents), 'queues'], ['Payouts waiting', d.payouts.n, money(d.payouts.cents), 'queues'], ['Account checks', d.checks.n, null, 'queues'], ['Admins', d.admins.n, null, 'users'],
  ];
  return <div className="flex flex-col gap-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{tiles.map(([l, v, sub, sec]) => <button key={l} onClick={() => to(sec)} className="rounded-card bg-paper p-4 text-left transition hover:bg-cream-100"><div className="text-caption font-semibold uppercase tracking-wider text-ink-faint">{l}</div><div className="tnum mt-2 text-title">{v}</div>{sub && <div className="mt-1 text-caption text-ink-soft">{sub}</div>}</button>)}</div>
    <Payments />
  </div>;
}

/* a searchable, filterable table. On a phone each row is a card. */
function Table({ name, head, row, filters, onOpen }) {
  const [q, setQ] = useState(''), [st, setSt] = useState(''), [rows, setRows] = useState(null), [next, setNext] = useState(null), [n, setN] = useState(0);
  const load = async (more) => {
    const r = await api(`/admin/squad/table/${name}?limit=50${q.trim() ? '&q=' + encodeURIComponent(q.trim()) : ''}${st ? '&status=' + st : ''}${more && next ? '&before=' + next : ''}`).catch(() => null);
    if (!r) return setRows([]);
    setRows((x) => (more ? [...(x || []), ...r.rows] : r.rows)); setNext(r.next);
  };
  useEffect(() => { const t = setTimeout(() => load(false), q ? 300 : 0); return () => clearTimeout(t); }, [q, st, n]);
  const reload = () => setN((x) => x + 1);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-72"><Input pre={<Ic.Search width="18" height="18" className="text-ink-faint" />} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="no-scrollbar -mx-1 overflow-x-auto px-1"><Pills value={st} onChange={setSt} items={filters} /></div>
      </div>
      <Card pad={false} className="overflow-hidden">
        {!rows ? <Spin /> : !rows.length ? <div className="p-6"><Empty icon={<Ic.Search />} title="Nothing found" text="Try another search or filter." /></div> : <>
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_auto] gap-4 border-b border-cream-100 px-5 py-3 text-caption font-semibold uppercase tracking-wider text-ink-faint md:grid">{head.map((h, i) => <span key={i} className={i === 3 ? 'text-right' : ''}>{h}</span>)}</div>
          {rows.map((r, i) => { const cells = row(r, reload); return (
            <div key={r.id} role={onOpen ? 'button' : undefined} onClick={() => onOpen?.(r)} className={cx('flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_auto] md:gap-4', i && 'border-t border-cream-100', onOpen && 'cursor-pointer hover:bg-cream-50')}>
              {cells.map((c, j) => <div key={j} className={cx('min-w-0', j === 0 ? 'w-full md:w-auto' : j === 3 ? 'ml-auto md:text-right' : 'max-w-full text-small')}>{c}</div>)}
            </div>); })}
          {next && <button onClick={() => load(true)} className="w-full border-t border-cream-100 py-3 text-small font-semibold text-sage-700 hover:bg-cream-50">Load more</button>}
        </>}
      </Card>
    </div>
  );
}

function Queues({ act }) {
  const [d, setD] = useState(null), [tab, setTab] = useState('jobs');
  const load = () => api('/admin/squad/money').then(setD).catch(() => setD({ holds: [], topups: [], payouts: [], checks: [] }));
  useEffect(() => { load(); }, []);
  const B = (label, path, body, msg, tone) => <Button size="sm" tone={tone} onClick={async () => (await act(path, body, msg)) && load()}>{label}</Button>;
  const item = (key, i, main, sub, actions) => <li key={key} className={cx('flex flex-col gap-3 py-4 sm:flex-row sm:items-center', i && 'border-t border-cream-100')}><div className="min-w-0 flex-1"><div className="font-semibold">{main}</div><div className="text-small text-ink-soft">{sub}</div></div><div className="flex gap-2">{actions}</div></li>;
  const lists = d && {
    jobs: d.holds.map((h, i) => item(h.id, i, <>{money(h.amount_cents, h.currency)} · {h.offer_title}</>, <>{h.seller} → {h.other} · held {day(h.created_at)}</>, <>{B('Refund', `/admin/squad/holds/${h.id}/refund`, {}, 'Refunded to the seller', 'secondary')}{B('Job done', `/admin/squad/holds/${h.id}/release`, {}, 'Paid to the creator')}</>)),
    topups: d.topups.map((t, i) => item(t.id, i, <>{money(t.amount_cents, t.currency)} · <span className="font-mono">{t.reference}</span></>, <>{t.who} · {day(t.created_at)}</>, <>{B('Cancel', `/admin/squad/topups/${t.id}/cancel`, {}, 'Cancelled', 'secondary')}{B('Money received', `/admin/squad/topups/${t.id}/credit`, {}, 'Wallet credited')}</>)),
    payouts: d.payouts.map((p, i) => item(p.id, i, <>{money(p.amount_cents, p.currency)} · {p.method === 'mobile_money' ? 'Mobile money' : p.method}</>, <>{p.who} · {p.details}</>, <>{B('Cancel', `/admin/squad/payouts/${p.id}/cancel`, {}, 'Returned to their wallet', 'secondary')}{B('Sent', `/admin/squad/payouts/${p.id}/paid`, {}, 'Marked paid')}</>)),
    accounts: d.checks.map((s, i) => item(s.id, i, <>{platName(s.platform)} · {s.url ? <a className="underline" href={s.url} target="_blank" rel="noreferrer">@{s.handle}</a> : '@' + s.handle}</>, <>{s.who} · look for <b className="font-mono text-ink">{s.verify_code}</b> · {s.followers.toLocaleString()} followers claimed</>, <>{B('Not found', `/admin/squad/socials/${s.id}`, { action: 'unverify' }, 'Request cleared', 'secondary')}{B('Verify', `/admin/squad/socials/${s.id}`, { action: 'verify', note: 'bio code found' }, 'Account verified')}</>)),
  };
  const n = (k) => d?.[{ jobs: 'holds', topups: 'topups', payouts: 'payouts', accounts: 'checks' }[k]]?.length || 0;
  return (<>
    <Pills value={tab} onChange={setTab} items={[['jobs', 'Jobs · ' + n('jobs')], ['topups', 'Top-ups · ' + n('topups')], ['payouts', 'Payouts · ' + n('payouts')], ['accounts', 'Account checks · ' + n('accounts')]]} />
    <Card>{!d ? <Spin /> : lists[tab].length ? <ul className="-my-4">{lists[tab]}</ul> : <Empty icon={<Ic.Check />} title="All clear" text="Nothing waiting here." />}</Card>
  </>);
}

/* one person in full, with every action */
function UserSheet({ id, onClose, act }) {
  const { a } = useStore();
  const [d, setD] = useState(null), [adj, setAdj] = useState({ amount: '', note: '' }), [n, setN] = useState(0);
  useEffect(() => { if (!id) return; setD(null); api('/admin/squad/users/' + id).then(setD).catch(() => setD(false)); }, [id, n]);
  const reload = () => setN((x) => x + 1);
  const u = d?.user, bal = d?.balance?.USD || 0;
  const doAdj = async (sign) => {
    const c = Math.round((+adj.amount || 0) * 100) * sign;
    if (!c) return a.toast('Enter an amount');
    if (adj.note.trim().length < 3) return a.toast('Add a reason');
    if (await act(`/admin/squad/users/${id}/adjust`, { amount_cents: c, currency: 'USD', note: adj.note.trim() }, sign > 0 ? 'Wallet credited' : 'Wallet debited')) { setAdj({ amount: '', note: '' }); reload(); }
  };
  const toggle = (path, on, offMsg, onMsg) => act(path, { action: on }, on.startsWith('un') || on === 'restore' ? onMsg : offMsg).then((r) => r && reload());
  return (
    <Sheet open={!!id} onClose={onClose} title={u ? u.display_name || u.email : 'Person'} sub={u ? u.email + ' · joined ' + day(u.created_at) : ''}>
      {d === null ? <Spin /> : d === false ? <p className="text-small">Could not load this person.</p> : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-1.5">{u.role === 'admin' && <Tag tone="dark">Admin</Tag>}{d.seller && <Tag>Seller</Tag>}{d.marketer && <Tag>Creator{d.marketer.country ? ' · ' + d.marketer.country : ''}</Tag>}{u.is_verified && <Tag tone="good">Verified</Tag>}{u.is_blocked && <Tag tone="bad">Blocked</Tag>}{u.is_deleted && <Tag tone="bad">Deleted</Tag>}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" tone="secondary" onClick={() => act(`/admin/squad/users/${id}/role`, { role: u.role === 'admin' ? 'user' : 'admin' }, u.role === 'admin' ? 'No longer an admin' : 'Now an admin').then((r) => r && reload())}>{u.role === 'admin' ? 'Remove admin' : 'Make admin'}</Button>
            <Button size="sm" tone="secondary" onClick={() => toggle(`/admin/squad/users/${id}`, u.is_verified ? 'unverify' : 'verify', 'Verified', 'Unverified')}>{u.is_verified ? 'Unverify' : 'Verify'}</Button>
            <Button size="sm" tone="danger" onClick={() => toggle(`/admin/squad/users/${id}`, u.is_blocked ? 'unblock' : 'block', 'Blocked and signed out', 'Unblocked')}>{u.is_blocked ? 'Unblock' : 'Block'}</Button>
            <Button size="sm" tone="danger" onClick={() => toggle(`/admin/squad/users/${id}`, u.is_deleted ? 'restore' : 'delete', 'Deleted', 'Restored')}>{u.is_deleted ? 'Restore' : 'Delete'}</Button>
          </div>

          <section><div className="mb-2 flex items-baseline justify-between"><h4 className="font-semibold">Wallet</h4><b className="tnum text-heading">{money(bal)}</b></div>
            <div className="grid grid-cols-[1fr_2fr] gap-2"><Input type="number" step="0.01" pre="$" placeholder="0.00" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} /><Input placeholder="Reason (shown in their history)" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} /></div>
            <div className="mt-2 grid grid-cols-2 gap-2"><Button size="sm" tone="secondary" onClick={() => doAdj(-1)}>Debit</Button><Button size="sm" onClick={() => doAdj(1)}>Credit</Button></div>
            <ul className="mt-3 max-h-64 overflow-y-auto rounded-xl bg-cream-50">{d.entries.length ? d.entries.map((e, i) => <li key={e.id} className={cx('flex items-center gap-3 px-3 py-2 text-small', i && 'border-t border-cream-100')}><span className="min-w-0 flex-1 truncate">{KIND[e.kind] || e.kind}{e.note ? ' · ' + e.note : ''}</span><b className={cx('tnum', e.amount_cents > 0 && 'text-sage-700')}>{(e.amount_cents > 0 ? '+' : '') + amt(e.amount_cents, e.currency)}</b><span className="text-caption text-ink-faint">{day(e.created_at)}</span></li>) : <li className="px-3 py-3 text-small text-ink-soft">No transactions.</li>}</ul>
          </section>

          {d.socials.length > 0 && <section><h4 className="mb-2 font-semibold">Accounts</h4><ul className="flex flex-col gap-2">{d.socials.map((s) => <li key={s.id} className="flex items-center gap-2 rounded-xl bg-cream-50 px-3 py-2 text-small"><span className="min-w-0 flex-1 truncate">{platName(s.platform)} · @{s.handle} · {(s.verified_followers ?? s.followers).toLocaleString()}{!s.is_verified && s.verify_code ? <> · code <b className="font-mono">{s.verify_code}</b></> : null}</span>
            {s.is_verified ? <Tag tone="good">Verified</Tag> : <Button size="sm" onClick={() => act(`/admin/squad/socials/${s.id}`, { action: 'verify', note: 'checked by admin' }, 'Verified').then((r) => r && reload())}>Verify</Button>}</li>)}</ul></section>}

          {d.offers.length > 0 && <section><h4 className="mb-2 font-semibold">Offers</h4><ul className="flex flex-col gap-2">{d.offers.map((o) => <li key={o.id} className="flex items-center gap-2 rounded-xl bg-cream-50 px-3 py-2 text-small"><button className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => go('offer/' + o.id)}>{o.title}</button>
            {o.is_blocked ? <Button size="sm" tone="secondary" onClick={() => act(`/admin/squad/offers/${o.id}`, { action: 'unblock' }, 'Restored').then((r) => r && reload())}>Restore</Button> : <Button size="sm" tone="danger" onClick={() => act(`/admin/squad/offers/${o.id}`, { action: 'block' }, 'Removed').then((r) => r && reload())}>Remove</Button>}</li>)}</ul></section>}

          {d.deals.length > 0 && <section><h4 className="mb-2 font-semibold">Deals</h4><ul className="flex flex-col gap-1">{d.deals.map((r) => <li key={r.id}><button onClick={() => go('chats/' + r.id)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-small hover:bg-cream-50"><span className="min-w-0 flex-1 truncate">{r.offer}</span><Tag>{r.status}</Tag></button></li>)}</ul></section>}
        </div>
      )}
    </Sheet>
  );
}
