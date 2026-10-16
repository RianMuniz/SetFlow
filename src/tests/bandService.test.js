const assert = require('assert');
const {
  createBand,
  addMember,
  getUserBands,
  switchActiveBand,
  requireBandAccess
} = require('../bandService');

console.log('🧪 Iniciando testes unitários da SPEC-002 (Banda e contexto)...\n');

(function testCriacaoBandas() {
  const band = createBand({ id: 'b-1', name: ' Banda 1 ', leaderUserId: 'u-1' });

  assert.strictEqual(band.name, 'Banda 1', 'Nome da banda deve ser normalizado.');
  assert.strictEqual(band.leaderUserId, 'u-1', 'Líder deve ser registrado.');
  assert.strictEqual(band.members.length, 1, 'Banda deve criar o líder como primeiro membro.');
  console.log('✅ Critério 1 passou: criação da banda com líder.');
})();

(function testAdicionarMembroComoLider() {
  const band = createBand({ id: 'b-2', name: 'Banda 2', leaderUserId: 'u-1' });

  addMember({ band, actorUserId: 'u-1', userId: 'u-2', role: 'musico' });

  assert.strictEqual(band.members.length, 2, 'Membro deve ser adicionado.');
  assert.deepStrictEqual(band.members[1], { userId: 'u-2', role: 'musico' });
  console.log('✅ Critério 2 passou: líder pode adicionar membro.');
})();

(function testLiderNaoPodeAdicionarMembroSemPermissao() {
  const band = createBand({ id: 'b-3', name: 'Banda 3', leaderUserId: 'u-1' });

  assert.throws(() => addMember({ band, actorUserId: 'u-2', userId: 'u-3', role: 'musico' }), /Apenas o líder pode adicionar membros/);
  console.log('✅ Critério 3 passou: membro sem permissão é bloqueado.');
})();

(function testMultiplosVinculos() {
  const band1 = createBand({ id: 'b-4', name: 'Banda 4', leaderUserId: 'u-1' });
  const band2 = createBand({ id: 'b-5', name: 'Banda 5', leaderUserId: 'u-9' });

  addMember({ band: band1, actorUserId: 'u-1', userId: 'u-9', role: 'musico' });
  addMember({ band: band2, actorUserId: 'u-9', userId: 'u-1', role: 'musico' });

  const userBands = getUserBands([band1, band2], 'u-1');

  assert.strictEqual(userBands.length, 2, 'Usuário deve pertencer a duas bandas.');
  console.log('✅ Critério 4 passou: múltiplos vínculos em bandas diferentes.');
})();

(function testSwitchDeContexto() {
  const band1 = createBand({ id: 'b-6', name: 'Banda 6', leaderUserId: 'u-1' });
  const band2 = createBand({ id: 'b-7', name: 'Banda 7', leaderUserId: 'u-1' });

  addMember({ band: band1, actorUserId: 'u-1', userId: 'u-2', role: 'musico' });
  addMember({ band: band2, actorUserId: 'u-1', userId: 'u-2', role: 'musico' });

  const contexto = switchActiveBand({ bands: [band1, band2], userId: 'u-2', bandId: 'b-7' });

  assert.strictEqual(contexto.activeBandId, 'b-7', 'Contexto ativo deve ser alterado para banda vinculada.');
  console.log('✅ Critério 5 passou: alternância de contexto ativa por banda vinculada.');
})();

(function testAcessoNegadoSemVinculo() {
  const band = createBand({ id: 'b-8', name: 'Banda 8', leaderUserId: 'u-1' });

  assert.throws(() => requireBandAccess({ bands: [band], userId: 'u-9', bandId: 'b-8' }), /Acesso negado/);
  console.log('✅ Critério 6 passou: usuário sem vínculo é bloqueado.');
})();

console.log('\n🎉 Todos os testes da SPEC-002 passaram com sucesso!');
