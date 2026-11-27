const express = require('express');
const { createError } = require('./httpErrors');
const { createMusic, setBandThreshold } = require('./musicService');
const {
  MAX_CHORD_FILE_BYTES,
  detectChordFileType,
  sanitizeFileName,
  contentDispositionFor
} = require('./chordFile');

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

  function musicPayload(request, bandId, id, current = null) {
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
        // Edição sem o campo preserva o texto antigo; a cifra em arquivo tem rota própria.
        cifraAnexo: body.cifraAnexo !== undefined ? body.cifraAnexo : (current ? current.cifraAnexo : undefined)
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

      const song = await musicRepository.update(musicPayload(request, band.id, current.id, current));
      response.status(200).json({ music: song });
    } catch (error) {
      next(error);
    }
  });

  // Cifra em arquivo (RF-05/RF-15): corpo bruto, tipo decidido pelo conteúdo, até 5 MB.
  // O nome original vai no cabeçalho X-File-Name (URL-encoded).
  const receiveChordFile = express.raw({ type: () => true, limit: MAX_CHORD_FILE_BYTES });

  router.put('/musicas/:musicId/cifra', receiveChordFile, async (request, response, next) => {
    try {
      const band = await loadBand(request);
      requireLeader(band);
      const current = await musicRepository.findForBand(request.params.musicId, band.id);
      if (!current) {
        throw createError(404, 'MUSIC_NOT_FOUND', 'Música não encontrada.');
      }

      const content = request.body;
      if (!Buffer.isBuffer(content) || content.length === 0) {
        throw createError(400, 'VALIDATION_ERROR', 'Envie o arquivo da cifra no corpo da requisição.');
      }

      const type = detectChordFileType(content);
      if (!type) {
        throw createError(415, 'UNSUPPORTED_FILE_TYPE', 'Formato não suportado. Use PDF, PNG, JPG ou TXT.');
      }

      const cifraArquivo = await musicRepository.saveChordFile({
        musicId: current.id,
        bandId: band.id,
        fileName: sanitizeFileName(request.get('x-file-name'), type),
        contentType: type,
        content
      });
      response.status(200).json({ cifraArquivo });
    } catch (error) {
      next(error);
    }
  });

  router.get('/musicas/:musicId/cifra', async (request, response, next) => {
    try {
      const band = await loadBand(request);
      const file = await musicRepository.findChordFile(request.params.musicId, band.id);
      if (!file) {
        throw createError(404, 'CHORD_FILE_NOT_FOUND', 'Esta música não possui cifra anexada.');
      }

      response.status(200);
      response.set({
        'Content-Type': file.tipo === 'text/plain' ? 'text/plain; charset=utf-8' : file.tipo,
        'Content-Length': String(file.conteudo.length),
        'Content-Disposition': contentDispositionFor(file.nome),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store'
      });
      response.end(file.conteudo);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/musicas/:musicId/cifra', async (request, response, next) => {
    try {
      const band = await loadBand(request);
      requireLeader(band);
      const removed = await musicRepository.deleteChordFile(request.params.musicId, band.id);
      if (!removed) {
        throw createError(404, 'CHORD_FILE_NOT_FOUND', 'Esta música não possui cifra anexada.');
      }

      response.status(200).json({ cifraArquivo: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createMusicRouter };
