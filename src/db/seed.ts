import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from './client';
import { organizations, sites } from './schema';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Seed a test provider organization
    const [providerOrg] = await db.insert(organizations).values({
      clerkOrgId: 'org_test_provider_seed',
      name: 'RapidScreen Provider Network',
      type: 'provider',
      contactEmail: 'admin@rapidscreen.com',
      isActive: true,
    }).returning();

    console.log('✅ Created provider organization:', providerOrg.name);

    // Seed test sites
    const testSites = [
      {
        name: 'Concentra - Downtown Seattle',
        slug: 'concentra-downtown-seattle',
        providerNetwork: 'Concentra',
        address: '1200 3rd Ave, Suite 100',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
        lat: '47.6062',
        lng: '-122.3321',
        phone: '(206) 555-0100',
        testsSupported: ['drug_screen', 'DOT_physical', 'full_panel'],
        acceptsWalkIns: true,
        requiresAppointment: false,
        isActive: true,
        priority: 10,
      },
      {
        name: 'LabCorp - Bellevue',
        slug: 'labcorp-bellevue',
        providerNetwork: 'LabCorp',
        address: '1200 116th Ave NE, Suite 200',
        city: 'Bellevue',
        state: 'WA',
        zip: '98004',
        lat: '47.6149',
        lng: '-122.1872',
        phone: '(425) 555-0200',
        testsSupported: ['drug_screen', 'full_panel'],
        acceptsWalkIns: false,
        requiresAppointment: true,
        isActive: true,
        priority: 5,
      },
      {
        name: 'Quest Diagnostics - Tacoma',
        slug: 'quest-diagnostics-tacoma',
        providerNetwork: 'Quest',
        address: '1501 Pacific Ave',
        city: 'Tacoma',
        state: 'WA',
        zip: '98402',
        lat: '47.2529',
        lng: '-122.4443',
        phone: '(253) 555-0300',
        testsSupported: ['drug_screen', 'DOT_physical', 'full_panel', 'physical'],
        acceptsWalkIns: true,
        requiresAppointment: true,
        isActive: true,
        priority: 8,
      },
    ];

    await db.insert(sites).values(testSites);
    console.log(`✅ Created ${testSites.length} test sites`);

    console.log('🎉 Seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

seed()
  .catch((err) => {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
