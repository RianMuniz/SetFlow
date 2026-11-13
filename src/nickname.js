// Regras de nickname (SPEC-001/SPEC-002).
// - 3 a 20 caracteres após trim
// - somente letras ASCII, números, ponto, hífen e sublinhado
// - comparação sem diferenciação de maiúsculas/minúsculas (nickname_normalized)
const NICKNAME_MIN_LENGTH = 3;
const NICKNAME_MAX_LENGTH = 20;
const NICKNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

function normalizeNickname(nickname) {
  return String(nickname === undefined || nickname === null ? '' : nickname).trim().toLowerCase();
}

// Retorna a mensagem de erro ou null quando válido.
function validateNickname(nickname) {
  if (typeof nickname !== 'string' || nickname.trim().length === 0) {
    return 'Nickname é obrigatório.';
  }

  const trimmed = nickname.trim();

  if (trimmed.length < NICKNAME_MIN_LENGTH || trimmed.length > NICKNAME_MAX_LENGTH) {
    return `O nickname deve ter entre ${NICKNAME_MIN_LENGTH} e ${NICKNAME_MAX_LENGTH} caracteres.`;
  }

  if (!NICKNAME_PATTERN.test(trimmed)) {
    return 'O nickname deve conter apenas letras, números, ponto, hífen ou sublinhado.';
  }

  return null;
}

module.exports = {
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
  normalizeNickname,
  validateNickname
};
