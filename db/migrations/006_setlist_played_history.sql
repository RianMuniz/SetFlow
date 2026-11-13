-- SPEC-008 (estado Tocado e histórico)

ALTER TABLE setlists DROP CONSTRAINT setlists_state_check;
ALTER TABLE setlists ADD CONSTRAINT setlists_state_check
  CHECK (state IN ('Rascunho', 'Confirmado', 'Tocado'));
