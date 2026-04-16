import { Job } from 'bullmq';
import { db } from '@/db/client';
import { driverQualifications, tenantModules, users } from '@/db/schema';
import { eq, and, between, or } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';
import { sendLicenseExpiryAlert } from '@/lib/email';
import { getTpaBranding } from '@/lib/tpa-settings';

export interface DqfMedicalCardExpiryAlertData {
  tpaOrgId?: string;
}

/**
 * Fires daily. Queries driver qualifications where qualificationType = 'medical_card',
 * expiresAt is within 30 days, and status = 'active'.
 * Updates status to 'expiring_soon' and sends alerts.
 */
export async function handleDqfMedicalCardExpiryAlert(job: Job<DqfMedicalCardExpiryAlertData>) {
  const { tpaOrgId } = job.data;

  const enabledTenants = await db.query.tenantModules.findMany({
    where: and(
      eq(tenantModules.moduleId, 'dqf'),
      eq(tenantModules.isEnabled, true),
      ...(tpaOrgId ? [eq(tenantModules.tpaOrgId, tpaOrgId)] : []),
    ),
  });

  if (enabledTenants.length === 0) {
    console.log('[dqf-medical-card-expiry-alert] No tenants with DQF enabled — skipping');
    return;
  }

  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let totalProcessed = 0;

  for (const tenant of enabledTenants) {
    const expiringCards = await db.query.driverQualifications.findMany({
      where: and(
        eq(driverQualifications.tpaOrgId, tenant.tpaOrgId),
        eq(driverQualifications.qualificationType, 'medical_card'),
        eq(driverQualifications.status, 'active'),
        between(driverQualifications.expiresAt, now, thirtyDaysOut),
      ),
      with: {
        person: { columns: { id: true, firstName: true, lastName: true } },
      },
    });

    if (expiringCards.length === 0) continue;

    // Update status to expiring_soon
    for (const qual of expiringCards) {
      await db.update(driverQualifications)
        .set({ status: 'expiring_soon', updatedAt: new Date() })
        .where(eq(driverQualifications.id, qual.id));
    }

    // Find TPA staff and records users to notify
    const staffUsers = await db.query.users.findMany({
      where: or(
        eq(users.role, 'tpa_staff'),
        eq(users.role, 'tpa_admin'),
        eq(users.role, 'tpa_records'),
      ),
    });

    const branding = await getTpaBranding(tenant.tpaOrgId, 'general');
    const recipientEmails = staffUsers.filter(u => u.email).map(u => u.email);

    for (const qual of expiringCards) {
      const personName = `${qual.person.firstName} ${qual.person.lastName}`;
      const expiresAt = qual.expiresAt?.toLocaleDateString() || 'Unknown';

      // In-app notifications
      for (const user of staffUsers) {
        await createNotification({
          userId: user.id,
          type: 'general',
          title: `Medical Card Expiring — ${personName}`,
          message: `DOT medical card for ${personName} expires on ${expiresAt}`,
          tpaOrgId: tenant.tpaOrgId,
        });
      }

      // Email alert (reuses sendLicenseExpiryAlert with medical_card type)
      if (recipientEmails.length > 0) {
        await sendLicenseExpiryAlert({
          tpaOrgId: tenant.tpaOrgId,
          personName,
          qualificationType: 'DOT Medical Card',
          expiresAt,
          recipientEmails,
          branding,
        }).catch(err => console.error('[dqf-medical-card-expiry-alert] Email failed:', err));
      }

      totalProcessed++;
    }
  }

  console.log(`[dqf-medical-card-expiry-alert] Processed ${totalProcessed} expiring medical cards`);
}
