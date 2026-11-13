const assert = require('assert');
const http = require('http');
const { createAuthApp, RATE_LIMIT_MAX_ATTEMPTS } = require('../authHttp');
const { SESSION_TTL_MS, createUser } = require('../authService');

console.log('🧪 Iniciando testes HTTP da SPEC-001 (Autenticação e Identidade)...\n');

function parseJson(body) {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
}

function request({ port, method, path, body, rawBody, headers = {} }) {
  return new Promise((resolve, reject) => {
    const requestBody = rawBody !== undefined
      ? rawBody
      : (body !== undefined ? JSON.stringify(body) : undefined);

    const requestHeaders = Object.assign({}, headers);
    if (requestBody !== undefined) {
      requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
      requestHeaders['Content-Length'] = Buffer.byteLength(requestBody);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: requestHeaders
    }, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: responseBody,
          json: parseJson(responseBody)
        });
      });
    });

    req.on('error', reject);
    if (requestBody !== undefined) {
      req.write(requestBody);
    }
    req.end();
  });
}

function extractCookieValue(setCookieHeader, cookieName) {
  const setCookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

  for (const cookie of setCookies) {
    if (!cookie) {
      continue;
    }

    const prefix = `${cookieName}=`;
    if (cookie.startsWith(prefix)) {
      const end = cookie.indexOf(';');
      return end === -1 ? cookie : cookie.slice(0, end);
    }
  }

  return null;
}

function firstSetCookie(setCookieHeader) {
  if (Array.isArray(setCookieHeader)) {
    return setCookieHeader[0];
  }

  return setCookieHeader || '';
}

