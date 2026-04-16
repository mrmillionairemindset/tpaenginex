/**
 * Script to create a complete test order with all fields
 * Run with: npx tsx scripts/create-full-test-order.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('🔄 Creating complete test order with all fields...\n');

  const { db } = await import('../src/db/client');
  const { orders, persons, organizations, users } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { appendOrderToSheet } = await import('../src/integrations/sheets');

  try {
    // Find Acme Corp
    const testOrg = await db.query.organizations.findFirst({
      where: eq(organizations.name, 'Acme Corp'),
    });

    if (!testOrg) {
      console.error('❌ Test organization not found');
      process.exit(1);
    }

    console.log(`✅ Found organization: ${testOrg.name}`);

    // Find employer admin user
    const testUser = await db.query.users.findFirst({
      where: eq(users.email, 'employer-admin@example.com'),
    });

    if (!testUser) {
      console.error('❌ Test user not found');
      process.exit(1);
    }

    console.log(`✅ Found user: ${testUser.email}`);

    // Create test candidate with complete information
    console.log('\n📝 Creating test candidate with full details...');
    const [candidate] = await db.insert(persons).values({
      orgId: testOrg.id,
      tpaOrgId: testOrg.tpaOrgId ?? testOrg.id,
      firstName: 'Sarah',
      lastName: 'Johnson',
      dob: '03/15/1988',
      ssnLast4: '5678',
      phone: '512-555-9876',
      email: 'sarah.johnson@example.com',
      address: '456 Oak Street, Apt 2B',
      city: 'Austin',
      state: 'TX',
      zip: '78704',
    } as typeof persons.$inferInsert).returning();

    console.log(`✅ Created candidate: ${candidate.firstName} ${candidate.lastName}`);
    console.log(`   DOB: ${candidate.dob}`);
    console.log(`   SSN Last 4: ${candidate.ssnLast4}`);
    console.log(`   Email: ${candidate.email}`);
    console.log(`   Phone: ${candidate.phone}`);
    console.log(`   Address: ${candidate.address}`);
    console.log(`   City: ${candidate.city}, ${candidate.state} ${candidate.zip}`);

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Create order with all details
    console.log('\n📝 Creating order...');
    const [order] = await db.insert(orders).values({
      orgId: testOrg.id,
      tpaOrgId: testOrg.tpaOrgId ?? testOrg.id,
      personId: candidate.id,
      orderNumber,
      testType: '5-Panel Drug Test + Physical Exam',
      urgency: 'rush',
      jobsiteLocation: 'Main Office - 789 Congress Ave, Suite 500, Austin, TX 78701',
      needsMask: true,
      maskSize: 'Large',
      requestedBy: testUser.id,
      notes: 'Priority candidate - needs results by Friday. Previous injury to left shoulder, may need accommodation.',
      status: 'new',
    } as typeof orders.$inferInsert).returning();

    console.log(`✅ Created order: ${order.orderNumber}`);
    console.log(`   Test Type: ${order.testType}`);
    console.log(`   Urgency: ${order.urgency}`);
    console.log(`   Jobsite: ${order.jobsiteLocation}`);
    console.log(`   Needs Mask: ${order.needsMask ? 'Yes' : 'No'}`);
    console.log(`   Mask Size: ${order.maskSize}`);
    console.log(`   Notes: ${order.notes}`);

    // Sync to Google Sheets with ALL fields
    console.log('\n📊 Syncing to Google Sheets with all 19 columns...');
    const rowId = await appendOrderToSheet({
      orderNumber: order.orderNumber,
      personFirstName: candidate.firstName,
      personLastName: candidate.lastName,
      personDOB: candidate.dob,
      personSSNLast4: candidate.ssnLast4,
      personEmail: candidate.email,
      personPhone: candidate.phone,
      personAddress: candidate.address ?? '',
      personCity: candidate.city ?? '',
      personState: candidate.state ?? '',
      personZip: candidate.zip ?? '',
      testType: order.testType,
      urgency: order.urgency || 'standard',
      jobsiteLocation: order.jobsiteLocation,
      needsMask: order.needsMask,
      maskSize: order.maskSize ?? undefined,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      notes: order.notes ?? undefined,
    });

    if (rowId) {
      console.log(`✅ Order synced to Google Sheet at row ${rowId}`);

      // Update order with external row ID
      await db.update(orders)
        .set({ externalRowId: rowId } as Partial<typeof orders.$inferInsert>)
        .where(eq(orders.id, order.id));

      console.log(`✅ Updated order with externalRowId: ${rowId}`);
    }

    console.log('\n🎉 Complete test order created successfully!');
    console.log('\n📋 Summary:');
    console.log(`   Order Number: ${order.orderNumber}`);
    console.log(`   Candidate: ${candidate.firstName} ${candidate.lastName}`);
    console.log(`   DOB: ${candidate.dob} | SSN: ***-**-${candidate.ssnLast4}`);
    console.log(`   Contact: ${candidate.email} | ${candidate.phone}`);
    console.log(`   Address: ${candidate.address}, ${candidate.city}, ${candidate.state} ${candidate.zip}`);
    console.log(`   Test: ${order.testType} (${order.urgency})`);
    console.log(`   Location: ${order.jobsiteLocation}`);
    console.log(`   Mask: ${order.maskSize || 'N/A'}`);
    console.log(`   Sheet Row: ${rowId}`);
    console.log(`\n🔗 View in Google Sheet: https://docs.google.com/spreadsheets/d/${process.env.SHEETS_SPREADSHEET_ID}/edit#gid=1461919716`);

  } catch (error) {
    console.error('❌ Failed to create test order:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
