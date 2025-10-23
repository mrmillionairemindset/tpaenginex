import { auth } from '@/auth';

export type UserRole =
  | 'employer_admin'
  | 'employer_user'
  | 'provider_admin'
  | 'provider_agent';

export type OrganizationType = 'employer' | 'provider';

/**
 * Get current user's role from session
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const session = await auth();

  if (!session?.user?.role) return null;

  return session.user.role as UserRole;
}

/**
 * Get organization type (employer or provider) from role
 */
export function getOrgTypeFromRole(role: UserRole): OrganizationType {
  return role.startsWith('employer') ? 'employer' : 'provider';
}

/**
 * Check if user has permission
 */
export async function hasPermission(
  requiredPermission: 'view_orders' | 'create_orders' | 'assign_sites' | 'manage_sites' | 'upload_results' | 'manage_users'
): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;

  const permissions: Record<UserRole, string[]> = {
    employer_admin: ['view_orders', 'create_orders', 'manage_users'],
    employer_user: ['view_orders'],
    provider_admin: ['view_orders', 'assign_sites', 'manage_sites', 'upload_results', 'manage_users'],
    provider_agent: ['view_orders', 'assign_sites', 'upload_results'],
  };

  return permissions[role]?.includes(requiredPermission) || false;
}

/**
 * Require specific permission (throw if not authorized)
 */
export async function requirePermission(
  permission: Parameters<typeof hasPermission>[0]
): Promise<void> {
  const allowed = await hasPermission(permission);
  if (!allowed) {
    throw new Error('Unauthorized: insufficient permissions');
  }
}

/**
 * Check if user is a provider (admin or agent)
 */
export async function isProvider(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role ? getOrgTypeFromRole(role) === 'provider' : false;
}

/**
 * Check if user is an employer
 */
export async function isEmployer(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role ? getOrgTypeFromRole(role) === 'employer' : false;
}
