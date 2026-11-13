const assert = require('assert');
const { createAuthApp, request, extractCookieValue, withServer } = require('./httpTestUtils');

(async function main() {
  const app = createAuthApp({ isProduction: true });

  await withServer(app, async ({ port }) => {
    const registration = await request({
      port,
      method: 'POST',
      path: '/api/auth/register',
      body: {
        nickname: 'csrfuser',
        email: 'csrfuser@teste.com',
        password: 'senha1234'
      }
    });
    assert.strictEqual(registration.status, 201);
    assert.ok(registration.json.csrfToken);
    const cookie = extractCookieValue(registration.headers['set-cookie'], 'setflow_session');

    let response = await request({
      port,
      method: 'POST',
      path: '/api/bandas',
      body: { name: 'Sem Token' },
      headers: { Cookie: cookie }
    });
    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.json.error.code, 'CSRF_INVALID');

    response = await request({
      port,
      method: 'POST',
      path: '/api/bandas',
      body: { name: 'Com Token' },
      headers: { Cookie: cookie, 'X-CSRF-Token': registration.json.csrfToken }
    });
    assert.strictEqual(response.status, 201);

    response = await request({
      port,
      method: 'POST',
      path: '/api/auth/logout',
      headers: { Cookie: cookie }
    });
    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.json.error.code, 'CSRF_INVALID');

    response = await request({
      port,
      method: 'POST',
      path: '/api/auth/logout',
      headers: { Cookie: cookie, 'X-CSRF-Token': registration.json.csrfToken }
    });
    assert.strictEqual(response.status, 200);
  });

  console.log('✅ Proteção CSRF de produção validada.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
