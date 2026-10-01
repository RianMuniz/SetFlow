# SPEC-002 — Criação de Banda, Membros e Contexto Ativo

## 1. Identificação
- **ID:** SPEC-002
- **Nome:** Criação de Banda, Membros e Contexto Ativo
- **Objetivo:** Permitir que um usuário crie uma banda, associe membros e alternem o contexto ativo entre as bandas às quais pertence.
- **Valor entregue:** Estabelece o limite de isolamento e organização dos dados do sistema, permitindo que um mesmo usuário participe de múltiplas bandas sem misturar repertórios, setlists ou configurações.

## 2. Rastreabilidade
- **RFs:** RF-02, RF-03, RF-04
- **RBs:** RB-07, RB-08
- **RNFs:** RNF-01, RNF-03, RNF-04, RNF-05
- **Caso de uso / fluxo:** pré-condições do UC-01; contexto ativo da Persona 2 (Beatriz Ramos)
- **Entidades:** Usuário, Banda, Membro
- **Drivers:** DA-02
- **ADRs:** nenhuma específica

## 3. Escopo
### Incluído
- Criação de banda por usuário autenticado.
- Associação automática do criador como líder.
- Vinculação de usuários como membros da banda.
- Alternância de contexto ativo entre bandas.
- Garantia de que cada operação usa apenas os dados da banda ativa.

### Fora do escopo
- Cadastro de músicas e setlists.
- Ordenação de setlists.
- Níveis de domínio musical individual.
- Gestão financeira ou permissões sofisticadas.

## 4. Dependências
- SPEC-001 concluída
- Decisão OPEN-01: backend Node.js + TypeScript
- Decisão OPEN-03: PostgreSQL
- Decisão OPEN-06: apenas líder pode criar setlist, mas a criação de banda não é restringida ao líder em nível de usuário; a banda é criada pelo próprio usuário autenticado.

## 5. Comportamento esperado
### Pré-condições
- Usuário autenticado.
- Contexto de sessão válido.

### Fluxo principal
1. Usuário acessa funcionalidade de criação de banda.
2. Informa nome da banda.
3. Sistema cria a banda e vincula o usuário autenticado como líder.
4. Usuário pode alternar entre bandas da sua lista de pertencimento.
5. Sistema identifica a banda ativa e usa o seu escopo para os dados visíveis.

### Fluxos alternativos
- **FA-01:** usuário cria uma nova banda enquanto já participa de outras. O sistema mantém as bandas separadas e permite alternar entre elas.
- **FA-02:** usuário entra em uma banda como músico e vê apenas os dados daquela banda.

### Fluxos de exceção
- **EX-01:** nome de banda duplicado em contexto do usuário. Sistema pode rejeitar ou permitir, conforme regra de negócio da organização.
- **EX-02:** tentativa de acesso a banda sem vínculo. Sistema bloqueia e devolve acesso negado.

### Pós-condições
- Banda criada e persistida.
- Usuário autenticado como líder da banda criada.
- Dados da banda isolados por contexto e permissões.

## 6. Regras e invariantes
- **INV-001:** Todo usuário que cria uma banda torna-se líder dessa banda.
- **INV-002:** Uma banda pertence a um conjunto isolado de usuários e dados.
- **INV-003:** Um usuário pode estar vinculado a múltiplas bandas sem compartilhamento de dados entre elas.
- **INV-004:** O contexto ativo da aplicação deve sempre apontar para uma banda da qual o usuário é membro.
- **INV-005:** A banda ativa não pode ser alterada para uma banda de outra organização sem vínculo.

## 7. Modelo de domínio envolvido
### Usuário
- id, nome, e-mail, senhaHash

### Banda
- id, nome

### Membro
- id, usuarioId, bandaId, papel (Líder | Músico)

### Relacionamentos
- Usuário 1 — 0..* Membro
- Banda 1 — 0..* Membro
- Um usuário pode ter várias associações em bandas diferentes.

## 8. Impacto arquitetural
- **Módulos:** autenticação, gestão de banda, contexto de usuário, autorização por banda.
- **Fronteiras:** camada de apresentação exibe banda ativa; camada de aplicação valida vínculo e contexto; camada de persistência filtra por banda.
- **Responsabilidades:** backend centraliza autorização e regras de isolamento; frontend apenas apresenta a lista e o contexto selecionado.

## 9. Contratos necessários
- Entrada: nome da banda, usuário autenticado.
- Saída: banda criada com sucesso ou erro de criação.
- Erro: usuário não autenticado; nome inválido; vínculo inexistente.
- Produtos de API: `POST /bandas`, `GET /bandas`, `POST /bandas/:id/membros`.

## 10. Requisitos não funcionais aplicáveis
- **RNF-01:** a listagem/seleção de bandas deve ocorrer em menos de 2s.
- **RNF-04:** filtro obrigatório de banda no acesso à informação.
- **RNF-05:** dados persistidos em banco relacional PostgreSQL.

## 11. Critérios de aceitação
### Critério 1 — Criação de banda
- **Dado** que o usuário está autenticado
- **Quando** informa um nome de banda válido
- **Então** o sistema cria a banda e o vincula como líder

### Critério 2 — Alternância de contexto
- **Dado** que o usuário pertence a duas bandas
- **Quando** troca a banda ativa
- **Então** o sistema exibe apenas os dados da banda selecionada

### Critério 3 — Bloqueio de banda não vinculada
- **Dado** que o usuário não pertence a uma banda
- **Quando** tenta acessá-la
- **Então** o sistema nega o acesso

## 12. Casos de teste derivados
1. criação de banda com usuário autenticado
2. múltiplos vínculos em duas bandas
3. troca de banda ativa
4. acessos indevidos bloqueados
5. persistência do papel líder

## 13. Questões em aberto
- Nenhuma. Todas as decisões relevantes da baseline foram resolvidas.

## 14. Definition of Done
- critérios atendidos;
- invariantes preservados;
- testes aprovados;
- isolamento por banda validado;
- não há divergência com a baseline.

