# SPEC-001 — Autenticação e Identidade do Usuário

Versão: 0.1
Autor: Copilot (esboço)
Repositório: SetFlow
Arquivo: docs/specs/SPEC-001-autenticacao-identidade.md
Referência: docs/specs/mapa-de-specs.md (SPEC-001)

Sumário
-------
Esta Spec define a capacidade de autenticação e gestão de identidade de usuários no SetFlow. Cobre requisitos funcionais e não funcionais, regras de negócio, fluxos principais e critérios de aceite (Dado/Quando/Então). Qualquer decisão técnica não explicitada na baseline foi registrada como questão em aberto (OPEN-01..).

Objetivo
--------
Permitir que usuários se autentiquem de forma segura, obtenham uma sessão válida para operações protegidas e que a aplicação gerencie identidade e autorização mínima necessária para os casos de uso iniciais.

Escopo
------
Incluso:
- Cadastro de usuário com email e senha.
- Autenticação por email e senha.
- Emissão e gerenciamento de sessão/autorização para chamadas protegidas.
- Recuperação básica de senha (fluxo controlado).
- Logout e revogação de sessão.

Exclusões (fora do escopo desta Spec):
- Social login (OAuth) e SSO corporativo — serão avaliados em Specs separadas se aprovados.
- MFA além de uma possível segunda etapa (ver questões em aberto).

Stakeholders
------------
- Líder técnico
- Administrador do sistema
- Usuários finais (músicos, líderes de banda)
- Time de segurança

Rastreabilidade
---------------
- Mapa de Specs: SPEC-001
- Requisitos (do Mapa): RF-01
- Regras de negócio associadas: RB-08
- RNFs relevantes: RNF-01 (segurança de dados), RNF-03 (disponibilidade)

Requisitos Funcionais (RF)
--------------------------
RF-01: O sistema deve permitir que um usuário se cadastre com email válido e senha.
RF-02: O sistema deve permitir que um usuário autenticado inicie sessão e obtenha credenciais de acesso (token ou sessão).
RF-03: O sistema deve proteger endpoints que exigem autenticação, retornando 401 em caso de credenciais inválidas ou expiradas.
RF-04: O sistema deve permitir logout e revogação de sessão.
RF-05: O sistema deve suportar recuperação de senha via email com token temporário.

Requisitos Não Funcionais (RNF)
-------------------------------
RNF-01: Senhas devem ser armazenadas de forma segura (hash + salt) — algoritmo técnico pendente.
RNF-02: Sessões/credenciais devem expirar após um tempo configurável.
RNF-03: O sistema deve registrar tentativas de autenticação falhas para detecção de ataques por força bruta.
RNF-04: Logs de autenticação devem ser auditáveis e protegidos.

Regras de Negócio (RB)
----------------------
RB-01: Apenas emails verificados podem acessar funcionalidades que alterem dados sensíveis.
RB-02: Contas bloqueadas por segurança exigem intervenção administrativa para destravamento ou um fluxo de recuperação definido.
RB-03: Um usuário está associado a um ou mais contextos (bandas); autenticação faz apenas identificação, a autorização por contexto é tratada em outra Spec.

Modelagem de Domínio (Resumo de Entidades)
-----------------------------------------
Entidade: Usuário
- id (UUID)
- nome (string)
- email (string, único)
- password_hash (string)
- email_confirmed (boolean)
- created_at, updated_at (timestamps)
- status (enum: active, blocked, pending)

Entidade: Session / Credential (conceito)
- id (UUID)
- user_id (UUID)
- issued_at, expires_at (timestamps)
- revoked (boolean)
- client_info (opcional: user-agent / ip)

Observação: Esta modelagem é conceitual. Decisões sobre tokens JWT vs. sessões stateful, claims, campos adicionais e armazenamento devem ser definidas em ADRs/Drivers aprovados.

Fluxos e Casos de Uso (Alta Nível)
----------------------------------
1) Cadastro (UC-CADASTRO)
- Usuário fornece nome, email e senha.
- Sistema valida formato do email e força regras mínimas de senha.
- Sistema grava usuário em estado `pending` e envia token de confirmação por email.
- Após confirmação, estado muda para `active`.

2) Login (UC-LOGIN)
- Usuário fornece email e senha.
- Sistema valida e, se correto, emite credencial (sessão/tokens) válida por X horas.
- Sistema registra evento de login bem-sucedido.

3) Acesso a recurso protegido (UC-ACESSO)
- Cliente envia credencial.
- Sistema valida credencial (assinatura/expiração/revogação).
- Se válida, processa requisição; caso contrário retorna 401/403 conforme regra.

4) Logout / Revogação (UC-LOGOUT)
- Usuário inicia logout explícito.
- Sistema revoga a credencial atual (mark revoked) e responde 200.

