import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { collectors } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateCollectorSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  certifications: z.array(z.string()).optional(),
  serviceArea: z.string().optional(),
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

// PATCH /api/collectors/[id] — update collector (tpa_admin only)
export const PATCH = withPermission('manage_collectors', async (req, user) => {
  const url = new URL(req.url);
  const id = url.pathname.split('/').pop()!;
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const existing = await db.query.collectors.findFirst({
    where: and(eq(collectors.id, id), eq(collectors.tpaOrgId, tpaOrgId)),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Collector not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = updateCollectorSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const updateData: any = { updatedAt: new Date() };

  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.certifications !== undefined) updateData.certifications = data.certifications;
  if (data.serviceArea !== undefined) updateData.serviceArea = data.serviceArea;
  if (data.isAvailable !== undefined) updateData.isAvailable = data.isAvailable;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.notes !== undefined) updateData.notes = data.notes;

  await db.update(collectors).set(updateData).where(eq(collectors.id, id));

  const updated = await db.query.collectors.findFirst({
    where: eq(collectors.id, id),
  });

  return NextResponse.json({ collector: updated, message: 'Collector updated successfully' });
});
