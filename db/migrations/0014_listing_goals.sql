-- Gorilla Squad · 0014 · one goal per listing: five goals, each with the result it pays for built in.
-- The older types (attention, commission, introduction) stay so existing listings keep working;
-- the app only offers these five for new listings.
INSERT INTO offer_types (id, slug, name, description, criteria, meta, is_approved, created_at, updated_at) VALUES
 ('ot-traffic', 'traffic', 'Drive traffic', 'Share a tracked link. Paid for each unique, real click.',
  '{"terms":{"rate_cents":{"type":"number","min":1,"max":1000000,"label":"Per click"},"daily_cap":{"type":"number","min":1,"max":1000000,"optional":true,"label":"Clicks per creator per day"}}}',
  '{"unit":"click","delivery":null}', 1, 0, 0),
 ('ot-sales', 'sales', 'Get sales', 'Bring in paid orders. Paid a share of each order, or a fixed amount per sale.',
  '{"terms":{"percent":{"type":"number","min":1,"max":90,"optional":true,"label":"Commission"},"amount_cents":{"type":"number","min":1,"max":100000000,"optional":true,"label":"Per sale"}},"one_of":[["percent","amount_cents"]]}',
  '{"unit":"sale","delivery":null}', 1, 0, 0),
 ('ot-newsletter', 'newsletter', 'Grow my newsletter', 'Bring in new subscribers. Paid for each confirmed subscriber.',
  '{"terms":{"rate_cents":{"type":"number","min":1,"max":1000000,"label":"Per subscriber"}}}',
  '{"unit":"subscriber","delivery":null}', 1, 0, 0),
 ('ot-story', 'story', 'Post in your story', 'Post the product in a story that stays up for 24 hours. Paid per story.',
  '{"terms":{"fee_cents":{"type":"number","min":100,"max":100000000,"label":"Per story"}}}',
  '{"unit":"story","delivery":"social_post"}', 1, 0, 0),
 ('ot-review', 'review', 'Review video', 'Film an honest review of the product and post it. Paid per video.',
  '{"terms":{"fee_cents":{"type":"number","min":100,"max":100000000,"label":"Per video"}}}',
  '{"unit":"video","delivery":"video"}', 1, 0, 0);

-- files the seller attaches to the brief (images or videos they own): [{"id":"md_…","kind":"image"}]
ALTER TABLE offers ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(attachments));
