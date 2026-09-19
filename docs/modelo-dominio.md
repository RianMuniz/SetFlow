# Modelo de Domínio — SetFlow

Este documento é a fonte de verdade do domínio, em texto estruturado — não o
diagrama. O diagrama (`/docs/uml/dominio-v1.png`) é vista, não fonte.

## Classes do Domínio e Responsabilidades

### Usuário
Representa qualquer pessoa que acessa o sistema. Guarda identidade e
credenciais. Não carrega papel fixo — o papel (Líder ou Músico) é definido
por banda, através de **Membro**, porque a mesma pessoa pode ser líder em uma
banda e músico em outra (RB-08).

**Atributos:** id, nome, e-mail, senha (hash).

### Banda
Representa um grupo musical. É o limite de isolamento de todos os dados do
sistema — músicas, setlists e a configuração do limiar de transição
pertencem sempre a uma banda específica (RB-07).

**Atributos:** id, nome, limiar_transicao_semitons (padrão: 5).

### Membro
Associa um Usuário a uma Banda com um papel específico. Existe para permitir
múltiplos vínculos (RB-08): um usuário pode ser Membro-líder em uma banda e
Membro-músico em outra, simultaneamente.

**Atributos:** id, papel (Líder | Músico).

### Música
Representa uma música do repertório de uma banda. Concentra os dados usados
pelo motor de ordenação (tom) e pela verificação de duração (duração).

**Atributos:** id, título, tom, bpm, duração, observações, cifra_anexo.

### Setlist
Representa uma lista ordenada de músicas para um ensaio ou apresentação.
Concentra o comportamento de estado do domínio: nasce em `Rascunho`, avança
para `Confirmado` e finalmente `Tocado` (RB-05).

**Atributos:** id, nome, data, tempo_disponivel, estado (Rascunho |
Confirmado | Tocado).

### ItemSetlist
Posiciona uma Música dentro de um Setlist, guardando apenas a ordem. Existe
porque a mesma Música pode aparecer em vários Setlists diferentes, cada um
com uma posição distinta.

**Atributos:** id, ordem.

### DomínioMúsica
Registra o nível de domínio de um Usuário (como músico) sobre uma Música
específica. É sempre individual — nunca uma média da banda (RB-06).

**Atributos:** id, nível (Não Sei | Preciso Revisar | Sei Bem).

## Relacionamentos e Multiplicidades

- Um **Usuário** possui de zero a muitos **Membro**. Cada **Membro** pertence
  a exatamente um **Usuário**. *(Usuário 1 — 0..* Membro)*
  Um usuário recém-cadastrado, sem nenhuma banda ainda, é um estado válido.

- Uma **Banda** possui de zero a muitos **Membro**. Cada **Membro** pertence
  a exatamente uma **Banda**. *(Banda 1 — 0..* Membro)*
  Toda banda nasce com pelo menos um Membro-líder (quem a criou), então na
  prática o mínimo real de uma banda ativa é um.

- Uma **Banda** possui de zero a muitas **Música**. Cada **Música** pertence
  a exatamente uma **Banda**. *(Banda 1 — 0..* Música)*

- Uma **Banda** possui de zero a muitos **Setlist**. Cada **Setlist**
  pertence a exatamente uma **Banda**. *(Banda 1 — 0..* Setlist)*

- Um **Setlist** contém de uma a muitas **ItemSetlist**. A relação é de
  composição: um ItemSetlist não existe fora do Setlist que o contém;
  excluído o Setlist, seus itens são excluídos junto. O mínimo de um garante
  que um setlist vazio é inválido. *(Setlist 1 ◆— 1..* ItemSetlist)*

- Cada **ItemSetlist** referencia exatamente uma **Música**. A mesma
  **Música** pode aparecer em muitos **ItemSetlist**, em setlists diferentes.
  *(ItemSetlist * — 1 Música)*

- Um **Usuário** registra de zero a muitos **DomínioMúsica**. Cada
  **DomínioMúsica** trata de exatamente uma **Música**, e é registrado por
  exatamente um **Usuário**. *(Usuário 1 — 0..* DomínioMúsica — 1 Música)*

## Regras de Negócio no Domínio

- **RB-01 / RB-02** (distância entre tons e transição abrupta): vivem como
  operação de cálculo sobre o atributo `tom` de duas instâncias de **Música**
  comparadas com o `limiar_transicao_semitons` da **Banda**.
- **RB-03** (duração do setlist): operação de soma sobre os atributos
  `duração` das **Música** ligadas via **ItemSetlist** a um **Setlist**.
- **RB-04** (confirmação exclusiva do líder): restrição sobre a transição de
  estado do **Setlist**, condicionada ao `papel` do **Membro** que solicita.
- **RB-05** (transição de estado do setlist): invariante do próprio atributo
  `estado` de **Setlist** — só avança na ordem Rascunho → Confirmado →
  Tocado, nunca pula etapa.
- **RB-06** (domínio individual): garantida pela unicidade do par
  (usuario_id, musica_id) em **DomínioMúsica** — nunca agregada.
- **RB-07 / RB-08** (escopo por banda e múltiplos vínculos): garantidas pela
  própria estrutura de **Membro** como associação N:N entre Usuário e Banda.

## Checklist de Qualidade (autoavaliação)

- [x] Cada classe tem uma responsabilidade clara.
- [x] Relações críticas têm multiplicidade explícita.
- [x] Regras de negócio aparecem como restrições, não como classes novas.
- [x] Nada técnico contaminando o domínio (sem Controller, DTO, Tela).
- [x] Diagrama cabe em uma página e foca no recorte atual do MVP.
