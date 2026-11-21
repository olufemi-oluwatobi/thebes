-- Gorilla Squad: media (images, videos, creator videos), product categories, offer budgets and funding.
-- Money is tracked here, not moved: the budget is a promise, an admin records the payment (manually at first), and verified
-- deliveries draw it down. Payouts to marketers stay outside the platform for now.

-- ---------- media: stored in R2 (BUCKET), described here ----------
-- image         product placement images and screenshots
-- video         product demo / brief videos made by the seller
-- creator_video a video made by a marketer or creator (a delivery's proof, or a sample for the seller)
CREATE TABLE media (
  id              TEXT PRIMARY KEY,
  owner_user_id   TEXT NOT NULL REFERENCES users(id),
  kind            TEXT NOT NULL CHECK (kind IN ('image', 'video', 'creator_video')),
  r2_key          TEXT NOT NULL UNIQUE,
  mime            TEXT NOT NULL,
  bytes           INTEGER NOT NULL CHECK (bytes > 0),
  sha256          TEXT,
  width           INTEGER,
  height          INTEGER,
  duration_ms     INTEGER,
  poster_media_id TEXT REFERENCES media(id),
  caption         TEXT,
  is_verified     INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  is_deleted      INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  is_blocked      INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1)),
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
) STRICT;
CREATE INDEX media_owner ON media(owner_user_id, created_at);

-- a product's gallery, in order. role: cover (the placement image), gallery, screenshot (software), demo (video)
CREATE TABLE product_media (
  product_id TEXT NOT NULL REFERENCES products(id),
  media_id   TEXT NOT NULL REFERENCES media(id),
  role       TEXT NOT NULL DEFAULT 'gallery' CHECK (role IN ('cover', 'gallery', 'screenshot', 'demo')),
  position   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, media_id)
) STRICT;
CREATE INDEX product_media_order ON product_media(product_id, position);

-- ---------- products: category and cover ----------
ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'physical' CHECK (category IN ('physical', 'digital', 'software', 'service', 'content', 'other'));
ALTER TABLE products ADD COLUMN cover_media_id TEXT REFERENCES media(id);

-- ---------- offers: brief video and financials ----------
-- budget_cents is what the seller will spend in total (null: no cap, settled between the two sides)
-- payout_cap_cents is the most one marketer can earn on the offer
-- platform_fee_bps is the listing fee on the budget (500 = 5%); payment_due = budget + fee
-- funded_cents is what an admin has recorded as received; funding_status follows it
ALTER TABLE offers ADD COLUMN video_media_id TEXT REFERENCES media(id);
ALTER TABLE offers ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES', 'ZAR'));
ALTER TABLE offers ADD COLUMN budget_cents INTEGER CHECK (budget_cents IS NULL OR budget_cents > 0);
ALTER TABLE offers ADD COLUMN payout_cap_cents INTEGER CHECK (payout_cap_cents IS NULL OR payout_cap_cents > 0);
ALTER TABLE offers ADD COLUMN platform_fee_bps INTEGER NOT NULL DEFAULT 500 CHECK (platform_fee_bps BETWEEN 0 AND 5000);
ALTER TABLE offers ADD COLUMN funding_status TEXT NOT NULL DEFAULT 'unfunded' CHECK (funding_status IN ('unfunded', 'funded', 'refunded'));
ALTER TABLE offers ADD COLUMN funded_cents INTEGER NOT NULL DEFAULT 0 CHECK (funded_cents >= 0);
ALTER TABLE offers ADD COLUMN funded_at INTEGER;
ALTER TABLE offers ADD COLUMN funded_by TEXT REFERENCES users(id);
ALTER TABLE offers ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0);

-- ---------- deliveries: what was shown, and what it earned ----------
ALTER TABLE deliveries ADD COLUMN media_id TEXT REFERENCES media(id);
ALTER TABLE deliveries ADD COLUMN amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0);

-- the attention type no longer carries its own budget: the offer does
UPDATE offer_types SET criteria = json_remove(criteria, '$.terms.budget_cents') WHERE slug = 'attention';
