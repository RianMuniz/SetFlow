-- SPEC-006 (reordenação, confirmação e reabertura)

ALTER TABLE setlists DROP CONSTRAINT setlists_state_check;
ALTER TABLE setlists ADD CONSTRAINT setlists_state_check
  CHECK (state IN ('Rascunho', 'Confirmado'));
