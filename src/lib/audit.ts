import { db } from '@/db/client';
import { auditLogs } from '@/db/schema';

export async function createAuditLog(params: {
  tpaOrgId: string;
  actorUserId: string;
  actorEmail: string;
  entityType: string;
  entityId: string;
  action: string;
  diffJson?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      tpaOrgId: params.tpaOrgId,
      actorUserId: params.actorUserId,
      actorEmail: params.actorEmail,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      diffJson: params.diffJson,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
  }
}
