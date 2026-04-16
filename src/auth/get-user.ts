import { auth } from '@/auth';
import { db } from '@/db/client';
import { users, collectors } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { UserRole, OrganizationType } from './rbac';
import { validateSession, touchSession } from '@/lib/session-manager';
import { getActiveImpersonation } from '@/lib/impersonation';

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole | null;
  orgId: string | null;
  tpaOrgId: string | null;
  collectorId: string | null;
  nrcmeNumber: string | null;
  organization: {
    id: string;
    name: string;
    type: OrganizationType;
    slug: string;
    tpaOrgId: string | null;
  } | null;
  /** True when a platform_admin is currently impersonating this user. */
  isImpersonating: boolean;
  /** The platform_admin's actual user ID when impersonating; otherwise equals `id`. */
  actualUserId: string;
  /** Admin email when impersonating — useful for audit banners. */
  actualUserEmail: string | null;
};

async function loadUserContext(userId: string): Promise<Omit<CurrentUser, 'isImpersonating' | 'actualUserId' | 'actualUserEmail'> | null> {
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      organization: true,
    },
  });

  if (!dbUser) return null;

  let tpaOrgId: string | null = null;
  if (dbUser.organization) {
    if (dbUser.organization.type === 'tpa') {
      tpaOrgId = dbUser.organization.id;
    } else if (dbUser.organization.type === 'client') {
      tpaOrgId = dbUser.organization.tpaOrgId;
    }
  }

  let collectorId: string | null = null;
  if (dbUser.role === 'collector') {
    const collector = await db.query.collectors.findFirst({
      where: eq(collectors.userId, dbUser.id),
      columns: { id: true },
    });
    collectorId = collector?.id || null;
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as UserRole | null,
    orgId: dbUser.orgId,
    tpaOrgId,
    collectorId,
    nrcmeNumber: dbUser.nrcmeNumber || null,
    organization: dbUser.organization ? {
      id: dbUser.organization.id,
      name: dbUser.organization.name,
      type: dbUser.organization.type as OrganizationType,
      slug: dbUser.organization.slug,
      tpaOrgId: dbUser.organization.tpaOrgId,
    } : null,
  };
}

/**
 * Get current authenticated user with organization details.
 * Resolves tpaOrgId for row-level security:
 * - platform org: tpaOrgId = null (has access to all)
 * - tpa org: tpaOrgId = org.id
 * - client org: tpaOrgId = org.tpaOrgId
 *
 * If the authenticated user is a platform_admin in an active impersonation
 * session, returns the TARGET user's context with `isImpersonating = true`.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const sessionToken = (session as any)?.sessionId as string | undefined;
  if (sessionToken) {
    const sessionRow = await validateSession(sessionToken);
    if (!sessionRow) {
      return null;
    }
    touchSession(sessionToken, sessionRow.lastSeenAt).catch(() => {});
  }

  const baseContext = await loadUserContext(session.user.id);
  if (!baseContext) {
    return null;
  }

  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, baseContext.id));

  // If this user is a platform_admin with an active impersonation session,
  // return the target user's context instead.
  if (baseContext.role === 'platform_admin') {
    const active = await getActiveImpersonation(baseContext.id);
    if (active) {
      const targetContext = await loadUserContext(active.targetUserId);
      if (targetContext) {
        return {
          ...targetContext,
          isImpersonating: true,
          actualUserId: baseContext.id,
          actualUserEmail: baseContext.email,
        };
      }
    }
  }

  return {
    ...baseContext,
    isImpersonating: false,
    actualUserId: baseContext.id,
    actualUserEmail: null,
  };
}

/**
 * Require authenticated user (throw if not logged in)
 */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized: user not authenticated');
  }
  return user;
}
