const assert = require('assert');
const { createMemoryRepositories } = require('../repositories/memoryRepositories');
const { createPgRepositories } = require('../repositories/pgRepositories');

console.log('🧪 Iniciando testes de inclusão de músicas no setlist (repositórios)...\n');

(async function main() {
  // ---- memória
  const { setlistRepository } = createMemoryRepositories();
  const setlist = { id: 'sl1', bandaId: 'b1', nome: 'Show', data: '2026-11-20', tempoDisponivelSegundos: 3600, estado: 'Rascunho' };
  await setlistRepository.createWithItems({ setlist, items: [{ id: 'i1', setlistId: 'sl1', musicaId: 'm1', ordem: 1 }] });

  const added = await setlistRepository.addItems('sl1', 'b1', [{ id: 'i2', musicaId: 'm2' }, { id: 'i3', musicaId: 'm3' }]);
  assert.deepStrictEqual(added.musicas.map((item) => [item.musicaId, item.ordem]), [['m1', 1], ['m2', 2], ['m3', 3]]);
  assert.strictEqual(await setlistRepository.addItems('sl1', 'outra-banda', [{ id: 'x', musicaId: 'm9' }]), null);
  assert.strictEqual(await setlistRepository.addItems('nao-existe', 'b1', [{ id: 'x', musicaId: 'm9' }]), null);
  await setlistRepository.updateState('sl1', 'b1', 'Confirmado');
  assert.strictEqual(await setlistRepository.addItems('sl1', 'b1', [{ id: 'x', musicaId: 'm9' }]), null, 'fora de Rascunho não aceita músicas');
  assert.strictEqual((await setlistRepository.findForBand('sl1', 'b1')).musicas.length, 3);
  console.log('✅ Memória: músicas entram ao final; banda errada, inexistente e não-rascunho são recusados.');

  // ---- PostgreSQL (cliente falso)
  function fakePool({ state = 'Rascunho', found = true, last = 2 } = {}) {
    const log = [];
    const client = {
      async query(text, params) {
        const sql = String(text).replace(/\s+/g, ' ').trim();
        log.push({ sql, params });
        if (sql.startsWith('SELECT id, band_id') && sql.includes('FOR UPDATE')) {
          return { rows: found ? [{ id: 'sl1', band_id: 'b1', name: 'Show', event_date: '2026-11-20', available_seconds: '3600', state }] : [] };
        }
        if (sql.startsWith('SELECT COALESCE(MAX(order_position)')) {
          return { rows: [{ last }] };
        }
        if (sql.startsWith('SELECT id, music_id, order_position')) {
          return { rows: [{ id: 'i1', music_id: 'm1', order_position: 1 }, { id: 'i2', music_id: 'm2', order_position: 2 }, { id: 'n1', music_id: 'm3', order_position: 3 }, { id: 'n2', music_id: 'm4', order_position: 4 }] };
        }
        return { rows: [] };
      },
      release() { log.push({ sql: 'RELEASE' }); }
    };
    return { log, pool: { async connect() { return client; } } };
  }
  const silent = { error() {}, warn() {}, info() {} };

  const ok = fakePool();
  const { setlistRepository: pgRepo } = createPgRepositories(ok.pool, { logger: silent });
  const saved = await pgRepo.addItems('sl1', 'b1', [{ id: 'n1', musicaId: 'm3' }, { id: 'n2', musicaId: 'm4' }]);
  const steps = ok.log.map((entry) => entry.sql.split(' ').slice(0, 2).join(' '));
  assert.deepStrictEqual(steps.filter((step, index) => index === 0 || index === steps.length - 2 || index === steps.length - 1), ['BEGIN', 'COMMIT', 'RELEASE']);
  assert.ok(ok.log.some((entry) => entry.sql.includes('FOR UPDATE') && entry.params[1] === 'b1'), 'trava o setlist da banda correta');
  const inserts = ok.log.filter((entry) => entry.sql.startsWith('INSERT INTO setlist_items'));
  assert.deepStrictEqual(inserts.map((entry) => entry.params), [['n1', 'sl1', 'm3', 3], ['n2', 'sl1', 'm4', 4]], 'posições continuam após a última');
  assert.deepStrictEqual(saved.musicas.map((item) => item.ordem), [1, 2, 3, 4]);

  for (const scenario of [{ found: false }, { state: 'Confirmado' }]) {
    const blocked = fakePool(scenario);
    const { setlistRepository: repo } = createPgRepositories(blocked.pool, { logger: silent });
    assert.strictEqual(await repo.addItems('sl1', 'b1', [{ id: 'n1', musicaId: 'm3' }]), null);
    assert.ok(blocked.log.some((entry) => entry.sql === 'ROLLBACK') && !blocked.log.some((entry) => entry.sql.startsWith('INSERT')));
  }
  console.log('✅ PostgreSQL: transação com FOR UPDATE, posições após a última e ROLLBACK quando não é rascunho.');

  console.log('\n🎉 Todos os testes de inclusão de músicas (repositórios) passaram com sucesso!');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
