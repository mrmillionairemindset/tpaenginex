import { auth } from '@/auth';
import { db } from '@/db/client';
import { tenantModules } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getModuleForPermission, type ModuleId } from '@/modules/registry';

export type UserRole =
  | 'platform_admin'
  | 'tpa_admin'
  | 'tpa_staff'
  | 'tpa_records'
  | 'tpa_billing'
  | 'client_admin'
  | 'collector';

export type OrganizationType = 'platform' | 'tpa' | 'client';

export type Permission =
  // Platform
  | 'view_all_tpas'
  | 'manage_tpa_tenants'
  | 'manage_users'
  | 'manage_clients'
  // Drug Testing
  | 'view_orders'
  | 'create_orders'
  | 'assign_collector'
  | 'update_results'
  | 'manage_collectors'
  | 'view_billing'
  | 'manage_billing'
  | 'view_leads'
  | 'manage_leads'
  | 'manage_events'
  | 'view_events'
  | 'complete_collection'
  | 'upload_documents'
  | 'view_random'
  | 'manage_random'
  // Occupational Health
  | 'view_physicals'
  | 'manage_physicals'
  | 'certify_physicals'        // users with NRCME credentials
  | 'view_bat'
  | 'manage_bat'
  | 'view_vaccinations'
  | 'manage_vaccinations'
  | 'view_fit_tests'
  | 'manage_fit_tests'
  | 'fmcsa_submit'
  // Background Screening
  | 'view_background_checks'
  | 'manage_background_checks'
  | 'view_background_results'
  | 'manage_background_packages'
  // DQF
  | 'view_dqf'
  | 'manage_dqf'
  | 'view_driver_files'
  | 'manage_driver_files'
  | 'run_compliance_reports'
  | 'manage_tickets'
  // Injury Care
  | 'view_injuries'
  | 'manage_injuries'
  | 'view_treatments'
  | 'manage_treatments'
  | 'sign_off_rtw';

