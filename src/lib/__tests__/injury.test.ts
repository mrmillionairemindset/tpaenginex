import { describe, it, expect } from 'vitest';
import {
  classifyOsha300Row,
  formatIncidentNumber,
  isOshaRecordableBySeverity,
  parseIncidentSequence,
} from '../injury';

describe('isOshaRecordableBySeverity', () => {
  it('first_aid is NOT recordable (29 CFR 1904.7(b)(5))', () => {
    expect(isOshaRecordableBySeverity('first_aid')).toBe(false);
  });

  it('medical treatment beyond first aid IS recordable', () => {
    expect(isOshaRecordableBySeverity('medical')).toBe(true);
  });

  it('lost time / days away IS recordable', () => {
    expect(isOshaRecordableBySeverity('lost_time')).toBe(true);
  });

  it('restricted duty / transfer IS recordable', () => {
    expect(isOshaRecordableBySeverity('restricted_duty')).toBe(true);
  });

  it('fatality IS recordable (and must be reported within 8 hrs)', () => {
    expect(isOshaRecordableBySeverity('fatality')).toBe(true);
  });
});

describe('classifyOsha300Row', () => {
  it('fatality always classifies as column G (death), even if days away also recorded', () => {
    expect(
      classifyOsha300Row({
        severity: 'fatality',
        lostDaysCount: 14,
        restrictedDaysCount: 0,
      }),
    ).toBe('death');
  });

  it('lost time with days > 0 classifies as column H (days away)', () => {
    expect(
      classifyOsha300Row({
        severity: 'lost_time',
        lostDaysCount: 5,
        restrictedDaysCount: 0,
      }),
    ).toBe('days_away');
  });

  it('days-away severity with zero counts still lands in H (days away)', () => {
    // Regulation: severity marks it as a days-away case even before the worker
    // returns and we know the final count.
    expect(
      classifyOsha300Row({
        severity: 'lost_time',
        lostDaysCount: 0,
        restrictedDaysCount: 0,
      }),
    ).toBe('days_away');
  });

  it('restricted duty with restricted days > 0 classifies as column I', () => {
    expect(
      classifyOsha300Row({
        severity: 'restricted_duty',
        lostDaysCount: 0,
        restrictedDaysCount: 3,
      }),
    ).toBe('transfer_restriction');
  });

  it('days-away outranks restricted-duty when both are present', () => {
    // An injury that caused both restricted days AND days away goes in H.
    expect(
      classifyOsha300Row({
        severity: 'lost_time',
        lostDaysCount: 2,
        restrictedDaysCount: 5,
      }),
    ).toBe('days_away');
  });

  it('medical-only recordable case lands in column J (other)', () => {
    expect(
      classifyOsha300Row({
        severity: 'medical',
        lostDaysCount: 0,
        restrictedDaysCount: 0,
      }),
    ).toBe('other');
  });

  it('first_aid technically resolves to "other" but should never be recorded — caller filters by osha_recordable first', () => {
    // This is a safety-net behavior. The OSHA 300 generator is expected to
    // drop non-recordable rows BEFORE calling the classifier. We still want
    // a deterministic output so buggy callers don't crash.
    expect(
      classifyOsha300Row({
        severity: 'first_aid',
        lostDaysCount: 0,
        restrictedDaysCount: 0,
      }),
    ).toBe('other');
  });
});

describe('incident number formatting', () => {
  it('pads the sequence to 5 digits', () => {
    expect(formatIncidentNumber(2026, 1)).toBe('INC-2026-00001');
    expect(formatIncidentNumber(2026, 42)).toBe('INC-2026-00042');
    expect(formatIncidentNumber(2026, 99999)).toBe('INC-2026-99999');
  });

  it('tolerates sequences exceeding 5 digits (no truncation)', () => {
    expect(formatIncidentNumber(2026, 100000)).toBe('INC-2026-100000');
  });

  it('parses a valid incident number back to its sequence', () => {
    expect(parseIncidentSequence('INC-2026-00001')).toBe(1);
    expect(parseIncidentSequence('INC-2026-00042')).toBe(42);
    expect(parseIncidentSequence('INC-2099-12345')).toBe(12345);
  });

  it('returns 0 for malformed or missing inputs', () => {
    expect(parseIncidentSequence(null)).toBe(0);
    expect(parseIncidentSequence(undefined)).toBe(0);
    expect(parseIncidentSequence('')).toBe(0);
    expect(parseIncidentSequence('INC-2026')).toBe(0);
    expect(parseIncidentSequence('ORDER-2026-00001')).toBe(0);
    expect(parseIncidentSequence('random')).toBe(0);
  });

  it('round-trips format ↔ parse', () => {
    for (const n of [1, 2, 17, 999, 10000]) {
      expect(parseIncidentSequence(formatIncidentNumber(2026, n))).toBe(n);
    }
  });
});
