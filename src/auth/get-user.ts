import { auth } from '@/auth';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { UserRole } from './rbac';

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole | null;
  orgId: string | null;
  organization: {
    id: string;
    name: string;
    type: 'employer' | 'provider';
    slug: string;
  } | null;
};

/**
 * Get current authenticated user with organization details
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // Fetch full user details from database
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

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as UserRole | null,
    orgId: dbUser.orgId,
    organization: dbUser.organization ? {
      id: dbUser.organization.id,
      name: dbUser.organization.name,
      type: dbUser.organization.type,
      slug: dbUser.organization.slug,
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
