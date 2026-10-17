const { createUser, verifyPassword } = require('./authService');

const NICKNAME_MIN_LENGTH = 3;
const NICKNAME_MAX_LENGTH = 30;
const BAND_NAME_MIN_LENGTH = 2;
const BAND_NAME_MAX_LENGTH = 80;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeNickname(nickname) {
  return String(nickname || '').trim().toLowerCase();
}

function normalizeBandName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function sanitizeUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    nickname: row.nickname,
    email: row.email,
    status: row.status,
    createdAt: row.created_at
  };
}

function sanitizeBand(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    memberCount: Number(row.member_count || 0),
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id
  };
}

function createIdGenerator(prefix) {
  let counter = 1;
  return () => `${prefix}-${counter++}`;
}

function createPostgresDataAccess(options = {}) {
  const pool = options.pool;

  if (!pool || typeof pool.query !== 'function') {
    throw new Error('Pool PostgreSQL inválido para createPostgresDataAccess.');
  }

  const generateUserId = options.generateUserId || createIdGenerator('u');
  const generateBandId = options.generateBandId || createIdGenerator('b');
  const generateMemberId = options.generateMemberId || createIdGenerator('m');

  async function registerUser({ nickname, email, password }) {
    const userId = generateUserId();
    const normalizedEmail = normalizeEmail(email);
    const normalizedNickname = normalizeNickname(nickname);

    const user = createUser({
      id: userId,
      nickname,
      email: normalizedEmail,
      password,
      status: 'active'
    });

    const query = `
      INSERT INTO users (id, nickname, nickname_normalized, email, password_hash, password_salt, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, nickname, email, status, created_at
    `;

    try {
      const result = await pool.query(query, [
        user.id,
        user.nickname,
        normalizedNickname,
        user.email,
        user.passwordHash,
        user.passwordSalt,
        user.status
      ]);
      return sanitizeUser(result.rows[0]);
    } catch (error) {
      if (error && error.code === '23505') {
        if (String(error.constraint || '').includes('nickname')) {
          error.domainCode = 'NICKNAME_ALREADY_EXISTS';
          return Promise.reject(error);
        }

        if (String(error.constraint || '').includes('email')) {
          error.domainCode = 'EMAIL_ALREADY_EXISTS';
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }
  }

  async function findUserAuthByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    const result = await pool.query(
      `SELECT id, nickname, email, password_hash, password_salt, status, created_at
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      nickname: row.nickname,
      email: row.email,
      passwordHash: row.password_hash,
      passwordSalt: row.password_salt,
      status: row.status,
      createdAt: row.created_at
    };
  }

  async function findUserByNickname(nickname) {
    const normalizedNickname = normalizeNickname(nickname);
    const result = await pool.query(
      `SELECT id, nickname, email, status, created_at
       FROM users
       WHERE nickname_normalized = $1`,
      [normalizedNickname]
    );

    return sanitizeUser(result.rows[0]);
  }

  async function findUserById(userId) {
    const result = await pool.query(
      `SELECT id, nickname, email, status, created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    return sanitizeUser(result.rows[0]);
  }

  async function createBandWithLeader({ userId, name, failBeforeLeaderInsert = false }) {
    const client = await pool.connect();
    const bandId = generateBandId();
    const memberId = generateMemberId();

    try {
      await client.query('BEGIN');
      const insertBand = await client.query(
        `INSERT INTO bands (id, name, name_normalized, created_by_user_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, created_by_user_id, created_at`,
        [bandId, String(name || '').trim(), normalizeBandName(name), userId]
      );

      if (failBeforeLeaderInsert) {
        throw new Error('SIMULATED_LEADER_INSERT_FAILURE');
      }

      await client.query(
        `INSERT INTO band_members (id, band_id, user_id, role)
         VALUES ($1, $2, $3, 'leader')`,
        [memberId, bandId, userId]
      );

      await client.query('COMMIT');
      return {
        id: insertBand.rows[0].id,
        name: insertBand.rows[0].name,
        createdByUserId: insertBand.rows[0].created_by_user_id,
        createdAt: insertBand.rows[0].created_at,
        role: 'leader',
        memberCount: 1
      };
    } catch (error) {
      await client.query('ROLLBACK');

      if (error && error.code === '23505' && String(error.constraint || '').includes('bands_created_by_user_id_name_normalized_key')) {
        error.domainCode = 'BAND_NAME_ALREADY_EXISTS';
      }

      throw error;
    } finally {
      client.release();
    }
  }

  async function listBandsForUser(userId) {
    const result = await pool.query(
      `SELECT b.id, b.name, b.created_by_user_id, b.created_at, bm.role,
              (SELECT COUNT(*) FROM band_members m2 WHERE m2.band_id = b.id) AS member_count
       FROM bands b
       INNER JOIN band_members bm ON bm.band_id = b.id
       WHERE bm.user_id = $1
       ORDER BY b.created_at ASC`,
      [userId]
    );

    return result.rows.map(sanitizeBand);
  }

  async function findBandById(bandId) {
    const result = await pool.query(
      `SELECT id, name, created_by_user_id, created_at
       FROM bands
       WHERE id = $1`,
      [bandId]
    );

    return result.rows[0] || null;
  }

  async function findUserBandMembership(userId, bandId) {
    const result = await pool.query(
      `SELECT role
       FROM band_members
       WHERE user_id = $1 AND band_id = $2`,
      [userId, bandId]
    );

    return result.rows[0] || null;
  }

  async function getBandForUser(userId, bandId) {
    const result = await pool.query(
      `SELECT b.id, b.name, b.created_by_user_id, b.created_at, bm.role,
              (SELECT COUNT(*) FROM band_members m2 WHERE m2.band_id = b.id) AS member_count
       FROM bands b
       INNER JOIN band_members bm ON bm.band_id = b.id
       WHERE b.id = $1 AND bm.user_id = $2`,
      [bandId, userId]
    );

    return result.rows[0] ? sanitizeBand(result.rows[0]) : null;
  }

  async function addMemberByNickname({ bandId, actorUserId, nickname }) {
    const band = await findBandById(bandId);
    if (!band) {
      const error = new Error('Banda não encontrada.');
      error.domainCode = 'BAND_NOT_FOUND';
      throw error;
    }

    const actorMembership = await findUserBandMembership(actorUserId, bandId);
    if (!actorMembership) {
      const error = new Error('Acesso negado para esta banda.');
      error.domainCode = 'BAND_ACCESS_DENIED';
      throw error;
    }

    if (actorMembership.role !== 'leader') {
      const error = new Error('Apenas líder pode adicionar membros.');
      error.domainCode = 'LEADER_REQUIRED';
      throw error;
    }

    const targetUser = await findUserByNickname(nickname);
    if (!targetUser) {
      const error = new Error('Usuário não encontrado para o nickname informado.');
      error.domainCode = 'MEMBER_NOT_FOUND';
      throw error;
    }

    try {
      await pool.query(
        `INSERT INTO band_members (id, band_id, user_id, role)
         VALUES ($1, $2, $3, 'musico')`,
        [generateMemberId(), bandId, targetUser.id]
      );
    } catch (error) {
      if (error && error.code === '23505' && String(error.constraint || '').includes('band_members_band_id_user_id_key')) {
        error.domainCode = 'MEMBER_ALREADY_EXISTS';
      }

      throw error;
    }

    return {
      bandId,
      user: targetUser,
      role: 'musico'
    };
  }

  async function verifyUserBandLink(userId, bandId) {
    const membership = await findUserBandMembership(userId, bandId);
    return Boolean(membership);
  }

  async function authenticate({ email, password }) {
    const user = await findUserAuthByEmail(email);

    if (!user) {
      return null;
    }

    const passwordMatches = verifyPassword(password, user.passwordSalt, user.passwordHash);
    if (!passwordMatches) {
      return null;
    }

    return sanitizeUser(user);
  }

  return {
    constants: {
      NICKNAME_MIN_LENGTH,
      NICKNAME_MAX_LENGTH,
      BAND_NAME_MIN_LENGTH,
      BAND_NAME_MAX_LENGTH
    },
    normalizeEmail,
    normalizeNickname,
    normalizeBandName,
    registerUser,
    findUserById,
    findUserByNickname,
    authenticate,
    createBandWithLeader,
    listBandsForUser,
    getBandForUser,
    findBandById,
    addMemberByNickname,
    verifyUserBandLink
  };
}

module.exports = {
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
  BAND_NAME_MIN_LENGTH,
  BAND_NAME_MAX_LENGTH,
  normalizeEmail,
  normalizeNickname,
  normalizeBandName,
  createPostgresDataAccess
};
