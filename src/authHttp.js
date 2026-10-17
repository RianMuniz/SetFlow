const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { SESSION_TTL_MS } = require('./authService');
const {
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
  BAND_NAME_MIN_LENGTH,
  BAND_NAME_MAX_LENGTH,
  normalizeEmail,
  normalizeNickname,
  normalizeBandName,
  createPostgresDataAccess
} = require('./postgresDataAccess');
const { createPostgresPool } = require('./postgres');

const SESSION_COOKIE_NAME = 'setflow_session';
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_LOGIN_IP_MAX_ATTEMPTS = 20;

function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }

  const normalized = email.trim();
  if (!normalized || normalized.includes(' ')) {
    return false;
  }

  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0 || atIndex !== normalized.lastIndexOf('@') || atIndex === normalized.length - 1) {
    return false;
  }

  const domain = normalized.slice(atIndex + 1);
  const dotIndex = domain.indexOf('.');
  return dotIndex > 0 && dotIndex < domain.length - 1;
}

function validatePassword(password) {
  if (typeof password !== 'string') {
    return 'Senha inválida.';
  }

  if (password.length < 8 || password.length > 128) {
    return 'A senha deve ter entre 8 e 128 caracteres.';
  }

  return null;
}

function validateNickname(nickname) {
  if (typeof nickname !== 'string') {
    return 'Nickname inválido.';
  }

  const value = nickname.trim();
  if (value.length < NICKNAME_MIN_LENGTH || value.length > NICKNAME_MAX_LENGTH) {
    return `O nickname deve ter entre ${NICKNAME_MIN_LENGTH} e ${NICKNAME_MAX_LENGTH} caracteres.`;
  }

  if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
    return 'Nickname deve conter apenas letras, números, ponto, hífen ou underline.';
  }

  return null;
}

function validateBandName(name) {
  if (typeof name !== 'string') {
    return 'Nome da banda inválido.';
  }

  const normalized = String(name).trim();
  if (normalized.length < BAND_NAME_MIN_LENGTH || normalized.length > BAND_NAME_MAX_LENGTH) {
    return `Nome da banda deve ter entre ${BAND_NAME_MIN_LENGTH} e ${BAND_NAME_MAX_LENGTH} caracteres.`;
  }

  return null;
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const index = item.indexOf('=');
      if (index === -1) {
        return cookies;
      }

      const key = item.slice(0, index);
      const value = item.slice(index + 1);
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function sendError(response, status, code, message) {
  response.status(status).json({
    error: {
      code,
      message
    }
  });
}

function toPublicUser(user) {
  return {
    id: user.id,
    nickname: user.nickname,
    email: user.email,
    status: user.status
  };
}

function toBandPayload(band) {
  return {
    id: band.id,
    name: band.name,
    role: band.role,
    memberCount: Number(band.memberCount || 0),
    createdAt: band.createdAt
  };
}

function resolveSessionCookieOptions(isProduction) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: SESSION_TTL_MS
  };
}

