# SPEC-002 — Criação de Banda, Membros e Contexto Ativo

## 1. Identificação
- **ID:** SPEC-002
- **Nome:** Criação de Banda, Membros e Contexto Ativo
- **Objetivo:** Permitir que um usuário crie uma banda, associe membros e alterne o contexto ativo entre as bandas às quais pertence.
- **Valor entregue:** Estabelece o limite de isolamento e organização dos dados do sistema, permitindo que um mesmo usuário participe de múltiplas bandas sem misturar repertórios, setlists ou configurações.
- **Status:** implementada (JavaScript/CommonJS, Express, PostgreSQL).

## 2. Rastreabilidade
- **RFs:** RF-02, RF-03, RF-04
- **RBs:** RB-07, RB-08
- **RNFs:** RNF-01, RNF-03, RNF-04, RNF-05
- **Caso de uso / fluxo:** pré-condições do UC-01; contexto ativo da Persona 2 (Beatriz Ramos)
- **Entidades:** Usuário, Banda, Membro
- **Drivers:** DA-02
- **ADRs:** nenhuma específica

## 3. Escopo
### Incluído
- Criação de banda por usuário autenticado, com o criador como líder (transação única).
- Adição de membros (papel `musico`) pelo líder, localizando o usuário pelo **nickname**.
- Listagem das bandas do usuário e consulta de uma banda vinculada.
- Alternância do contexto ativo, armazenado na sessão do servidor.
- Isolamento: toda consulta de banda/membro filtra pelo usuário autenticado e pelo `band_id`.
- Migração da persistência de usuários da SPEC-001 para PostgreSQL.

### Fora do escopo
- Cadastro de músicas e setlists (SPEC-003 em diante) e configuração do limiar além do valor padrão.
- Convite por e-mail, remoção de membro, promoção/rebaixamento de papéis e edição de banda.
- Níveis de domínio musical individual; gestão financeira ou permissões sofisticadas.

## 4. Dependências e decisões finais
- SPEC-001 concluída.
- **Stack:** JavaScript/CommonJS com Express (substitui a menção anterior a Node.js + TypeScript; a decisão atual é manter JavaScript).
- **Persistência:** PostgreSQL via `pg` e `DATABASE_URL` (RNF-05).
- **Nickname:** obrigatório no cadastro público, globalmente único, usado para adicionar membros. O e-mail continua sendo usado no login.
- **Nome de banda:** rejeitado apenas quando o mesmo usuário já criou uma banda com o mesmo nome normalizado; usuários diferentes podem ter bandas com o mesmo nome.
- **Papéis:** `leader` e `musico`.
- **Contexto ativo:** `POST /api/bandas/:bandId/ativa`, guardado na sessão HTTP do servidor (`activeBandId`).
- Apenas o líder adiciona membros. A criação de banda não é restrita por papel: qualquer usuário autenticado pode criar bandas.

## 5. Comportamento esperado
### Pré-condições
- Usuário autenticado (cookie de sessão válido da SPEC-001).

### Fluxo principal
1. O usuário informa o nome da banda (`POST /api/bandas`).
2. O sistema cria a banda e o vínculo do criador como `leader` na mesma transação e define a banda como contexto ativo.
3. O líder adiciona músicos pelo nickname (`POST /api/bandas/:bandId/membros`).
4. O usuário lista suas bandas e alterna o contexto ativo (`POST /api/bandas/:bandId/ativa`).

### Fluxos alternativos
- **FA-01:** usuário cria uma nova banda enquanto já participa de outras; as bandas permanecem separadas e a nova passa a ser a ativa.
- **FA-02:** usuário entra em uma banda como músico e vê apenas os dados daquela banda.

### Fluxos de exceção
- **EX-01:** nome de banda duplicado para o mesmo criador → `409 BAND_NAME_ALREADY_EXISTS`.
- **EX-02:** acesso a banda sem vínculo → `403 BAND_ACCESS_DENIED` (sem vazar dados); banda inexistente → `404 BAND_NOT_FOUND`.

