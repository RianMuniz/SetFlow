// Repositórios PostgreSQL. Recebem um pool injetado (qualquer objeto com
// `query(text, params)` e `connect()` que devolva um client com `query` e `release`),
// por isso não carregam o módulo `pg` e podem ser testados com pool falso.
const { DuplicateError } = require('./errors');
const { createError } = require('../httpErrors');

const UNIQUE_VIOLATION = '23505';

const USER_COLUMNS = 'id, nickname, nickname_normalized, email, password_hash, password_salt, status, created_at';

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    nickname: row.nickname,
    nicknameNormalized: row.nickname_normalized,
    email: row.email,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    status: row.status,
    createdAt: row.created_at
  };
}

function mapBand(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role === undefined ? null : row.role,
    memberCount: Number(row.member_count),
    transitionThresholdSemitones: row.transition_threshold_semitones
  };
}

function defaultLogger(error) {
  // Nunca registra a connection string; apenas código e mensagem do erro.
  process.stderr.write(`[db] ${error && error.code ? `${error.code} ` : ''}${error && error.message ? error.message : error}\n`);
}

function createPgRepositories(pool, options = {}) {
  const logger = options.logger || defaultLogger;

  // Converte falhas inesperadas em DATABASE_ERROR sem expor detalhes ao cliente.
  async function guarded(operation) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof DuplicateError || (error && error.status && error.code)) {
        throw error;
      }

      logger(error);
      const databaseError = createError(500, 'DATABASE_ERROR', 'Erro ao acessar o banco de dados.');
      databaseError.cause = error;
      throw databaseError;
    }
  }

  const userRepository = {
    findByEmail(email) {
      return guarded(async () => {
        const { rows } = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [email]);
        return mapUser(rows[0]);
      });
    },

    findById(id) {
      return guarded(async () => {
        const { rows } = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
        return mapUser(rows[0]);
      });
    },

    findByNickname(nicknameNormalized) {
      return guarded(async () => {
        const { rows } = await pool.query(
          `SELECT ${USER_COLUMNS} FROM users WHERE nickname_normalized = $1`,
          [nicknameNormalized]
        );
        return mapUser(rows[0]);
      });
    },

    create(user) {
      return guarded(async () => {
        try {
          const { rows } = await pool.query(
            'INSERT INTO users (id, nickname, nickname_normalized, email, password_hash, password_salt, status) '
            + `VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${USER_COLUMNS}`,
            [user.id, user.nickname, user.nicknameNormalized, user.email, user.passwordHash, user.passwordSalt, user.status]
          );
          return mapUser(rows[0]);
        } catch (error) {
          if (error && error.code === UNIQUE_VIOLATION) {
            if (error.constraint === 'users_email_unique') {
              throw new DuplicateError('email');
            }
            if (error.constraint === 'users_nickname_normalized_unique') {
              throw new DuplicateError('nickname');
            }
          }
          throw error;
        }
      });
    }
  };

  const bandRepository = {
    // Banda + vínculo do criador como líder na mesma transação.
    createWithLeader({ bandId, memberId, name, nameNormalized, userId }) {
      return guarded(async () => {
        const client = await pool.connect();
        let rollbackFailed = false;

        try {
          await client.query('BEGIN');

          const { rows } = await client.query(
            'INSERT INTO bands (id, name, name_normalized, created_by_user_id) VALUES ($1, $2, $3, $4) '
            + 'RETURNING id, name, transition_threshold_semitones',
            [bandId, name, nameNormalized, userId]
          );

          await client.query(
            "INSERT INTO band_members (id, band_id, user_id, role) VALUES ($1, $2, $3, 'leader')",
            [memberId, bandId, userId]
          );

          await client.query('COMMIT');

          return mapBand({
            id: rows[0].id,
            name: rows[0].name,
            role: 'leader',
            member_count: 1,
            transition_threshold_semitones: rows[0].transition_threshold_semitones
          });
        } catch (error) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            rollbackFailed = true;
          }

          if (error && error.code === UNIQUE_VIOLATION && error.constraint === 'bands_creator_name_unique') {
            throw new DuplicateError('band_name');
          }
          throw error;
        } finally {
          client.release(rollbackFailed ? true : undefined);
        }
      });
    },

    listForUser(userId) {
      return guarded(async () => {
        const { rows } = await pool.query(
          'SELECT b.id, b.name, b.transition_threshold_semitones, bm.role, '
          + '(SELECT COUNT(*)::int FROM band_members m WHERE m.band_id = b.id) AS member_count '
          + 'FROM band_members bm JOIN bands b ON b.id = bm.band_id '
          + 'WHERE bm.user_id = $1 ORDER BY bm.created_at, b.id',
          [userId]
        );
        return rows.map(mapBand);
      });
    },

    // Uma única consulta filtrada por band_id e user_id.
    // Sem linha: banda inexistente. role null: banda existe, mas sem vínculo do usuário.
    findForUser(bandId, userId) {
      return guarded(async () => {
        const { rows } = await pool.query(
          'SELECT b.id, b.name, b.transition_threshold_semitones, bm.role, '
          + '(SELECT COUNT(*)::int FROM band_members m WHERE m.band_id = b.id) AS member_count '
          + 'FROM bands b LEFT JOIN band_members bm ON bm.band_id = b.id AND bm.user_id = $2 '
          + 'WHERE b.id = $1',
          [bandId, userId]
        );
        return rows[0] ? mapBand(rows[0]) : null;
      });
    },

    listMembers(bandId) {
      return guarded(async () => {
        const { rows } = await pool.query(
          'SELECT m.id, m.user_id, u.nickname, m.role '
          + 'FROM band_members m JOIN users u ON u.id = m.user_id '
          + 'WHERE m.band_id = $1 ORDER BY m.created_at, m.id',
          [bandId]
        );
        return rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          nickname: row.nickname,
          role: row.role
        }));
      });
    },

    addMember({ memberId, bandId, userId, role }) {
      return guarded(async () => {
        try {
          await pool.query(
            'INSERT INTO band_members (id, band_id, user_id, role) VALUES ($1, $2, $3, $4)',
            [memberId, bandId, userId, role]
          );
          return { id: memberId, bandId, userId, role };
        } catch (error) {
          if (error && error.code === UNIQUE_VIOLATION && error.constraint === 'band_members_band_user_unique') {
            throw new DuplicateError('member');
          }
          throw error;
        }
      });
    }
  };

  return { userRepository, bandRepository };
}

module.exports = { createPgRepositories };
