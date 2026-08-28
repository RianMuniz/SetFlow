# StepUp
Rian Silva Muniz 10747955
Matheus Junetti Sevciuc Machado 10408848

StepUp — Organizador de Estudos e Tarefas para Alunos do Mackenzie

O StepUp é um sistema web que acompanha o aluno do Mackenzie do início ao fim do semestre: suas disciplinas, o conteúdo de cada uma, as atividades e provas pendentes, e o desempenho nas avaliações já realizadas. Com base nesses dados, o sistema identifica onde o aluno mais precisa de apoio, gera um plano de estudos personalizado e exibe em um painel os prazos de entregas e provas — sempre considerando que a média mínima para aprovação é 6,0.

Perfil de Usuário
Aluno: cadastra suas disciplinas no início do semestre, registra o conteúdo de estudo (com nível de dificuldade), as atividades/provas pendentes (com data e peso) e lança as notas conforme são divulgadas. Acompanha, em um painel, o risco de cada disciplina, o que priorizar e recebe um plano de estudos gerado automaticamente.
 StepUp — Organizador de Estudos e Tarefas para Alunos do Mackenzie

Visão Geral

O StepUp é um sistema web que acompanha o aluno do Mackenzie **do início ao
fim do semestre**: suas disciplinas, o conteúdo de cada uma, as atividades e
provas pendentes, e o desempenho nas avaliações já realizadas. Com base nesses
dados, o sistema identifica onde o aluno mais precisa de apoio, gera um plano de
estudos personalizado e exibe em um painel os prazos de entregas e provas —
sempre considerando que a média mínima para aprovação é **6,0**.

Este projeto é desenvolvido para a disciplina **Modelagem e Desenvolvimento de
Software**, seguindo a abordagem **Spec-Driven Development (SDD)**, com requisitos
especificados em formato **EARS** (Easy Approach to Requirements Syntax).

## Perfil de Usuário

- Aluno: cadastra suas disciplinas no início do semestre, registra o conteúdo
  de estudo (com nível de dificuldade), as atividades/provas pendentes (com data
  e peso) e lança as notas conforme são divulgadas. Acompanha, em um painel, o
  risco de cada disciplina, o que priorizar e recebe um plano de estudos
  gerado automaticamente.

O sistema tem um único perfil de acesso. A diversidade de uso é tratada via
personas (dois perfis de comportamento de aluno, documentados em
`/docs/personas.md`), não via papéis distintos no sistema.

O Motor Central: Desempenho + Urgência

O núcleo do sistema combina dois eixos para decidir o que o aluno mais precisa
estudar agora.

1. Risco de desempenho

Quanto o aluno precisa tirar nas avaliações restantes de uma disciplina para
fechar a média mínima de 6,0:

```
nota_necessária_restante = (6.0 − soma_ponderada_das_notas_já_obtidas) / peso_restante
```

| Faixa de risco | Condição |
|---|---|
| Baixo | nota necessária ≤ 6,0 |
| Alto | nota necessária entre 6,01 e 10,0 |
| Crítico | nota necessária > 10,0 (impossível de recuperar só com notas) |

 2. Urgência de prazo

Dias até a próxima atividade/prova pendente da disciplina:

| Faixa de urgência | Condição |
|---|---|
| Baixa | mais de 7 dias |
| Média | entre 3 e 7 dias |
| Alta | menos de 3 dias |

 Matriz de Prioridade

O cruzamento das duas faixas define a prioridade final de estudo de cada
disciplina:

| Risco ↓ / Urgência → | Baixa | Média | Alta |
|---|---|---|---|
| **Baixo** | Baixa | Baixa | Média |
| **Alto** | Média | Alta | Alta |
| **Crítico** | Alta | Crítica | Crítica |

Plano de Estudos Personalizado

Além de priorizar disciplinas, o StepUp gera um **plano de estudos** que
distribui o tempo disponível do aluno entre os tópicos de conteúdo pendentes,
combinando dois fatores:

- **Prioridade da disciplina** (matriz acima).
- **Dificuldade do tópico**: começa como uma autoavaliação do aluno (baixa /
  média / alta) ao cadastrar o tópico, e é **recalculada automaticamente**
  depois que uma nota relacionada é lançada (nota baixa eleva a dificuldade).

Fórmula de distribuição de tempo

Cada faixa de prioridade e de dificuldade recebe um peso numérico fixo (ex.:
crítica/alta = 4, alta/média = 3, média/baixa = 2, baixa = 1 — valores exatos a
calibrar pela equipe). O tempo total informado pelo aluno é distribuído
proporcionalmente:

```
peso_do_tópico = peso_prioridade_disciplina × peso_dificuldade_tópico
tempo_alocado_ao_tópico = (peso_do_tópico / soma_de_todos_os_pesos) × tempo_total_disponível
```

O plano gerado é **determinístico** (sem uso de IA generativa): dado o mesmo
conjunto de disciplinas, prioridades, dificuldades e tempo disponível, o
resultado é sempre o mesmo — o que o torna diretamente testável.

Painel do Aluno

O painel principal exibe, sempre atualizado:

- Quantas atividades/provas o aluno tem pendentes no momento.
- Prazos se aproximando (entregas e datas de prova), ordenados por urgência.
- Disciplinas e tópicos priorizados para estudo, segundo a matriz de prioridade.
- O plano de estudos gerado para o período informado pelo aluno.

Estados das Atividades/Avaliações

Cada atividade ou prova pendente de uma disciplina segue este fluxo:

```
Pendente → Em Andamento → Entregue → Avaliada
```

Ao marcar uma atividade como `Avaliada`, o aluno registra a nota obtida, e o
sistema recalcula automaticamente a nota necessária restante, a prioridade da
disciplina e a dificuldade dos tópicos relacionados.

 Estados dos Tópicos de Estudo

Cada tópico de conteúdo de uma disciplina segue este fluxo:

```
Não Iniciado → Em Estudo → Revisado → Dominado
```

A prioridade de um tópico (baixa / média / alta / crítica) é derivada da
matriz de prioridade da disciplina à qual pertence. A **dificuldade** do tópico
é um atributo independente, usado apenas pelo motor de geração do plano de
estudos.

