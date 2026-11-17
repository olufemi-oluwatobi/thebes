-- Thebes D1 schema · 0003 · contests and challenges, their builds, and the design wizard
--
-- A contest is one playable thing in the feed. Its type says how it runs:
--   challenge  one play, no end date, no prize (a branded game to share)
--   contest    a start and an end, a leaderboard, usually a prize
--   daily      one episode of a series that rolls over every day (the series holds the stats)
--   tournament a contest whose leaderboard spans several episodes of a series

CREATE TABLE series (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  game_type_id  TEXT NOT NULL REFERENCES game_types(id),
  slug          TEXT NOT NULL,                              -- 'mamas-daily': also the game's "series" value (streaks, best)
  name          TEXT NOT NULL,                              -- "The Daily Word"
  cadence       TEXT NOT NULL DEFAULT 'daily' CHECK (cadence IN ('daily', 'weekly', 'none')),
  template_id   TEXT REFERENCES templates(id),              -- the look every episode starts from
  created_at    INTEGER NOT NULL,
  UNIQUE (company_id, slug)
) STRICT;

CREATE TABLE contests (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by    TEXT NOT NULL REFERENCES users(id),
  type          TEXT NOT NULL CHECK (type IN ('challenge', 'contest', 'daily', 'tournament')),
  game_type_id  TEXT NOT NULL REFERENCES game_types(id),
  series_id     TEXT REFERENCES series(id),
  episode       INTEGER,                                    -- No. 001 within its series
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,                              -- "The Daily Word"
  subtitle      TEXT,                                       -- "No. 001 · six tries · three minutes"
  description   TEXT,                                       -- the shareable page's text
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'live', 'ended', 'archived', 'removed')),
  visibility    TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
  starts_at     INTEGER,
  ends_at       INTEGER,
  -- the game's public settings (tries, time, series slug …), checked against game_types.settings_schema
  settings      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings)),
  -- what the brand offers and collects
  prize_summary TEXT,                                       -- "Lunch for two" (details per rank in contest_prizes)
  win_message   TEXT,                                       -- said when the game is won
  lose_message  TEXT,
  contact_fields TEXT NOT NULL DEFAULT '["email"]' CHECK (json_valid(contact_fields)),   -- ["email","name","phone"]
  consent_text  TEXT,                                       -- shown next to the contact form; stored with each entry
  terms         TEXT,                                       -- contest rules, required when there is a prize
  -- the build the feed serves
  current_build_id TEXT,
  published_at  INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER,
  UNIQUE (company_id, slug),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CHECK (type <> 'daily' OR series_id IS NOT NULL)
) STRICT;
CREATE INDEX contests_feed ON contests(status, visibility, starts_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX contests_company ON contests(company_id, created_at DESC);
CREATE INDEX contests_series ON contests(series_id, episode);

CREATE TABLE contest_secrets (                              -- kept apart so no feed or page query can read it by accident
  contest_id    TEXT PRIMARY KEY REFERENCES contests(id) ON DELETE CASCADE,
  secrets       TEXT NOT NULL CHECK (json_valid(secrets))   -- {"word":"toast"}; only the leaderboard service reads this
) STRICT;

CREATE TABLE contest_prizes (
  contest_id    TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  rank_from     INTEGER NOT NULL CHECK (rank_from >= 1),
  rank_to       INTEGER NOT NULL,
  title         TEXT NOT NULL,                              -- "Lunch for two"
  details       TEXT,
  value_cents   INTEGER,
  currency      TEXT,
  PRIMARY KEY (contest_id, rank_from),
  CHECK (rank_to >= rank_from)
) STRICT;

-- which asset went into which slot of the template (logo → $logo, a photo → $hero …)
CREATE TABLE contest_assets (
  contest_id    TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  slot          TEXT NOT NULL,                              -- a slot name from the template manifest
  asset_id      TEXT NOT NULL REFERENCES assets(id),
  PRIMARY KEY (contest_id, slot)
) STRICT;

-- every compiled version of a contest's game: template + slot values → .gt → page in R2
CREATE TABLE contest_builds (
  id            TEXT PRIMARY KEY,
  contest_id    TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  template_id   TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  slot_values   TEXT NOT NULL CHECK (json_valid(slot_values)),   -- what filled the template (no secrets: the word goes in as $word only on the server)
  source_key    TEXT NOT NULL,                              -- R2: the filled .gt
  page_key      TEXT,                                       -- R2: the built page the play domain serves
  poster_key    TEXT,                                       -- R2: still for the feed and link previews
  engine        TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('building', 'ok', 'failed')),
  diagnostics   TEXT CHECK (diagnostics IS NULL OR json_valid(diagnostics)),
  made_by       TEXT NOT NULL CHECK (made_by IN ('wizard', 'user', 'system')),
  session_id    TEXT,                                       -- the wizard session that made it
  created_by    TEXT REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  UNIQUE (contest_id, version),
  FOREIGN KEY (template_id, template_version) REFERENCES template_versions(template_id, version)
) STRICT;

-- ---------- the design wizard ----------
-- Steps: game → template → assets → brief → design (AI fills the template's slots) → tweak → publish.
CREATE TABLE design_sessions (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id),
  contest_id    TEXT REFERENCES contests(id) ON DELETE SET NULL,   -- made at the first design
  step          TEXT NOT NULL DEFAULT 'game' CHECK (step IN ('game', 'template', 'assets', 'brief', 'design', 'tweak', 'publish', 'done')),
  game_type_id  TEXT REFERENCES game_types(id),
  template_id   TEXT REFERENCES templates(id),
  template_version INTEGER,
  asset_ids     TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(asset_ids)),   -- what the user picked or uploaded
  brief         TEXT,                                       -- their text or prompt: "Daily word for the diner, prize is lunch, playful"
  settings      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings)),   -- type, dates, tries, time, prize, contact fields
  slot_values   TEXT CHECK (slot_values IS NULL OR json_valid(slot_values)),   -- the AI's current fill, after checks
  build_id      TEXT,                                       -- latest preview build
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'published', 'abandoned')),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
) STRICT;
CREATE INDEX design_sessions_company ON design_sessions(company_id, updated_at DESC);

CREATE TABLE design_turns (                                 -- each design or tweak: what was asked, what changed
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES design_sessions(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('design', 'tweak', 'repair')),
  request       TEXT,                                       -- the user's words for a tweak ("make the prize line shorter")
  patch         TEXT NOT NULL CHECK (json_valid(patch)),    -- slot values changed in this turn
  model         TEXT,
  tokens_in     INTEGER,
  tokens_out    INTEGER,
  ms            INTEGER,
  ok            INTEGER NOT NULL CHECK (ok IN (0, 1)),
  error         TEXT,
  created_at    INTEGER NOT NULL
) STRICT;
CREATE INDEX design_turns_session ON design_turns(session_id, created_at);
