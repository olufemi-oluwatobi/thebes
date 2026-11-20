// Gorilla Squad API: the offer model.
//   users · companies · sellers · marketers · socials · products · offer_types · delivery_types
//   offers → interests (accepted or denied by the seller) → relationships → deliveries (verified) and messages
// Every main row has is_verified, is_deleted and is_blocked. Deleted rows are never shown; blocked rows cannot act.
// Mounted on the Thebes Worker; the games engine is untouched. Helpers come from worker.js.

export const PLATFORMS = ['x', 'instagram', 'tiktok', 'youtube', 'linkedin', 'facebook', 'whatsapp', 'telegram', 'substack', 'newsletter', 'reddit', 'discord', 'twitch', 'website', 'other'];
const PAGE = 50;

export function squadRoutes(app, h) {
  const { needUser, needAdmin, fail, uid, now, json, HttpError } = h;
  const DB = (c) => c.env.DB;
  const no = (status, msg, code) => { throw new HttpError(status, msg, code); };
  const body = async (c) => { const b = await c.req.json().catch(() => null); return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; };
  const live = (r) => !!r && !r.is_deleted && !r.is_blocked;
  const bool = (v) => (v ? 1 : 0);

  // ---------- field checks ----------
  const text = (v, field, { min = 0, max = 200, required = false } = {}) => {
    if (v == null || String(v).trim() === '') { if (required) no(400, `${field} is required`, 'invalid'); return null; }
    const s = String(v).trim();
    if (s.length < min) no(400, `${field} is too short (at least ${min} characters)`, 'invalid');
    if (s.length > max) no(400, `${field} is too long (at most ${max} characters)`, 'invalid');
    return s;
  };
  const url = (v, field, required = false) => {
    const s = text(v, field, { max: 2000, required });
    if (s == null) return null;
    try { const u = new URL(s); if (u.protocol !== 'https:' && u.protocol !== 'http:') throw 0; return u.toString(); }
    catch { no(400, `${field} must be a web link starting with https://`, 'invalid'); }
  };
  const country = (v, field = 'country', required = false) => {
    const s = text(v, field, { max: 2, required });
    if (s == null) return null;
    if (!/^[A-Za-z]{2}$/.test(s)) no(400, `${field} is a two-letter code, like US or NG`, 'invalid');
    return s.toUpperCase();
  };
  const countries = (v, field) => {
    if (v == null) return [];
    if (!Array.isArray(v)) no(400, `${field} must be a list of country codes`, 'invalid');
    return [...new Set(v.map((x) => country(x, field, true)))].slice(0, 100);
  };
  const intIn = (v, field, min, max, required = false) => {
    if (v == null || v === '') { if (required) no(400, `${field} is required`, 'invalid'); return null; }
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) no(400, `${field} must be a whole number from ${min} to ${max}`, 'invalid');
    return n;
  };
  const obj = (v, field) => {
    if (v == null) return {};
    if (typeof v !== 'object' || Array.isArray(v)) no(400, `${field} must be an object`, 'invalid');
    const s = JSON.stringify(v);
    if (s.length > 20000) no(400, `${field} is too large`, 'invalid');
    return v;
  };
  const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  const page = (c) => ({ limit: Math.min(Math.max(parseInt(c.req.query('limit') || PAGE, 10) || PAGE, 1), 100), before: parseInt(c.req.query('before') || '0', 10) || null });

  // ---------- who is acting ----------
  const me = (c) => {
    const u = needUser(c);
    if (u.is_deleted) no(401, 'this account was deleted', 'deleted');
    if (u.is_blocked) no(403, 'this account is blocked', 'blocked');
    return u;
  };
  const sellerOf = (c, userId) => DB(c).prepare('SELECT * FROM sellers WHERE user_id = ?').bind(userId).first();
  const marketerOf = (c, userId) => DB(c).prepare('SELECT * FROM marketers WHERE user_id = ?').bind(userId).first();
  const asSeller = async (c) => {
    const u = me(c), s = await sellerOf(c, u.id);
    if (!s || s.is_deleted) no(403, 'set up your seller profile first', 'no_seller');
    if (s.is_blocked) no(403, 'your seller profile is blocked', 'blocked');
    return { u, s };
  };
  const asMarketer = async (c) => {
    const u = me(c), m = await marketerOf(c, u.id);
    if (!m || m.is_deleted) no(403, 'set up your marketer profile first', 'no_marketer');
    if (m.is_blocked) no(403, 'your marketer profile is blocked', 'blocked');
    return { u, m };
  };
  const isAdmin = (c) => { const u = c.get('user'); return !!u && u.role === 'admin'; };

  // ---------- shapes sent to the app ----------
  const flags = (r) => ({ is_verified: !!r.is_verified, is_deleted: !!r.is_deleted, is_blocked: !!r.is_blocked });
  const userOut = (u) => u && ({ id: u.id, email: u.email, display_name: u.display_name, first_name: u.first_name, last_name: u.last_name, role: u.role, ...flags(u) });
  const publicUser = (u) => u && ({ id: u.id, display_name: u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || null, first_name: u.first_name, last_name: u.last_name, is_verified: !!u.is_verified });
  const companyOut = (r) => r && ({ id: r.id, slug: r.slug, name: r.name, website: r.website, industry: r.industry, description: r.description, city: r.city, country: r.country, ...flags(r), created_at: r.created_at });
  const sellerOut = (r) => r && ({ id: r.id, user_id: r.user_id, company_id: r.company_id, bio: r.bio, ...flags(r), created_at: r.created_at });
  const marketerOut = (r) => r && ({ id: r.id, user_id: r.user_id, country: r.country, city: r.city, bio: r.bio, ...flags(r), verified_at: r.verified_at, created_at: r.created_at });
  const socialOut = (r) => r && ({ id: r.id, marketer_id: r.marketer_id, platform: r.platform, handle: r.handle, url: r.url, followers: r.followers, audience_countries: json(r.audience_countries, []), ...flags(r), verified_at: r.verified_at, verification_note: r.verification_note, created_at: r.created_at });
  const productOut = (r) => r && ({ id: r.id, seller_id: r.seller_id, company_id: r.company_id, name: r.name, description: r.description, url: r.url, details: json(r.details, {}), image: r.image_key ? '/files/' + r.image_key : null, image_asset_id: r.image_asset_id, is_flagged: !!r.is_flagged, flag_reason: r.flag_reason, ...flags(r), created_at: r.created_at, updated_at: r.updated_at });
  const typeOut = (r) => r && ({ id: r.id, slug: r.slug, name: r.name, description: r.description, criteria: json(r.criteria, {}), meta: json(r.meta, {}), created_by: r.created_by, is_approved: !!r.is_approved, is_deleted: !!r.is_deleted });
  const offerOut = (r, extra = {}) => r && ({
    id: r.id, product_id: r.product_id, offer_type_id: r.offer_type_id, title: r.title, description: r.description,
    terms: json(r.terms, {}), requirements: json(r.requirements, {}), max_relationships: r.max_relationships, status: r.status,
    ...flags(r), created_at: r.created_at, updated_at: r.updated_at, ...extra,
  });
  const interestOut = (r) => r && ({ id: r.id, offer_id: r.offer_id, marketer_id: r.marketer_id, social_id: r.social_id, message: r.message, status: r.status, decided_at: r.decided_at, decision_note: r.decision_note, created_at: r.created_at });
  const relOut = (r) => r && ({ id: r.id, offer_id: r.offer_id, marketer_id: r.marketer_id, interest_id: r.interest_id, status: r.status, terms_snapshot: json(r.terms_snapshot, {}), ended_reason: r.ended_reason, created_at: r.created_at, updated_at: r.updated_at, ended_at: r.ended_at });
  const deliveryOut = (r) => r && ({ id: r.id, relationship_id: r.relationship_id, delivery_type_id: r.delivery_type_id, social_id: r.social_id, proof_url: r.proof_url, note: r.note, status: r.status, is_verified: !!r.is_verified, verified_at: r.verified_at, verification_note: r.verification_note, created_at: r.created_at });
  const messageOut = (r) => r && ({ id: r.id, relationship_id: r.relationship_id, sender_id: r.sender_id, body: r.is_deleted ? null : r.body, is_deleted: !!r.is_deleted, created_at: r.created_at, read_at: r.read_at });

  // ---------- loaders ----------
  const productSql = `SELECT p.*, a.r2_key image_key FROM products p LEFT JOIN assets a ON a.id = p.image_asset_id`;
  const getProduct = (c, id) => DB(c).prepare(`${productSql} WHERE p.id = ?`).bind(id).first();
  // an offer with everything needed to decide who may see or act on it
  const offerCtx = (c, id) => DB(c).prepare(`SELECT o.*,
      p.name p_name, p.is_deleted p_deleted, p.is_blocked p_blocked, p.is_flagged p_flagged, p.seller_id,
      s.user_id seller_user_id, s.is_deleted s_deleted, s.is_blocked s_blocked,
      co.is_deleted co_deleted, co.is_blocked co_blocked,
      t.slug type_slug, t.name type_name, t.criteria type_criteria
    FROM offers o JOIN products p ON p.id = o.product_id JOIN sellers s ON s.id = p.seller_id
    LEFT JOIN companies co ON co.id = p.company_id JOIN offer_types t ON t.id = o.offer_type_id
    WHERE o.id = ?`).bind(id).first();
  const offerVisible = (o) => o && o.status === 'open' && !o.is_deleted && !o.is_blocked && !o.p_deleted && !o.p_blocked && !o.p_flagged && !o.s_deleted && !o.s_blocked && !o.co_deleted && !o.co_blocked;
  const ownsOffer = (o, u) => !!o && !!u && o.seller_user_id === u.id;

  const relCtx = (c, id) => DB(c).prepare(`SELECT r.*, o.title offer_title, o.product_id, o.requirements offer_requirements, o.status offer_status,
      s.user_id seller_user_id, m.user_id marketer_user_id, m.is_blocked m_blocked, m.is_deleted m_deleted, s.is_blocked s_blocked, s.is_deleted s_deleted
    FROM relationships r JOIN offers o ON o.id = r.offer_id JOIN products p ON p.id = o.product_id
    JOIN sellers s ON s.id = p.seller_id JOIN marketers m ON m.id = r.marketer_id WHERE r.id = ?`).bind(id).first();
  const relParty = async (c, id) => {
    const u = me(c), r = await relCtx(c, id);
    if (!r) no(404, 'no such relationship', 'not_found');
    const side = r.seller_user_id === u.id ? 'seller' : r.marketer_user_id === u.id ? 'marketer' : u.role === 'admin' ? 'admin' : null;
    if (!side) no(404, 'no such relationship', 'not_found');
    return { u, r, side };
  };

  // ---------- terms and requirements ----------
  function checkTerms(criteria, terms) {
    const spec = (criteria && criteria.terms) || {};
    if (terms != null && (typeof terms !== 'object' || Array.isArray(terms))) no(400, 'terms must be an object', 'invalid');
    const t = terms || {}, out = {};
    for (const [k, s] of Object.entries(spec)) {
      const v = t[k], label = s.label || k;
      if (v == null || v === '') { if (!s.optional) no(400, `${label} is required for this offer type`, 'invalid_terms'); continue; }
      if (s.type === 'number') {
        const n = Number(v);
        if (!Number.isFinite(n)) no(400, `${label} must be a number`, 'invalid_terms');
        if (s.min != null && n < s.min) no(400, `${label} must be at least ${s.min}`, 'invalid_terms');
        if (s.max != null && n > s.max) no(400, `${label} must be at most ${s.max}`, 'invalid_terms');
        out[k] = n;
      } else if (s.type === 'boolean') out[k] = !!v;
      else {
        const str = String(v).trim().slice(0, s.max || 500);
        if (s.enum && !s.enum.includes(str)) no(400, `${label} must be one of: ${s.enum.join(', ')}`, 'invalid_terms');
        out[k] = str;
      }
    }
    return out;
  }

  async function checkRequirements(c, r) {
    if (r == null) return {};
    if (typeof r !== 'object' || Array.isArray(r)) no(400, 'requirements must be an object', 'invalid');
    const out = {};
    const mf = intIn(r.min_followers, 'min_followers', 0, 1e9);
    if (mf) out.min_followers = mf;
    const cs = countries(r.countries, 'countries'); if (cs.length) out.countries = cs;
    const ac = countries(r.audience_countries, 'audience_countries'); if (ac.length) out.audience_countries = ac;
    if (r.platforms != null) {
      if (!Array.isArray(r.platforms)) no(400, 'platforms must be a list', 'invalid');
      const ps = [...new Set(r.platforms.map((p) => String(p).toLowerCase()))];
      const bad = ps.filter((p) => !PLATFORMS.includes(p));
      if (bad.length) no(400, `unknown platform: ${bad.join(', ')}`, 'invalid');
      if (ps.length) out.platforms = ps;
    }
    if (r.delivery_types != null) {
      if (!Array.isArray(r.delivery_types)) no(400, 'delivery_types must be a list of delivery type slugs', 'invalid');
      const ds = [...new Set(r.delivery_types.map((d) => String(d).toLowerCase()))];
      for (const d of ds) {
        const t = await DB(c).prepare('SELECT 1 FROM delivery_types WHERE slug = ? AND is_approved = 1 AND is_deleted = 0').bind(d).first();
        if (!t) no(400, `unknown delivery type: ${d}`, 'invalid');
      }
      if (ds.length) out.delivery_types = ds;
    }
    if (r.verified_only) out.verified_only = true;
    return out;
  }

  // can this marketer take this offer? (optionally with this social)
  async function eligibility(c, req, marketer, socialId) {
    const reasons = [];
    if (req.verified_only && !marketer.is_verified) reasons.push('the seller only works with verified marketers');
    if (req.countries && !req.countries.includes(marketer.country)) reasons.push(`you must be based in ${req.countries.join(', ')}`);
    const needsSocial = req.min_followers || req.platforms || req.audience_countries;
    if (needsSocial) {
      const rows = (await DB(c).prepare('SELECT * FROM socials WHERE marketer_id = ? AND is_deleted = 0 AND is_blocked = 0').bind(marketer.id).all()).results;
      const fits = (s) => (!req.platforms || req.platforms.includes(s.platform)) && (!req.min_followers || s.followers >= req.min_followers)
        && (!req.audience_countries || json(s.audience_countries, []).some((x) => req.audience_countries.includes(x)))
        && (!req.verified_only || s.is_verified);
      const pool = socialId ? rows.filter((s) => s.id === socialId) : rows;
      if (!pool.some(fits)) {
        const want = [req.platforms && `on ${req.platforms.join(' or ')}`, req.min_followers && `with ${req.min_followers}+ followers`,
          req.audience_countries && `with an audience in ${req.audience_countries.join(', ')}`, req.verified_only && 'that is verified'].filter(Boolean).join(' ');
        reasons.push(`you need an account ${want}`);
      }
    }
    return { eligible: reasons.length === 0, reasons };
  }

  // ======================================================================================================
  // me
  // ======================================================================================================
  app.get('/api/squad/me', async (c) => {
    const u = needUser(c);
    const seller = await sellerOf(c, u.id), marketer = await marketerOf(c, u.id);
    const socials = marketer ? (await DB(c).prepare('SELECT * FROM socials WHERE marketer_id = ? AND is_deleted = 0 ORDER BY created_at').bind(marketer.id).all()).results : [];
    const companies = (await DB(c).prepare(`SELECT co.*, m.role member_role FROM company_members m JOIN companies co ON co.id = m.company_id
      WHERE m.user_id = ? AND co.is_deleted = 0 AND co.deleted_at IS NULL ORDER BY co.created_at`).bind(u.id).all()).results;
    const unread = (await DB(c).prepare(`SELECT COUNT(*) n FROM messages g JOIN relationships r ON r.id = g.relationship_id JOIN offers o ON o.id = r.offer_id
      JOIN products p ON p.id = o.product_id JOIN sellers s ON s.id = p.seller_id JOIN marketers m ON m.id = r.marketer_id
      WHERE (s.user_id = ?1 OR m.user_id = ?1) AND g.sender_id <> ?1 AND g.read_at IS NULL AND g.is_deleted = 0`).bind(u.id).first()).n;
    const pending = seller ? (await DB(c).prepare(`SELECT COUNT(*) n FROM interests i JOIN offers o ON o.id = i.offer_id JOIN products p ON p.id = o.product_id
      WHERE p.seller_id = ? AND i.status = 'pending'`).bind(seller.id).first()).n : 0;
    return c.json({ user: userOut(u), seller: sellerOut(seller), marketer: marketerOut(marketer), socials: socials.map(socialOut),
      companies: companies.map((r) => ({ ...companyOut(r), member_role: r.member_role })), counts: { unread_messages: unread, pending_interests: pending } });
  });

  app.patch('/api/squad/me', async (c) => {
    const u = me(c), b = await body(c);
    const set = {};
    for (const k of ['first_name', 'last_name', 'display_name']) if (k in b) set[k] = text(b[k], k.replace('_', ' '), { max: 60 });
    if (!Object.keys(set).length) return c.json({ user: userOut(u) });
    const keys = Object.keys(set);
    await DB(c).prepare(`UPDATE users SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`).bind(...keys.map((k) => set[k]), now(), u.id).run();
    return c.json({ user: userOut({ ...u, ...set }) });
  });

  // soft-delete the account: withdraw interests, end relationships, close offers, sign out
  app.delete('/api/squad/me', async (c) => {
    const u = me(c), t = now(), D = DB(c);
    const seller = await sellerOf(c, u.id), marketer = await marketerOf(c, u.id);
    const q = [D.prepare('UPDATE users SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ?').bind(t, t, u.id)];
    if (marketer) q.push(
      D.prepare('UPDATE marketers SET is_deleted = 1, updated_at = ? WHERE id = ?').bind(t, marketer.id),
      D.prepare('UPDATE socials SET is_deleted = 1, updated_at = ? WHERE marketer_id = ?').bind(t, marketer.id),
      D.prepare("UPDATE interests SET status = 'withdrawn', updated_at = ? WHERE marketer_id = ? AND status = 'pending'").bind(t, marketer.id),
      D.prepare("UPDATE relationships SET status = 'ended', ended_by = ?, ended_reason = 'account deleted', ended_at = ?, updated_at = ? WHERE marketer_id = ? AND status <> 'ended'").bind(u.id, t, t, marketer.id));
    if (seller) q.push(
      D.prepare('UPDATE sellers SET is_deleted = 1, updated_at = ? WHERE id = ?').bind(t, seller.id),
      D.prepare(`UPDATE interests SET status = 'denied', decision_note = 'account deleted', decided_at = ?, updated_at = ? WHERE status = 'pending' AND offer_id IN
        (SELECT o.id FROM offers o JOIN products p ON p.id = o.product_id WHERE p.seller_id = ?)`).bind(t, t, seller.id),
      D.prepare(`UPDATE relationships SET status = 'ended', ended_by = ?, ended_reason = 'account deleted', ended_at = ?, updated_at = ? WHERE status <> 'ended' AND offer_id IN
        (SELECT o.id FROM offers o JOIN products p ON p.id = o.product_id WHERE p.seller_id = ?)`).bind(u.id, t, t, seller.id),
      D.prepare(`UPDATE offers SET status = 'closed', updated_at = ? WHERE product_id IN (SELECT id FROM products WHERE seller_id = ?)`).bind(t, seller.id),
      D.prepare('UPDATE products SET is_deleted = 1, updated_at = ? WHERE seller_id = ?').bind(t, seller.id));
    q.push(D.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id));
    await D.batch(q);
    return c.json({ ok: true });
  });

  // ======================================================================================================
  // companies
  // ======================================================================================================
  app.post('/api/squad/companies', async (c) => {
    const u = me(c), b = await body(c), t = now();
    const name = text(b.name, 'company name', { min: 2, max: 80, required: true });
    const fields = { website: url(b.website, 'website'), industry: text(b.industry, 'industry', { max: 60 }), description: text(b.description, 'description', { max: 1000 }),
      city: text(b.city, 'city', { max: 60 }), country: country(b.country) };
    const base = slugify(name).replace(/_/g, '-') || 'company';
    let slug = base;
    for (let i = 0; i < 5 && await DB(c).prepare('SELECT 1 FROM companies WHERE slug = ?').bind(slug).first(); i++) slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const id = uid('co');
    const q = [
      DB(c).prepare(`INSERT INTO companies (id, slug, name, website, industry, description, city, country, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, slug, name, fields.website, fields.industry, fields.description, fields.city, fields.country, u.id, t, t),
      DB(c).prepare("INSERT INTO company_members (company_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)").bind(id, u.id, t),
    ];
    // a seller with no company yet is attached to this one
    const s = await sellerOf(c, u.id);
    if (s && !s.company_id) q.push(DB(c).prepare('UPDATE sellers SET company_id = ?, updated_at = ? WHERE id = ?').bind(id, t, s.id));
    await DB(c).batch(q);
    return c.json({ company: companyOut(await DB(c).prepare('SELECT * FROM companies WHERE id = ?').bind(id).first()) }, 201);
  });

  app.get('/api/squad/companies/:id', async (c) => {
    const r = await DB(c).prepare('SELECT * FROM companies WHERE id = ? OR slug = ?').bind(c.req.param('id'), c.req.param('id')).first();
    if (!r || r.is_deleted || r.deleted_at || (r.is_blocked && !isAdmin(c))) return fail(c, 404, 'no such company', 'not_found');
    return c.json({ company: companyOut(r) });
  });

  app.patch('/api/squad/companies/:id', async (c) => {
    const u = me(c), b = await body(c), id = c.req.param('id');
    const r = await DB(c).prepare('SELECT * FROM companies WHERE id = ?').bind(id).first();
    if (!r || r.is_deleted) no(404, 'no such company', 'not_found');
    const role = (await DB(c).prepare('SELECT role FROM company_members WHERE company_id = ? AND user_id = ?').bind(id, u.id).first())?.role;
    if (!['owner', 'admin'].includes(role)) no(403, 'only company owners and admins can edit it', 'forbidden');
    if (r.is_blocked) no(403, 'this company is blocked', 'blocked');
    const set = {};
    if ('name' in b) set.name = text(b.name, 'company name', { min: 2, max: 80, required: true });
    if ('website' in b) set.website = url(b.website, 'website');
    if ('industry' in b) set.industry = text(b.industry, 'industry', { max: 60 });
    if ('description' in b) set.description = text(b.description, 'description', { max: 1000 });
    if ('city' in b) set.city = text(b.city, 'city', { max: 60 });
    if ('country' in b) set.country = country(b.country);
    const keys = Object.keys(set);
    if (keys.length) await DB(c).prepare(`UPDATE companies SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`).bind(...keys.map((k) => set[k]), now(), id).run();
    return c.json({ company: companyOut(await DB(c).prepare('SELECT * FROM companies WHERE id = ?').bind(id).first()) });
  });

  // ======================================================================================================
  // sellers and marketers
  // ======================================================================================================
  const companyFor = async (c, u, companyId) => {
    if (!companyId) return null;
    const role = (await DB(c).prepare(`SELECT m.role FROM company_members m JOIN companies co ON co.id = m.company_id
      WHERE m.company_id = ? AND m.user_id = ? AND co.is_deleted = 0 AND co.is_blocked = 0`).bind(companyId, u.id).first())?.role;
    if (!role) no(403, 'you are not a member of that company', 'forbidden');
    return companyId;
  };

  app.post('/api/squad/sellers', async (c) => {
    const u = me(c), b = await body(c), t = now();
    const have = await sellerOf(c, u.id);
    if (have && have.is_blocked) no(403, 'your seller profile is blocked', 'blocked');
    const company_id = await companyFor(c, u, b.company_id);
    const bio = text(b.bio, 'bio', { max: 1000 });
    if (have) {
      // set up again after a delete, or update
      await DB(c).prepare('UPDATE sellers SET is_deleted = 0, company_id = COALESCE(?, company_id), bio = COALESCE(?, bio), updated_at = ? WHERE id = ?').bind(company_id, bio, t, have.id).run();
      return c.json({ seller: sellerOut(await sellerOf(c, u.id)) });
    }
    await DB(c).prepare('INSERT INTO sellers (id, user_id, company_id, bio, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(uid('sl'), u.id, company_id, bio, t, t).run();
    return c.json({ seller: sellerOut(await sellerOf(c, u.id)) }, 201);
  });

  app.post('/api/squad/marketers', async (c) => {
    const u = me(c), b = await body(c), t = now();
    const have = await marketerOf(c, u.id);
    if (have && have.is_blocked) no(403, 'your marketer profile is blocked', 'blocked');
    const ctry = country(b.country, 'country', !have);
    const city = text(b.city, 'city', { max: 60 }), bio = text(b.bio, 'bio', { max: 1000 });
    if (have) {
      // a change of country is a new claim: it needs checking again
      const moved = ctry && ctry !== have.country;
      await DB(c).prepare(`UPDATE marketers SET is_deleted = 0, country = COALESCE(?, country), city = COALESCE(?, city), bio = COALESCE(?, bio),
        is_verified = CASE WHEN ? THEN 0 ELSE is_verified END, updated_at = ? WHERE id = ?`).bind(ctry, city, bio, bool(moved), t, have.id).run();
      return c.json({ marketer: marketerOut(await marketerOf(c, u.id)) });
    }
    await DB(c).prepare('INSERT INTO marketers (id, user_id, country, city, bio, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(uid('mk'), u.id, ctry, city, bio, t, t).run();
    return c.json({ marketer: marketerOut(await marketerOf(c, u.id)) }, 201);
  });

  // public marketer profile: verified status and accounts
  app.get('/api/squad/marketers/:id', async (c) => {
    const m = await DB(c).prepare('SELECT * FROM marketers WHERE id = ?').bind(c.req.param('id')).first();
    if (!m || m.is_deleted || (m.is_blocked && !isAdmin(c))) return fail(c, 404, 'no such marketer', 'not_found');
    const u = await DB(c).prepare('SELECT * FROM users WHERE id = ?').bind(m.user_id).first();
    const socials = (await DB(c).prepare('SELECT * FROM socials WHERE marketer_id = ? AND is_deleted = 0 AND is_blocked = 0 ORDER BY followers DESC').bind(m.id).all()).results;
    const done = (await DB(c).prepare(`SELECT COUNT(*) n FROM deliveries d JOIN relationships r ON r.id = d.relationship_id WHERE r.marketer_id = ? AND d.status = 'verified' AND d.is_deleted = 0`).bind(m.id).first()).n;
    return c.json({ marketer: marketerOut(m), user: publicUser(u), socials: socials.map(socialOut), verified_deliveries: done });
  });

  // ======================================================================================================
  // socials
  // ======================================================================================================
  const socialFields = (b, partial) => {
    const out = {};
    if (!partial || 'platform' in b) {
      const p = String(b.platform || '').toLowerCase();
      if (!PLATFORMS.includes(p)) no(400, `platform must be one of: ${PLATFORMS.join(', ')}`, 'invalid');
      out.platform = p;
    }
    if (!partial || 'handle' in b) out.handle = text(String(b.handle ?? '').replace(/^@+/, ''), 'handle', { min: 1, max: 100, required: true });
    if ('url' in b) out.url = url(b.url, 'url');
    if (!partial || 'followers' in b) out.followers = intIn(b.followers ?? 0, 'followers', 0, 1e10) ?? 0;
    if (!partial || 'audience_countries' in b) out.audience_countries = JSON.stringify(countries(b.audience_countries, 'audience_countries'));
    return out;
  };

  app.get('/api/squad/socials', async (c) => {
    const { m } = await asMarketer(c);
    const rows = (await DB(c).prepare('SELECT * FROM socials WHERE marketer_id = ? AND is_deleted = 0 ORDER BY created_at').bind(m.id).all()).results;
    return c.json({ socials: rows.map(socialOut) });
  });

  app.post('/api/squad/socials', async (c) => {
    const { m } = await asMarketer(c), b = await body(c), t = now();
    const f = socialFields(b, false);
    const n = (await DB(c).prepare('SELECT COUNT(*) n FROM socials WHERE marketer_id = ? AND is_deleted = 0').bind(m.id).first()).n;
    if (n >= 20) no(409, 'you can add up to 20 accounts', 'limit');
    if (await DB(c).prepare('SELECT 1 FROM socials WHERE platform = ? AND handle = ? AND is_deleted = 0').bind(f.platform, f.handle).first())
      no(409, 'that account is already on Gorilla Squad', 'duplicate');
    const id = uid('so');
    await DB(c).prepare('INSERT INTO socials (id, marketer_id, platform, handle, url, followers, audience_countries, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, m.id, f.platform, f.handle, f.url ?? null, f.followers, f.audience_countries, t, t).run();
    return c.json({ social: socialOut(await DB(c).prepare('SELECT * FROM socials WHERE id = ?').bind(id).first()) }, 201);
  });

  app.patch('/api/squad/socials/:id', async (c) => {
    const { m } = await asMarketer(c), b = await body(c), id = c.req.param('id');
    const s = await DB(c).prepare('SELECT * FROM socials WHERE id = ? AND marketer_id = ? AND is_deleted = 0').bind(id, m.id).first();
    if (!s) no(404, 'no such account of yours', 'not_found');
    if (s.is_blocked) no(403, 'this account is blocked', 'blocked');
    const f = socialFields(b, true);
    const keys = Object.keys(f);
    if (!keys.length) return c.json({ social: socialOut(s) });
    if ((f.platform && f.platform !== s.platform) || (f.handle && f.handle.toLowerCase() !== s.handle.toLowerCase())) {
      if (await DB(c).prepare('SELECT 1 FROM socials WHERE platform = ? AND handle = ? AND is_deleted = 0 AND id <> ?').bind(f.platform || s.platform, f.handle || s.handle, id).first())
        no(409, 'that account is already on Gorilla Squad', 'duplicate');
    }
    // any change to what was checked means it has to be checked again
    const recheck = ['platform', 'handle', 'followers', 'audience_countries'].some((k) => k in f && String(f[k]) !== String(s[k]));
    await DB(c).prepare(`UPDATE socials SET ${keys.map((k) => k + ' = ?').join(', ')}, is_verified = CASE WHEN ? THEN 0 ELSE is_verified END, updated_at = ? WHERE id = ?`)
      .bind(...keys.map((k) => f[k]), bool(recheck), now(), id).run();
    return c.json({ social: socialOut(await DB(c).prepare('SELECT * FROM socials WHERE id = ?').bind(id).first()), needs_verification: recheck && !!s.is_verified });
  });

  app.delete('/api/squad/socials/:id', async (c) => {
    const { m } = await asMarketer(c), id = c.req.param('id');
    const res = await DB(c).prepare('UPDATE socials SET is_deleted = 1, updated_at = ? WHERE id = ? AND marketer_id = ? AND is_deleted = 0').bind(now(), id, m.id).run();
    if (!res.meta?.changes) no(404, 'no such account of yours', 'not_found');
    return c.json({ ok: true });
  });

  // ======================================================================================================
  // products
  // ======================================================================================================
  const productFields = async (c, b, s, partial) => {
    const out = {};
    if (!partial || 'name' in b) out.name = text(b.name, 'product name', { min: 2, max: 120, required: true });
    if (!partial || 'description' in b) out.description = text(b.description, 'description', { min: 10, max: 5000, required: true });
    if ('url' in b) out.url = url(b.url, 'product link');
    if ('details' in b) out.details = JSON.stringify(obj(b.details, 'details'));
    if ('company_id' in b) out.company_id = b.company_id ? await companyFor(c, { id: s.user_id }, b.company_id) : null;
    if ('image_asset_id' in b) {
      if (b.image_asset_id) {
        const a = await DB(c).prepare('SELECT * FROM assets WHERE id = ? AND deleted_at IS NULL').bind(b.image_asset_id).first();
        if (!a || (a.company_id && !(await DB(c).prepare('SELECT 1 FROM company_members WHERE company_id = ? AND user_id = ?').bind(a.company_id, s.user_id).first())) || (!a.company_id && a.created_by !== s.user_id))
          no(400, 'that image is not one of yours', 'invalid');
        out.image_asset_id = a.id;
      } else out.image_asset_id = null;
    }
    return out;
  };

  app.post('/api/squad/products', async (c) => {
    const { s } = await asSeller(c), b = await body(c), t = now();
    const f = await productFields(c, b, s, false);
    const n = (await DB(c).prepare('SELECT COUNT(*) n FROM products WHERE seller_id = ? AND is_deleted = 0').bind(s.id).first()).n;
    if (n >= 200) no(409, 'you can list up to 200 products', 'limit');
    const id = uid('pr');
    await DB(c).prepare('INSERT INTO products (id, seller_id, company_id, name, description, url, details, image_asset_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, s.id, f.company_id !== undefined ? f.company_id : s.company_id, f.name, f.description, f.url ?? null, f.details ?? '{}', f.image_asset_id ?? null, t, t).run();
    return c.json({ product: productOut(await getProduct(c, id)) }, 201);
  });

  app.get('/api/squad/products', async (c) => {
    const { s } = await asSeller(c);
    const rows = (await DB(c).prepare(`${productSql} WHERE p.seller_id = ? AND p.is_deleted = 0 ORDER BY p.created_at DESC`).bind(s.id).all()).results;
    return c.json({ products: rows.map(productOut) });
  });

  app.get('/api/squad/products/:id', async (c) => {
    const p = await getProduct(c, c.req.param('id'));
    const u = c.get('user');
    const s = p && await DB(c).prepare('SELECT * FROM sellers WHERE id = ?').bind(p.seller_id).first();
    const owner = !!u && !!s && s.user_id === u.id;
    if (!p || p.is_deleted || (!owner && !isAdmin(c) && (p.is_blocked || p.is_flagged || !live(s)))) return fail(c, 404, 'no such product', 'not_found');
    const offers = (await DB(c).prepare(`SELECT o.* FROM offers o WHERE o.product_id = ? AND o.is_deleted = 0 ${owner || isAdmin(c) ? '' : "AND o.status = 'open' AND o.is_blocked = 0"} ORDER BY o.created_at DESC`).bind(p.id).all()).results;
    const company = p.company_id ? await DB(c).prepare('SELECT * FROM companies WHERE id = ?').bind(p.company_id).first() : null;
    return c.json({ product: productOut(p), company: companyOut(company), offers: offers.map((o) => offerOut(o)), is_owner: owner });
  });

  app.patch('/api/squad/products/:id', async (c) => {
    const { s } = await asSeller(c), b = await body(c), id = c.req.param('id');
    const p = await DB(c).prepare('SELECT * FROM products WHERE id = ? AND seller_id = ? AND is_deleted = 0').bind(id, s.id).first();
    if (!p) no(404, 'no such product of yours', 'not_found');
    if (p.is_blocked) no(403, 'this product is blocked', 'blocked');
    const f = await productFields(c, b, s, true);
    const keys = Object.keys(f);
    if (keys.length) await DB(c).prepare(`UPDATE products SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`).bind(...keys.map((k) => f[k]), now(), id).run();
    return c.json({ product: productOut(await getProduct(c, id)) });
  });

  // a product with live relationships cannot be deleted: end them first
  app.delete('/api/squad/products/:id', async (c) => {
    const { s } = await asSeller(c), id = c.req.param('id'), t = now();
    const p = await DB(c).prepare('SELECT * FROM products WHERE id = ? AND seller_id = ? AND is_deleted = 0').bind(id, s.id).first();
    if (!p) no(404, 'no such product of yours', 'not_found');
    const liveRel = (await DB(c).prepare(`SELECT COUNT(*) n FROM relationships r JOIN offers o ON o.id = r.offer_id WHERE o.product_id = ? AND r.status <> 'ended'`).bind(id).first()).n;
    if (liveRel) no(409, `end the ${liveRel} active relationship${liveRel > 1 ? 's' : ''} on this product first`, 'has_relationships');
    await DB(c).batch([
      DB(c).prepare(`UPDATE interests SET status = 'denied', decision_note = 'product removed', decided_at = ?, updated_at = ? WHERE status = 'pending' AND offer_id IN (SELECT id FROM offers WHERE product_id = ?)`).bind(t, t, id),
      DB(c).prepare("UPDATE offers SET status = 'closed', is_deleted = 1, updated_at = ? WHERE product_id = ?").bind(t, id),
      DB(c).prepare('UPDATE products SET is_deleted = 1, updated_at = ? WHERE id = ?').bind(t, id),
    ]);
    return c.json({ ok: true });
  });

  // ======================================================================================================
  // offer types and delivery types (proposed by users, approved by admins)
  // ======================================================================================================
  for (const [kind, table, prefix] of [['offer-types', 'offer_types', 'ot'], ['delivery-types', 'delivery_types', 'dt']]) {
    app.get(`/api/squad/${kind}`, async (c) => {
      const all = c.req.query('all') === '1' && isAdmin(c);
      const u = c.get('user');
      const rows = (await DB(c).prepare(`SELECT * FROM ${table} WHERE is_deleted = 0 AND (is_approved = 1 OR ? OR created_by = ?) ORDER BY is_approved DESC, name`).bind(bool(all), u ? u.id : '').all()).results;
      return c.json({ types: rows.map(typeOut) });
    });

    app.post(`/api/squad/${kind}`, async (c) => {
      const u = me(c), b = await body(c), t = now();
      const name = text(b.name, 'name', { min: 2, max: 60, required: true });
      const description = text(b.description, 'description', { min: 10, max: 500, required: true });
      const criteria = obj(b.criteria, 'criteria'), meta = obj(b.meta, 'meta');
      if (table === 'offer_types' && criteria.terms != null) {
        if (typeof criteria.terms !== 'object' || Array.isArray(criteria.terms)) no(400, 'criteria.terms must be an object of fields', 'invalid');
        for (const [k, s] of Object.entries(criteria.terms)) {
          if (!/^[a-z][a-z0-9_]{0,39}$/.test(k)) no(400, `term name "${k}" must be lower_case letters`, 'invalid');
          if (!s || !['number', 'string', 'boolean'].includes(s.type)) no(400, `term "${k}" needs a type: number, string or boolean`, 'invalid');
        }
      }
      const slug = slugify(b.slug || name);
      if (!slug) no(400, 'name needs letters or numbers', 'invalid');
      if (await DB(c).prepare(`SELECT 1 FROM ${table} WHERE slug = ?`).bind(slug).first()) no(409, 'a type with that name already exists', 'duplicate');
      const pending = (await DB(c).prepare(`SELECT COUNT(*) n FROM ${table} WHERE created_by = ? AND is_approved = 0 AND is_deleted = 0`).bind(u.id).first()).n;
      if (pending >= 5 && u.role !== 'admin') no(429, 'you have 5 types waiting for approval already', 'limit');
      const id = uid(prefix);
      // admins' own types are approved straight away
      const approved = u.role === 'admin' ? 1 : 0;
      await DB(c).prepare(`INSERT INTO ${table} (id, slug, name, description, criteria, meta, created_by, is_approved, approved_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, slug, name, description, JSON.stringify(criteria), JSON.stringify(meta), u.id, approved, approved ? u.id : null, t, t).run();
      return c.json({ type: typeOut(await DB(c).prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first()) }, 201);
    });
  }

  // ======================================================================================================
  // offers
  // ======================================================================================================
  const approvedOfferType = async (c, idOrSlug) => {
    const t = await DB(c).prepare('SELECT * FROM offer_types WHERE (id = ? OR slug = ?) AND is_deleted = 0').bind(idOrSlug, idOrSlug).first();
    if (!t) no(400, 'unknown offer type', 'invalid');
    if (!t.is_approved) no(400, 'that offer type is waiting for approval', 'type_pending');
    return t;
  };

  app.post('/api/squad/offers', async (c) => {
    const { u, s } = await asSeller(c), b = await body(c), t = now();
    const p = await DB(c).prepare('SELECT * FROM products WHERE id = ? AND seller_id = ? AND is_deleted = 0').bind(b.product_id || '', s.id).first();
    if (!p) no(404, 'no such product of yours', 'not_found');
    if (p.is_blocked) no(403, 'this product is blocked', 'blocked');
    const type = await approvedOfferType(c, b.offer_type_id || b.offer_type || '');
    const title = text(b.title, 'title', { min: 3, max: 120, required: true });
    const description = text(b.description, 'description', { max: 5000 });
    const terms = checkTerms(json(type.criteria, {}), b.terms);
    const requirements = await checkRequirements(c, b.requirements);
    const max = intIn(b.max_relationships, 'max_relationships', 1, 100000);
    const status = b.status === 'open' ? 'open' : 'draft';
    if (status === 'open' && p.is_flagged) no(409, 'this product is flagged and cannot be offered until it is reviewed', 'flagged');
    const id = uid('of');
    await DB(c).prepare(`INSERT INTO offers (id, product_id, offer_type_id, title, description, terms, requirements, max_relationships, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, p.id, type.id, title, description, JSON.stringify(terms), JSON.stringify(requirements), max, status, u.id, t, t).run();
    return c.json({ offer: offerOut(await DB(c).prepare('SELECT * FROM offers WHERE id = ?').bind(id).first()) }, 201);
  });

  // browse: open offers, newest first. ?type=commission&country=US&q=&eligible=1&limit=&before=
  app.get('/api/squad/offers', async (c) => {
    const { limit, before } = page(c);
    const type = c.req.query('type'), q = (c.req.query('q') || '').trim().slice(0, 80), ctry = (c.req.query('country') || '').toUpperCase();
    const where = [`o.status = 'open'`, 'o.is_deleted = 0', 'o.is_blocked = 0', 'p.is_deleted = 0', 'p.is_blocked = 0', 'p.is_flagged = 0',
      's.is_deleted = 0', 's.is_blocked = 0', '(co.id IS NULL OR (co.is_deleted = 0 AND co.is_blocked = 0))'];
    const args = [];
    if (type) { where.push('t.slug = ?'); args.push(type); }
    if (q) { where.push('(o.title LIKE ? OR p.name LIKE ? OR p.description LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (ctry) { where.push(`(json_extract(o.requirements, '$.countries') IS NULL OR EXISTS (SELECT 1 FROM json_each(o.requirements, '$.countries') WHERE value = ?))`); args.push(ctry); }
    if (before) { where.push('o.created_at < ?'); args.push(before); }
    const rows = (await DB(c).prepare(`SELECT o.*, p.name product_name, p.description product_description, p.url product_url, a.r2_key image_key,
        t.slug type_slug, t.name type_name, co.name company_name, co.is_verified company_verified, s.is_verified seller_verified,
        (SELECT COUNT(*) FROM relationships r WHERE r.offer_id = o.id AND r.status <> 'ended') active_relationships
      FROM offers o JOIN products p ON p.id = o.product_id JOIN sellers s ON s.id = p.seller_id JOIN offer_types t ON t.id = o.offer_type_id
      LEFT JOIN companies co ON co.id = p.company_id LEFT JOIN assets a ON a.id = p.image_asset_id
      WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC LIMIT ?`).bind(...args, limit + 1).all()).results;
    const more = rows.length > limit; rows.length = Math.min(rows.length, limit);
    // with ?eligible=1, a signed-in marketer gets their eligibility on each offer and can filter to the ones they fit
    const u = c.get('user');
    const m = u && !u.is_deleted ? await marketerOf(c, u.id) : null;
    const mine = m ? new Map((await DB(c).prepare(`SELECT offer_id, 'pending' status FROM interests WHERE marketer_id = ?1 AND status = 'pending'
      UNION ALL SELECT offer_id, 'accepted' FROM relationships WHERE marketer_id = ?1 AND status <> 'ended'`).bind(m.id).all()).results.map((r) => [r.offer_id, r.status])) : new Map();
    let out = [];
    for (const r of rows) {
      const extra = { product: { name: r.product_name, description: r.product_description, url: r.product_url, image: r.image_key ? '/files/' + r.image_key : null },
        type: { slug: r.type_slug, name: r.type_name }, company: r.company_name ? { name: r.company_name, is_verified: !!r.company_verified } : null,
        seller_verified: !!r.seller_verified, active_relationships: r.active_relationships,
        full: r.max_relationships != null && r.active_relationships >= r.max_relationships, my_interest: mine.get(r.id) || null };
      if (m && live(m)) Object.assign(extra, await eligibility(c, json(r.requirements, {}), m));
      out.push(offerOut(r, extra));
    }
    if (c.req.query('eligible') === '1') out = out.filter((o) => o.eligible);
    return c.json({ offers: out, next: more ? rows[rows.length - 1].created_at : null });
  });

  // the seller's own offers, all statuses, with counts
  app.get('/api/squad/seller/offers', async (c) => {
    const { s } = await asSeller(c);
    const rows = (await DB(c).prepare(`SELECT o.*, p.name product_name, t.slug type_slug, t.name type_name,
        (SELECT COUNT(*) FROM interests i WHERE i.offer_id = o.id AND i.status = 'pending') pending_interests,
        (SELECT COUNT(*) FROM relationships r WHERE r.offer_id = o.id AND r.status <> 'ended') active_relationships
      FROM offers o JOIN products p ON p.id = o.product_id JOIN offer_types t ON t.id = o.offer_type_id
      WHERE p.seller_id = ? AND o.is_deleted = 0 ORDER BY o.created_at DESC`).bind(s.id).all()).results;
    return c.json({ offers: rows.map((r) => offerOut(r, { product: { name: r.product_name }, type: { slug: r.type_slug, name: r.type_name }, pending_interests: r.pending_interests, active_relationships: r.active_relationships })) });
  });

  app.get('/api/squad/offers/:id', async (c) => {
    const o = await offerCtx(c, c.req.param('id'));
    const u = c.get('user');
    const owner = ownsOffer(o, u);
    if (!o || o.is_deleted || (!offerVisible(o) && !owner && !isAdmin(c))) return fail(c, 404, 'no such offer', 'not_found');
    const p = await getProduct(c, o.product_id);
    const company = p.company_id ? await DB(c).prepare('SELECT * FROM companies WHERE id = ?').bind(p.company_id).first() : null;
    const type = await DB(c).prepare('SELECT * FROM offer_types WHERE id = ?').bind(o.offer_type_id).first();
    const active = (await DB(c).prepare(`SELECT COUNT(*) n FROM relationships WHERE offer_id = ? AND status <> 'ended'`).bind(o.id).first()).n;
    const extra = { product: productOut(p), company: companyOut(company), type: typeOut(type), active_relationships: active,
      full: o.max_relationships != null && active >= o.max_relationships, is_owner: owner };
    if (owner) extra.pending_interests = (await DB(c).prepare(`SELECT COUNT(*) n FROM interests WHERE offer_id = ? AND status = 'pending'`).bind(o.id).first()).n;
    const m = u && !owner ? await marketerOf(c, u.id) : null;
    if (m && live(m)) {
      Object.assign(extra, await eligibility(c, json(o.requirements, {}), m));
      extra.my_interest = interestOut(await DB(c).prepare('SELECT * FROM interests WHERE offer_id = ? AND marketer_id = ? ORDER BY created_at DESC LIMIT 1').bind(o.id, m.id).first());
      extra.my_relationship = relOut(await DB(c).prepare(`SELECT * FROM relationships WHERE offer_id = ? AND marketer_id = ? AND status <> 'ended'`).bind(o.id, m.id).first());
    }
    return c.json({ offer: offerOut(o, extra) });
  });

  // edit an offer. Live relationships keep the terms they agreed to (terms_snapshot).
  app.patch('/api/squad/offers/:id', async (c) => {
    const { u } = await asSeller(c), b = await body(c), id = c.req.param('id'), t = now();
    const o = await offerCtx(c, id);
    if (!o || o.is_deleted || !ownsOffer(o, u)) no(404, 'no such offer of yours', 'not_found');
    if (o.is_blocked) no(403, 'this offer is blocked', 'blocked');
    if (o.status === 'closed') no(409, 'this offer is closed', 'closed');
    const set = {};
    if ('title' in b) set.title = text(b.title, 'title', { min: 3, max: 120, required: true });
    if ('description' in b) set.description = text(b.description, 'description', { max: 5000 });
    let typeCriteria = json(o.type_criteria, {});
    if ('offer_type_id' in b || 'offer_type' in b) {
      const used = (await DB(c).prepare('SELECT COUNT(*) n FROM relationships WHERE offer_id = ?').bind(id).first()).n;
      if (used) no(409, 'the offer type cannot change once someone has taken the offer', 'locked');
      const type = await approvedOfferType(c, b.offer_type_id || b.offer_type);
      set.offer_type_id = type.id; typeCriteria = json(type.criteria, {});
      if (!('terms' in b)) no(400, 'send new terms with a new offer type', 'invalid_terms');
    }
    if ('terms' in b) set.terms = JSON.stringify(checkTerms(typeCriteria, b.terms));
    if ('requirements' in b) set.requirements = JSON.stringify(await checkRequirements(c, b.requirements));
    if ('max_relationships' in b) {
      set.max_relationships = intIn(b.max_relationships, 'max_relationships', 1, 100000);
      const active = (await DB(c).prepare(`SELECT COUNT(*) n FROM relationships WHERE offer_id = ? AND status <> 'ended'`).bind(id).first()).n;
      if (set.max_relationships != null && set.max_relationships < active) no(409, `there are already ${active} active relationships`, 'too_low');
    }
    const keys = Object.keys(set);
    if (keys.length) await DB(c).prepare(`UPDATE offers SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`).bind(...keys.map((k) => set[k]), t, id).run();
    return c.json({ offer: offerOut(await DB(c).prepare('SELECT * FROM offers WHERE id = ?').bind(id).first()) });
  });

  // draft → open → paused ⇄ open → closed (final). Closing denies pending interests; relationships carry on.
  const MOVES = { open: ['draft', 'paused'], paused: ['open'], closed: ['draft', 'open', 'paused'] };
  app.post('/api/squad/offers/:id/status', async (c) => {
    const { u } = await asSeller(c), b = await body(c), id = c.req.param('id'), t = now();
    const o = await offerCtx(c, id);
    if (!o || o.is_deleted || !ownsOffer(o, u)) no(404, 'no such offer of yours', 'not_found');
    if (o.is_blocked) no(403, 'this offer is blocked', 'blocked');
    const to = b.status;
    if (!MOVES[to]) no(400, 'status must be open, paused or closed', 'invalid');
    if (o.status === to) return c.json({ offer: offerOut(o) });
    if (!MOVES[to].includes(o.status)) no(409, `a ${o.status} offer cannot be ${to}`, 'bad_transition');
    if (to === 'open' && (o.p_flagged || o.p_blocked || o.p_deleted)) no(409, 'the product is flagged or removed, so the offer cannot open', 'flagged');
    const q = [DB(c).prepare('UPDATE offers SET status = ?, updated_at = ? WHERE id = ?').bind(to, t, id)];
    if (to === 'closed') q.push(DB(c).prepare(`UPDATE interests SET status = 'denied', decision_note = 'offer closed', decided_by = ?, decided_at = ?, updated_at = ? WHERE offer_id = ? AND status = 'pending'`).bind(u.id, t, t, id));
    await DB(c).batch(q);
    return c.json({ offer: offerOut(await DB(c).prepare('SELECT * FROM offers WHERE id = ?').bind(id).first()) });
  });

  app.delete('/api/squad/offers/:id', async (c) => {
    const { u } = await asSeller(c), id = c.req.param('id'), t = now();
    const o = await offerCtx(c, id);
    if (!o || o.is_deleted || !ownsOffer(o, u)) no(404, 'no such offer of yours', 'not_found');
    const active = (await DB(c).prepare(`SELECT COUNT(*) n FROM relationships WHERE offer_id = ? AND status <> 'ended'`).bind(id).first()).n;
    if (active) no(409, `end the ${active} active relationship${active > 1 ? 's' : ''} first`, 'has_relationships');
    await DB(c).batch([
      DB(c).prepare(`UPDATE interests SET status = 'denied', decision_note = 'offer removed', decided_by = ?, decided_at = ?, updated_at = ? WHERE offer_id = ? AND status = 'pending'`).bind(u.id, t, t, id),
      DB(c).prepare("UPDATE offers SET is_deleted = 1, status = 'closed', updated_at = ? WHERE id = ?").bind(t, id),
    ]);
    return c.json({ ok: true });
  });

  // ======================================================================================================
  // interests: marketer asks, seller accepts or denies
  // ======================================================================================================
  app.post('/api/squad/offers/:id/interests', async (c) => {
    const { u, m } = await asMarketer(c), b = await body(c), id = c.req.param('id'), t = now();
    const o = await offerCtx(c, id);
    if (!o || o.is_deleted) no(404, 'no such offer', 'not_found');
    if (ownsOffer(o, u)) no(409, 'you cannot take your own offer', 'own_offer');
    if (!offerVisible(o)) no(409, o.status === 'paused' ? 'this offer is paused' : 'this offer is not open', 'not_open');
    const active = (await DB(c).prepare(`SELECT COUNT(*) n FROM relationships WHERE offer_id = ? AND status <> 'ended'`).bind(id).first()).n;
    if (o.max_relationships != null && active >= o.max_relationships) no(409, 'this offer is full', 'full');
    if (await DB(c).prepare(`SELECT 1 FROM interests WHERE offer_id = ? AND marketer_id = ? AND status = 'pending'`).bind(id, m.id).first()) no(409, 'you already asked for this offer', 'duplicate');
    if (await DB(c).prepare(`SELECT 1 FROM relationships WHERE offer_id = ? AND marketer_id = ? AND status <> 'ended'`).bind(id, m.id).first()) no(409, 'you already work on this offer', 'duplicate');
    let social = null;
    if (b.social_id) {
      social = await DB(c).prepare('SELECT * FROM socials WHERE id = ? AND marketer_id = ? AND is_deleted = 0').bind(b.social_id, m.id).first();
      if (!social) no(400, 'that account is not one of yours', 'invalid');
      if (social.is_blocked) no(403, 'that account is blocked', 'blocked');
    }
    const e = await eligibility(c, json(o.requirements, {}), m, social?.id);
    if (!e.eligible) return c.json({ error: e.reasons[0], code: 'not_eligible', reasons: e.reasons }, 403);
    const message = text(b.message, 'message', { max: 2000 });
    const iid = uid('in');
    try {
      await DB(c).prepare('INSERT INTO interests (id, offer_id, marketer_id, social_id, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(iid, id, m.id, social?.id ?? null, message, t, t).run();
    } catch (err) {
      if (String(err).includes('UNIQUE')) no(409, 'you already asked for this offer', 'duplicate');
      throw err;
    }
    return c.json({ interest: interestOut(await DB(c).prepare('SELECT * FROM interests WHERE id = ?').bind(iid).first()) }, 201);
  });

  // the seller's inbox for one offer: interests with who asked and their accounts
  app.get('/api/squad/offers/:id/interests', async (c) => {
    const { u } = await asSeller(c), id = c.req.param('id');
    const o = await offerCtx(c, id);
    if (!o || o.is_deleted || !ownsOffer(o, u)) no(404, 'no such offer of yours', 'not_found');
    const status = c.req.query('status');
    const rows = (await DB(c).prepare(`SELECT i.*, m.country m_country, m.city m_city, m.is_verified m_verified, m.is_blocked m_blocked,
        us.display_name, us.first_name, us.last_name, us.id user_id,
        so.platform so_platform, so.handle so_handle, so.followers so_followers, so.is_verified so_verified
      FROM interests i JOIN marketers m ON m.id = i.marketer_id JOIN users us ON us.id = m.user_id LEFT JOIN socials so ON so.id = i.social_id
      WHERE i.offer_id = ? ${status ? 'AND i.status = ?' : ''} ORDER BY i.status = 'pending' DESC, i.created_at DESC LIMIT 500`).bind(...(status ? [id, status] : [id])).all()).results;
    return c.json({ interests: rows.map((r) => ({ ...interestOut(r),
      marketer: { id: r.marketer_id, country: r.m_country, city: r.m_city, is_verified: !!r.m_verified, is_blocked: !!r.m_blocked,
        user: publicUser({ id: r.user_id, display_name: r.display_name, first_name: r.first_name, last_name: r.last_name }) },
      social: r.social_id ? { id: r.social_id, platform: r.so_platform, handle: r.so_handle, followers: r.so_followers, is_verified: !!r.so_verified } : null })) });
  });

  // the marketer's own interests
  app.get('/api/squad/interests', async (c) => {
    const { m } = await asMarketer(c);
    const rows = (await DB(c).prepare(`SELECT i.*, o.title offer_title, o.status offer_status, p.name product_name,
        (SELECT r.id FROM relationships r WHERE r.interest_id = i.id) relationship_id
      FROM interests i JOIN offers o ON o.id = i.offer_id JOIN products p ON p.id = o.product_id
      WHERE i.marketer_id = ? ORDER BY i.created_at DESC LIMIT 500`).bind(m.id).all()).results;
    return c.json({ interests: rows.map((r) => ({ ...interestOut(r), offer: { id: r.offer_id, title: r.offer_title, status: r.offer_status }, product: { name: r.product_name }, relationship_id: r.relationship_id })) });
  });

  const interestCtx = (c, id) => DB(c).prepare(`SELECT i.*, o.status offer_status, o.is_deleted o_deleted, o.is_blocked o_blocked, o.max_relationships, o.terms, o.requirements, o.title offer_title,
      t.slug type_slug, s.user_id seller_user_id, m.user_id marketer_user_id, m.is_deleted m_deleted, m.is_blocked m_blocked
    FROM interests i JOIN offers o ON o.id = i.offer_id JOIN offer_types t ON t.id = o.offer_type_id JOIN products p ON p.id = o.product_id
    JOIN sellers s ON s.id = p.seller_id JOIN marketers m ON m.id = i.marketer_id WHERE i.id = ?`).bind(id).first();

  // accepting creates the relationship, with the terms frozen as they are now
  app.post('/api/squad/interests/:id/accept', async (c) => {
    const { u } = await asSeller(c), b = await body(c), id = c.req.param('id'), t = now();
    const i = await interestCtx(c, id);
    if (!i || i.seller_user_id !== u.id) no(404, 'no such interest on your offers', 'not_found');
    if (i.status !== 'pending') no(409, `this interest was already ${i.status}`, 'decided');
    if (i.o_deleted || i.o_blocked || i.offer_status === 'closed') no(409, 'this offer is closed', 'closed');
    if (i.m_deleted || i.m_blocked) no(409, 'this marketer is no longer available', 'marketer_unavailable');
    const active = (await DB(c).prepare(`SELECT COUNT(*) n FROM relationships WHERE offer_id = ? AND status <> 'ended'`).bind(i.offer_id).first()).n;
    if (i.max_relationships != null && active >= i.max_relationships) no(409, 'this offer is full: raise the limit or end a relationship first', 'full');
    const rid = uid('rl');
    const snapshot = JSON.stringify({ offer_type: i.type_slug, title: i.offer_title, terms: json(i.terms, {}), requirements: json(i.requirements, {}), accepted_at: t });
    const note = text(b.note, 'note', { max: 1000 });
    try {
      await DB(c).batch([
        DB(c).prepare(`UPDATE interests SET status = 'accepted', decided_by = ?, decided_at = ?, decision_note = ?, updated_at = ? WHERE id = ? AND status = 'pending'`).bind(u.id, t, note, t, id),
        DB(c).prepare('INSERT INTO relationships (id, offer_id, marketer_id, interest_id, terms_snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(rid, i.offer_id, i.marketer_id, id, snapshot, t, t),
      ]);
    } catch (err) {
      if (String(err).includes('UNIQUE')) no(409, 'this marketer already works on this offer', 'duplicate');
      throw err;
    }
    return c.json({ interest: interestOut(await DB(c).prepare('SELECT * FROM interests WHERE id = ?').bind(id).first()), relationship: relOut(await DB(c).prepare('SELECT * FROM relationships WHERE id = ?').bind(rid).first()) }, 201);
  });

  app.post('/api/squad/interests/:id/deny', async (c) => {
    const { u } = await asSeller(c), b = await body(c), id = c.req.param('id'), t = now();
    const i = await interestCtx(c, id);
    if (!i || i.seller_user_id !== u.id) no(404, 'no such interest on your offers', 'not_found');
    if (i.status !== 'pending') no(409, `this interest was already ${i.status}`, 'decided');
    await DB(c).prepare(`UPDATE interests SET status = 'denied', decided_by = ?, decided_at = ?, decision_note = ?, updated_at = ? WHERE id = ? AND status = 'pending'`)
      .bind(u.id, t, text(b.note, 'note', { max: 1000 }), t, id).run();
    return c.json({ interest: interestOut(await DB(c).prepare('SELECT * FROM interests WHERE id = ?').bind(id).first()) });
  });

  app.post('/api/squad/interests/:id/withdraw', async (c) => {
    const { m } = await asMarketer(c), id = c.req.param('id'), t = now();
    const i = await DB(c).prepare('SELECT * FROM interests WHERE id = ? AND marketer_id = ?').bind(id, m.id).first();
    if (!i) no(404, 'no such interest of yours', 'not_found');
    if (i.status !== 'pending') no(409, i.status === 'accepted' ? 'this was accepted: end the relationship instead' : `this interest was already ${i.status}`, 'decided');
    await DB(c).prepare(`UPDATE interests SET status = 'withdrawn', updated_at = ? WHERE id = ? AND status = 'pending'`).bind(t, id).run();
    return c.json({ interest: interestOut(await DB(c).prepare('SELECT * FROM interests WHERE id = ?').bind(id).first()) });
  });

  // ======================================================================================================
  // relationships
  // ======================================================================================================
  const relListSql = `SELECT r.*, o.title offer_title, p.id product_id, p.name product_name, t.slug type_slug, t.name type_name,
      s.user_id seller_user_id, m.user_id marketer_user_id, m.country m_country, m.is_verified m_verified,
      su.display_name s_display, su.first_name s_first, su.last_name s_last, mu.display_name m_display, mu.first_name m_first, mu.last_name m_last, co.name company_name,
      (SELECT COUNT(*) FROM deliveries d WHERE d.relationship_id = r.id AND d.is_deleted = 0) deliveries,
      (SELECT COUNT(*) FROM deliveries d WHERE d.relationship_id = r.id AND d.status = 'verified' AND d.is_deleted = 0) verified_deliveries,
      (SELECT COUNT(*) FROM messages g WHERE g.relationship_id = r.id AND g.sender_id <> ?1 AND g.read_at IS NULL AND g.is_deleted = 0) unread,
      (SELECT MAX(created_at) FROM messages g WHERE g.relationship_id = r.id) last_message_at
    FROM relationships r JOIN offers o ON o.id = r.offer_id JOIN offer_types t ON t.id = o.offer_type_id JOIN products p ON p.id = o.product_id
    JOIN sellers s ON s.id = p.seller_id JOIN users su ON su.id = s.user_id JOIN marketers m ON m.id = r.marketer_id JOIN users mu ON mu.id = m.user_id
    LEFT JOIN companies co ON co.id = p.company_id`;
  const relRow = (r, uId) => ({ ...relOut(r), side: r.seller_user_id === uId ? 'seller' : r.marketer_user_id === uId ? 'marketer' : 'admin',
    offer: { id: r.offer_id, title: r.offer_title }, product: { id: r.product_id, name: r.product_name }, type: { slug: r.type_slug, name: r.type_name },
    seller: { user: publicUser({ id: r.seller_user_id, display_name: r.s_display, first_name: r.s_first, last_name: r.s_last }), company: r.company_name },
    marketer: { id: r.marketer_id, country: r.m_country, is_verified: !!r.m_verified, user: publicUser({ id: r.marketer_user_id, display_name: r.m_display, first_name: r.m_first, last_name: r.m_last }) },
    counts: { deliveries: r.deliveries, verified_deliveries: r.verified_deliveries, unread: r.unread }, last_message_at: r.last_message_at });

  // ?as=seller|marketer&status=active|paused|ended&offer_id=
  app.get('/api/squad/relationships', async (c) => {
    const u = me(c), as = c.req.query('as'), status = c.req.query('status'), offer = c.req.query('offer_id');
    const where = [as === 'seller' ? 's.user_id = ?1' : as === 'marketer' ? 'm.user_id = ?1' : '(s.user_id = ?1 OR m.user_id = ?1)'];
    const args = [u.id];
    if (status) { where.push(`r.status = ?${args.length + 1}`); args.push(status); }
    if (offer) { where.push(`r.offer_id = ?${args.length + 1}`); args.push(offer); }
    const rows = (await DB(c).prepare(`${relListSql} WHERE ${where.join(' AND ')} ORDER BY COALESCE((SELECT MAX(created_at) FROM messages g WHERE g.relationship_id = r.id), r.updated_at) DESC LIMIT 500`).bind(...args).all()).results;
    return c.json({ relationships: rows.map((r) => relRow(r, u.id)) });
  });

  app.get('/api/squad/relationships/:id', async (c) => {
    const { u } = await relParty(c, c.req.param('id'));
    const r = await DB(c).prepare(`${relListSql} WHERE r.id = ?2`).bind(u.id, c.req.param('id')).first();
    const interest = await DB(c).prepare('SELECT * FROM interests WHERE id = ?').bind(r.interest_id).first();
    return c.json({ relationship: { ...relRow(r, u.id), interest: interestOut(interest) } });
  });

  // pause and resume (seller), end (either side, final)
  app.post('/api/squad/relationships/:id/status', async (c) => {
    const { u, r, side } = await relParty(c, c.req.param('id')), b = await body(c), t = now();
    const to = b.status;
    if (!['active', 'paused', 'ended'].includes(to)) no(400, 'status must be active, paused or ended', 'invalid');
    if (r.status === 'ended') no(409, 'this relationship has ended', 'ended');
    if (r.status === to) return c.json({ relationship: relOut(r) });
    if (to !== 'ended' && side === 'marketer') no(403, 'only the seller can pause or resume', 'forbidden');
    if (to === 'active' && r.offer_status === 'closed') no(409, 'the offer is closed', 'closed');
    if (to === 'ended') {
      await DB(c).prepare(`UPDATE relationships SET status = 'ended', ended_by = ?, ended_reason = ?, ended_at = ?, updated_at = ? WHERE id = ?`)
        .bind(u.id, text(b.reason, 'reason', { max: 500 }), t, t, r.id).run();
    } else await DB(c).prepare('UPDATE relationships SET status = ?, updated_at = ? WHERE id = ?').bind(to, t, r.id).run();
    return c.json({ relationship: relOut(await DB(c).prepare('SELECT * FROM relationships WHERE id = ?').bind(r.id).first()) });
  });

  // ======================================================================================================
  // deliveries: the marketer reports what they did; the seller or an admin verifies it
  // ======================================================================================================
  app.get('/api/squad/relationships/:id/deliveries', async (c) => {
    const { r } = await relParty(c, c.req.param('id'));
    const rows = (await DB(c).prepare(`SELECT d.*, t.slug type_slug, t.name type_name, so.platform so_platform, so.handle so_handle
      FROM deliveries d JOIN delivery_types t ON t.id = d.delivery_type_id LEFT JOIN socials so ON so.id = d.social_id
      WHERE d.relationship_id = ? AND d.is_deleted = 0 ORDER BY d.created_at DESC`).bind(r.id).all()).results;
    return c.json({ deliveries: rows.map((d) => ({ ...deliveryOut(d), type: { slug: d.type_slug, name: d.type_name }, social: d.social_id ? { id: d.social_id, platform: d.so_platform, handle: d.so_handle } : null })) });
  });

  app.post('/api/squad/relationships/:id/deliveries', async (c) => {
    const { r, side } = await relParty(c, c.req.param('id')), b = await body(c), t = now();
    if (side !== 'marketer') no(403, 'only the marketer reports deliveries', 'forbidden');
    if (r.m_blocked || r.m_deleted) no(403, 'your marketer profile is blocked', 'blocked');
    if (r.status !== 'active') no(409, `this relationship is ${r.status}`, 'not_active');
    const type = await DB(c).prepare('SELECT * FROM delivery_types WHERE (id = ? OR slug = ?) AND is_deleted = 0').bind(b.delivery_type_id || b.delivery_type || '', b.delivery_type_id || b.delivery_type || '').first();
    if (!type) no(400, 'unknown delivery type', 'invalid');
    if (!type.is_approved) no(400, 'that delivery type is waiting for approval', 'type_pending');
    const allowed = json(r.offer_requirements, {}).delivery_types;
    if (allowed && !allowed.includes(type.slug)) no(400, `this offer accepts: ${allowed.join(', ')}`, 'type_not_allowed');
    const crit = json(type.criteria, {});
    let social = null;
    if (b.social_id) {
      social = await DB(c).prepare('SELECT * FROM socials WHERE id = ? AND marketer_id = ? AND is_deleted = 0').bind(b.social_id, r.marketer_id).first();
      if (!social) no(400, 'that account is not one of yours', 'invalid');
      if (social.is_blocked) no(403, 'that account is blocked', 'blocked');
    } else if (crit.needs_social) no(400, `say which account the ${type.name.toLowerCase()} went out on`, 'needs_social');
    const proof_url = url(b.proof_url, 'proof link', crit.proof === 'url');
    const note = text(b.note, 'note', { max: 2000 });
    if (!proof_url && !note) no(400, 'add a link or a note so it can be checked', 'needs_proof');
    if (proof_url && await DB(c).prepare('SELECT 1 FROM deliveries WHERE relationship_id = ? AND proof_url = ? AND is_deleted = 0').bind(r.id, proof_url).first())
      no(409, 'that link was already reported', 'duplicate');
    const id = uid('dl');
    await DB(c).prepare('INSERT INTO deliveries (id, relationship_id, delivery_type_id, social_id, proof_url, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, r.id, type.id, social?.id ?? null, proof_url, note, t, t).run();
    return c.json({ delivery: deliveryOut(await DB(c).prepare('SELECT * FROM deliveries WHERE id = ?').bind(id).first()) }, 201);
  });

  const deliveryCtx = async (c, id) => {
    const d = await DB(c).prepare('SELECT * FROM deliveries WHERE id = ? AND is_deleted = 0').bind(id).first();
    if (!d) no(404, 'no such delivery', 'not_found');
    const ctx = await relParty(c, d.relationship_id);
    return { d, ...ctx };
  };

  // verify or reject: the seller of the relationship, or an admin. Never the marketer.
  for (const [action, status] of [['verify', 'verified'], ['reject', 'rejected']]) {
    app.post(`/api/squad/deliveries/:id/${action}`, async (c) => {
      const { u, d, side, r } = await deliveryCtx(c, c.req.param('id')), b = await body(c), t = now();
      if (side === 'marketer') no(403, 'you cannot check your own delivery', 'forbidden');
      if (side === 'seller' && (r.s_blocked || r.s_deleted)) no(403, 'your seller profile is blocked', 'blocked');
      if (d.status !== 'submitted' && side !== 'admin') no(409, `this delivery was already ${d.status}`, 'decided');
      if (d.status === status) return c.json({ delivery: deliveryOut(d) });
      const note = text(b.note, 'note', { max: 1000 });
      if (status === 'rejected' && !note) no(400, 'say why it was rejected', 'needs_note');
      await DB(c).prepare('UPDATE deliveries SET status = ?, is_verified = ?, verified_by = ?, verified_at = ?, verification_note = ?, updated_at = ? WHERE id = ?')
        .bind(status, bool(status === 'verified'), u.id, t, note, t, d.id).run();
      return c.json({ delivery: deliveryOut(await DB(c).prepare('SELECT * FROM deliveries WHERE id = ?').bind(d.id).first()) });
    });
  }

  // the marketer can take back a delivery that has not been checked yet
  app.delete('/api/squad/deliveries/:id', async (c) => {
    const { d, side } = await deliveryCtx(c, c.req.param('id'));
    if (side !== 'marketer') no(403, 'only the marketer can remove a delivery', 'forbidden');
    if (d.status !== 'submitted') no(409, `this delivery was already ${d.status}`, 'decided');
    await DB(c).prepare('UPDATE deliveries SET is_deleted = 1, updated_at = ? WHERE id = ?').bind(now(), d.id).run();
    return c.json({ ok: true });
  });

  // ======================================================================================================
  // messages, per relationship
  // ======================================================================================================
  // ?after=<ms> for new ones (polling), ?before=<ms> for older ones
  app.get('/api/squad/relationships/:id/messages', async (c) => {
    const { r } = await relParty(c, c.req.param('id'));
    const after = parseInt(c.req.query('after') || '0', 10) || 0;
    const { limit, before } = page(c);
    const rows = (await DB(c).prepare(`SELECT * FROM messages WHERE relationship_id = ? AND created_at > ? ${before ? 'AND created_at < ?' : ''} ORDER BY created_at DESC LIMIT ?`)
      .bind(...(before ? [r.id, after, before, limit] : [r.id, after, limit])).all()).results.reverse();
    return c.json({ messages: rows.map(messageOut) });
  });

  app.post('/api/squad/relationships/:id/messages', async (c) => {
    const { u, r, side } = await relParty(c, c.req.param('id')), b = await body(c), t = now();
    if (side === 'admin') no(403, 'admins read, they do not post here', 'forbidden');
    if (r.status === 'ended') no(409, 'this relationship has ended', 'ended');
    if ((side === 'marketer' && (r.m_blocked || r.m_deleted)) || (side === 'seller' && (r.s_blocked || r.s_deleted))) no(403, 'your profile is blocked', 'blocked');
    const text_ = text(b.body, 'message', { min: 1, max: 4000, required: true });
    // a light flood guard: 30 messages a minute per person per relationship
    const recent = (await DB(c).prepare('SELECT COUNT(*) n FROM messages WHERE relationship_id = ? AND sender_id = ? AND created_at > ?').bind(r.id, u.id, t - 60000).first()).n;
    if (recent >= 30) no(429, 'slow down a little', 'rate_limited');
    const id = uid('mg');
    await DB(c).prepare('INSERT INTO messages (id, relationship_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, r.id, u.id, text_, t).run();
    return c.json({ message: messageOut(await DB(c).prepare('SELECT * FROM messages WHERE id = ?').bind(id).first()) }, 201);
  });

  app.post('/api/squad/relationships/:id/read', async (c) => {
    const { u, r, side } = await relParty(c, c.req.param('id'));
    if (side === 'admin') return c.json({ ok: true, marked: 0 });
    const res = await DB(c).prepare('UPDATE messages SET read_at = ? WHERE relationship_id = ? AND sender_id <> ? AND read_at IS NULL').bind(now(), r.id, u.id).run();
    return c.json({ ok: true, marked: res.meta?.changes || 0 });
  });

  app.delete('/api/squad/messages/:id', async (c) => {
    const u = me(c);
    const res = await DB(c).prepare('UPDATE messages SET is_deleted = 1 WHERE id = ? AND sender_id = ? AND is_deleted = 0').bind(c.req.param('id'), u.id).run();
    if (!res.meta?.changes) no(404, 'no such message of yours', 'not_found');
    return c.json({ ok: true });
  });

  // ======================================================================================================
  // admin
  // ======================================================================================================
  const ADMIN = {
    users: { table: 'users', actions: ['verify', 'unverify', 'block', 'unblock', 'delete', 'restore'] },
    companies: { table: 'companies', actions: ['verify', 'unverify', 'block', 'unblock', 'delete', 'restore'] },
    sellers: { table: 'sellers', actions: ['verify', 'unverify', 'block', 'unblock', 'delete', 'restore'] },
    marketers: { table: 'marketers', actions: ['verify', 'unverify', 'block', 'unblock', 'delete', 'restore'] },
    socials: { table: 'socials', actions: ['verify', 'unverify', 'block', 'unblock', 'delete', 'restore'] },
    products: { table: 'products', actions: ['verify', 'unverify', 'block', 'unblock', 'delete', 'restore', 'flag', 'unflag'] },
    offers: { table: 'offers', actions: ['verify', 'unverify', 'block', 'unblock', 'delete', 'restore'] },
    'offer-types': { table: 'offer_types', actions: ['approve', 'unapprove', 'delete', 'restore'] },
    'delivery-types': { table: 'delivery_types', actions: ['approve', 'unapprove', 'delete', 'restore'] },
    deliveries: { table: 'deliveries', actions: ['verify', 'reject', 'delete', 'restore'] },
  };

  app.post('/api/admin/squad/:kind/:id', async (c) => {
    const a = needAdmin(c), b = await body(c), t = now();
    const spec = ADMIN[c.req.param('kind')];
    if (!spec) no(404, 'unknown kind', 'not_found');
    const id = c.req.param('id'), action = b.action;
    if (!spec.actions.includes(action)) no(400, `actions here: ${spec.actions.join(', ')}`, 'invalid');
    const row = await DB(c).prepare(`SELECT * FROM ${spec.table} WHERE id = ?`).bind(id).first();
    if (!row) no(404, 'not found', 'not_found');
    if (spec.table === 'users' && id === a.id && ['block', 'delete'].includes(action)) no(409, 'you cannot block or delete yourself', 'self');
    const note = text(b.note || b.reason, 'note', { max: 1000 });
    const hasVerifiedBy = ['sellers', 'marketers', 'socials', 'deliveries'].includes(spec.table);
    const sets = {
      verify: spec.table === 'deliveries' ? { status: 'verified', is_verified: 1, verified_by: a.id, verified_at: t, verification_note: note }
        : { is_verified: 1, ...(hasVerifiedBy ? { verified_by: a.id, verified_at: t } : {}), ...(spec.table === 'users' ? { verified_at: t } : {}), ...(spec.table === 'socials' ? { verification_note: note } : {}) },
      unverify: { is_verified: 0 },
      reject: { status: 'rejected', is_verified: 0, verified_by: a.id, verified_at: t, verification_note: note },
      block: { is_blocked: 1 }, unblock: { is_blocked: 0 },
      delete: { is_deleted: 1, ...(['users', 'companies'].includes(spec.table) ? { deleted_at: t } : {}) },
      restore: { is_deleted: 0, ...(['users', 'companies'].includes(spec.table) ? { deleted_at: null } : {}) },
      flag: { is_flagged: 1, flag_reason: note, flagged_by: a.id }, unflag: { is_flagged: 0, flag_reason: null, flagged_by: null },
      approve: { is_approved: 1, approved_by: a.id }, unapprove: { is_approved: 0, approved_by: null },
    }[action];
    const keys = Object.keys(sets);
    const q = [DB(c).prepare(`UPDATE ${spec.table} SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`).bind(...keys.map((k) => sets[k]), t, id)];
    // blocking or deleting someone stops their live work
    if (['block', 'delete'].includes(action)) {
      if (spec.table === 'users') q.push(DB(c).prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
      const mk = spec.table === 'marketers' ? id : spec.table === 'users' ? (await marketerOf(c, id))?.id : null;
      if (mk) q.push(DB(c).prepare(`UPDATE interests SET status = 'withdrawn', updated_at = ? WHERE marketer_id = ? AND status = 'pending'`).bind(t, mk),
        DB(c).prepare(`UPDATE relationships SET status = 'paused', updated_at = ? WHERE marketer_id = ? AND status = 'active'`).bind(t, mk));
      const offerIds = spec.table === 'offers' ? `SELECT ?` : spec.table === 'products' ? `SELECT id FROM offers WHERE product_id = ?` : null;
      if (offerIds) q.push(DB(c).prepare(`UPDATE interests SET status = 'denied', decision_note = 'offer removed by an admin', decided_by = ?, decided_at = ?, updated_at = ? WHERE status = 'pending' AND offer_id IN (${offerIds})`).bind(a.id, t, t, id),
        DB(c).prepare(`UPDATE relationships SET status = 'paused', updated_at = ? WHERE status = 'active' AND offer_id IN (${offerIds})`).bind(t, id));
    }
    // a flagged product's open offers are paused until it is reviewed
    if (action === 'flag') q.push(DB(c).prepare(`UPDATE offers SET status = 'paused', updated_at = ? WHERE product_id = ? AND status = 'open'`).bind(t, id));
    await DB(c).batch(q);
    return c.json({ ok: true, row: await DB(c).prepare(`SELECT * FROM ${spec.table} WHERE id = ?`).bind(id).first() });
  });

  // what needs a person: unverified marketers and accounts, flagged products, types to approve
  app.get('/api/admin/squad/queue', async (c) => {
    needAdmin(c);
    const all = async (sql) => (await DB(c).prepare(sql).all()).results;
    return c.json({
      marketers: (await all(`SELECT m.*, u.email, u.first_name, u.last_name, u.display_name FROM marketers m JOIN users u ON u.id = m.user_id WHERE m.is_verified = 0 AND m.is_deleted = 0 ORDER BY m.created_at LIMIT 200`))
        .map((r) => ({ ...marketerOut(r), user: { email: r.email, first_name: r.first_name, last_name: r.last_name, display_name: r.display_name } })),
      socials: (await all(`SELECT * FROM socials WHERE is_verified = 0 AND is_deleted = 0 ORDER BY created_at LIMIT 200`)).map(socialOut),
      products: (await all(`${productSql} WHERE p.is_flagged = 1 AND p.is_deleted = 0 ORDER BY p.updated_at LIMIT 200`)).map(productOut),
      offer_types: (await all(`SELECT * FROM offer_types WHERE is_approved = 0 AND is_deleted = 0 ORDER BY created_at`)).map(typeOut),
      delivery_types: (await all(`SELECT * FROM delivery_types WHERE is_approved = 0 AND is_deleted = 0 ORDER BY created_at`)).map(typeOut),
      counts: {
        users: (await DB(c).prepare('SELECT COUNT(*) n FROM users WHERE is_deleted = 0').first()).n,
        sellers: (await DB(c).prepare('SELECT COUNT(*) n FROM sellers WHERE is_deleted = 0').first()).n,
        marketers: (await DB(c).prepare('SELECT COUNT(*) n FROM marketers WHERE is_deleted = 0').first()).n,
        open_offers: (await DB(c).prepare(`SELECT COUNT(*) n FROM offers WHERE status = 'open' AND is_deleted = 0`).first()).n,
        active_relationships: (await DB(c).prepare(`SELECT COUNT(*) n FROM relationships WHERE status = 'active'`).first()).n,
        deliveries_to_check: (await DB(c).prepare(`SELECT COUNT(*) n FROM deliveries WHERE status = 'submitted' AND is_deleted = 0`).first()).n,
      },
    });
  });

  // list any kind for the admin screens: ?q=&flag=blocked|deleted|unverified
  app.get('/api/admin/squad/:kind', async (c) => {
    needAdmin(c);
    const spec = ADMIN[c.req.param('kind')];
    if (!spec) no(404, 'unknown kind', 'not_found');
    const { limit, before } = page(c);
    const flag = c.req.query('flag');
    const where = [], args = [];
    if (flag === 'blocked' && spec.table !== 'offer_types' && spec.table !== 'delivery_types' && spec.table !== 'deliveries') where.push('is_blocked = 1');
    else if (flag === 'deleted') where.push('is_deleted = 1');
    else if (flag === 'unverified' && !spec.table.endsWith('_types')) where.push('is_verified = 0');
    if (before) { where.push('created_at < ?'); args.push(before); }
    const rows = (await DB(c).prepare(`SELECT * FROM ${spec.table} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ?`).bind(...args, limit).all()).results;
    return c.json({ rows });
  });
}
