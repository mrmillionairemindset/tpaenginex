/**
 * User-initiated GDPR/CCPA data export.
 *
 * POST — generate ZIP and return it as a direct download.
 * GET  — list the user's past data export requests.
 *
 * Rate-limited to prevent abuse. Logs an audit entry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { dataExportRequests } from '@/db/schema';
import { and, eq, gte } from 'drizzle-orm';
import { buildUserDataExport } from '@/lib/data-export';
import { createAuditLog } from '@/lib/audit';
import { checkRateLimitAsync } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/auth-security';

export const dynamic = 'force-dynamic';

// Allow at most 1 export per hour per user (prevents DB hammering from abusive clients)
const EXPORT_COOLDOWN_MS = 60 * 60 * 1000;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const exports = await db.query.dataExportRequests.findMany({
    where: eq(dataExportRequests.userId, user.id),
    orderBy: (r, { desc }) => [desc(r.requestedAt)],
    limit: 20,
  });

  return NextResponse.json({ exports });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit by IP as an extra guard
  const ip = getClientIp(req.headers) || user.id;
  const rate = await checkRateLimitAsync(`export:${ip}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many export requests. Try again later.' },
      { status: 429 }
    );
  }

  // Check cooldown
  const cutoff = new Date(Date.now() - EXPORT_COOLDOWN_MS);
  const recent = await db.query.dataExportRequests.findFirst({
    where: and(
      eq(dataExportRequests.userId, user.id),
      eq(dataExportRequests.status, 'completed'),
      gte(dataExportRequests.requestedAt, cutoff)
    ),
  });
  if (recent) {
    return NextResponse.json(
      { error: 'Please wait at least 1 hour between data exports.' },
      { status: 429 }
    );
  }

  // Create request record
  const [request] = await db.insert(dataExportRequests).values({
    userId: user.id,
    status: 'processing',
  }).returning();

  try {
    const zipBuffer = await buildUserDataExport(user.id);

    // Mark as completed (we're returning the ZIP directly, no download URL needed)
    await db
      .update(dataExportRequests)
      .set({
        status: 'completed',
        completedAt: new Date(),
        sizeBytes: zipBuffer.length,
      })
      .where(eq(dataExportRequests.id, request.id));

    if (user.tpaOrgId) {
      await createAuditLog({
        tpaOrgId: user.tpaOrgId,
        actorUserId: user.id,
        actorEmail: user.email,
        entityType: 'user',
        entityId: user.id,
        action: 'data_export_generated',
        diffJson: { sizeBytes: zipBuffer.length },
      });
    }

    const filename = `tpaengx-data-export-${new Date().toISOString().slice(0, 10)}.zip`;
    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipBuffer.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await db
      .update(dataExportRequests)
      .set({ status: 'failed', errorMessage: message })
      .where(eq(dataExportRequests.id, request.id));

    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
