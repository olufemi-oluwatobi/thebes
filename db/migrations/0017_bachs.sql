-- Gorilla Squad · 0017 · Bachs: top-ups paid through hosted checkout, confirmed by signed webhooks
ALTER TABLE topups ADD COLUMN provider TEXT;                -- 'bachs', or null when an admin credits it by hand
ALTER TABLE topups ADD COLUMN provider_ref TEXT;            -- the Bachs checkout id (chk_…)
ALTER TABLE topups ADD COLUMN checkout_url TEXT;
ALTER TABLE topups ADD COLUMN paid_cents INTEGER;           -- what was actually collected
ALTER TABLE topups ADD COLUMN note TEXT;
CREATE INDEX topups_provider_ref ON topups(provider_ref);
-- a top-up can only ever be credited once, however many times a webhook (or an admin) tries
CREATE UNIQUE INDEX wallet_topup_once ON wallet_entries(ref_id) WHERE kind = 'topup';
-- every webhook we accept, so a repeated delivery is recognised and ignored
CREATE TABLE provider_events (
  id          TEXT PRIMARY KEY,   -- Bachs event id (evt_…)
  provider    TEXT NOT NULL,
  type        TEXT NOT NULL,
  payload     TEXT NOT NULL,
  result      TEXT,
  received_at INTEGER NOT NULL
) STRICT;
