const assert = require('assert');
const { createAuthApp, withServer, request } = require('./httpTestUtils');

(async function main() {
  const app = createAuthApp({ isProduction: false });

  await withServer(app, async ({ port }) => {
    const page = await request({ port, method: 'GET', path: '/' });
    assert.strictEqual(page.status, 200);
    assert.match(page.body, /SetFlow/);
    assert.match(page.body, /Esqueci minha senha/);
    assert.match(page.body, /data-action="forgot-password"/);

    const stylesheet = await request({ port, method: 'GET', path: '/styles.css' });
    assert.strictEqual(stylesheet.status, 200);
    assert.match(stylesheet.body, /bottom-nav/);

    const script = await request({ port, method: 'GET', path: '/app.js' });
    assert.strictEqual(script.status, 200);
    assert.match(script.body, /api\('\/api\/auth\/me'\)/);
    assert.match(script.body, /\/sugestao`, \{ method: 'POST' \}/);
    assert.match(script.body, /name="cifra" type="file"/);
    assert.doesNotMatch(script.body, /name="cifraAnexo"/);
    assert.match(script.body, /\/api\/auth\/password-reset\/request/);
    assert.match(script.body, /handleSessionLost/);
    assert.match(script.body, /data-toggle-band/);
    assert.match(script.body, /data-add-open/);
    assert.match(script.body, /\/musicas`, \{ method: 'POST', body: \{ musicaIds/);
    assert.match(script.body, /aria-expanded/);
    assert.match(script.body, /api\(`\/api\/bandas\/\$\{id\}`\)/);
    assert.match(script.body, /error\.status = response\.status/);
    assert.match(script.body, /\/api\/auth\/password-reset\/confirm/);
    const submit = script.body.slice(script.body.indexOf("$('#auth-form').addEventListener"));
    const csrfAt = submit.indexOf('state.csrfToken = result.csrfToken');
    assert.ok(csrfAt >= 0 && csrfAt < submit.indexOf('await loadBands()'), 'CSRF deve ser guardado antes de loadBands()');
  });

  console.log('✅ Frontend mobile-first entregue pelo Express.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
