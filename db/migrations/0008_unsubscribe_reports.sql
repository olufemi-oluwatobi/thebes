-- Mailing list: when a player left a sponsor's list (their opt-in is cleared; the time is kept). Re-joining clears it.
ALTER TABLE entries ADD COLUMN mailing_unsubscribed_at INTEGER;
-- Player reports: which player sent a report, so each player reports a game once (guests included).
ALTER TABLE reports ADD COLUMN player_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS reports_once_per_player ON reports(target_type, target_id, player_id);
