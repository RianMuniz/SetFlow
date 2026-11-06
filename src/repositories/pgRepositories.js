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

function mapMusic(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    bandaId: row.band_id,
    titulo: row.title,
    tom: row.key,
    bpm: Number(row.bpm),
    duracaoSegundos: Number(row.duration_seconds),
    observacoes: row.notes,
    cifraAnexo: row.chord_attachment
  };
}

function mapSetlist(row, items = []) {
  if (!row) {
    return null;
  }

  function mapSession(row) {
    return {
      id: row.id,
      userId: row.user_id,
      csrfToken: row.csrf_token,
      activeBandId: row.active_band_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    };
  }

  return {
    id: row.id,
    bandaId: row.band_id,
    nome: row.name,
    data: row.event_date,
    tempoDisponivelSegundos: Number(row.available_seconds),
    estado: row.state,
    musicas: items
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
    },

    updateTransitionThreshold(bandId, threshold) {
      return guarded(async () => {
        const { rows } = await pool.query(
          'UPDATE bands SET transition_threshold_semitones = $2 WHERE id = $1 '
          + 'RETURNING id, name, transition_threshold_semitones',
          [bandId, threshold]
        );
        return rows[0] ? mapBand(Object.assign(rows[0], { role: null, member_count: 0 })) : null;
      });
    }
  };

  const musicRepository = {
    create(song) {
      return guarded(async () => {
        const { rows } = await pool.query(
          'INSERT INTO music (id, band_id, title, key, bpm, duration_seconds, notes, chord_attachment) '
          + 'VALUES ($1, $2, $3, $4, $5, $6, $7, $8) '
          + 'RETURNING id, band_id, title, key, bpm, duration_seconds, notes, chord_attachment',
          [song.id, song.bandaId, song.titulo, song.tom, song.bpm, song.duracaoSegundos, song.observacoes, song.cifraAnexo]
        );
        return mapMusic(rows[0]);
      });
    },

    listForBand(bandId) {
      return guarded(async () => {
        const { rows } = await pool.query(
          'SELECT id, band_id, title, key, bpm, duration_seconds, notes, chord_attachment '
          + 'FROM music WHERE band_id = $1 ORDER BY created_at, id',
          [bandId]
        );
        return rows.map(mapMusic);
      });
    },

    findForBand(musicId, bandId) {
      return guarded(async () => {
        const { rows } = await pool.query(
          'SELECT id, band_id, title, key, bpm, duration_seconds, notes, chord_attachment '
          + 'FROM music WHERE id = $1 AND band_id = $2',
          [musicId, bandId]
        );
        return mapMusic(rows[0]);
      });
    },

    update(song) {
      return guarded(async () => {
        const { rows } = await pool.query(
          'UPDATE music SET title = $3, key = $4, bpm = $5, duration_seconds = $6, notes = $7, chord_attachment = $8 '
          + 'WHERE id = $1 AND band_id = $2 '
          + 'RETURNING id, band_id, title, key, bpm, duration_seconds, notes, chord_attachment',
          [song.id, song.bandaId, song.titulo, song.tom, song.bpm, song.duracaoSegundos, song.observacoes, song.cifraAnexo]
        );
        return mapMusic(rows[0]);
      });
    }
  };

  const setlistRepository = {
    createWithItems({ setlist, items }) {
      return guarded(async () => {
        const client = await pool.connect();
        let rollbackFailed = false;

        try {
          await client.query('BEGIN');
          const { rows } = await client.query(
            'INSERT INTO setlists (id, band_id, name, event_date, available_seconds, state) '
            + "VALUES ($1, $2, $3, $4, $5, 'Rascunho') "
            + 'RETURNING id, band_id, name, event_date, available_seconds, state',
            [setlist.id, setlist.bandaId, setlist.nome, setlist.data, setlist.tempoDisponivelSegundos]
          );

          for (const item of items) {
            await client.query(
              'INSERT INTO setlist_items (id, setlist_id, music_id, order_position) VALUES ($1, $2, $3, $4)',
              [item.id, setlist.id, item.musicaId, item.ordem]
            );
          }

          await client.query('COMMIT');
          return mapSetlist(rows[0], items);
        } catch (error) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            rollbackFailed = true;
          }
          throw error;
        } finally {
          client.release(rollbackFailed ? true : undefined);
        }
      });
    },

    findForBand(setlistId, bandId) {
      return guarded(async () => {
        const setlistResult = await pool.query(
          'SELECT id, band_id, name, event_date, available_seconds, state '
          + 'FROM setlists WHERE id = $1 AND band_id = $2',
          [setlistId, bandId]
        );
        if (!setlistResult.rows[0]) {
          return null;
        }

        const itemsResult = await pool.query(
          'SELECT id, music_id, order_position FROM setlist_items '
          + 'WHERE setlist_id = $1 ORDER BY order_position',
          [setlistId]
        );
        return mapSetlist(setlistResult.rows[0], itemsResult.rows.map((row) => ({
          id: row.id,
          setlistId,
          musicaId: row.music_id,
          ordem: row.order_position
        })));
      });
    },

    listConfirmedForBand(bandId) {
      return guarded(async () => {
        const { rows } = await pool.query(
          "SELECT id, band_id, name, event_date, available_seconds, state FROM setlists "
          + "WHERE band_id = $1 AND state = 'Confirmado' ORDER BY event_date, id",
          [bandId]
        );
        return Promise.all(rows.map(async (row) => {
          const items = await pool.query(
            'SELECT id, music_id, order_position FROM setlist_items '
            + 'WHERE setlist_id = $1 ORDER BY order_position',
            [row.id]
          );
          return mapSetlist(row, items.rows.map((item) => ({
            id: item.id,
            setlistId: row.id,
            musicaId: item.music_id,
            ordem: item.order_position
          })));
        }));
      });
    },

    updateOrder(setlistId, bandId, items) {
      return guarded(async () => {
        const client = await pool.connect();
        let rollbackFailed = false;

        try {
          await client.query('BEGIN');
          const current = await client.query(
            'SELECT id, band_id, name, event_date, available_seconds, state '
            + 'FROM setlists WHERE id = $1 AND band_id = $2 FOR UPDATE',
            [setlistId, bandId]
          );
          if (!current.rows[0]) {
            await client.query('ROLLBACK');
            return null;
          }

          await client.query('DELETE FROM setlist_items WHERE setlist_id = $1', [setlistId]);
          for (const item of items) {
            await client.query(
              'INSERT INTO setlist_items (id, setlist_id, music_id, order_position) VALUES ($1, $2, $3, $4)',
              [item.id, setlistId, item.musicaId, item.ordem]
            );
          }
          await client.query('COMMIT');
          return mapSetlist(current.rows[0], items);
        } catch (error) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            rollbackFailed = true;
          }
          throw error;
        } finally {
          client.release(rollbackFailed ? true : undefined);
        }
      });
    },

    updateState(setlistId, bandId, state) {
      return guarded(async () => {
        const { rows } = await pool.query(
          'UPDATE setlists SET state = $3 WHERE id = $1 AND band_id = $2 '
          + 'RETURNING id, band_id, name, event_date, available_seconds, state',
          [setlistId, bandId, state]
        );
        return rows[0] ? mapSetlist(rows[0], []) : null;
      });
    },

    listPlayedForBand(bandId) {
      return guarded(async () => {
        const { rows } = await pool.query(
          "SELECT id, band_id, name, event_date, available_seconds, state FROM setlists "
          + "WHERE band_id = $1 AND state = 'Tocado' ORDER BY event_date DESC, id DESC",
          [bandId]
        );
        return Promise.all(rows.map(async (row) => {
          const items = await pool.query(
            'SELECT id, music_id, order_position FROM setlist_items '
            + 'WHERE setlist_id = $1 ORDER BY order_position',
            [row.id]
          );
          return mapSetlist(row, items.rows.map((item) => ({
            id: item.id,
            setlistId: row.id,
            musicaId: item.music_id,
            ordem: item.order_position
          })));
        }));
      });
    }
  };

  const masteryRepository = {
    find(userId, musicId) {
      return guarded(async () => {
        const { rows } = await pool.query(
          'SELECT id, user_id, music_id, level FROM music_mastery WHERE user_id = $1 AND music_id = $2',
          [userId, musicId]
        );
        return rows[0] ? {
          id: rows[0].id,
          usuarioId: rows[0].user_id,
          musicaId: rows[0].music_id,
          nivel: rows[0].level
        } : null;
      });
    },

    upsert({ id, userId, musicId, level }) {
      return guarded(async () => {
        const { rows } = await pool.query(
          'INSERT INTO music_mastery (id, user_id, music_id, level) VALUES ($1, $2, $3, $4) '
          + 'ON CONFLICT (user_id, music_id) DO UPDATE SET level = EXCLUDED.level, updated_at = now() '
          + 'RETURNING id, user_id, music_id, level',
          [id, userId, musicId, level]
        );
        return {
          id: rows[0].id,
          usuarioId: rows[0].user_id,
          musicaId: rows[0].music_id,
          nivel: rows[0].level
        };
      });
    }
  };

  const sessionRepository = {
    create(session) {
      return guarded(async () => {
        await pool.query('DELETE FROM sessions WHERE user_id = $1', [session.userId]);
        const { rows } = await pool.query(
          'INSERT INTO sessions (id, user_id, csrf_token, active_band_id, created_at, expires_at) '
          + 'VALUES ($1, $2, $3, $4, $5, $6) '
          + 'RETURNING id, user_id, csrf_token, active_band_id, created_at, expires_at',
          [
            session.id,
            session.userId,
            session.csrfToken,
            session.activeBandId,
            session.createdAt,
            session.expiresAt
          ]
        );
        return mapSession(rows[0]);
      });
    },

    findById(id) {
      return guarded(async () => {
        const { rows } = await pool.query(
          'SELECT id, user_id, csrf_token, active_band_id, created_at, expires_at '
          + 'FROM sessions WHERE id = $1',
          [id]
        );
        return rows[0] ? mapSession(rows[0]) : null;
      });
    },

    update(session) {
      return guarded(async () => {
        const { rows } = await pool.query(
          'UPDATE sessions SET active_band_id = $2 WHERE id = $1 '
          + 'RETURNING id, user_id, csrf_token, active_band_id, created_at, expires_at',
          [session.id, session.activeBandId]
        );
        return rows[0] ? mapSession(rows[0]) : null;
      });
    },

    delete(id) {
      return guarded(async () => {
        await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
      });
    }
  };

  return {
    userRepository,
    bandRepository,
    musicRepository,
    setlistRepository,
    masteryRepository,
    sessionRepository
  };
}

module.exports = { createPgRepositories };
