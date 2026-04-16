import { Job } from 'bullmq';
import { db } from '@/db/client';
import { complianceScores, driverQualifications, annualReviews, tenantModules, persons } from '@/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

export interface DqfComplianceScoreRecalcData {
  tpaOrgId?: string;
  personId?: string; // If provided, recalc only this driver
}

/**
 * Recalculates compliance scores for all active drivers per tenant.
 * Score = (completed qualifications / total required) * 100
 *
 * Required qualifications: CDL, medical_card, MVR, annual_review
 * Each is scored 0 or 100 (present and valid = 100, missing or expired = 0).
 * Final score = average of all four categories.
 */
export async function handleDqfComplianceScoreRecalc(job: Job<DqfComplianceScoreRecalcData>) {
  const { tpaOrgId, personId } = job.data;

  const enabledTenants = await db.query.tenantModules.findMany({
    where: and(
      eq(tenantModules.moduleId, 'dqf'),
      eq(tenantModules.isEnabled, true),
      ...(tpaOrgId ? [eq(tenantModules.tpaOrgId, tpaOrgId)] : []),
    ),
  });

  if (enabledTenants.length === 0) {
    console.log('[dqf-compliance-score-recalc] No tenants with DQF enabled — skipping');
    return;
  }

  const REQUIRED_QUAL_TYPES = ['cdl', 'medical_card', 'mvr'] as const;
  let totalRecalculated = 0;

  for (const tenant of enabledTenants) {
    // Get all drivers (persons with type 'driver') for this tenant
    const drivers = await db.query.persons.findMany({
      where: and(
        eq(persons.tpaOrgId, tenant.tpaOrgId),
        eq(persons.personType, 'driver'),
        ...(personId ? [eq(persons.id, personId)] : []),
      ),
    });

    if (drivers.length === 0) continue;

    const now = new Date();

    for (const driver of drivers) {
      // Fetch all qualifications for this driver
      const quals = await db.query.driverQualifications.findMany({
        where: and(
          eq(driverQualifications.personId, driver.id),
          eq(driverQualifications.tpaOrgId, tenant.tpaOrgId),
        ),
      });

      // Fetch most recent annual review
      const latestReview = await db.query.annualReviews.findFirst({
        where: and(
          eq(annualReviews.personId, driver.id),
          eq(annualReviews.tpaOrgId, tenant.tpaOrgId),
        ),
        orderBy: (annualReviews, { desc }) => [desc(annualReviews.scheduledDate)],
      });

      // Score each category
      const breakdown: Record<string, number> = {};

      for (const qualType of REQUIRED_QUAL_TYPES) {
        const matching = quals.find(
          q => q.qualificationType === qualType &&
            (q.status === 'active' || q.status === 'expiring_soon') &&
            (!q.expiresAt || q.expiresAt > now)
        );
        breakdown[qualType] = matching ? 100 : 0;
      }

      // Annual review: completed within the last 12 months
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const hasRecentReview = latestReview &&
        latestReview.status === 'completed' &&
        latestReview.reviewDate &&
        latestReview.reviewDate > oneYearAgo;
      breakdown.annualReview = hasRecentReview ? 100 : 0;

      // Calculate overall score
      const categories = Object.values(breakdown);
      const score = categories.length > 0
        ? Math.round(categories.reduce((sum, v) => sum + v, 0) / categories.length)
        : 0;

      // Upsert compliance score
      const existing = await db.query.complianceScores.findFirst({
        where: and(
          eq(complianceScores.personId, driver.id),
          eq(complianceScores.tpaOrgId, tenant.tpaOrgId),
        ),
      });

      if (existing) {
        await db.update(complianceScores)
          .set({
            score,
            breakdown,
            calculatedAt: now,
            updatedAt: now,
          })
          .where(eq(complianceScores.id, existing.id));
      } else {
        await db.insert(complianceScores).values({
          tpaOrgId: tenant.tpaOrgId,
          personId: driver.id,
          clientOrgId: driver.orgId,
          score,
          breakdown,
          calculatedAt: now,
        });
      }

      totalRecalculated++;
    }
  }

  console.log(`[dqf-compliance-score-recalc] Recalculated scores for ${totalRecalculated} drivers`);
}
