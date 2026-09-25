# SPEC-004 — Criação de Setlist em Estado Rascunho

## 1. Identificação
- **ID:** SPEC-004
- **Nome:** Criação de Setlist em Estado Rascunho
- **Objetivo:** Permitir ao líder criar um setlist associado a uma banda, selecionar músicas e manter o estado inicial em `Rascunho`.
- **Valor entregue:** Gera a unidade de trabalho que será sugerida, revisada e confirmada.

## 2. Rastreabilidade
- **RFs:** RF-07
- **RBs:** RB-04, RB-05, RB-07
- **RNFs:** RNF-01, RNF-03, RNF-04, RNF-05
- **Caso de uso / fluxo:** UC-01, passos 1 a 4
- **Entidades:** Banda, Membro, Música, Setlist, ItemSetlist
- **Drivers:** DA-02
- **ADRs:** nenhuma específica

## 3. Escopo
### Incluído
- Criação do setlist com nome, data e tempo disponível.
- Seleção de músicas de repertório da banda ativa.
- Estado inicial em `Rascunho`.
- Persistência da entidade e dos itens do setlist.

### Fora do escopo
- Sugestão automática de ordem.
- Confirmação final do setlist.
- Histórico de setlists tocados.

## 4. Dependências
- SPEC-001, SPEC-002, SPEC-003
- Open decisions: mínimo de 1 música; líder cria setlist; banda ativa no contexto.

## 5. Comportamento esperado
### Pré-condições
- Usuário autenticado.
- Usuário é líder da banda ativa.
- Banda ativa selecionada.

### Fluxo principal
1. Líder acessa funcionalidade de novo setlist.
2. Informa nome, data e tempo disponível.
3. Seleciona uma ou mais músicas da banda ativa.
4. Sistema cria o setlist no estado `Rascunho`.
5. Sistema registra os itens do setlist com a ordem inicial de seleção.

### Fluxos alternativos
- **FA-01:** criação de setlist vazio, rejeitada por regra de negócio.
- **FA-02:** seleção de músicas de múltiplas bandas, bloqueada pelo isolamento da banda ativa.

### Fluxos de exceção
- **EX-01:** usuário não é líder. Sistema nega criação.
- **EX-02:** música selecionada não pertence à banda ativa. Sistema rejeita e não persiste.

### Pós-condições
- Setlist persistido em `Rascunho`.
- Itens do setlist vinculados à banda correta.

## 6. Regras e invariantes
- **INV-001:** Um setlist deve ter pelo menos 1 música.
- **INV-002:** Um setlist pertence a exatamente uma banda.
- **INV-003:** Um ItemSetlist deve referenciar uma música da mesma banda do setlist.
- **INV-004:** A criação do setlist é permitida apenas ao líder da banda.
- **INV-005:** O estado inicial de qualquer setlist é `Rascunho`.

## 7. Modelo de domínio envolvido
### Setlist
- id, bandaId, nome, data, tempoDisponivelSegundos, estado

### ItemSetlist
- id, setlistId, musicaId, ordem

## 8. Impacto arquitetural
- **Módulos:** criação de setlist, persistência e contexto de banda.
- **Fronteiras:** a camada de aplicação valida as músicas e a permissão do líder; o repositório filtra pela banda ativa.

## 9. Contratos necessários
- Entrada: nome, data, tempo disponível, array de músicas, banda ativa.
- Saída: setlist em rascunho criado com itens e estado.
- Erros: sem música selecionada, sem permissão, música fora da banda, dados inválidos.

## 10. Requisitos não funcionais aplicáveis
- **RNF-01:** operação de criação em menos de 2s.
- **RNF-04:** isolamento por banda.
- **RNF-05:** persistência relacional.

## 11. Critérios de aceitação
### Critério 1 — criação bem-sucedida
- **Dado** que o líder está autenticado e selecionou pelo menos uma música
- **Quando** cria o setlist
- **Então** o sistema persiste o setlist em estado `Rascunho`

### Critério 2 — bloqueio de usuario sem permissão
- **Dado** um usuário que não é líder
- **Quando** tenta criar o setlist
- **Então** o sistema nega a ação

### Critério 3 — validação de banda
- **Dado** uma música de outra banda
- **Quando** ela é adicionada ao setlist
- **Então** o sistema rejeita a inclusão

## 12. Casos de teste derivados
1. criação com uma música válida
2. criação sem música
3. criação por membro não líder
4. inclusão de música de outra banda
5. confirmação da persistência do estado `Rascunho`

## 13. Questões em aberto
- Nenhuma.

## 14. Definition of Done
- setlist criado com permissões corretas
- estado inicial e invariantes preservados
- dados de banda isolados
- testes aprovados

