const assert = require('assert');
const { createMemoryRepositories } = require('../repositories/memoryRepositories');
const { createConsoleMailer } = require('../mailer');
const {
  RESET_TOKEN_TTL_MS,
  RESET_TOKEN_PATTERN,
  hashResetToken,
  generateResetToken,
  buildResetLink,
  buildResetEmail
} = require('../passwordReset');

console.log('🧪 Iniciando testes da redefinição de senha (unitários)...\n');

(async function main() {
  // Token: aleatório, 256 bits, só o hash é derivado dele
  const first = generateResetToken();
  const second = generateResetToken();
  assert.ok(RESET_TOKEN_PATTERN.test(first.token));
  assert.notStrictEqual(first.token, second.token);
  assert.strictEqual(first.tokenHash, hashResetToken(first.token));
  assert.notStrictEqual(first.tokenHash, first.token);
  assert.ok(!RESET_TOKEN_PATTERN.test('abc') && !RESET_TOKEN_PATTERN.test(`${first.token}0`) && !RESET_TOKEN_PATTERN.test(first.token.toUpperCase()));
  assert.strictEqual(RESET_TOKEN_TTL_MS, 30 * 60 * 1000);
  console.log('✅ Token de 256 bits, hash SHA-256 e formato validado.');

  // Link e e-mail
  assert.strictEqual(buildResetLink('http://app.test/', first.token), `http://app.test/#reset=${first.token}`);
  assert.strictEqual(buildResetLink('http://app.test', first.token), `http://app.test/#reset=${first.token}`);
  const email = buildResetEmail({ link: 'http://app.test/#reset=x', ttlMinutes: 30 });
  assert.ok(email.text.includes('http://app.test/#reset=x') && email.text.includes('30 minutos'));
  console.log('✅ Link usa fragmento (#) e e-mail traz o prazo de validade.');

  // Mailer de console
  let written = '';
  await createConsoleMailer((text) => { written += text; }).send({ to: 'a@b.com', subject: 'Assunto', text: 'linha 1\nlinha 2' });
  assert.ok(written.includes('Para: a@b.com') && written.includes('Assunto: Assunto') && written.includes('linha 2'));
  console.log('✅ Mailer de console escreve destinatário, assunto e corpo.');

  // Repositório em memória: substituição, uso único, expiração, usuário e sessões
  const { passwordResetRepository: resets, userRepository, sessionRepository } = createMemoryRepositories();
  const iso = (ms) => new Date(ms).toISOString();
  const t0 = Date.parse('2026-11-19T12:00:00Z');

  await resets.replaceForUser({ tokenHash: 'h1', userId: 'u1', createdAt: iso(t0), expiresAt: iso(t0 + RESET_TOKEN_TTL_MS) });
  await resets.replaceForUser({ tokenHash: 'h2', userId: 'u1', createdAt: iso(t0), expiresAt: iso(t0 + RESET_TOKEN_TTL_MS) });
  assert.strictEqual(await resets.consume('h1', iso(t0)), null, 'novo pedido invalida o anterior');
  assert.strictEqual(await resets.consume('h2', iso(t0 + 1000)), 'u1');
  assert.strictEqual(await resets.consume('h2', iso(t0 + 2000)), null, 'uso único');

  await resets.replaceForUser({ tokenHash: 'h3', userId: 'u2', createdAt: iso(t0), expiresAt: iso(t0 + RESET_TOKEN_TTL_MS) });
  assert.strictEqual(await resets.consume('h3', iso(t0 + RESET_TOKEN_TTL_MS)), null, 'expira exatamente no prazo');
  await resets.replaceForUser({ tokenHash: 'h4', userId: 'u3', createdAt: iso(t0), expiresAt: iso(t0 + RESET_TOKEN_TTL_MS) });
  assert.strictEqual(await resets.consume('h4', iso(t0 + RESET_TOKEN_TTL_MS - 1)), 'u3');
  assert.strictEqual(await resets.consume('inexistente', iso(t0)), null);
  console.log('✅ Repositório: um token ativo por usuário, uso único e expiração.');

  const user = { id: 'u1', email: 'a@b.com', passwordHash: 'old', passwordSalt: 'olds', status: 'active' };
  await userRepository.create(user);
  const updated = await userRepository.updatePassword('u1', { passwordHash: 'new', passwordSalt: 'news' });
  assert.strictEqual(updated.passwordHash, 'new');
  assert.strictEqual((await userRepository.findByEmail('a@b.com')).passwordSalt, 'news');
  assert.strictEqual(await userRepository.updatePassword('nope', { passwordHash: 'x', passwordSalt: 'y' }), null);

  await sessionRepository.create({ id: 's1', userId: 'u1', csrfToken: 'c', activeBandId: null, createdAt: iso(t0), expiresAt: iso(t0 + 1000) });
  await sessionRepository.create({ id: 's2', userId: 'u9', csrfToken: 'c', activeBandId: null, createdAt: iso(t0), expiresAt: iso(t0 + 1000) });
  await sessionRepository.deleteByUserId('u1');
  assert.strictEqual(await sessionRepository.findById('s1'), null);
  assert.ok(await sessionRepository.findById('s2'));
  console.log('✅ Troca de senha e encerramento das sessões do usuário.');

  console.log('\n🎉 Todos os testes unitários da redefinição de senha passaram com sucesso!');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
