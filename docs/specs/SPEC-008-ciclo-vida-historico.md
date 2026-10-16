# SPEC-008 — Ciclo de Vida Final e Histórico de Setlists

Versão: 0.1
Autor: Copilot (esboço)
Arquivo: docs/specs/SPEC-008-ciclo-vida-historico.md

Objetivo
--------
Definir transições finais do setlist (Confirmado -> Tocado) e manter histórico consultável de setlists e performances.

Escopo
------
- Marcação de setlist confirmado como `Tocado` após evento.
- Registro de metadados de performance (data, duração real, observações).
- Consulta de histórico por banda e por período.

RF
--
RF-01: Marcar setlist como Tocado e registrar dados da execução.
RF-02: Buscar histórico filtrado por banda e intervalo.

RNF
---
RNF-01: Histórico deve suportar paginação e filtros por data.

RB
--
RB-01: Apenas líderes ou membros autorizados podem marcar como Tocado.

Fluxos
------
- Após performance, líder registra setlist como Tocado -> sistema grava dados de execução e disponibiliza no histórico.

Critérios de Aceite
-------------------
- Histórico retorna entradas com metadados corretos e filtros aplicáveis.

Questões em Aberto
------------------
- OPEN-081: Capturar gravações/arquivos multimídia associados ao histórico?
