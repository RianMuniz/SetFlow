function normalizeBandName(name) {
  if (!name || String(name).trim().length === 0) {
    throw new Error('Nome da banda inválido.');
  }

  return String(name).trim();
}

function createBand({ id, name, leaderUserId }) {
  if (!id || !leaderUserId) {
    throw new Error('Dados da banda incompletos.');
  }

  const normalizedName = normalizeBandName(name);

  return {
    id,
    name: normalizedName,
    leaderUserId,
    members: [
      { userId: leaderUserId, role: 'leader' }
    ]
  };
}

function addMember({ band, actorUserId, userId, role = 'musico' }) {
  if (!band || !actorUserId || !userId) {
    throw new Error('Dados do membro incompletos.');
  }

  if (band.leaderUserId !== actorUserId) {
    throw new Error('Apenas o líder pode adicionar membros.');
  }

  if (band.members.some((member) => member.userId === userId)) {
    return band;
  }

  band.members.push({ userId, role });
  return band;
}

function getUserBands(bands, userId) {
  if (!Array.isArray(bands) || !userId) {
    return [];
  }

  return bands.filter((band) =>
    band.members.some((member) => member.userId === userId)
  );
}

function switchActiveBand({ bands, userId, bandId }) {
  const userBands = getUserBands(bands, userId);
  const selectedBand = userBands.find((band) => band.id === bandId);

  if (!selectedBand) {
    throw new Error('Usuário não pertence à banda selecionada.');
  }

  return {
    userId,
    activeBandId: bandId,
    bands: userBands
  };
}

function requireBandAccess({ bands, userId, bandId }) {
  const band = bands.find((candidate) => candidate.id === bandId);

  if (!band) {
    throw new Error('Banda inexistente.');
  }

  const userHasAccess = band.members.some((member) => member.userId === userId);

  if (!userHasAccess) {
    throw new Error('Acesso negado para esta banda.');
  }

  return band;
}

const BAND_NAME_MAX_LENGTH = 60;

// Nome exibido: trim + espaços internos colapsados.
function sanitizeBandName(name) {
  return String(name === undefined || name === null ? '' : name).replace(/\s+/g, ' ').trim();
}

// Chave de comparação (coluna name_normalized): sem diferença de maiúsculas/minúsculas.
function bandNameKey(name) {
  return sanitizeBandName(name).normalize('NFC').toLowerCase();
}

// Retorna a mensagem de erro ou null quando válido (usado pela API da SPEC-002).
function validateBandName(name) {
  if (typeof name !== 'string' || sanitizeBandName(name).length === 0) {
    return 'Nome da banda é obrigatório.';
  }

  if (sanitizeBandName(name).length > BAND_NAME_MAX_LENGTH) {
    return `O nome da banda deve ter no máximo ${BAND_NAME_MAX_LENGTH} caracteres.`;
  }

  return null;
}

module.exports = {
  BAND_NAME_MAX_LENGTH,
  sanitizeBandName,
  bandNameKey,
  validateBandName,
  createBand,
  addMember,
  getUserBands,
  switchActiveBand,
  requireBandAccess,
  normalizeBandName
};
