/**
 * BullMQ Worker Entry Point
 *
 * Run separately from Next.js as a long-running process:
 *   npx tsx src/jobs/worker.ts
 *
 * Deploy to Railway or a separate Vercel project.
 */

import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { Worker } from 'bullmq';
import { redis } from '@/lib/redis';
import { handleKitMailingReminder } from './kit-mailing-reminder';
import { handleCollectorConfirmReminder } from './collector-confirm-reminder';
import { handleResultsPendingDaily } from './results-pending-daily';
import { handleOrderCompletionEmail } from './order-completion-email';
import { handleEventCompletionEmail } from './event-completion-email';
import { handleBillingQueueEntry } from './billing-queue-entry';
import { handleLeadFollowUpReminder } from './lead-followup-reminder';

if (!redis) {
  console.error('REDIS_URL is not set — cannot start workers');
  process.exit(1);
}

console.log('[worker] Starting BullMQ workers...');

// Reminder queue worker
const reminderWorker = new Worker(
  'reminders',
  async (job) => {
    console.log(`[worker] Processing reminder job: ${job.name} (${job.id})`);

    switch (job.name) {
      case 'kit_mailing_reminder':
        return handleKitMailingReminder(job);
      case 'collector_confirm_reminder':
        return handleCollectorConfirmReminder(job);
      case 'results_pending_daily':
        return handleResultsPendingDaily(job);
      case 'lead_followup_reminder':
        return handleLeadFollowUpReminder(job);
      default:
        console.warn(`[worker] Unknown reminder job: ${job.name}`);
    }
  },
  { connection: redis }
);

// Notification queue worker
const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    console.log(`[worker] Processing notification job: ${job.name} (${job.id})`);

    switch (job.name) {
      case 'order_completion_email':
        return handleOrderCompletionEmail(job);
      case 'event_completion_email':
        return handleEventCompletionEmail(job);
      case 'billing_queue_entry':
        return handleBillingQueueEntry(job);
      default:
        console.warn(`[worker] Unknown notification job: ${job.name}`);
    }
  },
  { connection: redis }
);

// Error handlers
reminderWorker.on('failed', (job, err) => {
  console.error(`[worker] Reminder job ${job?.name} failed:`, err.message);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`[worker] Notification job ${job?.name} failed:`, err.message);
});

reminderWorker.on('completed', (job) => {
  console.log(`[worker] Reminder job ${job.name} completed`);
});

notificationWorker.on('completed', (job) => {
  console.log(`[worker] Notification job ${job.name} completed`);
});

console.log('[worker] Workers started. Listening for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[worker] SIGTERM received — shutting down...');
  await reminderWorker.close();
  await notificationWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[worker] SIGINT received — shutting down...');
  await reminderWorker.close();
  await notificationWorker.close();
  process.exit(0);
});
