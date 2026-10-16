const assert = require('assert');
const {
  createUser,
  authenticateUser,
  requireAuthentication,
  hashPassword
} = require('../authService');

console.log('🧪 Iniciando testes unitários da SPEC-001 (Autenticação)...\n');

(function testLoginValido() {
  const users = [
    createUser({ id: 'u-1', email: 'maria@teste.com', password: 'senha123' })
  ];

  const session = authenticateUser(users, 'maria@teste.com', 'senha123');

  assert.ok(session && session.userId === 'u-1', 'Sessão deveria ser criada para usuário válido.');
  console.log('✅ Critério 1 passou: login com credenciais válidas cria sessão.');
})();

(function testLoginInvalido() {
  const users = [
    createUser({ id: 'u-1', email: 'maria@teste.com', password: 'senha123' })
  ];

  assert.throws(() => authenticateUser(users, 'maria@teste.com', 'senhaErrada'), /Credenciais inválidas/);
  console.log('✅ Critério 2 passou: login com senha inválida é rejeitado.');
})();

(function testUsuarioBloqueado() {
  const users = [
    createUser({ id: 'u-2', email: 'joao@teste.com', password: 'senha123', status: 'blocked' })
  ];

  assert.throws(() => authenticateUser(users, 'joao@teste.com', 'senha123'), /Acesso negado/);
  console.log('✅ Critério 3 passou: usuário bloqueado não consegue fazer login.');
})();

(function testSenhasSalvasEmHash() {
  const user = createUser({ id: 'u-3', email: 'ana@teste.com', password: 'senha321' });

  assert.ok(user.passwordHash, 'Senha em hash deve existir.');
  assert.ok(user.passwordSalt, 'Salt deve existir.');
  assert.notStrictEqual(user.passwordHash, 'senha321', 'Senha não deve ser armazenada em texto claro.');
  console.log('✅ Critério 4 passou: senha armazenada em hash e não em texto claro.');
})();

(function testSessaoExpirada() {
  const users = [
    createUser({ id: 'u-4', email: 'lucas@teste.com', password: 'senha123' })
  ];

  const session = {
    userId: 'u-4',
    email: 'lucas@teste.com',
    createdAt: '2024-01-01T00:00:00.000Z',
    expiresAt: '2024-01-01T00:30:00.000Z'
  };

  assert.throws(() => requireAuthentication(session, users), /Sessão expirada/);
  console.log('✅ Critério 5 passou: sessão expirada é rejeitada.');
})();

(function testAcessoProtegidoSemAutenticacao() {
  assert.throws(() => requireAuthentication(null, []), /Autenticação necessária/);
  console.log('✅ Critério 6 passou: acesso protegido sem sessão é negado.');
})();

(function testHashPassword() {
  const { salt, hash } = hashPassword('senha123');

  assert.ok(salt, 'Salt deveria ser gerado.');
  assert.ok(hash, 'Hash deveria ser gerado.');
  console.log('✅ Critério 7 passou: hash da senha gerado corretamente.');
})();

console.log('\n🎉 Todos os testes da SPEC-001 passaram com sucesso!');
