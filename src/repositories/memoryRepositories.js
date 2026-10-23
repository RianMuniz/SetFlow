// Implementação em memória dos repositórios. Usada nos testes determinísticos
// (npm test) e para preservar o modo injetável da SPEC-001. A API de produção
// (src/server.js) usa sempre PostgreSQL.
const { DuplicateError } = require('./errors');

function createMemoryRepositories(options = {}) {
  const usersByEmail = options.usersByEmail || new Map();
  const usersById = options.usersById || new Map();
  const bands = new Map();
  const members = [];

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

    // Somente para testes: simula o desaparecimento de um vínculo.
    __removeMemberForTests(bandId, userId) {
      const index = members.findIndex((member) => member.bandId === bandId && member.userId === userId);
      if (index !== -1) {
        members.splice(index, 1);
      }
    }
  };

  return { userRepository, bandRepository };
}

module.exports = { createMemoryRepositories };
