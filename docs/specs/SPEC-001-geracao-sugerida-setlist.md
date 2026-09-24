# SPEC-004: Geração Automática de Setlist Sugerido

## 1. Rastreabilidade
- **RFs:** RF-07 (Gerar Ordem Sugerida), RF-08 (Alertas de Transição)
- **RBs:** RB-01, RB-02, RB-03
- **UC:** UC-01
- **ADR:** ADR-001

## 2. Comportamento e Invariantes
- A soma da duração das músicas deve ser comparada com a duração disponível da banda para o evento.
- A distância em semitons deve considerar a menor distância no ciclo cromático circular de 12 semitons.

## 3. Critérios de Aceite (Dado, Quando, Então)

### Critério 1: Cálculo correto da duração total (RB-03)
- **Dado** que foram selecionadas 3 músicas com durações de 4 min, 3 min e 5 min
- **Quando** a função de cálculo do setlist for executada
- **Então** a duração total retornada deve ser exatamente 12 minutos.

### Critério 2: Sinalização de estouro do tempo disponível
- **Dado** um tempo disponível de 10 minutos
- **E** um conjunto de músicas com duração total de 12 minutos
- **Quando** o setlist for processado
- **Então** o DTO retornado deve conter a flag `alertaTempoExcedido = true`.

### Critério 3: Identificação de transição de tom abrupta (RB-01 / RB-02)
- **Dado** que o limiar de transição da banda é de 3 semitons
- **E** a Música A está em C (Dó) e a Música B em F# (Fá sustenido) — distância de 6 semitons
- **Quando** a Música B é posicionada logo após a Música A
- **Então** a transição entre A e B deve ser marcada com `transicaoAbrupta = true`.

## 4. Questões em Aberto (OPEN-XX)
- **OPEN-01:** Definir se a afinação (ex: meio tom abaixo) altera a nota base do cálculo ou se usa-se sempre o tom de cifra original.
