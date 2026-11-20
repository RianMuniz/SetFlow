const assert = require('assert');
const http = require('http');
const { createAuthApp, request, extractCookieValue, withServer } = require('./httpTestUtils');
const { createMemoryRepositories } = require('../repositories/memoryRepositories');
const {
  MAX_CHORD_FILE_BYTES,
  detectChordFileType,
  sanitizeFileName,
  contentDispositionFor
} = require('../chordFile');

console.log('🧪 Iniciando testes da cifra anexada (arquivo)...\n');

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16, 2)]);
const TXT = Buffer.from('C#  G#  A#m\nRefrão: F# B', 'utf8');

// ---- unitários
assert.strictEqual(detectChordFileType(PDF), 'application/pdf');
assert.strictEqual(detectChordFileType(PNG), 'image/png');
assert.strictEqual(detectChordFileType(JPG), 'image/jpeg');
assert.strictEqual(detectChordFileType(TXT), 'text/plain');
assert.strictEqual(detectChordFileType(Buffer.alloc(0)), null);
assert.strictEqual(detectChordFileType(Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe])), null);
assert.strictEqual(detectChordFileType(Buffer.from('MZ\u0000\u0000')), null);
assert.strictEqual(sanitizeFileName(encodeURIComponent('../../etc/Cifra Ação.pdf'), 'application/pdf'), 'Cifra Ação.pdf');
assert.strictEqual(sanitizeFileName(undefined, 'image/png'), 'cifra.png');
assert.strictEqual(sanitizeFileName('%E0%A4%A', 'text/plain'), '%E0%A4%A');
assert.strictEqual(sanitizeFileName('..', 'text/plain'), 'cifra.txt');
assert.ok(sanitizeFileName('a'.repeat(300) + '.pdf', 'application/pdf').length <= 120);
assert.match(contentDispositionFor('Ação "1".pdf'), /^inline; filename="A__o _1_\.pdf"; filename\*=UTF-8''A%C3%A7%C3%A3o%20%221%22\.pdf$/);
console.log('✅ Detecção por conteúdo, nome seguro e Content-Disposition.');

function rawRequest({ port, method, path, headers = {}, body }) {
  return new Promise((resolve) => {
    const requestHeaders = Object.assign({}, headers);
    if (body) {
      requestHeaders['Content-Length'] = body.length;
    }
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: requestHeaders }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(buffer.toString('utf8')); } catch (error) { json = null; }
        resolve({ status: res.statusCode, headers: res.headers, buffer, json });
      });
    });
    req.on('error', (error) => resolve({ status: 0, error }));
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