async function withServer(options, callback) {
  const app = createAuthApp(options);
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    await callback({ port });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function run() {
  await withServer({ isProduction: false }, async ({ port }) => {
    const registerResponse = await request({
      port,
      method: 'POST',
      path: '/api/auth/register',
      body: { nickname: 'Maria', email: '  Maria@Teste.com ', password: 'senha1234' }
    });

    assert.strictEqual(registerResponse.status, 201);
    assert.strictEqual(registerResponse.json.user.email, 'maria@teste.com');
    assert.strictEqual(registerResponse.json.user.nickname, 'Maria');
    assert.ok(!('passwordHash' in registerResponse.json.user), 'Resposta não deve expor hash.');
    assert.ok(!('passwordSalt' in registerResponse.json.user), 'Resposta não deve expor salt.');

    const setCookie = registerResponse.headers['set-cookie'];
    const sessionCookie = extractCookieValue(setCookie, 'setflow_session');
    assert.ok(sessionCookie, 'Cadastro deve iniciar sessão por cookie.');
    const cookieHeader = firstSetCookie(setCookie);
    assert.ok(cookieHeader.includes('HttpOnly'), 'Cookie deve ser HttpOnly.');
    assert.ok(cookieHeader.includes('SameSite=Lax'), 'Cookie deve usar SameSite=Lax.');
    assert.ok(cookieHeader.includes('Path=/'), 'Cookie deve usar Path=/.');
    assert.ok(!cookieHeader.includes('Secure'), 'Cookie não deve ser Secure fora de produção.');

    const meResponse = await request({
      port,
      method: 'GET',
      path: '/api/auth/me',
      headers: { Cookie: sessionCookie }
    });

    assert.strictEqual(meResponse.status, 200);
    assert.strictEqual(meResponse.json.user.email, 'maria@teste.com');
    assert.strictEqual(meResponse.json.user.nickname, 'Maria', '/me deve incluir o nickname.');
    console.log('✅ Cadastro público cria usuário ativo, sessão e representação pública segura.');
  });

  await withServer({ isProduction: false }, async ({ port }) => {
    const invalidEmail = await request({
      port,
      method: 'POST',
      path: '/api/auth/register',
      body: { nickname: 'invalido', email: 'invalido', password: 'senha1234' }
    });
    assert.strictEqual(invalidEmail.status, 400);
    assert.strictEqual(invalidEmail.json.error.code, 'VALIDATION_ERROR');

    const invalidPassword = await request({
      port,
      method: 'POST',
      path: '/api/auth/register',
      body: { nickname: 'joao', email: 'joao@teste.com', password: '123' }
    });
    assert.strictEqual(invalidPassword.status, 400);
    assert.strictEqual(invalidPassword.json.error.code, 'VALIDATION_ERROR');

    const invalidJson = await request({
      port,
      method: 'POST',
      path: '/api/auth/register',
      rawBody: '{ "email": "joao@teste.com", ',
      headers: { 'Content-Type': 'application/json' }
    });

    assert.strictEqual(invalidJson.status, 400);
    assert.strictEqual(invalidJson.json.error.code, 'VALIDATION_ERROR');
    console.log('✅ Validação de cadastro e JSON inválido retornam contrato consistente.');
  });

  await withServer({ isProduction: false }, async ({ port }) => {
    const register = (body) => request({ port, method: 'POST', path: '/api/auth/register', body });

    const missing = await register({ email: 'sem-nick@teste.com', password: 'senha1234' });
    assert.strictEqual(missing.status, 400);
    assert.strictEqual(missing.json.error.code, 'VALIDATION_ERROR');

    for (const invalid of ['ab', 'a'.repeat(21), 'nick name', 'nick@name', '   ', 123]) {
      const response = await register({ nickname: invalid, email: 'invalido-nick@teste.com', password: 'senha1234' });
      assert.strictEqual(response.status, 400, `Nickname ${JSON.stringify(invalid)} deve ser rejeitado.`);
      assert.strictEqual(response.json.error.code, 'VALIDATION_ERROR');
    }

    const first = await register({ nickname: 'Guitarrista', email: 'g1@teste.com', password: 'senha1234' });
    assert.strictEqual(first.status, 201);

    const duplicate = await register({ nickname: '  guitarrista ', email: 'g2@teste.com', password: 'senha1234' });
    assert.strictEqual(duplicate.status, 409);
    assert.strictEqual(duplicate.json.error.code, 'NICKNAME_ALREADY_EXISTS');

    const login = await request({
      port,
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'g1@teste.com', password: 'senha1234' }
    });
    assert.strictEqual(login.status, 200, 'Login continua usando e-mail + senha.');
    assert.strictEqual(login.json.user.nickname, 'Guitarrista');
    console.log('✅ Nickname obrigatório, validado e único sem diferenciar maiúsculas/minúsculas.');
  });

  await withServer({ isProduction: false }, async ({ port }) => {
    const firstRegister = await request({
      port,
      method: 'POST',
      path: '/api/auth/register',
      body: { nickname: 'ana', email: 'ana@teste.com', password: 'senha1234' }
    });
    assert.strictEqual(firstRegister.status, 201);

    const duplicateRegister = await request({
      port,
      method: 'POST',
      path: '/api/auth/register',
      body: { nickname: 'ana', email: 'ana@teste.com', password: 'senha1234' }
    });
    assert.strictEqual(duplicateRegister.status, 409);
    assert.strictEqual(duplicateRegister.json.error.code, 'EMAIL_ALREADY_EXISTS');
    console.log('✅ E-mail duplicado é rejeitado com código específico.');
  });

  await withServer({ isProduction: false }, async ({ port }) => {
    await request({
      port,
      method: 'POST',
      path: '/api/auth/register',
      body: { nickname: 'carlos', email: 'carlos@teste.com', password: 'senha1234' }
    });

    const wrongPassword = await request({
      port,
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'carlos@teste.com', password: 'senha-errada' }
    });
    assert.strictEqual(wrongPassword.status, 401);
    assert.strictEqual(wrongPassword.json.error.code, 'INVALID_CREDENTIALS');

    const nonExistentUser = await request({
      port,
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'naoexiste@teste.com', password: 'senha-errada' }
    });
    assert.strictEqual(nonExistentUser.status, 401);
    assert.strictEqual(nonExistentUser.json.error.code, 'INVALID_CREDENTIALS');
    assert.strictEqual(nonExistentUser.json.error.message, wrongPassword.json.error.message);

    const validLogin = await request({
      port,
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'carlos@teste.com', password: 'senha1234' }
    });
    assert.strictEqual(validLogin.status, 200);
    assert.ok(!('passwordHash' in validLogin.json.user));
    assert.ok(!('passwordSalt' in validLogin.json.user));
    console.log('✅ Login válido/inválido preserva contrato e evita enumeração de contas.');
  });

  const blockedUsersByEmail = new Map();
  const blockedUsersById = new Map();
  const blocked = createUser({
    id: 'u-999',
    email: 'bloqueado@teste.com',
    password: 'senha1234',
    status: 'blocked'
  });
  blockedUsersByEmail.set(blocked.email, blocked);
  blockedUsersById.set(blocked.id, blocked);

  await withServer({ isProduction: false, usersByEmail: blockedUsersByEmail, usersById: blockedUsersById }, async ({ port }) => {
    const response = await request({
      port,
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'bloqueado@teste.com', password: 'senha1234' }
    });

    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.json.error.code, 'ACCOUNT_INACTIVE');
    console.log('✅ Usuário inativo/bloqueado não autentica.');
  });

  await withServer({ isProduction: false }, async ({ port }) => {
    const registerResponse = await request({
      port,
      method: 'POST',
      path: '/api/auth/register',
      body: { nickname: 'logout', email: 'logout@teste.com', password: 'senha1234' }
    });
    const sessionCookie = extractCookieValue(registerResponse.headers['set-cookie'], 'setflow_session');

    const logoutResponse = await request({
      port,
      method: 'POST',
      path: '/api/auth/logout',
      headers: { Cookie: sessionCookie }
    });
    assert.strictEqual(logoutResponse.status, 200);

    const meAfterLogout = await request({
      port,
      method: 'GET',
      path: '/api/auth/me',
      headers: { Cookie: sessionCookie }
    });

    assert.strictEqual(meAfterLogout.status, 401);
    assert.strictEqual(meAfterLogout.json.error.code, 'AUTHENTICATION_REQUIRED');
    console.log('✅ Logout invalida sessão no servidor e limpa autenticação.');
  });

  await withServer({ isProduction: false }, async ({ port }) => {
    const meWithoutCookie = await request({
      port,
      method: 'GET',
      path: '/api/auth/me'
    });
    assert.strictEqual(meWithoutCookie.status, 401);
    assert.strictEqual(meWithoutCookie.json.error.code, 'AUTHENTICATION_REQUIRED');
    console.log('✅ /me sem autenticação é rejeitado.');
  });

  let currentTime = Date.parse('2026-01-01T00:00:00.000Z');
  const usersByEmail = new Map();
  const usersById = new Map();
  const sessionsById = new Map();
  const user = createUser({ id: 'u-1', email: 'tempo@teste.com', password: 'senha1234' });
  usersByEmail.set(user.email, user);
  usersById.set(user.id, user);

  await withServer({
    isProduction: false,
    now: () => currentTime,
    usersByEmail,
    usersById,
    sessionsById
  }, async ({ port }) => {
    const loginResponse = await request({
      port,
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'tempo@teste.com', password: 'senha1234' }
    });
    const sessionCookie = extractCookieValue(loginResponse.headers['set-cookie'], 'setflow_session');
    assert.strictEqual(sessionsById.size, 1);

    const session = Array.from(sessionsById.values())[0];
    const createdAt = new Date(session.createdAt).getTime();
    const expiresAt = new Date(session.expiresAt).getTime();
    assert.strictEqual(expiresAt - createdAt, SESSION_TTL_MS, 'Sessão deve expirar em 24 horas exatas.');

    currentTime += SESSION_TTL_MS + 1;

    const expiredMe = await request({
      port,
      method: 'GET',
      path: '/api/auth/me',
      headers: { Cookie: sessionCookie }
    });
    assert.strictEqual(expiredMe.status, 401);
    assert.strictEqual(expiredMe.json.error.code, 'SESSION_EXPIRED');
    console.log('✅ Sessão expirada após 24h é rejeitada com código específico.');
  });

  await withServer({ isProduction: false }, async ({ port }) => {
    await request({
      port,
      method: 'POST',
      path: '/api/auth/register',
      body: { nickname: 'rate', email: 'rate@teste.com', password: 'senha1234' }
    });

    for (let attempt = 1; attempt <= RATE_LIMIT_MAX_ATTEMPTS; attempt += 1) {
      const response = await request({
        port,
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'rate@teste.com', password: 'senha-errada' }
      });
      assert.strictEqual(response.status, 401, `Tentativa ${attempt} deve retornar 401.`);
    }

    const blockedAttempt = await request({
      port,
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'rate@teste.com', password: 'senha-errada' }
    });
    assert.strictEqual(blockedAttempt.status, 429);
    assert.strictEqual(blockedAttempt.json.error.code, 'RATE_LIMIT_EXCEEDED');
    console.log('✅ Rate limit permite 5 falhas e bloqueia a 6ª tentativa.');
  });

  await withServer({ isProduction: false }, async ({ port }) => {
    await request({
      port,
      method: 'POST',
      path: '/api/auth/register',
      body: { nickname: 'limpeza', email: 'limpeza@teste.com', password: 'senha1234' }
    });

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const response = await request({
        port,
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'limpeza@teste.com', password: 'senha-errada' }
      });
      assert.strictEqual(response.status, 401);
    }

    const successfulLogin = await request({
      port,
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'limpeza@teste.com', password: 'senha1234' }
    });
    assert.strictEqual(successfulLogin.status, 200);

    for (let attempt = 1; attempt <= RATE_LIMIT_MAX_ATTEMPTS; attempt += 1) {
      const response = await request({
        port,
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'limpeza@teste.com', password: 'senha-errada' }
      });
      assert.strictEqual(response.status, 401);
    }
    console.log('✅ Login válido limpa o contador de tentativas inválidas.');
  });

  await withServer({ isProduction: false }, async ({ port }) => {
    await request({
      port,
      method: 'POST',
      path: '/api/auth/register',
      body: { nickname: 'sessao', email: 'sessao@teste.com', password: 'senha1234' }
    });

    const firstLogin = await request({
      port,
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'sessao@teste.com', password: 'senha1234' }
    });
    const firstCookie = extractCookieValue(firstLogin.headers['set-cookie'], 'setflow_session');

    const secondLogin = await request({
      port,
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'sessao@teste.com', password: 'senha1234' }
    });
    const secondCookie = extractCookieValue(secondLogin.headers['set-cookie'], 'setflow_session');

    const oldSessionAccess = await request({
      port,
      method: 'GET',
      path: '/api/auth/me',
      headers: { Cookie: firstCookie }
    });
    assert.strictEqual(oldSessionAccess.status, 401);

    const newSessionAccess = await request({
      port,
      method: 'GET',
      path: '/api/auth/me',
      headers: { Cookie: secondCookie }
    });
    assert.strictEqual(newSessionAccess.status, 200);
    console.log('✅ Login mantém apenas uma sessão válida por usuário.');
  });
}

run()
  .then(() => {
    console.log('\n🎉 Todos os testes HTTP da SPEC-001 passaram com sucesso!');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
