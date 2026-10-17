import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.NODE_ENV === 'test' ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL ou TEST_DATABASE_URL não configurado');

export const pool = new Pool({ connectionString });
