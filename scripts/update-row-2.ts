/**
 * Script to update row 2 in Google Sheet with complete data
 * Run with: npx tsx scripts/update-row-2.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('🔄 Updating row 2 with complete data...\n');

  const { db } = await import('../src/db/client');
  const { orders } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { google } = await import('googleapis');

  try {
    // Get the order with person info
    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, 'ORD-1761409751280-MRX01'),
      with: {
        person: true,
      },
    });

    if (!order || !order.person) {
      console.error('❌ Order or person not found');
      process.exit(1);
    }

    console.log(`✅ Found order: ${order.orderNumber}`);
    console.log(`✅ Candidate: ${order.person.firstName} ${order.person.lastName}`);

    // Prepare complete row data (all 19 columns)
    const rowData = [
      order.orderNumber,                              // A: Order Number
      order.person.firstName,                      // B: First Name
      order.person.lastName,                       // C: Last Name
      order.person.dob,                           // D: DOB
      order.person.ssnLast4,                      // E: SSN Last 4
      order.person.email,                         // F: Email
      order.person.phone,                         // G: Phone
      order.person.address,                       // H: Address
      order.person.city,                          // I: City
      order.person.state,                         // J: State
      order.person.zip,                           // K: ZIP
      order.testType,                                // L: Test Type
      order.urgency || 'standard',                   // M: Urgency
      order.jobsiteLocation,                         // N: Jobsite Location
      order.needsMask ? 'Yes' : 'No',               // O: Needs Mask
      order.maskSize || '',                          // P: Mask Size
      order.status,                                  // Q: Status
      order.createdAt.toISOString(),                 // R: Created At
      order.notes || '',                             // S: Notes
    ];

    console.log('\n📊 Updating Google Sheet row 2...');

    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.SHEETS_SERVICE_ACCOUNT_JSON!),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;

    // Update row 2 with complete data
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId!,
      range: 'Orders!A2:S2',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });

    console.log('✅ Row 2 updated successfully!');
    console.log('\n📋 Updated data:');
    console.log(`   Order Number: ${rowData[0]}`);
    console.log(`   Candidate: ${rowData[1]} ${rowData[2]}`);
    console.log(`   DOB: ${rowData[3]}`);
    console.log(`   SSN Last 4: ${rowData[4]}`);
    console.log(`   Email: ${rowData[5]}`);
    console.log(`   Phone: ${rowData[6]}`);
    console.log(`   Address: ${rowData[7]}`);
    console.log(`   City: ${rowData[8]}, ${rowData[9]} ${rowData[10]}`);
    console.log(`   Test Type: ${rowData[11]}`);
    console.log(`   Urgency: ${rowData[12]}`);
    console.log(`   Location: ${rowData[13]}`);
    console.log(`   Mask: ${rowData[15] || 'N/A'}`);
    console.log(`   Status: ${rowData[16]}`);
    console.log(`\n🔗 View in Google Sheet: https://docs.google.com/spreadsheets/d/${process.env.SHEETS_SPREADSHEET_ID}/edit#gid=1461919716`);

  } catch (error) {
    console.error('❌ Failed to update row:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
