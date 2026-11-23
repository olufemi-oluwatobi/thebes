-- Gorilla Squad · 0018 · app settings an admin can change without a deploy (first: which payment provider takes top-ups)
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_by TEXT,
  updated_at INTEGER NOT NULL
) STRICT;
