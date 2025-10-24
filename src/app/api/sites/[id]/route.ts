import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sites } from '@/db/schema';
import { withProviderAuth } from '@/auth/api-middleware';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateSiteSchema = z.object({
  name: z.string().min(1).optional(),
  providerNetwork: z.string().optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().length(2).optional(),
  zip: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  testsSupported: z.array(z.string()).optional(),
  hoursJson: z.record(z.any()).optional(),
  acceptsWalkIns: z.boolean().optional(),
  requiresAppointment: z.boolean().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
  meta: z.record(z.any()).optional(),
});

// ============================================================================
// GET /api/sites/[id] - Get single site
// ============================================================================

export const GET = withProviderAuth(async (req, user, context) => {
  const { id } = context.params;

  const site = await db.query.sites.findFirst({
    where: eq(sites.id, id),
    with: {
      appointments: {
        with: {
          order: {
            with: {
              candidate: {
                columns: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: (appointments, { desc }) => [desc(appointments.startTime)],
        limit: 10,
      },
    },
  });

  if (!site) {
    return NextResponse.json(
      { error: 'Site not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ site });
});

// ============================================================================
// PATCH /api/sites/[id] - Update site
// ============================================================================

export const PATCH = withProviderAuth(async (req, user, context) => {
  const { id } = context.params;
  const body = await req.json();
  const validation = updateSiteSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Verify site exists
  const existingSite = await db.query.sites.findFirst({
    where: eq(sites.id, id),
  });

  if (!existingSite) {
    return NextResponse.json(
      { error: 'Site not found' },
      { status: 404 }
    );
  }

  // Build update object
  const updateData: any = { updatedAt: new Date() };

  if (data.name) {
    updateData.name = data.name;
    // Update slug if name changes
    const newSlug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check for duplicate slug
    let finalSlug = newSlug;
    let counter = 1;
    while (true) {
      const existing = await db.query.sites.findFirst({
        where: eq(sites.slug, finalSlug),
      });
      if (!existing || existing.id === id) break;
      finalSlug = `${newSlug}-${counter}`;
      counter++;
    }
    updateData.slug = finalSlug;
  }

  if (data.providerNetwork !== undefined) updateData.providerNetwork = data.providerNetwork;
  if (data.address) updateData.address = data.address;
  if (data.city) updateData.city = data.city;
  if (data.state) updateData.state = data.state;
  if (data.zip) updateData.zip = data.zip;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.website !== undefined) updateData.website = data.website;
  if (data.testsSupported) updateData.testsSupported = data.testsSupported;
  if (data.hoursJson !== undefined) updateData.hoursJson = data.hoursJson;
  if (data.acceptsWalkIns !== undefined) updateData.acceptsWalkIns = data.acceptsWalkIns;
  if (data.requiresAppointment !== undefined) updateData.requiresAppointment = data.requiresAppointment;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.meta !== undefined) updateData.meta = data.meta;

  // Update site
  const [updatedSite] = await db
    .update(sites)
    .set(updateData)
    .where(eq(sites.id, id))
    .returning();

  return NextResponse.json(
    { site: updatedSite, message: 'Site updated successfully' }
  );
});

// ============================================================================
// DELETE /api/sites/[id] - Deactivate site
// ============================================================================

export const DELETE = withProviderAuth(async (req, user, context) => {
  const { id } = context.params;

  // Verify site exists
  const existingSite = await db.query.sites.findFirst({
    where: eq(sites.id, id),
  });

  if (!existingSite) {
    return NextResponse.json(
      { error: 'Site not found' },
      { status: 404 }
    );
  }

  // Soft delete - set isActive to false
  await db
    .update(sites)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(sites.id, id));

  return NextResponse.json({ message: 'Site deactivated successfully' });
});
