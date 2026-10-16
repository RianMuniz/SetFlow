# SPEC-006 — Reordenação Manual e Confirmação do Setlist

Versão: 0.1
Autor: Copilot (esboço)
Arquivo: docs/specs/SPEC-006-reordenacao-confirmacao.md

Objetivo
--------
Permitir que o líder revise a ordem sugerida, faça alterações manuais e confirme o setlist como definitivo.

Escopo
------
- Interface para drag-and-drop (ou equivalente) de reordenação.
- Fluxo de confirmação que altera estado do setlist para `Confirmado`.
- Controle de permissões: somente líder pode confirmar.

RF
--
RF-01: Reordenar manualmente setlist.
RF-02: Confirmar setlist (muda estado para Confirmado).
RF-03: Notificar membros quando setlist for confirmado.

RNF
---
RNF-01: Operação de reordenação deve ser responsiva no frontend.

RB
--
RB-01: Apenas líder pode confirmar. Em caso de ausência, política de delegação deverá ser definida.

Fluxos
------
- Líder revisa sugestão -> reordena -> confirma -> sistema notifica membros e marca para gravação histórica.

Critérios de Aceite
-------------------
- Após confirmação, setlist fica visível na lista de confirmados e gera evento de notificação.

Questões em Aberto
------------------
- OPEN-061: Delegação de papel de líder (sub-líder temporário)?
