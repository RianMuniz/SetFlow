function normalizeSetlistName(name) {
  if (!name || String(name).trim().length === 0) {
    throw new Error('Nome do setlist inválido.');
  }

  return String(name).trim();
}

function normalizeSetlistDate(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new Error('Data do setlist inválida.');
  }

  const parsed = new Date(`${data}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== data) {
    throw new Error('Data do setlist inválida.');
  }

  return data;
}

function createSetlist({ id, bandaId, nome, data, tempoDisponivelSegundos, liderUserId, musicas = [] }) {
  if (!id || !bandaId || !liderUserId) {
    throw new Error('Dados do setlist incompletos.');
  }

  const normalizedNome = normalizeSetlistName(nome);
  const normalizedData = normalizeSetlistDate(data);

  if (!Number.isFinite(Number(tempoDisponivelSegundos)) || Number(tempoDisponivelSegundos) <= 0) {
    throw new Error('Tempo disponível inválido.');
  }

  if (!Array.isArray(musicas) || musicas.length === 0) {
    throw new Error('Setlist deve conter pelo menos uma música.');
  }

  return {
    id,
    bandaId,
    nome: normalizedNome,
    data: normalizedData,
    tempoDisponivelSegundos: Number(tempoDisponivelSegundos),
    estado: 'Rascunho',
    liderUserId,
    musicas: musicas.map((musica, index) => ({
      id: musica.id || `${id}-item-${index + 1}`,
      musicaId: musica.id,
      ordem: index + 1
    }))
  };
}

function canModifySetlist({ setlist, userId }) {
  if (!setlist || !userId) {
    throw new Error('Setlist ou usuário inválido.');
  }

  if (setlist.estado !== 'Rascunho') {
    throw new Error('Setlist não está em estado Rascunho.');
  }

  if (setlist.liderUserId !== userId) {
    throw new Error('Apenas o líder pode modificar o setlist.');
  }

  return true;
}

function addMusicToSetlist(setlist, musica) {
  if (!setlist || !musica) {
    throw new Error('Setlist ou música inválida.');
  }

  if (String(musica.bandaId) !== String(setlist.bandaId)) {
    throw new Error('Música fora da banda do setlist.');
  }

  setlist.musicas.push({
    id: `${setlist.id}-item-${setlist.musicas.length + 1}`,
    musicaId: musica.id,
    ordem: setlist.musicas.length + 1
  });

  return setlist;
}

module.exports = {
  createSetlist,
  canModifySetlist,
  addMusicToSetlist,
  normalizeSetlistName,
  normalizeSetlistDate
};
