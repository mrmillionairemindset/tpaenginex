import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sites } from '@/db/schema';
import { withTpaAuth } from '@/auth/api-middleware';
import { eq, and, or, ilike, desc } from 'drizzle-orm';
import { z } from 'zod';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const createSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  providerNetwork: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'State must be 2 characters'),
  zip: z.string().min(1, 'ZIP code is required'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  testsSupported: z.array(z.string()).min(1, 'At least one test type must be supported'),
  hoursJson: z.record(z.any()).optional(),
  acceptsWalkIns: z.boolean().default(false),
  requiresAppointment: z.boolean().default(true),
  priority: z.number().int().default(0),
  meta: z.record(z.any()).optional(),
});

// ============================================================================
// GET /api/sites - List sites
// ============================================================================

export const GET = withTpaAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const testType = searchParams.get('testType');
  const state = searchParams.get('state');
  const activeOnly = searchParams.get('activeOnly') === 'true';

  let whereConditions = [];

  // Active sites only
  if (activeOnly) {
    whereConditions.push(eq(sites.isActive, true));
  }

  // Search by name, city, or provider network
  if (search) {
    const searchPattern = `%${search}%`;
    whereConditions.push(
      or(
        ilike(sites.name, searchPattern),
        ilike(sites.city, searchPattern),
        ilike(sites.providerNetwork, searchPattern)
      )
    );
  }

  // Filter by state
  if (state) {
    whereConditions.push(eq(sites.state, state));
  }

  const whereClause = whereConditions.length > 0
    ? and(...whereConditions)
    : undefined;

  let sitesList = await db.query.sites.findMany({
    where: whereClause,
    with: {
      appointments: {
        columns: {
          id: true,
        },
      },
    },
    orderBy: [desc(sites.priority), desc(sites.createdAt)],
  });

  // Filter by test type (jsonb array search)
  if (testType) {
    sitesList = sitesList.filter(site =>
      (site.testsSupported as string[])?.includes(testType)
    );
  }

  // Add _count field for compatibility with UI components
  const formattedSites = sitesList.map((site) => ({
    ...site,
    _count: {
      appointments: site.appointments?.length || 0,
    },
  }));

  return NextResponse.json({ sites: formattedSites });
});

// ============================================================================
// POST /api/sites - Create site
// ============================================================================

export const POST = withTpaAuth(async (req, user) => {
  const body = await req.json();
  const validation = createSiteSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Generate slug from name
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Check for duplicate slug
  let finalSlug = slug;
  let counter = 1;
  while (true) {
    const existing = await db.query.sites.findFirst({
      where: eq(sites.slug, finalSlug),
    });
    if (!existing) break;
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  // Create site
  const [newSite] = await db.insert(sites).values({
    name: data.name,
    slug: finalSlug,
    providerNetwork: data.providerNetwork,
    address: data.address,
    city: data.city,
    state: data.state,
    zip: data.zip,
    phone: data.phone,
    email: data.email,
    website: data.website,
    testsSupported: data.testsSupported,
    hoursJson: data.hoursJson,
    acceptsWalkIns: data.acceptsWalkIns,
    requiresAppointment: data.requiresAppointment,
    priority: data.priority,
    isActive: true,
    meta: data.meta,
  }).returning();

  return NextResponse.json(
    { site: newSite, message: 'Site created successfully' },
    { status: 201 }
  );
});
