# Decisões Arquiteturais Aprovadas — SetFlow

Documento que consolida todas as decisões arquiteturais já tomadas (ADRs e Drivers) e registra as questões ainda em aberto.

## ADRs Aprovadas

### ADR-001: Algoritmo de Sugestão e Ordenação de Setlist
- **Status:** Aprovado
- **Contexto:** Precisamos ordenar as músicas de um setlist de modo a minimizar transições de tom abruptas sem comprometer o tempo de resposta do sistema (<2s).
- **Decisão:** Implementar a ordenação do Setlist no backend como cálculo síncrono em memória no serviço de aplicação.
- **Consequências:**
  - Positivas: simplicidade de código, sem necessidade de filas assíncronas complexas, tempo de resposta abaixo de 200ms para listas comuns de shows (10-30 músicas).
  - Negativas: processamento intensivo de CPU se o número de músicas na lista for extremamente alto (>500 itens em um único setlist).
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
- **Decisão Técnica:** Filtro obrigatório de `banda_id` injetado na camada de serviço/repositório em toda operação de acesso.
- **Afeta:** SPEC-002, SPEC-003, SPEC-004, SPEC-005, SPEC-006, SPEC-007, SPEC-008.

### DA-03: Desempenho da Sugestão
- **Descrição:** Resposta em menos de 2 segundos para ordenar até 50 músicas.
- **Origem:** RNF-01.
- **Decisão Técnica:** Cache em memória para o ciclo cromático de tons e consulta otimizada de repertório.
- **Afeta:** SPEC-005.

## Decisões Tecnológicas Consolidadas

### Stack de Tecnologia
- **Backend:** Node.js + TypeScript (OPEN-01 ✅ Aprovado)
- **Frontend:** HTML5 + CSS3 (OPEN-02 ✅ Aprovado)
- **Banco de Dados:** PostgreSQL (OPEN-03 ✅ Aprovado)
- **Arquitetura:** Monolítica em camadas (API REST + SPA)

