import pg from 'pg';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(backendRoot, '..');

for (const envPath of [
  path.join(projectRoot, '.env.local'),
  path.join(projectRoot, '.env'),
  path.join(backendRoot, '.env'),
]) {
  if (existsSync(envPath)) {
    const { error } = dotenv.config({ path: envPath });
    if (error) throw error;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set.');
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
