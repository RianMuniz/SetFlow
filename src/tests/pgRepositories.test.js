// Testes determinísticos (sem PostgreSQL) da camada PostgreSQL: usam um pool falso que
// registra as consultas. Verificam transação, mapeamento de erros e o runner de migração.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPgRepositories } = require('../repositories/pgRepositories');
const { DuplicateError } = require('../repositories/errors');
const { runMigrations } = require('../migrate');
const { resolveDatabaseUrl, ConfigurationError } = require('../db');

console.log('🧪 Iniciando testes da camada PostgreSQL com pool falso...\n');

function verb(text) {
  return String(text).trim().split(/\s+/).slice(0, 3).join(' ');
}

function createFakePool({ failWhen } = {}) {
  const log = [];

  const client = {
    async query(text, params) {
      log.push(verb(text));
      if (failWhen && failWhen(String(text))) {
        throw failWhen.error;
      }
      return { rows: [{ id: 'b-1', name: 'Banda', transition_threshold_semitones: 5, version: 'x' }], rowCount: 1 };
    },
    release(destroy) {
      log.push(destroy ? 'RELEASE destroy' : 'RELEASE');
    }
  };

  return {
    log,
    async query(text) {
      log.push(`POOL ${verb(text)}`);
      return { rows: [], rowCount: 0 };
    },
    async connect() {
      return client;
    }
  };
}

function failing(substring, error) {
  const fn = (text) => text.includes(substring);
  fn.error = error;
  return fn;
}

const silent = () => {};
const input = { bandId: 'b-1', memberId: 'm-1', name: 'Banda', nameNormalized: 'banda', userId: 'u-1' };

