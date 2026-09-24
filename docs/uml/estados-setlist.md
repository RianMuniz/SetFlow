# Diagrama de Transição de Estados - Setlist

Este diagrama descreve o ciclo de vida da entidade Setlist e as regras de negócio associadas às transições (RB-04, RB-05).

```mermaid
stateDiagram-v2
    [*] --> Rascunho : Criado pelo Líder ou Músico
    
    Rascunho --> Rascunho : Editar músicas / Recalcular ordem (RB-01, RB-02, RB-03)
    Rascunho --> Confirmado : Confirmar pelo Líder (RB-04)
    
    Confirmado --> Tocado : Marcar como Realizado/Tocado (RB-05)
    Confirmado --> Rascunho : Reabrir para edição
    
    Tocado --> [*]
