import { Job } from 'bullmq';
import { db } from '@/db/client';
import {
  driverQualifications,
  annualReviews,
  driverApplications,
  complianceScores,
  employerInvestigations,
  tenantModules,
  users,
} from '@/db/schema';
import { eq, and, between, lt, or, inArray, desc, isNull } from 'drizzle-orm';
import { sendWeeklyComplianceDigest } from '@/lib/email';
import { getTpaBranding } from '@/lib/tpa-settings';

/**
 * Weekly compliance digest job.
 * Fires Monday 8am. For each tenant with DQF enabled, collects compliance
 * counts and top alerts, then emails tpa_admin and tpa_records users.
 */
export async function runWeeklyComplianceDigest() {
  const enabledTenants = await db.query.tenantModules.findMany({
    where: and(
      eq(tenantModules.moduleId, 'dqf'),
      eq(tenantModules.isEnabled, true),
    ),
  });

  if (enabledTenants.length === 0) {
    console.log('[dqf-weekly-digest] No tenants with DQF enabled — skipping');
    return;
  }

  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  let totalEmailsSent = 0;

  for (const tenant of enabledTenants) {
    console.log(`[dqf-weekly-digest] Processing tenant ${tenant.tpaOrgId}`);

    // 1. Count expiring qualifications (next 30 days)
    const expiringQuals = await db.query.driverQualifications.findMany({
      where: and(
        eq(driverQualifications.tpaOrgId, tenant.tpaOrgId),
        between(driverQualifications.expiresAt, now, thirtyDaysOut),
      ),
      with: { person: { columns: { firstName: true, lastName: true } } },
    });

    // 2. Count overdue reviews
    const overdueReviews = await db.query.annualReviews.findMany({
      where: and(
        eq(annualReviews.tpaOrgId, tenant.tpaOrgId),
        eq(annualReviews.status, 'scheduled'),
        lt(annualReviews.scheduledDate, now),
      ),
      with: { person: { columns: { firstName: true, lastName: true } } },
    });

    // 3. Count pending applications (submitted or under_review)
    const pendingApps = await db.query.driverApplications.findMany({
      where: and(
        eq(driverApplications.tpaOrgId, tenant.tpaOrgId),
        or(
          eq(driverApplications.status, 'submitted'),
          eq(driverApplications.status, 'under_review'),
        ),
      ),
    });

    // 4. Count low compliance drivers (score < 60)
    const lowComplianceRows = await db.query.complianceScores.findMany({
      where: and(
        eq(complianceScores.tpaOrgId, tenant.tpaOrgId),
        lt(complianceScores.score, 60),
      ),
      with: { person: { columns: { firstName: true, lastName: true } } },
      orderBy: [desc(complianceScores.calculatedAt)],
    });

    // Dedupe to latest per person
    const latestLowCompliance = new Map<string, typeof lowComplianceRows[number]>();
    for (const row of lowComplianceRows) {
      if (row.personId && !latestLowCompliance.has(row.personId)) {
        latestLowCompliance.set(row.personId, row);
      }
    }

    // 5. Count open investigations (no contactDate set)
    const openInvestigations = await db.query.employerInvestigations.findMany({
      where: and(
        eq(employerInvestigations.tpaOrgId, tenant.tpaOrgId),
        isNull(employerInvestigations.contactDate),
      ),
    });

    const summary = {
      expiringQualifications: expiringQuals.length,
      overdueReviews: overdueReviews.length,
      pendingApplications: pendingApps.length,
      lowComplianceDrivers: latestLowCompliance.size,
      openInvestigations: openInvestigations.length,
    };

    // Build top 10 alerts (mix of expiring CDLs and overdue reviews)
    const topAlerts: Array<{ type: string; driverName: string; detail: string }> = [];

    for (const qual of expiringQuals.slice(0, 5)) {
      if (!qual.person || !qual.expiresAt) continue;
      const daysUntil = Math.max(0, Math.ceil((qual.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      const qualLabel = qual.qualificationType === 'cdl' ? 'CDL' : qual.qualificationType === 'medical_card' ? 'Medical card' : qual.qualificationType;
      topAlerts.push({
        type: qual.qualificationType === 'medical_card' ? 'medical_card_expiring' : 'license_expiring',
        driverName: `${qual.person.firstName} ${qual.person.lastName}`,
        detail: `${qualLabel} expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
      });
    }

    for (const review of overdueReviews.slice(0, 5)) {
      if (!review.person) continue;
      const daysOverdue = Math.ceil((now.getTime() - review.scheduledDate.getTime()) / (24 * 60 * 60 * 1000));
      topAlerts.push({
        type: 'review_overdue',
        driverName: `${review.person.firstName} ${review.person.lastName}`,
        detail: `Annual review ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue`,
      });
    }

    // If we have zero data and zero alerts, still send (admins should know nothing is wrong)
    // but skip tenants with absolutely no DQF activity (no quals, reviews, or apps)
    const hasAnyData = expiringQuals.length + overdueReviews.length + pendingApps.length + latestLowCompliance.size + openInvestigations.length > 0;
    if (!hasAnyData) {
      console.log(`[dqf-weekly-digest] Tenant ${tenant.tpaOrgId} has no DQF activity — skipping digest`);
      continue;
    }

    // Find recipients: tpa_admin and tpa_records for this tenant
    const recipients = await db.query.users.findMany({
      where: and(
        eq(users.orgId, tenant.tpaOrgId),
        eq(users.isActive, true),
        inArray(users.role, ['tpa_admin', 'tpa_records']),
      ),
    });

    if (recipients.length === 0) {
      console.log(`[dqf-weekly-digest] Tenant ${tenant.tpaOrgId} has no admin/records recipients — skipping`);
      continue;
    }

    const branding = await getTpaBranding(tenant.tpaOrgId, 'general');

    for (const recipient of recipients) {
      if (!recipient.email) continue;
      try {
        await sendWeeklyComplianceDigest({
          tpaOrgId: tenant.tpaOrgId,
          recipientEmail: recipient.email,
          recipientName: recipient.name || recipient.email,
          summary,
          topAlerts: topAlerts.slice(0, 10),
          branding,
        });
        totalEmailsSent++;
      } catch (err) {
        console.error(`[dqf-weekly-digest] Failed to send to ${recipient.email}:`, err);
      }
    }

    console.log(`[dqf-weekly-digest] Tenant ${tenant.tpaOrgId}: ${recipients.length} recipients, summary=${JSON.stringify(summary)}`);
  }

  console.log(`[dqf-weekly-digest] Complete. Sent ${totalEmailsSent} emails across ${enabledTenants.length} tenants.`);
}

/**
 * BullMQ job handler wrapper.
 */
export async function handleDqfWeeklyDigest(_job: Job) {
  await runWeeklyComplianceDigest();
}
