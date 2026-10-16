# SPEC-007 — Visualização de Setlists Confirmados e Domínio Individual

Versão: 0.1
Autor: Copilot (esboço)
Arquivo: docs/specs/SPEC-007-visualizacao-dominio.md

Objetivo
--------
Permitir que músicos visualizem setlists confirmados para preparação individual, e registrem seu domínio (quanto praticou ou se sentiu confortável) sem misturar dados entre bandas.

Escopo
------
- Visualização do setlist confirmado com anotações por músico.
- Registro de domínio individual (percentual ou marcação por música).
- Visibilidade restrita por contexto de banda.

RF
--
RF-01: Exibir setlists confirmados.
RF-02: Permitir registro individual de domínio por música.

RNF
---
RNF-01: Dados individuais não devem ser expostos a outras bandas.

RB
--
RB-01: Registro de domínio é privado por usuário dentro da banda.

Fluxos
------
- Músico acessa setlist confirmado -> edita seu domínio -> salva para uso em preparação.

Critérios de Aceite
-------------------
- Os registros de domínio são privados e persistem entre sessões.

Questões em Aberto
------------------
- OPEN-071: Métrica de domínio: percentual, notas ou checklist?
