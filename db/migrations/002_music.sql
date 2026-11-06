-- SPEC-003 (repertório e configuração musical)

CREATE TABLE music (
  id                TEXT PRIMARY KEY,
  band_id           TEXT NOT NULL REFERENCES bands (id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  key               TEXT NOT NULL,
  bpm               NUMERIC NOT NULL,
  duration_seconds  NUMERIC NOT NULL,
  notes             TEXT NOT NULL DEFAULT '',
  chord_attachment  TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT music_key_check CHECK (key IN ('C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B')),
  CONSTRAINT music_bpm_check CHECK (bpm > 0),
  CONSTRAINT music_duration_check CHECK (duration_seconds > 0)
);

CREATE INDEX idx_music_band_id ON music (band_id);
