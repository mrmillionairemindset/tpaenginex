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
import { handleDqfAnnualReviewReminder } from './dqf-annual-review-reminder';
import { handleDqfLicenseExpiryAlert } from './dqf-license-expiry-alert';
import { handleDqfMedicalCardExpiryAlert } from './dqf-medical-card-expiry-alert';
import { handleDqfComplianceScoreRecalc } from './dqf-compliance-score-recalc';
import { handleDqfClearinghouseQuery } from './dqf-clearinghouse-query';
import { handleDqfTicketFormSubmissionNotify } from './dqf-ticket-form-submission-notify';
import { handleDqfWeeklyDigest } from './dqf-weekly-digest';
import { handleWebhookDelivery } from './webhook-delivery';
import { handleRandomPeriodRollover } from './random-period-rollover';
import { handleMecExpiryReminder } from './mec-expiry-reminder';
import { runFmcsaSubmitJob } from './fmcsa-submit';
import { handleFmcsaMonthlyBilling } from './fmcsa-monthly-billing';
import { handleBackgroundMonthlyBilling } from './background-monthly-billing';
import { handleInjuryFollowupReminder } from './injury-followup-reminder';
import { handleDrugTestingFetchResults } from './drug-testing-fetch-results';
import { handlePushReceiptProcessor } from './push-receipt-processor';

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
      case 'dqf_annual_review_reminder':
        return handleDqfAnnualReviewReminder(job);
      case 'dqf_license_expiry_alert':
        return handleDqfLicenseExpiryAlert(job);
      case 'dqf_medical_card_expiry_alert':
        return handleDqfMedicalCardExpiryAlert(job);
      case 'dqf_compliance_score_recalc':
        return handleDqfComplianceScoreRecalc(job);
      case 'dqf_clearinghouse_query':
        return handleDqfClearinghouseQuery(job);
      case 'dqf_weekly_digest':
      case 'dqf-weekly-digest':
        return handleDqfWeeklyDigest(job);
      case 'webhook_delivery':
        return handleWebhookDelivery(job);
      case 'random_period_rollover':
        return handleRandomPeriodRollover(job);
      case 'mec_expiry_reminder':
        return handleMecExpiryReminder(job);
      case 'fmcsa_submit':
        return runFmcsaSubmitJob();
      case 'fmcsa_monthly_billing':
        return handleFmcsaMonthlyBilling(job);
      case 'background_monthly_billing':
        return handleBackgroundMonthlyBilling(job);
      case 'injury_followup_reminder':
        return handleInjuryFollowupReminder(job);
      case 'drug_testing_fetch_results':
        return handleDrugTestingFetchResults(job);
      case 'push_receipt_processor':
        return handlePushReceiptProcessor(job);
      default:
        console.warn(`[worker] Unknown reminder job: ${job.name}`);
    }
  },
  { connection: redis as any }
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
      case 'dqf_ticket_form_submission_notify':
        return handleDqfTicketFormSubmissionNotify(job);
      default:
        console.warn(`[worker] Unknown notification job: ${job.name}`);
    }
  },
  { connection: redis as any }
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
const reminderQueue = new Queue('reminders', { connection: redis as any });

