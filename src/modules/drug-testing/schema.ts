/**
 * Drug Testing module schema.
 *
 * Tables owned by this module: orders, collectors, events, specimens,
 * results, invoices, leads, service catalogs, etc.
 *
 * These tables currently live in src/db/schema.ts and will be migrated
 * here during Phase 1A. For now this file re-exports them to establish
 * the module boundary.
 */

export {
  orders,
  collectors,
  events,
  specimens,
  results,
  invoices,
  leads,
  serviceCatalog,
  reasonCatalog,
  panelCodes,
  orderChecklists,
  serviceRequests,
} from '@/db/schema';
