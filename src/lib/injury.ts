/**
 * Injury Care module helpers.
 *
 * Responsibilities:
 *   - Generate per-TPA per-year incident numbers (INC-YYYY-NNNNN)
 *   - Derive OSHA 300 recordability from severity (29 CFR 1904.7)
 *   - Classify injuries into the four OSHA Form 300 columns
 *
 * These are pure functions wherever possible so the test suite can exercise
 * the rules without touching the database.
 */

import { db } from '@/db/client';
import { injuries } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export type InjurySeverity =
  | 'first_aid'
  | 'medical'
  | 'lost_time'
  | 'restricted_duty'
  | 'fatality';

export type InjuryStatus =
  | 'open'
  | 'in_treatment'
  | 'rtw_eval_pending'
  | 'rtw_full_duty'
  | 'rtw_restricted'
  | 'closed'
  | 'litigation';

/**
 * OSHA Form 300 classification (column groups).
 * See 29 CFR 1904.7 — an injury must appear in exactly one of:
 *   (G) Death
 *   (H) Days away from work
 *   (I) Job transfer or restriction
 *   (J) Other recordable case
 */
export type Osha300Column = 'death' | 'days_away' | 'transfer_restriction' | 'other';

/**
 * Default OSHA recordability from severity. A safety officer can override the
 * stored `osha_recordable` field on the injury, but this is the starting point.
 *
 * Per 29 CFR 1904.7: "first aid only" cases are NOT recordable; anything that
 * results in medical treatment beyond first aid, days away, restricted duty,
 * transfer, loss of consciousness, significant diagnosis, or death IS
 * recordable.
 */
export function isOshaRecordableBySeverity(severity: InjurySeverity): boolean {
  switch (severity) {
    case 'first_aid':
      return false;
    case 'medical':
    case 'lost_time':
    case 'restricted_duty':
    case 'fatality':
      return true;
  }
}

/**
 * Classify a recordable injury into one of the four OSHA Form 300 columns.
 *
 * Ordering matters — an injury that was ultimately fatal is column G even if
 * the worker also had days away first. Likewise days-away outranks
 * transfer/restriction when both are present.
 */
export function classifyOsha300Row(input: {
  severity: InjurySeverity;
  lostDaysCount: number;
  restrictedDaysCount: number;
}): Osha300Column {
  if (input.severity === 'fatality') return 'death';
  if (input.lostDaysCount > 0 || input.severity === 'lost_time') return 'days_away';
  if (input.restrictedDaysCount > 0 || input.severity === 'restricted_duty') {
    return 'transfer_restriction';
  }
  return 'other';
}

/**
 * Parse the numeric sequence out of an incident number (e.g. "INC-2026-00042" → 42).
 * Returns 0 for unrecognized inputs — useful when seeding a fresh counter.
 */
export function parseIncidentSequence(incidentNumber: string | null | undefined): number {
  if (!incidentNumber) return 0;
  const m = incidentNumber.match(/^INC-\d{4}-(\d+)$/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Format an incident number given a year and sequence.
 * Pads the sequence to five digits so files sort lexicographically.
 */
export function formatIncidentNumber(year: number, sequence: number): string {
  return `INC-${year}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Generate the next incident number for a TPA tenant in a given year.
 *
 * Uses a SELECT of the highest existing number in that (tpa, year) bucket
 * plus one. Callers should insert inside a retry-on-unique-violation loop
 * for safety under concurrent writes — the column has a UNIQUE constraint.
 */
export async function generateIncidentNumber(params: {
  tpaOrgId: string;
  year?: number;
}): Promise<string> {
  const year = params.year ?? new Date().getUTCFullYear();

  // Fetch the highest existing incident number in this (tpa, year) bucket.
  // LIKE pattern scopes to the year; then we parse the numeric suffix.
  const rows = await db
    .select({ incidentNumber: injuries.incidentNumber })
    .from(injuries)
    .where(
      and(
        eq(injuries.tpaOrgId, params.tpaOrgId),
        sql`${injuries.incidentNumber} LIKE ${`INC-${year}-%`}`,
      ),
    );

  let max = 0;
  for (const r of rows) {
    const n = parseIncidentSequence(r.incidentNumber);
    if (n > max) max = n;
  }

  return formatIncidentNumber(year, max + 1);
}
