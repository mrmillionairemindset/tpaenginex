/**
 * GDPR/CCPA user data export.
 *
 * Collects all data pertaining to an individual user and bundles it as a ZIP
 * of JSON files. Scope is intentionally individual-user data — things they
 * created (their profile, their login history, their audit log entries as the
 * actor) — NOT tenant-wide data they have access to as a TPA admin. That
 * belongs to the TPA, not the user.
 */

import { db } from '@/db/client';
import {
  users,
  organizationMembers,
  loginHistory,
  auditLogs,
  notifications,
  userBackupCodes,
  userNotificationPreferences,
  orders,
  userSessions,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import JSZip from 'jszip';

/**
 * Build a ZIP archive containing the user's personal data.
 * Returns the ZIP as a Buffer suitable for upload/download.
 */
export async function buildUserDataExport(userId: string): Promise<Buffer> {
  const zip = new JSZip();

  // Profile — pick specific columns to exclude secrets
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      phone: true,
      image: true,
      orgId: true,
      role: true,
      emailVerified: true,
      isActive: true,
      lastLoginAt: true,
      totpEnabled: true,
      totpVerifiedAt: true,
      passwordChangedAt: true,
      createdAt: true,
      updatedAt: true,
      // Explicitly omit: password, totpSecret
    },
  });

  zip.file('profile.json', JSON.stringify(user, null, 2));

  // Organization memberships
  const memberships = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.userId, userId),
    with: {
      organization: {
        columns: { id: true, name: true, type: true, slug: true },
      },
    },
  });
  zip.file('memberships.json', JSON.stringify(memberships, null, 2));

  // Login history
  const loginEvents = await db.query.loginHistory.findMany({
    where: eq(loginHistory.userId, userId),
    orderBy: (l, { desc }) => [desc(l.createdAt)],
  });
  zip.file('login-history.json', JSON.stringify(loginEvents, null, 2));

  // Active sessions (non-sensitive fields)
  const sessions = await db.query.userSessions.findMany({
    where: eq(userSessions.userId, userId),
    columns: {
      id: true,
      deviceLabel: true,
      ipAddress: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  zip.file('sessions.json', JSON.stringify(sessions, null, 2));

  // Audit log entries where the user was the actor
  const audits = await db.query.auditLogs.findMany({
    where: eq(auditLogs.actorUserId, userId),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
    limit: 10000, // sane cap
  });
  zip.file('audit-trail.json', JSON.stringify(audits, null, 2));

  // Notifications received
  const notifs = await db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: (n, { desc }) => [desc(n.createdAt)],
  });
  zip.file('notifications.json', JSON.stringify(notifs, null, 2));

  // Notification preferences
  const prefs = await db.query.userNotificationPreferences.findFirst({
    where: eq(userNotificationPreferences.userId, userId),
  });
  zip.file('notification-preferences.json', JSON.stringify(prefs, null, 2));

  // Backup code metadata (IDs + used status — never hashes)
  const backupCodes = await db.query.userBackupCodes.findMany({
    where: eq(userBackupCodes.userId, userId),
    columns: {
      id: true,
      usedAt: true,
      createdAt: true,
    },
  });
  zip.file('backup-codes.json', JSON.stringify(backupCodes, null, 2));

  // Orders the user created (requestedBy = userId)
  const userOrders = await db.query.orders.findMany({
    where: eq(orders.requestedBy, userId),
    orderBy: (o, { desc }) => [desc(o.createdAt)],
    limit: 5000,
  });
  zip.file('orders-created.json', JSON.stringify(userOrders, null, 2));

  // README
  const readme = `TPAEngineX — Personal Data Export
Generated: ${new Date().toISOString()}
User ID: ${userId}

This archive contains data relating to your account.

Files:
  profile.json              — Your user profile (password and 2FA secrets excluded)
  memberships.json          — Organizations you are a member of
  login-history.json        — All login and security events on your account
  sessions.json             — Active and historical device sessions
  audit-trail.json          — Actions you performed that were audit-logged
  notifications.json        — Notifications sent to you
  notification-preferences.json — Your notification settings
  backup-codes.json         — 2FA backup code IDs and usage status (no hashes)
  orders-created.json       — Drug test orders you created (as requester)

Data you may ALSO see but is NOT in this export:
  - Tenant-wide data (client orgs, other users' records) — those belong to your TPA, not you personally.
  - PHI / PII of other individuals (drug test subjects, drivers, patients) — HIPAA and state law require this not be included in a personal export.

Questions? Contact support.
`;
  zip.file('README.txt', readme);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
