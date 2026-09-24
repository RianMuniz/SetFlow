# UC-01: Gerar Setlist Sugerido

- **Ator Principal:** Músico / Líder da Banda
- **Objetivo:** Gerar automaticamente uma ordem otimizada de músicas para o ensaio/show
- **Pré-condições:** Usuário autenticado, Banda selecionada e ao menos 2 músicas cadastradas no repertório.
- **Pós-condições:** Setlist gerado no estado `Rascunho` com a sequência sugerida.

## Regras de Negócio Associadas
- **RB-01 (Distância de Tons):** O sistema calcula a diferença em semitons no ciclo cromático (12 semitons).
- **RB-02 (Limiar de Transição):** Transições acima do limiar configurado pela Banda são marcadas como abruptas.
- **RB-03 (Duração Total):** A duração total é a soma das durações das músicas selecionadas.

## Fluxo Principal
1. O Líder acessa a tela de Setlists e clica em "Criar Novo Setlist".
2. O Líder informa o nome do Setlist, data e o tempo disponível (ex: 60 min).
3. O Líder seleciona as músicas do repertório que deseja incluir.
4. O Líder aciona a opção "Gerar Ordem Sugerida".
5. O sistema ordena as músicas minimizando transições abruptas (RB-01, RB-02) e calcula a duração total (RB-03).
6. O sistema exibe o Setlist em modo `Rascunho`, destacando possíveis alertas de tempo ou transições ríspidas.

## Fluxos Alternativos e Exceções (EARS)
- **[IF-THEN / Exceção] Limite Excedido:** SE a soma da duração das músicas ultrapassar o tempo disponível, ENQUANTO o setlist estiver sendo editado, O SISTEMA DEVE exibir um aviso de estouro de tempo.
- **[IF-THEN / Exceção] Transição Abrupta:** SE duas músicas consecutivas excederem o limiar de semitons configurado para a banda, O SISTEMA DEVE destacar visualmente o item da sequência com um alerta.
