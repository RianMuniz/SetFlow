// Rotas de banda da SPEC-002. Toda rota exige sessão autenticada e filtra os dados
// pelo usuário da sessão e pelo band_id da URL.
const express = require('express');
const { createError } = require('./httpErrors');
const { normalizeNickname, validateNickname } = require('./nickname');
const { sanitizeBandName, bandNameKey, validateBandName } = require('./bandService');
const { DuplicateError } = require('./repositories/errors');

function createBandRouter({ bandRepository, userRepository, requireAuthentication, newId }) {
  const router = express.Router();

  router.use(requireAuthentication);

  function bodyOf(request) {
    return request.body && typeof request.body === 'object' ? request.body : {};
  }

  // 404 BAND_NOT_FOUND: banda inexistente. 403 BAND_ACCESS_DENIED: banda existe sem vínculo.
  async function loadBandForMember(request) {
    const band = await bandRepository.findForUser(request.params.bandId, request.auth.user.id);

    if (!band) {
      throw createError(404, 'BAND_NOT_FOUND', 'Banda não encontrada.');
    }

    if (!band.role) {
      throw createError(403, 'BAND_ACCESS_DENIED', 'Acesso negado para esta banda.');
    }

    return band;
  }

  router.post('/', async (request, response, next) => {
    try {
      const { name } = bodyOf(request);
      const nameError = validateBandName(name);

      if (nameError) {
        throw createError(400, 'VALIDATION_ERROR', nameError);
      }

      let band;
      try {
        band = await bandRepository.createWithLeader({
          bandId: newId('b'),
          memberId: newId('m'),
          name: sanitizeBandName(name),
          nameNormalized: bandNameKey(name),
          userId: request.auth.user.id
        });
      } catch (error) {
        if (error instanceof DuplicateError && error.field === 'band_name') {
          throw createError(409, 'BAND_NAME_ALREADY_EXISTS', 'Você já possui uma banda com este nome.');
        }
        throw error;
      }

      request.auth.session.activeBandId = band.id;
      response.status(201).json({ band, activeBandId: band.id });
    } catch (error) {
      next(error);
    }
  });

  router.get('/', async (request, response, next) => {
    try {
      const bands = await bandRepository.listForUser(request.auth.user.id);
      let activeBandId = request.auth.session.activeBandId || null;

      // INV-004: o contexto ativo nunca aponta para banda sem vínculo.
      if (activeBandId && !bands.some((band) => band.id === activeBandId)) {
        request.auth.session.activeBandId = null;
        activeBandId = null;
      }

      response.status(200).json({ bands, activeBandId });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:bandId', async (request, response, next) => {
    try {
      const band = await loadBandForMember(request);
      const members = await bandRepository.listMembers(band.id);

      response.status(200).json({ band: Object.assign({}, band, { members }) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:bandId/membros', async (request, response, next) => {
    try {
      const band = await loadBandForMember(request);

      if (band.role !== 'leader') {
        throw createError(403, 'LEADER_REQUIRED', 'Apenas o líder pode adicionar membros.');
      }

      const { nickname } = bodyOf(request);
      const nicknameError = validateNickname(nickname);

      if (nicknameError) {
        throw createError(400, 'VALIDATION_ERROR', nicknameError);
      }

      const target = await userRepository.findByNickname(normalizeNickname(nickname));

      if (!target || target.status !== 'active') {
        throw createError(404, 'MEMBER_NOT_FOUND', 'Usuário não encontrado.');
      }

      let member;
      try {
        member = await bandRepository.addMember({
          memberId: newId('m'),
          bandId: band.id,
          userId: target.id,
          role: 'musico'
        });
      } catch (error) {
        if (error instanceof DuplicateError && error.field === 'member') {
          throw createError(409, 'MEMBER_ALREADY_EXISTS', 'Usuário já é membro desta banda.');
        }
        throw error;
      }

      response.status(201).json({
        member: {
          id: member.id,
          bandId: member.bandId,
          userId: member.userId,
          nickname: target.nickname,
          role: member.role
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:bandId/ativa', async (request, response, next) => {
    try {
      const band = await loadBandForMember(request);

      request.auth.session.activeBandId = band.id;
      response.status(200).json({ activeBandId: band.id, band });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createBandRouter };
