# SPEC-003 — Gestão de Repertório e Configuração Musical

Versão: 0.1
Autor: Copilot (esboço)
Arquivo: docs/specs/SPEC-003-gestao-repertorio.md

Objetivo
--------
Cadastrar músicas, gerenciar metadados e permitir configuração de parâmetros musicais da banda (por exemplo: limiar de transição entre músicas).

Escopo
------
- CRUD de músicas: título, autor, duração estimada, tags (tom, bpm).
- Associação de músicas ao repertório da banda.
- Configurar parâmetros de transição (limiar de transição, tolerância de duração).

RF
--
RF-01: Cadastrar e editar músicas.
RF-02: Associar músicas ao repertório da banda.
RF-03: Definir configurações musicais por banda.

RNF
---
RNF-01: Indexação para pesquisa por título/tags.
RNF-02: Importação em lote (CSV) para repertório.

RB
--
RB-01: Apenas membros com permissão podem editar repertório.
RB-02: Alterações no repertório devem registrar autor e timestamp.

Fluxos
------
- Adicionar música: usuário busca por título ou cria nova entrada.
- Configurar banda: líder ajusta limiares de transição.

Critérios de Aceite
-------------------
- Ao adicionar música com dados mínimos, ela aparece no repertório da banda.
- Configuração de limiar salva e aplicada pela sugestão automática de setlist (SPEC-005).

Questões em Aberto
------------------
- OPEN-031: Formato padrão para duração (mm:ss vs segundos)?
- OPEN-032: Necessidade de normalizar metadata via serviços externos?
