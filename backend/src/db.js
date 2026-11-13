import pg from 'pg';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendEnv = path.join(backendRoot, '.env');

if (existsSync(backendEnv)) {
  const { error } = dotenv.config({ path: backendEnv });
  if (error) throw error;
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set.');
}

if (process.env.NODE_ENV !== 'production') {
  let databaseHost;
  try {
    databaseHost = new URL(process.env.DATABASE_URL).hostname;
  } catch {
    throw new Error('Local development requires DATABASE_URL to be a PostgreSQL URL for localhost.');
  }

  if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseHost)) {
    throw new Error('Local development only connects to PostgreSQL on this machine. Configure backend/.env; remote databases are reserved for production.');
  }
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
