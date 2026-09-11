Requisitos — SetFlow

A taxonomia RF / RNF / RB segue o padrão da disciplina. RF e RNF são escritos em EARS (WHEN / IF·THEN / Ubiquitous). RB são mantidas em forma declarativa (invariante do domínio), indicando o RF que as aplica — mesmo padrão usado no exemplo de referência EstudaAI.

Requisitos Funcionais (o que o sistema faz)

RF-01 Autenticação. WHEN o usuário submete credenciais corretas, o sistema SHALL iniciar a sessão. IF as credenciais são inválidas, THEN o sistema SHALL recusar o acesso e exibir mensagem de erro.

RF-02 Criação de banda. WHEN um usuário cria uma banda, o sistema SHALL registrá-lo como líder dessa banda.

RF-03 Vínculo de músico à banda. WHEN o líder adiciona um músico a uma banda, o sistema SHALL vincular esse usuário como músico daquela banda.

RF-04 Troca de contexto entre bandas. WHEN um usuário pertence a mais de uma banda, o sistema SHALL permitir alternar entre as bandas às quais pertence, exibindo apenas os dados da banda selecionada.

RF-05 Cadastro de música. WHEN o líder cadastra uma música em uma banda, o sistema SHALL armazenar tom, BPM, duração, observações e a cifra anexada.

RF-06 Configuração do limiar de transição. WHEN o líder define o limiar de transição abrupta de uma banda, o sistema SHALL salvar esse valor para uso nas sugestões de ordenação daquela banda.

RF-07 Criação de setlist. WHEN o líder cria um setlist e seleciona as músicas, o sistema SHALL criar o setlist no estado Rascunho.

RF-08 Sugestão automática de ordem. WHEN o líder solicita a sugestão de ordem de um setlist, o sistema SHALL calcular uma sequência que minimize transições de tom acima do limiar configurado da banda.

RF-09 Sinalização de transição abrupta. IF a distância de tom entre duas músicas consecutivas de um setlist for maior que o limiar da banda, THEN o sistema SHALL sinalizar essa transição como abrupta.

RF-10 Verificação de duração do setlist. WHEN o líder informa o tempo disponível para o ensaio/apresentação, o sistema SHALL comparar esse tempo com a duração total do setlist e alertar caso seja ultrapassado.

RF-11 Reordenação manual. WHEN o líder reordena manualmente as músicas de um setlist em Rascunho, o sistema SHALL atualizar a ordem e recalcular as sinalizações de transição.

RF-12 Confirmação de setlist. WHEN o líder confirma um setlist, o sistema SHALL alterar seu estado para Confirmado e torná-lo visível aos músicos da banda.

RF-13 Marcação de setlist como tocado. WHEN o líder marca um setlist Confirmado como utilizado, o sistema SHALL alterar seu estado para Tocado. IF o setlist não estiver Confirmado, THEN o sistema SHALL impedir a transição direta para Tocado.

RF-14 Registro de domínio por música. WHEN um músico marca seu nível de domínio em uma música, o sistema SHALL salvar esse nível associado ao músico e à música.

RF-15 Visualização de setlist confirmado. WHEN um músico acessa um setlist Confirmado da sua banda, o sistema SHALL exibir a ordem das músicas, a cifra, as observações e o seu próprio nível de domínio em cada uma.

RF-16 Histórico de setlists. WHEN o líder acessa o histórico de uma banda, o sistema SHALL listar os setlists no estado Tocado, ordenados por data.

Requisitos Não Funcionais (como o sistema se comporta)

RNF-01 Desempenho. WHEN o usuário executa uma ação principal (login, listar músicas, listar setlists), o sistema SHALL responder em menos de 2 segundos.

RNF-02 Usabilidade. WHEN o líder monta um setlist e aplica a sugestão de ordem, o sistema SHOULD permitir concluir o fluxo (criar → sugerir ordem → confirmar) em até 5 cliques a partir da tela de criação de setlist.

RNF-03 Segurança. O sistema SHALL armazenar senhas com hash e proteger contra CSRF e XSS.

RNF-04 Isolamento de dados por banda. WHEN um usuário acessa músicas ou setlists, o sistema SHALL exibir apenas os registros pertencentes a bandas das quais ele é membro (líder ou músico).

RNF-05 Persistência. O sistema SHALL usar banco de dados relacional, preservando o histórico de setlists Tocado indefinidamente.

Convenção de obrigação: SHALL = obrigatório (falha a aceitação se não cumprir) · SHOULD = recomendado (não bloqueia a entrega) · MAY = opcional (a critério da equipe).

Regras de Negócio (políticas e restrições do domínio)

RB-01 Distância entre tons. A distância entre dois tons é sempre o menor caminho no ciclo cromático de 12 semitons. Aplicada por RF-08 e RF-09.

RB-02 Transição abrupta. Uma transição entre músicas consecutivas é considerada abrupta se a distância de tom for maior que o limiar configurado da banda (padrão: 5 semitons). Aplicada por RF-09.

RB-03 Duração do setlist. A duração total de um setlist é a soma das durações de todas as músicas que o compõem. Aplicada por RF-10.

RB-04 Confirmação exclusiva do líder. Apenas o líder de uma banda pode reordenar músicas e confirmar um setlist daquela banda. Aplicada por RF-11 e RF-12.

RB-05 Transição de estado do setlist. Um setlist só pode ser marcado como Tocado se já estiver Confirmado. Aplicada por RF-13.

RB-06 Domínio individual. O nível de domínio de uma música é sempre pessoal por músico, nunca compartilhado como uma média da banda. Aplicada por RF-14 e RF-15.

RB-07 Escopo por banda. Músicas, setlists e o limiar de transição abrupta pertencem sempre a exatamente uma banda; um usuário só acessa dados de bandas às quais pertence. Aplicada por RF-04 e RNF-04.

RB-08 Múltiplos vínculos. Um usuário pode ser líder de uma ou mais bandas e músico em uma ou mais bandas simultaneamente, com dados independentes entre elas. Aplicada por RF-02, RF-03 e RF-04.
