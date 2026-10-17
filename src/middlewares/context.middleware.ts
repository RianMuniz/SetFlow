import { Request, Response, NextFunction } from 'express';
import * as repo from '../repositories/bandas.repository';

export async function contextMiddleware(req: Request, res: Response, next: NextFunction) {
  const usuarioId = (req as any).userId;
  if (!usuarioId) return next();

  // precedence: header X-Setflow-Banda-Ativa, else persisted preference
  const headerBand = req.header('x-setflow-banda-ativa');
  if (headerBand) {
    const belongs = await repo.userBelongsToBand(usuarioId, headerBand);
    if (belongs) {
      (req as any).bandaAtiva = headerBand;
      return next();
    } else {
      return res.status(403).json({ error: 'Usuario nao vinculado a banda informada no header' });
    }
  }

  const active = await repo.getActiveBand(usuarioId);
  if (active) (req as any).bandaAtiva = active;
  next();
}
