/**
 * Script to test webhook endpoint locally
 * Run with: npx tsx scripts/test-webhook.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('🧪 Testing webhook endpoint...\n');

  // Simulate what Apps Script sends
  const testPayload = {
    rowId: 2,
    headers: [
      'Order Number',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Test Type',
      'Urgency',
      'Jobsite Location',
      'Needs Mask',
      'Mask Size',
      'Status',
      'Created At',
      'Notes',
    ],
    values: [
      'ORD-1761409751280-MRX01',
      'John',
      'Doe',
      'john.doe@example.com',
      '555-123-4567',
      'Drug Test - 10 Panel',
      'standard',
      'Downtown Office - 123 Congress Ave, Austin, TX',
      'Yes',
      'Medium',
      'in_progress', // Changed from 'new' to test update
      new Date().toISOString(),
      'Updated via webhook test',
    ],
    signature: process.env.SHEETS_WEBHOOK_SIGNING_SECRET,
    editedBy: 'test@example.com',
    ts: new Date().toISOString(),
  };

  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  console.log('\n');

  try {
    const response = await fetch('http://localhost:3000/api/webhooks/sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    const data = await response.json();
    console.log('\nResponse:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Webhook test successful!');
    } else {
      console.log('\n❌ Webhook test failed');
    }

  } catch (error) {
    console.error('❌ Error testing webhook:', error);
  }

  process.exit(0);
}

main();