(async function main() {
  // 1. Caminho feliz: BEGIN -> banda -> líder -> COMMIT
  {
    const pool = createFakePool();
    const { bandRepository } = createPgRepositories(pool, { logger: silent });
    const band = await bandRepository.createWithLeader(input);

    assert.deepStrictEqual(pool.log, ['BEGIN', 'INSERT INTO bands', 'INSERT INTO band_members', 'COMMIT', 'RELEASE']);
    assert.strictEqual(band.role, 'leader');
    assert.strictEqual(band.memberCount, 1);
    console.log('✅ Criação de banda + líder usa uma única transação com COMMIT.');
  }

  // 2. Falha ao inserir o líder: ROLLBACK, nunca COMMIT, erro seguro
  {
    const pool = createFakePool({ failWhen: failing('INSERT INTO band_members', Object.assign(new Error('falha simulada postgres://u:senha@h/db'), { code: 'XX000' })) });
    const { bandRepository } = createPgRepositories(pool, { logger: silent });

    await assert.rejects(() => bandRepository.createWithLeader(input), (error) => {
      assert.strictEqual(error.status, 500);
      assert.strictEqual(error.code, 'DATABASE_ERROR');
      assert.ok(!error.message.includes('senha'), 'Mensagem não pode expor credenciais.');
      return true;
    });
    assert.deepStrictEqual(pool.log, ['BEGIN', 'INSERT INTO bands', 'INSERT INTO band_members', 'ROLLBACK', 'RELEASE']);
    assert.ok(!pool.log.includes('COMMIT'), 'Não pode haver COMMIT após falha.');
    console.log('✅ Falha ao criar o vínculo do líder faz ROLLBACK e não deixa banda sem líder.');
  }

  // 3. Nome duplicado: constraint vira DuplicateError e a transação é revertida
  {
    const violation = Object.assign(new Error('duplicate'), { code: '23505', constraint: 'bands_creator_name_unique' });
    const pool = createFakePool({ failWhen: failing('INSERT INTO bands', violation) });
    const { bandRepository } = createPgRepositories(pool, { logger: silent });

    await assert.rejects(() => bandRepository.createWithLeader(input), (error) => error instanceof DuplicateError && error.field === 'band_name');
    assert.ok(pool.log.includes('ROLLBACK') && !pool.log.includes('COMMIT'));
    console.log('✅ Violação de unicidade do nome da banda vira DuplicateError com ROLLBACK.');
  }

  // 4. Falha no ROLLBACK destrói o client
  {
    const failEverything = (text) => text.includes('INSERT INTO band_members') || text === 'ROLLBACK';
    failEverything.error = new Error('conexão perdida');
    const pool = createFakePool({ failWhen: failEverything });
    const { bandRepository } = createPgRepositories(pool, { logger: silent });

    await assert.rejects(() => bandRepository.createWithLeader(input), (error) => error.code === 'DATABASE_ERROR');
    assert.strictEqual(pool.log[pool.log.length - 1], 'RELEASE destroy');
    console.log('✅ Client com ROLLBACK falho é descartado do pool.');
  }

  // 5. Mapeamento de violações de unicidade de usuários e membros
  {
    const emailViolation = Object.assign(new Error('x'), { code: '23505', constraint: 'users_email_unique' });
    const nickViolation = Object.assign(new Error('x'), { code: '23505', constraint: 'users_nickname_normalized_unique' });
    const memberViolation = Object.assign(new Error('x'), { code: '23505', constraint: 'band_members_band_user_unique' });
    const user = { id: 'u-1', nickname: 'Maria', nicknameNormalized: 'maria', email: 'm@t.com', passwordHash: 'h', passwordSalt: 's', status: 'active' };

    for (const [violation, field] of [[emailViolation, 'email'], [nickViolation, 'nickname']]) {
      const pool = { async query() { throw violation; } };
      const { userRepository } = createPgRepositories(pool, { logger: silent });
      await assert.rejects(() => userRepository.create(user), (error) => error instanceof DuplicateError && error.field === field);
    }

    const memberPool = { async query() { throw memberViolation; } };
    const { bandRepository } = createPgRepositories(memberPool, { logger: silent });
    await assert.rejects(
      () => bandRepository.addMember({ memberId: 'm-2', bandId: 'b-1', userId: 'u-2', role: 'musico' }),
      (error) => error instanceof DuplicateError && error.field === 'member'
    );
    console.log('✅ Constraints UNIQUE de e-mail, nickname e membro viram DuplicateError.');
  }

  // 6. Consultas de banda sempre parametrizadas por band_id e user_id
  {
    const queries = [];
    const pool = { async query(text, params) { queries.push({ text, params }); return { rows: [], rowCount: 0 }; } };
    const { bandRepository } = createPgRepositories(pool, { logger: silent });

    assert.strictEqual(await bandRepository.findForUser('b-9', 'u-9'), null);
    await bandRepository.listForUser('u-9');
    await bandRepository.listMembers('b-9');

    assert.deepStrictEqual(queries[0].params, ['b-9', 'u-9']);
    assert.ok(queries[0].text.includes('bm.user_id = $2'));
    assert.ok(queries[1].text.includes('bm.user_id = $1'));
    assert.ok(queries[2].text.includes('m.band_id = $1'));
    assert.ok(queries.every((q) => !q.text.includes("'b-9'") && !q.text.includes("'u-9'")), 'Valores nunca são concatenados no SQL.');
    console.log('✅ Consultas de banda/membro são parametrizadas e filtradas por usuário e band_id.');
  }

  // 7. Runner de migração: aplica pendentes em ordem e pula as já aplicadas
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'setflow-mig-'));
    fs.writeFileSync(path.join(dir, '002_b.sql'), 'SELECT 2;');
    fs.writeFileSync(path.join(dir, '001_a.sql'), 'SELECT 1;');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignorado');

    const executed = [];
    const client = {
      async query(text, params) {
        executed.push(String(text).trim().split(/\s+/).slice(0, 2).join(' '));
        if (String(text).startsWith('SELECT version')) {
          return { rows: [{ version: '001_a.sql' }] };
        }
        return { rows: [] };
      },
      release() {}
    };
    const pool = { async connect() { return client; } };

    const result = await runMigrations(pool, { directory: dir });
    assert.deepStrictEqual(result, { applied: ['002_b.sql'], skipped: ['001_a.sql'] });
    assert.ok(executed.includes('BEGIN') && executed.includes('COMMIT'));
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('✅ Migração aplica apenas arquivos pendentes, em ordem, dentro de transação.');
  }

  // 8. Configuração clara sem DATABASE_URL (e sem exigir banco ao importar módulos)
  {
    assert.throws(() => resolveDatabaseUrl({}), (error) => error instanceof ConfigurationError && /DATABASE_URL/.test(error.message));
    assert.strictEqual(resolveDatabaseUrl({ DATABASE_URL: ' postgres://h/db ' }), 'postgres://h/db');
    console.log('✅ DATABASE_URL ausente gera erro de configuração claro.');
  }

  console.log('\n🎉 Todos os testes da camada PostgreSQL (pool falso) passaram com sucesso!');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
