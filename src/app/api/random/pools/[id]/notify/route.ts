import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { randomPools, randomSelections, persons, users } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { sendRandomSelectionNotification } from '@/lib/email';
import { getTpaBranding } from '@/lib/tpa-settings';

export const dynamic = 'force-dynamic';

const notifySchema = z.object({
  // Optionally scope to specific selections; omitted = all un-notified
  selectionIds: z.array(z.string().uuid()).optional(),
  // Days from now that the donor must complete the test
  reportByDays: z.number().int().min(1).max(30).default(3),
  reportingInstructions: z.string().max(2000).optional(),
});

// POST /api/random/pools/[id]/notify — send notifications to selected persons
export const POST = withPermission('manage_random', async (req, user, context) => {
  const { id } = context.params as { id: string };
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const pool = await db.query.randomPools.findFirst({
    where: and(eq(randomPools.id, id), eq(randomPools.tpaOrgId, tpaOrgId)),
    with: { program: true },
  });

  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
  }

  if (pool.status === 'open') {
    return NextResponse.json(
      { error: 'Pool has not been selected yet' },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = notifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }

  const { selectionIds, reportByDays, reportingInstructions } = parsed.data;

  // Load target selections (un-notified by default)
  const filters = [eq(randomSelections.poolId, id)];
  if (selectionIds?.length) {
    filters.push(inArray(randomSelections.id, selectionIds));
  } else {
    filters.push(isNull(randomSelections.notifiedAt));
  }

  const targets = await db.query.randomSelections.findMany({
    where: and(...filters),
    with: {
      person: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          orgId: true,
        },
      },
    },
  });

  if (targets.length === 0) {
    return NextResponse.json(
      { error: 'No pending selections to notify' },
      { status: 409 },
    );
  }

  const branding = await getTpaBranding(tpaOrgId);
  const scheduledByDate = new Date(
    Date.now() + reportByDays * 24 * 60 * 60 * 1000,
  ).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const now = new Date();
  const results: Array<{ selectionId: string; emailed: boolean; error?: string }> = [];

  for (const sel of targets) {
    const fullName = `${sel.person.firstName} ${sel.person.lastName}`.trim();
    let emailed = false;
    let errorMsg: string | undefined;

    // Email if we have an address
    if (sel.person.email) {
      try {
        await sendRandomSelectionNotification({
          tpaOrgId,
          recipientEmail: sel.person.email,
          recipientName: fullName || 'Selected Employee',
          selectionType: sel.selectionType,
          scheduledByDate,
          reportingInstructions,
          branding,
        });
        emailed = true;
      } catch (err: any) {
        errorMsg = err?.message || 'Email send failed';
        console.error('[random/notify] Email failed for', sel.id, err);
      }
    }

    // In-app notification to person's user account (if they have one tied to their email)
    if (sel.person.email) {
      const personUser = await db.query.users.findFirst({
        where: eq(users.email, sel.person.email),
        columns: { id: true },
      });
      if (personUser) {
        await createNotification({
          userId: personUser.id,
          type: 'random_selection',
          title: 'You have been randomly selected for testing',
          message: `You are required to report for ${sel.selectionType} testing by ${scheduledByDate}.`,
          tpaOrgId,
        });
      }
    }

    await db
      .update(randomSelections)
      .set({ notifiedAt: now })
      .where(eq(randomSelections.id, sel.id));

    results.push({ selectionId: sel.id, emailed, error: errorMsg });
  }

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'random_pool',
    entityId: id,
    action: 'notifications_sent',
    diffJson: {
      count: results.length,
      emailed: results.filter((r) => r.emailed).length,
      failed: results.filter((r) => r.error).length,
    },
  });

  return NextResponse.json({
    notified: results.length,
    emailed: results.filter((r) => r.emailed).length,
    results,
  });
});
