/**
 * Script to check order status in database
 * Run with: npx tsx scripts/check-order.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  const { db } = await import('../src/db/client');
  const { orders } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, 'ORD-1761409751280-MRX01'),
      with: {
        candidate: true,
      },
    });

    if (!order) {
      console.log('❌ Order not found');
      return;
    }

    console.log('\n📋 Order Details:\n');
    console.log(`Order Number: ${order.orderNumber}`);
    console.log(`Candidate: ${order.candidate?.firstName} ${order.candidate?.lastName}`);
    console.log(`Status: ${order.status}`);
    console.log(`Notes: ${order.notes || '(none)'}`);
    console.log(`External Row ID: ${order.externalRowId || '(none)'}`);
    console.log(`Updated At: ${order.updatedAt}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

main();
