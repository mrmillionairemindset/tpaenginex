/**
 * Script to check what's in the Google Sheet
 * Run with: npx tsx scripts/check-sheet.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly BEFORE importing anything that uses env vars
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('🔍 Checking Google Sheet contents...');
  console.log(`📊 Spreadsheet ID: ${process.env.SHEETS_SPREADSHEET_ID}`);

  // Import after env vars are loaded
  const { google } = await import('googleapis');

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.SHEETS_SERVICE_ACCOUNT_JSON!),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;

  try {
    // Get spreadsheet metadata
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId!,
    });

    console.log('\n📋 Available sheets:');
    spreadsheet.data.sheets?.forEach((sheet) => {
      console.log(`  - ${sheet.properties?.title} (${sheet.properties?.sheetId})`);
    });

    // Try to read from Orders sheet
    console.log('\n📖 Reading Orders sheet (A1:M10):');
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId!,
        range: 'Orders!A1:M10',
      });

      if (response.data.values && response.data.values.length > 0) {
        console.log(`Found ${response.data.values.length} rows:`);
        response.data.values.forEach((row, idx) => {
          console.log(`  Row ${idx + 1}:`, row.slice(0, 5).join(' | ')); // Show first 5 columns
        });
      } else {
        console.log('⚠️  No data found in Orders sheet');
      }
    } catch (error: any) {
      console.log('❌ Error reading Orders sheet:', error.message);
    }

  } catch (error) {
    console.error('❌ Failed to check sheet:', error);
    process.exit(1);
  }
}

main();
