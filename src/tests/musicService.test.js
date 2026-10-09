const assert = require('assert');
const { createMusic, setBandThreshold, getBandMusic, requireMusicInBand } = require('../musicService');

console.log('🧪 Iniciando testes unitários da SPEC-003 (Repertório e limiar)...\n');

(function testCriacaoMusicaValida() {
  const musica = createMusic({
    id: 'm-1',
    bandaId: 'b-1',
    titulo: 'Música A',
    tom: 'C',
    bpm: 110,
    duracaoSegundos: 180,
    observacoes: 'Intro quente',
    cifraAnexo: 'A' 
  });

  assert.strictEqual(musica.titulo, 'Música A');
  assert.strictEqual(musica.bandaId, 'b-1');
  assert.strictEqual(musica.tom, 'C');
  console.log('✅ Critério 1 passou: música válida é criada e vinculada à banda correta.');
})();

(function testLimiarConfiguravelPorBanda() {
  const banda = { id: 'b-1', nome: 'Banda 1', limiarTransicaoSemitons: 5 };
  const bandAtualizada = setBandThreshold(banda, 7);

  assert.strictEqual(bandAtualizada.limiarTransicaoSemitons, 7);
  console.log('✅ Critério 2 passou: limiar configurável por banda.');
})();

(function testTomInvalido() {
  assert.throws(() => createMusic({
    id: 'm-2',
    bandaId: 'b-1',
    titulo: 'Música B',
    tom: 'H',
    bpm: 100,
    duracaoSegundos: 200
  }), /Tom inválido/);
  console.log('✅ Critério 3 passou: tom inválido é rejeitado.');
})();

(function testDuracaoNegativa() {
  assert.throws(() => createMusic({
    id: 'm-3',
    bandaId: 'b-1',
    titulo: 'Música C',
    tom: 'G',
    bpm: 100,
    duracaoSegundos: -10
  }), /Duração deve ser positiva/);
  console.log('✅ Critério 4 passou: duração negativa é rejeitada.');
})();

(function testMusicaForaDaBanda() {
  const banda = { id: 'b-1', nome: 'Banda 1', limiarTransicaoSemitons: 5 };
  const musica = { id: 'm-4', bandaId: 'b-2', titulo: 'Música D', tom: 'A', bpm: 90, duracaoSegundos: 180 };

  assert.throws(() => requireMusicInBand({ music: musica, bandaId: banda.id }), /Música fora da banda ativa/);
  console.log('✅ Critério 5 passou: música de outra banda é rejeitada.');
})();

(function testListaDeMusicasPorBanda() {
  const musicas = [
    createMusic({ id: 'm-1', bandaId: 'b-1', titulo: 'A', tom: 'C', bpm: 90, duracaoSegundos: 180 }),
    createMusic({ id: 'm-2', bandaId: 'b-2', titulo: 'B', tom: 'D', bpm: 100, duracaoSegundos: 200 }),
    createMusic({ id: 'm-3', bandaId: 'b-1', titulo: 'C', tom: 'G', bpm: 110, duracaoSegundos: 210 })
  ];

  const repertorio = getBandMusic(musicas, 'b-1');

  assert.strictEqual(repertorio.length, 2, 'Deve listar apenas músicas da banda ativa.');
  console.log('✅ Critério 6 passou: repertório isolado por banda.');
})();

console.log('\n🎉 Todos os testes da SPEC-003 passaram com sucesso!');
