-- Cifra anexada à música (RF-05): arquivo guardado no próprio PostgreSQL,
-- sem volume extra no Docker e sem dependências novas.

CREATE TABLE music_chord_files (
  music_id      TEXT PRIMARY KEY REFERENCES music (id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  content       BYTEA NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT music_chord_files_type_check CHECK (content_type IN ('application/pdf', 'image/png', 'image/jpeg', 'text/plain')),
  CONSTRAINT music_chord_files_size_check CHECK (size_bytes > 0 AND size_bytes <= 5242880)
);