(async function main() {
  const app = createAuthApp({ repositories: createMemoryRepositories(), isProduction: false });

  await withServer(app, async ({ port }) => {
    let sequence = 0;
    const call = (cookie, method, path, body) => request({ port, method, path, body, headers: cookie ? { Cookie: cookie } : {} });
    const upload = (cookie, path, body, name = 'cifra.pdf') => rawRequest({
      port,
      method: 'PUT',
      path,
      body,
      headers: { Cookie: cookie, 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(name) }
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
      return { cookie: extractCookieValue(response.headers['set-cookie'], 'setflow_session'), nickname };
    }

    const leader = await signUp('lider');
    const musician = await signUp('musico');
    const outsider = await signUp('fora');
    const bandId = (await call(leader.cookie, 'POST', '/api/bandas', { name: 'Banda Cifras' })).json.band.id;
    await call(outsider.cookie, 'POST', '/api/bandas', { name: 'Banda Externa' });
    await call(leader.cookie, 'POST', `/api/bandas/${bandId}/membros`, { nickname: musician.nickname });
    const created = await call(leader.cookie, 'POST', `/api/bandas/${bandId}/musicas`, {
      titulo: 'Com Cifra', tom: 'C', bpm: 100, duracaoSegundos: 200, cifraAnexo: 'texto antigo'
    });
    assert.strictEqual(created.json.music.cifraArquivo, null);
    const musicId = created.json.music.id;
    const chordPath = `/api/bandas/${bandId}/musicas/${musicId}/cifra`;

    // ---- envio
    const sent = await upload(leader.cookie, chordPath, PDF, 'Cifra Ação.pdf');
    assert.strictEqual(sent.status, 200);
    assert.deepStrictEqual(sent.json.cifraArquivo, { nome: 'Cifra Ação.pdf', tipo: 'application/pdf', tamanhoBytes: PDF.length });
    console.log('✅ Líder anexa a cifra em PDF.');

    const listed = await call(leader.cookie, 'GET', `/api/bandas/${bandId}/musicas`);
    assert.strictEqual(listed.json.music[0].cifraArquivo.nome, 'Cifra Ação.pdf');
    const edited = await call(leader.cookie, 'PUT', `/api/bandas/${bandId}/musicas/${musicId}`, {
      titulo: 'Com Cifra 2', tom: 'D', bpm: 100, duracaoSegundos: 200
    });
    assert.strictEqual(edited.status, 200);
    assert.strictEqual(edited.json.music.cifraArquivo.nome, 'Cifra Ação.pdf');
    assert.strictEqual(edited.json.music.cifraAnexo, 'texto antigo');
    console.log('✅ Listagem e edição da música preservam o arquivo e o texto antigo.');

    // ---- download por qualquer membro
    for (const user of [leader, musician]) {
      const download = await rawRequest({ port, method: 'GET', path: chordPath, headers: { Cookie: user.cookie } });
      assert.strictEqual(download.status, 200);
      assert.ok(download.buffer.equals(PDF));
      assert.strictEqual(download.headers['content-type'], 'application/pdf');
      assert.strictEqual(download.headers['x-content-type-options'], 'nosniff');
      assert.match(download.headers['content-disposition'], /^inline; filename=/);
    }
    console.log('✅ Líder e músico baixam o arquivo idêntico, com nosniff.');

    // ---- permissões
    assert.strictEqual((await upload(musician.cookie, chordPath, PDF)).status, 403);
    assert.strictEqual((await rawRequest({ port, method: 'GET', path: chordPath, headers: { Cookie: outsider.cookie } })).status, 403);
    assert.strictEqual((await rawRequest({ port, method: 'GET', path: chordPath })).status, 401);
    const denyDelete = await call(musician.cookie, 'DELETE', chordPath);
    assert.strictEqual(denyDelete.status, 403);
    assert.strictEqual(denyDelete.json.error.code, 'LEADER_REQUIRED');
    console.log('✅ Só o líder altera; fora da banda e sem sessão não baixam.');

    // ---- validação
    const html = await upload(leader.cookie, chordPath, Buffer.from('<html><script>alert(1)</script></html>\u0000'), 'x.pdf');
    assert.strictEqual(html.status, 415);
    assert.strictEqual(html.json.error.code, 'UNSUPPORTED_FILE_TYPE');
    assert.strictEqual((await upload(leader.cookie, chordPath, Buffer.alloc(0))).status, 400);
    const asJson = await call(leader.cookie, 'PUT', chordPath, { a: 1 });
    assert.strictEqual(asJson.status, 400);
    const huge = await upload(leader.cookie, chordPath, Buffer.concat([PDF, Buffer.alloc(MAX_CHORD_FILE_BYTES)]));
    assert.ok(huge.status === 413 || huge.status === 0, `esperado 413 (ou conexão encerrada), veio ${huge.status}`);
    if (huge.status === 413) {
      assert.strictEqual(huge.json.error.code, 'PAYLOAD_TOO_LARGE');
    }
    const missing = await upload(leader.cookie, `/api/bandas/${bandId}/musicas/m-inexistente/cifra`, PDF);
    assert.strictEqual(missing.status, 404);
    const still = await rawRequest({ port, method: 'GET', path: chordPath, headers: { Cookie: leader.cookie } });
    assert.ok(still.buffer.equals(PDF), 'arquivo anterior deve continuar intacto após envios recusados');
    console.log('✅ HTML disfarçado, vazio, JSON, acima de 5 MB e música inexistente são recusados.');

    // ---- substituir, aceitar PNG/JPG/TXT e remover
    for (const [buffer, tipo, nome] of [[PNG, 'image/png', 'a.png'], [JPG, 'image/jpeg', 'b.jpg'], [TXT, 'text/plain', 'c.txt']]) {
      const replaced = await upload(leader.cookie, chordPath, buffer, nome);
      assert.strictEqual(replaced.status, 200);
      assert.strictEqual(replaced.json.cifraArquivo.tipo, tipo);
    }
    const txt = await rawRequest({ port, method: 'GET', path: chordPath, headers: { Cookie: leader.cookie } });
    assert.strictEqual(txt.headers['content-type'], 'text/plain; charset=utf-8');
    assert.ok(txt.buffer.equals(TXT));
    console.log('✅ Substituição por PNG, JPG e TXT mantém um único arquivo por música.');

    const removed = await call(leader.cookie, 'DELETE', chordPath);
    assert.strictEqual(removed.status, 200);
    assert.strictEqual((await rawRequest({ port, method: 'GET', path: chordPath, headers: { Cookie: leader.cookie } })).status, 404);
    assert.strictEqual((await call(leader.cookie, 'DELETE', chordPath)).status, 404);
    const after = await call(leader.cookie, 'GET', `/api/bandas/${bandId}/musicas`);
    assert.strictEqual(after.json.music[0].cifraArquivo, null);
    console.log('✅ Remoção apaga o arquivo e a música volta a ficar sem anexo.');
  });

  console.log('\n🎉 Todos os testes da cifra anexada passaram com sucesso!');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
