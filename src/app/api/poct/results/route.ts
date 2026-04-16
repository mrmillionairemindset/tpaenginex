import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { poctResults, poctModelVersions, orders } from '@/db/schema';
import { eq, and, desc, gte, lte, sql, count } from 'drizzle-orm';
import { z } from 'zod';
import { getCurrentUser } from '@/auth/get-user';
import { createAuditLog } from '@/lib/audit';
import { validatePoctResult, computeOverallResult, type DrugClassification } from '@/lib/poct-validation';

export const dynamic = 'force-dynamic';

// ============================================================================
// POST /api/poct/results — Collector uploads POCT result from mobile app
// ============================================================================

const postSchema = z.object({
  orderId: z.string().uuid(),
  specimenId: z.string().uuid().nullable().optional(),
  cassetteType: z.string().min(1).max(100),
  capturedImageKey: z.string().min(1),
  imageHash: z.string().length(64).optional(),
  modelVersion: z.string().min(1).max(50),
  modelConfidence: z.number().min(0).max(1).optional(),
  classifiedResult: z.array(z.object({
    drug: z.string().min(1),
    linePresent: z.boolean(),
    intensity: z.number().min(0).max(1),
    result: z.enum(['negative', 'positive', 'invalid']),
  })),
  controlLineValid: z.boolean(),
  overallResult: z.enum(['negative', 'non_negative', 'invalid']).optional(),
  collectorOverride: z.object({
    overriddenAt: z.string(),
    overriddenDrugs: z.array(z.object({
      drug: z.string(),
      originalResult: z.enum(['negative', 'positive', 'invalid']),
      overriddenResult: z.enum(['negative', 'positive', 'invalid']),
      reason: z.string().min(1),
    })),
  }).nullable().optional(),
  collectorConfirmedAt: z.string().datetime().optional(),
  capturedAt: z.string().datetime(),
  processingTimeMs: z.number().int().positive().optional(),
  deviceInfo: z.object({
    platform: z.string(),
    osVersion: z.string(),
    deviceModel: z.string(),
    appVersion: z.string(),
  }).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'collector') {
      return NextResponse.json(
        { error: 'Forbidden: Collector access only' },
        { status: 403 },
      );
    }

    if (!user.collectorId || !user.tpaOrgId) {
      return NextResponse.json(
        { error: 'No collector profile linked to this account' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validation = postSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.errors },
        { status: 400 },
      );
    }

    const data = validation.data;

    // Validate the classified result structure
    const resultValidation = validatePoctResult(data.classifiedResult, data.cassetteType);
    if (!resultValidation.valid) {
      return NextResponse.json(
        { error: 'Invalid classified result', details: resultValidation.errors },
        { status: 400 },
      );
    }

    // Verify order belongs to this collector's TPA
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, data.orderId),
        eq(orders.tpaOrgId, user.tpaOrgId),
      ),
      columns: { id: true, collectorId: true, tpaOrgId: true, meta: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or does not belong to your TPA' },
        { status: 404 },
      );
    }

    if (order.collectorId !== user.collectorId) {
      return NextResponse.json(
        { error: 'This order is not assigned to you' },
        { status: 403 },
      );
    }

    // Verify model version exists
    const modelVersion = await db.query.poctModelVersions.findFirst({
      where: eq(poctModelVersions.version, data.modelVersion),
      columns: { id: true, version: true },
    });

    if (!modelVersion) {
      return NextResponse.json(
        { error: `Model version "${data.modelVersion}" not found` },
        { status: 400 },
      );
    }

    // Compute overall result if not provided
    const overallResult = data.overallResult ??
      computeOverallResult(data.classifiedResult as DrugClassification[], data.controlLineValid);

    // Create the POCT result record
    const [poctResult] = await db.insert(poctResults).values({
      tpaOrgId: user.tpaOrgId,
      orderId: data.orderId,
      specimenId: data.specimenId ?? null,
      collectorId: user.collectorId,
      cassetteType: data.cassetteType,
      capturedImageKey: data.capturedImageKey,
      imageHash: data.imageHash ?? null,
      modelVersion: data.modelVersion,
      modelConfidence: data.modelConfidence ?? null,
      classifiedResult: data.classifiedResult,
      controlLineValid: data.controlLineValid,
      overallResult,
      collectorOverride: data.collectorOverride ?? null,
      collectorConfirmedAt: data.collectorConfirmedAt ? new Date(data.collectorConfirmedAt) : null,
      capturedAt: new Date(data.capturedAt),
      processingTimeMs: data.processingTimeMs ?? null,
      deviceInfo: data.deviceInfo ?? null,
    }).returning();

    // If non-negative, flag order for MRO attention
    if (overallResult === 'non_negative') {
      const existingMeta = (order.meta ?? {}) as Record<string, unknown>;
      await db.update(orders).set({
        meta: { ...existingMeta, poctNonNegative: true, poctResultId: poctResult.id },
        updatedAt: new Date(),
      }).where(eq(orders.id, data.orderId));
    }

    // Audit log
    await createAuditLog({
      tpaOrgId: user.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email ?? 'unknown',
      entityType: 'poct_result',
      entityId: poctResult.id,
      action: 'poct_result_created',
      diffJson: {
        orderId: data.orderId,
        cassetteType: data.cassetteType,
        modelVersion: data.modelVersion,
        overallResult,
        controlLineValid: data.controlLineValid,
        hasOverride: !!data.collectorOverride,
      },
    });

    return NextResponse.json({ poctResult }, { status: 201 });
  } catch (error) {
    console.error('Failed to create POCT result:', error);
    return NextResponse.json(
      { error: 'Failed to create POCT result' },
      { status: 500 },
    );
  }
}

