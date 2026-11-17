-- Thebes D1 schema · 0004 · plays, leaderboards, contacts, social, counters, moderation
-- Live scoring and live ranks happen in the leaderboard service (one Durable Object per contest); these tables are
-- what it writes down. Raw activity (views, swipes, dwell) goes to Analytics Engine, not here.

CREATE TABLE players (                                      -- anyone who plays: a signed-in user, or a device before sign-in
  id            TEXT PRIMARY KEY,
  user_id       TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,   -- set when the device signs in (plays carry over)
  device_hash   TEXT UNIQUE,                                -- hash of the anonymous device id cookie
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL
) STRICT;

CREATE TABLE plays (
  id            TEXT PRIMARY KEY,
  contest_id    TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  player_id     TEXT NOT NULL REFERENCES players(id),
  build_id      TEXT,
  status        TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'won', 'lost', 'timeout', 'abandoned')),
  tries         INTEGER NOT NULL DEFAULT 0,
  ms            INTEGER,                                    -- time on the clock, as the server counted it
  score         INTEGER,                                    -- the game's rank key, worked out from scoring (lower is better)
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  source        TEXT,                                       -- 'feed', 'share', 'embed'
  country       TEXT,
  flagged       INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),   -- the service thought it looked wrong
  UNIQUE (contest_id, player_id)                            -- one play per contest per player
) STRICT;
CREATE INDEX plays_rank ON plays(contest_id, status, score) WHERE flagged = 0;
CREATE INDEX plays_player ON plays(player_id, started_at DESC);

CREATE TABLE play_moves (                                   -- every guess, scored on the server: the record a result can be checked against
  play_id       TEXT NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  n             INTEGER NOT NULL,                           -- 1, 2, 3 …
  move          TEXT NOT NULL,                              -- the guess
  result        TEXT NOT NULL CHECK (json_valid(result)),   -- ["absent","present","correct",…]
  at_ms         INTEGER NOT NULL,                           -- ms since the play started
  PRIMARY KEY (play_id, n)
) STRICT;

CREATE TABLE series_stats (                                 -- streaks and bests across a series, per player
  series_id     TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  player_id     TEXT NOT NULL REFERENCES players(id),
  played        INTEGER NOT NULL DEFAULT 0,
  wins          INTEGER NOT NULL DEFAULT 0,
  streak        INTEGER NOT NULL DEFAULT 0,
  best_streak   INTEGER NOT NULL DEFAULT 0,
  best_score    INTEGER,
  last_episode  INTEGER,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (series_id, player_id)
) STRICT;

-- contacts a brand collects at the end of a game, with the consent the player gave
CREATE TABLE entries (
  id            TEXT PRIMARY KEY,
  contest_id    TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  player_id     TEXT NOT NULL REFERENCES players(id),
  play_id       TEXT REFERENCES plays(id),
  email         TEXT COLLATE NOCASE,
  name          TEXT,
  phone         TEXT,
  fields        TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(fields)),   -- anything else the contest asked for
  consent       INTEGER NOT NULL CHECK (consent IN (0, 1)),
  consent_text  TEXT NOT NULL,                              -- the exact words they agreed to
  created_at    INTEGER NOT NULL,
  withdrawn_at  INTEGER,                                    -- the player asked to be removed
  UNIQUE (contest_id, player_id)
) STRICT;
CREATE INDEX entries_company ON entries(company_id, created_at DESC);

-- ---------- social ----------
CREATE TABLE likes (
  contest_id    TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (contest_id, user_id)
) STRICT;
CREATE INDEX likes_user ON likes(user_id, created_at DESC);

CREATE TABLE comments (
  id            TEXT PRIMARY KEY,
  contest_id    TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id     TEXT REFERENCES comments(id) ON DELETE CASCADE,   -- one level of replies
  body          TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  status        TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'removed')),
  created_at    INTEGER NOT NULL,
  edited_at     INTEGER
) STRICT;
CREATE INDEX comments_contest ON comments(contest_id, status, created_at DESC);

CREATE TABLE follows (                                      -- players follow companies
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (user_id, company_id)
) STRICT;
CREATE INDEX follows_company ON follows(company_id);

-- the numbers on the social rail and the seller's dashboard, kept up to date by the events consumer
CREATE TABLE contest_counters (
  contest_id    TEXT PRIMARY KEY REFERENCES contests(id) ON DELETE CASCADE,
  views         INTEGER NOT NULL DEFAULT 0,
  plays         INTEGER NOT NULL DEFAULT 0,
  wins          INTEGER NOT NULL DEFAULT 0,
  likes         INTEGER NOT NULL DEFAULT 0,
  comments      INTEGER NOT NULL DEFAULT 0,
  shares        INTEGER NOT NULL DEFAULT 0,
  entries       INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL
) STRICT;

CREATE TABLE company_counters (
  company_id    TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  followers     INTEGER NOT NULL DEFAULT 0,
  contests      INTEGER NOT NULL DEFAULT 0,
  plays         INTEGER NOT NULL DEFAULT 0,
  entries       INTEGER NOT NULL DEFAULT 0,
  plays_this_period INTEGER NOT NULL DEFAULT 0,            -- for the plan's monthly play limit
  period_start  INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
) STRICT;

-- ---------- moderation ----------
CREATE TABLE reports (
  id            TEXT PRIMARY KEY,
  target_type   TEXT NOT NULL CHECK (target_type IN ('contest', 'comment', 'company', 'user')),
  target_id     TEXT NOT NULL,
  reporter_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason        TEXT NOT NULL CHECK (reason IN ('spam', 'scam', 'offensive', 'copyright', 'other')),
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  handled_by    TEXT REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  handled_at    INTEGER
) STRICT;
CREATE INDEX reports_open ON reports(status, created_at);
