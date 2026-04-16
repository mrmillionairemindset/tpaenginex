import { describe, it, expect } from 'vitest';
import {
  calculateMecDuration,
  calculateMecExpirationDate,
  generateMecCertificateNumber,
  calculateBmi,
  evaluateBloodPressure,
  meetsVisionStandard,
} from '../dot-physical';

describe('calculateMecDuration', () => {
  it('defaults to 24 months with no findings', () => {
    const r = calculateMecDuration([]);
    expect(r.months).toBe(24);
    expect(r.decision).toBe('medically_qualified');
    expect(r.restrictions).toEqual([]);
  });

  it('shortens to 12 months for Stage 1 hypertension', () => {
    const r = calculateMecDuration(['hypertension_stage1']);
    expect(r.months).toBe(12);
    expect(r.decision).toBe('medically_qualified');
  });

  it('disqualifies Stage 3 hypertension (temporarily)', () => {
    const r = calculateMecDuration(['hypertension_stage3']);
    expect(r.months).toBe(0);
    expect(r.decision).toBe('temporarily_disqualified');
  });

  it('disqualifies active seizure disorder', () => {
    const r = calculateMecDuration(['neurological_seizure']);
    expect(r.months).toBe(0);
    expect(r.decision).toBe('disqualified');
  });

  it('adds restriction for corrective lenses but keeps 24 months', () => {
    const r = calculateMecDuration(['vision_corrected']);
    expect(r.months).toBe(24);
    expect(r.decision).toBe('qualified_with_restrictions');
    expect(r.restrictions).toContain('Must wear corrective lenses while driving');
  });

  it('combines multiple findings — shortest period wins', () => {
    // Stage 2 hypertension (12 months) + corrective lenses (no period change)
    // → result: 12 months, qualified_with_restrictions, BP-control restriction
    const r = calculateMecDuration(['hypertension_stage2', 'vision_corrected']);
    expect(r.months).toBe(12);
    expect(r.decision).toBe('qualified_with_restrictions');
    expect(r.restrictions).toContain('Must wear corrective lenses while driving');
  });

  it('disqualification overrides other findings', () => {
    // Even with other "qualified" findings, active seizure disqualifies
    const r = calculateMecDuration([
      'vision_corrected',
      'hearing_aid',
      'neurological_seizure',
    ]);
    expect(r.months).toBe(0);
    expect(r.decision).toBe('disqualified');
  });

  it('insulin diabetes requires federal exemption (12 months)', () => {
    const r = calculateMecDuration(['diabetes_insulin']);
    expect(r.months).toBe(12);
    expect(r.decision).toBe('qualified_with_restrictions');
    expect(r.restrictions).toContain('Insulin-treated diabetes federal exemption required');
  });

  it('non-insulin diabetes — 12 months, no restriction', () => {
    const r = calculateMecDuration(['diabetes_non_insulin']);
    expect(r.months).toBe(12);
    expect(r.decision).toBe('medically_qualified');
  });

  it('OSA on CPAP — 12 months with compliance requirement', () => {
    const r = calculateMecDuration(['sleep_apnea_osa']);
    expect(r.months).toBe(12);
    expect(r.decision).toBe('qualified_with_restrictions');
    expect(r.restrictions.some((s) => s.includes('CPAP'))).toBe(true);
  });

  it('untreated sleep apnea — temporarily disqualified', () => {
    const r = calculateMecDuration(['sleep_apnea_untreated']);
    expect(r.months).toBe(0);
    expect(r.decision).toBe('temporarily_disqualified');
  });

  it('unstable cardiovascular is disqualifying', () => {
    const r = calculateMecDuration(['cardiovascular_unstable']);
    expect(r.months).toBe(0);
    expect(r.decision).toBe('disqualified');
  });

  it('stable neurological condition — 12 months with restriction', () => {
    const r = calculateMecDuration(['neurological_stable']);
    expect(r.months).toBe(12);
    expect(r.decision).toBe('qualified_with_restrictions');
  });

  it('dedupes restrictions when multiple findings impose the same one', () => {
    const r = calculateMecDuration(['vision_corrected', 'vision_corrected']);
    const lensRestrictions = r.restrictions.filter((s) =>
      s.includes('corrective lenses')
    );
    expect(lensRestrictions).toHaveLength(1);
  });

  it('provides a human-readable reason', () => {
    const r = calculateMecDuration(['hypertension_stage1']);
    expect(r.reason).toMatch(/Stage 1 hypertension/i);
  });

  it('explains default case when no findings', () => {
    const r = calculateMecDuration([]);
    expect(r.reason).toMatch(/Standard 2-year/i);
  });

  it('monocular vision requires federal exemption, keeps 24 months', () => {
    const r = calculateMecDuration(['vision_monocular']);
    expect(r.months).toBe(24);
    expect(r.decision).toBe('qualified_with_restrictions');
    expect(r.restrictions).toContain('Federal vision exemption required');
  });

  it('psychiatric active is disqualifying', () => {
    const r = calculateMecDuration(['psychiatric_active']);
    expect(r.decision).toBe('disqualified');
  });

  it('controlled psychiatric — 12 months, qualified', () => {
    const r = calculateMecDuration(['psychiatric_controlled']);
    expect(r.months).toBe(12);
    expect(r.decision).toBe('medically_qualified');
  });

  it('pending_evaluation for "other" category', () => {
    const r = calculateMecDuration(['other']);
    expect(r.decision).toBe('pending_evaluation');
    expect(r.months).toBe(0);
  });

  it('disqualified overrides pending_evaluation', () => {
    const r = calculateMecDuration(['other', 'neurological_seizure']);
    expect(r.decision).toBe('disqualified');
  });
});

