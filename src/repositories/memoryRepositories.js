// Implementação em memória dos repositórios. Usada nos testes determinísticos
// (npm test) e para preservar o modo injetável da SPEC-001. A API de produção
// (src/server.js) usa sempre PostgreSQL.
const { DuplicateError } = require('./errors');

function createMemoryRepositories(options = {}) {
  const usersByEmail = options.usersByEmail || new Map();
  const usersById = options.usersById || new Map();
  const bands = new Map();
  const members = [];
  const music = new Map();
  const setlists = new Map();
  const setlistItems = new Map();
  const mastery = new Map();
  const sessions = new Map();

  async function findUserByNickname(nicknameNormalized) {
    for (const user of usersById.values()) {
      if (user.nicknameNormalized && user.nicknameNormalized === nicknameNormalized) {
        return user;
      }
    }
    return null;
  }

  const userRepository = {
    async findByEmail(email) {
      return usersByEmail.get(email) || null;
    },

    async findById(id) {
      return usersById.get(id) || null;
    },

    findByNickname: findUserByNickname,

    async create(user) {
      if (usersByEmail.has(user.email)) {
        throw new DuplicateError('email');
      }
      if (user.nicknameNormalized && await findUserByNickname(user.nicknameNormalized)) {
        throw new DuplicateError('nickname');
      }

      usersByEmail.set(user.email, user);
      usersById.set(user.id, user);
      return user;
    }
  };

  function toBandView(band, role) {
    return {
      id: band.id,
      name: band.name,
      role,
      memberCount: members.filter((member) => member.bandId === band.id).length,
      transitionThresholdSemitones: band.transitionThresholdSemitones
    };
  }

  const bandRepository = {
    // Banda e vínculo de líder são criados juntos (tudo ou nada).
    async createWithLeader({ bandId, memberId, name, nameNormalized, userId }) {
      for (const band of bands.values()) {
        if (band.createdByUserId === userId && band.nameNormalized === nameNormalized) {
          throw new DuplicateError('band_name');
        }
      }

      const band = {
        id: bandId,
        name,
        nameNormalized,
        transitionThresholdSemitones: 5,
        createdByUserId: userId
      };
      const leader = { id: memberId, bandId, userId, role: 'leader' };

      bands.set(band.id, band);
      members.push(leader);

      return toBandView(band, 'leader');
    },

    async listForUser(userId) {
      return members
        .filter((member) => member.userId === userId)
        .map((member) => toBandView(bands.get(member.bandId), member.role));
    },

    // null: banda inexistente. role === null: banda existe, mas o usuário não tem vínculo.
    async findForUser(bandId, userId) {
      const band = bands.get(bandId);
      if (!band) {
        return null;
      }

      const membership = members.find((member) => member.bandId === bandId && member.userId === userId);
      return toBandView(band, membership ? membership.role : null);
    },

    async listMembers(bandId) {
      return members
        .filter((member) => member.bandId === bandId)
        .map((member) => {
          const user = usersById.get(member.userId);
          return {
            id: member.id,
            userId: member.userId,
            nickname: user && user.nickname ? user.nickname : null,
            role: member.role
          };
        });
    },

    async addMember({ memberId, bandId, userId, role }) {
      if (members.some((member) => member.bandId === bandId && member.userId === userId)) {
        throw new DuplicateError('member');
      }

      members.push({ id: memberId, bandId, userId, role });
      return { id: memberId, bandId, userId, role };
    },

    async updateTransitionThreshold(bandId, threshold) {
      const band = bands.get(bandId);
      if (!band) {
        return null;
      }

      band.transitionThresholdSemitones = threshold;
      return toBandView(band, null);
    },

    // Somente para testes: simula o desaparecimento de um vínculo.
    __removeMemberForTests(bandId, userId) {
      const index = members.findIndex((member) => member.bandId === bandId && member.userId === userId);
      if (index !== -1) {
        members.splice(index, 1);
      }
    }
  };

  const musicRepository = {
    async create(song) {
      music.set(song.id, song);
      return song;
    },

    async listForBand(bandId) {
      return Array.from(music.values()).filter((song) => song.bandaId === bandId);
    },

    async findForBand(musicId, bandId) {
      const song = music.get(musicId);
      return song && song.bandaId === bandId ? song : null;
    },

    async update(song) {
      music.set(song.id, song);
      return song;
    }
  };

  const setlistRepository = {
    async createWithItems({ setlist, items }) {
      setlists.set(setlist.id, setlist);
      setlistItems.set(setlist.id, items);
      return {
        ...setlist,
        musicas: items.map((item) => ({ ...item }))
      };
    },

    async findForBand(setlistId, bandId) {
      const setlist = setlists.get(setlistId);
      if (!setlist || setlist.bandaId !== bandId) {
        return null;
      }

      return {
        ...setlist,
        musicas: (setlistItems.get(setlistId) || []).map((item) => ({ ...item }))
      };
    },

    async listConfirmedForBand(bandId) {
      return Array.from(setlists.values())
        .filter((setlist) => setlist.bandaId === bandId && setlist.estado === 'Confirmado')
        .map((setlist) => ({
          ...setlist,
          musicas: (setlistItems.get(setlist.id) || []).map((item) => ({ ...item }))
        }));
    },

    async updateOrder(setlistId, bandId, items) {
      const setlist = setlists.get(setlistId);
      if (!setlist || setlist.bandaId !== bandId) {
        return null;
      }

      setlistItems.set(setlistId, items.map((item) => ({ ...item })));
      return this.findForBand(setlistId, bandId);
    },

    async updateState(setlistId, bandId, state) {
      const setlist = setlists.get(setlistId);
      if (!setlist || setlist.bandaId !== bandId) {
        return null;
      }

      setlist.estado = state;
      return this.findForBand(setlistId, bandId);
    },

    async listPlayedForBand(bandId) {
      return Array.from(setlists.values())
        .filter((setlist) => setlist.bandaId === bandId && setlist.estado === 'Tocado')
        .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id))
        .map((setlist) => ({
          ...setlist,
          musicas: (setlistItems.get(setlist.id) || []).map((item) => ({ ...item }))
        }));
    }
  };

  const masteryRepository = {
    async find(userId, musicId) {
      return mastery.get(`${userId}:${musicId}`) || null;
    },

    async upsert({ id, userId, musicId, level }) {
      const key = `${userId}:${musicId}`;
      const current = mastery.get(key);
      const value = {
        id: current ? current.id : id,
        usuarioId: userId,
        musicaId: musicId,
        nivel: level
      };
      mastery.set(key, value);
      return value;
    }
  };

  const sessionRepository = {
    async create(session) {
      for (const [id, current] of sessions.entries()) {
        if (current.userId === session.userId) {
          sessions.delete(id);
        }
      }
      sessions.set(session.id, { ...session });
      return { ...session };
    },

    async findById(id) {
      const session = sessions.get(id);
      return session ? { ...session } : null;
    },

    async update(session) {
      sessions.set(session.id, { ...session });
      return { ...session };
    },

    async delete(id) {
      sessions.delete(id);
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

module.exports = { createMemoryRepositories };
