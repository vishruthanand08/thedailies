CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per pair, normalized so user_a < user_b.
CREATE TABLE IF NOT EXISTS friendships (
  user_a INTEGER NOT NULL REFERENCES users(id),
  user_b INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  game_id TEXT NOT NULL,
  puzzle_date DATE NOT NULL,
  puzzle_number INTEGER,
  metric DOUBLE PRECISION NOT NULL,
  display TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id, puzzle_date)
);

CREATE INDEX IF NOT EXISTS idx_submissions_date ON submissions (puzzle_date);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions (user_id, created_at DESC);

-- Per-device bearer tokens for native clients (app, share extension, Shortcut).
-- Only sha256(token) is stored; the plaintext is returned once at creation.
CREATE TABLE IF NOT EXISTS api_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens (user_id);

-- Home page layout per user: game ids as JSON arrays (unknown ids are ignored on read).
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  game_order TEXT NOT NULL DEFAULT '[]',
  favorites TEXT NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_suggestions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_game_suggestions_user ON game_suggestions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS game_suggestion_votes (
  suggestion_id INTEGER NOT NULL REFERENCES game_suggestions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (suggestion_id, user_id)
);