describe('calculateMecExpirationDate', () => {
  it('adds 24 months to exam date', () => {
    const exam = new Date(2025, 0, 15, 12, 0, 0); // Jan 15, 2025 noon local
    const exp = calculateMecExpirationDate(exam, 24);
    expect(exp?.getFullYear()).toBe(2027);
    expect(exp?.getMonth()).toBe(0);  // January
    expect(exp?.getDate()).toBe(15);
  });

  it('adds 12 months correctly', () => {
    const exam = new Date(2025, 5, 20, 12, 0, 0); // June 20, 2025 noon local
    const exp = calculateMecExpirationDate(exam, 12);
    expect(exp?.getFullYear()).toBe(2026);
    expect(exp?.getMonth()).toBe(5);  // June
    expect(exp?.getDate()).toBe(20);
  });

  it('handles 3-month certificates', () => {
    const exam = new Date(2025, 2, 1, 12, 0, 0); // March 1, 2025 noon local
    const exp = calculateMecExpirationDate(exam, 3);
    expect(exp?.getFullYear()).toBe(2025);
    expect(exp?.getMonth()).toBe(5);  // June
    expect(exp?.getDate()).toBe(1);
  });

  it('returns null for 0 months (disqualified)', () => {
    expect(calculateMecExpirationDate(new Date(), 0)).toBe(null);
    expect(calculateMecExpirationDate(new Date(), -1)).toBe(null);
  });

  it('handles Jan 31 + 1 month correctly (no wraparound to March)', () => {
    // Feb doesn't have 31 days. Naive date math would push to March 3.
    // Our implementation clamps to end of Feb (Feb 28 in a non-leap year).
    // We use noon local time to avoid timezone edge cases near midnight.
    const exam = new Date(2025, 0, 31, 12, 0, 0); // Jan 31, 2025 noon local
    const exp = calculateMecExpirationDate(exam, 1);
    expect(exp?.getMonth()).toBe(1); // February
    expect(exp?.getDate()).toBe(28); // 2025 is not a leap year
  });

  it('handles leap year Feb 29', () => {
    const exam = new Date(2024, 0, 31, 12, 0, 0); // Jan 31, 2024 noon local
    const exp = calculateMecExpirationDate(exam, 1);
    expect(exp?.getMonth()).toBe(1); // February
    expect(exp?.getDate()).toBe(29); // 2024 IS a leap year
  });
});

