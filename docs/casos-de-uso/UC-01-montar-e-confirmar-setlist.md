# UC-01 — Montar e Confirmar Setlist

| Campo | Descrição |
|---|---|
| **Nome** | Montar e Confirmar Setlist |
| **Ator** | Líder |
| **Objetivo** | Criar um setlist para um ensaio ou apresentação, com uma ordem de músicas que evite transições de tom abruptas, e confirmá-lo para a banda. |
| **Pré-condições** | O Líder está autenticado e pertence a pelo menos uma Banda com músicas cadastradas. |
| **Pós-condições** | O Setlist é persistido no estado `Confirmado`, visível a todos os Membros da Banda. |

## Fluxo Principal (Caminho Feliz)

1. O Líder acessa a banda ativa e seleciona "Novo Setlist".
2. O Líder informa nome, data e tempo disponível para o setlist.
3. O Líder seleciona as músicas do repertório da banda que farão parte do setlist.
4. O sistema cria o Setlist no estado `Rascunho` — **RF-07**.
5. O Líder solicita a sugestão automática de ordem.
6. O sistema calcula a distância de tom entre músicas consecutivas e retorna a ordem sugerida — **RF-08, RB-01**.
7. O sistema exibe a duração total do setlist comparada ao tempo disponível — **RF-10, RB-03**.
8. O Líder revisa a ordem sugerida e confirma o setlist.
9. O sistema altera o estado do Setlist para `Confirmado` e o torna visível aos Músicos da banda — **RF-12**.

## Fluxos Alternativos

**FA-01 — Reordenação manual antes de confirmar**
No passo 8, em vez de confirmar direto, o Líder reordena manualmente uma ou
mais músicas.
3.1. O sistema atualiza a ordem e recalcula as sinalizações de transição — **RF-11**.
3.2. O fluxo retorna ao passo 7.

**FA-02 — Ajuste do limiar de transição antes de gerar a sugestão**
No passo 5, antes de solicitar a sugestão, o Líder decide ajustar o limiar de
transição abrupta da banda (padrão: 5 semitons).
3.1. O Líder informa um novo valor de limiar.
3.2. O sistema salva o novo limiar para a Banda — **RF-06**.
3.3. O fluxo retorna ao passo 5, usando o novo limiar no cálculo.

## Exceções

**EX-01 — Transição de tom acima do limiar detectada**
No passo 6, se qualquer par de músicas consecutivas da ordem sugerida
ultrapassar o limiar configurado, o sistema sinaliza essa transição
visualmente como abrupta, mas **não impede** a confirmação — **RF-09, RB-02**.
O Líder decide se reordena (FA-01) ou confirma mesmo assim.

**EX-02 — Duração do setlist excede o tempo disponível**
No passo 7, se a soma das durações ultrapassar o tempo informado no passo 2,
o sistema exibe um alerta de excesso de duração, sem impedir a confirmação
— **RF-10, RB-03**. O Líder decide se remove músicas ou confirma assim mesmo.

**EX-03 — Setlist sem nenhuma música selecionada**
No passo 3, se o Líder tentar avançar sem selecionar nenhuma música, o
sistema impede a criação do Setlist e exibe mensagem informando que é
necessário ao menos uma música.

## Rastreabilidade

| Passo do fluxo | Requisito/Regra |
|---|---|
| 4 | RF-07 |
| 5, 6 | RF-08, RB-01 |
| 7 | RF-10, RB-03 |
| FA-01 | RF-11 |
| FA-02 | RF-06 |
| 9 | RF-12 |
| EX-01 | RF-09, RB-02 |
