import * as repo from '../repositories/bandas.repository';

export async function criarBanda(nome: string, usuarioId: string) {
  // validações simples
  if (!nome || nome.trim().length < 2) throw { status: 400, message: 'Nome inválido' };

  // checar duplicado por usuário (invariant)
  // usamos query direta no DB: tentativa de inserir banda com mesma combinação será detectada por constraint se aplicada.
  const created = await repo.createBand(nome, usuarioId);
  return created;
}

export async function listarBandas(usuarioId: string) {
  return repo.getBandsByUser(usuarioId);
}

export async function adicionarMembro(bandaId: string, targetUsuarioId: string, papel: string, requesterUsuarioId: string) {
  // apenas líder pode adicionar membros
  const requesterRole = await repo.getMemberRole(requesterUsuarioId, bandaId);
  if (requesterRole !== 'Líder') throw { status: 403, message: 'Apenas líder pode adicionar membros' };

  // evita duplicação
  const already = await repo.userBelongsToBand(targetUsuarioId, bandaId);
  if (already) throw { status: 409, message: 'Usuário já é membro' };

  return repo.addMember(bandaId, targetUsuarioId, papel || 'Músico');
}

export async function alternarContexto(usuarioId: string, bandaId: string) {
  const belongs = await repo.userBelongsToBand(usuarioId, bandaId);
  if (!belongs) throw { status: 403, message: 'Usuário não pertence a banda' };

  await repo.setActiveBand(usuarioId, bandaId);
  return { bandaAtiva: bandaId };
}
