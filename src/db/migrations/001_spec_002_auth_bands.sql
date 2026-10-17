CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  nickname_normalized TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  transition_threshold_semitones INTEGER NOT NULL DEFAULT 5,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (created_by_user_id, name_normalized)
);

CREATE TABLE IF NOT EXISTS band_members (
  id TEXT PRIMARY KEY,
  band_id TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('leader', 'musico')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (band_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_nickname_normalized ON users (nickname_normalized);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_band_members_user_id ON band_members (user_id);
CREATE INDEX IF NOT EXISTS idx_band_members_band_id ON band_members (band_id);
