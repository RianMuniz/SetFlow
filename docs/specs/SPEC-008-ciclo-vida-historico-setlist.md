# SPEC-008 — Ciclo de Vida Final e Histórico de Setlists

## 1. Identificação
- **ID:** SPEC-008
- **Nome:** Ciclo de Vida Final e Histórico de Setlists
- **Objetivo:** Permitir a transição de setlist para `Tocado` e manter o histórico de apresentações passadas por data do evento.
- **Valor entregue:** Garante continuidade do ciclo de vida do setlist e fornece histórico útil para o líder da banda.

## 2. Rastreabilidade
- **RFs:** RF-13, RF-16
- **RBs:** RB-04, RB-05, RB-07
- **RNFs:** RNF-01, RNF-03, RNF-04, RNF-05
- **Caso de uso / fluxo:** diagrama de estados do setlist; histórico de setlists
- **Entidades:** Banda, Membro, Setlist, ItemSetlist, Música
- **Drivers:** DA-02
- **ADRs:** nenhuma específica

## 3. Escopo
### Incluído
- Marcação de setlist `Confirmado` como `Tocado`.
- Bloqueio de transição inválida.
- Histórico de setlists tocados por data do evento.
- Ordenação decrescente por data do evento.

### Fora do escopo
- Geração de métricas ou relatórios analíticos.
- Criação de setlists novos.
- Configuração de playlist automática.

## 4. Dependências
- SPEC-002 e SPEC-006
- Decisão OPEN-15: histórico ordenado por data do evento, decrescente.

## 5. Comportamento esperado
### Pré-condições
- Setlist existente e pertencente à banda ativa.
- Setlist em estado `Confirmado`.
- Usuário autenticado e líder da banda.

### Fluxo principal
1. Líder acessa histórico da banda.
2. Sistema filtra apenas setlists `Tocado`.
3. Ordena por data do evento em ordem decrescente.
4. Líder marca um setlist confirmado como tocado.
5. Sistema altera o estado para `Tocado`.

### Fluxos alternativos
- **FA-01:** o líder acessa o histórico sem ter tocado nenhum setlist ainda; lista vazia.
- **FA-02:** o líder reabre um setlist confirmado para edição antes do evento, conforme decisão OPEN-14.

### Fluxos de exceção
- **EX-01:** tentar marcar setlist em `Rascunho` como `Tocado` — operação bloqueada.
- **EX-02:** tentar acessar histórico de outra banda — bloqueado por isolamento.

### Pós-condições
- Histórico persistido e ordenado corretamente.
- Setlist em estado final `Tocado`.

## 6. Regras e invariantes
- **INV-001:** Um setlist só pode passar para `Tocado` se já estiver `Confirmado`.
- **INV-002:** O histórico contém apenas setlists `Tocado`.
- **INV-003:** O histórico é sempre filtrado pela banda ativa.
- **INV-004:** A ordenação do histórico é por data do evento em ordem decrescente.
- **INV-005:** Apenas o líder pode alterar o estado final do setlist.

## 7. Modelo de domínio envolvido
### Setlist
- id, nome, data, tempoDisponivelSegundos, estado

### ItemSetlist
- ordem, musicaId

## 8. Impacto arquitetural
- **Módulos:** histórico, estado de domínio, camada de aplicação, persistência e consulta relacional.
- **Fronteiras:** a camada de persistência deve preservar histórico e manter o setlist associado à banda correta.

## 9. Contratos necessários
- Entrada: `setlistId` e ação `marcarComoTocado`.
- Saída: status atualizado para `Tocado` e histórico ordenado.
- Erros: setlist não confirmado; sem permissão; banda incorreta.

## 10. Requisitos não funcionais
- **RNF-01:** operação de histórico e transição de estado em menos de 2s.
- **RNF-04:** isolamento por banda.
- **RNF-05:** persistência do histórico ao longo do tempo.

## 11. Critérios de aceitação
### Critério 1 — transição válida
- **Dado** um setlist em estado `Confirmado`
- **Quando** o líder marca como `Tocado`
- **Então** o sistema altera o estado para `Tocado`

### Critério 2 — bloqueio de transição inválida
- **Dado** um setlist em `Rascunho`
- **Quando** tenta ser marcado como `Tocado`
- **Então** o sistema nega a operação

### Critério 3 — histórico ordenado
- **Dado** vários setlists tocados de uma banda
- **Quando** o líder abre o histórico
- **Então** a lista aparece em ordem decrescente pela data do evento

## 12. Casos de teste derivados
1. transição `Confirmado → Tocado`
2. bloqueio de `Rascunho → Tocado`
3. histórico com vários setlists
4. filtro por banda correta
5. ordenação por data do evento

## 13. Questões em aberto
- Nenhuma.

## 14. Definition of Done
- transição de estado correta;
- histórico ordenado e filtrado por banda;
- invariantes do ciclo de vida preservados;
- testes aprovados.

