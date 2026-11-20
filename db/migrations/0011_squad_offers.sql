-- Gorilla Squad · 0011 · the offer model. Replaces campaigns, links, clicks, wallet and payouts (0009, 0010).
-- users · companies · sellers · marketers · socials · products · offer_types · offers · interests · relationships
-- delivery_types · deliveries · messages. Every main row carries is_verified, is_deleted and is_blocked.
-- The Thebes games tables are untouched.

-- ---------- remove the campaign system (children first) ----------
DROP TABLE IF EXISTS affiliate_conversions;
DROP TABLE IF EXISTS listing_charges;
DROP TABLE IF EXISTS platform_ledger;
DROP TABLE IF EXISTS ledger;
DROP TABLE IF EXISTS payouts;
DROP TABLE IF EXISTS proofs;
DROP TABLE IF EXISTS conversions;
DROP TABLE IF EXISTS clicks;
DROP TABLE IF EXISTS campaign_links;
DROP TABLE IF EXISTS fundings;
DROP TABLE IF EXISTS campaigns;

ALTER TABLE users DROP COLUMN phone;
ALTER TABLE users DROP COLUMN city;
ALTER TABLE users DROP COLUMN country;
ALTER TABLE users DROP COLUMN prefs;
ALTER TABLE users DROP COLUMN squad_channel;
ALTER TABLE users DROP COLUMN social_platform;
ALTER TABLE users DROP COLUMN social_handle;
ALTER TABLE users DROP COLUMN social_url;
ALTER TABLE users DROP COLUMN audience;
ALTER TABLE users DROP COLUMN squad_proof;
ALTER TABLE users DROP COLUMN squad_status;
ALTER TABLE users DROP COLUMN squad_note;
ALTER TABLE users DROP COLUMN squad_verified_at;
-- squad_verified_by stays: SQLite cannot drop a column that is a foreign key. It is unused.
ALTER TABLE companies DROP COLUMN listing_credits;

-- ---------- users and companies: names and flags ----------
ALTER TABLE users ADD COLUMN first_name  TEXT;
ALTER TABLE users ADD COLUMN last_name   TEXT;
ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1));
ALTER TABLE users ADD COLUMN is_deleted  INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1));
ALTER TABLE users ADD COLUMN is_blocked  INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1));

ALTER TABLE companies ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1));
ALTER TABLE companies ADD COLUMN is_deleted  INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1));
ALTER TABLE companies ADD COLUMN is_blocked  INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1));

-- ---------- the two sides ----------
CREATE TABLE sellers (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL UNIQUE REFERENCES users(id),
  company_id    TEXT REFERENCES companies(id),
  bio           TEXT,
  is_verified   INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  is_deleted    INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  is_blocked    INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1)),
  verified_by   TEXT REFERENCES users(id),
  verified_at   INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
) STRICT;

CREATE TABLE marketers (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL UNIQUE REFERENCES users(id),
  country       TEXT NOT NULL CHECK (length(country) = 2),     -- ISO 3166-1 alpha-2, upper case
  city          TEXT,
  bio           TEXT,
  is_verified   INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  is_deleted    INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  is_blocked    INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1)),
  verified_by   TEXT REFERENCES users(id),
  verified_at   INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
) STRICT;

-- a marketer's accounts: what they claim, and whether we checked it
CREATE TABLE socials (
  id                 TEXT PRIMARY KEY,
  marketer_id        TEXT NOT NULL REFERENCES marketers(id),
  platform           TEXT NOT NULL,
  handle             TEXT NOT NULL COLLATE NOCASE,
  url                TEXT,
  followers          INTEGER NOT NULL DEFAULT 0 CHECK (followers >= 0),
  audience_countries TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(audience_countries)),
  is_verified        INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  is_deleted         INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  is_blocked         INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1)),
  verified_by        TEXT REFERENCES users(id),
  verified_at        INTEGER,
  verification_note  TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
) STRICT;
CREATE UNIQUE INDEX socials_one_owner ON socials(platform, handle) WHERE is_deleted = 0;
CREATE INDEX socials_marketer ON socials(marketer_id);

