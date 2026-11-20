const assert = require('assert');
const { createAuthApp, request, extractCookieValue, withServer } = require('./httpTestUtils');
const { createMemoryRepositories } = require('../repositories/memoryRepositories');
const { RESET_TOKEN_TTL_MS } = require('../passwordReset');

console.log('🧪 Iniciando testes HTTP da redefinição de senha...\n');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) {
      return;
    }
    await wait(10);
  }
  throw new Error(`Tempo esgotado esperando: ${label}`);
}

(async function main() {
  const outbox = [];
  let clock = Date.parse('2026-11-19T12:00:00Z');
  const app = createAuthApp({
    repositories: createMemoryRepositories(),
    isProduction: false,
    now: () => clock,
    appBaseUrl: 'http://app.test/',
    mailer: { async send(message) { outbox.push(message); } }
  });

  await withServer(app, async ({ port }) => {
    const call = (method, path, body, cookie) => request({ port, method, path, body, headers: cookie ? { Cookie: cookie } : {} });
    const requestReset = (email) => call('POST', '/api/auth/password-reset/request', { email });
    const confirmReset = (token, password) => call('POST', '/api/auth/password-reset/confirm', { token, password });
    const tokenFrom = (message) => {
      const match = message.text.match(/http:\/\/app\.test\/#reset=([0-9a-f]{64})/);
      assert.ok(match, 'e-mail deve conter o link com o token no fragmento');
      return match[1];
    };

    async function signUp(nickname, password = 'senha1234') {
      const response = await call('POST', '/api/auth/register', { nickname, email: `${nickname}@teste.com`, password });
      assert.strictEqual(response.status, 201);
      return extractCookieValue(response.headers['set-cookie'], 'setflow_session');
    }

    const anaCookie = await signUp('ana');

    // ---- sem enumeração de contas
    const unknown = await requestReset('ninguem@teste.com');
    const known = await requestReset('ana@teste.com');
    assert.strictEqual(unknown.status, 202);
    assert.strictEqual(known.status, 202);
    assert.deepStrictEqual(unknown.json, known.json);
    await waitFor(() => outbox.length === 1, 'e-mail da ana');
    assert.strictEqual(outbox[0].to, 'ana@teste.com');
    assert.ok(!known.body.includes(tokenFrom(outbox[0])), 'a resposta da API nunca traz o token');
    assert.strictEqual((await requestReset('formato-invalido')).status, 400);
    console.log('✅ Pedido responde 202 igual para e-mail existente e inexistente; só a conta real recebe o link.');

    // ---- novo pedido invalida o anterior
    const token1 = tokenFrom(outbox[0]);
    await requestReset('ana@teste.com');
    await waitFor(() => outbox.length === 2, 'segundo e-mail');
    const token2 = tokenFrom(outbox[1]);
    assert.notStrictEqual(token1, token2);
    const stale = await confirmReset(token1, 'novaSenha123');
    assert.strictEqual(stale.status, 400);
    assert.strictEqual(stale.json.error.code, 'INVALID_RESET_TOKEN');
    console.log('✅ Um novo pedido invalida o link anterior.');

    // ---- validações não queimam o token
    assert.strictEqual((await confirmReset('abc', 'novaSenha123')).json.error.code, 'INVALID_RESET_TOKEN');
    const weak = await confirmReset(token2, '123');
    assert.strictEqual(weak.status, 400);
    assert.strictEqual(weak.json.error.code, 'VALIDATION_ERROR');
    console.log('✅ Token malformado é recusado e senha fraca não consome o link.');

    // ---- redefinição
    const done = await confirmReset(token2, 'novaSenha123');
    assert.strictEqual(done.status, 200);
    assert.strictEqual((await call('GET', '/api/auth/me', undefined, anaCookie)).status, 401, 'sessões antigas são encerradas');
    assert.strictEqual((await call('POST', '/api/auth/login', { email: 'ana@teste.com', password: 'senha1234' })).status, 401);
    const login = await call('POST', '/api/auth/login', { email: 'ana@teste.com', password: 'novaSenha123' });
    assert.strictEqual(login.status, 200);
    console.log('✅ Redefinir troca a senha, encerra sessões antigas e permite entrar com a nova.');

    // ---- uso único
    const reuse = await confirmReset(token2, 'outraSenha123');
    assert.strictEqual(reuse.status, 400);
    assert.strictEqual(reuse.json.error.code, 'INVALID_RESET_TOKEN');
    assert.strictEqual((await call('POST', '/api/auth/login', { email: 'ana@teste.com', password: 'novaSenha123' })).status, 200);
    console.log('✅ O link só funciona uma vez.');

    // ---- expiração
    await requestReset('ana@teste.com');
    await waitFor(() => outbox.length === 3, 'terceiro e-mail');
    const token3 = tokenFrom(outbox[2]);
    clock += RESET_TOKEN_TTL_MS + 1000;
    const expired = await confirmReset(token3, 'senhaExpirada123');
    assert.strictEqual(expired.status, 400);
    assert.strictEqual(expired.json.error.code, 'INVALID_RESET_TOKEN');
    console.log('✅ Link expira em 30 minutos.');

    // ---- limite de pedidos por IP + e-mail
    await signUp('bia');
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      assert.strictEqual((await requestReset('bia@teste.com')).status, 202);
    }
    const limited = await requestReset('bia@teste.com');
    assert.strictEqual(limited.status, 429);
    assert.strictEqual(limited.json.error.code, 'RATE_LIMIT_EXCEEDED');
    console.log('✅ O 4º pedido para o mesmo e-mail na janela de 15 minutos retorna 429.');
  });

  console.log('\n🎉 Todos os testes HTTP da redefinição de senha passaram com sucesso!');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
