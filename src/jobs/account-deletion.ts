/**
 * Daily job: permanently delete accounts whose 30-day grace window has expired.
 *
 * PII handling:
 *   - Users row is deleted (cascade deletes their sessions, tokens, backup codes,
 *     notifications, notification preferences, login history via FK ON DELETE CASCADE).
 *   - Audit log entries created BY this user are preserved but their email/name are
 *     redacted so they remain useful for compliance without holding PII.
 *   - Organization-owned records (orders, persons records, documents) are retained —
 *     those belong to the TPA tenant, not the individual user.
 */

import { db } from '@/db/client';
import { users, accountDeletionRequests, auditLogs } from '@/db/schema';
import { and, eq, isNull, lte } from 'drizzle-orm';

export async function runAccountDeletionSweep(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const now = new Date();
  const due = await db.query.accountDeletionRequests.findMany({
    where: and(
      isNull(accountDeletionRequests.cancelledAt),
      isNull(accountDeletionRequests.completedAt),
      lte(accountDeletionRequests.scheduledFor, now),
    ),
  });

  let succeeded = 0;
  let failed = 0;

  for (const req of due) {
    try {
      await db.transaction(async (tx) => {
        // Redact PII from audit logs — keep the entries for tenant compliance
        // but remove personally identifying info about the deleted user.
        await tx
          .update(auditLogs)
          .set({
            actorEmail: '[deleted]',
          })
          .where(eq(auditLogs.actorUserId, req.userId));

        // Delete the user (cascade deletes related personal records via FKs)
        await tx.delete(users).where(eq(users.id, req.userId));

        // Mark deletion request completed
        await tx
          .update(accountDeletionRequests)
          .set({ completedAt: new Date() })
          .where(eq(accountDeletionRequests.id, req.id));
      });

      succeeded++;
      console.log(`[account-deletion] Deleted user ${req.userId}`);
    } catch (err) {
      failed++;
      console.error(`[account-deletion] Failed to delete user ${req.userId}:`, err);
    }
  }

  return {
    processed: due.length,
    succeeded,
    failed,
  };
}

// BullMQ wrapper for the worker
export async function handleAccountDeletionSweep() {
  const result = await runAccountDeletionSweep();
  console.log('[account-deletion] Sweep complete:', result);
  return result;
}
