import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { publicTicketForms, persons, driverApplications } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { checkRateLimitAsync } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const publicSubmissionSchema = z.object({
  // Person info
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Phone number is required'),
  dob: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Date of birth must be in MM/DD/YYYY format'),
  ssnLast4: z.string().regex(/^\d{4}$/, 'SSN Last 4 must be exactly 4 digits').default('0000'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  zip: z.string().optional(),
  // Application-specific fields
  position: z.string().max(100).optional(),
  cdlNumber: z.string().max(50).optional(),
  cdlState: z.string().max(2).optional(),
  cdlClass: z.string().max(5).optional(),
  endorsements: z.array(z.string()).optional(),
  previousEmployerContact: z.array(z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    dates: z.string().optional(),
  })).optional(),
  notes: z.string().optional(),
});

// ============================================================================
// POST /api/dqf/tickets/public/[formId] - Public submission (no auth)
// ============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: { formId: string } }
) {
  const { formId } = params;

  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const rateCheck = await checkRateLimitAsync(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    );
  }

  // Look up the form — must exist and be active
  const form = await db.query.publicTicketForms.findFirst({
    where: eq(publicTicketForms.id, formId),
  });

  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  if (!form.isActive) {
    return NextResponse.json({ error: 'This form is no longer accepting submissions' }, { status: 400 });
  }

  const body = await req.json();
  const validation = publicSubmissionSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid submission', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const tpaOrgId = form.tpaOrgId;

  // Create person record scoped to the form's TPA
  const [person] = await db.insert(persons).values({
    orgId: tpaOrgId, // belongs to the TPA org
    tpaOrgId,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    dob: data.dob,
    ssnLast4: data.ssnLast4,
    address: data.address,
    city: data.city,
    state: data.state,
    zip: data.zip,
    personType: 'driver',
  }).returning();

  // Create driver application
  const [application] = await db.insert(driverApplications).values({
    tpaOrgId,
    personId: person.id,
    clientOrgId: form.clientOrgId || null,
    status: 'submitted',
    position: data.position || null,
    cdlNumber: data.cdlNumber || null,
    cdlState: data.cdlState || null,
    cdlClass: data.cdlClass || null,
    endorsements: data.endorsements || null,
    previousEmployerContact: data.previousEmployerContact || null,
    notes: data.notes || null,
  }).returning();

  // Increment submission count
  await db.update(publicTicketForms)
    .set({ submissionCount: sql`${publicTicketForms.submissionCount} + 1` })
    .where(eq(publicTicketForms.id, formId));

  return NextResponse.json(
    {
      message: 'Application submitted successfully',
      applicationId: application.id,
      personId: person.id,
    },
    { status: 201 }
  );
}
