// Integração com PostgreSQL REAL. Requer DATABASE_URL (veja .env.example).
//
// Segurança: tudo roda em um schema temporário (setflow_test_<aleatório>) via search_path e
// o schema é removido ao final; as tabelas existentes do banco nunca são tocadas.
//
// Se o banco não estiver configurado/disponível o teste FALHA (exit 1) com mensagem clara;
// ele nunca é marcado como sucesso sem executar.
const assert = require('assert');
const crypto = require('crypto');
const { createPool, ConfigurationError } = require('../../db');
const { runMigrations } = require('../../migrate');
const { createAuthApp, request, extractCookieValue, withServer } = require('../httpTestUtils');
const { runBandHttpSuite } = require('../bandHttp.suite');

function fail(message) {
  process.stderr.write(`❌ ${message}\n`);
  process.stderr.write('   Defina DATABASE_URL apontando para um PostgreSQL acessível e rode novamente: npm run test:pg\n');
  process.exit(1);
}

function poolWithFailure(pool, substring) {
  return {
    query: (...args) => pool.query(...args),
    async connect() {
      const client = await pool.connect();
      const original = client.query.bind(client);
      return {
        query: async (text, params) => {
          if (typeof text === 'string' && text.includes(substring)) {
            throw new Error('falha injetada pelo teste');
          }
          return original(text, params);
        },
        release: (destroy) => client.release(destroy)
      };
    }
  };
}

async function main() {
  console.log('🧪 Iniciando testes de integração PostgreSQL (SPEC-001/SPEC-002)...\n');

  let adminPool;
  try {
    adminPool = createPool();
    await adminPool.query('SELECT 1');
  } catch (error) {
    if (adminPool) {
      await adminPool.end().catch(() => {});
    }
    fail(error instanceof ConfigurationError ? error.message : `Não foi possível conectar ao PostgreSQL: ${error.message}`);
  }

  const schema = `setflow_test_${crypto.randomBytes(6).toString('hex')}`;
  let pool;

  try {
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    pool = createPool(process.env, { searchPath: schema });

    const migration = await runMigrations(pool);
    assert.ok(migration.applied.length >= 1, 'A migração deveria aplicar ao menos um arquivo.');
    const again = await runMigrations(pool);
    assert.strictEqual(again.applied.length, 0, 'Reexecutar a migração não deve reaplicar arquivos.');
    console.log('✅ Migração aplicada e idempotente.');

    // Suíte HTTP compartilhada, contra PostgreSQL
    await runBandHttpSuite({
      label: 'postgres',
      createApp: async () => createAuthApp({ pool, isProduction: false }),
      removeMembership: async (bandId, userId) => {
        await pool.query('DELETE FROM band_members WHERE band_id = $1 AND user_id = $2', [bandId, userId]);
      }
    });

    // Persistência real: usuário continua existindo para uma nova instância da aplicação
    await withServer(createAuthApp({ pool, isProduction: false }), async ({ port }) => {
      const email = `persist-${crypto.randomBytes(3).toString('hex')}@teste.com`;
      const register = await request({
        port, method: 'POST', path: '/api/auth/register',
        body: { nickname: `p${crypto.randomBytes(4).toString('hex')}`, email, password: 'senha1234' }
      });
      assert.strictEqual(register.status, 201);

      await withServer(createAuthApp({ pool, isProduction: false }), async ({ port: otherPort }) => {
        const login = await request({ port: otherPort, method: 'POST', path: '/api/auth/login', body: { email, password: 'senha1234' } });
        assert.strictEqual(login.status, 200, 'Usuário persistido deve autenticar em nova instância da API.');
        assert.ok(extractCookieValue(login.headers['set-cookie'], 'setflow_session'));
      });
    });
    console.log('✅ [postgres] usuário persistido autentica em nova instância da aplicação.');

    // Constraints do schema
    await assert.rejects(
      () => pool.query("INSERT INTO band_members (id, band_id, user_id, role) VALUES ('m-x', 'b-x', 'u-x', 'musico')"),
      (error) => error.code === '23503',
      'FK deve impedir vínculo para banda/usuário inexistente.'
    );
    const { rows: [anyUser] } = await pool.query('SELECT id FROM users LIMIT 1');
    await pool.query("INSERT INTO bands (id, name, name_normalized, created_by_user_id) VALUES ('b-chk', 'Chk', 'chk', $1)", [anyUser.id]);
    await assert.rejects(
      () => pool.query("INSERT INTO band_members (id, band_id, user_id, role) VALUES ('m-chk', 'b-chk', $1, 'admin')", [anyUser.id]),
      (error) => error.code === '23514',
      'CHECK deve aceitar apenas leader/musico.'
    );
    await pool.query("INSERT INTO band_members (id, band_id, user_id, role) VALUES ('m-ok', 'b-chk', $1, 'leader')", [anyUser.id]);
    await pool.query("DELETE FROM bands WHERE id = 'b-chk'");
    const { rows: leftovers } = await pool.query("SELECT 1 FROM band_members WHERE band_id = 'b-chk'");
    assert.strictEqual(leftovers.length, 0, 'Vínculos devem ser removidos em cascata com a banda.');
    console.log('✅ Constraints FK, CHECK de papel e ON DELETE CASCADE verificadas.');

    // Transação real: falha ao criar o vínculo do líder não deixa banda órfã
    const before = Number((await pool.query('SELECT COUNT(*)::int AS n FROM bands')).rows[0].n);

    await withServer(createAuthApp({ pool: poolWithFailure(pool, 'INSERT INTO band_members'), logger: () => {}, isProduction: false }), async ({ port }) => {
      const nickname = `t${crypto.randomBytes(4).toString('hex')}`;
      const register = await request({
        port, method: 'POST', path: '/api/auth/register',
        body: { nickname, email: `${nickname}@teste.com`, password: 'senha1234' }
      });
      assert.strictEqual(register.status, 201);
      const cookie = extractCookieValue(register.headers['set-cookie'], 'setflow_session');

      const response = await request({ port, method: 'POST', path: '/api/bandas', body: { name: 'Banda Fantasma' }, headers: { Cookie: cookie } });
      assert.strictEqual(response.status, 500);
      assert.strictEqual(response.json.error.code, 'DATABASE_ERROR');
      assert.ok(!response.body.includes('falha injetada'), 'Resposta não pode expor detalhes internos.');
    });

    const after = Number((await pool.query('SELECT COUNT(*)::int AS n FROM bands')).rows[0].n);
    assert.strictEqual(after, before, 'Nenhuma banda deve permanecer após falha na transação.');
    const { rows: orphans } = await pool.query(
      "SELECT b.id FROM bands b WHERE NOT EXISTS (SELECT 1 FROM band_members m WHERE m.band_id = b.id AND m.role = 'leader')"
    );
    assert.strictEqual(orphans.length, 0, 'Não pode existir banda sem líder.');
    console.log('✅ [postgres] falha na criação do líder faz ROLLBACK: nenhuma banda sem líder.');

    console.log('\n🎉 Todos os testes de integração PostgreSQL passaram com sucesso!');
  } finally {
    if (pool) {
      await pool.end().catch(() => {});
    }
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
    await adminPool.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
