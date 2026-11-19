// Gorilla Squad: products sellers want shared, marketers who share them, tracked links, proof, earnings and payouts.
// Mounted on the same Worker as Thebes (the games engine is untouched). Helpers come from worker.js.
//
// Money is in US cents everywhere. Earnings sit "pending" for HOLD_MS so bad clicks can be reversed before they can be paid.

export const MIN_FUND = 1000;            // a campaign needs at least $10 funded before it can go live
export const MIN_PAYOUT = 1000;          // $10 minimum withdrawal
export const ID_CHECK_CENTS = 5000;      // payouts above $50 are held until the admin has checked an ID
export const HOLD_MS = 7 * 86400000;     // earnings are pending for a week
export const DEDUPE_MS = 86400000;       // the same device on the same link within 24h does not count again
export const LISTING_FREE = 2;           // every company starts with two free listings
export const LISTING_FEE_CENTS = 2900;   // later listings are paid; Stripe comes later
export const DEFAULT_PLATFORM_FEE_BPS = 1000; // 10% commission on every paid result
const CHANNELS = ['online', 'offline', 'x', 'youtube', 'instagram', 'tiktok', 'whatsapp'];
const BOT = /bot|crawl|spider|slurp|headless|curl|wget|python|go-http|preview|monitor/i;
const HOSTING = /hosting|cloud|vpn|proxy|datacenter|data center|digitalocean|hetzner|linode|vultr|ovh|choopa|m247|leaseweb/i;

