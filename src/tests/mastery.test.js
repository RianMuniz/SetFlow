const assert = require('assert');
const { VALID_LEVELS } = require('../masteryApi');

assert.deepStrictEqual(VALID_LEVELS, ['Não Sei', 'Preciso Revisar', 'Sei Bem']);
assert.ok(!VALID_LEVELS.includes('Domino'));
console.log('✅ Níveis de domínio seguem a enumeração aprovada pela SPEC-007.');
