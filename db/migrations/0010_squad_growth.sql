-- Gorilla Squad · 0010 · onboarding, listing credits, affiliate tracking and platform fees.
-- Launch country is the United States. Sellers can self-publish with a listing credit; marketers are approved by hand.

-- ---------- marketers: who they are, where they share, and whether we verified them ----------
ALTER TABLE users ADD COLUMN squad_channel   TEXT CHECK (squad_channel IN ('online', 'offline'));
ALTER TABLE users ADD COLUMN social_platform TEXT;                       -- x, youtube, instagram, tiktok, whatsapp, offline
ALTER TABLE users ADD COLUMN social_handle   TEXT;
ALTER TABLE users ADD COLUMN social_url      TEXT;
ALTER TABLE users ADD COLUMN audience        TEXT;                       -- free text, e.g. "12k on YouTube"
ALTER TABLE users ADD COLUMN squad_proof     TEXT;                       -- profile link, ID/country proof or notes for the admin
ALTER TABLE users ADD COLUMN squad_status    TEXT NOT NULL DEFAULT 'none'
  CHECK (squad_status IN ('none', 'verifying', 'approved', 'rejected', 'suspended'));
ALTER TABLE users ADD COLUMN squad_note      TEXT;
ALTER TABLE users ADD COLUMN squad_verified_at INTEGER;
ALTER TABLE users ADD COLUMN squad_verified_by TEXT REFERENCES users(id);

-- ---------- sellers: two free listings, then a paid listing credit ----------
ALTER TABLE companies ADD COLUMN listing_credits INTEGER NOT NULL DEFAULT 2 CHECK (listing_credits >= 0);

-- ---------- campaigns: affiliate attachment, fees and budget pause ----------
ALTER TABLE campaigns ADD COLUMN affiliate_network TEXT;                 -- e.g. "Impact", "CJ", "ShareASale", "direct"
ALTER TABLE campaigns ADD COLUMN affiliate_ref     TEXT;                 -- the seller's / network account reference
ALTER TABLE campaigns ADD COLUMN subid_param       TEXT NOT NULL DEFAULT 'subid';
ALTER TABLE campaigns ADD COLUMN platform_fee_bps  INTEGER NOT NULL DEFAULT 1000 CHECK (platform_fee_bps BETWEEN 0 AND 5000);
ALTER TABLE campaigns ADD COLUMN paused_reason     TEXT;                 -- "budget", "admin"
ALTER TABLE campaigns ADD COLUMN target_results    INTEGER CHECK (target_results IS NULL OR target_results > 0);
ALTER TABLE campaigns ADD COLUMN ends_at           INTEGER;
ALTER TABLE campaigns ADD COLUMN listing_charge_cents INTEGER NOT NULL DEFAULT 0 CHECK (listing_charge_cents >= 0);

-- ---------- links: channel, who issued them, and whether they are live ----------
ALTER TABLE campaign_links ADD COLUMN channel   TEXT NOT NULL DEFAULT 'online'
  CHECK (channel IN ('online', 'offline', 'x', 'youtube', 'instagram', 'tiktok', 'whatsapp'));
ALTER TABLE campaign_links ADD COLUMN status    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked'));
ALTER TABLE campaign_links ADD COLUMN issued_by TEXT REFERENCES users(id);
ALTER TABLE campaign_links ADD COLUMN sent_via  TEXT;                    -- "DM", "email", "flyer", "QR"
ALTER TABLE campaign_links ADD COLUMN sent_at   INTEGER;
ALTER TABLE campaign_links ADD COLUMN expires_at INTEGER;

-- ---------- listing charges: two free, then paid, recorded per company ----------
CREATE TABLE listing_charges (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('free', 'paid')),
  amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  note        TEXT,
  created_at  INTEGER NOT NULL
) STRICT;
CREATE INDEX listing_charges_company ON listing_charges(company_id, created_at);

-- ---------- affiliate conversions: the network reports a sale; admin approves it ----------
CREATE TABLE affiliate_conversions (
  id              TEXT PRIMARY KEY,
  campaign_id     TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  code            TEXT REFERENCES campaign_links(code) ON DELETE SET NULL,
  click_id        TEXT REFERENCES clicks(id) ON DELETE SET NULL,
  marketer_id     TEXT NOT NULL REFERENCES users(id),
  network         TEXT,
  external_id     TEXT NOT NULL,                                   -- the network's order id
  gross_cents     INTEGER NOT NULL DEFAULT 0 CHECK (gross_cents >= 0),
  commission_cents INTEGER NOT NULL DEFAULT 0 CHECK (commission_cents >= 0),
  currency        TEXT NOT NULL DEFAULT 'USD',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reversed')),
  note            TEXT,
  created_at      INTEGER NOT NULL,
  decided_at      INTEGER,
  decided_by      TEXT REFERENCES users(id),
  UNIQUE (campaign_id, external_id)
) STRICT;
CREATE INDEX affiliate_conversions_status ON affiliate_conversions(status, created_at);

-- ---------- platform money: listing fees and commissions the platform keeps ----------
CREATE TABLE platform_ledger (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('listing', 'commission', 'adjustment')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents <> 0),
  ref         TEXT,
  note        TEXT,
  created_at  INTEGER NOT NULL
) STRICT;
CREATE INDEX platform_ledger_kind ON platform_ledger(kind, created_at);

-- ---------- the marketer ledger gains an affiliate kind ----------
ALTER TABLE ledger RENAME TO ledger_old;
CREATE TABLE ledger (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  campaign_id     TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('click', 'signup', 'snippet', 'affiliate', 'payout', 'reversal')),
  amount_cents    INTEGER NOT NULL CHECK (amount_cents <> 0),
  ref             TEXT,
  created_at      INTEGER NOT NULL
) STRICT;
INSERT INTO ledger (id, user_id, campaign_id, kind, amount_cents, ref, created_at)
  SELECT id, user_id, campaign_id, kind, amount_cents, ref, created_at FROM ledger_old;
DROP TABLE ledger_old;
CREATE INDEX ledger_user ON ledger(user_id, created_at);
