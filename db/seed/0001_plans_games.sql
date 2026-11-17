-- Thebes seed · tiers, the first game type, the first two templates.
-- Template sources live in R2 at templates/<id>/v<n>.gt (copied from godtongue/examples/games); slots are their manifests.

INSERT INTO plans (id, name, rank, price_cents, currency, interval, limits, created_at) VALUES
('free', 'Free', 0, 0, 'USD', 'none', json('{
  "active_contests": 1, "plays_per_month": 1000, "members": 1,
  "ai_designs_per_month": 10, "contact_export": false, "prizes": false,
  "analytics_days": 7, "remove_thebes_mark": false, "custom_domain": false, "scheduled_series": false
}'), 1763337600000),
('pro', 'Pro', 10, 2900, 'USD', 'month', json('{
  "active_contests": 5, "plays_per_month": 25000, "members": 5,
  "ai_designs_per_month": 200, "contact_export": true, "prizes": true,
  "analytics_days": 90, "remove_thebes_mark": false, "custom_domain": false, "scheduled_series": true
}'), 1763337600000),
('business', 'Business', 20, 9900, 'USD', 'month', json('{
  "active_contests": null, "plays_per_month": 250000, "members": 25,
  "ai_designs_per_month": 2000, "contact_export": true, "prizes": true,
  "analytics_days": 365, "remove_thebes_mark": true, "custom_domain": true, "scheduled_series": true
}'), 1763337600000);
-- null in a limit means no limit. Prices are placeholders until billing is decided.

INSERT INTO game_types (id, name, tagline, status, min_plan_id, settings_schema, secret_fields, scoring, engine, sort, created_at) VALUES
('wordle', 'Daily Word', 'Guess the five-letter word in six tries.', 'live', 'free',
 json('{
   "type": "object",
   "required": ["word"],
   "properties": {
     "word":   { "type": "string", "pattern": "^[a-z]{5}$" },
     "tries":  { "type": "integer", "minimum": 1, "maximum": 10, "default": 6 },
     "time":   { "type": ["integer", "null"], "minimum": 10, "maximum": 3600, "default": null },
     "series": { "type": ["string", "null"], "pattern": "^[a-z0-9-]{1,60}$" }
   }
 }'),
 json('["word"]'),
 json('{ "win": "won", "order": [["tries", "asc"], ["ms", "asc"]], "score": "tries * 10000000 + ms" }'),
 'game@1', 10, 1763337600000);

INSERT INTO templates (id, game_type_id, family, name, description, status, min_plan_id, current_version, sort, created_at) VALUES
('pop-player', 'wordle', 'pop', 'Pop Player',
 'Flat, full colour, thick ink outlines. The panel is the whole page; the sponsor''s name runs round all four edges.', 'live', 'free', 1, 10, 1763337600000),
('analog-player', 'wordle', 'analog', 'Analog Player',
 'A lit walnut and brushed-metal player: speaker grille, gold badge, glowing screen, light dial and power switch.', 'live', 'pro', 1, 20, 1763337600000);

INSERT INTO template_versions (template_id, version, source_key, slots, engine, notes, created_at) VALUES
('pop-player', 1, 'templates/pop-player/v1.gt', json('{
  "slots": {
    "word":     { "type": "word",    "from": "secret.word" },
    "tries":    { "type": "integer", "from": "settings.tries" },
    "time":     { "type": "seconds", "from": "settings.time", "optional": true },
    "series":   { "type": "slug",    "from": "series.slug", "optional": true },
    "id":       { "type": "slug",    "from": "contest.slug" },
    "brand":    { "type": "text", "max": 16, "case": "upper", "from": "company.name", "ai": "shorten", "help": "the sponsor name in the panel and round the edges" },
    "title":    { "type": "text", "max": 16, "case": "upper", "from": "contest.title", "ai": "shorten" },
    "subtitle": { "type": "text", "max": 44, "case": "upper", "ai": "write", "help": "episode, tries and time, e.g. No. 001 · SIX TRIES · THREE MINUTES" },
    "win":      { "type": "text", "max": 48, "from": "contest.win_message", "ai": "write", "help": "said when the game is won; mentions the prize if there is one" },
    "timeout":  { "type": "text", "max": 40, "from": "contest.lose_message", "ai": "write" },
    "field":    { "type": "color", "role": "background", "ai": "pick" },
    "band":     { "type": "color", "role": "accent",     "ai": "pick" },
    "sponsor":  { "type": "color", "role": "brand",      "ai": "pick", "prefer": "company.brand.colors.primary" },
    "glass":    { "type": "color", "role": "surface",    "ai": "pick" },
    "deck":     { "type": "color", "role": "accent-2",   "ai": "pick" },
    "ink":      { "type": "color", "role": "ink",        "ai": "pick" },
    "logo":     { "type": "asset", "kinds": ["logo", "logo-mark"], "optional": true, "place": "sponsor-panel", "fit": "contain", "box": [760, 120] }
  },
  "rules": [
    { "contrast": ["ink", "band"],    "min": 4.5 },
    { "contrast": ["ink", "glass"],   "min": 7 },
    { "contrast": ["glass", "sponsor"], "min": 3, "note": "the brand name is glass on the sponsor colour" },
    { "contrast": ["field", "band"],  "min": 1.5 }
  ]
}'), 'game@1', 'from godtongue/examples/games/pop-player.gt', 1763337600000),
('analog-player', 1, 'templates/analog-player/v1.gt', json('{
  "slots": {
    "word":    { "type": "word",    "from": "secret.word" },
    "id":      { "type": "slug",    "from": "contest.slug" },
    "brand":   { "type": "text", "max": 14, "case": "upper", "from": "company.name", "ai": "shorten", "help": "engraved on the gold badge" },
    "tagline": { "type": "text", "max": 30, "case": "upper", "ai": "write", "help": "under the badge, e.g. THE DAILY WORD · No. 001" },
    "prize":   { "type": "text", "max": 48, "from": "contest.win_message", "ai": "write" },
    "ink":     { "type": "color", "role": "glow", "ai": "pick", "help": "the colour the letters glow on the dark screen" }
  },
  "rules": [
    { "contrast": ["ink", "#15130f"], "min": 7 }
  ]
}'), 'game@1', 'from godtongue/examples/games/deck/template.gt', 1763337600000);
