import { Queue } from 'bullmq';
import { redis } from '@/lib/redis';

const connection = redis ? { connection: redis as any } : undefined;

export const reminderQueue = connection
  ? new Queue('reminders', connection)
  : null;

export const notificationQueue = connection
  ? new Queue('notifications', connection)
  : null;

/**
 * Schedule a delayed job on the reminder queue.
 * If Redis is not configured, logs a warning and skips.
 */
export async function scheduleReminder(
  jobName: string,
  data: Record<string, any>,
  delayMs: number
) {
  if (!reminderQueue) {
    console.warn(`[jobs] Redis not configured — skipping ${jobName}`);
    return;
  }

  if (delayMs <= 0) {
    console.warn(`[jobs] Delay for ${jobName} is in the past — skipping`);
    return;
  }

  await reminderQueue.add(jobName, data, { delay: delayMs });
  console.log(`[jobs] Scheduled ${jobName} with ${Math.round(delayMs / 1000 / 60)} min delay`);
}

/**
 * Add an immediate job to the notification queue.
 */
export async function enqueueNotification(
  jobName: string,
  data: Record<string, any>
) {
  if (!notificationQueue) {
    console.warn(`[jobs] Redis not configured — skipping ${jobName}`);
    return;
  }

  await notificationQueue.add(jobName, data);
  console.log(`[jobs] Enqueued ${jobName}`);
}
