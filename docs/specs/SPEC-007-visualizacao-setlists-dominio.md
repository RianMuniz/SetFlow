# SPEC-007 — Visualização de Setlists Confirmados e Domínio Individual

## 1. Identificação
- **ID:** SPEC-007
- **Nome:** Visualização de Setlists Confirmados e Domínio Individual
- **Objetivo:** Permitir que músicos visualizem o setlist confirmado da banda e registrem o seu nível individual de domínio sobre as músicas.
- **Valor entregue:** Facilita a preparação individual antes do ensaio sem misturar repertórios de bandas diferentes.

## 2. Rastreabilidade
- **RFs:** RF-14, RF-15
- **RBs:** RB-06, RB-07, RB-08
- **RNFs:** RNF-01, RNF-03, RNF-04, RNF-05
- **Caso de uso / fluxo:** visualização do músico; Persona 2
- **Entidades:** Usuário, Membro, Banda, Música, Setlist, ItemSetlist, DomínioMúsica
- **Drivers:** DA-02
- **ADRs:** nenhuma específica

## 3. Escopo
### Incluído
- Exibição do setlist confirmado de uma banda ativa.
- Visualização da ordem das músicas, observações e cifras.
- Registro do nível de domínio do músico sobre cada música.
- Isolamento de dados por banda.

### Fora do escopo
- Criação ou edição de músicas do repertório.
- Confirmação de setlists.
- Vídeo, áudio ou análise musical não textual.

## 4. Dependências
- SPEC-001, SPEC-002, SPEC-003, SPEC-006
- Decisão OPEN-07: líder vê apenas o próprio domínio

## 5. Comportamento esperado
### Pré-condições
- Usuário autenticado.
- Usuário é membro da banda.
- Setlist em `Confirmado` na banda ativa.

### Fluxo principal
1. Usuário acessa banda ativa.
2. Sistema lista os setlists confirmados disponíveis para a banda.
3. Usuário seleciona um setlist confirmado.
4. Sistema exibe ordem e dados de cada música.
5. Usuário registra seu nível de domínio por música.
6. Sistema salva o valor associado ao par usuário-musica.

### Fluxos alternativos
- **FA-01:** usuário visualiza o setlist sem registrar domínio.
- **FA-02:** usuário alterna para outra banda da qual faz parte, sem misturar dados.

### Fluxos de exceção
- **EX-01:** usuário tenta visualizar setlist de outra banda sem vínculo. Sistema denega.
- **EX-02:** usuário tenta salvar domínio duplicado para a mesma música. Sistema atualiza o registro e não duplica.

### Pós-condições
- Dados visíveis e isolados pela banda correta.
- Domínio individual armazenado por usuário e música.

## 6. Regras e invariantes
- **INV-001:** O domínio de música é sempre individual, nunca agregado.
- **INV-002:** Cada usuário-musica possui no máximo um nível de domínio registrado.
- **INV-003:** O sistema não mistura dados de duas bandas diferentes num mesmo contexto.
- **INV-004:** Apenas o usuário autenticado pode registrar o próprio nível de domínio.
- **INV-005:** O líder não acessa o nível de domínio de outros membros, conforme decisão OPEN-07.

## 7. Modelo de domínio envolvido
### DomínioMúsica
- id, usuarioId, musicaId, nivel (Não Sei | Preciso Revisar | Sei Bem)

### Relacionamentos
- Usuário 1 — 0..* DomínioMúsica
- Música 1 — 0..* DomínioMúsica

## 8. Impacto arquitetural
- **Módulos:** camada de apresentação, serviço de setlist, serviço de domínio musical, persistência por usuário e banda.
- **Fronteiras:** diferenciação entre visibilidade geral do setlist e privacidade do nível individual.

## 9. Contratos necessários
- Entrada: `setlistId` e `musicaId` com nível de domínio.
- Saída: setlist confirmado visualizável; registro de domínio salvo.
- Erros: setlist não pertencente à banda; usuário sem vínculo; nível inválido.

## 10. Requisitos não funcionais
- **RNF-01:** resposta em menos de 2s.
- **RNF-04:** isolamento sensível por banda.
- **RNF-05:** persistência relacional.

## 11. Critérios de aceitação
### Critério 1 — visão do setlist confirmado
- **Dado** que o músico pertence à banda e o setlist está confirmado
- **Quando** acessa a banda ativa
- **Então** o sistema mostra a ordem e os dados da música

### Critério 2 — registro de domínio individual
- **Dado** que o músico está visualizando uma música do setlist
- **Quando** marca o seu nível de domínio
- **Então** o sistema salva o valor associado ao usuário e à música

### Critério 3 — privacidade do líder
- **Dado** que o líder acessa o domínio de uma música
- **Quando** tenta visualizar o nível do músico
- **Então** o sistema não permite essa consulta, conforme decisão OPEN-07

## 12. Casos de teste derivados
1. acesso ao setlist confirmado por membro autorizado
2. bloqueio de acesso a outra banda
3. salvar nível de domínio
4. atualização de nível já existente
5. privacidade do líder

## 13. Questões em aberto
- Nenhuma.

## 14. Definition of Done
- setlist confirmado visível em banda correta;
- domínio individual persistido e privado;
- isolamento por banda validado;
- testes aprovados.

