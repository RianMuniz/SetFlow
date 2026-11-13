// Suíte HTTP da SPEC-002 com repositórios em memória (determinística, sem PostgreSQL).
const { createAuthApp } = require('./httpTestUtils');
const { createMemoryRepositories } = require('../repositories/memoryRepositories');
const { runBandHttpSuite } = require('./bandHttp.suite');

console.log('🧪 Iniciando testes HTTP da SPEC-002 (repositórios em memória)...\n');

const repositories = createMemoryRepositories();

runBandHttpSuite({
  label: 'memória',
  createApp: async () => createAuthApp({ repositories, isProduction: false }),
  removeMembership: async (bandId, userId) => repositories.bandRepository.__removeMemberForTests(bandId, userId)
})
  .then(() => console.log('\n🎉 Todos os testes HTTP da SPEC-002 (memória) passaram com sucesso!'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
