import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leadActivities, leads } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/leads/[id]/activities — list all activities for a lead
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  // Verify lead exists and belongs to this TPA
  const lead = await db.query.leads.findFirst({
    where: tpaOrgId
      ? and(eq(leads.id, id), eq(leads.tpaOrgId, tpaOrgId))
      : eq(leads.id, id),
  });

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const activities = await db.query.leadActivities.findMany({
    where: eq(leadActivities.leadId, id),
    with: {
      creator: { columns: { id: true, name: true, email: true } },
    },
    orderBy: [desc(leadActivities.createdAt)],
  });

  return NextResponse.json({ activities });
}
