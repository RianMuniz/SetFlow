const assert = require('assert');
const { processarSetlist, calcularDistanciaSemitons } = require('../src/setlistService');

console.log('🧪 Iniciando testes unitários da SPEC-004 (SetFlow)...\n');

// --- CRITÉRIO DE ACEITE 1: Cálculo correto da duração total (RB-03) ---
(function testCalculoDuracaoTotal() {
  const musicas = [
    { titulo: 'Música 1', duracao: 4, tom: 'C' },
    { titulo: 'Música 2', duracao: 3, tom: 'G' },
    { titulo: 'Música 3', duracao: 5, tom: 'D' }
  ];

  const resultado = processarSetlist(musicas, 15);
  
  assert.strictEqual(resultado.duracaoTotal, 12, 'Duração total deveria ser 12 minutos');
  console.log('✅ Critério 1 Passou: Soma da duração calculada corretamente (12 min).');
})();

// --- CRITÉRIO DE ACEITE 2: Sinalização de estouro de tempo ---
(function testAlertaTempoExcedido() {
  const musicas = [
    { titulo: 'Música 1', duracao: 4, tom: 'C' },
    { titulo: 'Música 2', duracao: 3, tom: 'G' },
    { titulo: 'Música 3', duracao: 5, tom: 'D' }
  ]; // Total: 12 min

  const resultado = processarSetlist(musicas, 10); // Disponível: 10 min

  assert.strictEqual(resultado.alertaTempoExcedido, true, 'Deveria disparar alerta de tempo excedido');
  console.log('✅ Critério 2 Passou: Alerta de tempo excedido disparado com sucesso.');
})();

// --- CRITÉRIO DE ACEITE 3: Identificação de transição de tom abrupta (RB-01 / RB-02) ---
(function testTransicaoAbrupta() {
  const musicas = [
    { titulo: 'Música A', duracao: 3, tom: 'C' },
    { titulo: 'Música B', duracao: 4, tom: 'F#' } // C para F# = 6 semitons (Limiar é 3)
  ];

  const resultado = processarSetlist(musicas, 10, 3);
  
  assert.strictEqual(resultado.transicoes[0].distanciaSemitons, 6, 'Distância C -> F# deve ser 6 semitons');
  assert.strictEqual(resultado.transicoes[0].transicaoAbrupta, true, 'Transição deve ser marcada como abrupta');
  console.log('✅ Critério 3 Passou: Transição abrupta (6 semitons > limiar 3) identificada corretamente.');
})();

console.log('\n🎉 Todos os testes da SPEC-004 passaram com sucesso!');
