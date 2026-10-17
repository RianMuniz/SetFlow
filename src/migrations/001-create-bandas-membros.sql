-- Tabela users (assumida existente pela SPEC-001; incluída aqui para testes locais)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bandas (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  criado_por UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uniq_banda_por_usuario UNIQUE (nome, criado_por)
);

CREATE TABLE IF NOT EXISTS membros (
  id UUID PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES users(id),
  banda_id UUID NOT NULL REFERENCES bandas(id),
  papel TEXT NOT NULL CHECK (papel IN ('Líder', 'Músico')),
  criado_em TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uniq_membro_usuario_banda UNIQUE (usuario_id, banda_id)
);

CREATE TABLE IF NOT EXISTS user_active_band (
  usuario_id UUID PRIMARY KEY REFERENCES users(id),
  banda_id UUID NOT NULL REFERENCES bandas(id)
);
