import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
});

// GET /api/organizations/[id]/settings
export const GET = withAuth(async (req, context) => {
  const params = await context.params;
  const orgId = params.id;
  const user = req.user;

  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Only TPA users can access organization settings' }, { status: 403 });
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
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
});

// PATCH /api/organizations/[id]/settings
export const PATCH = withAuth(async (req, context) => {
  const params = await context.params;
  const orgId = params.id;
  const user = req.user;

  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Only admins can update organization settings' }, { status: 403 });
  }

  const body = await req.json();
  const validation = updateSettingsSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid request', details: validation.error.errors }, { status: 400 });
  }

  const data = validation.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
  if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
  if (data.website !== undefined) updateData.website = data.website;

  await db.update(organizations).set(updateData).where(eq(organizations.id, orgId));

  const updated = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
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
});
