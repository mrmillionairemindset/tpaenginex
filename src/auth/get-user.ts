import { auth } from '@/auth';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { UserRole, OrganizationType } from './rbac';

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole | null;
  orgId: string | null;
  tpaOrgId: string | null;
  organization: {
    id: string;
    name: string;
    type: OrganizationType;
    slug: string;
    tpaOrgId: string | null;
  } | null;
};

/**
 * Get current authenticated user with organization details.
 * Resolves tpaOrgId for row-level security:
 * - platform org: tpaOrgId = null (has access to all)
 * - tpa org: tpaOrgId = org.id
 * - client org: tpaOrgId = org.tpaOrgId
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    with: {
      organization: true,
    },
  });

  if (!dbUser) {
    return null;
  }

  // Update last login
  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, dbUser.id));

  // Resolve tpaOrgId based on org type
  let tpaOrgId: string | null = null;
  if (dbUser.organization) {
    if (dbUser.organization.type === 'tpa') {
      tpaOrgId = dbUser.organization.id;
    } else if (dbUser.organization.type === 'client') {
      tpaOrgId = dbUser.organization.tpaOrgId;
    }
    // platform type: tpaOrgId stays null (access to all)
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as UserRole | null,
    orgId: dbUser.orgId,
    tpaOrgId,
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
 * Require authenticated user (throw if not logged in)
 */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized: user not authenticated');
  }
  return user;
}