async function scheduleCronJobs() {
  await reminderQueue.add('results_pending_daily', {}, {
    repeat: { pattern: '0 9 * * *' }, // daily at 9am
  });
  console.log('[worker] Scheduled cron: results_pending_daily (daily 9am)');

  await reminderQueue.add('invoice_overdue_check', {}, {
    repeat: { pattern: '0 9 * * *' }, // daily at 9am
  });
  console.log('[worker] Scheduled cron: invoice_overdue_check (daily 9am)');

  // DQF cron jobs
  await reminderQueue.add('dqf_annual_review_reminder', {}, {
    repeat: { pattern: '0 8 * * *' }, // daily at 8am
  });
  console.log('[worker] Scheduled cron: dqf_annual_review_reminder (daily 8am)');

  await reminderQueue.add('dqf_license_expiry_alert', {}, {
    repeat: { pattern: '0 8 * * *' }, // daily at 8am
  });
  console.log('[worker] Scheduled cron: dqf_license_expiry_alert (daily 8am)');

  await reminderQueue.add('dqf_medical_card_expiry_alert', {}, {
    repeat: { pattern: '0 8 * * *' }, // daily at 8am
  });
  console.log('[worker] Scheduled cron: dqf_medical_card_expiry_alert (daily 8am)');

  await reminderQueue.add('dqf_compliance_score_recalc', {}, {
    repeat: { pattern: '0 2 * * *' }, // daily at 2am (off-peak)
  });
  console.log('[worker] Scheduled cron: dqf_compliance_score_recalc (daily 2am)');

  await reminderQueue.add('dqf-weekly-digest', {}, {
    repeat: { pattern: '0 8 * * 1' }, // Monday at 8am
  });
  console.log('[worker] Scheduled cron: dqf-weekly-digest (Monday 8am)');

  await reminderQueue.add('webhook_delivery', {}, {
    repeat: { pattern: '* * * * *' }, // every minute
  });
  console.log('[worker] Scheduled cron: webhook_delivery (every minute)');

  await reminderQueue.add('random_period_rollover', {}, {
    repeat: { pattern: '0 1 * * *' }, // daily at 1am
  });
  console.log('[worker] Scheduled cron: random_period_rollover (daily 1am)');

  await reminderQueue.add('mec_expiry_reminder', {}, {
    repeat: { pattern: '0 8 * * *' }, // daily at 8am
  });
  console.log('[worker] Scheduled cron: mec_expiry_reminder (daily 8am)');

  // FMCSA Registry submission sweep runs every 15 minutes so DOT physicals
  // reach the National Registry well within the regulatory 24-hour window
  // (49 CFR 390.105(b)) even when submissions initially fail and need retry.
  await reminderQueue.add('fmcsa_submit', {}, {
    repeat: { pattern: '*/15 * * * *' }, // every 15 minutes
  });
  console.log('[worker] Scheduled cron: fmcsa_submit (every 15 min)');

  // Monthly FMCSA registry billing — 1st of each month at 3am UTC.
  // Counts active CMEs per TPA tenant opted into the FMCSA service and
  // creates a $99/CME invoice. Idempotent (skips if invoice already exists).
  await reminderQueue.add('fmcsa_monthly_billing', {}, {
    repeat: { pattern: '0 3 1 * *' }, // day 1 of each month, 3am UTC
  });
  console.log('[worker] Scheduled cron: fmcsa_monthly_billing (monthly 1st @ 3am)');

  // Background Screening monthly sweep — 1st of each month at 4am UTC.
  // Sweeps unbilled backgroundCheckCharges per TPA into a single monthly invoice.
  await reminderQueue.add('background_monthly_billing', {}, {
    repeat: { pattern: '0 4 1 * *' }, // day 1 of each month, 4am UTC
  });
  console.log('[worker] Scheduled cron: background_monthly_billing (monthly 1st @ 4am)');

  // Injury follow-up sweep — daily at 7am. Finds open injuries with no
  // treatment in 30/60/90 days and notifies the TPA staff.
  await reminderQueue.add('injury_followup_reminder', {}, {
    repeat: { pattern: '0 7 * * *' },
  });
  console.log('[worker] Scheduled cron: injury_followup_reminder (daily 7am)');

  // Drug testing result fetch — every 15 minutes. Polls lab adapters for
  // result updates on orders with external references.
  await reminderQueue.add('drug_testing_fetch_results', {}, {
    repeat: { pattern: '*/15 * * * *' },
  });
  console.log('[worker] Scheduled cron: drug_testing_fetch_results (every 15 min)');

  // Push receipt processor — every 30 minutes. Checks Expo push receipts
  // and deactivates tokens reported as DeviceNotRegistered.
  await reminderQueue.add('push_receipt_processor', {}, {
    repeat: { pattern: '*/30 * * * *' },
  });
  console.log('[worker] Scheduled cron: push_receipt_processor (every 30 min)');
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
