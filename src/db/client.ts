import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

// For standalone scripts (not Next.js runtime), load .env.local
if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
  try {
    const dotenv = require('dotenv');
    const path = require('path');
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  } catch (e) {
    // Ignore - Next.js handles env loading
  }
}

type DbWithSchema = NeonHttpDatabase<typeof schema>;

// Lazy database initialization to avoid build-time errors
let _db: DbWithSchema | null = null;

function getDb(): DbWithSchema {
  if (!_db) {
    // During build time, use a dummy database URL to prevent errors
    const dbUrl = process.env.DATABASE_URL || 'postgres://dummy:dummy@localhost:5432/dummy';

    // Neon serverless driver (HTTP)
    const sql = neon(dbUrl);
    // Drizzle instance with schema
    _db = drizzle(sql, { schema });
  }
  return _db;
}

// Export a proxy that lazily initializes the database
export const db = new Proxy({} as DbWithSchema, {
  get(target, prop) {
    // At runtime (not build time), verify DATABASE_URL is set
    if (typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build' && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    return (getDb() as any)[prop];
  }
});

// Type export
export type Database = typeof db;
