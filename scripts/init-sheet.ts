/**
 * Script to initialize Google Sheet with headers
 * Run with: npx tsx scripts/init-sheet.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly BEFORE importing anything that uses env vars
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('🔄 Initializing Google Sheet with headers...');
  console.log(`📊 Spreadsheet ID: ${process.env.SHEETS_SPREADSHEET_ID}`);

  // Import after env vars are loaded
  const { initializeSheet } = await import('../src/integrations/sheets');

  try {
    await initializeSheet();
    console.log('✅ Google Sheet initialized successfully!');
    console.log(`🔗 View your sheet: https://docs.google.com/spreadsheets/d/${process.env.SHEETS_SPREADSHEET_ID}/edit`);
  } catch (error) {
    console.error('❌ Failed to initialize sheet:', error);
    process.exit(1);
  }
}

main();
