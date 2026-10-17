const { Pool } = require('pg');

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !String(databaseUrl).trim()) {
    throw new Error('DATABASE_URL não configurado. Defina DATABASE_URL para conectar ao PostgreSQL.');
  }

  return databaseUrl;
}

function createPostgresPool(options = {}) {
  const connectionString = options.connectionString || getDatabaseUrl();
  return new Pool({ connectionString });
}

module.exports = {
  createPostgresPool,
  getDatabaseUrl
};
