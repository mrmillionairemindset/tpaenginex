import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { orders, specimens, documents, auditLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ============================================================================
// POST /api/collector-portal/sync — Bulk offline-queued actions
// Idempotent: repeated sync of same data should not cause errors
// ============================================================================

const completionSchema = z.object({
  orderId: z.string().uuid(),
  ccfNumber: z.string().optional(),
  completedAt: z.string().datetime(),
});

const waitTimeSchema = z.object({
  orderId: z.string().uuid(),
  hours: z.number().positive(),
});

const documentSchema = z.object({
  orderId: z.string().uuid(),
  kind: z.enum(['result', 'chain_of_custody', 'consent', 'authorization', 'other']),
  fileName: z.string().min(1),
  storageKey: z.string().min(1),
});

const syncSchema = z.object({
  completions: z.array(completionSchema).default([]),
  waitTimes: z.array(waitTimeSchema).default([]),
  documents: z.array(documentSchema).default([]),
});

interface SyncResult {
  orderId: string;
  success: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'collector') {
      return NextResponse.json(
        { error: 'Forbidden: Collector access only' },
        { status: 403 }
      );
    }

    if (!user.collectorId || !user.tpaOrgId) {
      return NextResponse.json(
        { error: 'No collector profile linked to this account' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validation = syncSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { completions, waitTimes, documents: docActions } = validation.data;
    const collectorId = user.collectorId;
    const tpaOrgId = user.tpaOrgId;

    // Process completions
    const completionResults: SyncResult[] = [];
    for (const completion of completions) {
      try {
        const result = await processCompletion(
          completion,
          collectorId,
          tpaOrgId,
          user.id,
          user.email ?? ''
        );
        completionResults.push(result);
      } catch (error) {
        completionResults.push({
          orderId: completion.orderId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Process wait times
    const waitTimeResults: SyncResult[] = [];
    for (const wt of waitTimes) {
      try {
        const result = await processWaitTime(wt, collectorId);
        waitTimeResults.push(result);
      } catch (error) {
        waitTimeResults.push({
          orderId: wt.orderId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Process documents
    const documentResults: SyncResult[] = [];
    for (const doc of docActions) {
      try {
        const result = await processDocument(
          doc,
          collectorId,
          tpaOrgId,
          user.id
        );
        documentResults.push(result);
      } catch (error) {
        documentResults.push({
          orderId: doc.orderId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      results: {
        completions: completionResults,
        waitTimes: waitTimeResults,
        documents: documentResults,
      },
    });
  } catch (error) {
    console.error('Failed to process sync:', error);
    return NextResponse.json(
      { error: 'Failed to process sync' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

async function processCompletion(
  completion: z.infer<typeof completionSchema>,
  collectorId: string,
  tpaOrgId: string,
  userId: string,
  userEmail: string
): Promise<SyncResult> {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, completion.orderId),
      eq(orders.collectorId, collectorId)
    ),
  });

  if (!order) {
    return { orderId: completion.orderId, success: false, error: 'Order not found or not assigned to you' };
  }

  // Idempotent: skip already-completed or cancelled orders
  if (order.status === 'complete' || order.status === 'cancelled') {
    return { orderId: completion.orderId, success: true }; // Already done — not an error
  }

  await db.transaction(async (tx) => {
    await tx.update(orders).set({
      status: 'in_progress',
      ccfNumber: completion.ccfNumber || order.ccfNumber,
      updatedAt: new Date(),
    }).where(eq(orders.id, completion.orderId));

    // Auto-create specimen record
    await tx.insert(specimens).values({
      orderId: order.id,
      tpaOrgId,
      specimenType: 'primary',
      ccfNumber: completion.ccfNumber || null,
      collectorId,
      collectedAt: new Date(completion.completedAt),
      status: 'collected',
    } as typeof specimens.$inferInsert);

    // Audit log
    await tx.insert(auditLogs).values({
      tpaOrgId,
      actorUserId: userId,
      actorEmail: userEmail,
      entityType: 'order',
      entityId: completion.orderId,
      action: 'collection_completed_sync',
      diffJson: { ccfNumber: completion.ccfNumber, completedAt: completion.completedAt },
    });
  });

  return { orderId: completion.orderId, success: true };
}

async function processWaitTime(
  wt: z.infer<typeof waitTimeSchema>,
  collectorId: string
): Promise<SyncResult> {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, wt.orderId),
      eq(orders.collectorId, collectorId)
    ),
  });

  if (!order) {
    return { orderId: wt.orderId, success: false, error: 'Order not found or not assigned to you' };
  }

  // Idempotent: if shy bladder already logged, skip
  const currentTestType = order.testType || '';
  if (currentTestType.includes('Shy Bladder')) {
    return { orderId: wt.orderId, success: true };
  }

  const shyBladderEntry = `Shy Bladder / Extended Wait (${wt.hours}hr)`;
  const updatedTestType = currentTestType
    ? `${currentTestType}, ${shyBladderEntry}`
    : shyBladderEntry;

  const currentMeta = (order.meta as Record<string, unknown>) || {};
  const updatedMeta = { ...currentMeta, shyBladderHours: wt.hours };

  await db.update(orders).set({
    testType: updatedTestType,
    meta: updatedMeta,
    updatedAt: new Date(),
  }).where(eq(orders.id, wt.orderId));

  return { orderId: wt.orderId, success: true };
}

async function processDocument(
  doc: z.infer<typeof documentSchema>,
  collectorId: string,
  tpaOrgId: string,
  userId: string
): Promise<SyncResult> {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, doc.orderId),
      eq(orders.collectorId, collectorId)
    ),
    columns: { id: true, tpaOrgId: true },
  });

  if (!order) {
    return { orderId: doc.orderId, success: false, error: 'Order not found or not assigned to you' };
  }

  // Idempotent: check if a document with this storageKey already exists
  const existing = await db.query.documents.findFirst({
    where: and(
      eq(documents.orderId, doc.orderId),
      eq(documents.storageUrl, doc.storageKey)
    ),
  });

  if (existing) {
    return { orderId: doc.orderId, success: true }; // Already synced
  }

  await db.insert(documents).values({
    orderId: doc.orderId,
    tpaOrgId,
    kind: doc.kind,
    fileName: doc.fileName,
    storageUrl: doc.storageKey,
    uploadedBy: userId,
  });

  return { orderId: doc.orderId, success: true };
}
