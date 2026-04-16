/**
 * FMCSA DOT Physical Exam logic.
 *
 * The Medical Examiner's Certificate (MEC) expiration date is NOT always
 * 2 years. Per 49 CFR 391.41-391.49 and the FMCSA Medical Examiner's
 * Handbook, specific medical findings shorten the certification period.
 *
 * Default: 24 months (2 years)
 * Shortened periods:
 *   - 12 months (1 year) — hypertension Stage 1 (140-159 / 90-99), diabetes
 *     non-insulin, stable cardiovascular conditions, sleep apnea on CPAP
 *   -  3 months — hypertension Stage 3 (>=180 / >=110) for treatment response
 *   -  0 months (disqualified) — current disqualifying conditions
 *
 * This implementation codifies the most common rules. More nuanced cases
 * (specialist evaluations, conditional certifications) require examiner
 * override — the function returns a recommended expiration which the
 * examiner can adjust within the UI.
 *
 * References:
 *   - 49 CFR 391.43 (Medical examination; certificate of physical examination)
 *   - FMCSA Medical Examiner's Handbook, Ch. 4-15
 *   - Joint National Committee (JNC) hypertension staging
 */

export type FindingCategory =
  // Hypertension per JNC criteria
  | 'hypertension_stage1'   // 140-159 / 90-99
  | 'hypertension_stage2'   // 160-179 / 100-109
  | 'hypertension_stage3'   // >=180 / >=110
  // Diabetes
  | 'diabetes_insulin'
  | 'diabetes_non_insulin'
  // Cardiovascular
  | 'cardiovascular_stable'
  | 'cardiovascular_unstable'
  // Respiratory
  | 'sleep_apnea_osa'       // on CPAP — 1 year cert
  | 'sleep_apnea_untreated' // disqualifying
  | 'copd'
  | 'asthma_controlled'
  // Vision
  | 'vision_monocular'      // federal exemption required
  | 'vision_corrected'      // corrective lenses — no period shortening
  // Hearing
  | 'hearing_aid'           // no period shortening
  | 'hearing_impaired'      // federal exemption required
  // Musculoskeletal / Neurological
  | 'musculoskeletal_limb'  // federal exemption required
  | 'neurological_seizure'  // disqualifying unless exemption
  | 'neurological_stable'
  // Psychiatric
  | 'psychiatric_controlled'
  | 'psychiatric_active'    // disqualifying
  // Other
  | 'other';

export type CertificationDecision =
  | 'medically_qualified'
  | 'qualified_with_restrictions'
  | 'temporarily_disqualified'
  | 'disqualified'
  | 'pending_evaluation';

