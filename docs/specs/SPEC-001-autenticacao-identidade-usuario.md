# SPEC-001 — Autenticação e Identidade do Usuário

## 1. Identificação

- **ID:** SPEC-001
- **Nome:** Autenticação e Identidade do Usuário
- **Objetivo:** Permitir que um usuário se autentique com credenciais válidas, inicie sessão e tenha identidade reconhecida pelo sistema para acesso às funcionalidades protegidas.
- **Valor entregue:** Garante acesso controlado ao sistema e estabelece a base para isolamento por banda, autorização por papel e uso seguro das operações do SetFlow.

## 2. Rastreabilidade

### Requisitos Funcionais
- RF-01 — Autenticação. WHEN o usuário submete credenciais corretas, o sistema SHALL iniciar a sessão. IF as credenciais são inválidas, THEN o sistema SHALL recusar o acesso e exibir mensagem de erro.

### Regras de Negócio
- RB-08 — Múltiplos vínculos. Um usuário pode ser líder em uma ou mais bandas e músico em uma ou mais bandas simultaneamente, com dados independentes entre elas.

### Requisitos Não Funcionais
- RNF-01 — Desempenho. Ações principais devem responder em menos de 2 segundos.
- RNF-03 — Segurança. O sistema SHALL armazenar senhas com hash e proteger contra CSRF e XSS.

### Caso de uso / fluxo
- Pré-condições do UC-01 — Gerar Setlist Sugerido.
- Fluxos de acesso da Persona 1 (Lucas Andrade) e Persona 2 (Beatriz Ramos).

### Entidades do modelo conceitual
- Usuário

### Drivers arquiteturais
- DA-02 — Isolamento Multi-tenant por Banda.

### ADRs
- Nenhuma ADR específica identificada para autenticação; a decisão de tecnologia foi registrada em OPEN-01 e OPEN-02.

## 3. Escopo

### Incluído
- Autenticação de usuário com credencial e senha.
- Validação de credenciais.
- Início de sessão para usuário autenticado.
- Resposta explícita para erro de autenticação.
- Manutenção da identidade do usuário durante a sessão.
- Associação da sessão ao usuário autenticado para uso em operações posteriores.

### Fora do escopo
- Criação e gestão de bandas.
- Cadastro de músicas e setlists.
- Configuração de limiar de transição.
- Funcionalidades de roles ou permissões complexas além do papel do usuário em banda.
- Recuperação de senha, autenticação social, MFA ou SSO.
- Persistência física ou escolha de stack tecnológica além da decisão já registrada em OPEN-01.

## 4. Dependências

- Decisão registrada em OPEN-01: backend em Node.js + TypeScript.
- Decisão registrada em OPEN-02: frontend em HTML5 + CSS3.
- Decisão registrada em OPEN-03: banco de dados relacional PostgreSQL.
- Decisão registrada em OPEN-11: contratos de API definidos nas Specs individuais.
- Esta Spec depende de acordo explícito sobre a forma de autenticação, mas não define tecnologia além da base já aprovada.

## 5. Comportamento esperado

### Pré-condições
- O usuário possui cadastro válido no sistema.
- O sistema possui credenciais armazenadas de forma segura.
- O usuário acessa a tela ou endpoint de autenticação.

### Fluxo principal
1. O usuário informa e-mail/usuário e senha.
2. O sistema valida as credenciais informadas.
3. Se as credenciais forem válidas, o sistema inicia a sessão para esse usuário.
4. O sistema identifica o usuário autenticado para operações subsequentes.
5. O sistema concede acesso ao ambiente do usuário conforme as bandas às quais ele pertence.

### Fluxos alternativos
- **FA-01 — Credenciais inválidas:** o sistema recusa autenticação e retorna mensagem de erro sem iniciar sessão.
- **FA-02 — Usuário sem banda associada:** o sistema ainda permite autenticação, porém o usuário entra com acesso limitado e sem contexto de banda ativa.

### Fluxos de exceção
- **EX-01 — Usuário bloqueado ou inativo:** se o usuário estiver bloqueado ou desabilitado, o sistema recusa login e informa que o acesso foi negado.
- **EX-02 — Falha de persistência na validação:** se a consulta à credencial falhar, o sistema não inicia a sessão e retorna erro de autenticação seguro.

### Pós-condições
- Usuário autenticado com sessão ativa, se as credenciais forem válidas.
- Nenhuma sessão inicializada para credenciais inválidas.
- Identidade do usuário disponível para as camadas subsequentes do sistema.

## 6. Regras e invariantes

- **INV-001:** Nenhuma senha em texto claro pode ser persistida. A senha deve ser armazenada em formato hash.
- **INV-002:** Um usuário só pode iniciar sessão quando sua identidade for validada com sucesso.
- **INV-003:** Credenciais inválidas não devem criar sessão ou token ativo.
- **INV-004:** O sistema deve associar a sessão ao usuário autenticado de forma unívoca.
- **INV-005:** A sessão deve ser vinculada ao contexto do usuário e não a uma banda arbitrária sem autorização.
- **INV-006:** O sistema deve rejeitar acesso quando o usuário estiver sem status válido para autenticação.
- **INV-007:** Usuário autenticado pode seguir para operações protegidas, mas não pode acessar dados de bandas às quais não pertence.

Todas as invariantes acima são verificáveis por testes e por inspeção de comportamento do sistema autenticado.

## 7. Modelo de domínio envolvido

### Entidade: Usuário
- **Atributos relevantes:**
  - id
  - nome
  - e-mail
  - senha (hash)
