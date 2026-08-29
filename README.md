🎸 SetFlow — Gerenciador Inteligente de Repertório e Setlist

👥 Desenvolvido por: 

Rian Silva Muniz - 10747955
Matheus Junetti Sevciuc Machado - 10408848


📌 Visão Geral

O SetFlow é um sistema web para músicos e bandas organizarem seu repertório e montarem setlists de ensaio ou apresentação em segundos. Além de cadastrar músicas com tom, BPM, duração, observações de timbre/patch e cifras anexadas, o sistema sugere a melhor ordem de execução das músicas escolhidas, evitando transições de tom abruptas e avisando quando a duração total do set ultrapassa o tempo disponível.


👥 Perfis de Usuário
Líder/Regente: cadastra as músicas do repertório (tom, BPM, duração, observações, cifra), cria setlists para ensaios/apresentações, ajusta a ordem sugerida pelo sistema e confirma o setlist final.
Músico da banda: visualiza os setlists confirmados, acessa a cifra e as observações de cada música, e marca seu nível de domínio (sei bem / preciso revisar / não sei) em cada uma.
🎯 O Motor Central: Ordenação Inteligente de Setlist

Ao montar um setlist, o sistema analisa a lista de músicas escolhidas e sugere uma ordem que minimize transições bruscas de tom entre músicas consecutivas.

Cálculo de distância entre tons

As 12 notas musicais formam um ciclo (círculo cromático). A distância entre dois tons é o menor número de semitons entre eles, percorrendo o ciclo em qualquer direção (ex.: de C para C# é 1 semitom; de C para F# é a distância máxima possível, 6 semitons).

distância(tomA, tomB) = min(|posição(tomA) − posição(tomB)|, 12 − |posição(tomA) − posição(tomB)|)
Regra de transição abrupta

Se a distância entre os tons de duas músicas consecutivas no setlist for maior que um limiar definido (ex.: 5 semitons — a calibrar pela equipe), o sistema sinaliza essa transição como abrupta, permitindo ao líder reordenar antes de confirmar.

Verificação de duração

O sistema soma a duração de todas as músicas do setlist e compara com o tempo total disponível informado pelo líder (ex.: duração do ensaio ou do show), avisando caso o setlist ultrapasse esse tempo.

🔄 Estados do Setlist

Cada setlist criado segue este fluxo:

Rascunho → Confirmado → Tocado
Rascunho: o líder ainda está montando/reordenando as músicas.
Confirmado: a ordem está fechada; músicos da banda podem visualizar.
Tocado: o setlist foi usado em um ensaio/apresentação (permite histórico).
🎼 Domínio da Música por Músico

Cada músico da banda pode marcar, por música, seu nível de domínio:

Não Sei → Preciso Revisar → Sei Bem

Isso não afeta a ordem do setlist — é uma informação pessoal de cada músico, visível apenas a ele e ao líder, para ajudar na preparação antes do ensaio.

Regras de Negócio Principais
RB-01 — Distância entre tons: a distância entre dois tons é sempre o menor caminho no ciclo cromático de 12 semitons.
RB-02 — Transição abrupta: uma transição entre músicas consecutivas é considerada abrupta se a distância de tom for maior que [definir limiar, ex.: 5 semitons].
RB-03 — Duração do setlist: a duração total de um setlist é a soma das durações de todas as músicas que o compõem.
RB-04 — Confirmação exclusiva do líder: apenas o perfil Líder/Regente pode reordenar músicas e confirmar um setlist.
RB-05 — Transição de estado do setlist: um setlist só pode ser marcado como Tocado se já estiver Confirmado.
RB-06 — Domínio individual: o nível de domínio de uma música é sempre pessoal por músico, nunca compartilhado como uma média da banda.

Nota de escopo (MVP): o sistema não processa áudio nem arquivos de partitura — cifras e observações são texto/anexos simples. A sugestão de ordem é baseada apenas em tom e duração; critérios adicionais (energia, gênero, andamento/BPM) podem ser incorporados em versões futuras.

🛠️ Tecnologias e Arquitetura
Documentação e specs: Spec-Driven Development (SDD) em formato EARS, organizada em /docs.
Back-end: Node.js ou Python (definir stack com o grupo).
Front-end: React ou HTML5 + CSS3 (definir com o grupo).
Banco de dados: PostgreSQL ou SQLite, para persistir músicas, setlists e domínio por músico.
Gestão do projeto: GitHub Issues, Pull Requests revisados e Project Board (Kanban).

.specify/ — specs, planos e tasks de apoio ao agente de codificação.

Esta estrutura atende às exigências de documentação inicial da Semana 1 da disciplina: visão do produto, perfis de usuário, regras de negócio explícitas e link para a especificação completa em /docs.
