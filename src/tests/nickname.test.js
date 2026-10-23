const assert = require('assert');
const { normalizeNickname, validateNickname, NICKNAME_MIN_LENGTH, NICKNAME_MAX_LENGTH } = require('../nickname');
const { sanitizeBandName, bandNameKey, validateBandName, BAND_NAME_MAX_LENGTH } = require('../bandService');

console.log('🧪 Iniciando testes de nickname e nome de banda (SPEC-002)...\n');

assert.strictEqual(NICKNAME_MIN_LENGTH, 3);
assert.strictEqual(NICKNAME_MAX_LENGTH, 20);
assert.strictEqual(normalizeNickname('  GuitaRRista '), 'guitarrista');
assert.strictEqual(validateNickname('abc'), null);
assert.strictEqual(validateNickname('a'.repeat(20)), null);
assert.strictEqual(validateNickname('Rian_Muniz-2.0'), null);
for (const invalid of [undefined, null, 42, '', '   ', 'ab', 'a'.repeat(21), 'com espaço', 'e-mail@x', 'ação']) {
  assert.ok(validateNickname(invalid), `Nickname ${JSON.stringify(invalid)} deveria ser inválido.`);
}
console.log('✅ Nickname: limites 3–20, caracteres permitidos e normalização.');

assert.strictEqual(sanitizeBandName('  Os   Testadores '), 'Os Testadores');
assert.strictEqual(bandNameKey('  Os   TESTADORES '), bandNameKey('os testadores'));
assert.strictEqual(validateBandName('Banda'), null);
assert.strictEqual(validateBandName('b'.repeat(BAND_NAME_MAX_LENGTH)), null);
for (const invalid of [undefined, null, 7, '', '   ', 'b'.repeat(BAND_NAME_MAX_LENGTH + 1)]) {
  assert.ok(validateBandName(invalid), `Nome ${JSON.stringify(invalid)} deveria ser inválido.`);
}
console.log('✅ Nome da banda: limite de 60 caracteres, colapso de espaços e chave normalizada.');

console.log('\n🎉 Todos os testes de nickname e nome de banda passaram com sucesso!');
