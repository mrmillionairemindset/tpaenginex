import { describe, it, expect } from 'vitest';
import {
  FmcsaMockClient,
  FmcsaDisabledClient,
  buildFmcsaXmlPayload,
  isRetryableError,
  nextRetryDelayMs,
  MAX_FMCSA_ATTEMPTS,
  type FmcsaExamPayload,
} from '../fmcsa-registry';

function examPayload(overrides: Partial<FmcsaExamPayload> = {}): FmcsaExamPayload {
  return {
    examId: '11111111-1111-1111-1111-111111111111',
    examinerNRCMENumber: '1234567890',
    driver: {
      firstName: 'Jane',
      lastName: 'Doe',
      dob: '1980-04-15',
      cdlNumber: 'D1234567',
      cdlState: 'TX',
    },
    examDate: '2025-04-15',
    examType: 'dot',
    certificationStatus: 'medically_qualified',
    mecExpiresOn: '2027-04-15',
    certificateNumber: 'MEC-250415-ABC123',
    restrictions: [],
    ...overrides,
  };
}

describe('FmcsaMockClient', () => {
  it('accepts a valid payload', async () => {
    const client = new FmcsaMockClient();
    const result = await client.submit(examPayload());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fmcsaSubmissionId).toMatch(/^MOCK-/);
      expect(result.status).toBe('accepted');
    }
  });

  it('rejects missing NRCME number', async () => {
    const client = new FmcsaMockClient();
    const result = await client.submit(examPayload({ examinerNRCMENumber: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('validation_error');
    }
  });

  it('rejects malformed NRCME number', async () => {
    const client = new FmcsaMockClient();
    const result = await client.submit(examPayload({ examinerNRCMENumber: '123' }));
    expect(result.ok).toBe(false);
  });

  it('rejects non-ISO examDate', async () => {
    const client = new FmcsaMockClient();
    const result = await client.submit(examPayload({ examDate: '04/15/2025' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('validation_error');
    }
  });

  it('returns fixture result when configured', async () => {
    const fixtures = new Map();
    fixtures.set('11111111-1111-1111-1111-111111111111', {
      ok: false,
      errorCode: 'rate_limited',
      errorMessage: 'simulated rate limit',
    });
    const client = new FmcsaMockClient({ fixtureByExamId: fixtures });
    const result = await client.submit(examPayload());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('rate_limited');
    }
  });

  it('simulates flakiness — first 2 calls fail then succeed', async () => {
    const client = new FmcsaMockClient({ simulateFlakiness: true });
    const payload = examPayload();

    const r1 = await client.submit(payload);
    expect(r1.ok).toBe(false);

    const r2 = await client.submit(payload);
    expect(r2.ok).toBe(false);

    const r3 = await client.submit(payload);
    expect(r3.ok).toBe(true);
  });
});

describe('FmcsaDisabledClient', () => {
  it('always returns auth error', async () => {
    const client = new FmcsaDisabledClient();
    const result = await client.submit(examPayload());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('authentication_error');
    }
  });
});

describe('buildFmcsaXmlPayload', () => {
  it('produces valid XML with required fields', () => {
    const xml = buildFmcsaXmlPayload(examPayload());
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<ExaminerNumber>1234567890</ExaminerNumber>');
    expect(xml).toContain('<FirstName>Jane</FirstName>');
    expect(xml).toContain('<LastName>Doe</LastName>');
    expect(xml).toContain('<DateOfBirth>1980-04-15</DateOfBirth>');
    expect(xml).toContain('<ExamDate>2025-04-15</ExamDate>');
    expect(xml).toContain('<CertificateNumber>MEC-250415-ABC123</CertificateNumber>');
  });

  it('escapes XML-unsafe characters in name fields', () => {
    const xml = buildFmcsaXmlPayload(
      examPayload({
        driver: {
          firstName: 'Pat & O\'Brien',
          lastName: '<script>',
          dob: '1980-04-15',
          cdlNumber: null,
          cdlState: null,
        },
      }),
    );
    expect(xml).toContain('Pat &amp; O&apos;Brien');
    expect(xml).toContain('&lt;script&gt;');
    expect(xml).not.toContain('<script>'); // ensure the literal tag didn't leak
  });

  it('omits CDL fields when not provided', () => {
    const xml = buildFmcsaXmlPayload(
      examPayload({
        driver: {
          firstName: 'A',
          lastName: 'B',
          dob: '1980-01-01',
          cdlNumber: null,
          cdlState: null,
        },
      }),
    );
    expect(xml).not.toContain('<CDLNumber>');
    expect(xml).not.toContain('<CDLState>');
  });

  it('includes restrictions when present', () => {
    const xml = buildFmcsaXmlPayload(
      examPayload({
        restrictions: ['Must wear corrective lenses', 'Must wear hearing aid'],
      }),
    );
    expect(xml).toContain('<Restriction>Must wear corrective lenses</Restriction>');
    expect(xml).toContain('<Restriction>Must wear hearing aid</Restriction>');
  });

  it('omits expiration when mecExpiresOn is null (disqualified)', () => {
    const xml = buildFmcsaXmlPayload(
      examPayload({
        certificationStatus: 'disqualified',
        mecExpiresOn: null,
      }),
    );
    expect(xml).not.toContain('<ExpirationDate>');
    expect(xml).toContain('<CertificationStatus>disqualified</CertificationStatus>');
  });
});

describe('isRetryableError', () => {
  it('marks transient errors as retryable', () => {
    expect(isRetryableError('rate_limited')).toBe(true);
    expect(isRetryableError('server_error')).toBe(true);
    expect(isRetryableError('network_error')).toBe(true);
    expect(isRetryableError('unknown')).toBe(true);
  });

  it('marks permanent errors as non-retryable', () => {
    expect(isRetryableError('validation_error')).toBe(false);
    expect(isRetryableError('authentication_error')).toBe(false);
    expect(isRetryableError('duplicate_submission')).toBe(false);
  });

  it('defaults unknown error codes to non-retryable', () => {
    expect(isRetryableError('something_new')).toBe(false);
  });
});

describe('nextRetryDelayMs', () => {
  it('returns increasing backoff for attempts 1-5', () => {
    expect(nextRetryDelayMs(1)).toBe(5 * 60 * 1000);
    expect(nextRetryDelayMs(2)).toBe(30 * 60 * 1000);
    expect(nextRetryDelayMs(3)).toBe(3 * 60 * 60 * 1000);
    expect(nextRetryDelayMs(4)).toBe(12 * 60 * 60 * 1000);
    expect(nextRetryDelayMs(5)).toBe(24 * 60 * 60 * 1000);
  });

  it('returns -1 after max attempts', () => {
    expect(nextRetryDelayMs(6)).toBe(-1);
    expect(nextRetryDelayMs(100)).toBe(-1);
  });

  it('delays are strictly increasing', () => {
    let prev = 0;
    for (let i = 1; i <= MAX_FMCSA_ATTEMPTS; i++) {
      const d = nextRetryDelayMs(i);
      expect(d).toBeGreaterThan(prev);
      prev = d;
    }
  });
});
