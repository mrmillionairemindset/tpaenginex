import { Job } from 'bullmq';
import { db } from '@/db/client';
import {
  injuries,
  injuryTreatments,
  notifications,
  tenantModules,
  users,
} from '@/db/schema';
import { and, desc, eq, gte, or } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';

export interface InjuryFollowupReminderData {
  tpaOrgId?: string;
}

// Breakpoints for "no treatment in N days" alerts. These track the typical
// escalation a TPA case manager expects: a 30-day check-in, a 60-day concern,
// and a 90-day "this case is going stale" alarm.
const BREAKPOINT_DAYS = [30, 60, 90] as const;

type Breakpoint = (typeof BREAKPOINT_DAYS)[number];

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

function pickBreakpoint(daysSince: number): Breakpoint | null {
  // Pick the LARGEST breakpoint the gap has exceeded — a 95-day gap should
  // fire the "90 days" reminder, not the "30" one.
  let chosen: Breakpoint | null = null;
  for (const bp of BREAKPOINT_DAYS) {
    if (daysSince >= bp) chosen = bp;
  }
  return chosen;
}

/**
 * Daily cron. Finds injuries that are still considered "open" (status in
 * open / in_treatment / rtw_eval_pending) and whose most recent activity
 * (last treatment OR incident date if no treatments) was at least 30/60/90
 * days ago. For each such case, queues one in-app notification to every
 * tpa_staff user in the owning TPA, de-duplicating against any reminder
 * sent for that same case + breakpoint in the last 14 days.
 *
 * The breakpoint is encoded in the notification title so dedup is easy.
 */
export async function handleInjuryFollowupReminder(job: Job<InjuryFollowupReminderData>) {
  const { tpaOrgId } = job.data;

  const enabledTenants = await db.query.tenantModules.findMany({
    where: and(
      eq(tenantModules.moduleId, 'injury_care'),
      eq(tenantModules.isEnabled, true),
      ...(tpaOrgId ? [eq(tenantModules.tpaOrgId, tpaOrgId)] : []),
    ),
  });

  if (enabledTenants.length === 0) {
    console.log('[injury-followup-reminder] No tenants with Injury Care enabled — skipping');
    return;
  }

  const now = new Date();
  let queued = 0;

  for (const tenant of enabledTenants) {
    // Fetch open injuries for this tenant. We include open, in_treatment,
    // and rtw_eval_pending — "closed" / "rtw_full_duty" / "rtw_restricted"
    // / "litigation" cases don't need medical follow-up.
    const openInjuries = await db.query.injuries.findMany({
      where: and(
        eq(injuries.tpaOrgId, tenant.tpaOrgId),
        or(
          eq(injuries.status, 'open'),
          eq(injuries.status, 'in_treatment'),
          eq(injuries.status, 'rtw_eval_pending'),
        ),
      ),
      with: {
        person: { columns: { firstName: true, lastName: true } },
      },
    });

    if (openInjuries.length === 0) continue;

    // Resolve recipients once per tenant.
    const staffRows = await db.query.users.findMany({
      where: and(
        eq(users.orgId, tenant.tpaOrgId),
        or(eq(users.role, 'tpa_admin'), eq(users.role, 'tpa_staff')),
      ),
    });
    if (staffRows.length === 0) continue;

    for (const injury of openInjuries) {
      // Find the most recent treatment date for this injury.
      const latestTreatment = await db.query.injuryTreatments.findFirst({
        where: eq(injuryTreatments.injuryId, injury.id),
        orderBy: [desc(injuryTreatments.treatmentDate)],
      });
      const lastActivity = latestTreatment
        ? latestTreatment.treatmentDate
        : injury.incidentDate;

      const daysSince = daysBetween(now, lastActivity);
      const bp = pickBreakpoint(daysSince);
      if (bp === null) continue;

      const driverName = `${injury.person.firstName} ${injury.person.lastName}`;
      const title = `Injury follow-up (${bp}d) — ${driverName} [${injury.incidentNumber}]`;

      // Dedup: skip if we've already fired THIS breakpoint for THIS case in
      // the last 14 days. Per-user check keeps staff rotations covered.
      const dedupCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const priors = await db.query.notifications.findMany({
        where: and(
          eq(notifications.tpaOrgId, tenant.tpaOrgId),
          eq(notifications.title, title),
          gte(notifications.createdAt, dedupCutoff),
        ),
      });
      const alreadyNotifiedUserIds = new Set(priors.map((n) => n.userId));

      const message =
        `No treatment logged in ${daysSince} days for case ${injury.incidentNumber} ` +
        `(${driverName}). Last activity: ${lastActivity.toLocaleDateString()}.`;

      for (const staffUser of staffRows) {
        if (alreadyNotifiedUserIds.has(staffUser.id)) continue;
        await createNotification({
          userId: staffUser.id,
          tpaOrgId: tenant.tpaOrgId,
          type: 'general',
          title,
          message,
        });
        queued++;
      }
    }
  }

  console.log(`[injury-followup-reminder] Queued ${queued} reminder notifications`);
}