-- ---------- what is sold ----------
CREATE TABLE products (
  id             TEXT PRIMARY KEY,
  seller_id      TEXT NOT NULL REFERENCES sellers(id),
  company_id     TEXT REFERENCES companies(id),
  name           TEXT NOT NULL,
  description    TEXT NOT NULL,
  url            TEXT,
  details        TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details)),
  image_asset_id TEXT REFERENCES assets(id),
  is_flagged     INTEGER NOT NULL DEFAULT 0 CHECK (is_flagged IN (0, 1)),
  flag_reason    TEXT,
  flagged_by     TEXT REFERENCES users(id),
  is_verified    INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  is_deleted     INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  is_blocked     INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1)),
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
) STRICT;
CREATE INDEX products_seller ON products(seller_id);

-- ---------- types: proposed by users, approved by an admin ----------
-- criteria.terms says what an offer of this type must state, e.g. {"terms":{"percent":{"type":"number","min":1,"max":90}}}
CREATE TABLE offer_types (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,
  criteria      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(criteria)),
  meta          TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(meta)),
  created_by    TEXT REFERENCES users(id),                      -- null: built in
  is_approved   INTEGER NOT NULL DEFAULT 0 CHECK (is_approved IN (0, 1)),
  approved_by   TEXT REFERENCES users(id),
  is_deleted    INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
) STRICT;

-- criteria: {"needs_social":true,"proof":"url"}
CREATE TABLE delivery_types (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,
  criteria      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(criteria)),
  meta          TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(meta)),
  created_by    TEXT REFERENCES users(id),
  is_approved   INTEGER NOT NULL DEFAULT 0 CHECK (is_approved IN (0, 1)),
  approved_by   TEXT REFERENCES users(id),
  is_deleted    INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
) STRICT;

-- ---------- offers, interest, and the relationship ----------
-- requirements: {"min_followers":5000,"countries":["US"],"audience_countries":["US"],"platforms":["youtube"],"delivery_types":["video"],"verified_only":true}
CREATE TABLE offers (
  id                 TEXT PRIMARY KEY,
  product_id         TEXT NOT NULL REFERENCES products(id),
  offer_type_id      TEXT NOT NULL REFERENCES offer_types(id),
  title              TEXT NOT NULL,
  description        TEXT,
  terms              TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(terms)),
  requirements       TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(requirements)),
  max_relationships  INTEGER CHECK (max_relationships IS NULL OR max_relationships > 0),
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paused', 'closed')),
  is_verified        INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  is_deleted         INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  is_blocked         INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1)),
  created_by         TEXT NOT NULL REFERENCES users(id),
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
) STRICT;
CREATE INDEX offers_browse ON offers(status, created_at) WHERE is_deleted = 0;
CREATE INDEX offers_product ON offers(product_id);

-- a marketer asks to take an offer; the seller accepts or denies it
CREATE TABLE interests (
  id            TEXT PRIMARY KEY,
  offer_id      TEXT NOT NULL REFERENCES offers(id),
  marketer_id   TEXT NOT NULL REFERENCES marketers(id),
  social_id     TEXT REFERENCES socials(id),
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'denied', 'withdrawn')),
  decided_by    TEXT REFERENCES users(id),
  decided_at    INTEGER,
  decision_note TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
) STRICT;
CREATE UNIQUE INDEX interests_one_pending ON interests(offer_id, marketer_id) WHERE status = 'pending';  -- live work is guarded by relationships_one_live
CREATE INDEX interests_marketer ON interests(marketer_id, created_at);

-- one offer, many relationships (one per marketer at a time); terms are frozen when the interest is accepted
CREATE TABLE relationships (
  id             TEXT PRIMARY KEY,
  offer_id       TEXT NOT NULL REFERENCES offers(id),
  marketer_id    TEXT NOT NULL REFERENCES marketers(id),
  interest_id    TEXT NOT NULL UNIQUE REFERENCES interests(id),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  terms_snapshot TEXT NOT NULL CHECK (json_valid(terms_snapshot)),
  ended_by       TEXT REFERENCES users(id),
  ended_reason   TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  ended_at       INTEGER
) STRICT;
CREATE UNIQUE INDEX relationships_one_live ON relationships(offer_id, marketer_id) WHERE status <> 'ended';
CREATE INDEX relationships_marketer ON relationships(marketer_id);

