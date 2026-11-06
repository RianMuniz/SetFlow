const express = require('express');
const { createError } = require('./httpErrors');

const VALID_LEVELS = ['Não Sei', 'Preciso Revisar', 'Sei Bem'];

function createMasteryRouter({
  bandRepository,
  musicRepository,
  setlistRepository,
  masteryRepository,
  requireAuthentication,
  newId
}) {
  const router = express.Router({ mergeParams: true });
  router.use(requireAuthentication);

  function bodyOf(request) {
    return request.body && typeof request.body === 'object' ? request.body : {};
  }

  async function loadMemberBand(request) {
    const band = await bandRepository.findForUser(request.params.bandId, request.auth.user.id);
    if (!band) {
      throw createError(404, 'BAND_NOT_FOUND', 'Banda não encontrada.');
    }
    if (!band.role) {
      throw createError(403, 'BAND_ACCESS_DENIED', 'Acesso negado para esta banda.');
    }
    return band;
  }

  async function loadConfirmedSetlist(request, band) {
    const setlist = await setlistRepository.findForBand(request.params.setlistId, band.id);
    if (!setlist) {
      throw createError(404, 'SETLIST_NOT_FOUND', 'Setlist não encontrado.');
    }
    if (setlist.estado !== 'Confirmado') {
      throw createError(409, 'SETLIST_NOT_CONFIRMED', 'Apenas setlists confirmados podem ser visualizados.');
    }
    return setlist;
  }

  router.get('/setlists-confirmados', async (request, response, next) => {
    try {
      const band = await loadMemberBand(request);
      const setlists = await setlistRepository.listConfirmedForBand(band.id);
      response.status(200).json({ setlists });
    } catch (error) {
      next(error);
    }
  });

  router.get('/setlists/:setlistId/visualizacao', async (request, response, next) => {
    try {
      const band = await loadMemberBand(request);
      const setlist = await loadConfirmedSetlist(request, band);
      const musicas = [];
      for (const item of setlist.musicas) {
        const music = await musicRepository.findForBand(item.musicaId, band.id);
        if (!music) {
          throw createError(400, 'MUSIC_OUTSIDE_BAND', 'Música não pertence à banda ativa.');
        }
        const domain = await masteryRepository.find(request.auth.user.id, music.id);
        musicas.push({
          ...music,
          ordem: item.ordem,
          nivelDominio: domain ? domain.nivel : null
        });
      }
      response.status(200).json({
        setlist: {
          id: setlist.id,
          bandaId: setlist.bandaId,
          nome: setlist.nome,
          data: setlist.data,
          estado: setlist.estado,
          musicas
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/musicas/:musicId/dominio', async (request, response, next) => {
    try {
      const band = await loadMemberBand(request);
      const music = await musicRepository.findForBand(request.params.musicId, band.id);
      if (!music) {
        throw createError(404, 'MUSIC_NOT_FOUND', 'Música não encontrada.');
      }
      const level = bodyOf(request).nivel;
      if (!VALID_LEVELS.includes(level)) {
        throw createError(400, 'VALIDATION_ERROR', 'Nível de domínio inválido.');
      }
      const domain = await masteryRepository.upsert({
        id: newId('dom'),
        userId: request.auth.user.id,
        musicId: music.id,
        level
      });
      response.status(200).json({ dominio: domain });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { VALID_LEVELS, createMasteryRouter };
