const crypto = require('crypto');

const SESSION_TTL_MS = 60 * 60 * 1000;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function createUser({ id, email, password, status = 'active' }) {
  if (!id || !email || !password) {
    throw new Error('Dados do usuário incompletos.');
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const { salt, hash } = hashPassword(password);

  return {
    id,
    email: normalizedEmail,
    passwordHash: hash,
    passwordSalt: salt,
    status
  };
}

function verifyPassword(password, salt, expectedHash) {
  if (!password || !salt || !expectedHash) {
    return false;
  }

  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return hash === expectedHash;
}

function createSession(user) {
  if (!user || user.status !== 'active') {
    throw new Error('Acesso negado.');
  }

  const now = Date.now();

  return {
    userId: user.id,
    email: user.email,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString()
  };
}

function authenticateUser(users, email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = users.find((candidate) => candidate.email === normalizedEmail);

  if (!user) {
    throw new Error('Credenciais inválidas.');
  }

  if (user.status !== 'active') {
    throw new Error('Acesso negado.');
  }

  const passwordMatches = verifyPassword(password, user.passwordSalt, user.passwordHash);

  if (!passwordMatches) {
    throw new Error('Credenciais inválidas.');
  }

  return createSession(user);
}

function requireAuthentication(session, users) {
  if (!session || !session.userId) {
    throw new Error('Autenticação necessária.');
  }

  const now = Date.now();
  const expiresAt = new Date(session.expiresAt).getTime();

  if (Number.isNaN(expiresAt) || now > expiresAt) {
    throw new Error('Sessão expirada.');
  }

  const user = users.find((candidate) => candidate.id === session.userId);

  if (!user || user.status !== 'active') {
    throw new Error('Autenticação necessária.');
  }

  return user;
}

module.exports = {
  SESSION_TTL_MS,
  hashPassword,
  createUser,
  verifyPassword,
  createSession,
  authenticateUser,
  requireAuthentication
};
