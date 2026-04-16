import { describe, it, expect } from 'vitest';
import {
  validatePoctResult,
  computeOverallResult,
  computeImageHash,
  isValidCassetteType,
  SUPPORTED_CASSETTE_TYPES,
  DRUG_PANELS,
  type DrugClassification,
} from '../poct-validation';

// ---------------------------------------------------------------------------
// Helper to build a valid classification entry
// ---------------------------------------------------------------------------

function makeDrug(
  drug: string,
  result: 'negative' | 'positive' | 'invalid' = 'negative',
  intensity = 0.95,
): DrugClassification {
  return { drug, linePresent: result === 'negative', intensity, result };
}

function make5Panel(override?: Partial<DrugClassification>[]): DrugClassification[] {
  const drugs = ['AMP', 'COC', 'MET', 'OPI', 'THC'];
  return drugs.map((d, i) => ({
    ...makeDrug(d),
    ...(override?.[i] ?? {}),
  }));
}

// ============================================================================
// validatePoctResult
// ============================================================================

describe('validatePoctResult', () => {
  it('accepts a valid classified result', () => {
    const result = validatePoctResult(make5Panel());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-array input', () => {
    const result = validatePoctResult('not an array');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toBe('Must be an array');
  });

  it('rejects empty array', () => {
    const result = validatePoctResult([]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('at least one');
  });

  it('rejects entries missing required fields', () => {
    const result = validatePoctResult([{ drug: 'THC' }]);
    expect(result.valid).toBe(false);
    // Should flag linePresent, intensity, result as missing
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects invalid result value', () => {
    const result = validatePoctResult([
      { drug: 'THC', linePresent: true, intensity: 0.8, result: 'maybe' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field.includes('result'))).toBe(true);
  });

  it('rejects intensity out of range', () => {
    const result = validatePoctResult([
      { drug: 'THC', linePresent: true, intensity: 1.5, result: 'negative' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field.includes('intensity'))).toBe(true);
  });

  it('rejects duplicate drug entries', () => {
    const result = validatePoctResult([
      makeDrug('THC'),
      makeDrug('THC'),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('duplicate'))).toBe(true);
  });

  it('validates drug count against cassette type', () => {
    // 5-panel cassette but only 3 drugs
    const result = validatePoctResult(
      [makeDrug('AMP'), makeDrug('COC'), makeDrug('THC')],
      'Quickscreen_5Panel',
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Expected 5'))).toBe(true);
  });

  it('validates expected drugs are present for cassette type', () => {
    // Quickscreen_5Panel expects AMP, COC, MET, OPI, THC — give it wrong drugs
    const wrongDrugs = [
      makeDrug('AMP'), makeDrug('COC'), makeDrug('MET'), makeDrug('OPI'), makeDrug('BAR'),
    ];
    const result = validatePoctResult(wrongDrugs, 'Quickscreen_5Panel');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Missing expected drug "THC"'))).toBe(true);
  });

  it('passes validation with correct cassette type', () => {
    const panel = DRUG_PANELS['Quickscreen_5Panel'].map(d => makeDrug(d));
    const result = validatePoctResult(panel, 'Quickscreen_5Panel');
    expect(result.valid).toBe(true);
  });

  it('ignores cassette type validation for unknown types', () => {
    // Unknown cassette type should not trigger panel validation
    const result = validatePoctResult([makeDrug('THC')], 'Unknown_Panel');
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// isValidCassetteType
// ============================================================================

describe('isValidCassetteType', () => {
  it('accepts known cassette types', () => {
    for (const ct of SUPPORTED_CASSETTE_TYPES) {
      expect(isValidCassetteType(ct)).toBe(true);
    }
  });

  it('rejects unknown cassette types', () => {
    expect(isValidCassetteType('FakeBrand_99Panel')).toBe(false);
  });
});

// ============================================================================
// computeOverallResult
// ============================================================================

describe('computeOverallResult', () => {
  it('returns "negative" when all drugs negative and control valid', () => {
    const result = computeOverallResult(make5Panel(), true);
    expect(result).toBe('negative');
  });

  it('returns "non_negative" when any drug is positive', () => {
    const panel = make5Panel();
    panel[4] = makeDrug('THC', 'positive', 0.3);
    const result = computeOverallResult(panel, true);
    expect(result).toBe('non_negative');
  });

  it('returns "invalid" when control line is not valid', () => {
    const result = computeOverallResult(make5Panel(), false);
    expect(result).toBe('invalid');
  });

  it('returns "invalid" when any drug result is invalid', () => {
    const panel = make5Panel();
    panel[2] = makeDrug('MET', 'invalid', 0.1);
    const result = computeOverallResult(panel, true);
    expect(result).toBe('invalid');
  });

  it('returns "invalid" for invalid control even with positives', () => {
    const panel = make5Panel();
    panel[0] = makeDrug('AMP', 'positive');
    const result = computeOverallResult(panel, false);
    expect(result).toBe('invalid');
  });

  it('returns "non_negative" with multiple positives', () => {
    const panel = make5Panel();
    panel[0] = makeDrug('AMP', 'positive', 0.2);
    panel[4] = makeDrug('THC', 'positive', 0.15);
    const result = computeOverallResult(panel, true);
    expect(result).toBe('non_negative');
  });
});

// ============================================================================
// computeImageHash
// ============================================================================

describe('computeImageHash', () => {
  it('returns a 64-character hex string', () => {
    const hash = computeImageHash(Buffer.from('test image data'));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for the same input', () => {
    const data = Buffer.from('cassette photo bytes');
    const hash1 = computeImageHash(data);
    const hash2 = computeImageHash(data);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = computeImageHash(Buffer.from('image A'));
    const hash2 = computeImageHash(Buffer.from('image B'));
    expect(hash1).not.toBe(hash2);
  });

  it('produces correct SHA-256 for known input', () => {
    // SHA-256 of empty string is well-known
    const hash = computeImageHash(Buffer.from(''));
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

// ============================================================================
// DRUG_PANELS constant
// ============================================================================

describe('DRUG_PANELS', () => {
  it('DOT_5Panel has exactly 5 drugs', () => {
    expect(DRUG_PANELS['DOT_5Panel']).toHaveLength(5);
  });

  it('AllSource_10Panel has exactly 10 drugs', () => {
    expect(DRUG_PANELS['AllSource_10Panel']).toHaveLength(10);
  });

  it('AllSource_12Panel has exactly 12 drugs', () => {
    expect(DRUG_PANELS['AllSource_12Panel']).toHaveLength(12);
  });

  it('iCup_13Panel has exactly 13 drugs', () => {
    expect(DRUG_PANELS['iCup_13Panel']).toHaveLength(13);
  });

  it('all panels have unique drug codes', () => {
    for (const [name, drugs] of Object.entries(DRUG_PANELS)) {
      const unique = new Set(drugs);
      expect(unique.size).toBe(drugs.length);
    }
  });
});