function createAuthApp(options = {}) {
  const now = options.now || (() => Date.now());
  const isProduction = options.isProduction !== undefined
    ? options.isProduction
    : process.env.NODE_ENV === 'production';
  const cookieName = options.sessionCookieName || SESSION_COOKIE_NAME;
  const getClientIp = options.getClientIp || ((request) => request.ip || request.socket.remoteAddress || 'unknown');
  const sessionsById = options.sessionsById || new Map();
  const failedLogins = options.failedLogins || new Map();

  const pool = options.pool || (!options.dataAccess && options.disableDefaultPool !== true ? createPostgresPool() : null);
  const dataAccess = options.dataAccess || (pool ? createPostgresDataAccess({ pool }) : null);

  if (!dataAccess) {
    throw new Error('createAuthApp requer dataAccess ou pool PostgreSQL.');
  }

  const app = express();
  const sessionCookieOptions = resolveSessionCookieOptions(isProduction);
  const loginIpRateLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit: RATE_LIMIT_LOGIN_IP_MAX_ATTEMPTS,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (request) => getClientIp(request),
    handler: (request, response) => {
      sendError(response, 429, 'RATE_LIMIT_EXCEEDED', 'Muitas tentativas. Tente novamente mais tarde.');
    }
  });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  function getRateLimitKey(request, email) {
    return `${getClientIp(request)}|${email}`;
  }

  function isRateLimited(store, key, maxAttempts) {
    const attempt = store.get(key);
    if (!attempt) {
      return false;
    }

    if (now() - attempt.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
      store.delete(key);
      return false;
    }

    return attempt.count >= maxAttempts;
  }

  function registerFailedAttempt(store, key) {
    const timestamp = now();
    const current = store.get(key);

    if (!current || timestamp - current.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
      store.set(key, { count: 1, windowStartedAt: timestamp });
      return;
    }

    store.set(key, {
      count: current.count + 1,
      windowStartedAt: current.windowStartedAt
    });
  }

  function clearFailedAttempts(store, key) {
    store.delete(key);
  }

  function invalidateUserSessions(userId) {
    for (const [sessionId, session] of sessionsById.entries()) {
      if (session.userId === userId) {
        sessionsById.delete(sessionId);
      }
    }
  }

  function createSession(userId) {
    invalidateUserSessions(userId);

    const timestamp = now();
    const sessionId = crypto.randomBytes(32).toString('hex');
    const session = {
      id: sessionId,
      userId,
      activeBandId: null,
      createdAt: new Date(timestamp).toISOString(),
      expiresAt: new Date(timestamp + SESSION_TTL_MS).toISOString()
    };

    sessionsById.set(sessionId, session);
    return session;
  }

  async function readSessionFromRequest(request) {
    const cookies = parseCookies(request.headers.cookie);
    const sessionId = cookies[cookieName];

    if (!sessionId) {
      throw createError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
    }

    const session = sessionsById.get(sessionId);
    if (!session) {
      throw createError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
    }

    const expiresAt = new Date(session.expiresAt).getTime();
    if (Number.isNaN(expiresAt) || now() > expiresAt) {
      sessionsById.delete(sessionId);
      throw createError(401, 'SESSION_EXPIRED', 'Sessão expirada.');
    }

    const user = await dataAccess.findUserById(session.userId);
    if (!user) {
      sessionsById.delete(sessionId);
      throw createError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
    }

    if (user.status !== 'active') {
      sessionsById.delete(sessionId);
      throw createError(403, 'ACCOUNT_INACTIVE', 'Conta inativa ou bloqueada.');
    }

    if (session.activeBandId) {
      const hasLink = await dataAccess.verifyUserBandLink(user.id, session.activeBandId);
      if (!hasLink) {
        session.activeBandId = null;
      }
    }

    return { sessionId, session, user };
  }

  function mapDatabaseError(error) {
    if (error && error.code) {
      return error;
    }

    return createError(500, 'DATABASE_ERROR', 'Erro ao acessar banco de dados.');
  }

  function assertRegisterPayload(body) {
    if (!body || typeof body !== 'object') {
      throw createError(400, 'VALIDATION_ERROR', 'Payload JSON obrigatório.');
    }

    const nickname = String(body.nickname || '').trim();
    const email = normalizeEmail(body.email);
    const password = body.password;

    const nicknameError = validateNickname(nickname);
    if (nicknameError) {
      throw createError(400, 'VALIDATION_ERROR', nicknameError);
    }

    if (!isValidEmail(email)) {
      throw createError(400, 'VALIDATION_ERROR', 'E-mail inválido.');
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      throw createError(400, 'VALIDATION_ERROR', passwordError);
    }

    return { nickname, email, password };
  }

  function assertLoginPayload(body) {
    if (!body || typeof body !== 'object') {
      throw createError(400, 'VALIDATION_ERROR', 'Payload JSON obrigatório.');
    }

    const email = normalizeEmail(body.email);
    const password = body.password;

    if (!isValidEmail(email) || typeof password !== 'string') {
      throw createError(400, 'VALIDATION_ERROR', 'Credenciais inválidas.');
    }

    return { email, password };
  }

  app.post('/api/auth/register', async (request, response, next) => {
    try {
      const { nickname, email, password } = assertRegisterPayload(request.body);

      const user = await dataAccess.registerUser({ nickname, email, password });
      const session = createSession(user.id);
      response.cookie(cookieName, session.id, sessionCookieOptions);

      response.status(201).json({ user: toPublicUser(user) });
    } catch (error) {
      if (error && error.domainCode === 'EMAIL_ALREADY_EXISTS') {
        next(createError(409, 'EMAIL_ALREADY_EXISTS', 'E-mail já cadastrado.'));
        return;
      }

      if (error && error.domainCode === 'NICKNAME_ALREADY_EXISTS') {
        next(createError(409, 'NICKNAME_ALREADY_EXISTS', 'Nickname já cadastrado.'));
        return;
      }

      next(mapDatabaseError(error));
    }
  });

  app.post('/api/auth/login', loginIpRateLimiter, async (request, response, next) => {
    try {
      const { email, password } = assertLoginPayload(request.body);
      const rateLimitKey = getRateLimitKey(request, email);

      if (isRateLimited(failedLogins, rateLimitKey, RATE_LIMIT_MAX_ATTEMPTS)) {
        throw createError(429, 'RATE_LIMIT_EXCEEDED', 'Muitas tentativas. Tente novamente mais tarde.');
      }

      const authResult = await dataAccess.authenticate({ email, password });
      if (!authResult) {
        registerFailedAttempt(failedLogins, rateLimitKey);
        throw createError(401, 'INVALID_CREDENTIALS', 'Credenciais inválidas.');
      }

      if (authResult.status !== 'active') {
        throw createError(403, 'ACCOUNT_INACTIVE', 'Conta inativa ou bloqueada.');
      }

      clearFailedAttempts(failedLogins, rateLimitKey);
      const session = createSession(authResult.id);
      response.cookie(cookieName, session.id, sessionCookieOptions);

      response.status(200).json({ user: toPublicUser(authResult) });
    } catch (error) {
      next(mapDatabaseError(error));
    }
  });

  app.post('/api/auth/logout', (request, response) => {
    const cookies = parseCookies(request.headers.cookie);
    const sessionId = cookies[cookieName];

    if (sessionId) {
      sessionsById.delete(sessionId);
    }

    response.clearCookie(cookieName, {
      httpOnly: sessionCookieOptions.httpOnly,
      sameSite: sessionCookieOptions.sameSite,
      secure: sessionCookieOptions.secure,
      path: sessionCookieOptions.path
    });

    response.status(200).json({ success: true });
  });

  app.get('/api/auth/me', async (request, response, next) => {
    try {
      const { session, user } = await readSessionFromRequest(request);
      response.status(200).json({ user: toPublicUser(user), activeBandId: session.activeBandId });
    } catch (error) {
      const clearOnAuthError = error.code === 'AUTHENTICATION_REQUIRED'
        || error.code === 'SESSION_EXPIRED'
        || error.code === 'ACCOUNT_INACTIVE';

      if (clearOnAuthError) {
        response.clearCookie(cookieName, {
          httpOnly: sessionCookieOptions.httpOnly,
          sameSite: sessionCookieOptions.sameSite,
          secure: sessionCookieOptions.secure,
          path: sessionCookieOptions.path
        });
      }

      next(error);
    }
  });

  app.post('/api/bandas', async (request, response, next) => {
    try {
      const { session, user } = await readSessionFromRequest(request);
      const name = request && request.body ? request.body.name : undefined;
      const validationError = validateBandName(name);
      if (validationError) {
        throw createError(400, 'VALIDATION_ERROR', validationError);
      }

      const failBeforeLeaderInsert = Boolean(options.allowTestFailureInjection) && request.headers['x-setflow-test-fail-leader-insert'] === '1';
      const band = await dataAccess.createBandWithLeader({ userId: user.id, name, failBeforeLeaderInsert });
      session.activeBandId = band.id;

      response.status(201).json({ band: toBandPayload(band), activeBandId: session.activeBandId });
    } catch (error) {
      if (error && error.domainCode === 'BAND_NAME_ALREADY_EXISTS') {
        next(createError(409, 'BAND_NAME_ALREADY_EXISTS', 'Você já possui uma banda com esse nome.'));
        return;
      }

      if (error && error.message === 'SIMULATED_LEADER_INSERT_FAILURE') {
        next(createError(500, 'DATABASE_ERROR', 'Erro ao criar banda.'));
        return;
      }

      next(mapDatabaseError(error));
    }
  });

  app.get('/api/bandas', async (request, response, next) => {
    try {
      const { session, user } = await readSessionFromRequest(request);
      const bands = await dataAccess.listBandsForUser(user.id);
      response.status(200).json({
        bands: bands.map(toBandPayload),
        activeBandId: session.activeBandId
      });
    } catch (error) {
      next(mapDatabaseError(error));
    }
  });

  app.get('/api/bandas/:bandId', async (request, response, next) => {
    try {
      const { user } = await readSessionFromRequest(request);
      const bandId = request.params.bandId;
      const band = await dataAccess.getBandForUser(user.id, bandId);

      if (band) {
        response.status(200).json({ band: toBandPayload(band) });
        return;
      }

      const existingBand = await dataAccess.findBandById(bandId);
      if (!existingBand) {
        throw createError(404, 'BAND_NOT_FOUND', 'Banda não encontrada.');
      }

      throw createError(403, 'BAND_ACCESS_DENIED', 'Acesso negado para esta banda.');
    } catch (error) {
      next(mapDatabaseError(error));
    }
  });

  app.post('/api/bandas/:bandId/membros', async (request, response, next) => {
    try {
      const { user } = await readSessionFromRequest(request);
      const nickname = String((request.body || {}).nickname || '').trim();
      const nicknameError = validateNickname(nickname);
      if (nicknameError) {
        throw createError(400, 'VALIDATION_ERROR', nicknameError);
      }

      const result = await dataAccess.addMemberByNickname({
        bandId: request.params.bandId,
        actorUserId: user.id,
        nickname
      });

      response.status(201).json({
        member: {
          bandId: result.bandId,
          user: toPublicUser(result.user),
          role: result.role
        }
      });
    } catch (error) {
      if (error && error.domainCode === 'BAND_NOT_FOUND') {
        next(createError(404, 'BAND_NOT_FOUND', 'Banda não encontrada.'));
        return;
      }

      if (error && error.domainCode === 'BAND_ACCESS_DENIED') {
        next(createError(403, 'BAND_ACCESS_DENIED', 'Acesso negado para esta banda.'));
        return;
      }

      if (error && error.domainCode === 'LEADER_REQUIRED') {
        next(createError(403, 'LEADER_REQUIRED', 'Apenas líder pode adicionar membros.'));
        return;
      }

      if (error && error.domainCode === 'MEMBER_NOT_FOUND') {
        next(createError(404, 'MEMBER_NOT_FOUND', 'Usuário não encontrado para o nickname informado.'));
        return;
      }

      if (error && error.domainCode === 'MEMBER_ALREADY_EXISTS') {
        next(createError(409, 'MEMBER_ALREADY_EXISTS', 'Usuário já pertence à banda.'));
        return;
      }

      next(mapDatabaseError(error));
    }
  });

  app.post('/api/bandas/:bandId/ativa', async (request, response, next) => {
    try {
      const { session, user } = await readSessionFromRequest(request);
      const bandId = request.params.bandId;
      const band = await dataAccess.findBandById(bandId);
      if (!band) {
        throw createError(404, 'BAND_NOT_FOUND', 'Banda não encontrada.');
      }

      const hasLink = await dataAccess.verifyUserBandLink(user.id, bandId);
      if (!hasLink) {
        throw createError(403, 'BAND_ACCESS_DENIED', 'Acesso negado para esta banda.');
      }

      session.activeBandId = bandId;
      response.status(200).json({ activeBandId: bandId });
    } catch (error) {
      next(mapDatabaseError(error));
    }
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    const isJsonSyntaxError = error instanceof SyntaxError && error.status === 400 && 'body' in error;
    if (isJsonSyntaxError) {
      sendError(response, 400, 'VALIDATION_ERROR', 'JSON inválido.');
      return;
    }

    if (error && error.code && error.status) {
      sendError(response, error.status, error.code, error.message);
      return;
    }

    sendError(response, 500, 'DATABASE_ERROR', 'Erro ao acessar banco de dados.');
  });

  return app;
}

module.exports = {
  SESSION_COOKIE_NAME,
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_LOGIN_IP_MAX_ATTEMPTS,
  RATE_LIMIT_WINDOW_MS,
  createAuthApp,
  normalizeEmail,
  normalizeNickname,
  normalizeBandName,
  isValidEmail,
  validatePassword,
  validateNickname,
  validateBandName
};
