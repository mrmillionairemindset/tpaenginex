/**
 * POCT (Point-of-Care Testing) validation library.
 *
 * Validates AI cassette reader results, computes overall outcomes,
 * and provides hash utilities for tamper detection.
 */

import { createHash } from 'crypto';

// ============================================================================
// Constants
// ============================================================================

/**
 * Supported cassette types and their expected drug panels.
 * Each cassette type maps to the drugs that should be present in classified results.
 */
export const DRUG_PANELS: Record<string, string[]> = {
  AllSource_10Panel: [
    'AMP', 'BAR', 'BZO', 'COC', 'MET', 'MDMA', 'MTD', 'OPI', 'OXY', 'THC',
  ],
  AllSource_12Panel: [
    'AMP', 'BAR', 'BUP', 'BZO', 'COC', 'EDDP', 'MET', 'MDMA', 'MTD', 'OPI', 'OXY', 'THC',
  ],
  Quickscreen_5Panel: [
    'AMP', 'COC', 'MET', 'OPI', 'THC',
  ],
  Quickscreen_10Panel: [
    'AMP', 'BAR', 'BZO', 'COC', 'MET', 'MDMA', 'MTD', 'OPI', 'OXY', 'THC',
  ],
  DOT_5Panel: [
    'AMP', 'COC', 'MET', 'OPI', 'THC',
  ],
  iCup_13Panel: [
    'AMP', 'BAR', 'BUP', 'BZO', 'COC', 'EDDP', 'FYL', 'MET', 'MDMA', 'MTD', 'OPI', 'OXY', 'THC',
  ],
};

export const SUPPORTED_CASSETTE_TYPES = Object.keys(DRUG_PANELS);

export const VALID_DRUG_RESULTS = ['negative', 'positive', 'invalid'] as const;
export type DrugResult = typeof VALID_DRUG_RESULTS[number];

export const VALID_OVERALL_RESULTS = ['negative', 'non_negative', 'invalid'] as const;
export type OverallResult = typeof VALID_OVERALL_RESULTS[number];

// ============================================================================
// Types
// ============================================================================

export interface DrugClassification {
  drug: string;
  linePresent: boolean;
  intensity: number;
  result: DrugResult;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a single drug classification entry.
 */
function validateDrugEntry(entry: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `classifiedResult[${index}]`;

  if (typeof entry !== 'object' || entry === null) {
    errors.push({ field: prefix, message: 'Must be an object' });
    return errors;
  }

  const e = entry as Record<string, unknown>;

  if (typeof e.drug !== 'string' || e.drug.length === 0) {
    errors.push({ field: `${prefix}.drug`, message: 'Must be a non-empty string' });
  }

  if (typeof e.linePresent !== 'boolean') {
    errors.push({ field: `${prefix}.linePresent`, message: 'Must be a boolean' });
  }

  if (typeof e.intensity !== 'number' || e.intensity < 0 || e.intensity > 1) {
    errors.push({ field: `${prefix}.intensity`, message: 'Must be a number between 0.0 and 1.0' });
  }

  if (typeof e.result !== 'string' || !VALID_DRUG_RESULTS.includes(e.result as DrugResult)) {
    errors.push({
      field: `${prefix}.result`,
      message: `Must be one of: ${VALID_DRUG_RESULTS.join(', ')}`,
    });
  }

  return errors;
}

/**
 * Validate the full POCT classified result structure.
 * Checks:
 * - classifiedResult is a non-empty array
 * - Each entry has required fields with correct types
 * - All drugs have valid result values
 * - If cassetteType is provided, validates drug count matches expected panel
 */
export function validatePoctResult(
  classifiedResult: unknown,
  cassetteType?: string,
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Array.isArray(classifiedResult)) {
    return {
      valid: false,
      errors: [{ field: 'classifiedResult', message: 'Must be an array' }],
    };
  }

  if (classifiedResult.length === 0) {
    return {
      valid: false,
      errors: [{ field: 'classifiedResult', message: 'Must contain at least one drug classification' }],
    };
  }

  // Validate each entry
  for (let i = 0; i < classifiedResult.length; i++) {
    errors.push(...validateDrugEntry(classifiedResult[i], i));
  }

  // Check for duplicate drugs
  const drugs = classifiedResult
    .filter((e: unknown) => typeof e === 'object' && e !== null && typeof (e as Record<string, unknown>).drug === 'string')
    .map((e: unknown) => (e as Record<string, unknown>).drug as string);
  const uniqueDrugs = new Set(drugs);
  if (uniqueDrugs.size !== drugs.length) {
    errors.push({ field: 'classifiedResult', message: 'Contains duplicate drug entries' });
  }

  // Validate against cassette type if provided
  if (cassetteType && DRUG_PANELS[cassetteType]) {
    const expectedDrugs = DRUG_PANELS[cassetteType];
    if (classifiedResult.length !== expectedDrugs.length) {
      errors.push({
        field: 'classifiedResult',
        message: `Expected ${expectedDrugs.length} drugs for ${cassetteType}, got ${classifiedResult.length}`,
      });
    }

    // Check that all expected drugs are present
    for (const expectedDrug of expectedDrugs) {
      if (!drugs.includes(expectedDrug)) {
        errors.push({
          field: 'classifiedResult',
          message: `Missing expected drug "${expectedDrug}" for cassette type ${cassetteType}`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a cassette type string.
 */
export function isValidCassetteType(cassetteType: string): boolean {
  return SUPPORTED_CASSETTE_TYPES.includes(cassetteType);
}

// ============================================================================
// Result computation
// ============================================================================

/**
 * Compute the overall POCT result from individual drug classifications.
 *
 * Logic:
 * - If control line is not valid -> "invalid"
 * - If any drug result is "invalid" -> "invalid"
 * - If any drug result is "positive" -> "non_negative"
 * - Otherwise -> "negative"
 */
export function computeOverallResult(
  classifiedResult: DrugClassification[],
  controlLineValid: boolean,
): OverallResult {
  if (!controlLineValid) {
    return 'invalid';
  }

  let hasPositive = false;

  for (const entry of classifiedResult) {
    if (entry.result === 'invalid') {
      return 'invalid';
    }
    if (entry.result === 'positive') {
      hasPositive = true;
    }
  }

  return hasPositive ? 'non_negative' : 'negative';
}

// ============================================================================
// Tamper detection
// ============================================================================

/**
 * Compute SHA-256 hex digest of raw image bytes for tamper detection.
 */
export function computeImageHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
