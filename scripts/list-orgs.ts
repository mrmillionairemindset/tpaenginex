/**
 * Script to list organizations
 * Run with: npx tsx scripts/list-orgs.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  const { db } = await import('../src/db/client');

  try {
    const orgs = await db.query.organizations.findMany({
      limit: 10,
    });

    console.log(`\n📋 Found ${orgs.length} organizations:\n`);
    orgs.forEach((org) => {
      console.log(`  - ${org.name} (${org.type}) - ID: ${org.id}`);
    });

    const users = await db.query.users.findMany({
      limit: 10,
    });

    console.log(`\n👥 Found ${users.length} users:\n`);
    users.forEach((user) => {
      console.log(`  - ${user.email} (${user.role}) - Org: ${user.orgId}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

main();
