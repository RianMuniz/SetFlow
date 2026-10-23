🎸 SetFlow — Gerenciador Inteligente de Repertório e Setlist

👥 Desenvolvido por:

Matheus Junetti Sevciuc Machado - 10408848

Rian Silva Muniz - 10747955

## Requisitos

Node.js 18+ e PostgreSQL 13+.

## Instalação e configuração

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

## Testes

```bash
npm test            # sem banco: unitários, pool falso e suíte HTTP com repositórios em memória
npm run test:pg     # exige DATABASE_URL; usa um schema temporário (setflow_test_*) e o remove no final
```

`npm run test:pg` falha (exit 1) com mensagem explicativa quando o PostgreSQL não está configurado ou acessível.

## Endpoints

Ver `docs/specs/SPEC-001-*.md` e `docs/specs/SPEC-002-*.md` (cadastro com nickname, login, bandas, membros e contexto ativo).

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/bandas`
- `GET /api/bandas`
- `GET /api/bandas/:bandId`
- `POST /api/bandas/:bandId/membros`
- `POST /api/bandas/:bandId/ativa`

## Executar localmente

O servidor é iniciado com:

```bash
npm start
```

A API usa JavaScript/CommonJS com Express. Usuários, bandas e membros são persistidos em PostgreSQL; as sessões permanecem em memória no servidor.

📌 Visão Geral

O SetFlow é um sistema web para músicos e bandas organizarem seu repertório e montarem setlists de ensaio ou apresentação em segundos. Além de cadastrar músicas com tom, BPM, duração, observações e cifra, o sistema ajuda a organizar a ordem das músicas e acompanhar a preparação dos músicos.

👥 Perfis de Usuário

**Líder/Regente:** cadastra as músicas do repertório, cria setlists para ensaios/apresentações, ajusta a ordem sugerida pelo sistema e confirma o setlist.

**Músico da banda:** visualiza os setlists confirmados, acessa a cifra e as observações de cada música e marca seu nível de domínio em cada uma.

🎯 O Motor Central: Ordenação Inteligente de Setlist

Ao montar um setlist, o sistema analisa a lista de músicas escolhidas e sugere uma ordem que minimize transições bruscas de tom entre músicas consecutivas.

As 12 notas musicais formam um ciclo cromático. A distância entre dois tons é o menor número de semitons entre eles, percorrendo o ciclo em qualquer direção:

`distância(tomA, tomB) = min(|posição(tomA) − posição(tomB)|, 12 − |posição(tomA) − posição(tomB)|)`

Uma transição é considerada abrupta quando a distância excede o limiar definido para a banda, cujo valor padrão é 5 semitons. O sistema também soma a duração das músicas e sinaliza quando o tempo total ultrapassa o tempo disponível informado pelo líder.

🔄 Estados do Setlist

Cada setlist criado segue este fluxo:

`Rascunho → Confirmado → Tocado`

- **Rascunho:** o líder ainda está montando ou reordenando as músicas.
- **Confirmado:** a ordem está fechada; músicos da banda podem visualizar.
- **Tocado:** o setlist foi usado em um ensaio ou apresentação e passa a compor o histórico.

🎼 Domínio da Música por Músico

Cada músico da banda pode marcar, por música, seu nível de domínio:

`Não Sei → Preciso Revisar → Sei Bem`

Isso não afeta a ordem do setlist. É uma informação pessoal de cada músico, visível apenas a ele e ao líder, para ajudar na preparação antes do ensaio.

## Regras de Negócio Principais

- **RB-01:** a distância entre dois tons é sempre o menor caminho no ciclo cromático de 12 semitons.
- **RB-02:** uma transição é abrupta se a distância de tom for maior que o limiar da banda.
- **RB-03:** a duração total de um setlist é a soma das durações das músicas.
- **RB-04:** apenas o líder pode reordenar músicas e confirmar um setlist.
- **RB-05:** um setlist só pode ser marcado como Tocado se já estiver Confirmado.
- **RB-06:** o nível de domínio é pessoal por músico.

## Tecnologias e Arquitetura

- Documentação e specs: Spec-Driven Development (SDD) em formato EARS, organizada em `/docs`.
- Backend: JavaScript/CommonJS com Express.
- Frontend: HTML5 + CSS3.
- Banco de dados: PostgreSQL via `pg`, configurado por `DATABASE_URL`.
- Migrações: SQL versionado em `db/migrations`.
- Camada de dados: repositórios injetáveis, com memória nos testes e PostgreSQL em produção.
- Gestão do projeto: GitHub Issues, Pull Requests revisados e Project Board (Kanban).

`.specify/` — specs, planos e tasks de apoio ao agente de codificação.