5) Recuperação de senha (UC-RECUPERACAO)
- Usuário solicita recuperação por email.
- Sistema envia token temporário para troca de senha; token tem TTL curto.

Critérios de Aceite (exemplos Dado/Quando/Então)
------------------------------------------------
Cenário 1 — Login bem-sucedido
- Dado: Um usuário com email verificado e senha válida
- Quando: Ele submete credenciais corretas para o endpoint de autenticação
- Então: Recebe credencial válida com tempo de expiração configurável e consegue acessar endpoints protegidos

Cenário 2 — Credenciais inválidas
- Dado: Um usuário inexistente ou senha inválida
- Quando: Requisitar autenticação
- Então: Recebe 401 Unauthorized e tentativa é registrada nos logs

Cenário 3 — Token expirado
- Dado: Credencial cuja data de expiração já passou
- Quando: Tentar acessar endpoint protegido
- Então: Recebe 401 Unauthorized e instrução para reautenticação

Cenário 4 — Logout
- Dado: Usuário autenticado com sessão ativa
- Quando: Solicitar logout
- Então: A sessão é revogada e a mesma credencial deixa de ser válida

Métricas e Monitoramento
------------------------
- Taxa de falha de login (por minuto/hora)
- Tentativas de brute-force detectadas e IPs bloqueados temporariamente
- Tempo médio para emissão de sessão
- Número de tokens revogados

Segurança e Privacidade
----------------------
- Armazenar apenas hashes de senha; nunca armazenar senha em texto claro.
- Limitar exposição de mensagens de erro que possam vazar existência de conta (configurável para UX vs. segurança).
- Registrar eventos de autenticação com controle de acesso aos logs.

Questões em Aberto (abrir entradas em docs/sdd-open-questions.md)
----------------------------------------------------------------
- OPEN-001: Definir método de token/sessão: JWT (stateless) ou sessão stateful? (impacta revogação e escala)
- OPEN-002: Definir algoritmo de hashing e parâmetros (ex.: bcrypt/argon2 + custo) — requisito de segurança
- OPEN-003: Política de expiração padrão de sessão e refresh tokens (se aplicável)
- OPEN-004: Requisitos sobre verificação de email e bloqueio de conta após N tentativas
- OPEN-005: Necessidade de MFA/2FA no MVP
- OPEN-006: Política de reset de senha (token TTL, limite de tentativas)

Plano de Testes (esboço)
------------------------
Para cada Critério de Aceite haverá testes automatizados unitários e de integração:
- Testes de serviço de autenticação: sucesso, falha, expiração, revogação
- Testes de recuperação de senha: emissão de token, troca de senha válida, token expirado
- Testes de segurança: garantir que password_hash nunca é retornado por endpoints

Checklist para Aprovação / Alteração pelo Administrador
-------------------------------------------------------
O administrador deve revisar e aprovar (ou solicitar alteração) dos seguintes itens destacados neste layout:
- Escopo (inclusões/exclusões)
- Requisitos funcionais e não funcionais (RF/RNF)
- Regras de negócio críticas (RB)
- Questões em aberto (deve atribuir owners e prioridades)
- Critérios de aceite (com exemplos Dado/Quando/Então)

Proposta de Processo de Alteração (fluxo para comentários e atualização)
- O admin comenta neste arquivo no PR: apontar seção e sugestão.
- Cada comentário que modificar requisitos deve gerar uma nova entrada OPEN-0XX se criar impacto técnico.
- Após aprovação, a Spec será finalizada (versão 1.0) e servirá de base para tarefas de implementação e testes.

Formato e Layout para Aprovação (visual)
----------------------------------------
Sugestão: manter este documento com os blocos abaixo para revisão rápida:
1) Cabeçalho (ID, título, versão)
2) Objetivo e Escopo (1 parágrafo)
3) RF / RNF / RB (listas curtas)
4) Fluxos principais (passos enumerados)
5) Critérios de Aceite (cenários GWT)
6) Questões em Aberto (lista numerada com owner)
7) Plano de Testes (itens de teste chave)
8) Checklist de aprovação (simples: Aprovar / Solicitar alteração)

Observações finais
------------------
Este é um layout inicial (versão 0.1) criado conforme as diretrizes de Spec-Driven Development do projeto. Não foram tomadas decisões técnicas irreversíveis; todas as pendências foram registradas como OPEN-00X para discussão e aprovação.

---

Por favor, revise as seções em destaque (Escopo, RF, RNF, RB e Questões em Aberto). Indique aprovações ou apontamentos específicos (ex.: definir política de expiração, escolher algoritmo de hash) para que eu atualize a Spec e gere a versão 1.0.
