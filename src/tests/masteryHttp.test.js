const assert = require('assert');
const { createAuthApp, request, extractCookieValue, withServer } = require('./httpTestUtils');
const { createMemoryRepositories } = require('../repositories/memoryRepositories');

console.log('🧪 Iniciando testes HTTP da SPEC-007...\n');

(async function main() {
  const repositories = createMemoryRepositories();
  const app = createAuthApp({ repositories, isProduction: false });

  await withServer(app, async ({ port }) => {
    let sequence = 0;
    const call = (cookie, method, path, body) => request({
      port,
      method,
      path,
      body,
      headers: cookie ? { Cookie: cookie } : {}
    });

    async function signUp(prefix) {
      sequence += 1;
      const nickname = `${prefix}${sequence}`;
      const result = await call(null, 'POST', '/api/auth/register', {
        nickname,
        email: `${nickname}@teste.com`,
        password: 'senha1234'
      });
      assert.strictEqual(result.status, 201);
      return {
        nickname,
        cookie: extractCookieValue(result.headers['set-cookie'], 'setflow_session')
      };
    }

    const leader = await signUp('lider');
    const musician = await signUp('musico');
    const outsider = await signUp('fora');

    let result = await call(leader.cookie, 'POST', '/api/bandas', { name: 'Banda Domínio' });
    const bandId = result.json.band.id;
    result = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/membros`, { nickname: musician.nickname });
    assert.strictEqual(result.status, 201);

    result = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/musicas`, {
      titulo: 'Música Confirmada',
      tom: 'C',
      bpm: 120,
      duracaoSegundos: 180,
      observacoes: 'Observação',
      cifraAnexo: 'C G Am'
    });
    const musicId = result.json.music.id;

    result = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists`, {
      nome: 'Setlist Confirmado',
      data: '2026-10-09',
      tempoDisponivelSegundos: 1800,
      musicaIds: [musicId]
    });
    const setlistId = result.json.setlist.id;
    result = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists/${setlistId}/confirmar`);
    assert.strictEqual(result.status, 200);

    result = await call(musician.cookie, 'GET', `/api/bandas/${bandId}/setlists/${setlistId}/visualizacao`);
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.json.setlist.estado, 'Confirmado');
    assert.strictEqual(result.json.setlist.musicas[0].cifraAnexo, 'C G Am');
    assert.strictEqual(result.json.setlist.musicas[0].nivelDominio, null);
    console.log('✅ Membro visualiza ordem, observações, cifra e próprio domínio.');

    result = await call(musician.cookie, 'PUT', `/api/bandas/${bandId}/musicas/${musicId}/dominio`, {
      nivel: 'Preciso Revisar'
    });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.json.dominio.nivel, 'Preciso Revisar');

    result = await call(musician.cookie, 'PUT', `/api/bandas/${bandId}/musicas/${musicId}/dominio`, {
      nivel: 'Sei Bem'
    });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.json.dominio.nivel, 'Sei Bem');

    result = await call(musician.cookie, 'GET', `/api/bandas/${bandId}/setlists/${setlistId}/visualizacao`);
    assert.strictEqual(result.json.setlist.musicas[0].nivelDominio, 'Sei Bem');

    result = await call(leader.cookie, 'GET', `/api/bandas/${bandId}/setlists/${setlistId}/visualizacao`);
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.json.setlist.musicas[0].nivelDominio, null);

    result = await call(leader.cookie, 'GET', `/api/bandas/${bandId}/setlists-confirmados`);
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.json.setlists.length, 1);

    result = await call(outsider.cookie, 'GET', `/api/bandas/${bandId}/setlists/${setlistId}/visualizacao`);
    assert.strictEqual(result.status, 403);
    assert.strictEqual(result.json.error.code, 'BAND_ACCESS_DENIED');

    result = await call(musician.cookie, 'PUT', `/api/bandas/${bandId}/musicas/${musicId}/dominio`, {
      nivel: 'Inexistente'
    });
    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.json.error.code, 'VALIDATION_ERROR');
  });

  console.log('\n🎉 Todos os testes HTTP da SPEC-007 passaram com sucesso!');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
