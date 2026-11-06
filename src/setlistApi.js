const express = require('express');
const { createError } = require('./httpErrors');
const { createSetlist } = require('./setlistDraftService');
const { sugerirOrdem, processarSetlist } = require('./setlistService');

function createSetlistRouter({
  bandRepository,
  musicRepository,
  setlistRepository,
  requireAuthentication,
  newId
}) {
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

    if (band.role !== 'leader') {
      throw createError(403, 'LEADER_REQUIRED', 'Apenas o líder pode criar setlists.');
    }

    return band;
  }

  async function buildSetlist(request, band) {
    const body = bodyOf(request);
    if (!Array.isArray(body.musicaIds)) {
      throw createError(400, 'VALIDATION_ERROR', 'musicaIds deve ser um array.');
    }

    const selectedMusic = [];
    for (const musicId of body.musicaIds) {
      const music = await musicRepository.findForBand(musicId, band.id);
      if (!music) {
        throw createError(400, 'MUSIC_OUTSIDE_BAND', 'Música não pertence à banda ativa.');
      }
      selectedMusic.push(music);
    }

    try {
      return createSetlist({
        id: newId('sl'),
        bandaId: band.id,
        nome: body.nome,
        data: body.data,
        tempoDisponivelSegundos: body.tempoDisponivelSegundos,
        liderUserId: request.auth.user.id,
        musicas: selectedMusic
      });
    } catch (error) {
      throw createError(400, 'VALIDATION_ERROR', error.message);
    }
  }

  router.post('/setlists', async (request, response, next) => {
    try {
      const band = await loadBand(request);
      const setlist = await buildSetlist(request, band);
      const saved = await setlistRepository.createWithItems({
        setlist,
        items: setlist.musicas.map((item) => ({
          id: newId('sli'),
          setlistId: setlist.id,
          musicaId: item.musicaId,
          ordem: item.ordem
        }))
      });

      response.status(201).json({ setlist: saved });
    } catch (error) {
      next(error);
    }
  });

  router.post('/setlists/:setlistId/sugestao', async (request, response, next) => {
    try {
      const band = await loadBand(request);
      const setlist = await setlistRepository.findForBand(request.params.setlistId, band.id);
      if (!setlist) {
        throw createError(404, 'SETLIST_NOT_FOUND', 'Setlist não encontrado.');
      }
      if (setlist.estado !== 'Rascunho') {
        throw createError(409, 'SETLIST_NOT_DRAFT', 'A sugestão só pode ser gerada para um rascunho.');
      }

      const musicas = [];
      for (const item of setlist.musicas) {
        const music = await musicRepository.findForBand(item.musicaId, band.id);
        if (!music) {
          throw createError(400, 'MUSIC_OUTSIDE_BAND', 'Música não pertence à banda ativa.');
        }
        musicas.push(music);
      }

      let sugestao;
      try {
        sugestao = sugerirOrdem(
          musicas,
          setlist.tempoDisponivelSegundos,
          band.transitionThresholdSemitones
        );
      } catch (error) {
        throw createError(400, 'VALIDATION_ERROR', error.message);
      }

      response.status(200).json({
        setlist: {
          id: setlist.id,
          bandaId: setlist.bandaId,
          nome: setlist.nome,
          estado: setlist.estado,
          musicas: sugestao.musicas
        },
        sugestao
      });
    } catch (error) {
      next(error);
    }
  });

  async function loadDraft(request) {
    const band = await loadBand(request);
    const setlist = await setlistRepository.findForBand(request.params.setlistId, band.id);
    if (!setlist) {
      throw createError(404, 'SETLIST_NOT_FOUND', 'Setlist não encontrado.');
    }
    return { band, setlist };
  }

  async function validateOrder(setlist, band, order) {
    if (!Array.isArray(order) || order.length !== setlist.musicas.length) {
      throw createError(400, 'INVALID_SETLIST_ORDER', 'A ordem deve conter todas as músicas do setlist.');
    }

    const expected = new Set(setlist.musicas.map((item) => item.musicaId));
    const received = new Set(order);
    if (received.size !== order.length || received.size !== expected.size
      || order.some((musicId) => !expected.has(musicId))) {
      throw createError(400, 'INVALID_SETLIST_ORDER', 'A ordem deve conter cada música uma única vez.');
    }

    const items = order.map((musicId, index) => {
      const original = setlist.musicas.find((item) => item.musicaId === musicId);
      return {
        id: original.id,
        setlistId: setlist.id,
        musicaId: musicId,
        ordem: index + 1
      };
    });

    for (const item of items) {
      if (!await musicRepository.findForBand(item.musicaId, band.id)) {
        throw createError(400, 'MUSIC_OUTSIDE_BAND', 'Música não pertence à banda ativa.');
      }
    }
    return items;
  }

  async function calculatedView(setlist, band) {
    const musicas = [];
    for (const item of setlist.musicas) {
      const music = await musicRepository.findForBand(item.musicaId, band.id);
      if (!music) {
        throw createError(400, 'MUSIC_OUTSIDE_BAND', 'Música não pertence à banda ativa.');
      }
      musicas.push(music);
    }
    const resultado = processarSetlist(
      musicas.map((music) => ({
        titulo: music.titulo,
        tom: music.tom,
        duracaoSegundos: music.duracaoSegundos
      })),
      setlist.tempoDisponivelSegundos,
      band.transitionThresholdSemitones
    );
    return {
      duracaoTotalSegundos: resultado.duracaoTotal,
      alertaTempoExcedido: resultado.alertaTempoExcedido,
      transicoes: resultado.transicoes
    };
  }

  router.put('/setlists/:setlistId/ordem', async (request, response, next) => {
    try {
      const { band, setlist } = await loadDraft(request);
      if (setlist.estado !== 'Rascunho') {
        throw createError(409, 'SETLIST_NOT_DRAFT', 'Apenas rascunhos podem ser reordenados.');
      }
      const items = await validateOrder(setlist, band, bodyOf(request).musicaIds);
      const updated = await setlistRepository.updateOrder(setlist.id, band.id, items);
      const alerts = await calculatedView(updated, band);
      response.status(200).json({ setlist: updated, alerts });
    } catch (error) {
      next(error);
    }
  });

  router.post('/setlists/:setlistId/confirmar', async (request, response, next) => {
    try {
      const { band, setlist } = await loadDraft(request);
      if (setlist.estado !== 'Rascunho') {
        throw createError(409, 'SETLIST_NOT_DRAFT', 'Apenas rascunhos podem ser confirmados.');
      }
      const updated = await setlistRepository.updateState(setlist.id, band.id, 'Confirmado');
      response.status(200).json({ setlist: updated });
    } catch (error) {
      next(error);
    }
  });

  router.post('/setlists/:setlistId/reabrir', async (request, response, next) => {
    try {
      const { band, setlist } = await loadDraft(request);
      if (setlist.estado !== 'Confirmado') {
        throw createError(409, 'SETLIST_NOT_CONFIRMED', 'Apenas setlists confirmados podem ser reabertos.');
      }
      const updated = await setlistRepository.updateState(setlist.id, band.id, 'Rascunho');
      response.status(200).json({ setlist: updated });
    } catch (error) {
      next(error);
    }
  });

  router.post('/setlists/:setlistId/tocar', async (request, response, next) => {
    try {
      const { band, setlist } = await loadDraft(request);
      if (setlist.estado !== 'Confirmado') {
        throw createError(409, 'SETLIST_NOT_CONFIRMED', 'Apenas setlists confirmados podem ser marcados como tocados.');
      }
      const updated = await setlistRepository.updateState(setlist.id, band.id, 'Tocado');
      response.status(200).json({ setlist: updated });
    } catch (error) {
      next(error);
    }
  });

  router.get('/historico', async (request, response, next) => {
    try {
      const band = await loadBand(request);
      const historico = await setlistRepository.listPlayedForBand(band.id);
      response.status(200).json({ historico });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createSetlistRouter };