const permissions: Record<UserRole, Permission[]> = {
  platform_admin: [
    'view_all_tpas', 'manage_tpa_tenants',
    'view_orders', 'create_orders', 'assign_collector', 'update_results',
    'manage_collectors', 'manage_clients',
    'view_billing', 'manage_billing',
    'view_leads', 'manage_leads',
    'manage_users',
    'view_events', 'manage_events',
    'view_random', 'manage_random',
    // Occ Health
    'view_physicals', 'manage_physicals', 'certify_physicals',
    'view_bat', 'manage_bat',
    'view_vaccinations', 'manage_vaccinations',
    'view_fit_tests', 'manage_fit_tests',
    'fmcsa_submit',
    // Background Screening
    'view_background_checks', 'manage_background_checks',
    'view_background_results', 'manage_background_packages',
    // DQF
    'view_dqf', 'manage_dqf',
    'view_driver_files', 'manage_driver_files',
    'run_compliance_reports', 'manage_tickets',
    // Injury Care
    'view_injuries', 'manage_injuries',
    'view_treatments', 'manage_treatments',
    'sign_off_rtw',
  ],
  tpa_admin: [
    'view_orders', 'create_orders', 'assign_collector', 'update_results',
    'manage_collectors', 'manage_clients',
    'view_billing', 'manage_billing',
    'view_leads', 'manage_leads',
    'manage_users',
    'view_events', 'manage_events',
    'view_random', 'manage_random',
    // Occ Health
    'view_physicals', 'manage_physicals', 'certify_physicals',
    'view_bat', 'manage_bat',
    'view_vaccinations', 'manage_vaccinations',
    'view_fit_tests', 'manage_fit_tests',
    'fmcsa_submit',
    // Background Screening
    'view_background_checks', 'manage_background_checks',
    'view_background_results', 'manage_background_packages',
    // DQF
    'view_dqf', 'manage_dqf',
    'view_driver_files', 'manage_driver_files',
    'run_compliance_reports', 'manage_tickets',
    // Injury Care
    'view_injuries', 'manage_injuries',
    'view_treatments', 'manage_treatments',
    'sign_off_rtw',
  ],
  tpa_staff: [
    'view_orders', 'create_orders', 'assign_collector',
    'manage_collectors', 'manage_clients',
    'view_events', 'manage_events',
    'view_leads', 'manage_leads',
    'view_random', 'manage_random',
    // Occ Health (staff schedules exams but doesn't certify — certify_physicals held for medical examiners only)
    'view_physicals', 'manage_physicals',
    'view_bat', 'manage_bat',
    'view_vaccinations', 'manage_vaccinations',
    'view_fit_tests', 'manage_fit_tests',
    // Background Screening — staff submits & views, but doesn't change packages/pricing
    'view_background_checks', 'manage_background_checks',
    'view_background_results',
    // DQF
    'view_dqf', 'manage_dqf',
    'view_driver_files',
    'manage_tickets',
    // Injury Care — staff intake & manage incidents/treatments
    'view_injuries', 'manage_injuries',
    'view_treatments', 'manage_treatments',
  ],
  tpa_records: [
    'view_orders', 'update_results',
    'view_events',
    'view_random',
    // Occ Health — records can certify if they have NRCME (role-level allows; route-level requires user.nrcmeNumber)
    'view_physicals', 'manage_physicals', 'certify_physicals',
    'view_bat', 'manage_bat',
    'view_vaccinations',
    'view_fit_tests',
    'fmcsa_submit',
    // Background Screening — records can view and process adjudication flags
    'view_background_checks', 'view_background_results',
    // DQF
    'view_dqf',
    'view_driver_files', 'manage_driver_files',
    'run_compliance_reports',
    // Injury Care — records can manage treatment log + sign off RTW
    'view_injuries',
    'view_treatments', 'manage_treatments',
    'sign_off_rtw',
  ],
  tpa_billing: [
    'view_orders',
    'view_billing', 'manage_billing',
  ],
  client_admin: [
    'view_orders', // own orders only — enforced at query level via orgId
    // DQF — own only, enforced at query level
    'view_dqf',
    'view_driver_files',
    // Background Screening — can view their own checks + results (enforced by clientOrgId query filter)
    'view_background_checks',
    'view_background_results',
    // Injury Care — own incidents only, enforced at query level
    'view_injuries',
    'view_treatments',
  ],
  collector: [
    'view_orders',       // own assigned orders only — enforced via collectorId
    'view_events',       // own assigned events only
    'complete_collection',
    'upload_documents',
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
  if (role === 'collector') return 'tpa';
  return 'tpa';
}

/**
 * Check if a module is enabled for a TPA tenant.
 * Platform admins bypass this check (they can access all modules).
 */
export async function isTenantModuleEnabled(
  tpaOrgId: string | null,
  moduleId: ModuleId
): Promise<boolean> {
  // Platform admin (tpaOrgId = null) can access all modules
  if (!tpaOrgId) return true;

  const row = await db.query.tenantModules.findFirst({
    where: and(
      eq(tenantModules.tpaOrgId, tpaOrgId),
      eq(tenantModules.moduleId, moduleId),
      eq(tenantModules.isEnabled, true),
    ),
  });

  return !!row;
}

/**
 * Get all enabled module IDs for a TPA tenant.
 */
export async function getEnabledModules(tpaOrgId: string | null): Promise<ModuleId[]> {
  if (!tpaOrgId) return ['drug_testing', 'dqf']; // Platform admin sees all

  const rows = await db.query.tenantModules.findMany({
    where: and(
      eq(tenantModules.tpaOrgId, tpaOrgId),
      eq(tenantModules.isEnabled, true),
    ),
    columns: { moduleId: true },
  });

  return rows.map((r: { moduleId: string }) => r.moduleId as ModuleId);
}

/**
 * Two-step permission check:
 * 1. Does the tenant have the module enabled? (if permission belongs to a module)
 * 2. Does the user's role grant this permission?
 */
export async function hasPermission(
  requiredPermission: Permission,
  tpaOrgId?: string | null
): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;

  // Step 1: Check role permission
  if (!permissions[role]?.includes(requiredPermission)) return false;

  // Step 2: Check module access (if permission belongs to a module)
  const moduleId = getModuleForPermission(requiredPermission);
  if (moduleId && tpaOrgId !== undefined) {
    return isTenantModuleEnabled(tpaOrgId, moduleId);
  }

  return true;
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
export async function requirePermission(
  permission: Permission,
  tpaOrgId?: string | null
): Promise<void> {
  const allowed = await hasPermission(permission, tpaOrgId);
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
