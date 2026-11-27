// Redefinição de senha: token aleatório de 256 bits, validade curta, uso único.
// O token em texto claro só existe no link enviado ao usuário; o banco guarda o hash.
const crypto = require('crypto');

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const RESET_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function generateResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashResetToken(token) };
}

// O token vai no fragmento (#), que o navegador não envia ao servidor nem em Referer,
// evitando que ele apareça em logs de acesso.
function buildResetLink(baseUrl, token) {
  return `${String(baseUrl).replace(/\/+$/, '')}/#reset=${token}`;
}

function buildResetEmail({ link, ttlMinutes }) {
  return {
    subject: 'SetFlow — redefinição de senha',
    text: [
      'Recebemos um pedido para redefinir a senha da sua conta no SetFlow.',
      '',
      `Abra o link abaixo para criar uma nova senha (válido por ${ttlMinutes} minutos e de uso único):`,
      link,
      '',
      'Se você não fez esse pedido, ignore esta mensagem: sua senha continua a mesma.'
    ].join('\n')
  };
}

module.exports = {
  RESET_TOKEN_TTL_MS,
  RESET_TOKEN_PATTERN,
  hashResetToken,
  generateResetToken,
  buildResetLink,
  buildResetEmail
};
