import express from 'express';
import bandasRouter, { contextoRouter } from './routes/bandas.routes';
import { authMiddleware } from './middlewares/auth.middleware';
import { contextMiddleware } from './middlewares/context.middleware';

const app = express();
app.use(express.json());

// Middleware de autenticação (stub/integracao com SPEC-001)
app.use(authMiddleware);
// Middleware de contexto (injeta bandaAtiva quando aplicavel)
app.use(contextMiddleware);

// Rotas
app.use('/bandas', bandasRouter);
app.use('/contexto', contextoRouter);

// erro genérico
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

export default app;
