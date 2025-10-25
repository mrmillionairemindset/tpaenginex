/**
 * Script to update Google Sheet headers
 * Run with: npx tsx scripts/update-headers.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('🔄 Updating Google Sheet headers...');

  const { google } = await import('googleapis');

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.SHEETS_SERVICE_ACCOUNT_JSON!),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;

  const headers = [[
    'Order Number',
    'First Name',
    'Last Name',
    'DOB',
    'SSN Last 4',
    'Email',
    'Phone',
    'Address',
    'City',
    'State',
    'ZIP',
    'Test Type',
    'Urgency',
    'Jobsite Location',
    'Needs Mask',
    'Mask Size',
    'Status',
    'Created At',
    'Notes',
  ]];

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId!,
      range: 'Orders!A1:S1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: headers },
    });

    console.log('✅ Headers updated successfully!');
    console.log('📋 New headers (19 columns):');
    headers[0].forEach((header, idx) => {
      console.log(`  ${String.fromCharCode(65 + idx)}: ${header}`);
    });

  } catch (error) {
    console.error('❌ Failed to update headers:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