-- what the marketer did, and whether the seller (or an admin) verified it
CREATE TABLE deliveries (
  id                TEXT PRIMARY KEY,
  relationship_id   TEXT NOT NULL REFERENCES relationships(id),
  delivery_type_id  TEXT NOT NULL REFERENCES delivery_types(id),
  social_id         TEXT REFERENCES socials(id),
  proof_url         TEXT,
  note              TEXT,
  status            TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'rejected')),
  is_verified       INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  verified_by       TEXT REFERENCES users(id),
  verified_at       INTEGER,
  verification_note TEXT,
  is_deleted        INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  CHECK (proof_url IS NOT NULL OR note IS NOT NULL)
) STRICT;
CREATE UNIQUE INDEX deliveries_one_proof ON deliveries(relationship_id, proof_url) WHERE proof_url IS NOT NULL AND is_deleted = 0;
CREATE INDEX deliveries_relationship ON deliveries(relationship_id, created_at);

CREATE TABLE messages (
  id               TEXT PRIMARY KEY,
  relationship_id  TEXT NOT NULL REFERENCES relationships(id),
  sender_id        TEXT NOT NULL REFERENCES users(id),
  body             TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  is_deleted       INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at       INTEGER NOT NULL,
  read_at          INTEGER
) STRICT;
CREATE INDEX messages_relationship ON messages(relationship_id, created_at);

-- ---------- built-in types ----------
INSERT INTO offer_types (id, slug, name, description, criteria, meta, is_approved, created_at, updated_at) VALUES
 ('ot-commission', 'commission', 'Sell for commission', 'Sell the product and keep a share of every sale you bring.',
  '{"terms":{"percent":{"type":"number","min":1,"max":90,"label":"Commission %"},"cookie_days":{"type":"number","min":1,"max":365,"optional":true,"label":"Attribution window (days)"}}}', '{"icon":"cash"}', 1, 0, 0),
 ('ot-attention', 'attention', 'Sponsored post', 'Post about the product on your accounts and get paid for the attention.',
  '{"terms":{"rate_cents":{"type":"number","min":1,"max":10000000,"label":"Rate (cents)"},"per":{"type":"string","enum":["click","view","post"],"label":"Paid per"},"budget_cents":{"type":"number","min":100,"optional":true,"label":"Budget (cents)"}}}', '{"icon":"speakerphone"}', 1, 0, 0),
 ('ot-introduction', 'introduction', 'Introduction', 'Introduce the product to a company that needs it and share in the contract.',
  '{"terms":{"share_percent":{"type":"number","min":1,"max":50,"label":"Share of contract %"},"min_contract_cents":{"type":"number","min":0,"optional":true,"label":"Minimum contract (cents)"}}}', '{"icon":"briefcase"}', 1, 0, 0);

INSERT INTO delivery_types (id, slug, name, description, criteria, meta, is_approved, created_at, updated_at) VALUES
 ('dt-social-post', 'social_post', 'Social post', 'A post on one of your social accounts.', '{"needs_social":true,"proof":"url"}', '{}', 1, 0, 0),
 ('dt-video', 'video', 'Video', 'A video or a mention in one.', '{"needs_social":true,"proof":"url"}', '{}', 1, 0, 0),
 ('dt-newsletter', 'newsletter', 'Newsletter', 'A mention in your newsletter or mailing list.', '{"needs_social":true,"proof":"url"}', '{}', 1, 0, 0),
 ('dt-group-share', 'group_share', 'Group share', 'A share in a group or community you belong to.', '{"needs_social":true,"proof":"any"}', '{}', 1, 0, 0),
 ('dt-in-person', 'in_person', 'In person', 'Flyers, events or word of mouth.', '{"needs_social":false,"proof":"any"}', '{}', 1, 0, 0),
 ('dt-introduction', 'introduction', 'Introduction', 'A direct introduction to a decision maker.', '{"needs_social":false,"proof":"any"}', '{}', 1, 0, 0);
