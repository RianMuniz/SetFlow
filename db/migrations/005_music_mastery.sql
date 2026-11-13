-- SPEC-007 (domínio individual por usuário e música)

CREATE TABLE music_mastery (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  music_id    TEXT NOT NULL REFERENCES music (id) ON DELETE CASCADE,
  level       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT music_mastery_level_check CHECK (level IN ('Não Sei', 'Preciso Revisar', 'Sei Bem')),
  CONSTRAINT music_mastery_user_music_unique UNIQUE (user_id, music_id)
);

CREATE INDEX idx_music_mastery_user_id ON music_mastery (user_id);