### Pós-condições
- Banda persistida com exatamente um vínculo inicial `leader`.
- `activeBandId` nunca aponta para banda sem vínculo.

## 6. Regras e invariantes
- **INV-001:** todo usuário que cria uma banda torna-se líder dela; banda e vínculo são criados na mesma transação (nunca existe banda sem líder).
- **INV-002:** uma banda pertence a um conjunto isolado de usuários e dados.
- **INV-003:** um usuário pode ter vínculos em várias bandas, com papéis independentes (líder em uma, músico em outra).
- **INV-004:** o contexto ativo aponta sempre para banda da qual o usuário é membro. Se o vínculo deixar de existir, `GET /api/bandas` limpa o `activeBandId` (volta a `null`) e o acesso à banda é negado.
- **INV-005:** a banda ativa não pode ser alterada para banda sem vínculo.
- **Nickname:** 3 a 20 caracteres após `trim`; apenas letras ASCII, números, ponto (`.`), hífen (`-`) e sublinhado (`_`); comparação sem diferenciar maiúsculas/minúsculas (`nickname_normalized = lower(trim(nickname))`).
- **Nome da banda:** 1 a 60 caracteres; espaços internos colapsados e `trim` no valor exibido; `name_normalized` = nome sem espaços extras em minúsculas (NFC).
- Usuários com status diferente de `active` não podem ser adicionados (tratados como `MEMBER_NOT_FOUND`).
- Uma nova sessão (login) começa sem contexto ativo (`activeBandId: null`).

## 7. Modelo de dados (PostgreSQL)
Migração versionada: `db/migrations/001_users_bands_members.sql`, aplicada por `npm run db:migrate` (controle em `schema_migrations`).

**users:** `id`, `nickname`, `nickname_normalized` (UNIQUE), `email` (UNIQUE), `password_hash`, `password_salt`, `status` (padrão `active`), `created_at`.
**bands:** `id`, `name`, `name_normalized`, `transition_threshold_semitones` (padrão 5), `created_by_user_id` (FK users), `created_at`, `UNIQUE(created_by_user_id, name_normalized)`.
**band_members:** `id`, `band_id` (FK bands, `ON DELETE CASCADE`), `user_id` (FK users, `ON DELETE CASCADE`), `role` (`CHECK` em `leader`/`musico`), `created_at`, `UNIQUE(band_id, user_id)`.

**Índices:** `users.email` e `users.nickname_normalized` são indexados pelas constraints UNIQUE; `idx_band_members_user_id` e `idx_band_members_band_id` criados explicitamente.
**IDs:** textuais com prefixo (`u-<uuid>`, `b-<uuid>`, `m-<uuid>`).

## 8. Contratos da API
Formato de erro em todos os casos: `{ "error": { "code": "...", "message": "..." } }`. Nenhuma resposta expõe stack trace, credenciais, hash ou salt.

| Método e rota | Autorização | Entrada | Sucesso |
|---|---|---|---|
| `POST /api/auth/register` | pública | `{ nickname, email, password }` | `201 { user: { id, nickname, email, status } }` + cookie de sessão |
| `POST /api/auth/login` | pública | `{ email, password }` | `200 { user }` + cookie |
| `POST /api/auth/logout` | — | — | `200 { success: true }` |
| `GET /api/auth/me` | sessão | — | `200 { user }` (inclui `nickname`) |
| `POST /api/bandas` | sessão | `{ name }` | `201 { band, activeBandId }` |
| `GET /api/bandas` | sessão | — | `200 { bands: [{ id, name, role, memberCount, transitionThresholdSemitones }], activeBandId }` |
| `GET /api/bandas/:bandId` | membro | — | `200 { band: { ..., members: [{ id, userId, nickname, role }] } }` |
| `POST /api/bandas/:bandId/membros` | líder | `{ nickname }` | `201 { member: { id, bandId, userId, nickname, role: "musico" } }` |
| `POST /api/bandas/:bandId/ativa` | membro | — | `200 { activeBandId, band }` |

