// Suíte de integração HTTP da SPEC-001 (nickname/persistência) e SPEC-002.
// É executada duas vezes com o mesmo conjunto de asserções:
//   - bandHttp.test.js            -> repositórios em memória (npm test, sem banco)
//   - pg/pgIntegration.test.js    -> PostgreSQL real (npm run test:pg)
const assert = require('assert');
const { request, extractCookieValue, withServer } = require('./httpTestUtils');

async function runBandHttpSuite({ label, createApp, removeMembership }) {
  const app = await createApp();
  let seq = 0;

  await withServer(app, async ({ port }) => {
    const call = (cookie, method, path, body) => request({
      port,
      method,
      path,
      body,
      headers: cookie ? { Cookie: cookie } : {}
    });

    async function signUp(base) {
      seq += 1;
      const nickname = `${base}${seq}`;
      const email = `${nickname}@teste.com`;
      const response = await call(null, 'POST', '/api/auth/register', { nickname, email, password: 'senha1234' });

      assert.strictEqual(response.status, 201, `Cadastro de ${nickname} deveria retornar 201: ${response.body}`);
      return {
        nickname,
        email,
        password: 'senha1234',
        id: response.json.user.id,
        cookie: extractCookieValue(response.headers['set-cookie'], 'setflow_session')
      };
    }

    async function createBand(user, name) {
      const response = await call(user.cookie, 'POST', '/api/bandas', { name });
      assert.strictEqual(response.status, 201, `Criação da banda "${name}" deveria retornar 201: ${response.body}`);
      return response.json.band;
    }

    async function addMember(leader, bandId, nickname) {
      return call(leader.cookie, 'POST', `/api/bandas/${bandId}/membros`, { nickname });
    }

    async function step(name, fn) {
      await fn();
      console.log(`✅ [${label}] ${name}`);
    }

    await step('cadastro com nickname válido persiste e não expõe hash/salt', async () => {
      const user = await signUp('cad');
      const me = await call(user.cookie, 'GET', '/api/auth/me');

      assert.strictEqual(me.status, 200);
      assert.strictEqual(me.json.user.nickname, user.nickname);
      assert.strictEqual(me.json.user.email, user.email);
      assert.ok(!('passwordHash' in me.json.user) && !('passwordSalt' in me.json.user) && !('password' in me.json.user));
    });

    await step('nickname ausente ou inválido retorna VALIDATION_ERROR', async () => {
      const base = { email: 'semnick@teste.com', password: 'senha1234' };
      const cases = [{}, { nickname: '' }, { nickname: 'ab' }, { nickname: 'x'.repeat(21) }, { nickname: 'com espaço' }, { nickname: 'acento-ção' }, { nickname: 42 }];

      for (const extra of cases) {
        const response = await call(null, 'POST', '/api/auth/register', Object.assign({}, base, extra));
        assert.strictEqual(response.status, 400, `Esperado 400 para ${JSON.stringify(extra)}`);
        assert.strictEqual(response.json.error.code, 'VALIDATION_ERROR');
      }
    });

    await step('nickname duplicado (sem diferenciar maiúsculas/minúsculas) retorna 409', async () => {
      const first = await signUp('dup');
      const response = await call(null, 'POST', '/api/auth/register', {
        nickname: first.nickname.toUpperCase(),
        email: 'outro-email@teste.com',
        password: 'senha1234'
      });

      assert.strictEqual(response.status, 409);
      assert.strictEqual(response.json.error.code, 'NICKNAME_ALREADY_EXISTS');

      const sameEmail = await call(null, 'POST', '/api/auth/register', {
        nickname: 'nickname-livre',
        email: first.email,
        password: 'senha1234'
      });
      assert.strictEqual(sameEmail.status, 409);
      assert.strictEqual(sameEmail.json.error.code, 'EMAIL_ALREADY_EXISTS');
    });

    await step('login por e-mail funciona após persistência (nickname não autentica)', async () => {
      const user = await signUp('log');
      await call(user.cookie, 'POST', '/api/auth/logout');

      const login = await call(null, 'POST', '/api/auth/login', { email: user.email, password: user.password });
      assert.strictEqual(login.status, 200);
      assert.strictEqual(login.json.user.id, user.id);
      assert.strictEqual(login.json.user.nickname, user.nickname);

      const byNickname = await call(null, 'POST', '/api/auth/login', { email: user.nickname, password: user.password });
      assert.strictEqual(byNickname.status, 400);
    });

    await step('rotas de banda exigem autenticação', async () => {
      const routes = [
        ['POST', '/api/bandas', { name: 'Sem Login' }],
        ['GET', '/api/bandas'],
        ['GET', '/api/bandas/b-qualquer'],
        ['POST', '/api/bandas/b-qualquer/membros', { nickname: 'alguem' }],
        ['POST', '/api/bandas/b-qualquer/ativa']
      ];

      for (const [method, path, body] of routes) {
        const response = await call(null, method, path, body);
        assert.strictEqual(response.status, 401, `${method} ${path} deveria exigir autenticação.`);
        assert.strictEqual(response.json.error.code, 'AUTHENTICATION_REQUIRED');
      }
    });

    await step('criação de banda autenticada define líder e contexto ativo', async () => {
      const user = await signUp('cri');
      const response = await call(user.cookie, 'POST', '/api/bandas', { name: '  Os   Testadores ' });

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.json.band.name, 'Os Testadores');
      assert.strictEqual(response.json.band.role, 'leader');
      assert.strictEqual(response.json.band.memberCount, 1);
      assert.strictEqual(response.json.band.transitionThresholdSemitones, 5);
      assert.strictEqual(response.json.activeBandId, response.json.band.id);
    });

    await step('criador é registrado como único leader', async () => {
      const user = await signUp('lid');
      const band = await createBand(user, 'Banda do Líder');
      const detail = await call(user.cookie, 'GET', `/api/bandas/${band.id}`);

      assert.strictEqual(detail.status, 200);
      assert.strictEqual(detail.json.band.members.length, 1);
      assert.strictEqual(detail.json.band.members[0].userId, user.id);
      assert.strictEqual(detail.json.band.members[0].role, 'leader');
      assert.strictEqual(detail.json.band.members[0].nickname, user.nickname);
    });

    await step('nome de banda inválido retorna VALIDATION_ERROR', async () => {
      const user = await signUp('inv');

      for (const body of [{}, { name: '' }, { name: '    ' }, { name: 123 }, { name: 'x'.repeat(61) }]) {
        const response = await call(user.cookie, 'POST', '/api/bandas', body);
        assert.strictEqual(response.status, 400, `Esperado 400 para ${JSON.stringify(body)}`);
        assert.strictEqual(response.json.error.code, 'VALIDATION_ERROR');
      }

      const empty = await call(user.cookie, 'GET', '/api/bandas');
      assert.strictEqual(empty.json.bands.length, 0, 'Nenhuma banda deve ser criada por payload inválido.');
    });

    await step('nome duplicado pelo mesmo usuário é rejeitado (normalizado)', async () => {
      const user = await signUp('nom');
      await createBand(user, 'Rock Band');

      const duplicate = await call(user.cookie, 'POST', '/api/bandas', { name: '  rock   BAND ' });
      assert.strictEqual(duplicate.status, 409);
      assert.strictEqual(duplicate.json.error.code, 'BAND_NAME_ALREADY_EXISTS');

      const list = await call(user.cookie, 'GET', '/api/bandas');
      assert.strictEqual(list.json.bands.length, 1);
    });

    await step('mesmo nome é permitido para usuários diferentes', async () => {
      const first = await signUp('mn1');
      const second = await signUp('mn2');

      const bandA = await createBand(first, 'Nome Compartilhado');
      const bandB = await createBand(second, 'Nome Compartilhado');
      assert.notStrictEqual(bandA.id, bandB.id);
    });

    await step('listagem retorna apenas bandas do usuário, com papel, contagem e activeBandId', async () => {
      const userA = await signUp('lsa');
      const userB = await signUp('lsb');
      const bandA1 = await createBand(userA, 'A Um');
      const bandA2 = await createBand(userA, 'A Dois');
      const bandB1 = await createBand(userB, 'B Um');

      const listA = await call(userA.cookie, 'GET', '/api/bandas');
      assert.strictEqual(listA.status, 200);
      assert.deepStrictEqual(listA.json.bands.map((band) => band.id).sort(), [bandA1.id, bandA2.id].sort());
      assert.ok(listA.json.bands.every((band) => band.role === 'leader' && band.memberCount === 1));
      assert.strictEqual(listA.json.activeBandId, bandA2.id);

      const listB = await call(userB.cookie, 'GET', '/api/bandas');
      assert.deepStrictEqual(listB.json.bands.map((band) => band.id), [bandB1.id]);
      assert.strictEqual(listB.json.activeBandId, bandB1.id);
    });

    await step('acesso a banda vinculada retorna 200', async () => {
      const user = await signUp('vin');
      const band = await createBand(user, 'Vinculada');
      const detail = await call(user.cookie, 'GET', `/api/bandas/${band.id}`);

      assert.strictEqual(detail.status, 200);
      assert.strictEqual(detail.json.band.id, band.id);
      assert.strictEqual(detail.json.band.role, 'leader');
    });

    await step('acesso a banda não vinculada é negado; banda inexistente retorna 404', async () => {
      const owner = await signUp('own');
      const intruder = await signUp('int');
      const band = await createBand(owner, 'Privada');

      const denied = await call(intruder.cookie, 'GET', `/api/bandas/${band.id}`);
      assert.strictEqual(denied.status, 403);
      assert.strictEqual(denied.json.error.code, 'BAND_ACCESS_DENIED');
      assert.ok(!JSON.stringify(denied.json).includes('Privada'), 'Resposta negada não pode vazar dados da banda.');

      const missing = await call(intruder.cookie, 'GET', '/api/bandas/b-inexistente');
      assert.strictEqual(missing.status, 404);
      assert.strictEqual(missing.json.error.code, 'BAND_NOT_FOUND');
    });

    await step('líder adiciona músico por nickname (sem diferenciar maiúsculas/minúsculas)', async () => {
      const leader = await signUp('ld');
      const player = await signUp('mus');
      const band = await createBand(leader, 'Com Membro');

      const response = await addMember(leader, band.id, ` ${player.nickname.toUpperCase()} `);
      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.json.member.userId, player.id);
      assert.strictEqual(response.json.member.role, 'musico');
      assert.strictEqual(response.json.member.nickname, player.nickname);

      const playerList = await call(player.cookie, 'GET', '/api/bandas');
      assert.strictEqual(playerList.json.bands.length, 1);
      assert.strictEqual(playerList.json.bands[0].role, 'musico');
      assert.strictEqual(playerList.json.bands[0].memberCount, 2);

      const detail = await call(leader.cookie, 'GET', `/api/bandas/${band.id}`);
      assert.deepStrictEqual(detail.json.band.members.map((member) => member.role).sort(), ['leader', 'musico']);
    });

    await step('nickname inexistente retorna MEMBER_NOT_FOUND', async () => {
      const leader = await signUp('nf');
      const band = await createBand(leader, 'Sem Ninguém');

      const response = await addMember(leader, band.id, 'ninguem-assim');
      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.json.error.code, 'MEMBER_NOT_FOUND');

      const invalid = await addMember(leader, band.id, 'a');
      assert.strictEqual(invalid.status, 400);
      assert.strictEqual(invalid.json.error.code, 'VALIDATION_ERROR');
    });

    await step('membro duplicado retorna 409 MEMBER_ALREADY_EXISTS', async () => {
      const leader = await signUp('dl');
      const player = await signUp('dm');
      const band = await createBand(leader, 'Duplicados');

      assert.strictEqual((await addMember(leader, band.id, player.nickname)).status, 201);

      const again = await addMember(leader, band.id, player.nickname);
      assert.strictEqual(again.status, 409);
      assert.strictEqual(again.json.error.code, 'MEMBER_ALREADY_EXISTS');

      const self = await addMember(leader, band.id, leader.nickname);
      assert.strictEqual(self.status, 409);
      assert.strictEqual(self.json.error.code, 'MEMBER_ALREADY_EXISTS');
    });

    await step('músico não pode adicionar membros (LEADER_REQUIRED); sem vínculo retorna 403 de acesso', async () => {
      const leader = await signUp('ql');
      const player = await signUp('qm');
      const third = await signUp('qt');
      const outsider = await signUp('qo');
      const band = await createBand(leader, 'Só o Líder');
      await addMember(leader, band.id, player.nickname);

      const byPlayer = await addMember(player, band.id, third.nickname);
      assert.strictEqual(byPlayer.status, 403);
      assert.strictEqual(byPlayer.json.error.code, 'LEADER_REQUIRED');

      const byOutsider = await addMember(outsider, band.id, third.nickname);
      assert.strictEqual(byOutsider.status, 403);
      assert.strictEqual(byOutsider.json.error.code, 'BAND_ACCESS_DENIED');

      const detail = await call(leader.cookie, 'GET', `/api/bandas/${band.id}`);
      assert.strictEqual(detail.json.band.members.length, 2, 'Nenhum membro novo deve ter sido criado.');
    });

    await step('múltiplos vínculos com papéis independentes', async () => {
      const userX = await signUp('mx');
      const userY = await signUp('my');
      const bandX = await createBand(userX, 'Banda do X');
      const bandY = await createBand(userY, 'Banda do Y');
      assert.strictEqual((await addMember(userY, bandY.id, userX.nickname)).status, 201);

      const list = await call(userX.cookie, 'GET', '/api/bandas');
      const roles = Object.fromEntries(list.json.bands.map((band) => [band.id, band.role]));
      assert.deepStrictEqual(roles, { [bandX.id]: 'leader', [bandY.id]: 'musico' });

      const asMusician = await addMember(userX, bandY.id, 'qualquer-um');
      assert.strictEqual(asMusician.status, 403);
      assert.strictEqual(asMusician.json.error.code, 'LEADER_REQUIRED');

      const newcomer = await signUp('mz');
      assert.strictEqual((await addMember(userX, bandX.id, newcomer.nickname)).status, 201);
    });

    await step('alternância para banda vinculada atualiza o contexto ativo', async () => {
      const user = await signUp('alt');
      const band1 = await createBand(user, 'Primeira');
      const band2 = await createBand(user, 'Segunda');
      assert.strictEqual((await call(user.cookie, 'GET', '/api/bandas')).json.activeBandId, band2.id);

      const switched = await call(user.cookie, 'POST', `/api/bandas/${band1.id}/ativa`);
      assert.strictEqual(switched.status, 200);
      assert.strictEqual(switched.json.activeBandId, band1.id);
      assert.strictEqual((await call(user.cookie, 'GET', '/api/bandas')).json.activeBandId, band1.id);
    });

    await step('alternância para banda não vinculada é negada e não altera o contexto', async () => {
      const user = await signUp('na');
      const other = await signUp('no');
      const mine = await createBand(user, 'Minha');
      const theirs = await createBand(other, 'Deles');

      const denied = await call(user.cookie, 'POST', `/api/bandas/${theirs.id}/ativa`);
      assert.strictEqual(denied.status, 403);
      assert.strictEqual(denied.json.error.code, 'BAND_ACCESS_DENIED');

      const missing = await call(user.cookie, 'POST', '/api/bandas/b-inexistente/ativa');
      assert.strictEqual(missing.status, 404);
      assert.strictEqual(missing.json.error.code, 'BAND_NOT_FOUND');

      assert.strictEqual((await call(user.cookie, 'GET', '/api/bandas')).json.activeBandId, mine.id);
    });

    await step('activeBandId persiste na sessão do servidor e é isolado por sessão', async () => {
      const user = await signUp('ps');
      const other = await signUp('po');
      const band1 = await createBand(user, 'Persistente 1');
      await createBand(user, 'Persistente 2');
      await call(user.cookie, 'POST', `/api/bandas/${band1.id}/ativa`);

      for (let i = 0; i < 3; i += 1) {
        assert.strictEqual((await call(user.cookie, 'GET', '/api/bandas')).json.activeBandId, band1.id);
      }
      assert.strictEqual((await call(other.cookie, 'GET', '/api/bandas')).json.activeBandId, null);

      await call(user.cookie, 'POST', '/api/auth/logout');
      const relogin = await call(null, 'POST', '/api/auth/login', { email: user.email, password: user.password });
      const newCookie = extractCookieValue(relogin.headers['set-cookie'], 'setflow_session');
      assert.strictEqual((await call(newCookie, 'GET', '/api/bandas')).json.activeBandId, null, 'Nova sessão começa sem contexto ativo.');
    });

    await step('vínculo removido limpa o contexto ativo e bloqueia o acesso', async () => {
      const leader = await signUp('rl');
      const player = await signUp('rp');
      const band = await createBand(leader, 'Vínculo Removido');
      await addMember(leader, band.id, player.nickname);
      await call(player.cookie, 'POST', `/api/bandas/${band.id}/ativa`);
      assert.strictEqual((await call(player.cookie, 'GET', '/api/bandas')).json.activeBandId, band.id);

      await removeMembership(band.id, player.id);

      const list = await call(player.cookie, 'GET', '/api/bandas');
      assert.strictEqual(list.json.activeBandId, null);
      assert.strictEqual(list.json.bands.length, 0);
      assert.strictEqual((await call(player.cookie, 'GET', `/api/bandas/${band.id}`)).status, 403);
      assert.strictEqual((await call(player.cookie, 'POST', `/api/bandas/${band.id}/ativa`)).status, 403);
    });
  });
}

module.exports = { runBandHttpSuite };
