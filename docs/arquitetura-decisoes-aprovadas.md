# Decisões Arquiteturais Aprovadas — SetFlow

Documento que consolida as decisões arquiteturais já tomadas (ADRs e Drivers), além das decisões operacionais aplicáveis à implementação.

## ADRs Aprovadas

### ADR-001: Algoritmo de Sugestão e Ordenação de Setlist
- **Status:** Aprovado
- **Contexto:** Precisamos ordenar as músicas de um setlist de modo a minimizar transições de tom abruptas sem comprometer o tempo de resposta do sistema (<2s).
- **Decisão:** Implementar a ordenação do Setlist no backend como cálculo síncrono em memória no serviço de aplicação.
- **Consequências:** simplicidade de código e bom tempo de resposta para listas comuns; processamento intensivo de CPU pode ocorrer em listas extremamente grandes.
- **Impacto nas Specs:** SPEC-005, SPEC-006.

## Drivers Arquiteturais (DAs)

### DA-01: Algoritmo de Transição & Duração
- **Descrição:** Cálculo de menor distância cromática e alerta de estouro de tempo.
- **Origem:** RB-01, RB-02, RB-03.
- **Decisão Técnica:** Processamento síncrono da ordenação em memória via algoritmo de backtracking limitado.
- **Afeta:** SPEC-005, SPEC-006.

### DA-02: Isolamento Multi-tenant por Banda
- **Descrição:** Nenhuma informação ou música pode ser acessada por usuários de outra banda.
- **Origem:** RNF-04, RB-07.
- **Decisão Técnica:** Filtro obrigatório de usuário e `band_id` na camada de serviço/repositório em toda operação de acesso.
- **Afeta:** SPEC-002, SPEC-003, SPEC-004, SPEC-005, SPEC-006, SPEC-007, SPEC-008.

### DA-03: Desempenho da Sugestão
- **Descrição:** Resposta em menos de 2 segundos para ordenar até 50 músicas.
- **Origem:** RNF-01.
- **Decisão Técnica:** Cache em memória para o ciclo cromático de tons e consulta otimizada de repertório.
- **Afeta:** SPEC-005.

## Decisões Tecnológicas Consolidadas

### Stack de Tecnologia

- **Backend:** JavaScript/CommonJS com Express. Esta decisão substitui a menção anterior a Node.js + TypeScript e mantém compatibilidade com a implementação vigente.
- **Frontend:** HTML5 + CSS3.
- **Banco de dados:** PostgreSQL via `pg`, configurado somente pela variável `DATABASE_URL`.
- **Migrações:** SQL versionado em `db/migrations`, aplicado por `npm run db:migrate`.
- **Arquitetura:** Monolítica em camadas (API REST + SPA).
- **Camada de dados:** Repositórios injetáveis; PostgreSQL em produção e repositórios em memória nos testes.

### Identidade, bandas e contexto

- **Identidade:** nickname obrigatório e globalmente único, usado para adicionar membros; o e-mail continua sendo o identificador de login.
- **IDs:** usuários usam o formato `u-<uuid>`; os demais formatos seguem a SPEC-002.
- **Bandas:** o nome é único apenas por usuário criador, após normalização; usuários diferentes podem criar bandas com o mesmo nome.
- **Atomicidade:** criação de banda e vínculo inicial do líder ocorrem em uma única transação.
- **Contexto ativo:** `POST /api/bandas/:bandId/ativa`; o contexto é armazenado na sessão do servidor e revalidado contra o vínculo do usuário.
- **Isolamento:** toda consulta de dados deve filtrar o usuário autenticado e, quando aplicável, `band_id`.

### Regras de Negócio Consolidadas

- Limiar de transição: 5 semitons, configurável por banda.
- Mínimo de músicas: 1 música por setlist.
- Criação de setlist: apenas líder.
- Visibilidade de domínio: líder vê apenas o próprio domínio.
- Algoritmo de ordenação: backtracking limitado.
- Representação de tons: notas em cifra com sustenidos (#).
- Duração: persistida em segundos e exibida em minutos/segundos.
- Contratos de API: definidos nas Specs individuais.
- Reabertura de setlist: incluída no MVP.
- Ordenação do histórico: por data do evento, decrescente.

## Decisões em Aberto Identificadas

As questões abaixo continuam abertas por não terem sido resolvidas no documento de atualizações:

- **Recuperação de senha:** fluxo fora do MVP ou a definir posteriormente.
- **Representação de tom e enarmonia:** tratamento de notas enarmônicas e afinação alternativa.
- **Validação de BPM:** limites e obrigatoriedade do campo.
- **Backup e recuperação de dados:** estratégia de backup, replicação e recuperação de desastre.
- **Logging e monitoramento:** estratégia de logs, alertas e monitoramento.
- **MFA:** necessidade de autenticação multifator.
- **Versionamento de API:** estratégia para futuras versões e breaking changes.
- **Ambiente de desenvolvimento e deploy:** ambientes, CI/CD e infraestrutura.
- **Tratamento de concorrência:** alterações simultâneas em músicas e setlists.
- **Soft delete vs. hard delete:** estratégia de remoção de dados.

## Resumo

| Área | Decisão | Status |
|------|---------|--------|
| ADR-001 | Algoritmo síncrono em memória | ✅ Aprovado |
| DA-01 | Ordenação cromática | ✅ Aprovado |
| DA-02 | Isolamento por usuário e banda | ✅ Aprovado |
| DA-03 | Desempenho <2s | ✅ Aprovado |
| Stack | JavaScript/CommonJS, Express, HTML5/CSS3, PostgreSQL | ✅ Aprovado |
| Persistência | PostgreSQL via `pg` e `DATABASE_URL` | ✅ Aprovado |
| Identidade | Nickname global e e-mail para login | ✅ Aprovado |
| Bandas | Nome único por criador e criação transacional | ✅ Aprovado |
| Contexto ativo | Endpoint dedicado e sessão do servidor | ✅ Aprovado |
| Repositórios | PostgreSQL em produção e memória nos testes | ✅ Aprovado |
| Recuperação de senha | Fora do MVP ou a definir | ⏳ Em aberto |
| Enarmonia | Normalização de tons | ⏳ Em aberto |
| BPM | Validação | ⏳ Em aberto |
| Backup | Estratégia | ⏳ Em aberto |
| Logs | Estratégia | ⏳ Em aberto |
| MFA | Implementar? | ⏳ Em aberto |
| Versionamento | Estratégia | ⏳ Em aberto |
| Deploy | CI/CD e infraestrutura | ⏳ Em aberto |
| Concorrência | Locking strategy | ⏳ Em aberto |
| Soft/hard delete | Estratégia de remoção | ⏳ Em aberto |

## Decisões resolvidas na implementação da SPEC-001

- **Autenticação:** sessão HTTP no servidor, identificada por cookie.
- **Cookie de sessão:** `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` apenas em produção.
- **Expiração de sessão:** 24 horas, sem renovação automática.
- **Cadastro de usuário:** público (self-signup), com nickname obrigatório.
- **Rate limiting:** 5 tentativas inválidas por `IP + e-mail normalizado` em janela de 15 minutos; bloqueio na 6ª tentativa com `HTTP 429`; limpeza após login bem-sucedido.
- **Padrão de erro da API:** envelope JSON `{ "error": { "code": "...", "message": "..." } }`.
