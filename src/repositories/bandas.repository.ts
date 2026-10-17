import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';

export async function createBand(nome: string, criadoPor: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bandaId = uuidv4();
    const insertBandText = `INSERT INTO bandas(id, nome, criado_por, created_at) VALUES($1,$2,$3,now())`;
    await client.query(insertBandText, [bandaId, nome, criadoPor]);

    const membroId = uuidv4();
    const insertMembroText = `INSERT INTO membros(id, usuario_id, banda_id, papel, criado_em) VALUES($1,$2,$3,$4,now())`;
    await client.query(insertMembroText, [membroId, criadoPor, bandaId, 'Líder']);

    await client.query('COMMIT');
    return { id: bandaId, nome, criadoPor };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getBandsByUser(usuarioId: string) {
  const res = await pool.query(
    `SELECT b.id, b.nome, m.papel
     FROM bandas b
     JOIN membros m ON m.banda_id = b.id
     WHERE m.usuario_id = $1`,
    [usuarioId]
  );
  return res.rows;
}

export async function addMember(bandaId: string, usuarioId: string, papel: string) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO membros(id, usuario_id, banda_id, papel, criado_em)
     VALUES($1,$2,$3,$4,now())`,
    [id, usuarioId, bandaId, papel]
  );
  return { id, usuarioId, bandaId, papel };
}

export async function userBelongsToBand(usuarioId: string, bandaId: string) {
  const res = await pool.query(`SELECT 1 FROM membros WHERE usuario_id=$1 AND banda_id=$2 LIMIT 1`, [usuarioId, bandaId]);
  return res.rowCount > 0;
}

export async function getMemberRole(usuarioId: string, bandaId: string) {
  const res = await pool.query(`SELECT papel FROM membros WHERE usuario_id=$1 AND banda_id=$2 LIMIT 1`, [usuarioId, bandaId]);
  return res.rows[0]?.papel ?? null;
}

export async function setActiveBand(usuarioId: string, bandaId: string) {
  // upsert
  await pool.query(
    `INSERT INTO user_active_band(usuario_id, banda_id) VALUES($1,$2)
     ON CONFLICT (usuario_id) DO UPDATE SET banda_id = EXCLUDED.banda_id`,
    [usuarioId, bandaId]
  );
}

export async function getActiveBand(usuarioId: string) {
  const res = await pool.query(`SELECT banda_id FROM user_active_band WHERE usuario_id=$1`, [usuarioId]);
  return res.rows[0]?.banda_id ?? null;
}
