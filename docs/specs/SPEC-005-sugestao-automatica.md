# SPEC-005 — Sugestão Automática de Ordem, Duração e Alertas

Versão: 0.1
Autor: Copilot (esboço)
Arquivo: docs/specs/SPEC-005-sugestao-automatica.md

Objetivo
--------
Gerar sugestão automática de ordem de músicas para um setlist, estimar duração total e sinalizar transições problemáticas (mudança brusca de tom/tempo ou excesso de tempo).

Escopo
------
- Algoritmo de sugestão que ordena músicas baseado em metadados.
- Cálculo de duração estimada do setlist.
- Flags/alertas sobre transições abruptas e tempo excedido.

RF
--
RF-01: Gerar sugestão de ordem automática.
RF-02: Calcular duração total estimada.
RF-03: Destacar transições com alerta.

RNF
---
RNF-01: Algoritmo deve executar em tempo aceitável para repertórios até N músicas.

RB
--
RB-01: Sugestão é apenas recomendação — líder pode sobrescrever.

Fluxos
------
- Ao criar rascunho, usuário solicita sugestão -> sistema retorna proposta com indicadores.

Critérios de Aceite
-------------------
- Sugestão retorna ordem plausível em 95% dos casos de teste (definir conjunto de dados).

Questões em Aberto
------------------
- OPEN-051: Quais heurísticas priorizar (tom, bpm, popularidade)?
- OPEN-052: Definir limites para alertas (diferença de bpm, mudança de tom).
