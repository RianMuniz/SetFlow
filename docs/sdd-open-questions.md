# Questões em Aberto — SetFlow

Estas questões foram identificadas na baseline e precisam de decisão humana. Nenhuma delas deve ser resolvida silenciosamente durante a implementação.

## OPEN-01 — Stack de backend

Decisão registrada: Node.js + TypeScript.

A arquitetura aceita Node.js/TypeScript ou Python/FastAPI, sem decisão final. Qual stack de backend será adotada?

## OPEN-02 — Stack de frontend

O README aceita React ou HTML5/CSS3, enquanto a arquitetura menciona React/Next.js. Qual stack de frontend será adotada?

## OPEN-03 — Banco de dados

A arquitetura indica PostgreSQL, mas o README indica PostgreSQL ou SQLite. Qual banco será adotado?

## OPEN-04 — Limiar padrão de transição

Os documentos mencionam 5 semitons como padrão, mas também indicam que o valor ainda precisa ser calibrado. O padrão será 5 semitons? O líder poderá usar quais limites válidos?

## OPEN-05 — Quantidade mínima de músicas

O UC de geração exige ao menos duas músicas, enquanto o UC de montagem apenas impede a criação sem nenhuma música e o modelo de domínio aceita um ou mais itens. Qual regra deve prevalecer?

## OPEN-06 — Responsabilidade de criação do setlist

O diagrama de estados indica que o setlist pode ser criado por líder ou músico, mas RF-07 e os casos de uso atribuem a criação ao líder. Quem poderá criar setlists?

## OPEN-07 — Visibilidade do domínio individual

O README informa que o domínio é visível ao próprio músico e ao líder, mas RF-15 descreve explicitamente apenas a exibição do nível do próprio músico. O líder poderá visualizar o domínio individual dos músicos?

## OPEN-08 — Algoritmo e critério de desempate

A arquitetura menciona algoritmo gulioso/backtracking simplificado, mas não define o algoritmo exato, os critérios de desempate ou se a solução precisa ser ótima. Qual comportamento deve ser adotado?

## OPEN-09 — Representação dos tons

Não está definido o vocabulário aceito para `tom`, incluindo sustenidos, bemóis, notas enarmônicas e afinação alternativa. Qual representação será usada?

## OPEN-10 — Unidade e precisão da duração

Não está definido se a duração será armazenada em segundos, minutos ou outra unidade, nem como serão tratados valores fracionários. Qual unidade e precisão serão adotadas?

## OPEN-11 — Contratos de integração

Os documentos não definem contratos completos de API, formatos de erro, mecanismo de sessão ou DTOs. Esses contratos serão definidos nas Specs individuais ou existe uma convenção já aprovada?

## OPEN-12 — ADR-002 ausente

O mapa de Specs existente referencia `ADR-002`, mas nenhum arquivo correspondente foi encontrado. O ADR-002 existe fora do repositório ou essa referência deve ser removida?

## OPEN-13 — Numeração das Specs

O mapa existente identifica a geração como `SPEC-004`, mas o arquivo físico chama-se `SPEC-001-geracao-sugerida-setlist.md` e seu título é `SPEC-004`. Qual convenção de numeração deve prevalecer?

## OPEN-14 — Reabertura de setlist

O diagrama de estados permite `Confirmado → Rascunho`, mas nenhum requisito funcional ou caso de uso especifica o comportamento de reabrir um setlist. Essa transição fará parte do MVP?

## OPEN-15 — Data e ordenação do histórico

O histórico deve listar setlists `Tocado` por data, mas não está definido se a data representa planejamento, realização ou confirmação, nem qual será o desempate para datas iguais. Qual regra será adotada?
