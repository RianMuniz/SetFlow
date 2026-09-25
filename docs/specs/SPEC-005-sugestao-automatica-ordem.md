# SPEC-005 — Sugestão Automática de Ordem, Duração e Alertas

## 1. Identificação
- **ID:** SPEC-005
- **Nome:** Sugestão Automática de Ordem, Duração e Alertas
- **Objetivo:** Gerar automaticamente uma ordem de músicas para o setlist, minimizar transições abruptas e avisar quando a duração ultrapassar o tempo disponível.
- **Valor entregue:** Reduz esforço manual do líder e oferece um ponto de partida validado antes da confirmação.

## 2. Rastreabilidade
- **RFs:** RF-08, RF-09, RF-10
- **RBs:** RB-01, RB-02, RB-03, RB-07
- **RNFs:** RNF-01, RNF-02, RNF-04
- **Caso de uso:** UC-01 gerar setlist sugerido; fluxos de exceção de transição e tempo
- **Entidades:** Banda, Música, Setlist, ItemSetlist
- **Drivers:** DA-01, DA-02, DA-03
- **ADRs:** ADR-001

## 3. Escopo
### Incluído
- Cálculo da distância cromática entre tons adjacentes.
- Uso do limiar de transição configurado pela banda.
- Ordenação para minimizar transições abruptas.
- Soma das durações das músicas.
- Sinalização visual de transição e duração excedida.

### Fora do escopo
- Definição de critério de energia, gênero, BPM ou outros parâmetros externos.
- Reordenação manual e confirmação.
- Persistência do histórico do setlist.

## 4. Dependências
- SPEC-001 a SPEC-004
- Decisões: backtracking limitado; notas com sustenidos; duração em segundos; limiar 5 semitons configurável por banda.

## 5. Comportamento esperado
### Pré-condições
- Setlist em `Rascunho` criado.
- Pelo menos uma música selecionada.
- Banda ativa e limiar configurado.

### Fluxo principal
1. Sistema recebe as músicas do setlist e a banda ativa.
2. Calcula a distância de tom entre todas as combinações em sequência.
3. Aplica backtracking limitado para encontrar a ordem com menor custo de transição.
4. Soma a duração de cada música.
5. Compara com tempo disponível informado.
6. Retorna setlist sugerido com alertas associados.

### Fluxos alternativos
- **FA-01:** se o conjunto de músicas for pequeno, o sistema pode testar várias permutações e escolher a melhor.
- **FA-02:** se houver empate, usa critério de desempate por menor diferença total de tom ou ordem original selecionada.

### Fluxos de exceção
- **EX-01:** setlist sem músicas selecionadas. Sistema rejeita e informa que é necessário pelo menos 1 música.
- **EX-02:** tempo disponível muito curto. Sistema retorna ordem sugerida com alerta de excesso.

### Pós-condições
- Setlist sugerido disponível para revisão e confirmação.
- Alertas persistem na representação do conjunto sugerido.

## 6. Regras e invariantes
- **INV-001:** A distância entre tons é sempre o menor caminho no ciclo cromático.
- **INV-002:** Uma transição é abrupta se a distância for maior que o limiar da banda.
- **INV-003:** A duração total do setlist é a soma das durações das músicas.
- **INV-004:** O sistema deve considerar apenas músicas da banda ativa.
- **INV-005:** O algoritmo não pode extrapolar o tempo de resposta esperado para listas comuns.

## 7. Modelo de domínio envolvido
### Música
- tom, duracaoSegundos

### Banda
- limiarTransicaoSemitons

### Setlist
- tempoDisponivelSegundos

## 8. Impacto arquitetural
- **Módulos:** serviço de ordenação, algoritmo em memória, camada de domínio, regra de alertas.
- **Responsabilidades:** frontend mostra resultado; backend calcula; persistência só armazena resultado final, se necessário.
- **Restrição arquitetural:** processamento síncrono em memória, conforme ADR-001.

## 9. Contratos necessários
- Entrada: `bandaId`, `musicasIds`, `tempoDisponivel`.
- Saída conceitual: sequência sugerida, alertas de transição abrupta e alerta de duração excedida.
- Erros previstos: banda inexistente, músicas fora da banda, tempo inválido, setlist inexistente.

## 10. Requisitos não funcionais
- **RNF-01:** resposta em menos de 2s para até 50 músicas.
- **RNF-02:** fluxo simples e rápido em poucos cliques.
- **RNF-04:** isolar as músicas por banda.

## 11. Critérios de aceitação
### Critério 1 — ordem sugerida
- **Dado** um conjunto de músicas com diferentes tons e um limiar de banda
- **Quando** a sugestão é acionada
- **Então** o sistema retorna uma ordenação com menor custo de transição possível dentro do algoritmo aprovado

### Critério 2 — alerta de transição abrupta
- **Dado** duas músicas consecutivas com distância acima do limiar
- **Quando** o sistema sugere a ordem
- **Então** a transição deve ser sinalizada como abrupta

### Critério 3 — alerta de duração
- **Dado** um tempo disponível inferior à soma das durações
- **Quando** o sistema calcula a sugestão
- **Então** deve sinalizar excesso de duração

## 12. Casos de teste derivados
1. cálculo de distância entre tons
2. ordem com transição minimizada
3. transição acima do limiar
4. duração excedida
5. comparação com banda ativa correta

## 13. Questões em aberto
- Nenhuma.

## 14. Definition of Done
- algoritmo executa dentro de tempo aceitável;
- alertas e critérios validados;
- suporte ao limiar por banda;
- sem divergência da baseline.

