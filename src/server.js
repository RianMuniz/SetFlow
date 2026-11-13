const { createAuthApp } = require('./authHttp');
const { createPool, assertDatabaseReady, ConfigurationError } = require('./db');

const PORT = Number(process.env.PORT || 3000);

async function main() {
  const pool = createPool();

  try {
    await assertDatabaseReady(pool);
  } catch (error) {
    await pool.end().catch(() => {});
    throw error;
  }

  const app = createAuthApp({ pool });

  const server = app.listen(PORT, () => {
    process.stdout.write(`SetFlow server running on port ${PORT}\n`);
  });

  const shutdown = () => {
    server.close(() => {
      pool.end().then(() => process.exit(0), () => process.exit(1));
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  const message = error instanceof ConfigurationError ? error.message : `Falha ao iniciar o servidor: ${error.message}`;
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
