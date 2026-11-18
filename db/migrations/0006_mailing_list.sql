-- players opt in to a sponsor's mailing list, separately from entering the draw
ALTER TABLE entries ADD COLUMN mailing_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (mailing_opt_in IN (0, 1));
ALTER TABLE entries ADD COLUMN mailing_opt_in_at INTEGER;
CREATE INDEX entries_mailing ON entries(company_id, mailing_opt_in, created_at DESC);
