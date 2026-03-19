import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leads, organizations } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// POST /api/leads/[id]/convert — convert lead to client organization
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Require tpa_admin or platform_admin
  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Forbidden: tpa_admin or platform_admin role required' },
      { status: 403 }
    );
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  // Find lead scoped to TPA
  const lead = await db.query.leads.findFirst({
    where: and(eq(leads.id, id), eq(leads.tpaOrgId, tpaOrgId)),
  });

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  if (lead.convertedToOrgId) {
    return NextResponse.json({ error: 'Lead has already been converted' }, { status: 400 });
  }

  // Generate slug from company name
  const slug = lead.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80)
    + '-' + Date.now().toString(36);

  // Create client organization
  const [newOrg] = await db.insert(organizations).values({
    name: lead.companyName,
    slug,
    type: 'client',
    tpaOrgId,
    contactEmail: lead.contactEmail,
    contactPhone: lead.contactPhone,
  }).returning();

  // Update lead: mark as converted
  await db.update(leads).set({
    convertedToOrgId: newOrg.id,
    stage: 'closed_won',
    updatedAt: new Date(),
  }).where(eq(leads.id, id));

  return NextResponse.json(
    { organization: newOrg, message: 'Lead converted to client organization' },
    { status: 201 }
  );
}
