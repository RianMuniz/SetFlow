const assert = require('assert');
const { createAuthApp, request, extractCookieValue, withServer } = require('./httpTestUtils');
const { createMemoryRepositories } = require('../repositories/memoryRepositories');

console.log('🧪 Iniciando testes HTTP da inclusão de músicas no setlist...\n');

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

    async function createMusic(user, bandId, titulo) {
      const response = await call(user.cookie, 'POST', `/api/bandas/${bandId}/musicas`, { titulo, tom: 'C', bpm: 120, duracaoSegundos: 180 });
      assert.strictEqual(response.status, 201);
      return response.json.music.id;
    }

    const leader = await signUp('lider');
    const musician = await signUp('musico');
    const outsider = await signUp('fora');
    const bandId = (await call(leader.cookie, 'POST', '/api/bandas', { name: 'Banda Add' })).json.band.id;
    const otherBandId = (await call(outsider.cookie, 'POST', '/api/bandas', { name: 'Banda Externa' })).json.band.id;
    await call(leader.cookie, 'POST', `/api/bandas/${bandId}/membros`, { nickname: musician.nickname });

    const musicIds = [];
    for (const title of ['Um', 'Dois', 'Três', 'Quatro']) {
      musicIds.push(await createMusic(leader, bandId, title));
    }
    const [m1, m2, m3, m4] = musicIds;
    const foreign = await createMusic(outsider, otherBandId, 'De fora');

    const created = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists`, {
      nome: 'Ensaio', data: '2026-11-20', tempoDisponivelSegundos: 400, musicaIds: [m1]
    });
    assert.strictEqual(created.status, 201);
    const base = `/api/bandas/${bandId}/setlists/${created.json.setlist.id}`;

    // ---- adicionar depois de criado
    const added = await call(leader.cookie, 'POST', `${base}/musicas`, { musicaIds: [m2, m3] });
    assert.strictEqual(added.status, 201);
    assert.deepStrictEqual(added.json.setlist.musicas.map((item) => [item.musicaId, item.ordem]), [[m1, 1], [m2, 2], [m3, 3]]);
    assert.strictEqual(added.json.alerts.duracaoTotalSegundos, 540);
    assert.strictEqual(added.json.alerts.alertaTempoExcedido, true, '540s > 400s disponíveis');
    const drafts = await call(leader.cookie, 'GET', `/api/bandas/${bandId}/setlists`);
    assert.strictEqual(drafts.json.setlists[0].musicas.length, 3);
    console.log('✅ Líder adiciona músicas ao rascunho: entram ao final e o alerta de tempo é recalculado.');

    const reordered = await call(leader.cookie, 'PUT', `${base}/ordem`, { musicaIds: [m3, m1, m2] });
    assert.strictEqual(reordered.status, 200);
    console.log('✅ Setlist com músicas adicionadas continua podendo ser reordenado.');

    // ---- validações (nada muda quando recusado)
    const dup = await call(leader.cookie, 'POST', `${base}/musicas`, { musicaIds: [m4, m2] });
    assert.strictEqual(dup.status, 409);
    assert.strictEqual(dup.json.error.code, 'MUSIC_ALREADY_IN_SETLIST');
    assert.strictEqual((await call(leader.cookie, 'POST', `${base}/musicas`, { musicaIds: [m4, m4] })).status, 400);
    assert.strictEqual((await call(leader.cookie, 'POST', `${base}/musicas`, { musicaIds: [] })).status, 400);
    assert.strictEqual((await call(leader.cookie, 'POST', `${base}/musicas`, { musicaIds: m4 })).status, 400);
    assert.strictEqual((await call(leader.cookie, 'POST', `${base}/musicas`, {})).status, 400);
    const outside = await call(leader.cookie, 'POST', `${base}/musicas`, { musicaIds: [foreign] });
    assert.strictEqual(outside.status, 400);
    assert.strictEqual(outside.json.error.code, 'MUSIC_OUTSIDE_BAND');
    assert.strictEqual((await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists/inexistente/musicas`, { musicaIds: [m4] })).status, 404);
    const unchanged = await call(leader.cookie, 'GET', `/api/bandas/${bandId}/setlists`);
    assert.strictEqual(unchanged.json.setlists[0].musicas.length, 3, 'pedidos recusados não alteram o setlist');
    console.log('✅ Duplicadas, repetidas, vazias, de outra banda e setlist inexistente são recusadas sem alterar nada.');

    // ---- permissões
    const asMusician = await call(musician.cookie, 'POST', `${base}/musicas`, { musicaIds: [m4] });
    assert.strictEqual(asMusician.status, 403);
    assert.strictEqual(asMusician.json.error.code, 'LEADER_REQUIRED');
    assert.strictEqual((await call(outsider.cookie, 'POST', `${base}/musicas`, { musicaIds: [m4] })).status, 403);
    assert.strictEqual((await call(null, 'POST', `${base}/musicas`, { musicaIds: [m4] })).status, 401);
    console.log('✅ Somente o líder da banda adiciona músicas.');

    // ---- estado: confirmado exige reabrir
    assert.strictEqual((await call(leader.cookie, 'POST', `${base}/confirmar`)).status, 200);
    const locked = await call(leader.cookie, 'POST', `${base}/musicas`, { musicaIds: [m4] });
    assert.strictEqual(locked.status, 409);
    assert.strictEqual(locked.json.error.code, 'SETLIST_NOT_DRAFT');
    assert.strictEqual((await call(leader.cookie, 'POST', `${base}/reabrir`)).status, 200);
    const again = await call(leader.cookie, 'POST', `${base}/musicas`, { musicaIds: [m4] });
    assert.strictEqual(again.status, 201);
    assert.strictEqual(again.json.setlist.musicas.length, 4);
    console.log('✅ Setlist confirmado recusa novas músicas; depois de reaberto volta a aceitar.');
  });

  console.log('\n🎉 Todos os testes HTTP da inclusão de músicas passaram com sucesso!');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
