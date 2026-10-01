# Mapa de Specs — SetFlow

Mapa ordenado para desenvolvimento segundo SDD. Esta etapa define apenas o índice e a rastreabilidade resumida; o conteúdo completo de cada Spec será produzido individualmente após aprovação humana.

| ID | Nome | Objetivo e valor entregue | RF | RB | RNF | Caso de uso/fluxo | Entidades | Drivers/ADRs | Dependências | Justificativa da ordem |
|---|---|---|---|---|---|---|---|---|---|---|
| **SPEC-001** | Autenticação e identidade do usuário | Permitir autenticação e sessão válida para operações protegidas. | RF-01 | RB-08 | RNF-01, RNF-03 | Pré-condições dos UC-01 | Usuário | DA-02; nenhuma ADR | — | Todas as capacidades precisam identificar o usuário. |
| **SPEC-002** | Criação de banda, membros e contexto ativo | Criar bandas, associar membros e alternar entre bandas. | RF-02, RF-03, RF-04 | RB-07, RB-08 | RNF-01, RNF-03, RNF-04, RNF-05 | Pré-condições dos UC-01; contexto da Persona 2 | Usuário, Banda, Membro | DA-02; nenhuma ADR | SPEC-001 | Define o limite de organização e isolamento dos dados. |
| **SPEC-003** | Gestão de repertório e configuração musical | Cadastrar músicas e configurar o limiar de transição da banda. | RF-05, RF-06 | RB-02, RB-07 | RNF-01, RNF-03, RNF-04, RNF-05 | Preparação do repertório; FA-02 | Banda, Membro, Música | DA-01, DA-02; ADR-001 indiretamente | SPEC-001, SPEC-002 | Fornece os dados necessários para criar e processar setlists. |
| **SPEC-004** | Criação de setlist em estado Rascunho | Criar um setlist com músicas selecionadas e estado inicial `Rascunho`. | RF-07 | RB-04, RB-05, RB-07 | RNF-01, RNF-03, RNF-04, RNF-05 | UC-01, passos 1–4 | Banda, Membro, Música, Setlist, ItemSetlist | DA-02; nenhuma ADR | SPEC-001, SPEC-002, SPEC-003 | Estabelece a unidade de trabalho das operações seguintes. |
| **SPEC-005** | Sugestão automática de ordem, duração e alertas | Sugerir ordem, calcular duração e sinalizar transições abruptas ou excesso de tempo. | RF-08, RF-09, RF-10 | RB-01, RB-02, RB-03, RB-07 | RNF-01, RNF-02, RNF-04 | UC-01; fluxos de sugestão, transição e duração | Banda, Música, Setlist, ItemSetlist | DA-01, DA-02, DA-03; ADR-001 | SPEC-001–004 | É a capacidade central e depende do rascunho, repertório e configuração. |
| **SPEC-006** | Reordenação manual e confirmação do setlist | Permitir revisão da ordem e confirmação pelo líder. | RF-11, RF-12 | RB-01, RB-02, RB-03, RB-04, RB-05, RB-07 | RNF-01, RNF-02, RNF-03, RNF-04, RNF-05 | UC-01; FA-01; EX-01; EX-02; estados do setlist | Banda, Membro, Setlist, ItemSetlist, Música | DA-01, DA-02; ADR-001 quando houver recálculo | SPEC-004, SPEC-005 | A confirmação exige um rascunho revisável e cálculos consistentes. |
| **SPEC-007** | Visualização de setlists confirmados e domínio individual | Permitir preparação do músico e registro de domínio pessoal sem misturar bandas. | RF-14, RF-15 | RB-06, RB-07, RB-08 | RNF-01, RNF-03, RNF-04, RNF-05 | Visualização do músico; Persona 2 | Usuário, Membro, Banda, Música, Setlist, ItemSetlist, DomínioMúsica | DA-02; nenhuma ADR | SPEC-001, SPEC-002, SPEC-003, SPEC-006 | A visualização do músico depende do setlist confirmado. |
| **SPEC-008** | Ciclo de vida final e histórico de setlists | Marcar setlists confirmados como `Tocado` e consultar o histórico. | RF-13, RF-16 | RB-04, RB-05, RB-07 | RNF-01, RNF-03, RNF-04, RNF-05 | `Confirmado → Tocado`; histórico | Banda, Membro, Setlist, ItemSetlist, Música | DA-02; nenhuma ADR | SPEC-002, SPEC-006 | O histórico só pode ser formado a partir de setlists confirmados e tocados. |

## Regras de decomposição aplicadas

- Não foram criadas Specs independentes para RNFs transversais.
- A decomposição é vertical por capacidade observável, não por frontend, backend ou banco.
- A sugestão automática foi separada da criação do setlist porque possui algoritmo, critérios e validação próprios.
- A reordenação manual foi agrupada à confirmação porque ambas compõem o fluxo de revisão do líder.
- Não foram incluídas implementação, banco físico, endpoints ou escolha de tecnologia.

## Questões em aberto

As decisões pendentes estão registradas em `docs/sdd-open-questions.md` e devem ser respondidas uma por vez antes da elaboração detalhada das Specs afetadas.
