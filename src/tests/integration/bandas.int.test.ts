import app from '../../src/app';
import request from 'supertest';
import { pool } from '../../src/repositories/db';
import { v4 as uuidv4 } from 'uuid';

beforeAll(async () => {
  // assume migrations already rodaram; as alternativa, criar esquema mínimo para testes
  await pool.query('BEGIN');
  // criação de um usuário de teste
  const userId = '00000000-0000-0000-0000-000000000001';
  await pool.query(
    `INSERT INTO users(id, nome, email, senha_hash, created_at) VALUES($1,$2,$3,$4,now()) ON CONFLICT DO NOTHING`,
    [userId, 'Test User', 'test@example.com', 'hash']
  );
  await pool.query('COMMIT');
});

afterAll(async () => {
  // limpar dados de teste
  await pool.query('DELETE FROM user_active_band');
  await pool.query('DELETE FROM membros');
  await pool.query('DELETE FROM bandas');
  await pool.query('DELETE FROM users WHERE id = $1', ['00000000-0000-0000-0000-000000000001']);
  await pool.end();
});

describe('SPEC-002 - integração básica', () => {
  const userId = '00000000-0000-0000-0000-000000000001';

  test('Critério 1 - criação de banda e vinculo como líder', async () => {
    const res = await request(app)
      .post('/bandas')
      .set('x-user-id', userId)
      .send({ nome: 'Banda Teste 1' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    const bandaId = res.body.id;

    // verificar membro líder
    const m = await pool.query('SELECT papel FROM membros WHERE usuario_id=$1 AND banda_id=$2', [userId, bandaId]);
    expect(m.rows.length).toBe(1);
    expect(m.rows[0].papel).toBe('Líder');
  });

  test('Critério 2 - alternância de contexto entre bandas', async () => {
    // criar segunda banda
    const res2 = await request(app)
      .post('/bandas')
      .set('x-user-id', userId)
      .send({ nome: 'Banda Teste 2' });

    expect(res2.status).toBe(201);
    const banda2 = res2.body.id;

    // alternar contexto
    const patch = await request(app)
      .patch('/contexto/ativa')
      .set('x-user-id', userId)
      .send({ bandaId: banda2 });

    expect(patch.status).toBe(200);
    expect(patch.body.bandaAtiva).toBe(banda2);
  });

  test('Critério 3 - bloqueio de banda não vinculada', async () => {
    const otherBand = uuidv4();
    const res = await request(app)
      .patch('/contexto/ativa')
      .set('x-user-id', userId)
      .send({ bandaId: otherBand });

    expect(res.status).toBe(403);
  });
});
