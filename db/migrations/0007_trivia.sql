-- Trivia Sprint: the second game. Questions are secrets (contest_secrets.secrets.questions), scored by the Worker.
INSERT INTO game_types (id, name, tagline, status, min_plan_id, settings_schema, secret_fields, scoring, engine, sort, created_at) VALUES
('trivia', 'Trivia Sprint', 'Quick questions about your business, one clock.', 'live', 'free',
 json('{
   "type": "object",
   "required": ["questions"],
   "properties": {
     "questions": { "type": "array", "minItems": 3, "maxItems": 20,
       "items": { "type": "object", "required": ["q", "options"], "properties": { "q": { "type": "string", "maxLength": 140 }, "options": { "type": "array", "minItems": 2, "maxItems": 4, "items": { "type": "string", "maxLength": 60 } } } } },
     "time":   { "type": ["integer", "null"], "minimum": 10, "maximum": 3600, "default": 90 },
     "series": { "type": ["string", "null"], "pattern": "^[a-z0-9-]{1,60}$" }
   }
 }'),
 json('["questions"]'),
 json('{ "win": "won", "order": [["right", "desc"], ["ms", "asc"]], "score": "(questions - right) * 10000000 + ms" }'),
 'game@1', 20, 1795000000000);

INSERT INTO templates (id, game_type_id, family, name, description, status, min_plan_id, current_version, sort, created_at) VALUES
('trivia-classic', 'trivia', 'classic', 'Thebes Classic',
 'Navy, lavender and purple with a serif title: the Thebes look. Your name on top, one question at a time.', 'live', 'free', 1, 30, 1795000000000);

INSERT INTO template_versions (template_id, version, source_key, slots, engine, notes, created_at) VALUES
('trivia-classic', 1, 'templates/trivia-classic.gt', json('{
  "slots": {
    "questions": { "type": "quiz",    "from": "secret.questions" },
    "time":      { "type": "seconds", "from": "settings.time", "optional": true },
    "series":    { "type": "slug",    "from": "series.slug", "optional": true },
    "id":        { "type": "slug",    "from": "contest.slug" },
    "brand":     { "type": "text", "max": 18, "case": "upper", "from": "company.name", "ai": "shorten", "help": "the sponsor name at the top" },
    "title":     { "type": "text", "max": 22, "from": "contest.title", "ai": "shorten" },
    "subtitle":  { "type": "text", "max": 40, "case": "upper", "ai": "write", "help": "e.g. TEN QUESTIONS · ONE CLOCK" },
    "win":       { "type": "text", "max": 48, "from": "contest.win_message", "ai": "write", "help": "said at the end; mentions the prize if there is one" },
    "lose":      { "type": "text", "max": 40, "from": "contest.lose_message", "ai": "write" },
    "timeout":   { "type": "text", "max": 40, "ai": "write" },
    "accent":    { "type": "color", "role": "accent", "ai": "pick", "prefer": "company.brand.colors.primary" },
    "sponsor":   { "type": "color", "role": "brand",  "ai": "pick" }
  },
  "rules": [
    { "contrast": ["accent", "#050515"], "min": 4.5 },
    { "contrast": ["sponsor", "#050515"], "min": 4.5 }
  ]
}'), 'game@1', 'from godtongue/examples/games/trivia/thebes-classic.gt', 1795000000000);
