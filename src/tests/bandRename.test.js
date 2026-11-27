const assert = require('assert');
const { createAuthApp, request, extractCookieValue, withServer } = require('./httpTestUtils');
const { createMemoryRepositories } = require('../repositories/memoryRepositories');

console.log('🧪 Iniciando testes HTTP da edição do nome da banda...\n');

(async function main() {
  const app = createAuthApp({ repositories: createMemoryRepositories(), isProduction: false });

  await withServer(app, async ({ port }) => {
    let sequence = 0;
    const call = (cookie, method, path, body) => request({ port, method, path, body, headers: cookie ? { Cookie: cookie } : {} });

    async function signUp(prefix) {
      sequence += 1;
      const nickname = `${prefix}${sequence}`;
      const response = await call(null, 'POST', '/api/auth/register', { nickname, email: `${nickname}@teste.com`, password: 'senha1234' });
      assert.strictEqual(response.status, 201);
      return { cookie: extractCookieValue(response.headers['set-cookie'], 'setflow_session'), nickname };
    }

    const leader = await signUp('lider');
    const musician = await signUp('musico');
    const outsider = await signUp('fora');
    const bandA = (await call(leader.cookie, 'POST', '/api/bandas', { name: 'Banda A' })).json.band.id;
    const bandB = (await call(leader.cookie, 'POST', '/api/bandas', { name: 'Banda B' })).json.band.id;
    await call(leader.cookie, 'POST', `/api/bandas/${bandA}/membros`, { nickname: musician.nickname });
    const rename = (cookie, bandId, name) => call(cookie, 'PUT', `/api/bandas/${bandId}`, { name });

    // ---- sucesso
    const renamed = await rename(leader.cookie, bandA, '  Os   Cifrados  ');
    assert.strictEqual(renamed.status, 200);
    assert.strictEqual(renamed.json.band.name, 'Os Cifrados');
    assert.strictEqual(renamed.json.band.role, 'leader');
    assert.strictEqual(renamed.json.band.memberCount, 2);
    const asMember = await call(musician.cookie, 'GET', `/api/bandas/${bandA}`);
    assert.strictEqual(asMember.json.band.name, 'Os Cifrados', 'membros veem o novo nome');
    const list = await call(leader.cookie, 'GET', '/api/bandas');
    assert.deepStrictEqual(list.json.bands.map((band) => band.name).sort(), ['Banda B', 'Os Cifrados']);
    console.log('✅ Líder renomeia a banda (espaços ajustados) e os membros veem o novo nome.');

    // ---- o próprio nome continua permitido
    assert.strictEqual((await rename(leader.cookie, bandA, 'Os Cifrados')).status, 200);
    assert.strictEqual((await rename(leader.cookie, bandA, 'OS CIFRADOS')).json.band.name, 'OS CIFRADOS');
    console.log('✅ Salvar o mesmo nome ou mudar só maiúsculas/minúsculas é permitido.');

    // ---- unicidade por criador
    const duplicate = await rename(leader.cookie, bandB, 'os cifrados');
    assert.strictEqual(duplicate.status, 409);
    assert.strictEqual(duplicate.json.error.code, 'BAND_NAME_ALREADY_EXISTS');
    assert.strictEqual((await call(leader.cookie, 'GET', `/api/bandas/${bandB}`)).json.band.name, 'Banda B');
    await call(outsider.cookie, 'POST', '/api/bandas', { name: 'Nome Livre' });
    assert.strictEqual((await rename(leader.cookie, bandB, 'Nome Livre')).status, 200, 'o nome só precisa ser único entre as bandas do mesmo criador');
    console.log('✅ Nome repetido entre bandas do mesmo líder é recusado; outro criador pode usar o mesmo nome.');

    // ---- validação
    for (const invalid of ['', '   ', 'x'.repeat(61), 123, null, undefined]) {
      const response = await rename(leader.cookie, bandA, invalid);
      assert.strictEqual(response.status, 400, `nome inválido: ${String(invalid)}`);
      assert.strictEqual(response.json.error.code, 'VALIDATION_ERROR');
    }
    assert.strictEqual((await rename(leader.cookie, bandA, 'x'.repeat(60))).status, 200);
    assert.strictEqual((await call(leader.cookie, 'GET', `/api/bandas/${bandA}`)).json.band.name, 'x'.repeat(60));
    console.log('✅ Nome vazio, em branco, acima de 60 caracteres ou não textual é recusado.');

    // ---- permissões
    const asMusician = await rename(musician.cookie, bandA, 'Golpe');
    assert.strictEqual(asMusician.status, 403);
    assert.strictEqual(asMusician.json.error.code, 'LEADER_REQUIRED');
    const asOutsider = await rename(outsider.cookie, bandA, 'Golpe');
    assert.strictEqual(asOutsider.status, 403);
    assert.strictEqual(asOutsider.json.error.code, 'BAND_ACCESS_DENIED');
    assert.strictEqual((await rename(leader.cookie, 'b-inexistente', 'Golpe')).status, 404);
    assert.strictEqual((await rename(null, bandA, 'Golpe')).status, 401);
    assert.strictEqual((await call(leader.cookie, 'GET', `/api/bandas/${bandA}`)).json.band.name, 'x'.repeat(60), 'tentativas recusadas não alteram o nome');
    console.log('✅ Só o líder renomeia; músico, fora da banda e sem sessão são barrados.');
  });

  console.log('\n🎉 Todos os testes da edição do nome da banda passaram com sucesso!');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
