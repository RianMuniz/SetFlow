const assert = require('assert');
const { createAuthApp } = require('./httpTestUtils');
const { createMemoryRepositories } = require('../repositories/memoryRepositories');
const { request, extractCookieValue, withServer } = require('./httpTestUtils');

console.log('🧪 Iniciando testes HTTP da SPEC-003...\n');

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
        cookie: extractCookieValue(response.headers['set-cookie'], 'setflow_session'),
        nickname
      };
    }

    const leader = await signUp('lider');
    const other = await signUp('outro');
    const bandResponse = await call(leader.cookie, 'POST', '/api/bandas', { name: 'Banda SPEC-003' });
    const bandId = bandResponse.json.band.id;
    const otherBandResponse = await call(other.cookie, 'POST', '/api/bandas', { name: 'Outra Banda' });
    const otherBandId = otherBandResponse.json.band.id;

    const created = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/musicas`, {
      titulo: 'Canção de Teste',
      tom: 'C#',
      bpm: 120,
      duracaoSegundos: 210,
      observacoes: 'Entrada suave',
      cifraAnexo: 'C# G# A#m'
    });
    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.json.music.bandaId, bandId);
    assert.strictEqual(created.json.music.tom, 'C#');
    const musicId = created.json.music.id;
    console.log('✅ Cadastro válido persiste a música na banda ativa.');

    const listed = await call(leader.cookie, 'GET', `/api/bandas/${bandId}/musicas`);
    assert.strictEqual(listed.status, 200);
    assert.deepStrictEqual(listed.json.music.map((music) => music.id), [musicId]);

    const invalid = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/musicas`, {
      titulo: 'Inválida',
      tom: 'H',
      bpm: 100,
      duracaoSegundos: 0
    });
    assert.strictEqual(invalid.status, 400);
    assert.strictEqual(invalid.json.error.code, 'VALIDATION_ERROR');
    console.log('✅ Tom inválido e duração não positiva são rejeitados.');

    const threshold = await call(leader.cookie, 'PUT', `/api/bandas/${bandId}/limiar-transicao`, {
      limiarTransicaoSemitons: 7
    });
    assert.strictEqual(threshold.status, 200);
    assert.strictEqual(threshold.json.band.transitionThresholdSemitones, 7);
    console.log('✅ Limiar é atualizado por banda.');

    const edited = await call(leader.cookie, 'PUT', `/api/bandas/${bandId}/musicas/${musicId}`, {
      titulo: 'Canção Editada',
      tom: 'D',
      bpm: 125,
      duracaoSegundos: 220
    });
    assert.strictEqual(edited.status, 200);
    assert.strictEqual(edited.json.music.titulo, 'Canção Editada');

    const denied = await call(other.cookie, 'GET', `/api/bandas/${bandId}/musicas`);
    assert.strictEqual(denied.status, 403);
    assert.strictEqual(denied.json.error.code, 'BAND_ACCESS_DENIED');

    const otherList = await call(other.cookie, 'GET', `/api/bandas/${otherBandId}/musicas`);
    assert.strictEqual(otherList.status, 200);
    assert.deepStrictEqual(otherList.json.music, []);

    const missing = await call(leader.cookie, 'GET', '/api/bandas/b-inexistente/musicas');
    assert.strictEqual(missing.status, 404);
    assert.strictEqual(missing.json.error.code, 'BAND_NOT_FOUND');
  });

  console.log('\n🎉 Todos os testes HTTP da SPEC-003 passaram com sucesso!');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