// ============================================================================
// GET /api/poct/results — List POCT results with filters
// ============================================================================

const getQuerySchema = z.object({
  orderId: z.string().uuid().optional(),
  modelVersion: z.string().optional(),
  overallResult: z.enum(['negative', 'non_negative', 'invalid']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.tpaOrgId) {
      return NextResponse.json(
        { error: 'No TPA org associated with this account' },
        { status: 400 },
      );
    }

    // Check view_orders-level permission (any TPA staff or client_admin)
    const allowedRoles = ['platform_admin', 'tpa_admin', 'tpa_staff', 'tpa_records', 'client_admin'];
    if (!allowedRoles.includes(user.role ?? '')) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 },
      );
    }

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const queryValidation = getQuerySchema.safeParse(params);

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryValidation.error.errors },
        { status: 400 },
      );
    }

    const q = queryValidation.data;
    const offset = (q.page - 1) * q.limit;

    // Build conditions
    const conditions = [eq(poctResults.tpaOrgId, user.tpaOrgId)];

    if (q.orderId) {
      conditions.push(eq(poctResults.orderId, q.orderId));
    }
    if (q.modelVersion) {
      conditions.push(eq(poctResults.modelVersion, q.modelVersion));
    }
    if (q.overallResult) {
      conditions.push(eq(poctResults.overallResult, q.overallResult));
    }
    if (q.startDate) {
      conditions.push(gte(poctResults.capturedAt, new Date(q.startDate)));
    }
    if (q.endDate) {
      conditions.push(lte(poctResults.capturedAt, new Date(q.endDate)));
    }

    const whereClause = and(...conditions);

    const [rows, totalResult] = await Promise.all([
      db.select().from(poctResults)
        .where(whereClause)
        .orderBy(desc(poctResults.capturedAt))
        .limit(q.limit)
        .offset(offset),
      db.select({ total: count() }).from(poctResults).where(whereClause),
    ]);

    const total = totalResult[0]?.total ?? 0;

    // Strip collector override details for client_admin
    const sanitizedRows = user.role === 'client_admin'
      ? rows.map(({ collectorOverride, reviewerNotes, reviewerUserId, ...rest }) => rest)
      : rows;

    return NextResponse.json({
      results: sanitizedRows,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  } catch (error) {
    console.error('Failed to list POCT results:', error);
    return NextResponse.json(
      { error: 'Failed to list POCT results' },
      { status: 500 },
    );
  }
}
