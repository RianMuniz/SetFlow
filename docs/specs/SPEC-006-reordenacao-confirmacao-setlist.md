# SPEC-006 — Reordenação Manual e Confirmação do Setlist

## 1. Identificação
- **ID:** SPEC-006
- **Nome:** Reordenação Manual e Confirmação do Setlist
- **Objetivo:** Permitir ao líder revisar a ordem sugerida, reordenar manualmente o setlist em estado `Rascunho` e confirmar o setlist para que ele fique visível aos membros da banda.
- **Valor entregue:** Retém o controle humano sobre a decisão final, preservando a avaliação técnica anterior e a validação de regras de negócio.

## 2. Rastreabilidade
- **RFs:** RF-11, RF-12
- **RBs:** RB-01, RB-02, RB-03, RB-04, RB-05, RB-07
- **RNFs:** RNF-01, RNF-02, RNF-03, RNF-04, RNF-05
- **Caso de uso:** UC-01 montar e confirmar setlist; FA-01; EX-01; EX-02
- **Entidades:** Banda, Membro, Setlist, ItemSetlist, Música
- **Drivers:** DA-01, DA-02
- **ADRs:** ADR-001

## 3. Escopo
### Incluído
- Reordenação de músicas em setlist em estado `Rascunho`.
- Recalcular alertas quando o líder altera a ordem.
- Confirmação do setlist pelo líder.
- Alteração de estado para `Confirmado`.

### Fora do escopo
- Marcação como `Tocado`.
- Histórico completo e agregações finais.
- Criação de novas bandas ou músicas.

## 4. Dependências
- SPEC-004 e SPEC-005
- Reabertura do setlist incluída no MVP, conforme OPEN-14

## 5. Comportamento esperado
### Pré-condições
- Setlist no estado `Rascunho`.
- Usuário autenticado e líder da banda ativa.

### Fluxo principal
1. Líder acessa setlist em rascunho.
2. Reordena uma ou mais músicas manualmente.
3. Sistema recalcula as transições abruptas e a duração total.
4. Líder confirma o setlist.
5. Sistema altera o status do setlist para `Confirmado`.

### Fluxos alternativos
- **FA-01:** Líder não reordena, apenas confirma a sugestão.
- **FA-02:** Líder reabre um setlist `Confirmado` para revisão e retorna ao rascunho.

### Fluxos de exceção
- **EX-01:** Transição abrupta visualizada, mas confirmação permitida.
- **EX-02:** Tempo excedido visualizado, mas confirmação permitida.
- **EX-03:** Usuário sem liderança tenta confirmar. Sistema nega.

### Pós-condições
- Setlist `Confirmado` visível para os membros da banda.
- Estado mantém consistência com o ciclo de vida do setlist.

## 6. Regras e invariantes
- **INV-001:** Apenas o líder pode confirmar ou reordenar um setlist da banda.
- **INV-002:** Um setlist só pode ser confirmado quando existe em estado `Rascunho`.
- **INV-003:** Um setlist confirmado deve manter a ordem atual e visibilidade para membros da banda.
- **INV-004:** O sistema deve recalcular alertas após qualquer reordenação manual.
- **INV-005:** O setlist pode reabrir para edição apenas conforme decisão OPEN-14, que foi aprovada no MVP.

## 7. Modelo de domínio envolvido
### Setlist
- id, bandaId, nome, estado, tempoDisponivelSegundos

### ItemSetlist
- ordem, musicaId

## 8. Impacto arquitetural
- **Módulos:** camada de aplicação para confirmação e visão de setlist; persistência de estado; frontend para ações do líder.
- **Mais importante:** notifica proteção por papel e segregação por banda.

## 9. Contratos necessários
- Entrada: `setlistId`, nova ordem de itens, ação `confirmar`.
- Saída: setlist atualizado e estado alterado.
- Erros: não autorizado; setlist inexistente; música fora de banda; item inválido.

## 10. Requisitos não funcionais
- **RNF-01:** operação de confirmação em menos de 2s.
- **RNF-02:** fluxo de opinião do líder em poucos cliques.
- **RNF-04:** isolamento por banda.

## 11. Critérios de aceitação
### Critério 1 — confirmação pelo líder
- **Dado** um setlist em rascunho
- **Quando** o líder confirma
- **Então** o sistema altera o estado para `Confirmado`

### Critério 2 — bloqueio de não líder
- **Dado** um usuário que não é líder
- **Quando** tenta confirmar ou reordenar
- **Então** o sistema nega a ação

### Critério 3 — reordenação recalculada
- **Dado** um setlist em rascunho com ordem sugerida
- **Quando** o líder muda a ordem manualmente
- **Então** os alertas de transição e duração devem ser recalculados

## 12. Casos de teste derivados
1. confirmação por líder bem-sucedida
2. confirmação por membro não líder negada
3. reordenação manual com recalculo
4. reabertura em MVP
5. estado final `Confirmado`

## 13. Questões em aberto
- Nenhuma.

## 14. Definition of Done
- setlist confirmado corretamente;
- estado e réguas preservados;
- ações restringidas ao líder;
- testes aprovados.

