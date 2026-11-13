const assert = require('assert');
const { createSetlist } = require('../setlistDraftService');

const setlist = createSetlist({
  id: 'sl-1',
  bandaId: 'b-1',
  nome: 'Show',
  data: '2026-10-09',
  tempoDisponivelSegundos: 1000,
  liderUserId: 'u-1',
  musicas: [{ id: 'm-1' }]
});

assert.strictEqual(setlist.estado, 'Rascunho');
assert.notStrictEqual(setlist.estado, 'Confirmado');
console.log('✅ Setlist novo permanece em Rascunho para edição e confirmação.');
