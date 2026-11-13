// Acesso ao PostgreSQL. O módulo `pg` só é carregado quando um pool é criado,
// portanto importar este arquivo não exige PostgreSQL nem a dependência instalada.

class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
    this.code = 'DATABASE_CONFIG_ERROR';
  }
}

function resolveDatabaseUrl(env = process.env) {
  const url = env.DATABASE_URL;

  if (!url || String(url).trim().length === 0) {
    throw new ConfigurationError(
      'DATABASE_URL não configurada. Defina a variável de ambiente, por exemplo: '
      + 'DATABASE_URL=postgresql://localhost:5432/setflow (veja .env.example).'
    );
  }

  return String(url).trim();
}

// options.searchPath: schema usado como search_path (utilizado pelos testes de integração).
function createPool(env = process.env, options = {}) {
  const connectionString = resolveDatabaseUrl(env);

  let Pool;
  try {
    ({ Pool } = require('pg'));
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      throw new ConfigurationError("Dependência 'pg' não instalada. Execute: npm install");
    }
    throw error;
  }

  const config = { connectionString };

  if (options.searchPath) {
    if (!/^[a-z0-9_]+$/.test(options.searchPath)) {
      throw new ConfigurationError('searchPath inválido.');
    }
    config.options = `-c search_path=${options.searchPath}`;
  }

  return new Pool(config);
}

// Falha cedo, com mensagem clara, quando o banco está inacessível ou sem migração.
async function assertDatabaseReady(pool) {
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    throw new ConfigurationError(`Não foi possível conectar ao PostgreSQL: ${error.message}`);
  }

  const expectedTables = [
    'users',
    'bands',
    'band_members',
    'music',
    'setlists',
    'setlist_items',
    'music_mastery',
    'sessions'
  ];
  const columns = expectedTables
    .map((table) => `to_regclass('${table}') AS ${table}`)
    .join(', ');
  const { rows } = await pool.query(`SELECT ${columns}`);
  const row = rows[0] || {};

  const missingTables = expectedTables.filter((table) => !row[table]);
  if (missingTables.length > 0) {
    throw new ConfigurationError(
      `Schema do banco incompleto. Tabelas ausentes: ${missingTables.join(', ')}. `
      + 'Execute a migração: npm run db:migrate'
    );
  }
}

module.exports = {
  ConfigurationError,
  resolveDatabaseUrl,
  createPool,
  assertDatabaseReady
};
