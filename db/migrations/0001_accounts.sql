-- Thebes D1 schema · 0001 · people, companies, members, assets
-- Conventions (every migration):
--   ids are TEXT (ULIDs made by the Worker), times are INTEGER ms since epoch (UTC),
--   JSON lives in TEXT columns checked with json_valid, enums are TEXT with a CHECK,
--   soft deletes use deleted_at, and every table is STRICT.

-- ---------- people ----------
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  handle        TEXT UNIQUE COLLATE NOCASE,                 -- @name on profiles and leaderboards; null until chosen
  display_name  TEXT,
  avatar_key    TEXT,                                       -- R2 key
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'staff', 'admin')),
  verified_at   INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER
) STRICT;

CREATE TABLE auth_identities (                              -- Google and other providers; email-link users have none
  provider      TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
  subject       TEXT NOT NULL,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
) STRICT;

CREATE TABLE login_tokens (                                 -- email sign-in links: only the hash is kept
  token_hash    TEXT PRIMARY KEY,
  email         TEXT NOT NULL COLLATE NOCASE,
  expires_at    INTEGER NOT NULL,
  used_at       INTEGER
) STRICT;

CREATE TABLE sessions (
  id_hash       TEXT PRIMARY KEY,                           -- hash of the cookie value
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  user_agent    TEXT
) STRICT;
CREATE INDEX sessions_user ON sessions(user_id);

-- ---------- companies (the sellers) ----------
CREATE TABLE companies (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE COLLATE NOCASE,        -- thebes.app/@mamas-diner
  name          TEXT NOT NULL,
  legal_name    TEXT,
  website       TEXT,
  industry      TEXT,                                       -- free text, e.g. "restaurant", "pottery studio"
  description   TEXT,
  city          TEXT,
  country       TEXT,                                       -- ISO 3166-1 alpha-2
  timezone      TEXT NOT NULL DEFAULT 'UTC',                -- daily challenges roll over at local midnight
  -- the brand kit the wizard reads: colours and fonts; logos and photos are rows in assets
  brand         TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(brand)),   -- {"colors":{"primary":"#ff5a47",...},"fonts":{"display":"Big Shoulders Display"},"voice":"warm, short"}
  logo_asset_id TEXT,                                       -- the main logo (an assets row of this company)
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_by    TEXT NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER
) STRICT;

CREATE TABLE company_members (
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'analyst')),
                -- owner: billing, members, delete · admin: members, everything else · editor: contests and assets · analyst: read stats and contacts
  invited_by    TEXT REFERENCES users(id),
  joined_at     INTEGER NOT NULL,
  PRIMARY KEY (company_id, user_id)
) STRICT;
CREATE INDEX company_members_user ON company_members(user_id);

CREATE TABLE company_invites (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email         TEXT NOT NULL COLLATE NOCASE,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'analyst')),
  token_hash    TEXT NOT NULL UNIQUE,
  invited_by    TEXT NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  accepted_at   INTEGER,
  revoked_at    INTEGER
) STRICT;
CREATE INDEX company_invites_company ON company_invites(company_id);

-- ---------- assets: every uploaded file (bytes in R2) ----------
CREATE TABLE assets (
  id            TEXT PRIMARY KEY,
  company_id    TEXT REFERENCES companies(id) ON DELETE CASCADE,   -- null: a user's own upload (avatar)
  kind          TEXT NOT NULL CHECK (kind IN ('logo', 'logo-mark', 'photo', 'product', 'pattern', 'font', 'other')),
  label         TEXT,                                       -- "Main logo, dark", "Toast hero shot"
  r2_key        TEXT NOT NULL UNIQUE,
  mime          TEXT NOT NULL,
  bytes         INTEGER NOT NULL CHECK (bytes > 0),
  width         INTEGER,
  height        INTEGER,
  sha256        TEXT NOT NULL,
  colors        TEXT CHECK (colors IS NULL OR json_valid(colors)),  -- dominant colours, worked out at upload: ["#ff5a47","#1a0d2e"]
  has_alpha     INTEGER NOT NULL DEFAULT 0 CHECK (has_alpha IN (0, 1)),
  created_by    TEXT NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  deleted_at    INTEGER
) STRICT;
CREATE INDEX assets_company_kind ON assets(company_id, kind) WHERE deleted_at IS NULL;
