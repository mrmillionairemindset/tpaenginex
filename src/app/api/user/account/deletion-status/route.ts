/**
 * GET /api/user/account/deletion-status — returns the user's pending deletion request, if any.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { accountDeletionRequests } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const request = await db.query.accountDeletionRequests.findFirst({
    where: eq(accountDeletionRequests.userId, user.id),
  });

  if (!request || request.cancelledAt || request.completedAt) {
    return NextResponse.json({ pending: false });
  }

  return NextResponse.json({
    pending: true,
    requestedAt: request.requestedAt.toISOString(),
    scheduledFor: request.scheduledFor.toISOString(),
    reason: request.reason,
  });
}
