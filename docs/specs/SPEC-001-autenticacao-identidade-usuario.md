# SPEC-001 — Autenticação e Identidade do Usuário

## 1. Identificação

- **ID:** SPEC-001
- **Nome:** Autenticação e Identidade do Usuário
- **Objetivo:** Permitir cadastro público, autenticação por sessão HTTP e identificação segura do usuário autenticado.
- **Status:** Implementada no MVP com JavaScript/CommonJS, Express e PostgreSQL.

## 2. Decisões consolidadas desta Spec

- Autenticação via **sessão HTTP no servidor** com **cookie**.
- Cookie de sessão com `HttpOnly=true`, `SameSite=Lax`, `Path=/` e `Secure=true` somente em produção.
- **TTL da sessão: 24 horas**, sem renovação automática.
- Cadastro de usuário é **público**.
- O cadastro exige `nickname`, `email` e `password`.
- O nickname é globalmente único, normalizado para comparação sem diferenciar maiúsculas/minúsculas, e deve ter de 3 a 20 caracteres, usando somente letras ASCII, números, `.`, `-` e `_`.
- O e-mail continua sendo o identificador de login.
- Rate limiting no login: **5 tentativas inválidas** por combinação `IP + e-mail normalizado` em **15 minutos**; a **6ª tentativa** dentro da janela retorna `HTTP 429`.
- Login bem-sucedido limpa o contador do rate limiting para a chave correspondente.
- Senhas nunca são persistidas em texto claro; uso de PBKDF2 + salt e comparação segura.
- Usuário inativo/bloqueado não autentica.
- Usuário sem banda associada pode autenticar normalmente.
- Usuários são persistidos em PostgreSQL, na tabela `users`, conforme o modelo da SPEC-002 §7. Os IDs têm o formato `u-<uuid>`.
- As sessões continuam armazenadas em memória no servidor.

## 3. Escopo

### Incluído

- Endpoints REST JSON:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Sessão no servidor e cookie com identificador aleatório imprevisível.
- Persistência de usuários em PostgreSQL via repositório injetável.
- Contrato de erros padronizado.
- Tratamento de JSON inválido e validações de payload.

### Fora do escopo

- Recuperação de senha, MFA, SSO e autenticação social.
- Gestão de banda, repertório, setlist e demais Specs (SPEC-002+).

## 4. Contratos HTTP implementados

## `POST /api/auth/register`

### Entrada (JSON)

```json
{
  "nickname": "maria.silva",
  "email": "maria@teste.com",
  "password": "senha1234"
}
```

### Regras

- `nickname`: obrigatório, normalizado para comparação, com 3 a 20 caracteres após `trim`; aceita somente letras ASCII, números, ponto (`.`), hífen (`-`) e sublinhado (`_`).
- Nickname duplicado, sem diferenciar maiúsculas/minúsculas, é rejeitado.
- `email`: obrigatório, normalizado (`trim + lowercase`), com formato válido.
- `password`: obrigatória, string com 8 a 128 caracteres.
- E-mail duplicado é rejeitado.
- Usuário criado com `status: "active"`.
- Sessão iniciada automaticamente após cadastro.

### Saída de sucesso (`201`)

```json
{
  "user": {
    "id": "u-550e8400-e29b-41d4-a716-446655440000",
    "nickname": "maria.silva",
    "email": "maria@teste.com",
    "status": "active"
  }
}
```

A representação pública nunca contém senha, hash ou salt.

## `POST /api/auth/login`

### Entrada (JSON)

```json
{
  "email": "maria@teste.com",
  "password": "senha1234"
}
```

### Regras

- O login continua usando e-mail + senha.
- Valida payload e rate limit por `IP + e-mail normalizado`.
- E-mail inexistente e senha incorreta retornam o mesmo erro genérico.
- Usuário inativo/bloqueado retorna erro específico.
- No sucesso, mantém apenas uma sessão válida por usuário.
- Cookie, expiração de 24 horas e rate limit permanecem conforme as decisões desta Spec.

### Saída de sucesso (`200`)

```json
{
  "user": {
    "id": "u-550e8400-e29b-41d4-a716-446655440000",
    "nickname": "maria.silva",
    "email": "maria@teste.com",
    "status": "active"
  }
}
```

## `POST /api/auth/logout`

### Regras

- Invalida sessão no servidor quando existir.
- Limpa cookie de sessão.
- É seguro quando a sessão já não existe.

### Saída de sucesso (`200`)

```json
{
  "success": true
}
```

## `GET /api/auth/me`

### Regras

- Lê cookie de sessão.
- Valida existência da sessão, expiração e status do usuário.
- Retorna somente a representação pública `{ id, nickname, email, status }`.
- Sessão ausente, inválida ou expirada é rejeitada.

### Saída de sucesso (`200`)

```json
{
  "user": {
    "id": "u-550e8400-e29b-41d4-a716-446655440000",
    "nickname": "maria.silva",
    "email": "maria@teste.com",
    "status": "active"
  }
}
```

## 5. Contrato de erro

Formato padrão:

```json
{
  "error": {
    "code": "CODIGO",
    "message": "Mensagem"
  }
}
```

Códigos implementados:

- `VALIDATION_ERROR`
- `EMAIL_ALREADY_EXISTS`
- `NICKNAME_ALREADY_EXISTS`
- `INVALID_CREDENTIALS`
- `ACCOUNT_INACTIVE`
- `AUTHENTICATION_REQUIRED`
- `SESSION_EXPIRED`
- `RATE_LIMIT_EXCEEDED`
- `INTERNAL_ERROR`

## 6. Segurança e invariantes

- Não expor `password`, `passwordHash` ou `passwordSalt` em respostas.
- Não armazenar dados do usuário no cookie; o cookie carrega apenas `sessionId`.
- Identificador de sessão gerado com `crypto.randomBytes`.
- Comparação de senha com `crypto.timingSafeEqual`.
- Não diferenciar usuário inexistente de senha incorreta no login (`INVALID_CREDENTIALS`).
- Nicknames são globalmente únicos e adequados para identificação de membros na SPEC-002.
- Toda consulta de usuário persistido deve respeitar o repositório e o isolamento definidos na arquitetura.

## 7. Critérios de aceitação verificados

- Cadastro válido com nickname, e-mail e senha.
- Rejeição de nickname ausente, inválido ou duplicado.
- Cadastro com e-mail duplicado.
- Login válido e inválido, mantendo o erro genérico para credenciais inválidas.
- Usuário bloqueado/inativo não autentica.
- Senha não persistida em plaintext.
- Usuário persistido em PostgreSQL com ID `u-<uuid>`.
- Cookie com flags esperadas.
- Sessão de 24 horas e sessão expirada.
- `/api/auth/me` com e sem autenticação.
- Logout com invalidação de sessão.
- Rate limit: 5 falhas permitidas, 6ª bloqueada.
- Limpeza do rate limit após login válido.
- Ausência de dados sensíveis nas respostas de cadastro, login e `/api/auth/me`.
- Tratamento de JSON inválido e validação de payload.

## 8. Definition of Done da Spec

A SPEC-001 está concluída quando:

- os endpoints e contratos acima estiverem implementados;
- os usuários forem persistidos em PostgreSQL conforme o modelo aprovado;
- os critérios de aceitação estiverem cobertos por testes;
- a sessão e o rate limiting seguirem as decisões consolidadas;
- não houver dependência funcional da SPEC-002+ para autenticar um usuário.
