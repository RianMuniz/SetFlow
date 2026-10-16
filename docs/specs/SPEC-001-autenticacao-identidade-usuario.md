# SPEC-001 — Autenticação e Identidade do Usuário

## 1. Identificação

- **ID:** SPEC-001
- **Nome:** Autenticação e Identidade do Usuário
- **Objetivo:** Permitir cadastro público, autenticação por sessão HTTP e identificação segura do usuário autenticado.
- **Status:** Implementada no MVP com JavaScript/CommonJS e Express.

## 2. Decisões consolidadas desta Spec

- Autenticação via **sessão HTTP no servidor** com **cookie**.
- Cookie de sessão com:
  - `HttpOnly=true`
  - `SameSite=Lax`
  - `Path=/`
  - `Secure=true` somente em produção.
- **TTL da sessão: 24 horas**, sem renovação automática.
- Cadastro de usuário é **público**.
- Rate limiting no login: **5 tentativas inválidas** por combinação `IP + e-mail normalizado` em **15 minutos**; a **6ª tentativa** dentro da janela retorna `HTTP 429`.
- Login bem-sucedido limpa o contador do rate limiting para a chave correspondente.
- Senhas nunca são persistidas em texto claro; uso de PBKDF2 + salt e comparação segura.
- Usuário inativo/bloqueado não autentica.
- Usuário sem banda associada pode autenticar normalmente.

## 3. Escopo

### Incluído
- Endpoints REST JSON:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Sessão no servidor e cookie com identificador aleatório imprevisível.
- Contrato de erros padronizado.
- Tratamento de JSON inválido e validações de payload.

### Fora do escopo
- Recuperação de senha, MFA, SSO e autenticação social.
- Gestão de banda, repertório, setlist e demais Specs (SPEC-002+).
- Persistência em banco relacional nesta etapa (MVP em memória com abstrações injetáveis).

## 4. Contratos HTTP implementados

## `POST /api/auth/register`

### Entrada (JSON)
```json
{
  "email": "maria@teste.com",
  "password": "senha1234"
}
```

### Regras
- `email`: obrigatório, normalizado (trim + lowercase), formato válido.
- `password`: obrigatória, string com 8 a 128 caracteres.
- E-mail duplicado é rejeitado.
- Usuário criado com `status: "active"`.
- Sessão iniciada automaticamente após cadastro.

### Saída de sucesso (`201`)
```json
{
  "user": {
    "id": "u-1",
    "email": "maria@teste.com",
    "status": "active"
  }
}
```

## `POST /api/auth/login`

### Entrada (JSON)
```json
{
  "email": "maria@teste.com",
  "password": "senha1234"
}
```

### Regras
- Valida payload e rate limit por `IP + e-mail normalizado`.
- E-mail inexistente e senha incorreta retornam mesmo erro genérico.
- Usuário inativo/bloqueado retorna erro específico.
- No sucesso, mantém apenas uma sessão válida por usuário.

### Saída de sucesso (`200`)
```json
{
  "user": {
    "id": "u-1",
    "email": "maria@teste.com",
    "status": "active"
  }
}
```

## `POST /api/auth/logout`

### Regras
- Invalida sessão no servidor quando existir.
- Limpa cookie de sessão.
- É seguro quando sessão já não existe.

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
- Retorna somente representação pública.
- Sessão ausente/inválida/expirada é rejeitada.

### Saída de sucesso (`200`)
```json
{
  "user": {
    "id": "u-1",
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
- `INVALID_CREDENTIALS`
- `ACCOUNT_INACTIVE`
- `AUTHENTICATION_REQUIRED`
- `SESSION_EXPIRED`
- `RATE_LIMIT_EXCEEDED`
- `INTERNAL_ERROR`

## 6. Segurança e invariantes

- Não expor `password`, `passwordHash` ou `passwordSalt` em respostas.
- Não armazenar dados do usuário no cookie; cookie carrega apenas `sessionId`.
- Identificador de sessão gerado com `crypto.randomBytes`.
- Comparação de senha com `crypto.timingSafeEqual`.
- Não diferenciar usuário inexistente de senha incorreta no login (`INVALID_CREDENTIALS`).

## 7. Critérios de aceitação verificados

- Cadastro válido e inválido.
- Cadastro com e-mail duplicado.
- Login válido e inválido (erro genérico para credenciais inválidas).
- Usuário bloqueado/inativo não autentica.
- Senha não persistida em plaintext.
- Cookie com flags esperadas.
- Sessão de 24 horas e sessão expirada.
- `/api/auth/me` com e sem autenticação.
- Logout com invalidação de sessão.
- Rate limit: 5 falhas permitidas, 6ª bloqueada.
- Limpeza do rate limit após login válido.
- Ausência de dados sensíveis nas respostas.
- Tratamento de JSON inválido e validação de payload.

## 8. Definition of Done da Spec

A SPEC-001 está concluída quando:
- os endpoints e contratos acima estiverem implementados;
- os critérios de aceitação estiverem cobertos por testes;
- a sessão e o rate limiting seguirem as decisões consolidadas;
- não houver dependência funcional da SPEC-002+ para autenticar um usuário.
