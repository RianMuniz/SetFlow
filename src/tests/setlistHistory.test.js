const assert = require('assert');
const { createAuthApp, request, extractCookieValue, withServer } = require('./httpTestUtils');
const { createMemoryRepositories } = require('../repositories/memoryRepositories');

console.log('🧪 Iniciando testes HTTP da SPEC-008...\n');

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

    async function createBand(user, name) {
      const result = await call(user.cookie, 'POST', '/api/bandas', { name });
      assert.strictEqual(result.status, 201);
      return result.json.band.id;
    }

    async function createMusic(user, bandId, title) {
      const result = await call(user.cookie, 'POST', `/api/bandas/${bandId}/musicas`, {
        titulo: title,
        tom: 'C',
        bpm: 120,
        duracaoSegundos: 180
      });
      assert.strictEqual(result.status, 201);
      return result.json.music.id;
    }

    async function createSetlist(user, bandId, musicId, date, name) {
      const result = await call(user.cookie, 'POST', `/api/bandas/${bandId}/setlists`, {
        nome: name,
        data: date,
        tempoDisponivelSegundos: 1800,
        musicaIds: [musicId]
      });
      assert.strictEqual(result.status, 201);
      return result.json.setlist.id;
    }

    const leader = await signUp('lider');
    const outsider = await signUp('fora');
    const bandId = await createBand(leader, 'Banda Histórico');
    const outsiderBandId = await createBand(outsider, 'Outra Banda');
    const musicId = await createMusic(leader, bandId, 'Música Histórico');
    const outsiderMusicId = await createMusic(outsider, outsiderBandId, 'Música Outra');

    const draftId = await createSetlist(leader, bandId, musicId, '2026-10-01', 'Rascunho');
    let result = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists/${draftId}/tocar`);
    assert.strictEqual(result.status, 409);
    assert.strictEqual(result.json.error.code, 'SETLIST_NOT_CONFIRMED');

    const oldId = await createSetlist(leader, bandId, musicId, '2026-09-01', 'Antigo');
    const recentId = await createSetlist(leader, bandId, musicId, '2026-10-15', 'Recente');
    for (const id of [oldId, recentId]) {
      result = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists/${id}/confirmar`);
      assert.strictEqual(result.status, 200);
      result = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists/${id}/tocar`);
      assert.strictEqual(result.status, 200);
      assert.strictEqual(result.json.setlist.estado, 'Tocado');
    }

    result = await call(leader.cookie, 'GET', `/api/bandas/${bandId}/historico`);
    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual(result.json.historico.map((setlist) => setlist.id), [recentId, oldId]);
    assert.ok(result.json.historico.every((setlist) => setlist.estado === 'Tocado'));
    console.log('✅ Transição Confirmado → Tocado e histórico decrescente funcionam.');

    result = await call(outsider.cookie, 'GET', `/api/bandas/${bandId}/historico`);
    assert.strictEqual(result.status, 403);
    assert.strictEqual(result.json.error.code, 'BAND_ACCESS_DENIED');

    result = await call(leader.cookie, 'GET', `/api/bandas/${outsiderBandId}/historico`);
    assert.strictEqual(result.status, 403);
    assert.strictEqual(result.json.error.code, 'BAND_ACCESS_DENIED');

    const outsiderSetlist = await createSetlist(outsider, outsiderBandId, outsiderMusicId, '2026-11-01', 'Outro');
    result = await call(outsider.cookie, 'GET', `/api/bandas/${outsiderBandId}/historico`);
    assert.deepStrictEqual(result.json.historico, []);
    assert.ok(outsiderSetlist);
  });

  console.log('\n🎉 Todos os testes HTTP da SPEC-008 passaram com sucesso!');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
