import { auth } from '@/auth';

export type UserRole =
  | 'platform_admin'
  | 'tpa_admin'
  | 'tpa_staff'
  | 'tpa_records'
  | 'tpa_billing'
  | 'client_admin';

export type OrganizationType = 'platform' | 'tpa' | 'client';

export type Permission =
  | 'view_all_tpas'
  | 'manage_tpa_tenants'
  | 'view_orders'
  | 'create_orders'
  | 'assign_collector'
  | 'update_results'
  | 'manage_collectors'
  | 'manage_clients'
  | 'view_billing'
  | 'manage_billing'
  | 'view_leads'
  | 'manage_leads'
  | 'manage_users'
  | 'manage_events'
  | 'view_events';

const permissions: Record<UserRole, Permission[]> = {
  platform_admin: [
    'view_all_tpas', 'manage_tpa_tenants',
    'view_orders', 'create_orders', 'assign_collector', 'update_results',
    'manage_collectors', 'manage_clients',
    'view_billing', 'manage_billing',
    'view_leads', 'manage_leads',
    'manage_users',
    'view_events', 'manage_events',
  ],
  tpa_admin: [
    'view_orders', 'create_orders', 'assign_collector', 'update_results',
    'manage_collectors', 'manage_clients',
    'view_billing', 'manage_billing',
    'view_leads', 'manage_leads',
    'manage_users',
    'view_events', 'manage_events',
  ],
  tpa_staff: [
    'view_orders', 'create_orders', 'assign_collector',
    'manage_collectors', 'manage_clients',
    'view_events', 'manage_events',
    'view_leads', 'manage_leads',
  ],
  tpa_records: [
    'view_orders', 'update_results',
    'view_events',
  ],
  tpa_billing: [
    'view_orders',
    'view_billing', 'manage_billing',
  ],
  client_admin: [
    'view_orders', // own orders only — enforced at query level via orgId
  ],
};

/**
 * Get current user's role from session
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const session = await auth();
  if (!session?.user?.role) return null;
  return session.user.role as UserRole;
}

/**
 * Get organization type from role
 */
export function getOrgTypeFromRole(role: UserRole): OrganizationType {
  if (role === 'platform_admin') return 'platform';
  if (role === 'client_admin') return 'client';
  return 'tpa';
}

/**
 * Check if user has permission
 */
export async function hasPermission(requiredPermission: Permission): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;
  return permissions[role]?.includes(requiredPermission) || false;
}

/**
 * Check permission synchronously given a role
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return permissions[role]?.includes(permission) || false;
}

/**
 * Require specific permission (throw if not authorized)
 */
export async function requirePermission(permission: Permission): Promise<void> {
  const allowed = await hasPermission(permission);
  if (!allowed) {
    throw new Error('Unauthorized: insufficient permissions');
  }
}

/**
 * Check if user is TPA staff (any tpa_* role)
 */
export async function isTpaUser(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role ? role.startsWith('tpa_') : false;
}

/**
 * Check if user is a client portal user
 */
export async function isClientUser(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === 'client_admin';
}

/**
 * Check if user is platform admin
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === 'platform_admin';
}
