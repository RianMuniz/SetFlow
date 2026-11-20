const assert = require('assert');
const { resolveCookieSecure } = require('../cookieSecurity');

assert.strictEqual(resolveCookieSecure(undefined, true), true);
assert.strictEqual(resolveCookieSecure(undefined, false), false);
assert.strictEqual(resolveCookieSecure('', true), true);
assert.strictEqual(resolveCookieSecure('false', true), false);
assert.strictEqual(resolveCookieSecure(' FALSE ', true), false);
assert.strictEqual(resolveCookieSecure('0', true), false);
assert.strictEqual(resolveCookieSecure('true', false), true);
assert.strictEqual(resolveCookieSecure('1', false), true);
assert.strictEqual(resolveCookieSecure(false, true), false);
assert.strictEqual(resolveCookieSecure(true, false), true);
assert.strictEqual(resolveCookieSecure('talvez', true), true);
assert.strictEqual(resolveCookieSecure('talvez', false), false);

console.log('✅ COOKIE_SECURE: padrão segue NODE_ENV; true/false/1/0 sobrescrevem.');
