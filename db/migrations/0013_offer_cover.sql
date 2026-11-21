-- Gorilla Squad · 0013 · a listing can have its own thumbnail (else the product's cover is used)
ALTER TABLE offers ADD COLUMN cover_media_id TEXT REFERENCES media(id);
-- money terms are entered in currency units in the app; the labels say what they are, not how they are stored
UPDATE offer_types SET criteria = json_set(criteria, '$.terms.rate_cents.label', 'Rate') WHERE slug = 'attention';
UPDATE offer_types SET criteria = json_set(criteria, '$.terms.min_contract_cents.label', 'Minimum contract') WHERE slug = 'introduction';
