# Trechos para colar nos documentos que não foram enviados

Estes arquivos não estavam entre os anexos; aplique os blocos abaixo ajustando a numeração (OPEN-XX/ADR) à sua baseline.

## docs/specs/SPEC-001-autenticacao-identidade-usuario.md (somente onde necessário)

- **Cadastro (`POST /api/auth/register`):** a entrada passa a ser `{ nickname, email, password }`. O nickname é obrigatório, tem 3 a 20 caracteres (letras ASCII, números, `.`, `-`, `_`) e é globalmente único sem diferenciar maiúsculas/minúsculas. Nickname duplicado → `409 NICKNAME_ALREADY_EXISTS`; nickname ausente/inválido → `400 VALIDATION_ERROR`.
- **Representação pública do usuário:** `{ id, nickname, email, status }` (sem senha, hash ou salt), também em `login` e `GET /api/auth/me`.
- **Login:** continua usando e-mail + senha; contratos HTTP, cookie, expiração de 24 h e rate limit permanecem inalterados.
- **Persistência:** usuários passam a ser persistidos em PostgreSQL (tabela `users`, ver SPEC-002 §7). IDs de usuário passam a ser `u-<uuid>`. As sessões continuam em memória no servidor.

## docs/arquitetura-decisoes-aprovadas.md (adicionar)

- **Stack:** mantido JavaScript/CommonJS com Express; a menção anterior a Node.js + TypeScript fica superada por esta decisão.
- **Persistência:** PostgreSQL via `pg`, configurado somente por `DATABASE_URL`; migrações SQL versionadas em `db/migrations`, aplicadas por `npm run db:migrate`.
- **Identidade:** nickname obrigatório e globalmente único (usado para adicionar membros); e-mail continua sendo o identificador de login.
- **Bandas:** nome único apenas por usuário criador (nome normalizado); criação de banda + líder em transação única.
- **Contexto ativo:** `POST /api/bandas/:bandId/ativa`, armazenado na sessão do servidor; revalidado contra o vínculo.
- **Camada de dados:** repositórios injetáveis (PostgreSQL em produção; memória nos testes), isolamento por usuário e `band_id` em toda consulta.

## docs/sdd-open-questions.md (marcar como resolvidas; não remover as demais)

- Persistência (PostgreSQL) → **resolvida**: PostgreSQL com `pg`/`DATABASE_URL`.
- Stack (Node.js + TypeScript vs JavaScript) → **resolvida**: JavaScript/CommonJS.
- Nome de banda duplicado (EX-01 da SPEC-002) → **resolvida**: rejeitar só para o mesmo criador.
- Identificador para adicionar membros → **resolvida**: nickname globalmente único.
- Membro duplicado → **resolvida**: `409 MEMBER_ALREADY_EXISTS`.
- Contexto ativo → **resolvida**: endpoint dedicado, sessão do servidor.

## README.md (seção a adicionar)

### Requisitos
Node.js 18+ e PostgreSQL 13+.

### Instalação e configuração
```bash
npm install
cp .env.example .env        # ajuste DATABASE_URL; nunca versione o .env
createdb setflow            # ou crie o banco pela sua ferramenta
export DATABASE_URL=postgres://usuario:senha@localhost:5432/setflow
# alternativa (Node 20.6+): node --env-file=.env src/migrate.js
npm run db:migrate          # aplica db/migrations/*.sql
npm start                   # sobe a API (PORT, padrão 3000)
```
Sem `DATABASE_URL`, `npm start` e `npm run db:migrate` falham com mensagem clara. Se o schema não foi migrado, o servidor orienta a rodar `npm run db:migrate`.

### Testes
```bash
npm test            # sem banco: unitários, pool falso e suíte HTTP com repositórios em memória
npm run test:pg     # exige DATABASE_URL; usa um schema temporário (setflow_test_*) e o remove no final
```
`npm run test:pg` falha (exit 1) com mensagem explicativa quando o PostgreSQL não está configurado ou acessível.

### Endpoints
Ver `docs/specs/SPEC-001-*.md` e `docs/specs/SPEC-002-*.md` (cadastro com nickname, login, bandas, membros e contexto ativo).
