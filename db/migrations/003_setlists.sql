-- SPEC-004 (criação de setlist em estado Rascunho)

CREATE TABLE setlists (
  id                    TEXT PRIMARY KEY,
  band_id               TEXT NOT NULL REFERENCES bands (id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  event_date            DATE NOT NULL,
  available_seconds     NUMERIC NOT NULL,
  state                 TEXT NOT NULL DEFAULT 'Rascunho',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT setlists_available_seconds_check CHECK (available_seconds > 0),
  CONSTRAINT setlists_state_check CHECK (state = 'Rascunho')
);

CREATE TABLE setlist_items (
  id              TEXT PRIMARY KEY,
  setlist_id      TEXT NOT NULL REFERENCES setlists (id) ON DELETE CASCADE,
  music_id        TEXT NOT NULL REFERENCES music (id),
  order_position  INTEGER NOT NULL,
  CONSTRAINT setlist_items_order_check CHECK (order_position > 0),
  CONSTRAINT setlist_items_order_unique UNIQUE (setlist_id, order_position)
);

CREATE INDEX idx_setlists_band_id ON setlists (band_id);
CREATE INDEX idx_setlist_items_setlist_id ON setlist_items (setlist_id);
