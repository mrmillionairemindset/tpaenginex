import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const updateSettingsSchema = z.object({
  authFormRecipients: z.array(z.string().email()).optional(),
  authExpiryDays: z.number().int().min(1).max(30).optional(),
});

/**
 * GET /api/organizations/[id]/settings
 * Get organization settings
 */
export const GET = withAuth(async (req, context) => {
  const params = await context.params;
  const orgId = params.id;
  const user = req.user;

  // Only providers can manage organization settings
  if (!user.role?.startsWith('provider')) {
    return NextResponse.json(
      { error: 'Only providers can access organization settings' },
      { status: 403 }
    );
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    return NextResponse.json(
      { error: 'Organization not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    settings: {
      authFormRecipients: org.authFormRecipients || [],
      authExpiryDays: org.authExpiryDays,
    },
  });
});

/**
 * PATCH /api/organizations/[id]/settings
 * Update organization settings
 */
export const PATCH = withAuth(async (req, context) => {
  const params = await context.params;
  const orgId = params.id;
  const user = req.user;

  // Only providers can manage organization settings
  if (!user.role?.startsWith('provider')) {
    return NextResponse.json(
      { error: 'Only providers can update organization settings' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const validation = updateSettingsSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Build update object
  const updateData: any = { updatedAt: new Date() };

  if (data.authFormRecipients !== undefined) {
    updateData.authFormRecipients = data.authFormRecipients;
  }

  if (data.authExpiryDays !== undefined) {
    updateData.authExpiryDays = data.authExpiryDays;
  }

  // Update organization
  await db.update(organizations)
    .set(updateData)
    .where(eq(organizations.id, orgId));

  // Fetch updated organization
  const updatedOrg = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  return NextResponse.json({
    settings: {
      authFormRecipients: updatedOrg?.authFormRecipients || [],
      authExpiryDays: updatedOrg?.authExpiryDays,
    },
    message: 'Settings updated successfully',
  });
});
