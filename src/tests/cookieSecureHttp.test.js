const assert = require('assert');
const { createAuthApp, request, withServer } = require('./httpTestUtils');
const { createMemoryRepositories } = require('../repositories/memoryRepositories');

console.log('🧪 Iniciando testes do atributo Secure do cookie de sessão...\n');

async function sessionCookieFor(appOptions) {
  const app = createAuthApp({ repositories: createMemoryRepositories(), ...appOptions });
  let header = '';

  await withServer(app, async ({ port }) => {
    const response = await request({
      port,
      method: 'POST',
      path: '/api/auth/register',
      body: { nickname: 'ana', email: 'ana@teste.com', password: 'senha1234' }
    });
    assert.strictEqual(response.status, 201);
    header = [].concat(response.headers['set-cookie']).find((cookie) => cookie.startsWith('setflow_session=')) || '';
  });

  return header;
}

(async function main() {
  const productionDefault = await sessionCookieFor({ isProduction: true, cookieSecure: undefined });
  assert.match(productionDefault, /; Secure/i);
  assert.match(productionDefault, /HttpOnly/i);

  const productionHttp = await sessionCookieFor({ isProduction: true, cookieSecure: false });
  assert.doesNotMatch(productionHttp, /; Secure/i, 'COOKIE_SECURE=false deve permitir login por HTTP');
  assert.match(productionHttp, /HttpOnly/i);
  assert.match(productionHttp, /SameSite=Lax/i);

  const developmentSecure = await sessionCookieFor({ isProduction: false, cookieSecure: true });
  assert.match(developmentSecure, /; Secure/i);

  console.log('✅ Secure por padrão em produção; COOKIE_SECURE=false libera HTTP sem perder HttpOnly/SameSite.');
  console.log('\n🎉 Todos os testes do cookie de sessão passaram com sucesso!');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
