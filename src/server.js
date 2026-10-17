const { createAuthApp } = require('./authHttp');

const PORT = Number(process.env.PORT || 3000);

try {
  const app = createAuthApp();

  app.listen(PORT, () => {
    process.stdout.write(`SetFlow auth server running on port ${PORT}\n`);
  });
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
