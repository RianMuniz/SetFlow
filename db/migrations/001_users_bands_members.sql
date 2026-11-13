-- SPEC-001 (usuários) + SPEC-002 (bandas e membros)
-- Aplicada por `npm run db:migrate` (src/migrate.js), uma vez, dentro de transação.

CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  nickname            TEXT NOT NULL,
  nickname_normalized TEXT NOT NULL,
  email               TEXT NOT NULL,
  password_hash       TEXT NOT NULL,
  password_salt       TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_nickname_normalized_unique UNIQUE (nickname_normalized)
);

CREATE TABLE bands (
  id                              TEXT PRIMARY KEY,
  name                            TEXT NOT NULL,
  name_normalized                 TEXT NOT NULL,
  transition_threshold_semitones  INTEGER NOT NULL DEFAULT 5,
  created_by_user_id              TEXT NOT NULL REFERENCES users (id),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bands_creator_name_unique UNIQUE (created_by_user_id, name_normalized)
);

CREATE TABLE band_members (
  id         TEXT PRIMARY KEY,
  band_id    TEXT NOT NULL REFERENCES bands (id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT band_members_role_check CHECK (role IN ('leader', 'musico')),
  CONSTRAINT band_members_band_user_unique UNIQUE (band_id, user_id)
);

-- users.email e users.nickname_normalized já têm índice único criado pelas
-- constraints UNIQUE acima; não há índice redundante para eles.
CREATE INDEX idx_band_members_user_id ON band_members (user_id);
CREATE INDEX idx_band_members_band_id ON band_members (band_id);
