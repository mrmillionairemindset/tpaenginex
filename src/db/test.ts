import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from './client';
import { organizations, sites } from './schema';

async function test() {
  console.log('📊 Testing database connection...\n');

  const orgs = await db.select().from(organizations);
  console.log(`Organizations: ${orgs.length}`);
  orgs.forEach(org => console.log(`  - ${org.name} (${org.type})`));

  console.log('');

  const testSites = await db.select().from(sites);
  console.log(`Sites: ${testSites.length}`);
  testSites.forEach(site => console.log(`  - ${site.name} in ${site.city}, ${site.state}`));

  console.log('\n✅ Database connection successful!');
  process.exit(0);
}

test().catch(err => {
  console.error('❌ Database test failed:', err);
  process.exit(1);
});
