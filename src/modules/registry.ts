import type { Permission } from '@/auth/rbac';

// ============================================================================
// MODULE IDS
// ============================================================================

export const MODULE_IDS = ['drug_testing', 'dqf', 'occupational_health', 'background_screening', 'injury_care'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

// ============================================================================
// MODULE MANIFEST
// ============================================================================

export interface ModuleManifest {
  id: ModuleId;
  name: string;
  description: string;
  /** Permissions that belong to this module (null = shared/platform-level) */
  permissions: Permission[];
  /** Sidebar nav section keys owned by this module */
  navKeys: string[];
}

export const MODULE_REGISTRY: Record<ModuleId, ModuleManifest> = {
  drug_testing: {
    id: 'drug_testing',
    name: 'Drug Testing',
    description: 'Manage drug test orders, dispatch collectors, deliver results, bill clients. Includes DOT-compliant random selection programs.',
    permissions: [
      'view_orders',
      'create_orders',
      'assign_collector',
      'update_results',
      'manage_collectors',
      'manage_events',
      'view_events',
      'complete_collection',
      'upload_documents',
      'view_random',
      'manage_random',
    ],
    navKeys: [
      'orders',
      'events',
      'persons',
      'collectors',
      'schedule',
      'service-requests',
      'random-programs',
      'random-pools',
    ],
  },
  occupational_health: {
    id: 'occupational_health',
    name: 'Occupational Health',
    description: 'DOT and non-DOT physical exams, breath alcohol testing (BAT), vaccinations, respirator fit tests. Includes FMCSA National Registry submission.',
    permissions: [
      'view_physicals',
      'manage_physicals',
      'certify_physicals',
      'view_bat',
      'manage_bat',
      'view_vaccinations',
      'manage_vaccinations',
      'view_fit_tests',
      'manage_fit_tests',
      'fmcsa_submit',
    ],
    navKeys: [
      'occ-physicals',
      'occ-bat',
      'occ-vaccinations',
      'occ-fit-tests',
    ],
  },
  background_screening: {
    id: 'background_screening',
    name: 'Background Screening',
    description: 'Resell background screening to clients without becoming a Consumer Reporting Agency. Integrates with Checkr; supports First Advantage and Sterling.',
    permissions: [
      'view_background_checks',
      'manage_background_checks',
      'view_background_results',
      'manage_background_packages',
    ],
    navKeys: [
      'background-checks',
      'background-packages',
    ],
  },
  injury_care: {
    id: 'injury_care',
    name: 'Injury Care',
    description: 'Workplace injury intake, treatment log, OSHA 300 recordkeeping, and return-to-work evaluations.',
    permissions: [
      'view_injuries',
      'manage_injuries',
      'view_treatments',
      'manage_treatments',
      'sign_off_rtw',
    ],
    navKeys: [
      'injury-incidents',
      'injury-osha-300',
    ],
  },
  dqf: {
    id: 'dqf',
    name: 'Driver Qualification Files',
    description: 'Maintain driver qualification files, track FMCSA compliance, manage annual reviews',
    permissions: [
      'view_dqf',
      'manage_dqf',
      'view_driver_files',
      'manage_driver_files',
      'run_compliance_reports',
      'manage_tickets',
    ],
    navKeys: [
      'dqf-drivers',
      'dqf-applications',
      'dqf-reviews',
      'dqf-checklists',
      'dqf-compliance',
      'dqf-tickets',
    ],
  },
};

/**
 * Map a permission to the module that owns it.
 * Returns null for shared/platform-level permissions.
 */
export function getModuleForPermission(permission: Permission): ModuleId | null {
  for (const manifest of Object.values(MODULE_REGISTRY)) {
    if (manifest.permissions.includes(permission)) {
      return manifest.id;
    }
  }
  return null;
}