export function squadRoutes(app, h) {
  const { needUser, needAdmin, needMember, fail, uid, now, rand, sha, json } = h;
  const DAY = 86400000;
  const isUrl = (s) => { try { const u = new URL(String(s)); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; } };
  const money = (n) => Math.round(Number(n) || 0);
  const REWARD_RULES = ['click', 'signup', 'snippet'];
  const countryOf = (u) => (u.country || '').toUpperCase();
  const launchCountries = (c) => String(c.env.SQUAD_COUNTRIES || 'US').toUpperCase().split(',').map((s) => s.trim()).filter(Boolean);
  const allowedCountry = (c, cc) => launchCountries(c).includes(String(cc || '').toUpperCase());
  const allowedLocation = (c, loc) => {
    if (loc === '*') return true;
    return allowedCountry(c, String(loc).split(':')[0]);
  };
  const feeFor = (r) => Math.ceil((Number(r.reward_cents) || 0) * (Number(r.platform_fee_bps ?? DEFAULT_PLATFORM_FEE_BPS) || 0) / 10000);
  const costFor = (r) => (Number(r.reward_cents) || 0) + feeFor(r);
  const marketerOk = (u) => !!u && (u.role === 'admin' || u.squad_status === 'approved');

  // locations: "US" (a whole country), "US:Austin" (one city), or "*" (everywhere)
  const locMatch = (locs, country, city) => {
    if (!locs || !locs.length) return false;
    if (locs.includes('*')) return true;
    return locs.some((l) => {
      const [cc, ct] = String(l).split(':');
      if (cc.toUpperCase() !== country) return false;
      return !ct || (city || '').toLowerCase() === ct.toLowerCase();
    });
  };

  const campaignOut = (r, extra = {}) => ({
    id: r.id, title: r.title, snippet: r.snippet, reward_rule: r.reward_rule, reward_cents: r.reward_cents,
    locations: json(r.locations, []), status: r.status, budget_cents: r.budget_cents, spent_cents: r.spent_cents,
    left_cents: Math.max(0, r.budget_cents - r.spent_cents), company: r.company, company_slug: r.company_slug, company_id: r.company_id,
    image: r.image_key ? '/files/' + r.image_key : null, created_at: r.created_at,
    platform_fee_bps: r.platform_fee_bps ?? DEFAULT_PLATFORM_FEE_BPS, fee_cents: feeFor(r),
    affiliate_network: r.affiliate_network || null, paused_reason: r.paused_reason || null,
    target_results: r.target_results || null, ends_at: r.ends_at || null, ...extra,
  });

  const campaignSql = `SELECT k.*, co.name company, co.slug company_slug, a.r2_key image_key FROM campaigns k
    JOIN companies co ON co.id = k.company_id LEFT JOIN assets a ON a.id = k.image_asset_id WHERE k.deleted_at IS NULL`;

  // ---------- marketer profile (sign-up details) ----------
  app.post('/api/me/profile', async (c) => {
    const u = needUser(c), b = await c.req.json().catch(() => ({}));
    const country = String(b.country || '').trim().toUpperCase();
    if (country && !/^[A-Z]{2}$/.test(country)) return fail(c, 400, 'country is a two-letter code, like US or CA');
    const phone = String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
    if (phone && phone.replace(/\D/g, '').length < 7) return fail(c, 400, 'add a phone number with country code, like +1 512 000 0000');
    const city = String(b.city || '').trim().slice(0, 60);
    const name = b.name != null ? String(b.name).trim().slice(0, 60) : null;
    const prefs = b.prefs && typeof b.prefs === 'object' ? { ...json(u.prefs), scope: b.prefs.scope === 'global' ? 'global' : 'local', categories: Array.isArray(b.prefs.categories) ? b.prefs.categories.map((x) => String(x).slice(0, 30)).slice(0, 12) : json(u.prefs).categories || [] } : null;
    await DB(c).prepare('UPDATE users SET city = COALESCE(?, city), country = COALESCE(?, country), phone = COALESCE(?, phone), display_name = COALESCE(?, display_name), prefs = COALESCE(?, prefs), updated_at = ? WHERE id = ?')
      .bind(city || null, country || null, phone || null, name, prefs ? JSON.stringify(prefs) : null, now(), u.id).run();
    return c.json({ ok: true });
  });

  // ---------- marketer onboarding: short form, admin verifies by hand ----------
  const marketerOut = (u) => ({
    id: u.id, status: u.squad_status || 'none', channel: u.squad_channel || null, platform: u.social_platform || null,
    handle: u.social_handle || null, url: u.social_url || null, audience: u.audience || null,
    proof: u.squad_proof || null, note: u.squad_note || null, verified_at: u.squad_verified_at || null,
    country: u.country || null, city: u.city || null, phone: u.phone || null,
  });

  app.get('/api/squad/marketer', async (c) => {
    const u = needUser(c);
    return c.json({ marketer: marketerOut(u), countries: launchCountries(c) });
  });

  app.post('/api/squad/marketer/apply', async (c) => {
    const u = needUser(c), b = await c.req.json().catch(() => ({}));
    const country = String(b.country || '').trim().toUpperCase();
    if (!allowedCountry(c, country)) return fail(c, 400, `we are only onboarding marketers in ${launchCountries(c).join(', ')} for now`);
    const city = String(b.city || '').trim().slice(0, 60);
    const phone = String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
    if (!city) return fail(c, 400, 'add your city');
    if (phone.replace(/\D/g, '').length < 7) return fail(c, 400, 'add a phone number with country code');
    const channel = b.channel === 'offline' ? 'offline' : 'online';
    const platform = channel === 'online' ? String(b.platform || '').toLowerCase().trim() : 'offline';
    if (channel === 'online' && !['x', 'youtube', 'instagram', 'tiktok', 'whatsapp'].includes(platform)) return fail(c, 400, 'choose X, YouTube, Instagram, TikTok or WhatsApp');
    const url = String(b.url || '').trim().slice(0, 300);
    const handle = String(b.handle || '').trim().replace(/^@/, '').slice(0, 80);
    if (channel === 'online' && !handle && !isUrl(url)) return fail(c, 400, 'add your profile handle or profile link');
    if (url && !isUrl(url)) return fail(c, 400, 'the profile link must start with https://');
    const proof = String(b.proof || '').trim().slice(0, 500);
    const audience = String(b.audience || '').trim().slice(0, 80);
    await DB(c).prepare(`UPDATE users SET country = ?, city = ?, phone = ?, squad_channel = ?, social_platform = ?,
      social_handle = ?, social_url = ?, audience = ?, squad_proof = ?, squad_status = 'verifying', squad_note = NULL, updated_at = ? WHERE id = ?`)
      .bind(country, city, phone, channel, platform, handle || null, url || null, audience || null, proof || null, now(), u.id).run();
    const fresh = await DB(c).prepare('SELECT * FROM users WHERE id = ?').bind(u.id).first();
    return c.json({ ok: true, marketer: marketerOut(fresh) });
  });

  // ---------- the board: live campaigns, local or global ----------
  app.get('/api/squad/board', async (c) => {
    const u = c.get('user') || null;
    const scope = c.req.query('scope') === 'global' ? 'global' : 'local';
    const country = (c.req.query('country') || (u && countryOf(u)) || '').toUpperCase();
    const city = c.req.query('city') || (u && u.city) || '';
    const rows = (await DB(c).prepare(`${campaignSql} AND k.status = 'live' ORDER BY k.created_at DESC LIMIT 200`).all()).results;
    const mine = u ? new Map((await DB(c).prepare('SELECT campaign_id, code FROM campaign_links WHERE marketer_id = ?').bind(u.id).all()).results.map((l) => [l.campaign_id, l.code])) : new Map();
    const list = rows
      .filter((r) => r.budget_cents - r.spent_cents >= costFor(r))
      .filter((r) => scope === 'global' || locMatch(json(r.locations, []), country, city))
      .map((r) => campaignOut(r, { my_code: mine.get(r.id) || null }));
    return c.json({ scope, country: country || null, city: city || null, campaigns: list });
  });

  app.get('/api/squad/campaigns/:id', async (c) => {
    const id = c.req.param('id');
    const r = await DB(c).prepare(`${campaignSql} AND k.id = ?`).bind(id).first();
    if (!r) return fail(c, 404, 'no such campaign');
    const u = c.get('user') || null;
    let owner = false;
    if (u) owner = !!(u.role === 'admin' || await h.memberRole(DB(c), r.company_id, u.id));
    if (r.status !== 'live' && !owner) return fail(c, 404, 'no such campaign');
    // the product link stays hidden: marketers only ever get their own tracked link
    return c.json({ campaign: campaignOut(r, owner ? { product_url: r.product_url, postback_key: r.postback_key } : {}) });
  });

  // ---------- sellers: create, edit, submit ----------
  app.post('/api/squad/campaigns', async (c) => {
    const u = needUser(c), b = await c.req.json().catch(() => ({})), t = now();
    const company = String(b.company_id || '');
    await needMember(c, company, 'editor');
    const title = String(b.title || '').trim().slice(0, 80);
    if (title.length < 3) return fail(c, 400, 'give the product a short name');
    if (!isUrl(b.product_url)) return fail(c, 400, 'paste the product or affiliate link (starts with https://)');
    const snippet = String(b.snippet || '').trim();
    if (snippet.length < 10 || snippet.length > 500) return fail(c, 400, 'the pitch should be 10 to 500 characters');
    if (!REWARD_RULES.includes(b.reward_rule)) return fail(c, 400, 'reward is per click, per sign-up or per snippet');
    const reward = money(b.reward_cents);
    if (reward < 1 || reward > 100000) return fail(c, 400, 'the reward is between $0.01 and $1,000');
    const locs = Array.isArray(b.locations) ? b.locations.map((x) => String(x).trim()).filter(Boolean).slice(0, 50) : [];
    if (!locs.length) return fail(c, 400, 'pick where it can be shared: a country, a city, or everywhere');
    if (!locs.every((l) => allowedLocation(c, l))) return fail(c, 400, `we are only live in ${launchCountries(c).join(', ')} for now`);
    const target = b.target_results != null && Number(b.target_results) > 0 ? Math.min(1000000, Math.round(Number(b.target_results))) : null;
    const id = uid('cg');
    await DB(c).prepare(`INSERT INTO campaigns (id, company_id, title, product_url, snippet, image_asset_id, reward_rule, reward_cents, locations, postback_key, target_results, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`)
      .bind(id, company, title, String(b.product_url).trim(), snippet, b.image_asset_id || null, b.reward_rule, reward, JSON.stringify(locs), rand(16), target, u.id, t, t).run();
    return c.json({ id });
  });

  app.patch('/api/squad/campaigns/:id', async (c) => {
    const id = c.req.param('id'), b = await c.req.json().catch(() => ({})), t = now();
    const r = await DB(c).prepare('SELECT * FROM campaigns WHERE id = ? AND deleted_at IS NULL').bind(id).first();
    if (!r) return fail(c, 404, 'no such campaign');
    await needMember(c, r.company_id, 'editor');
    if (!['draft', 'paused'].includes(r.status)) return fail(c, 409, 'pause the campaign before you change it');
    const next = {
      title: b.title != null ? String(b.title).trim().slice(0, 80) : r.title,
      product_url: b.product_url != null ? (isUrl(b.product_url) ? String(b.product_url).trim() : null) : r.product_url,
      snippet: b.snippet != null ? String(b.snippet).trim() : r.snippet,
      reward_rule: b.reward_rule != null ? b.reward_rule : r.reward_rule,
      reward_cents: b.reward_cents != null ? money(b.reward_cents) : r.reward_cents,
      locations: b.locations != null ? JSON.stringify(b.locations.map((x) => String(x).trim()).filter(Boolean).slice(0, 50)) : r.locations,
      image_asset_id: b.image_asset_id !== undefined ? b.image_asset_id : r.image_asset_id,
      target_results: b.target_results !== undefined ? (Number(b.target_results) > 0 ? Math.min(1000000, Math.round(Number(b.target_results))) : null) : r.target_results,
    };
    if (!next.product_url) return fail(c, 400, 'paste the product link (starts with https://)');
    if (next.snippet.length < 10 || next.snippet.length > 500) return fail(c, 400, 'the pitch should be 10 to 500 characters');
    if (!REWARD_RULES.includes(next.reward_rule)) return fail(c, 400, 'reward is per click, per sign-up or per snippet');
    if (next.reward_cents < 1 || next.reward_cents > 100000) return fail(c, 400, 'the reward is between $0.01 and $1,000');
    if (!json(next.locations, []).every((l) => allowedLocation(c, l))) return fail(c, 400, `we are only live in ${launchCountries(c).join(', ')} for now`);
    await DB(c).prepare('UPDATE campaigns SET title = ?, product_url = ?, snippet = ?, reward_rule = ?, reward_cents = ?, locations = ?, image_asset_id = ?, target_results = ?, updated_at = ? WHERE id = ?')
      .bind(next.title, next.product_url, next.snippet, next.reward_rule, next.reward_cents, next.locations, next.image_asset_id, next.target_results, t, id).run();
    return c.json({ ok: true });
  });

  // a seller sends the campaign to review once it has money in (admins check the listing and the funds)
  app.post('/api/squad/campaigns/:id/submit', async (c) => {
    const id = c.req.param('id');
    const r = await DB(c).prepare('SELECT * FROM campaigns WHERE id = ? AND deleted_at IS NULL').bind(id).first();
    if (!r) return fail(c, 404, 'no such campaign');
    await needMember(c, r.company_id, 'editor');
    if (r.budget_cents < MIN_FUND) return fail(c, 402, `fund at least $${MIN_FUND / 100} first. Payments are confirmed by hand for now.`, 'unfunded');
    if (!['draft', 'paused'].includes(r.status)) return fail(c, 409, 'this campaign is already in review or live');
    await DB(c).prepare("UPDATE campaigns SET status = 'review', updated_at = ? WHERE id = ?").bind(now(), id).run();
    return c.json({ ok: true, status: 'review' });
  });

  // a seller self-publishes with a listing credit (two free per company, admin adds paid ones later)
  app.post('/api/squad/campaigns/:id/publish', async (c) => {
    const id = c.req.param('id'), t = now();
    const r = await DB(c).prepare('SELECT * FROM campaigns WHERE id = ? AND deleted_at IS NULL').bind(id).first();
    if (!r) return fail(c, 404, 'no such campaign');
    await needMember(c, r.company_id, 'editor');
    if (!['draft', 'paused'].includes(r.status)) return fail(c, 409, 'this campaign is already live or in review');
    if (r.budget_cents < MIN_FUND) return fail(c, 402, `fund at least $${MIN_FUND / 100} first`, 'unfunded');
    if (r.budget_cents - r.spent_cents < costFor(r)) return fail(c, 402, 'the budget must cover one reward and its commission', 'unfunded');
    const credit = await DB(c).prepare('UPDATE companies SET listing_credits = listing_credits - 1, updated_at = ? WHERE id = ? AND listing_credits > 0').bind(t, r.company_id).run();
    if (!credit.meta?.changes) return fail(c, 402, `this listing needs a paid listing credit ($${LISTING_FEE_CENTS / 100}). Pay us and an admin adds one.`, 'listing_fee');
    await DB(c).batch([
      DB(c).prepare("INSERT INTO listing_charges (id, company_id, campaign_id, kind, amount_cents, note, created_at) VALUES (?, ?, ?, 'free', 0, 'free listing', ?)").bind(uid('lc'), r.company_id, id, t),
      DB(c).prepare("UPDATE campaigns SET status = 'live', paused_reason = NULL, listing_charge_cents = 0, updated_at = ? WHERE id = ?").bind(t, id),
    ]);
    return c.json({ ok: true, status: 'live' });
  });

  // a marketer's link to a campaign: created once, then reused (one link per person per campaign)
  app.post('/api/squad/campaigns/:id/link', async (c) => {
    const u = needUser(c), id = c.req.param('id'), b = await c.req.json().catch(() => ({}));
    if (!marketerOk(u)) return fail(c, 403, 'your marketer application is still being checked', 'marketer_unverified');
    const r = await DB(c).prepare(`${campaignSql} AND k.id = ?`).bind(id).first();
    if (!r || r.status !== 'live') return fail(c, 404, 'this campaign is not open for sharing');
    if (r.budget_cents - r.spent_cents < costFor(r)) {
      await DB(c).prepare("UPDATE campaigns SET status = 'paused', paused_reason = 'budget', updated_at = ? WHERE id = ? AND status = 'live'").bind(now(), id).run();
      return fail(c, 409, 'this campaign has run out of budget', 'out_of_budget');
    }
    const have = await DB(c).prepare('SELECT code, status FROM campaign_links WHERE campaign_id = ? AND marketer_id = ?').bind(id, u.id).first();
    if (have?.status === 'revoked') return fail(c, 403, 'this link was revoked. Ask an admin for a new one.');
    if (have) return c.json({ code: have.code, url: linkUrl(c, have.code) });
    let code = '';
    for (let i = 0; i < 5 && !code; i++) {
      const cand = rand(4).slice(0, 7);
      if (!(await DB(c).prepare('SELECT 1 FROM campaign_links WHERE code = ?').bind(cand).first())) code = cand;
    }
    if (!code) return fail(c, 500, 'could not make a link, try again');
    const channel = CHANNELS.includes(b.channel) ? b.channel : (u.squad_channel === 'offline' ? 'offline' : 'online');
    await DB(c).prepare('INSERT INTO campaign_links (code, campaign_id, marketer_id, channel, issued_by, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(code, id, u.id, channel, u.id, now()).run();
    return c.json({ code, url: linkUrl(c, code) });
  });

  // ---------- the tracked redirect: gorillasquad.co/s/<code> ----------
  app.get('/s/:code', async (c) => {
    const code = c.req.param('code');
    const row = await DB(c).prepare(`SELECT l.code, l.marketer_id, l.status link_status, l.expires_at, k.id campaign_id, k.product_url, k.status, k.reward_rule, k.reward_cents, k.platform_fee_bps, k.subid_param, k.budget_cents, k.spent_cents, k.deleted_at
      FROM campaign_links l JOIN campaigns k ON k.id = l.campaign_id WHERE l.code = ?`).bind(code).first();
    if (!row) return c.text('This link is not live any more.', 404);
    const ip = c.req.header('cf-connecting-ip') || '0.0.0.0';
    const ua = (c.req.header('user-agent') || '').slice(0, 300);
    const cf = c.req.raw.cf || {};
    const device = await sha('gs-device:' + ip + '|' + ua);
    const id = uid('ck'), t = now(), cost = costFor(row);
    let reason = null;
    if (row.status !== 'live' || row.deleted_at) reason = 'closed';
    else if (row.link_status !== 'active') reason = 'revoked';
    else if (row.expires_at && row.expires_at < t) reason = 'expired';
    else if (!ua || BOT.test(ua)) reason = 'bot';
    else if (HOSTING.test(String(cf.asOrganization || ''))) reason = 'hosting';
    else if (await DB(c).prepare('SELECT 1 FROM clicks WHERE code = ? AND device_hash = ? AND created_at > ? LIMIT 1').bind(code, device, t - DAY).first()) reason = 'duplicate';
    if (!reason && row.budget_cents - row.spent_cents < cost) {
      reason = 'budget';
      await DB(c).prepare("UPDATE campaigns SET status = 'paused', paused_reason = 'budget', updated_at = ? WHERE id = ? AND status = 'live'").bind(t, row.campaign_id).run();
    }
    let verified = reason ? 0 : 1, reward = 0, fee = 0;
    if (verified && row.reward_rule === 'click') {
      const res = await DB(c).prepare('UPDATE campaigns SET spent_cents = spent_cents + ?, updated_at = ? WHERE id = ? AND status = ? AND spent_cents + ? <= budget_cents')
        .bind(cost, t, row.campaign_id, 'live', cost).run();
      if (res.meta?.changes) { reward = row.reward_cents; fee = feeFor(row); }
      else {
        verified = 0; reason = 'budget';
        await DB(c).prepare("UPDATE campaigns SET status = 'paused', paused_reason = 'budget', updated_at = ? WHERE id = ? AND status = 'live'").bind(t, row.campaign_id).run();
      }
    }
    await DB(c).prepare('INSERT INTO clicks (id, code, campaign_id, marketer_id, device_hash, country, verified, reason, reward_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, code, row.campaign_id, row.marketer_id, device, cf.country || null, verified, reason, reward, t).run();
    if (reward) {
      await DB(c).batch([
        DB(c).prepare("INSERT INTO ledger (id, user_id, campaign_id, kind, amount_cents, ref, created_at) VALUES (?, ?, ?, 'click', ?, ?, ?)")
          .bind(uid('l'), row.marketer_id, row.campaign_id, reward, id, t),
        DB(c).prepare("INSERT INTO platform_ledger (id, campaign_id, kind, amount_cents, ref, note, created_at) VALUES (?, ?, 'commission', ?, ?, 'click commission', ?)")
          .bind(uid('pl'), row.campaign_id, fee, id, t),
      ]);
    }
    // the shopper always gets through, with the click id so the seller can report a sign-up
    const dest = new URL(row.product_url);
    dest.searchParams.set(row.subid_param || 'subid', 'gs_' + id);
    dest.searchParams.set('gs_ref', id);
    return new Response(null, { status: 302, headers: { location: dest.toString(), 'cache-control': 'no-store', 'referrer-policy': 'no-referrer-when-downgrade' } });
  });

  // the seller's site reports a sign-up: GET or POST /api/squad/postback?key=<postback_key>&ref=<click id>
  const postback = async (c) => {
    const key = c.req.query('key') || '', ref = c.req.query('ref') || '';
    const k = await DB(c).prepare(`${campaignSql} AND k.postback_key = ?`).bind(key).first();
    if (!k) return fail(c, 404, 'unknown key');
    if (k.reward_rule !== 'signup') return fail(c, 409, 'this campaign pays on clicks, not sign-ups');
    const click = await DB(c).prepare('SELECT * FROM clicks WHERE id = ? AND campaign_id = ? AND verified = 1').bind(ref, k.id).first();
    if (!click) return fail(c, 404, 'no verified click for that reference');
    if (now() - click.created_at > 30 * DAY) return fail(c, 409, 'that click is older than 30 days');
    if (await DB(c).prepare('SELECT 1 FROM conversions WHERE click_id = ?').bind(ref).first()) return c.json({ ok: true, duplicate: true });
    const t = now(), cost = costFor(k), fee = feeFor(k);
    const res = await DB(c).prepare('UPDATE campaigns SET spent_cents = spent_cents + ?, updated_at = ? WHERE id = ? AND spent_cents + ? <= budget_cents')
      .bind(cost, t, k.id, cost).run();
    if (!res.meta?.changes) {
      await DB(c).prepare("UPDATE campaigns SET status = 'paused', paused_reason = 'budget', updated_at = ? WHERE id = ? AND status = 'live'").bind(t, k.id).run();
      return fail(c, 402, 'the budget for this campaign is spent');
    }
    await DB(c).batch([
      DB(c).prepare('INSERT INTO conversions (click_id, campaign_id, marketer_id, reward_cents, created_at) VALUES (?, ?, ?, ?, ?)').bind(ref, k.id, click.marketer_id, k.reward_cents, t),
      DB(c).prepare("INSERT INTO ledger (id, user_id, campaign_id, kind, amount_cents, ref, created_at) VALUES (?, ?, ?, 'signup', ?, ?, ?)").bind(uid('l'), click.marketer_id, k.id, k.reward_cents, ref, t),
      DB(c).prepare("INSERT INTO platform_ledger (id, campaign_id, kind, amount_cents, ref, note, created_at) VALUES (?, ?, 'commission', ?, ?, 'signup commission', ?)").bind(uid('pl'), k.id, fee, ref, t),
    ]);
    return c.json({ ok: true });
  };
  app.get('/api/squad/postback', postback);
  app.post('/api/squad/postback', postback);

  // ---------- proof of a post (per snippet) ----------
  app.post('/api/squad/links/:code/proof', async (c) => {
    const u = needUser(c), code = c.req.param('code'), b = await c.req.json().catch(() => ({}));
    const l = await DB(c).prepare(`SELECT l.*, k.reward_rule, k.reward_cents, k.status FROM campaign_links l JOIN campaigns k ON k.id = l.campaign_id WHERE l.code = ?`).bind(code).first();
    if (!l || l.marketer_id !== u.id) return fail(c, 404, 'no such link of yours');
    if (l.reward_rule !== 'snippet') return fail(c, 409, 'this campaign pays on clicks or sign-ups, not posts');
    if (l.status !== 'live') return fail(c, 409, 'this campaign is not live');
    const post = String(b.post_url || '').trim();
    if (!isUrl(post)) return fail(c, 400, 'paste the link to your post');
    if (await DB(c).prepare('SELECT 1 FROM proofs WHERE campaign_id = ? AND post_url = ?').bind(l.campaign_id, post).first()) return fail(c, 409, 'that post was already sent in');
    const id = uid('pf');
    await DB(c).prepare("INSERT INTO proofs (id, code, campaign_id, marketer_id, post_url, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)").bind(id, code, l.campaign_id, u.id, post, now()).run();
    return c.json({ id, status: 'pending' });
  });

  // ---------- the marketer's dashboard: live counters for each link ----------
  app.get('/api/squad/me/links', async (c) => {
    const u = needUser(c);
    const rows = (await DB(c).prepare(`SELECT l.code, l.channel, l.status link_status, k.id campaign_id, k.title, k.reward_rule, k.reward_cents, k.budget_cents, k.spent_cents, k.status, k.target_results,
        (SELECT COUNT(*) FROM clicks x WHERE x.code = l.code) total, (SELECT COUNT(*) FROM clicks x WHERE x.code = l.code AND x.verified = 1) verified,
        (SELECT COUNT(*) FROM clicks x WHERE x.code = l.code AND x.created_at > ?) today,
        (SELECT COUNT(*) FROM affiliate_conversions ac WHERE ac.code = l.code AND ac.status = 'approved') conversions,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM ledger g WHERE g.user_id = l.marketer_id AND g.campaign_id = k.id AND g.amount_cents > 0) earned
      FROM campaign_links l JOIN campaigns k ON k.id = l.campaign_id WHERE l.marketer_id = ? ORDER BY verified DESC, l.created_at DESC`).bind(now() - DAY, u.id).all()).results;
    return c.json({ links: rows.map((r) => ({ ...r, url: linkUrl(c, r.code), left_cents: Math.max(0, r.budget_cents - r.spent_cents) })) });
  });

  // ---------- wallet: pending vs cleared, the ledger, payouts ----------
  app.get('/api/squad/wallet', async (c) => {
    const u = needUser(c), DB_ = DB(c), t = now();
    const total = (await DB_.prepare('SELECT COALESCE(SUM(amount_cents), 0) n FROM ledger WHERE user_id = ?').bind(u.id).first()).n;
    const pending = (await DB_.prepare('SELECT COALESCE(SUM(amount_cents), 0) n FROM ledger WHERE user_id = ? AND amount_cents > 0 AND created_at > ?').bind(u.id, t - HOLD_MS).first()).n;
    const ledger = (await DB_.prepare('SELECT g.kind, g.amount_cents, g.created_at, k.title campaign FROM ledger g LEFT JOIN campaigns k ON k.id = g.campaign_id WHERE g.user_id = ? ORDER BY g.created_at DESC LIMIT 50').bind(u.id).all()).results;
    const payouts = (await DB_.prepare('SELECT id, amount_cents, method, status, created_at, decided_at FROM payouts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').bind(u.id).all()).results;
    return c.json({ available_cents: total - pending, pending_cents: pending, total_cents: total, min_payout_cents: MIN_PAYOUT, ledger, payouts });
  });

  app.post('/api/squad/payouts', async (c) => {
    const u = needUser(c), b = await c.req.json().catch(() => ({})), t = now();
    const amount = money(b.amount_cents);
    if (amount < MIN_PAYOUT) return fail(c, 400, `the minimum withdrawal is $${MIN_PAYOUT / 100}`);
    if (!['bank', 'paypal', 'usdt'].includes(b.method)) return fail(c, 400, 'choose bank, PayPal or USDT');
    const account = String(b.account || '').trim().slice(0, 200);
    if (account.length < 4) return fail(c, 400, 'add the account details for the payout');
    const pendingRow = await DB(c).prepare('SELECT COALESCE(SUM(amount_cents), 0) total FROM ledger WHERE user_id = ?').bind(u.id).first();
    const pendingEarn = (await DB(c).prepare('SELECT COALESCE(SUM(amount_cents), 0) n FROM ledger WHERE user_id = ? AND amount_cents > 0 AND created_at > ?').bind(u.id, t - HOLD_MS).first()).n;
    const available = pendingRow.total - pendingEarn;
    if (amount > available) return fail(c, 402, 'more than your cleared balance');
    const id = uid('po');
    await DB(c).batch([
      DB(c).prepare("INSERT INTO payouts (id, user_id, amount_cents, method, account, status, created_at) VALUES (?, ?, ?, ?, ?, 'requested', ?)").bind(id, u.id, amount, b.method, account, t),
      DB(c).prepare("INSERT INTO ledger (id, user_id, kind, amount_cents, ref, created_at) VALUES (?, ?, 'payout', ?, ?, ?)").bind(uid('l'), u.id, -amount, id, t),
    ]);
    return c.json({ id, status: 'requested', id_check: amount > ID_CHECK_CENTS });
  });

  // ---------- sellers: their campaigns and what they did ----------
  app.get('/api/squad/mine', async (c) => {
    const u = needUser(c);
    const rows = (await DB(c).prepare(`${campaignSql} AND (k.company_id IN (SELECT company_id FROM company_members WHERE user_id = ?) OR ? = 'admin') ORDER BY k.created_at DESC LIMIT 100`).bind(u.id, u.role).all()).results;
    const out = [];
    for (const r of rows) {
      const s = await DB(c).prepare(`SELECT (SELECT COUNT(*) FROM campaign_links WHERE campaign_id = ?) marketers,
        (SELECT COUNT(*) FROM clicks WHERE campaign_id = ?) clicks, (SELECT COUNT(*) FROM clicks WHERE campaign_id = ? AND verified = 1) verified,
        (SELECT COUNT(*) FROM conversions WHERE campaign_id = ?) signups, (SELECT COUNT(*) FROM proofs WHERE campaign_id = ? AND status = 'approved') posts`)
        .bind(r.id, r.id, r.id, r.id, r.id).first();
      out.push({ ...campaignOut(r, { product_url: r.product_url, postback_key: r.postback_key }), stats: s });
    }
    return c.json({ campaigns: out });
  });

  // ---------- admin: review, funding, proofs, payouts, fraud ----------
  app.get('/api/admin/squad', async (c) => {
    needAdmin(c);
    const t = now();
    const DB_ = DB(c);
    const review = (await DB_.prepare(`${campaignSql} AND k.status = 'review' ORDER BY k.created_at`).all()).results.map((r) => campaignOut(r, { product_url: r.product_url }));
    const live = (await DB_.prepare(`SELECT COUNT(*) n, COALESCE(SUM(budget_cents),0) budget, COALESCE(SUM(spent_cents),0) spent FROM campaigns WHERE status = 'live' AND deleted_at IS NULL`).first());
    const pausedRows = (await DB_.prepare(`${campaignSql} AND k.status IN ('live', 'paused') ORDER BY k.updated_at DESC LIMIT 300`).all()).results;
    const outOfBudget = pausedRows
      .filter((r) => r.status === 'paused' ? r.paused_reason === 'budget' : r.budget_cents - r.spent_cents < costFor(r))
      .map((r) => campaignOut(r, { product_url: r.product_url }));
    const marketers = (await DB_.prepare(`SELECT id, email, handle, display_name, city, country, phone, squad_channel, social_platform,
        social_handle, social_url, audience, squad_proof, squad_status, created_at FROM users WHERE squad_status = 'verifying' ORDER BY created_at LIMIT 200`).all()).results;
    const proofs = (await DB_.prepare(`SELECT p.id, p.post_url, p.created_at, p.campaign_id, k.title, k.reward_cents, u.handle, u.email FROM proofs p JOIN campaigns k ON k.id = p.campaign_id JOIN users u ON u.id = p.marketer_id WHERE p.status = 'pending' ORDER BY p.created_at LIMIT 200`).all()).results;
    const conversions = (await DB_.prepare(`SELECT ac.id, ac.external_id, ac.gross_cents, ac.commission_cents, ac.currency, ac.note, ac.created_at,
        ac.campaign_id, k.title, ac.code, u.handle, u.email FROM affiliate_conversions ac JOIN campaigns k ON k.id = ac.campaign_id
        JOIN users u ON u.id = ac.marketer_id WHERE ac.status = 'pending' ORDER BY ac.created_at LIMIT 200`).all()).results;
    const payouts = (await DB_.prepare(`SELECT p.id, p.amount_cents, p.method, p.account, p.status, p.created_at, u.handle, u.email, u.city, u.country, u.phone FROM payouts p JOIN users u ON u.id = p.user_id WHERE p.status = 'requested' ORDER BY p.created_at LIMIT 200`).all()).results;
    // basic fraud view: marketers whose links mostly fail the checks in the last week
    const fraud = (await DB_.prepare(`SELECT u.id, u.handle, u.email, COUNT(*) total, SUM(CASE WHEN k.verified = 0 THEN 1 ELSE 0 END) rejected,
        SUM(CASE WHEN k.reason = 'duplicate' THEN 1 ELSE 0 END) duplicates, SUM(CASE WHEN k.reason IN ('bot','hosting') THEN 1 ELSE 0 END) suspicious
      FROM clicks k JOIN users u ON u.id = k.marketer_id WHERE k.created_at > ? GROUP BY u.id HAVING total >= 10 AND rejected * 1.0 / total >= 0.3 ORDER BY rejected DESC LIMIT 50`).bind(t - 7 * DAY).all()).results;
    const weekly = (await DB_.prepare('SELECT COALESCE(SUM(amount_cents),0) paid FROM payouts WHERE status = ? AND decided_at > ?').bind('paid', t - 7 * DAY).first()).paid;
    return c.json({ review, live: { campaigns: live.n, budget_cents: live.budget, spent_cents: live.spent }, out_of_budget: outOfBudget,
      marketers, proofs, conversions, payouts, fraud, paid_this_week_cents: weekly, id_check_cents: ID_CHECK_CENTS, countries: launchCountries(c) });
  });

  app.post('/api/admin/squad/campaigns/:id', async (c) => {
    needAdmin(c);
    const id = c.req.param('id'), b = await c.req.json().catch(() => ({})), t = now(), DB_ = DB(c);
    const r = await DB_.prepare('SELECT * FROM campaigns WHERE id = ? AND deleted_at IS NULL').bind(id).first();
    if (!r) return fail(c, 404, 'no such campaign');
    if (b.action === 'fund') {
      const amount = money(b.amount_cents);
      if (amount < 100) return fail(c, 400, 'funding is at least $1');
      await DB_.batch([
        DB_.prepare('INSERT INTO fundings (id, campaign_id, amount_cents, reference, created_at) VALUES (?, ?, ?, ?, ?)').bind(uid('f'), id, amount, String(b.reference || '').slice(0, 120) || null, t),
        DB_.prepare('UPDATE campaigns SET budget_cents = budget_cents + ?, updated_at = ? WHERE id = ?').bind(amount, t, id),
      ]);
    } else if (b.action === 'approve') {
      if (r.budget_cents < MIN_FUND) return fail(c, 402, 'fund the campaign before it goes live');
      if (r.budget_cents - r.spent_cents < costFor(r)) return fail(c, 402, 'the budget must cover one reward and its commission');
      const credit = await DB_.prepare('UPDATE companies SET listing_credits = listing_credits - 1, updated_at = ? WHERE id = ? AND listing_credits > 0').bind(t, r.company_id).run();
      if (!credit.meta?.changes) return fail(c, 402, `this listing needs a paid listing credit ($${LISTING_FEE_CENTS / 100}). Pay us and an admin adds one.`, 'listing_fee');
      await DB_.batch([
        DB_.prepare("INSERT INTO listing_charges (id, company_id, campaign_id, kind, amount_cents, note, created_at) VALUES (?, ?, ?, 'free', 0, 'free listing', ?)").bind(uid('lc'), r.company_id, id, t),
        DB_.prepare("UPDATE campaigns SET status = 'live', paused_reason = NULL, updated_at = ? WHERE id = ?").bind(t, id),
      ]);
    } else if (b.action === 'resume') {
      if (r.budget_cents - r.spent_cents < costFor(r)) return fail(c, 402, 'top up the budget before you resume this campaign');
      await DB_.prepare("UPDATE campaigns SET status = 'live', paused_reason = NULL, updated_at = ? WHERE id = ?").bind(t, id).run();
    } else if (b.action === 'pause') await DB_.prepare("UPDATE campaigns SET status = 'paused', paused_reason = 'admin', updated_at = ? WHERE id = ?").bind(t, id).run();
    else if (b.action === 'end') await DB_.prepare("UPDATE campaigns SET status = 'ended', updated_at = ? WHERE id = ?").bind(t, id).run();
    else if (b.action === 'affiliate') {
      const url = String(b.product_url || r.product_url).trim();
      if (!isUrl(url)) return fail(c, 400, 'the affiliate or product link must start with https://');
      const network = String(b.affiliate_network || '').trim().slice(0, 60) || null;
      const ref = String(b.affiliate_ref || '').trim().slice(0, 120) || null;
      const subid = String(b.subid_param || 'subid').trim().slice(0, 30) || 'subid';
      const bps = b.platform_fee_bps != null ? Math.max(0, Math.min(5000, money(b.platform_fee_bps))) : (r.platform_fee_bps ?? DEFAULT_PLATFORM_FEE_BPS);
      await DB_.prepare('UPDATE campaigns SET product_url = ?, affiliate_network = ?, affiliate_ref = ?, subid_param = ?, platform_fee_bps = ?, updated_at = ? WHERE id = ?')
        .bind(url, network, ref, subid, bps, t, id).run();
    }
    else return fail(c, 400, 'actions: fund, approve, resume, pause, end, affiliate');
    return c.json({ ok: true });
  });

  app.post('/api/admin/squad/marketers/:id', async (c) => {
    needAdmin(c);
    const id = c.req.param('id'), b = await c.req.json().catch(() => ({})), t = now(), admin = needUser(c);
    const u = await DB(c).prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    if (!u) return fail(c, 404, 'no such marketer');
    if (b.action === 'approve') {
      await DB(c).prepare("UPDATE users SET squad_status = 'approved', squad_note = ?, squad_verified_at = ?, squad_verified_by = ?, updated_at = ? WHERE id = ?")
        .bind(String(b.note || '').slice(0, 300) || null, t, admin.id, t, id).run();
    } else if (b.action === 'reject' || b.action === 'suspend') {
      await DB(c).prepare("UPDATE users SET squad_status = ?, squad_note = ?, updated_at = ? WHERE id = ?")
        .bind(b.action === 'reject' ? 'rejected' : 'suspended', String(b.note || '').slice(0, 300) || null, t, id).run();
    } else return fail(c, 400, 'actions: approve, reject, suspend');
    return c.json({ ok: true, status: b.action === 'approve' ? 'approved' : (b.action === 'reject' ? 'rejected' : 'suspended') });
  });

  app.post('/api/admin/squad/companies/:id/credits', async (c) => {
    needAdmin(c);
    const id = c.req.param('id'), b = await c.req.json().catch(() => ({})), t = now();
    const count = Math.round(Number(b.count || 1));
    if (!(count >= 1 && count <= 100)) return fail(c, 400, 'add between 1 and 100 listing credits');
    const co = await DB(c).prepare('SELECT * FROM companies WHERE id = ? AND deleted_at IS NULL').bind(id).first();
    if (!co) return fail(c, 404, 'no such company');
    const amount = money(b.amount_cents);
    await DB(c).prepare('UPDATE companies SET listing_credits = listing_credits + ?, updated_at = ? WHERE id = ?').bind(count, t, id).run();
    if (amount > 0) await DB(c).prepare("INSERT INTO platform_ledger (id, kind, amount_cents, ref, note, created_at) VALUES (?, 'listing', ?, ?, ?, ?)")
      .bind(uid('pl'), amount, id, `${count} listing credit${count === 1 ? '' : 's'}`, t).run();
    return c.json({ ok: true, listing_credits: co.listing_credits + count });
  });

  app.post('/api/admin/squad/campaigns/:id/links', async (c) => {
    needAdmin(c);
    const id = c.req.param('id'), b = await c.req.json().catch(() => ({})), t = now(), admin = needUser(c);
    const campaign = await DB(c).prepare('SELECT * FROM campaigns WHERE id = ? AND deleted_at IS NULL').bind(id).first();
    if (!campaign) return fail(c, 404, 'no such campaign');
    if (campaign.status !== 'live') return fail(c, 409, 'the campaign must be live before a link is sent');
    const user = b.user_id
      ? await DB(c).prepare('SELECT * FROM users WHERE id = ?').bind(String(b.user_id)).first()
      : await DB(c).prepare('SELECT * FROM users WHERE email = ?').bind(String(b.email || '').trim()).first();
    if (!user) return fail(c, 404, 'no such marketer');
    if (user.squad_status !== 'approved') return fail(c, 409, 'approve the marketer before sending a link');
    const channel = CHANNELS.includes(b.channel) ? b.channel : (user.squad_channel === 'offline' ? 'offline' : 'online');
    let link = await DB(c).prepare('SELECT * FROM campaign_links WHERE campaign_id = ? AND marketer_id = ?').bind(id, user.id).first();
    if (!link) {
      let code = '';
      for (let i = 0; i < 5 && !code; i++) {
        const cand = rand(4).slice(0, 7);
        if (!(await DB(c).prepare('SELECT 1 FROM campaign_links WHERE code = ?').bind(cand).first())) code = cand;
      }
      if (!code) return fail(c, 500, 'could not make a link, try again');
      await DB(c).prepare("INSERT INTO campaign_links (code, campaign_id, marketer_id, channel, issued_by, status, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?)")
        .bind(code, id, user.id, channel, admin.id, t).run();
      link = { code };
    }
    await DB(c).prepare("UPDATE campaign_links SET channel = ?, issued_by = ?, sent_via = ?, sent_at = ?, status = 'active' WHERE code = ?")
      .bind(channel, admin.id, String(b.sent_via || 'DM').slice(0, 40), t, link.code).run();
    return c.json({ code: link.code, url: linkUrl(c, link.code), marketer: { id: user.id, email: user.email, handle: user.handle } });
  });

  app.post('/api/admin/squad/conversions', async (c) => {
    needAdmin(c);
    const b = await c.req.json().catch(() => ({})), t = now();
    const campaign = await DB(c).prepare('SELECT * FROM campaigns WHERE id = ? AND deleted_at IS NULL').bind(String(b.campaign_id || '')).first();
    if (!campaign) return fail(c, 404, 'no such campaign');
    const external = String(b.external_id || '').trim().slice(0, 120);
    if (!external) return fail(c, 400, 'add the affiliate network order id');
    let link = null;
    if (b.code) link = await DB(c).prepare('SELECT * FROM campaign_links WHERE code = ? AND campaign_id = ?').bind(String(b.code), campaign.id).first();
    if (!link && b.click_id) link = await DB(c).prepare('SELECT * FROM campaign_links WHERE code = (SELECT code FROM clicks WHERE id = ?)').bind(String(b.click_id)).first();
    let marketer = link ? { id: link.marketer_id } : null;
    if (!marketer && b.email) marketer = await DB(c).prepare('SELECT id FROM users WHERE email = ?').bind(String(b.email).trim()).first();
    if (!marketer && b.marketer_id) marketer = { id: String(b.marketer_id) };
    if (!marketer) return fail(c, 400, 'say which marketer or link earned this');
    const id = uid('ac');
    const gross = Math.max(0, money(b.gross_cents));
    const commission = Math.max(0, money(b.commission_cents));
    try {
      await DB(c).prepare(`INSERT INTO affiliate_conversions (id, campaign_id, code, click_id, marketer_id, network, external_id, gross_cents, commission_cents, currency, status, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
        .bind(id, campaign.id, link?.code || null, b.click_id || null, marketer.id, String(b.network || campaign.affiliate_network || '').slice(0, 60) || null,
          external, gross, commission, String(b.currency || 'USD').toUpperCase().slice(0, 3), String(b.note || '').slice(0, 300) || null, t).run();
    } catch { return fail(c, 409, 'that affiliate order was already added'); }
    return c.json({ id, status: 'pending' });
  });

  app.post('/api/admin/squad/conversions/:id', async (c) => {
    needAdmin(c);
    const id = c.req.param('id'), b = await c.req.json().catch(() => ({})), t = now(), admin = needUser(c), DB_ = DB(c);
    const ac = await DB_.prepare(`SELECT ac.*, k.reward_cents, k.platform_fee_bps, k.budget_cents, k.spent_cents FROM affiliate_conversions ac
      JOIN campaigns k ON k.id = ac.campaign_id WHERE ac.id = ?`).bind(id).first();
    if (!ac) return fail(c, 404, 'no such conversion');
    if (ac.status !== 'pending') return fail(c, 409, 'already decided');
    if (b.decision === 'reject') {
      await DB_.prepare("UPDATE affiliate_conversions SET status = 'rejected', note = ?, decided_at = ?, decided_by = ? WHERE id = ?")
        .bind(String(b.note || '').slice(0, 300) || null, t, admin.id, id).run();
      return c.json({ ok: true, status: 'rejected' });
    }
    if (b.decision !== 'approve') return fail(c, 400, 'decision: approve or reject');
    const cost = costFor(ac), fee = feeFor(ac);
    const res = await DB_.prepare('UPDATE campaigns SET spent_cents = spent_cents + ?, updated_at = ? WHERE id = ? AND spent_cents + ? <= budget_cents')
      .bind(cost, t, ac.campaign_id, cost).run();
    if (!res.meta?.changes) {
      await DB_.prepare("UPDATE campaigns SET status = 'paused', paused_reason = 'budget', updated_at = ? WHERE id = ? AND status = 'live'").bind(t, ac.campaign_id).run();
      return fail(c, 402, 'the budget for this campaign is spent');
    }
    await DB_.batch([
      DB_.prepare("UPDATE affiliate_conversions SET status = 'approved', decided_at = ?, decided_by = ? WHERE id = ?").bind(t, admin.id, id),
      DB_.prepare("INSERT INTO ledger (id, user_id, campaign_id, kind, amount_cents, ref, created_at) VALUES (?, ?, ?, 'affiliate', ?, ?, ?)")
        .bind(uid('l'), ac.marketer_id, ac.campaign_id, ac.reward_cents, id, t),
      DB_.prepare("INSERT INTO platform_ledger (id, campaign_id, kind, amount_cents, ref, note, created_at) VALUES (?, ?, 'commission', ?, ?, 'affiliate commission', ?)")
        .bind(uid('pl'), ac.campaign_id, fee, id, t),
    ]);
    return c.json({ ok: true, status: 'approved' });
  });

  app.post('/api/admin/squad/proofs/:id', async (c) => {
    needAdmin(c);
    const id = c.req.param('id'), b = await c.req.json().catch(() => ({})), t = now(), DB_ = DB(c);
    const p = await DB_.prepare(`SELECT p.*, k.reward_cents, k.platform_fee_bps, k.budget_cents, k.spent_cents FROM proofs p JOIN campaigns k ON k.id = p.campaign_id WHERE p.id = ?`).bind(id).first();
    if (!p) return fail(c, 404, 'no such proof');
    if (p.status !== 'pending') return fail(c, 409, 'already decided');
    if (b.decision === 'reject') {
      await DB_.prepare("UPDATE proofs SET status = 'rejected', decided_at = ? WHERE id = ?").bind(t, id).run();
      return c.json({ ok: true, status: 'rejected' });
    }
    if (b.decision !== 'approve') return fail(c, 400, 'decision: approve or reject');
    const cost = costFor(p), fee = feeFor(p);
    const res = await DB_.prepare('UPDATE campaigns SET spent_cents = spent_cents + ?, updated_at = ? WHERE id = ? AND spent_cents + ? <= budget_cents')
      .bind(cost, t, p.campaign_id, cost).run();
    if (!res.meta?.changes) {
      await DB_.prepare("UPDATE campaigns SET status = 'paused', paused_reason = 'budget', updated_at = ? WHERE id = ? AND status = 'live'").bind(t, p.campaign_id).run();
      return fail(c, 402, 'the budget for this campaign is spent');
    }
    await DB_.batch([
      DB_.prepare("UPDATE proofs SET status = 'approved', reward_cents = ?, decided_at = ? WHERE id = ?").bind(p.reward_cents, t, id),
      DB_.prepare("INSERT INTO ledger (id, user_id, campaign_id, kind, amount_cents, ref, created_at) VALUES (?, ?, ?, 'snippet', ?, ?, ?)").bind(uid('l'), p.marketer_id, p.campaign_id, p.reward_cents, id, t),
      DB_.prepare("INSERT INTO platform_ledger (id, campaign_id, kind, amount_cents, ref, note, created_at) VALUES (?, ?, 'commission', ?, ?, 'post commission', ?)").bind(uid('pl'), p.campaign_id, fee, id, t),
    ]);
    return c.json({ ok: true, status: 'approved' });
  });

  app.post('/api/admin/squad/payouts/:id', async (c) => {
    needAdmin(c);
    const id = c.req.param('id'), b = await c.req.json().catch(() => ({})), t = now(), DB_ = DB(c);
    const p = await DB_.prepare('SELECT * FROM payouts WHERE id = ?').bind(id).first();
    if (!p) return fail(c, 404, 'no such payout');
    if (p.status !== 'requested') return fail(c, 409, 'already decided');
    const note = String(b.note || '').slice(0, 300) || null;
    if (b.action === 'paid') {
      await DB_.prepare("UPDATE payouts SET status = 'paid', note = ?, decided_at = ? WHERE id = ?").bind(note, t, id).run();
    } else if (b.action === 'reject') {
      // give the money back to the balance
      await DB_.batch([
        DB_.prepare("UPDATE payouts SET status = 'rejected', note = ?, decided_at = ? WHERE id = ?").bind(note, t, id),
        DB_.prepare("INSERT INTO ledger (id, user_id, kind, amount_cents, ref, created_at) VALUES (?, ?, 'reversal', ?, ?, ?)").bind(uid('l'), p.user_id, p.amount_cents, id, t),
      ]);
    } else return fail(c, 400, 'actions: paid, reject');
    return c.json({ ok: true });
  });

  // ---------- helpers ----------
  function DB(c) { return c.env.DB; }
  function linkUrl(c, code) { return `${c.env.APP_URL || new URL(c.req.url).origin}/s/${code}`; }
}
