-- Gorilla Squad · 0015 · creator profiles: niches and languages, bio-code account verification, and seller ratings
ALTER TABLE marketers ADD COLUMN niches TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(niches));
ALTER TABLE marketers ADD COLUMN languages TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(languages));
-- the code a creator puts in their bio to prove the account is theirs, when they asked us to check,
-- and the follower count we saw when we verified it
ALTER TABLE socials ADD COLUMN verify_code TEXT;
ALTER TABLE socials ADD COLUMN verify_requested_at INTEGER;
ALTER TABLE socials ADD COLUMN verified_followers INTEGER;
-- one rating per deal, given by the seller (1 to 5 stars)
CREATE TABLE ratings (
  id              TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL UNIQUE REFERENCES relationships(id),
  marketer_id     TEXT NOT NULL REFERENCES marketers(id),
  rater_user_id   TEXT NOT NULL REFERENCES users(id),
  stars           INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  note            TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
) STRICT;
CREATE INDEX ratings_marketer ON ratings(marketer_id, created_at);