### Regras de Negócio Consolidadas
- **Limiar de Transição:** 5 semitons, configurável por banda (OPEN-04 ✅ Aprovado)
- **Mínimo de Músicas:** 1 música por setlist (OPEN-05 ✅ Aprovado)
- **Criação de Setlist:** apenas líder (OPEN-06 ✅ Aprovado)
- **Visibilidade de Domínio:** líder vê apenas o seu próprio domínio (OPEN-07 ✅ Aprovado)
- **Algoritmo de Ordenação:** backtracking limitado (OPEN-08 ✅ Aprovado)
- **Representação de Tons:** notas em cifra com sustenidos (#) (OPEN-09 ✅ Aprovado)
- **Duração:** persistida em segundos, exibida em minutos/segundos (OPEN-10 ✅ Aprovado)
- **Contratos de API:** definidos nas Specs individuais (OPEN-11 ✅ Aprovado)
- **ADR-002:** referência removida (OPEN-12 ✅ Aprovado)
- **Numeração de Specs:** sequencial (SPEC-001, 002, ...) (OPEN-13 ✅ Aprovado)
- **Reabertura de Setlist:** incluída no MVP (OPEN-14 ✅ Aprovado)
- **Ordenação do Histórico:** por data do evento, decrescente (OPEN-15 ✅ Aprovado)

## Decisões em Aberto Identificadas

### OPEN-XX — Autenticação: sessão vs. token
**Descrição:** A baseline não define se o sistema usará sessão HTTP (cookies) ou autenticação baseada em token (JWT).

**Impacto:** SPEC-001, todas as operações autenticadas.

**Prioridade:** Alta — deve ser decidida antes da implementação de SPEC-001.

### OPEN-XX — Expiração de sessão
**Descrição:** Não está definido o tempo de expiração da sessão ou token após login, nem se haverá renovação automática.

**Impacto:** SPEC-001, segurança e usabilidade.

**Prioridade:** Alta — deve ser definida para SPEC-001.

### OPEN-XX — Recuperação de senha
**Descrição:** A baseline não menciona fluxo de recuperação de senha (esqueci minha senha).

**Impacto:** Experiência do usuário, possível fora do MVP.

**Prioridade:** Média — pode ser definida após SPEC-001 se não for MVP.

### OPEN-XX — Registro de novo usuário
**Descrição:** A baseline não define se o cadastro de novo usuário é aberto (self-signup) ou restrito (convite/admin).

**Impacto:** SPEC-001, acesso ao sistema.

**Prioridade:** Alta — deve ser decidida antes da implementação.

### OPEN-XX — Representação de tom e enarmonia
**Descrição:** A baseline define notas em cifra com sustenidos (#), mas não define como tratar notas enarmônicas (ex: C# vs. Db) ou afinação alternativa.

**Impacto:** SPEC-003, SPEC-005.

**Prioridade:** Média — pode ser definida junto com SPEC-003.

### OPEN-XX — Validação de BPM
**Descrição:** A baseline não define limite mínimo/máximo de BPM ou se o campo é obrigatório.

**Impacto:** SPEC-003.

**Prioridade:** Baixa — pode ser definida em SPEC-003.

### OPEN-XX — Backup e recuperação de dados
**Descrição:** A baseline não menciona estratégia de backup, replicação ou plano de recuperação de desastres.

**Impacto:** RNF-05 (persistência), operações.

**Prioridade:** Média — deve ser definida antes de produção.

### OPEN-XX — Logging e monitoramento
**Descrição:** Não há definição de estratégia de logs, alertas ou monitoramento de performance e erros.

**Impacto:** Todas as Specs, operações.

**Prioridade:** Média — deve ser definida antes da implementação.

### OPEN-XX — Rate limiting e proteção contra brute force
**Descrição:** Não há definição de limite de tentativas de login ou proteção contra ataque de força bruta.

**Impacto:** SPEC-001, segurança.

**Prioridade:** Alta — deve ser definida para SPEC-001.

### OPEN-XX — Multifator autenticação (MFA)
**Descrição:** A baseline menciona proteção contra CSRF/XSS, mas não define se MFA é necessário.

**Impacto:** SPEC-001, segurança.

**Prioridade:** Média — pode ser opcional no MVP.

### OPEN-XX — Padrão de contratos de API
**Descrição:** OPEN-11 aprovou que contratos sejam definidos por Spec, mas não estabeleceu um padrão consistente para erros, sucesso e formatos.

**Impacto:** Todas as Specs, integração.

**Prioridade:** Alta — deve ser definida antes de começar SPEC-001.

### OPEN-XX — Versionamento de API
**Descrição:** Não há definição de estratégia de versionamento (v1, v2, etc.) ou como lidar com breaking changes.

**Impacto:** Todas as Specs.

**Prioridade:** Média — pode ser definida antes de implementação ou após MVP.

### OPEN-XX — Ambiente de desenvolvimento e deploy
**Descrição:** Não há definição de ambientes (dev, staging, prod), estratégia de CI/CD ou ferramenta de deploy.

**Impacto:** Processo de implementação.

**Prioridade:** Alta — deve ser definida antes da implementação.

### OPEN-XX — Tratamento de erro genérico
**Descrição:** A baseline não define como informar erros ao usuário sem expor detalhes técnicos sensíveis.

**Impacto:** SPEC-001, todas as Specs.

**Prioridade:** Alta — deve ser definida antes de SPEC-001.

### OPEN-XX — Tratamento de concorrência
**Descrição:** Não há definição de como o sistema lida com tentativas simultâneas de modificar o mesmo setlist ou músicas.

**Impacto:** SPEC-004, SPEC-005, SPEC-006.

**Prioridade:** Média — deve ser definida antes de SPEC-004.

### OPEN-XX — Soft delete vs. hard delete
**Descrição:** Não há definição se o sistema usa soft delete (flag de ativo/inativo) ou hard delete (remoção física).

**Impacto:** SPEC-003, SPEC-004, SPEC-008 (histórico).

**Prioridade:** Média — deve ser definida antes de implementação de persistência.

## Resumo

| Área | Decisão | Status | Prioridade |
|------|---------|--------|-----------|
| ADR-001 | Algoritmo síncrono em memória | ✅ Aprovado | — |
| DA-01 | Ordenação cromática | ✅ Aprovado | — |
| DA-02 | Isolamento por banda | ✅ Aprovado | — |
| DA-03 | Desempenho <2s | ✅ Aprovado | — |
| Stack | Node.js + TS, HTML5+CSS3, PostgreSQL | ✅ Aprovado | — |
| Autenticação | Sessão vs. token | ⏳ Em aberto | Alta |
| Expiração | Tempo de sessão | ⏳ Em aberto | Alta |
| Recuperação senha | Implementar no MVP? | ⏳ Em aberto | Média |
| Registro | Self-signup ou convite? | ⏳ Em aberto | Alta |
| Enarmonia | Normalizar tons | ⏳ Em aberto | Média |
| BPM | Validação | ⏳ Em aberto | Baixa |
| Backup | Estratégia | ⏳ Em aberto | Média |
| Logs | Centralizado ou local? | ⏳ Em aberto | Média |
| Rate limiting | Proteção brute force | ⏳ Em aberto | Alta |
| MFA | Implementar? | ⏳ Em aberto | Média |
| Padrão API | REST, GraphQL, envelope? | ⏳ Em aberto | Alta |
| Versionamento | URL, header, nenhum? | ⏳ Em aberto | Média |
| Deploy | CI/CD e infraestrutura | ⏳ Em aberto | Alta |
| Erro genérico | Como informar erros? | ⏳ Em aberto | Alta |
| Concorrência | Locking strategy | ⏳ Em aberto | Média |
| Soft/hard delete | Estratégia de remoção | ⏳ Em aberto | Média |

Próximo passo: resolver as questões em aberto com prioridade Alta antes de iniciar implementação.
