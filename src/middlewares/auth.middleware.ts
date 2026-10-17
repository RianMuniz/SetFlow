import { Request, Response, NextFunction } from 'express';

/**
 * Middleware stub de autenticação.
 * - Para integração com SPEC-001, substitua pela validação de token/session.
 * - Atualmente, espera header 'x-user-id' para facilitar testes.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = req.header('x-user-id');
  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado (use x-user-id no header para testes)' });
  }
  (req as any).userId = userId;
  next();
}
