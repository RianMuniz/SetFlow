# Diagrama de Sequência - UC-01 (Gerar Setlist)

```mermaid
sequenceDiagram
    autonumber
    actor L as Líder / Músico
    participant UI as SetFlow Web (UI)
    participant C as SetlistController
    participant S as SetlistService (Algoritmo)
    participant DB as Banco de Dados

    L->>UI: Seleciona músicas e clica em "Gerar Ordem"
    UI->>C: POST /api/setlists/sugerir (musicasIds, tempoDisponivel)
    C->>S: gerarSugestao(bandaId, musicasIds, tempoDisponivel)
    S->>DB: Buscar regras/limiar da Banda e dados das Músicas
    DB-->>S: Retorna limiar_transicao e dados das músicas
    S->>S: Ordena músicas (minimiza semitons - RB-01/02)
    S->>S: Calcula duração total (RB-03)
    S-->>C: Retorna SetlistDTO com alertas
    C-->>UI: 200 OK (Setlist em Rascunho com Alertas)
    UI-->>L: Exibe sequência otimizada e avisos
