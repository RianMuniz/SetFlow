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
      + 'DATABASE_URL=postgres://usuario:senha@localhost:5432/setflow (veja .env.example).'
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

  const { rows } = await pool.query(
    "SELECT to_regclass('users') AS users, to_regclass('bands') AS bands, to_regclass('band_members') AS band_members"
  );
  const row = rows[0] || {};

  if (!row.users || !row.bands || !row.band_members) {
    throw new ConfigurationError('Schema do banco ausente. Execute a migração: npm run db:migrate');
  }
}

module.exports = {
  ConfigurationError,
  resolveDatabaseUrl,
  createPool,
  assertDatabaseReady
};
