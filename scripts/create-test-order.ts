/**
 * Script to create a test order and verify Google Sheets sync
 * Run with: npx tsx scripts/create-test-order.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly BEFORE importing anything that uses env vars
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('🔄 Creating test order...');

  // Import after env vars are loaded
  const { db } = await import('../src/db/client');
  const { orders, candidates, organizations, users } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { appendOrderToSheet } = await import('../src/integrations/sheets');

  try {
    // Find test employer organization (Acme Corp)
    const testOrg = await db.query.organizations.findFirst({
      where: eq(organizations.name, 'Acme Corp'),
    });

    if (!testOrg) {
      console.error('❌ Test organization not found');
      process.exit(1);
    }

    console.log(`✅ Found organization: ${testOrg.name}`);

    // Find test employer user
    const testUser = await db.query.users.findFirst({
      where: eq(users.email, 'employer-admin@example.com'),
    });

    if (!testUser) {
      console.error('❌ Test user not found');
      process.exit(1);
    }

    console.log(`✅ Found user: ${testUser.email}`);

    // Create test candidate
    console.log('📝 Creating test candidate...');
    const [candidate] = await db.insert(candidates).values({
      orgId: testOrg.id,
      firstName: 'John',
      lastName: 'Doe',
      dob: '01/15/1990',
      ssnLast4: '1234',
      phone: '555-123-4567',
      email: 'john.doe@example.com',
      address: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    }).returning();

    console.log(`✅ Created candidate: ${candidate.firstName} ${candidate.lastName}`);

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Create order
    console.log('📝 Creating order...');
    const [order] = await db.insert(orders).values({
      orgId: testOrg.id,
      candidateId: candidate.id,
      orderNumber,
      testType: 'Drug Test - 10 Panel',
      urgency: 'standard',
      jobsiteLocation: 'Downtown Office - 123 Congress Ave, Austin, TX',
      needsMask: true,
      maskSize: 'Medium',
      requestedBy: testUser.id,
      notes: 'Test order for Google Sheets integration',
      status: 'new',
    }).returning();

    console.log(`✅ Created order: ${order.orderNumber}`);

    // Sync to Google Sheets
    console.log('📊 Syncing to Google Sheets...');
    const rowId = await appendOrderToSheet({
      orderNumber: order.orderNumber,
      candidateFirstName: candidate.firstName,
      candidateLastName: candidate.lastName,
      candidateEmail: candidate.email,
      candidatePhone: candidate.phone,
      testType: order.testType,
      urgency: order.urgency || 'standard',
      jobsiteLocation: order.jobsiteLocation,
      needsMask: order.needsMask,
      maskSize: order.maskSize,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      notes: order.notes,
    });

    if (rowId) {
      console.log(`✅ Order synced to Google Sheet at row ${rowId}`);

      // Update order with external row ID
      await db.update(orders)
        .set({ externalRowId: rowId })
        .where(eq(orders.id, order.id));

      console.log(`✅ Updated order with externalRowId: ${rowId}`);
    }

    console.log('\n🎉 Test order created successfully!');
    console.log(`📋 Order Number: ${order.orderNumber}`);
    console.log(`👤 Candidate: ${candidate.firstName} ${candidate.lastName}`);
    console.log(`🧪 Test Type: ${order.testType}`);
    console.log(`😷 Needs Mask: ${order.needsMask ? 'Yes' : 'No'}`);
    console.log(`📏 Mask Size: ${order.maskSize || 'N/A'}`);
    console.log(`📊 Sheet Row: ${rowId || 'N/A'}`);
    console.log(`\n🔗 View in Google Sheet: https://docs.google.com/spreadsheets/d/${process.env.SHEETS_SPREADSHEET_ID}/edit#gid=1461919716`);

  } catch (error) {
    console.error('❌ Failed to create test order:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
