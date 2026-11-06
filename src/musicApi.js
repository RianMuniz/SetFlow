const express = require('express');
const { createError } = require('./httpErrors');
const { createMusic, setBandThreshold } = require('./musicService');

function createMusicRouter({ bandRepository, musicRepository, requireAuthentication, newId }) {
  const router = express.Router({ mergeParams: true });

  router.use(requireAuthentication);

  function bodyOf(request) {
    return request.body && typeof request.body === 'object' ? request.body : {};
  }

  async function loadBand(request) {
    const band = await bandRepository.findForUser(request.params.bandId, request.auth.user.id);

    if (!band) {
      throw createError(404, 'BAND_NOT_FOUND', 'Banda não encontrada.');
    }

    if (!band.role) {
      throw createError(403, 'BAND_ACCESS_DENIED', 'Acesso negado para esta banda.');
    }

    return band;
  }

  function requireLeader(band) {
    if (band.role !== 'leader') {
      throw createError(403, 'LEADER_REQUIRED', 'Apenas o líder pode alterar o repertório.');
    }
  }

  function musicPayload(request, bandId, id) {
    const body = bodyOf(request);
    try {
      return createMusic({
        id,
        bandaId: bandId,
        titulo: body.titulo,
        tom: body.tom,
        bpm: body.bpm,
        duracaoSegundos: body.duracaoSegundos,
        observacoes: body.observacoes,
        cifraAnexo: body.cifraAnexo
      });
    } catch (error) {
      throw createError(400, 'VALIDATION_ERROR', error.message);
    }
  }

  router.post('/musicas', async (request, response, next) => {
    try {
      const band = await loadBand(request);
      requireLeader(band);
      const song = await musicRepository.create(musicPayload(request, band.id, newId('m')));
      response.status(201).json({ music: song });
    } catch (error) {
      next(error);
    }
  });

  router.get('/musicas', async (request, response, next) => {
    try {
      const band = await loadBand(request);
      const music = await musicRepository.listForBand(band.id);
      response.status(200).json({ music });
    } catch (error) {
      next(error);
    }
  });

  router.put('/limiar-transicao', async (request, response, next) => {
    try {
      const band = await loadBand(request);
      requireLeader(band);

      let updated;
      try {
        updated = setBandThreshold(band, bodyOf(request).limiarTransicaoSemitons);
      } catch (error) {
        throw createError(400, 'VALIDATION_ERROR', error.message);
      }

      const saved = await bandRepository.updateTransitionThreshold(band.id, updated.limiarTransicaoSemitons);
      response.status(200).json({ band: saved || Object.assign({}, band, {
        transitionThresholdSemitones: updated.limiarTransicaoSemitons
      }) });
    } catch (error) {
      next(error);
    }
  });

  router.put('/musicas/:musicId', async (request, response, next) => {
    try {
      const band = await loadBand(request);
      requireLeader(band);
      const current = await musicRepository.findForBand(request.params.musicId, band.id);
      if (!current) {
        throw createError(404, 'MUSIC_NOT_FOUND', 'Música não encontrada.');
      }

      const song = await musicRepository.update(musicPayload(request, band.id, current.id));
      response.status(200).json({ music: song });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createMusicRouter };
