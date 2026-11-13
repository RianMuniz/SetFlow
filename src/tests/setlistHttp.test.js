const assert = require('assert');
const { createAuthApp, request, extractCookieValue, withServer } = require('./httpTestUtils');
const { createMemoryRepositories } = require('../repositories/memoryRepositories');

console.log('🧪 Iniciando testes HTTP da SPEC-004...\n');

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
      const response = await call(null, 'POST', '/api/auth/register', {
        nickname,
        email: `${nickname}@teste.com`,
        password: 'senha1234'
      });
      assert.strictEqual(response.status, 201);
      return {
        id: response.json.user.id,
        cookie: extractCookieValue(response.headers['set-cookie'], 'setflow_session'),
        nickname
      };
    }

    async function createBand(user, name) {
      const response = await call(user.cookie, 'POST', '/api/bandas', { name });
      assert.strictEqual(response.status, 201);
      return response.json.band.id;
    }

    async function createMusic(user, bandId, title) {
      const response = await call(user.cookie, 'POST', `/api/bandas/${bandId}/musicas`, {
        titulo: title,
        tom: 'C',
        bpm: 120,
        duracaoSegundos: 180
      });
      assert.strictEqual(response.status, 201);
      return response.json.music.id;
    }

    const leader = await signUp('lider');
    const musician = await signUp('musico');
    const outsider = await signUp('fora');
    const bandId = await createBand(leader, 'Banda de Setlists');
    const otherBandId = await createBand(outsider, 'Outra Banda');
    await call(leader.cookie, 'POST', `/api/bandas/${bandId}/membros`, {
      nickname: musician.nickname
    });
    const musicId = await createMusic(leader, bandId, 'Música da Banda');
    const otherMusicId = await createMusic(outsider, otherBandId, 'Música Externa');

    const created = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists`, {
      nome: 'Show de Outubro',
      data: '2026-10-09',
      tempoDisponivelSegundos: 3600,
      musicaIds: [musicId]
    });
    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.json.setlist.estado, 'Rascunho');
    assert.strictEqual(created.json.setlist.bandaId, bandId);
    assert.strictEqual(created.json.setlist.musicas.length, 1);
    assert.strictEqual(created.json.setlist.musicas[0].musicaId, musicId);
    assert.strictEqual(created.json.setlist.musicas[0].ordem, 1);
    console.log('✅ Líder cria setlist persistido em estado Rascunho com ordem inicial.');

    const empty = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists`, {
      nome: 'Setlist vazio',
      data: '2026-10-09',
      tempoDisponivelSegundos: 3600,
      musicaIds: []
    });
    assert.strictEqual(empty.status, 400);
    assert.strictEqual(empty.json.error.code, 'VALIDATION_ERROR');

    const outsideMusic = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists`, {
      nome: 'Misturado',
      data: '2026-10-09',
      tempoDisponivelSegundos: 3600,
      musicaIds: [musicId, otherMusicId]
    });
    assert.strictEqual(outsideMusic.status, 400);
    assert.strictEqual(outsideMusic.json.error.code, 'MUSIC_OUTSIDE_BAND');

    const denied = await call(musician.cookie, 'POST', `/api/bandas/${bandId}/setlists`, {
      nome: 'Sem permissão',
      data: '2026-10-09',
      tempoDisponivelSegundos: 3600,
      musicaIds: [musicId]
    });
    assert.strictEqual(denied.status, 403);
    assert.strictEqual(denied.json.error.code, 'LEADER_REQUIRED');

    const outsiderAccess = await call(outsider.cookie, 'POST', `/api/bandas/${bandId}/setlists`, {
      nome: 'Acesso indevido',
      data: '2026-10-09',
      tempoDisponivelSegundos: 3600,
      musicaIds: [musicId]
    });
    assert.strictEqual(outsiderAccess.status, 403);
    assert.strictEqual(outsiderAccess.json.error.code, 'BAND_ACCESS_DENIED');

    const invalidPayload = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists`, {
      nome: 'Dados inválidos',
      data: '09/10/2026',
      tempoDisponivelSegundos: 0,
      musicaIds: [musicId]
    });
    assert.strictEqual(invalidPayload.status, 400);
    assert.strictEqual(invalidPayload.json.error.code, 'VALIDATION_ERROR');

    const suggestion = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists/${created.json.setlist.id}/sugestao`);
    assert.strictEqual(suggestion.status, 200);
    assert.strictEqual(suggestion.json.setlist.estado, 'Rascunho');
    assert.strictEqual(suggestion.json.sugestao.musicas.length, 1);
    assert.strictEqual(suggestion.json.sugestao.alertaTempoExcedido, false);
    console.log('✅ Sugestão HTTP respeita o setlist, o limiar e os alertas calculados.');

    const missing = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists/sl-inexistente/sugestao`);
    assert.strictEqual(missing.status, 404);
    assert.strictEqual(missing.json.error.code, 'SETLIST_NOT_FOUND');

    const reordered = await call(leader.cookie, 'PUT', `/api/bandas/${bandId}/setlists/${created.json.setlist.id}/ordem`, {
      musicaIds: [musicId]
    });
    assert.strictEqual(reordered.status, 200);
    assert.strictEqual(reordered.json.setlist.musicas[0].ordem, 1);
    assert.ok(Object.prototype.hasOwnProperty.call(reordered.json, 'alerts'));
    assert.strictEqual(reordered.json.alerts.duracaoTotalSegundos, 180);
    console.log('✅ Reordenação manual atualiza a ordem e recalcula alertas.');

    const confirmed = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists/${created.json.setlist.id}/confirmar`);
    assert.strictEqual(confirmed.status, 200);
    assert.strictEqual(confirmed.json.setlist.estado, 'Confirmado');

    const reorderConfirmed = await call(leader.cookie, 'PUT', `/api/bandas/${bandId}/setlists/${created.json.setlist.id}/ordem`, {
      musicaIds: [musicId]
    });
    assert.strictEqual(reorderConfirmed.status, 409);
    assert.strictEqual(reorderConfirmed.json.error.code, 'SETLIST_NOT_DRAFT');

    const reopened = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/setlists/${created.json.setlist.id}/reabrir`);
    assert.strictEqual(reopened.status, 200);
    assert.strictEqual(reopened.json.setlist.estado, 'Rascunho');

    const musicianConfirm = await call(musician.cookie, 'POST', `/api/bandas/${bandId}/setlists/${created.json.setlist.id}/confirmar`);
    assert.strictEqual(musicianConfirm.status, 403);
    assert.strictEqual(musicianConfirm.json.error.code, 'LEADER_REQUIRED');
  });

  console.log('\n🎉 Todos os testes HTTP da SPEC-004 passaram com sucesso!');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
