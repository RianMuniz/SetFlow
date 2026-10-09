const VALID_TONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function normalizeSongTitle(title) {
  if (!title || String(title).trim().length === 0) {
    throw new Error('Título da música inválido.');
  }

  return String(title).trim();
}

function normalizeTom(tom) {
  const value = String(tom || '').trim();
  if (!VALID_TONS.includes(value)) {
    throw new Error('Tom inválido. Use notas com sustenidos (#).');
  }

  return value;
}

function createMusic({ id, bandaId, titulo, tom, bpm, duracaoSegundos, observacoes = '', cifraAnexo = '' }) {
  if (!id || !bandaId) {
    throw new Error('Dados da música incompletos.');
  }

  const normalizedTitulo = normalizeSongTitle(titulo);
  const normalizedTom = normalizeTom(tom);

  if (!Number.isFinite(Number(bpm)) || Number(bpm) <= 0) {
    throw new Error('BPM inválido.');
  }

  if (!Number.isFinite(Number(duracaoSegundos)) || Number(duracaoSegundos) <= 0) {
    throw new Error('Duração deve ser positiva.');
  }

  return {
    id,
    bandaId,
    titulo: normalizedTitulo,
    tom: normalizedTom,
    bpm: Number(bpm),
    duracaoSegundos: Number(duracaoSegundos),
    observacoes,
    cifraAnexo
  };
}

function setBandThreshold(band, threshold) {
  if (!band) {
    throw new Error('Banda inexistente.');
  }

  if (!Number.isFinite(Number(threshold)) || Number(threshold) < 0) {
    throw new Error('Limiar de transição inválido.');
  }

  band.limiarTransicaoSemitons = Number(threshold);
  return band;
}

function getBandMusic(musicas, bandaId) {
  return musicas.filter((musica) => musica.bandaId === bandaId);
}

function requireMusicInBand({ music, bandaId }) {
  if (!music) {
    throw new Error('Música inexistente.');
  }

  if (String(music.bandaId) !== String(bandaId)) {
    throw new Error('Música fora da banda ativa.');
  }

  return music;
}

module.exports = {
  VALID_TONS,
  createMusic,
  setBandThreshold,
  getBandMusic,
  requireMusicInBand,
  normalizeTom,
  normalizeSongTitle
};
