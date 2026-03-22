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

import { Worker, Queue } from 'bullmq';
import { redis } from '@/lib/redis';
import { handleKitMailingReminder } from './kit-mailing-reminder';
import { handleCollectorConfirmReminder } from './collector-confirm-reminder';
import { handleResultsPendingDaily } from './results-pending-daily';
import { handleOrderCompletionEmail } from './order-completion-email';
import { handleEventCompletionEmail } from './event-completion-email';
import { handleBillingQueueEntry } from './billing-queue-entry';
import { handleLeadFollowUpReminder } from './lead-followup-reminder';
import { handleLeadStageAutomation } from './lead-stage-automation';
import { handleInvoiceOverdueCheck } from './invoice-overdue-check';

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
      case 'invoice_overdue_check':
        return handleInvoiceOverdueCheck(job);
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
      case 'lead_stage_automation':
        return handleLeadStageAutomation(job);
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

// Schedule daily cron jobs on the reminder queue.
// BullMQ deduplicates repeatable jobs by name + repeat config,
// so restarting the worker will not create duplicate schedules.
const reminderQueue = new Queue('reminders', { connection: redis });

async function scheduleCronJobs() {
  await reminderQueue.add('results_pending_daily', {}, {
    repeat: { pattern: '0 9 * * *' }, // daily at 9am
  });
  console.log('[worker] Scheduled cron: results_pending_daily (daily 9am)');

  await reminderQueue.add('invoice_overdue_check', {}, {
    repeat: { pattern: '0 9 * * *' }, // daily at 9am
  });
  console.log('[worker] Scheduled cron: invoice_overdue_check (daily 9am)');
}

scheduleCronJobs().catch((err) => {
  console.error('[worker] Failed to schedule cron jobs:', err.message);
});

console.log('[worker] Workers started. Listening for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[worker] SIGTERM received — shutting down...');
  await reminderWorker.close();
  await notificationWorker.close();
  await reminderQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[worker] SIGINT received — shutting down...');
  await reminderWorker.close();
  await notificationWorker.close();
  await reminderQueue.close();
  process.exit(0);
});
