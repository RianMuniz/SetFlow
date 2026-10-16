const assert = require('assert');
const { createSetlist, canModifySetlist, addMusicToSetlist } = require('../setlistDraftService');

console.log('🧪 Iniciando testes unitários da SPEC-004 (Setlist em rascunho)...\n');

(function testCriacaoSetlistValido() {
  const setlist = createSetlist({
    id: 'sl-1',
    bandaId: 'b-1',
    nome: ' Show 1 ',
    data: '2026-10-09',
    tempoDisponivelSegundos: 900,
    liderUserId: 'u-1',
    musicas: [{ id: 'm-1' }, { id: 'm-2' }]
  });

  assert.strictEqual(setlist.nome, 'Show 1');
  assert.strictEqual(setlist.estado, 'Rascunho');
  assert.strictEqual(setlist.musicas.length, 2);
  console.log('✅ Critério 1 passou: setlist mínimo em estado Rascunho.');
})();

(function testSetlistSemMusicas() {
  assert.throws(() => createSetlist({
    id: 'sl-2',
    bandaId: 'b-1',
    nome: 'Sem música',
    data: '2026-10-09',
    tempoDisponivelSegundos: 900,
    liderUserId: 'u-1',
    musicas: []
  }), /pelo menos uma música/);
  console.log('✅ Critério 2 passou: setlist vazio é rejeitado.');
})();

(function testOnlyLiderPodeModificar() {
  const setlist = createSetlist({
    id: 'sl-3',
    bandaId: 'b-1',
    nome: 'Restrito',
    data: '2026-10-09',
    tempoDisponivelSegundos: 900,
    liderUserId: 'u-1',
    musicas: [{ id: 'm-1' }]
  });

  assert.throws(() => canModifySetlist({ setlist, userId: 'u-2' }), /Apenas o líder/);
  console.log('✅ Critério 3 passou: apenas o líder pode modificar o setlist.');
})();

(function testMúsicaDeOutraBandaNãoEntraNoSetlist() {
  const setlist = createSetlist({
    id: 'sl-4',
    bandaId: 'b-1',
    nome: 'Banda 1',
    data: '2026-10-09',
    tempoDisponivelSegundos: 900,
    liderUserId: 'u-1',
    musicas: [{ id: 'm-1' }]
  });

  assert.throws(() => addMusicToSetlist(setlist, { id: 'm-99', bandaId: 'b-2' }), /fora da banda do setlist/);
  console.log('✅ Critério 4 passou: música de outra banda é rejeitada.');
})();

(function testSetlistEmEstadoRascunho() {
  const setlist = createSetlist({
    id: 'sl-5',
    bandaId: 'b-1',
    nome: 'Rascunho',
    data: '2026-10-09',
    tempoDisponivelSegundos: 900,
    liderUserId: 'u-1',
    musicas: [{ id: 'm-1' }]
  });

  assert.strictEqual(setlist.estado, 'Rascunho');
  console.log('✅ Critério 5 passou: setlist nasce em estado Rascunho.');
})();

console.log('\n🎉 Todos os testes da SPEC-004 passaram com sucesso!');
