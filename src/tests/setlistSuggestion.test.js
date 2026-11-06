const assert = require('assert');
const { calcularDistanciaSemitons, sugerirOrdem } = require('../setlistService');

console.log('🧪 Iniciando testes unitários da SPEC-005...\n');

assert.strictEqual(calcularDistanciaSemitons('C', 'F#'), 6);
assert.strictEqual(calcularDistanciaSemitons('B', 'C'), 1);
console.log('✅ Distância cromática usa o menor caminho do ciclo.');

const sugestao = sugerirOrdem([
  { id: 'm-1', titulo: 'C', tom: 'C', duracaoSegundos: 100 },
  { id: 'm-2', titulo: 'F#', tom: 'F#', duracaoSegundos: 200 },
  { id: 'm-3', titulo: 'G', tom: 'G', duracaoSegundos: 300 }
], 500, 5);

assert.deepStrictEqual(sugestao.musicas.map((music) => music.id), ['m-1', 'm-3', 'm-2']);
assert.strictEqual(sugestao.duracaoTotalSegundos, 600);
assert.strictEqual(sugestao.alertaTempoExcedido, true);
assert.strictEqual(sugestao.transicoes.every((transicao) => transicao.transicaoAbrupta === false), true);
console.log('✅ Ordem sugerida minimiza transições e sinaliza excesso de duração.');

const musicasGrandes = Array.from({ length: 50 }, (_, index) => ({
  id: `m-${index}`,
  titulo: `Música ${index}`,
  tom: ['C', 'D', 'E', 'F#', 'G', 'A', 'B'][index % 7],
  duracaoSegundos: 120
}));
const inicio = process.hrtime.bigint();
const sugestaoGrande = sugerirOrdem(musicasGrandes, 6000, 5);
const decorridoMs = Number(process.hrtime.bigint() - inicio) / 1e6;

assert.strictEqual(sugestaoGrande.musicas.length, 50);
assert.ok(decorridoMs < 2000, `Sugestão de 50 músicas excedeu 2s: ${decorridoMs}ms`);
console.log(`✅ Sugestão de 50 músicas concluída em ${decorridoMs.toFixed(2)}ms.`);

console.log('\n🎉 Todos os testes unitários da SPEC-005 passaram com sucesso!');