export interface MecDurationResult {
  /** Months of validity. 0 means disqualified or pending. */
  months: number;
  /** Suggested certification status based on findings. */
  decision: CertificationDecision;
  /** Human-readable explanation of why this duration was selected. */
  reason: string;
  /** Standard restrictions that apply (e.g., "wear corrective lenses"). */
  restrictions: string[];
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Determine the MEC certification duration from a list of exam findings.
 *
 * Rule resolution: the SHORTEST period among applicable rules wins, so any
 * disqualifying finding results in disqualification regardless of other
 * findings. A "disqualified" result means months=0 and decision=disqualified.
 *
 * The function does NOT examine the driver's history or other context;
 * callers may override the result in the UI with examiner notes.
 */
export function calculateMecDuration(
  findings: FindingCategory[],
): MecDurationResult {
  // Default: 2 years, fully qualified, no restrictions.
  let months = 24;
  let decision: CertificationDecision = 'medically_qualified';
  const restrictions: string[] = [];
  const reasons: string[] = [];

  // Helper: update result if the new finding is MORE restrictive
  function apply(
    candidateMonths: number,
    candidateDecision: CertificationDecision,
    reason: string,
  ) {
    // For periods: shorter wins. But pending_evaluation and disqualified
    // override everything else.
    if (candidateDecision === 'disqualified') {
      months = 0;
      decision = 'disqualified';
      reasons.push(reason);
      return;
    }
    if (
      candidateDecision === 'pending_evaluation' &&
      decision !== 'disqualified'
    ) {
      months = 0;
      decision = 'pending_evaluation';
      reasons.push(reason);
      return;
    }
    if (
      candidateDecision === 'temporarily_disqualified' &&
      decision !== 'disqualified' &&
      decision !== 'pending_evaluation'
    ) {
      months = 0;
      decision = 'temporarily_disqualified';
      reasons.push(reason);
      return;
    }
    // Restrictions & shortened periods: take the minimum months
    if (candidateMonths < months) {
      months = candidateMonths;
      reasons.push(reason);
    }
    if (
      candidateDecision === 'qualified_with_restrictions' &&
      decision === 'medically_qualified'
    ) {
      decision = 'qualified_with_restrictions';
    }
  }

  for (const f of findings) {
    switch (f) {
      // Hypertension
      case 'hypertension_stage1':
        apply(12, 'medically_qualified', 'Stage 1 hypertension (140-159/90-99): 1-year cert');
        break;
      case 'hypertension_stage2':
        apply(12, 'qualified_with_restrictions', 'Stage 2 hypertension (160-179/100-109): 1-year cert with treatment');
        restrictions.push('Blood pressure must be controlled at follow-up');
        break;
      case 'hypertension_stage3':
        apply(3, 'temporarily_disqualified', 'Stage 3 hypertension (>=180/>=110): disqualified until BP controlled, then 3-month cert');
        break;

      // Diabetes
      case 'diabetes_insulin':
        apply(12, 'qualified_with_restrictions', 'Insulin-treated diabetes: 1-year cert per 391.46 federal exemption');
        restrictions.push('Insulin-treated diabetes federal exemption required');
        break;
      case 'diabetes_non_insulin':
        apply(12, 'medically_qualified', 'Non-insulin diabetes: 1-year cert');
        break;

      // Cardiovascular
      case 'cardiovascular_stable':
        apply(12, 'qualified_with_restrictions', 'Stable cardiovascular condition: 1-year cert');
        restrictions.push('Cardiology clearance on file');
        break;
      case 'cardiovascular_unstable':
        apply(0, 'disqualified', 'Unstable cardiovascular condition is disqualifying');
        break;

      // Respiratory
      case 'sleep_apnea_osa':
        apply(12, 'qualified_with_restrictions', 'OSA on CPAP therapy: 1-year cert with CPAP compliance');
        restrictions.push('CPAP compliance report required at next exam');
        break;
      case 'sleep_apnea_untreated':
        apply(0, 'temporarily_disqualified', 'Untreated sleep apnea: disqualified until treatment established');
        break;
      case 'copd':
        apply(12, 'medically_qualified', 'COPD: 1-year cert');
        break;
      case 'asthma_controlled':
        // No period shortening if fully controlled
        break;

      // Vision
      case 'vision_monocular':
        apply(24, 'qualified_with_restrictions', 'Monocular vision requires federal exemption (FMCSA Form MCSA-5870)');
        restrictions.push('Federal vision exemption required');
        break;
      case 'vision_corrected':
        restrictions.push('Must wear corrective lenses while driving');
        if (decision === 'medically_qualified') {
          decision = 'qualified_with_restrictions';
        }
        break;

      // Hearing
      case 'hearing_aid':
        restrictions.push('Must wear hearing aid while driving');
        if (decision === 'medically_qualified') {
          decision = 'qualified_with_restrictions';
        }
        break;
      case 'hearing_impaired':
        apply(24, 'qualified_with_restrictions', 'Hearing impairment requires federal exemption');
        restrictions.push('Federal hearing exemption required');
        break;

      // Musculoskeletal / Neurological
      case 'musculoskeletal_limb':
        apply(24, 'qualified_with_restrictions', 'Limb impairment requires SPE certificate (FMCSA Form MCSA-5870)');
        restrictions.push('SPE (Skill Performance Evaluation) certificate required');
        break;
      case 'neurological_seizure':
        apply(0, 'disqualified', 'Active seizure disorder is disqualifying per 391.41(b)(8)');
        break;
      case 'neurological_stable':
        apply(12, 'qualified_with_restrictions', 'Stable neurological condition: 1-year cert');
        break;

      // Psychiatric
      case 'psychiatric_controlled':
        apply(12, 'medically_qualified', 'Controlled psychiatric condition: 1-year cert');
        break;
      case 'psychiatric_active':
        apply(0, 'disqualified', 'Active psychiatric condition affecting ability to drive is disqualifying');
        break;

      // Other
      case 'other':
        // No automatic action — examiner must set the period manually
        apply(24, 'pending_evaluation', 'Other finding requires examiner evaluation');
        break;
    }
  }

  return {
    months,
    decision,
    reason: reasons.length > 0 ? reasons.join('; ') : 'Standard 2-year certification — no qualifying findings',
    restrictions: Array.from(new Set(restrictions)), // dedupe
  };
}

/**
 * Calculate the expiration date given an exam date + duration in months.
 * Uses calendar arithmetic, NOT days, so leap years and month lengths work correctly.
 *
 * If months is 0, returns null (driver is disqualified or pending).
 */
export function calculateMecExpirationDate(
  examDate: Date,
  months: number,
): Date | null {
  if (months <= 0) return null;

  const originalDay = examDate.getDate();
  const rawTargetMonth = examDate.getMonth() + months;
  const targetYear = examDate.getFullYear() + Math.floor(rawTargetMonth / 12);
  const targetMonth = ((rawTargetMonth % 12) + 12) % 12;

  // Last day of the target month — handles leap years correctly via Date(y, m+1, 0)
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(originalDay, lastDayOfTargetMonth);

  // Preserve the time of day from the original exam date.
  const d = new Date(examDate.getTime());
  d.setFullYear(targetYear, targetMonth, targetDay);
  return d;
}

/**
 * Generate a deterministic MEC certificate number.
 * Format: MEC-{yymmdd}-{6 random uppercase alphanumeric}
 * Uniqueness is enforced at the DB level (uq_physical_cert_number).
 *
 * We don't encode any PII in the number — just a human-friendly random tag.
 */
export function generateMecCertificateNumber(issuedAt: Date): string {
  // Use UTC date accessors so the certificate date is stable across timezones.
  // A server in PT and one in ET should stamp the same certificate the same way.
  const yy = String(issuedAt.getUTCFullYear()).slice(-2);
  const mm = String(issuedAt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(issuedAt.getUTCDate()).padStart(2, '0');
  // Alphabet: uppercase A-Z + 2-9, EXCLUDING I, O, 0, 1 to avoid visual ambiguity.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars
  let suffix = '';
  const bytes = new Uint8Array(6);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomFillSync } = require('crypto') as typeof import('crypto');
  randomFillSync(bytes);
  for (let i = 0; i < 6; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `MEC-${yy}${mm}${dd}-${suffix}`;
}

/**
 * Compute BMI from height (inches) and weight (pounds).
 * BMI >= 40 is an FMCSA sleep apnea screening trigger.
 */
export function calculateBmi(
  heightInches: number,
  weightPounds: number,
): number {
  if (heightInches <= 0 || weightPounds <= 0) return 0;
  return Math.round((weightPounds / (heightInches * heightInches)) * 703 * 10) / 10;
}

/**
 * Evaluate blood pressure against FMCSA hypertension thresholds.
 * Returns the appropriate FindingCategory or null if normal.
 */
export function evaluateBloodPressure(
  systolic: number,
  diastolic: number,
): FindingCategory | null {
  if (systolic >= 180 || diastolic >= 110) return 'hypertension_stage3';
  if (systolic >= 160 || diastolic >= 100) return 'hypertension_stage2';
  if (systolic >= 140 || diastolic >= 90) return 'hypertension_stage1';
  return null;
}

/**
 * Evaluate corrected vision against FMCSA minimum (20/40 in each eye
 * separately and both eyes together, horizontal field of at least 70°).
 * Returns true if the driver meets the standard.
 *
 * Accepts strings like "20/40", "20/25", etc. Returns false if format invalid.
 */
export function meetsVisionStandard(
  correctedRight: string | null,
  correctedLeft: string | null,
  correctedBoth: string | null,
  horizontalRight: number | null,
  horizontalLeft: number | null,
): boolean {
  const parse = (s: string | null): number | null => {
    if (!s) return null;
    const m = s.match(/^20\/(\d+)$/);
    return m ? Number(m[1]) : null;
  };

  const r = parse(correctedRight);
  const l = parse(correctedLeft);
  const b = parse(correctedBoth);

  if (r === null || l === null || b === null) return false;
  if (r > 40 || l > 40 || b > 40) return false;
  if ((horizontalRight ?? 0) < 70 || (horizontalLeft ?? 0) < 70) return false;
  return true;
}
