# SPEC-004 — Criação de Setlist em Estado Rascunho

Versão: 0.1
Autor: Copilot (esboço)
Arquivo: docs/specs/SPEC-004-criacao-setlist-rascunho.md

Objetivo
--------
Permitir a criação de setlists em estado inicial "Rascunho", com seleção de músicas e metadados básicos (nome, data, local).

Escopo
------
- Criação/edição de setlist em rascunho.
- Inclusão/remoção de músicas na ordem inicial sugerida ou manual.
- Salvamento de meta (nome, data, local, notas).

RF
--
RF-01: Criar setlist em estado Rascunho.
RF-02: Adicionar e reorganizar músicas no rascunho.
RF-03: Salvar rascunho sem confirmar como definitivo.

RNF
---
RNF-01: Versionamento básico do rascunho (opcional: histórico de alterações).

RB
--
RB-01: Apenas membros com permissão podem editar rascunhos.

Fluxos
------
- Criar rascunho -> adicionar músicas -> salvar.

Critérios de Aceite
-------------------
- Um setlist criado em rascunho não fica visível na lista de setlists confirmados até ser confirmado.

Questões em Aberto
------------------
- OPEN-041: Necessidade de comentários colaborativos em rascunhos?
