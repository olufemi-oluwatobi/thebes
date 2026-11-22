-- Gorilla Squad · 0016 · wallets
-- A wallet is the sum of its entries: money in is positive, money out is negative. Entries are never changed.
--   top-up credited          +amount   (seller puts money in)
--   job hold                 -budget   (interest accepted: the budget per interest leaves the seller's wallet and is held for the job)
--   fee                      -fee      (our fee, taken with the hold)
--   job refund               +budget +fee back (an admin cancels the job)
--   earning                  +budget   (an admin marks the job done: the marketer's wallet is credited)
--   payout                   -amount   (a withdrawal request; given back if the payout is cancelled)
CREATE TABLE wallet_entries (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  currency     TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('topup', 'hold', 'fee', 'refund', 'earning', 'payout', 'payout_return', 'adjust')),
  ref_id       TEXT,
  note         TEXT,
  created_by   TEXT REFERENCES users(id),
  created_at   INTEGER NOT NULL
) STRICT;
CREATE INDEX wallet_entries_user ON wallet_entries(user_id, currency, created_at);

-- money put in. Until a payment provider is connected, an admin credits it once the money lands.
CREATE TABLE topups (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  currency     TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  reference    TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'credited', 'cancelled')),
  decided_by   TEXT REFERENCES users(id),
  decided_at   INTEGER,
  created_at   INTEGER NOT NULL
) STRICT;
CREATE INDEX topups_status ON topups(status, created_at);

-- the budget held for one accepted interest (one job)
CREATE TABLE holds (
  id               TEXT PRIMARY KEY,
  relationship_id  TEXT NOT NULL UNIQUE REFERENCES relationships(id),
  seller_user_id   TEXT NOT NULL REFERENCES users(id),
  marketer_user_id TEXT NOT NULL REFERENCES users(id),
  currency         TEXT NOT NULL,
  amount_cents     INTEGER NOT NULL CHECK (amount_cents > 0),
  fee_cents        INTEGER NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  status           TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'refunded')),
  decided_by       TEXT REFERENCES users(id),
  decided_at       INTEGER,
  note             TEXT,
  created_at       INTEGER NOT NULL
) STRICT;
CREATE INDEX holds_status ON holds(status, created_at);

-- money taken out
CREATE TABLE payouts (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  currency     TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  method       TEXT NOT NULL CHECK (method IN ('bank', 'mobile_money', 'crypto')),
  details      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'paid', 'cancelled')),
  decided_by   TEXT REFERENCES users(id),
  decided_at   INTEGER,
  note         TEXT,
  created_at   INTEGER NOT NULL
) STRICT;
CREATE INDEX payouts_status ON payouts(status, created_at);

-- what one accepted interest costs: held from the seller's wallet when they accept
ALTER TABLE offers ADD COLUMN job_budget_cents INTEGER CHECK (job_budget_cents IS NULL OR job_budget_cents > 0);
