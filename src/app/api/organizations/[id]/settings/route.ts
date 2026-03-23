import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  contactEmail: z.string().email().or(z.literal('')).nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  website: z.string().url().or(z.literal('')).nullable().optional(),
});

// GET /api/organizations/[id]/settings
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Only TPA users can access organization settings' }, { status: 403 });
  }

  const { id } = params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, id),
  });

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  return NextResponse.json({
    settings: {
      name: org.name,
      slug: org.slug,
      type: org.type,
      contactEmail: org.contactEmail,
      contactPhone: org.contactPhone,
      website: org.website,
    },
  });
}

// PATCH /api/organizations/[id]/settings
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Only admins can update organization settings' }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json();
  const validation = updateSettingsSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid request', details: validation.error.errors }, { status: 400 });
  }

  const data = validation.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail || null;
  if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone || null;
  if (data.website !== undefined) updateData.website = data.website || null;

  await db.update(organizations).set(updateData).where(eq(organizations.id, id));

  const updated = await db.query.organizations.findFirst({
    where: eq(organizations.id, id),
  });

  return NextResponse.json({
    settings: {
      name: updated?.name,
      slug: updated?.slug,
      type: updated?.type,
      contactEmail: updated?.contactEmail,
      contactPhone: updated?.contactPhone,
      website: updated?.website,
    },
    message: 'Settings updated successfully',
  });
}
