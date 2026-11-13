const assert = require('assert');
const { createAuthApp, withServer, request } = require('./httpTestUtils');

(async function main() {
  const app = createAuthApp({ isProduction: false });

  await withServer(app, async ({ port }) => {
    const page = await request({ port, method: 'GET', path: '/' });
    assert.strictEqual(page.status, 200);
    assert.match(page.body, /SetFlow/);

    const stylesheet = await request({ port, method: 'GET', path: '/styles.css' });
    assert.strictEqual(stylesheet.status, 200);
    assert.match(stylesheet.body, /bottom-nav/);

    const script = await request({ port, method: 'GET', path: '/app.js' });
    assert.strictEqual(script.status, 200);
    assert.match(script.body, /api\('\/api\/auth\/me'\)/);
  });

  console.log('✅ Frontend mobile-first entregue pelo Express.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
