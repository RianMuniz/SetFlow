import { Request, Response } from 'express';
import * as service from '../services/bandas.service';

export async function createBandHandler(req: Request, res: Response) {
  const usuarioId = (req as any).userId;
  const { nome } = req.body;
  try {
    const b = await service.criarBanda(nome, usuarioId);
    return res.status(201).json(b);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message || 'Erro' });
  }
}

export async function listBandsHandler(req: Request, res: Response) {
  const usuarioId = (req as any).userId;
  const bands = await service.listarBandas(usuarioId);
  res.json(bands);
}

export async function addMemberHandler(req: Request, res: Response) {
  const usuarioId = (req as any).userId;
  const { usuarioId: targetUsuarioId, papel } = req.body;
  const bandaId = req.params.id;
  try {
    const member = await service.adicionarMembro(bandaId, targetUsuarioId, papel, usuarioId);
    res.status(201).json(member);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Erro' });
  }
}

export async function setActiveBandHandler(req: Request, res: Response) {
  const usuarioId = (req as any).userId;
  const { bandaId } = req.body;
  try {
    const result = await service.alternarContexto(usuarioId, bandaId);
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Erro' });
  }
}
