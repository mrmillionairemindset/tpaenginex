/**
 * Reset database - DROP all tables and recreate with new schema
 * WARNING: This will delete ALL data!
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function resetDatabase() {
  console.log('⚠️  WARNING: This will DROP ALL TABLES and data!');
  console.log('Starting database reset...\n');

  try {
    // Drop all tables (in reverse dependency order)
    console.log('Dropping existing tables...');

    await sql`DROP TABLE IF EXISTS audit_logs CASCADE`;
    await sql`DROP TABLE IF EXISTS documents CASCADE`;
    await sql`DROP TABLE IF EXISTS appointments CASCADE`;
    await sql`DROP TABLE IF EXISTS orders CASCADE`;
    await sql`DROP TABLE IF EXISTS sites CASCADE`;
    await sql`DROP TABLE IF EXISTS candidates CASCADE`;
    await sql`DROP TABLE IF EXISTS verification_tokens CASCADE`;
    await sql`DROP TABLE IF EXISTS sessions CASCADE`;
    await sql`DROP TABLE IF EXISTS accounts CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;
    await sql`DROP TABLE IF EXISTS organizations CASCADE`;

    // Drop enums
    await sql`DROP TYPE IF EXISTS document_kind CASCADE`;
    await sql`DROP TYPE IF EXISTS appointment_status CASCADE`;
    await sql`DROP TYPE IF EXISTS order_status CASCADE`;
    await sql`DROP TYPE IF EXISTS user_role CASCADE`;
    await sql`DROP TYPE IF EXISTS organization_type CASCADE`;

    console.log('✅ All tables and enums dropped\n');
    console.log('Now run: npx drizzle-kit push\n');
    console.log('Then run: npx tsx src/db/seed-nextauth.ts\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetDatabase();
