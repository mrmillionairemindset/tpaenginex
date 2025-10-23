import { drizzle } from 'drizzle-orm/neon-http';
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

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Neon serverless driver (HTTP)
const sql = neon(process.env.DATABASE_URL);

// Drizzle instance with schema
export const db = drizzle(sql, { schema });

// Type export
export type Database = typeof db;
