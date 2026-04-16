import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/auth/get-user';
import { getImpersonationHistory } from '@/lib/impersonation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminId = user.isImpersonating ? user.actualUserId : user.id;
  const adminRow = await db.query.users.findFirst({
    where: eq(users.id, adminId),
    columns: { role: true },
  });
  if (!adminRow || adminRow.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const history = await getImpersonationHistory(200);
  return NextResponse.json({ history });
}
