-- Gorilla Squad · 0009 · campaigns (products to promote), marketer links, verified clicks, sign-up conversions,
-- post proofs, the earnings ledger and payout requests. The games tables above are kept as they are.
-- Conventions as before: TEXT ids, INTEGER ms times, STRICT tables, money in US cents.

-- marketers: where they are and how to reach them (phone for WhatsApp / SMS checks)
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN city TEXT;
ALTER TABLE users ADD COLUMN country TEXT;                         -- ISO 3166-1 alpha-2, e.g. NG, CH, US

-- a campaign is one product a seller wants shared, with the reward rule and where it may be shared
CREATE TABLE campaigns (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,   -- the seller
  title           TEXT NOT NULL,
  product_url     TEXT NOT NULL,                                 -- the seller's own affiliate or checkout link
  snippet         TEXT NOT NULL,                                 -- the pitch marketers copy and post
  image_asset_id  TEXT REFERENCES assets(id),                    -- the flyer
  reward_rule     TEXT NOT NULL CHECK (reward_rule IN ('click', 'signup', 'snippet')),
  reward_cents    INTEGER NOT NULL CHECK (reward_cents BETWEEN 1 AND 100000),
  locations       TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(locations)),  -- ["NG:Lagos", "CH:Zurich"] or ["*"] for everywhere
  budget_cents    INTEGER NOT NULL DEFAULT 0 CHECK (budget_cents >= 0),       -- funded so far (see fundings)
  spent_cents     INTEGER NOT NULL DEFAULT 0 CHECK (spent_cents >= 0),        -- paid out against the budget so far
  postback_key    TEXT NOT NULL UNIQUE,                          -- the seller's site reports sign-ups with this key
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'live', 'paused', 'ended')),
  created_by      TEXT NOT NULL REFERENCES users(id),
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER,
  CHECK (spent_cents <= budget_cents)
) STRICT;
CREATE INDEX campaigns_board ON campaigns(status, budget_cents) WHERE deleted_at IS NULL;
CREATE INDEX campaigns_company ON campaigns(company_id);

-- money the seller has put in (a bank transfer confirmed by an admin, until a payment provider is connected)
CREATE TABLE fundings (
  id              TEXT PRIMARY KEY,
  campaign_id     TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  reference       TEXT,                                          -- the transfer reference the admin checked
  created_at      INTEGER NOT NULL
) STRICT;

-- one short link per marketer per campaign: gorillasquad.co/s/<code>
CREATE TABLE campaign_links (
  code            TEXT PRIMARY KEY,
  campaign_id     TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  marketer_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      INTEGER NOT NULL,
  UNIQUE (campaign_id, marketer_id)
) STRICT;

-- every visit through a short link; only verified ones earn
CREATE TABLE clicks (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL REFERENCES campaign_links(code) ON DELETE CASCADE,
  campaign_id     TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  marketer_id     TEXT NOT NULL REFERENCES users(id),
  device_hash     TEXT NOT NULL,                                 -- hash of IP + browser: never the raw values
  country         TEXT,
  verified        INTEGER NOT NULL CHECK (verified IN (0, 1)),
  reason          TEXT,                                          -- why it did not count: duplicate, bot, hosting, budget
  reward_cents    INTEGER NOT NULL DEFAULT 0 CHECK (reward_cents >= 0),
  created_at      INTEGER NOT NULL
) STRICT;
CREATE INDEX clicks_dedupe ON clicks(code, device_hash, created_at);
CREATE INDEX clicks_marketer ON clicks(marketer_id, created_at);

-- the seller's site reports a sign-up for a verified click (reward rule: per sign-up)
CREATE TABLE conversions (
  click_id        TEXT PRIMARY KEY REFERENCES clicks(id) ON DELETE CASCADE,
  campaign_id     TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  marketer_id     TEXT NOT NULL REFERENCES users(id),
  reward_cents    INTEGER NOT NULL CHECK (reward_cents >= 0),
  created_at      INTEGER NOT NULL
) STRICT;

-- proof of a post (reward rule: per snippet). An admin checks the post is live before it pays.
CREATE TABLE proofs (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL REFERENCES campaign_links(code) ON DELETE CASCADE,
  campaign_id     TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  marketer_id     TEXT NOT NULL REFERENCES users(id),
  post_url        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reward_cents    INTEGER NOT NULL DEFAULT 0 CHECK (reward_cents >= 0),
  created_at      INTEGER NOT NULL,
  decided_at      INTEGER,
  UNIQUE (campaign_id, post_url)
) STRICT;

-- every earning and payout, so the balance is always the sum of rows
CREATE TABLE ledger (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  campaign_id     TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('click', 'signup', 'snippet', 'payout', 'reversal')),
  amount_cents    INTEGER NOT NULL CHECK (amount_cents <> 0),    -- earnings are positive, payouts and reversals negative
  ref             TEXT,
  created_at      INTEGER NOT NULL
) STRICT;
CREATE INDEX ledger_user ON ledger(user_id, created_at);

-- a marketer asks to be paid out of their cleared balance; the admin pays it by hand in a weekly batch
CREATE TABLE payouts (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  method          TEXT NOT NULL CHECK (method IN ('bank', 'paypal', 'usdt')),
  account         TEXT NOT NULL,                                 -- bank account, PayPal email or USDT address
  status          TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'paid', 'rejected')),
  note            TEXT,
  created_at      INTEGER NOT NULL,
  decided_at      INTEGER
) STRICT;
CREATE INDEX payouts_status ON payouts(status, created_at);

-- marketer preferences (the "preference doc"): default board scope and categories they want to see
ALTER TABLE users ADD COLUMN prefs TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(prefs));