describe('generateMecCertificateNumber', () => {
  it('follows MEC-yymmdd-XXXXXX format', () => {
    // Use UTC noon so the date is unambiguously April 15 in any timezone.
    const num = generateMecCertificateNumber(new Date('2025-04-15T12:00:00Z'));
    expect(num).toMatch(/^MEC-250415-[A-HJ-NP-Z2-9]{6}$/);
  });

  it('avoids confusing characters (I, O, 0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const num = generateMecCertificateNumber(new Date());
      const suffix = num.split('-')[2];
      expect(suffix).not.toMatch(/[IO01]/);
    }
  });

  it('produces unique numbers across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      seen.add(generateMecCertificateNumber(new Date('2025-04-15T00:00:00Z')));
    }
    // 500 random 6-char strings from a 33-char alphabet — collisions astronomically unlikely
    expect(seen.size).toBe(500);
  });
});

describe('calculateBmi', () => {
  it('calculates BMI correctly for a 70in/180lb person', () => {
    // 180 / 70² × 703 = 25.8...
    expect(calculateBmi(70, 180)).toBeCloseTo(25.8, 1);
  });

  it('returns 0 for invalid input', () => {
    expect(calculateBmi(0, 180)).toBe(0);
    expect(calculateBmi(70, 0)).toBe(0);
    expect(calculateBmi(-1, 180)).toBe(0);
  });

  it('rounds to 1 decimal', () => {
    const bmi = calculateBmi(72, 200);
    expect(Number.isFinite(bmi)).toBe(true);
    const decimals = (bmi.toString().split('.')[1] || '').length;
    expect(decimals).toBeLessThanOrEqual(1);
  });
});

describe('evaluateBloodPressure', () => {
  it('normal BP returns null', () => {
    expect(evaluateBloodPressure(120, 80)).toBe(null);
    expect(evaluateBloodPressure(130, 85)).toBe(null);
  });

  it('Stage 1 hypertension — systolic 140-159 OR diastolic 90-99', () => {
    expect(evaluateBloodPressure(140, 85)).toBe('hypertension_stage1');
    expect(evaluateBloodPressure(120, 95)).toBe('hypertension_stage1');
    expect(evaluateBloodPressure(159, 99)).toBe('hypertension_stage1');
  });

  it('Stage 2 hypertension — systolic 160-179 OR diastolic 100-109', () => {
    expect(evaluateBloodPressure(160, 85)).toBe('hypertension_stage2');
    expect(evaluateBloodPressure(120, 105)).toBe('hypertension_stage2');
    expect(evaluateBloodPressure(179, 109)).toBe('hypertension_stage2');
  });

  it('Stage 3 hypertension — systolic >=180 OR diastolic >=110', () => {
    expect(evaluateBloodPressure(180, 85)).toBe('hypertension_stage3');
    expect(evaluateBloodPressure(120, 110)).toBe('hypertension_stage3');
    expect(evaluateBloodPressure(200, 130)).toBe('hypertension_stage3');
  });

  it('takes the HIGHER stage when systolic and diastolic disagree', () => {
    expect(evaluateBloodPressure(145, 110)).toBe('hypertension_stage3'); // Diastolic Stage 3
    expect(evaluateBloodPressure(200, 70)).toBe('hypertension_stage3');  // Systolic Stage 3
  });
});

describe('meetsVisionStandard', () => {
  it('passes with 20/40 or better in each eye + 70° peripheral', () => {
    expect(meetsVisionStandard('20/40', '20/40', '20/40', 70, 70)).toBe(true);
    expect(meetsVisionStandard('20/20', '20/25', '20/20', 90, 90)).toBe(true);
  });

  it('fails if any eye is worse than 20/40', () => {
    expect(meetsVisionStandard('20/50', '20/40', '20/40', 70, 70)).toBe(false);
    expect(meetsVisionStandard('20/40', '20/70', '20/40', 70, 70)).toBe(false);
    expect(meetsVisionStandard('20/40', '20/40', '20/80', 70, 70)).toBe(false);
  });

  it('fails if peripheral field <70° in either eye', () => {
    expect(meetsVisionStandard('20/40', '20/40', '20/40', 65, 70)).toBe(false);
    expect(meetsVisionStandard('20/40', '20/40', '20/40', 70, 60)).toBe(false);
  });

  it('fails on invalid format', () => {
    expect(meetsVisionStandard('20/', '20/40', '20/40', 70, 70)).toBe(false);
    expect(meetsVisionStandard('abc', '20/40', '20/40', 70, 70)).toBe(false);
    expect(meetsVisionStandard(null, '20/40', '20/40', 70, 70)).toBe(false);
  });
});
