import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { annualReviews, persons } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and, desc, count } from 'drizzle-orm';
import { parsePagination } from '@/lib/pagination';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { notifyReviewScheduled } from '@/lib/dqf-notifications';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const createReviewSchema = z.object({
  personId: z.string().uuid('Valid person ID is required'),
  clientOrgId: z.string().uuid().optional(),
  scheduledDate: z.string().datetime('Valid scheduled date is required'),
  reviewDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// ============================================================================
// GET /api/dqf/reviews - List annual reviews
// ============================================================================

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowedRoles = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'];
  if (!allowedRoles.includes(user.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  const tpaOrgId = user.tpaOrgId;
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get('personId');
  const clientOrgId = searchParams.get('clientOrgId');
  const status = searchParams.get('status');
  const { page, limit, offset } = parsePagination(searchParams);

  const conditions = [];
  if (tpaOrgId) conditions.push(eq(annualReviews.tpaOrgId, tpaOrgId));
  if (personId) conditions.push(eq(annualReviews.personId, personId));
  if (clientOrgId) conditions.push(eq(annualReviews.clientOrgId, clientOrgId));
  if (status) conditions.push(eq(annualReviews.status, status as any));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [reviews, [{ count: total }]] = await Promise.all([
    db.query.annualReviews.findMany({
      where: whereClause,
      with: {
        person: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        clientOrg: { columns: { id: true, name: true } },
        signedOffByUser: { columns: { id: true, name: true, email: true } },
      },
      orderBy: [desc(annualReviews.scheduledDate)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(annualReviews).where(whereClause),
  ]);

  return NextResponse.json({
    reviews,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
      hasMore: offset + reviews.length < Number(total),
    },
  });
}

// ============================================================================
// POST /api/dqf/reviews - Schedule new review
// ============================================================================

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowedRoles = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'];
  if (!allowedRoles.includes(user.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  const body = await req.json();
  const validation = createReviewSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Verify person belongs to this TPA
  const person = await db.query.persons.findFirst({
    where: and(eq(persons.id, data.personId), eq(persons.tpaOrgId, tpaOrgId)),
  });

  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 });
  }

  const [review] = await db.insert(annualReviews).values({
    tpaOrgId,
    personId: data.personId,
    clientOrgId: data.clientOrgId || null,
    scheduledDate: new Date(data.scheduledDate),
    reviewDate: data.reviewDate ? new Date(data.reviewDate) : null,
    notes: data.notes || null,
    status: 'scheduled',
  }).returning();

  const fullReview = await db.query.annualReviews.findFirst({
    where: eq(annualReviews.id, review.id),
    with: {
      person: {
        columns: { id: true, firstName: true, lastName: true, email: true },
      },
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'annual_review',
    entityId: review.id,
    action: 'scheduled',
    diffJson: { personId: data.personId, clientOrgId: data.clientOrgId, scheduledDate: data.scheduledDate },
  });

  const personName = `${person.firstName} ${person.lastName}`;
  await notifyReviewScheduled(review.id, personName, data.scheduledDate, tpaOrgId);

  return NextResponse.json(
    { review: fullReview, message: 'Annual review scheduled successfully' },
    { status: 201 }
  );
}
