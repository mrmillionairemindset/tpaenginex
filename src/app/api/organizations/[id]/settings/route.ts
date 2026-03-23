import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

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

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.name === 'string' && body.name.trim()) {
      updateData.name = body.name.trim();
    }
    if (body.contactEmail !== undefined) {
      updateData.contactEmail = body.contactEmail || null;
    }
    if (body.contactPhone !== undefined) {
      updateData.contactPhone = body.contactPhone || null;
    }
    if (body.website !== undefined) {
      updateData.website = body.website || null;
    }

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