- **Restrições relevantes:**
  - Um usuário é identificado de forma única por `id`.
  - `e-mail` deve ser único no sistema, se esta regra não for explicitamente desviada.
  - A senha não pode ser armazenada em texto puro.

### Relacionamentos relevantes
- Um Usuário pode ter múltiplos vínculos em várias bandas por meio de Membro.

## 8. Impacto arquitetural

### Módulos envolvidos
- Camada de apresentação: tela ou formulário de login.
- Camada de aplicação: serviço de autenticação e autenticação de sessão.
- Camada de persistência: repositório de usuários e armazenamento de hash.

### Fronteiras arquiteturais
- A autenticação é boundary entre identidade externa e acesso protegido ao sistema.
- A camada de aplicação recebe as credenciais, valida e retorna um resultado de autenticação.
- Persistência deve expor apenas operações de leitura da credencial e status do usuário.

### Responsabilidades
- **Frontend:** capturar credenciais e reportar erros de validação.
- **Backend:** validar credenciais, aplicar hash e iniciar sessão.
- **Persistência:** armazenar e consultar credenciais e dados mínimos do usuário.

### ADRs que restringem a solução
- A decisão registrada em OPEN-01 (Node.js + TypeScript) e OPEN-03 (PostgreSQL) define a base de implementação, mas não altera o comportamento de autenticação.

## 9. Contratos necessários

Como a baseline ainda não define contrato formal completo de autenticação, a especificação deve registrar a ausência de detalhes. O contrato deve ser definido em uma Spec posterior ou em um decisão operacional, conforme OPEN-11.

### Contrato conceitual de entrada
- `email` ou `usuario`
- `senha`

### Contrato conceitual de saída
- Sucesso: sessão iniciada e identidade do usuário reconhecida.
- Erro: mensagem de autenticação inválida.

### Erros necessários
- Credenciais inválidas.
- Usuário inexistente.
- Usuário bloqueado/inativo.
- Falha de persistência ou indisponibilidade de consulta.

### Registro de ausência de definição
- **OPEN-XX — contrato de API completo de autenticação:** a baseline não definiu verbos HTTP, payload exato, token ou sessão em detalhamento suficiente para se transformar em contrato formal de API. Deve ser definido antes da implementação.

## 10. Requisitos não funcionais aplicáveis

- **RNF-01 — Desempenho:** O login deve responder em menos de 2 segundos para cenários de uso normal.
  - Verificação: testes de carga e tempo de resposta em operações de autenticação.
- **RNF-03 — Segurança:** Senhas em hash, prevenção de XSS/CSRF e ausência de vazamento de credenciais em resposta.
  - Verificação: revisão de implementação, testes de segurança e validação de forma de armazenamento.

## 11. Critérios de aceitação

### Critério 1 — Login com credenciais válidas
- **Dado** que um usuário existe e suas credenciais são corretas
- **Quando** o usuário submete as credenciais no formulário ou endpoint de autenticação
- **Então** o sistema deve iniciar a sessão e permitir o acesso às funcionalidades protegidas

### Critério 2 — Login com credenciais inválidas
- **Dado** que o usuário forneceu uma senha incorreta ou e-mail inexistente
- **Quando** tenta autenticar
- **Então** o sistema deve rejeitar a autenticação e não criar sessão

### Critério 3 — Armazenamento de senha
- **Dado** que uma senha foi cadastrada no sistema
- **Quando** a informação for persistida
- **Então** a senha deve ser armazenada em formato hash e não em texto claro

### Critério 4 — Sessão associada ao usuário correto
- **Dado** que duas pessoas diferentes existem no sistema
- **Quando** cada uma autentica
- **Então** a sessão deve ser identificada apenas com a identidade correta de cada usuário

### Critério 5 — Usuário sem status válido
- **Dado** que um usuário está bloqueado ou inativo
- **Quando** tenta se autenticar
- **Então** o sistema deve negar o acesso e exibir erro apropriado

## 12. Casos de teste derivados

1. Login bem-sucedido com usuário e senha corretos.
2. Login com senha errada.
3. Login com e-mail inexistente.
4. Verificação de que nenhuma sessão é criada após erro de autenticação.
5. Verificação de que a senha armazenada não é legível em plaintext.
6. Verificação de que o usuário autenticado recebe a sessão correta.
7. Verificação de que usuário bloqueado é negado.
8. Verificação do tempo de resposta da autenticação sob carga leve.

## 13. Questões em aberto

- **OPEN-XX — contrato de autenticação formal:** o baseline não define verbos, payload, formato de token ou estratégia de sessão de forma suficiente para contrato completo de API.
- **OPEN-XX — política de bloqueio/reativação:** a baseline não define como um usuário passa a estar inativo ou bloqueado, nem em quais casos a sessão deve expirar.
- **OPEN-XX — sessão e expiração:** a baseline não explicitou regra de expiração de sessão, limite de tempo e renovação.

## 14. Definition of Done da Spec

A Spec SPEC-001 estará concluída quando:
- todos os critérios de aceitação estiverem implementados;
- todas as invariantes estiverem preservadas;
- os testes derivados estiverem aprovados;
- os RNFs aplicáveis forem verificados;
- não houver divergência conhecida entre implementação e esta Spec;
- e toda divergência em relação à baseline tiver sido explicitamente analisada e documentada.

## 15. Observação final

A autenticação é a base para todas as capacidades do sistema e deve ser tratada como uma fronteira de segurança e identidade. Neste MVP, a proposta é preservar o comportamento mínimo necessário: validar usuários, manter sessão e impedir qualquer operação protegida sem identidade autenticada e autorizada.
