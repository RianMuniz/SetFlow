const { createAuthApp } = require('./authHttp');

const PORT = Number(process.env.PORT || 3000);
const app = createAuthApp();

app.listen(PORT, () => {
  process.stdout.write(`SetFlow auth server running on port ${PORT}\n`);
});
