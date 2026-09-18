# Diagrama de Classes Conceitual — SetFlow

## Classes e Atributos

**Usuário**
- id
- nome
- e-mail
- senha (hash)

**Banda**
- id
- nome
- limiar_transicao_semitons (padrão: 5)

**Membro** *(associação entre Usuário e Banda, com papel)*
- id
- usuario_id
- banda_id
- papel (Líder | Músico)

**Música**
- id
- banda_id
- título
- tom
- bpm
- duração
- observações
- cifra_anexo

**Setlist**
- id
- banda_id
- nome
- data
- tempo_disponivel
- estado (Rascunho | Confirmado | Tocado)

**ItemSetlist** *(música dentro de um setlist, com posição)*
- id
- setlist_id
- musica_id
- ordem

**DomínioMúsica** *(nível de domínio de um músico sobre uma música)*
- id
- usuario_id
- musica_id
- nível (Não Sei | Preciso Revisar | Sei Bem)

## Relacionamentos

- Um **Usuário** pode ter vários vínculos de **Membro** (em bandas diferentes, com papéis diferentes) — RB-08.
- Uma **Banda** tem vários **Membros** (1 ou mais líderes, 0 ou mais músicos).
- Uma **Banda** tem várias **Músicas** e vários **Setlists** — RB-07 (escopo por banda).
- Um **Setlist** tem vários **ItemSetlist**, cada um apontando para uma **Música** da mesma banda.
- Uma **Música** pode aparecer em vários **ItemSetlist** (setlists diferentes).
- Um **Usuário** (como músico) tem um **DomínioMúsica** por **Música** que já avaliou — RB-06 (sempre individual, nunca média da banda).

## Diagrama (Mermaid)

\`\`\`mermaid
classDiagram
    class Usuario {
        +id
        +nome
        +email
        +senha_hash
    }
    class Banda {
        +id
        +nome
        +limiar_transicao_semitons
    }
    class Membro {
        +id
        +papel
    }
    class Musica {
        +id
        +titulo
        +tom
        +bpm
        +duracao
        +observacoes
        +cifra_anexo
    }
    class Setlist {
        +id
        +nome
        +data
        +tempo_disponivel
        +estado
    }
    class ItemSetlist {
        +id
        +ordem
    }
    class DominioMusica {
        +id
        +nivel
    }

    Usuario "1" --> "0..*" Membro
    Banda "1" --> "0..*" Membro
    Banda "1" --> "0..*" Musica
    Banda "1" --> "0..*" Setlist
    Setlist "1" --> "0..*" ItemSetlist
    Musica "1" --> "0..*" ItemSetlist
    Usuario "1" --> "0..*" DominioMusica
    Musica "1" --> "0..*" DominioMusica
\`\`\`
