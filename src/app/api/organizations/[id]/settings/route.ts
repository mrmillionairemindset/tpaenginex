import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Preprocess: convert empty strings to null before validation
const emptyToNull = z.preprocess(
  (val) => (val === '' ? null : val),
  z.string().nullable().optional()
);

const updateSettingsSchema = z.object({
  name: z.string().min(1, 'Organization name is required').trim().optional(),
  contactEmail: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().email('Invalid email address').nullable().optional()
  ),
  contactPhone: emptyToNull,
  website: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().url('Invalid URL — must start with https://').nullable().optional()
  ),
});

// GET /api/organizations/[id]/settings
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin' && user.role !== 'collector') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;

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
  } catch (error) {
    console.error('GET /api/organizations/[id]/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/organizations/[id]/settings
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
      return NextResponse.json({ error: 'Only admins can update organization settings' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const validation = updateSettingsSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      return NextResponse.json(
        { error: firstError.message, field: firstError.path.join('.') },
        { status: 400 }
      );
    }

    const data = validation.data;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
    if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
    if (data.website !== undefined) updateData.website = data.website;

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
  } catch (error) {
    console.error('PATCH /api/organizations/[id]/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
