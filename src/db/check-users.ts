import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from './client';
import { users, organizations } from './schema';

async function checkUsers() {
  console.log('👥 Checking users in database...\n');

  const allOrgs = await db.select().from(organizations);
  console.log(`Organizations: ${allOrgs.length}`);
  allOrgs.forEach(org => {
    console.log(`  - ${org.name} (${org.type}) - Clerk ID: ${org.clerkOrgId}`);
  });

  console.log('');

  const allUsers = await db.select().from(users);
  console.log(`Users: ${allUsers.length}`);
  allUsers.forEach(user => {
    console.log(`  - ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`    Role: ${user.role}`);
    console.log(`    Clerk ID: ${user.clerkUserId}`);
    console.log(`    Last login: ${user.lastLoginAt}`);
  });

  console.log('\n✅ Database check complete!');
  process.exit(0);
}

checkUsers().catch(err => {
  console.error('❌ Check failed:', err);
  process.exit(1);
});
