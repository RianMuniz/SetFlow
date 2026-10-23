const fs = require('fs');
const path = require('path');
const { createPool } = require('./db');

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');
const MIGRATION_LOCK_KEY = 727001; // advisory lock: evita migrações concorrentes

function listMigrationFiles(directory) {
  return fs.readdirSync(directory)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();
}

async function runMigrations(pool, options = {}) {
  const directory = options.directory || DEFAULT_MIGRATIONS_DIR;
  const log = options.log || (() => {});
  const files = listMigrationFiles(directory);
  const result = { applied: [], skipped: [] };

  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations ('
      + 'version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())'
    );

    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const alreadyApplied = new Set(rows.map((row) => row.version));

    for (const file of files) {
      if (alreadyApplied.has(file)) {
        result.skipped.push(file);
        log(`= ${file} (já aplicada)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(directory, file), 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        error.message = `Falha na migração ${file}: ${error.message}`;
        throw error;
      }

      result.applied.push(file);
      log(`+ ${file} aplicada`);
    }

    return result;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {});
    client.release();
  }
}

async function main() {
  let pool;

  try {
    pool = createPool();
    const result = await runMigrations(pool, { log: (line) => process.stdout.write(`${line}\n`) });
    process.stdout.write(`Migração concluída: ${result.applied.length} aplicada(s), ${result.skipped.length} já existente(s).\n`);
  } catch (error) {
    process.stderr.write(`Erro na migração: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { runMigrations, listMigrationFiles, DEFAULT_MIGRATIONS_DIR };
