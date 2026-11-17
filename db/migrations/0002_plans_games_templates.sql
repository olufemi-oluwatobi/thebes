-- Thebes D1 schema · 0002 · tiers (free and paid), game types, design templates

-- ---------- tiers ----------
CREATE TABLE plans (
  id            TEXT PRIMARY KEY,                           -- 'free', 'pro', 'business'
  name          TEXT NOT NULL,
  rank          INTEGER NOT NULL UNIQUE,                    -- 0 free, 10 pro, 20 business: "needs at least" compares ranks
  price_cents   INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency      TEXT NOT NULL DEFAULT 'USD',
  interval      TEXT NOT NULL DEFAULT 'month' CHECK (interval IN ('month', 'year', 'none')),
  -- what the tier allows; the API reads these, nothing is hard-coded
  limits        TEXT NOT NULL CHECK (json_valid(limits)),   -- see db/seed/0001_plans_games.sql
  is_public     INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  created_at    INTEGER NOT NULL
) STRICT;

CREATE TABLE subscriptions (                                -- one current row per company; billing provider comes later
  company_id    TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  plan_id       TEXT NOT NULL REFERENCES plans(id),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled')),
  period_start  INTEGER NOT NULL,
  period_end    INTEGER,                                    -- null for free
  provider      TEXT CHECK (provider IN ('stripe', 'paystack', 'manual')),
  provider_ref  TEXT,
  updated_at    INTEGER NOT NULL
) STRICT;

-- ---------- game types: what can be played ----------
CREATE TABLE game_types (
  id            TEXT PRIMARY KEY,                           -- 'wordle' (the godtongue game kind)
  name          TEXT NOT NULL,                              -- "Daily Word"
  tagline       TEXT,                                       -- shown on the wizard's game tile
  status        TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('soon', 'beta', 'live', 'retired')),
  min_plan_id   TEXT NOT NULL DEFAULT 'free' REFERENCES plans(id),
  -- the challenge settings a contest of this game must carry, as JSON Schema
  -- (wordle: word, tries, time, series); the word is a secret and is stored in contest_secrets
  settings_schema TEXT NOT NULL CHECK (json_valid(settings_schema)),
  secret_fields TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(secret_fields)),   -- ["word"]: never sent to a browser
  scoring       TEXT NOT NULL CHECK (json_valid(scoring)),  -- how plays rank: {"order":[["tries","asc"],["ms","asc"]],"win":"solved"}
  engine        TEXT NOT NULL,                              -- godtongue engine + version that runs it: "game@1"
  icon_key      TEXT,                                       -- R2 key of the tile art
  sort          INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
) STRICT;

-- ---------- templates: designed skins the wizard fills ----------
CREATE TABLE templates (
  id            TEXT PRIMARY KEY,                           -- 'pop-player'
  game_type_id  TEXT NOT NULL REFERENCES game_types(id),
  family        TEXT NOT NULL,                              -- 'pop' (flat, full colour), 'analog' (lit, skeuomorphic)
  name          TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('draft', 'live', 'retired')),
  min_plan_id   TEXT NOT NULL DEFAULT 'free' REFERENCES plans(id),
  current_version INTEGER NOT NULL DEFAULT 1,
  poster_key    TEXT,                                       -- R2: what the wizard shows on the template tile
  sort          INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
) STRICT;
CREATE INDEX templates_game ON templates(game_type_id, status);

CREATE TABLE template_versions (                            -- immutable: a contest pins the version it was built from
  template_id   TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  source_key    TEXT NOT NULL,                              -- R2: the template .gt (with $slots)
  slots         TEXT NOT NULL CHECK (json_valid(slots)),    -- the manifest: every $slot, its type and limits (docs/wizard.md)
  engine        TEXT NOT NULL,                              -- "game@1"
  notes         TEXT,
  created_by    TEXT REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (template_id, version)
) STRICT;