### Códigos de erro
| Código | HTTP | Quando |
|---|---|---|
| `AUTHENTICATION_REQUIRED` | 401 | sem sessão válida |
| `VALIDATION_ERROR` | 400 | nickname, e-mail, senha, nome de banda ou JSON inválidos |
| `EMAIL_ALREADY_EXISTS` | 409 | e-mail já cadastrado |
| `NICKNAME_ALREADY_EXISTS` | 409 | nickname já em uso (sem diferenciar maiúsculas/minúsculas) |
| `BAND_NAME_ALREADY_EXISTS` | 409 | o mesmo usuário já criou banda com o nome normalizado |
| `BAND_NOT_FOUND` | 404 | banda inexistente |
| `BAND_ACCESS_DENIED` | 403 | banda existe, mas o usuário não tem vínculo |
| `LEADER_REQUIRED` | 403 | membro tentou adicionar outro membro |
| `MEMBER_NOT_FOUND` | 404 | nickname inexistente (ou conta não ativa) |
| `MEMBER_ALREADY_EXISTS` | 409 | usuário já é membro da banda |
| `DATABASE_ERROR` | 500 | falha de banco; mensagem genérica, detalhe só no log do servidor |

Observação de segurança: distinguir 404 de 403 revela que um `band_id` existe; como os ids são UUIDs aleatórios, o risco de enumeração é desprezível.

## 9. Transações e consistência
- `createWithLeader`: `BEGIN` → `INSERT bands` → `INSERT band_members (leader)` → `COMMIT`; qualquer falha executa `ROLLBACK` (client descartado do pool se o próprio rollback falhar).
- Cadastros simultâneos com o mesmo e-mail/nickname e adições simultâneas do mesmo membro são resolvidos pelas constraints UNIQUE e mapeados para 409.
- As sessões continuam em memória do servidor (SPEC-001): reiniciar o processo encerra as sessões e zera o contexto ativo.

## 10. Requisitos não funcionais aplicáveis
- **RNF-01:** listagem/seleção de bandas em menos de 2s (consultas por índice em `band_members.user_id`).
- **RNF-04:** filtro obrigatório de banda e usuário em toda consulta.
- **RNF-05:** dados persistidos em PostgreSQL.

## 11. Critérios de aceitação (implementados e cobertos por testes)
1. **Criação de banda:** usuário autenticado com nome válido cria a banda, é vinculado como único `leader` e a banda vira o contexto ativo.
2. **Alternância de contexto:** usuário com duas bandas troca a ativa e `GET /api/bandas` reflete `activeBandId`.
3. **Bloqueio de banda não vinculada:** consulta ou ativação retornam `403 BAND_ACCESS_DENIED`, sem alterar o contexto.
4. **Membros:** líder adiciona músico por nickname; nickname inexistente → 404; duplicado → 409 `MEMBER_ALREADY_EXISTS`; músico → 403 `LEADER_REQUIRED`.
5. **Nomes:** duplicado pelo mesmo usuário → 409; permitido para usuários diferentes.
6. **Papéis independentes** em bandas distintas para o mesmo usuário.
7. **Persistência do contexto** na sessão do servidor e limpeza quando o vínculo deixa de existir.
8. **Atomicidade:** falha ao criar o vínculo do líder não deixa banda sem líder.

## 12. Testes
- `npm test` (sem banco): `nickname.test.js`, `pgRepositories.test.js` (pool falso: transação, ROLLBACK, constraints, migração) e `bandHttp.test.js` (suíte HTTP com repositórios em memória).
- `npm run test:pg` (exige `DATABASE_URL`): mesma suíte HTTP contra PostgreSQL real, num schema temporário descartável, mais constraints do schema e rollback real. Sem `DATABASE_URL` ou sem conexão, o comando **falha** com mensagem explicativa (nunca passa em silêncio).

## 13. Questões em aberto
- Nenhuma para esta Spec. Remoção de membros, convites e promoção de papéis ficam para Specs futuras.

## 14. Definition of Done
- critérios atendidos e invariantes preservados;
- `npm test` e `npm run test:pg` aprovados;
- isolamento por banda validado;
- sem segredos no repositório (`DATABASE_URL` apenas por variável de ambiente).
