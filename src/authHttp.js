const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { SESSION_TTL_MS, createUser, verifyPassword } = require('./authService');

const SESSION_COOKIE_NAME = 'setflow_session';
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_LOGIN_IP_MAX_ATTEMPTS = 20;
const SESSION_CHECK_MAX_ATTEMPTS = 30;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

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

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    status: user.status
  };
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
  const usersByEmail = options.usersByEmail || new Map();
  const usersById = options.usersById || new Map();
  const sessionsById = options.sessionsById || new Map();
  const failedLogins = options.failedLogins || new Map();
  const failedSessionChecks = options.failedSessionChecks || new Map();

  const now = options.now || (() => Date.now());
  const isProduction = options.isProduction !== undefined
    ? options.isProduction
    : process.env.NODE_ENV === 'production';

  const cookieName = options.sessionCookieName || SESSION_COOKIE_NAME;
  const getClientIp = options.getClientIp || ((request) => request.ip || request.socket.remoteAddress || 'unknown');

  let nextUserId = options.initialUserId || 1;
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
      createdAt: new Date(timestamp).toISOString(),
      expiresAt: new Date(timestamp + SESSION_TTL_MS).toISOString()
    };

    sessionsById.set(sessionId, session);
    return session;
  }

  function readSessionFromRequest(request) {
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

    const user = usersById.get(session.userId);
    if (!user) {
      sessionsById.delete(sessionId);
      throw createError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
    }

    if (user.status !== 'active') {
      sessionsById.delete(sessionId);
      throw createError(403, 'ACCOUNT_INACTIVE', 'Conta inativa ou bloqueada.');
    }

    return { sessionId, user };
  }

  function assertRegisterPayload(body) {
    if (!body || typeof body !== 'object') {
      throw createError(400, 'VALIDATION_ERROR', 'Payload JSON obrigatório.');
    }

    const email = normalizeEmail(body.email);
    const password = body.password;

    if (!isValidEmail(email)) {
      throw createError(400, 'VALIDATION_ERROR', 'E-mail inválido.');
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      throw createError(400, 'VALIDATION_ERROR', passwordError);
    }

    return { email, password };
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

  app.post('/api/auth/register', (request, response, next) => {
    try {
      const { email, password } = assertRegisterPayload(request.body);

      if (usersByEmail.has(email)) {
        throw createError(409, 'EMAIL_ALREADY_EXISTS', 'E-mail já cadastrado.');
      }

      const user = createUser({
        id: `u-${nextUserId++}`,
        email,
        password,
        status: 'active'
      });

      usersByEmail.set(user.email, user);
      usersById.set(user.id, user);

      const session = createSession(user.id);
      response.cookie(cookieName, session.id, sessionCookieOptions);

      response.status(201).json({
        user: toPublicUser(user)
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/login', loginIpRateLimiter, (request, response, next) => {
    try {
      const { email, password } = assertLoginPayload(request.body);
      const rateLimitKey = getRateLimitKey(request, email);

      if (isRateLimited(failedLogins, rateLimitKey, RATE_LIMIT_MAX_ATTEMPTS)) {
        throw createError(429, 'RATE_LIMIT_EXCEEDED', 'Muitas tentativas. Tente novamente mais tarde.');
      }

      const user = usersByEmail.get(email);
      if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
        registerFailedAttempt(failedLogins, rateLimitKey);
        throw createError(401, 'INVALID_CREDENTIALS', 'Credenciais inválidas.');
      }

      if (user.status !== 'active') {
        throw createError(403, 'ACCOUNT_INACTIVE', 'Conta inativa ou bloqueada.');
      }
      clearFailedAttempts(failedLogins, rateLimitKey);
      clearFailedAttempts(failedLogins, rateLimitKey);
      const session = createSession(user.id);
      response.cookie(cookieName, session.id, sessionCookieOptions);

      response.status(200).json({
        user: toPublicUser(user)
      });
    } catch (error) {
      next(error);
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

  app.get('/api/auth/me', (request, response, next) => {
    const sessionCheckKey = `me:${getClientIp(request)}`;

    try {
      if (isRateLimited(failedSessionChecks, sessionCheckKey, SESSION_CHECK_MAX_ATTEMPTS)) {
        throw createError(429, 'RATE_LIMIT_EXCEEDED', 'Muitas tentativas. Tente novamente mais tarde.');
      }

      const { user } = readSessionFromRequest(request);
      clearFailedAttempts(failedSessionChecks, sessionCheckKey);
      response.status(200).json({ user: toPublicUser(user) });
    } catch (error) {
      const clearOnAuthError = error.code === 'AUTHENTICATION_REQUIRED'
        || error.code === 'SESSION_EXPIRED'
        || error.code === 'ACCOUNT_INACTIVE';

      if (clearOnAuthError) {
        registerFailedAttempt(failedSessionChecks, sessionCheckKey);
      }

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

    sendError(response, 500, 'INTERNAL_ERROR', 'Erro interno.');
  });

  return app;
}

module.exports = {
  SESSION_COOKIE_NAME,
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_LOGIN_IP_MAX_ATTEMPTS,
  RATE_LIMIT_WINDOW_MS,
  SESSION_CHECK_MAX_ATTEMPTS,
  createAuthApp,
  normalizeEmail,
  isValidEmail,
  validatePassword
};
