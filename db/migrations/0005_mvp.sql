-- Thebes D1 schema · 0005 · what the MVP adds: featured contests, closing, winners

ALTER TABLE contests ADD COLUMN featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1));   -- admins pin to the top of the feed
ALTER TABLE contests ADD COLUMN closed_at INTEGER;                                                 -- when it ended (by time, or by an admin)

-- the winners, written once when a contest closes (a "challenge" has none)
CREATE TABLE contest_winners (
  contest_id    TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  rank          INTEGER NOT NULL CHECK (rank >= 1),
  play_id       TEXT NOT NULL REFERENCES plays(id),
  player_id     TEXT NOT NULL REFERENCES players(id),
  prize_title   TEXT,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (contest_id, rank)
) STRICT;

CREATE INDEX plays_contest_recent ON plays(contest_id, started_at DESC);
CREATE INDEX contests_due ON contests(status, ends_at) WHERE deleted_at IS NULL;
