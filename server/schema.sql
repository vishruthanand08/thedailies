CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The player's IANA time zone (from the X-Timezone header), for when their day rolls over.
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT;
-- Account recovery (server/account.js): a verified email (optional; only set once its link is
-- clicked), sessions signed before sessions_valid_after no longer count (a password reset signs
-- out everywhere), and must_change_password after an admin hands out a temporary one.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_valid_after TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));

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
-- added later: category groups on Today (their order, and which are collapsed)
ALTER TABLE user_prefs ADD COLUMN IF NOT EXISTS category_order TEXT NOT NULL DEFAULT '[]';
ALTER TABLE user_prefs ADD COLUMN IF NOT EXISTS collapsed TEXT NOT NULL DEFAULT '[]';

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

-- Points: every score is worth 0-100 (perfect 100, par 50, zero 0), saved when it's posted so
-- later changes to a game's values only affect new scores.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS points DOUBLE PRECISION;

-- Admin overrides of a game's perfect/par/zero (the defaults live in parsers.js).
CREATE TABLE IF NOT EXISTS game_scoring (
  game_id TEXT PRIMARY KEY,
  perfect DOUBLE PRECISION NOT NULL,
  par DOUBLE PRECISION NOT NULL,
  zero DOUBLE PRECISION NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 'open', or 'added' once the game is on the board
ALTER TABLE game_suggestions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';

-- Feed: one kudos per friend per player-day ("alex gave maya kudos for her Oct 27"). seen turns
-- true once the owner opens the feed (it drives the badge on the Feed tab).
CREATE TABLE IF NOT EXISTS day_kudos (
  owner_id INTEGER NOT NULL REFERENCES users(id),
  puzzle_date DATE NOT NULL,
  giver_id INTEGER NOT NULL REFERENCES users(id),
  seen BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, puzzle_date, giver_id)
);
CREATE INDEX IF NOT EXISTS idx_day_kudos_unseen ON day_kudos (owner_id) WHERE NOT seen;

-- A player's chosen highlight for a day. Without a row, the highlight is their top-points game.
CREATE TABLE IF NOT EXISTS day_highlights (
  user_id INTEGER NOT NULL REFERENCES users(id),
  puzzle_date DATE NOT NULL,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, puzzle_date)
);

-- Devices that get push notifications (iPhone and Mac apps). env is the APNs environment:
-- 'sandbox' for Xcode builds, 'production' for App Store and TestFlight ones.
CREATE TABLE IF NOT EXISTS push_devices (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  platform TEXT NOT NULL,
  env TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices (user_id);

-- People someone closed in "People you may know", so they stay hidden.
CREATE TABLE IF NOT EXISTS friend_suggestion_dismissals (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  other_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, other_id)
);

-- Days the evening reminder went out, so a restart doesn't send it twice.
CREATE TABLE IF NOT EXISTS push_reminders (
  puzzle_date DATE PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Who joined the global leaderboard, and whether they show there under their fun name
-- (alias, like "Zesty Zebra", picked when they join) instead of their username.
CREATE TABLE IF NOT EXISTS global_members (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  anonymous BOOLEAN NOT NULL DEFAULT false,
  alias TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE global_members ADD COLUMN IF NOT EXISTS alias TEXT;

-- Categories an admin has hidden (server/categories.js): their games aren't shown, played or
-- scored, but their scores are kept for when the category comes back. Sports starts hidden;
-- ON CONFLICT keeps whatever an admin set since.
CREATE TABLE IF NOT EXISTS category_settings (
  category TEXT PRIMARY KEY,
  hidden BOOLEAN NOT NULL DEFAULT false,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO category_settings (category, hidden, updated_by) VALUES ('sports', true, 'setup')
  ON CONFLICT (category) DO NOTHING;

-- Single games an admin has hidden, the same way (server/categories.js): not shown, played or
-- scored, scores kept for when the game comes back.
CREATE TABLE IF NOT EXISTS game_settings (
  game_id TEXT PRIMARY KEY,
  hidden BOOLEAN NOT NULL DEFAULT false,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The evening reminder, once per player per day in their own time zone.
CREATE TABLE IF NOT EXISTS push_user_reminders (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_date DATE NOT NULL,
  PRIMARY KEY (user_id, puzzle_date)
);

-- One-time links sent by email: 'verify' an address (email is the address being confirmed) or
-- 'reset' a password. Only a hash of the token is kept.
CREATE TABLE IF NOT EXISTS account_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  email TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_tokens_user ON account_tokens (user_id, kind, created_at);
