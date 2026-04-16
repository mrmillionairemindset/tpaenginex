import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import {
  CheckrMockClient,
  CheckrDisabledClient,
  verifyCheckrHmac,
  type CheckrCandidateInput,
  type CheckrCreateReportInput,
} from '../checkr-client';

const sampleCandidate: CheckrCandidateInput = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  dob: '1990-01-15',
  externalPersonId: '00000000-0000-0000-0000-000000000001',
};

const sampleReport: CheckrCreateReportInput = {
  candidateId: 'cand_123',
  packageSlug: 'tasker_standard',
  externalCheckId: '11111111-1111-1111-1111-111111111111',
};

describe('CheckrMockClient', () => {
  it('creates a candidate with required fields', async () => {
    const client = new CheckrMockClient();
    const result = await client.createCandidate('tpa_1', sampleCandidate);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toMatch(/^cand_mock_/);
      expect(result.data.inviteUrl).toContain('apply.checkr.com');
    }
  });

  it('rejects missing required fields', async () => {
    const client = new CheckrMockClient();
    const result = await client.createCandidate('tpa_1', { ...sampleCandidate, email: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('validation_error');
  });

  it('rejects non-ISO DOB', async () => {
    const client = new CheckrMockClient();
    const result = await client.createCandidate('tpa_1', { ...sampleCandidate, dob: '01/15/1990' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('validation_error');
  });

  it('uses candidate fixture when provided', async () => {
    const fixtures = new Map();
    fixtures.set('00000000-0000-0000-0000-000000000001', {
      ok: false,
      errorCode: 'rate_limited',
      errorMessage: 'simulated',
    });
    const client = new CheckrMockClient({ candidateFixtures: fixtures });
    const result = await client.createCandidate('tpa_1', sampleCandidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('rate_limited');
  });

  it('creates a report in pending state', async () => {
    const client = new CheckrMockClient();
    const result = await client.createReport('tpa_1', sampleReport);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('pending');
      expect(result.data.id).toMatch(/^rep_mock_/);
    }
  });

  it('rejects report creation without candidateId', async () => {
    const client = new CheckrMockClient();
    const result = await client.createReport('tpa_1', { ...sampleReport, candidateId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('validation_error');
  });

  it('fetches a report (returns processing in the mock)', async () => {
    const client = new CheckrMockClient();
    const result = await client.fetchReport('tpa_1', 'rep_abc');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe('processing');
  });

  it('cancels a report successfully', async () => {
    const client = new CheckrMockClient();
    const result = await client.cancelReport('tpa_1', 'rep_abc');
    expect(result.ok).toBe(true);
  });

  it('verifies a correctly-signed webhook', async () => {
    const secret = 'test-secret-123';
    const client = new CheckrMockClient({ webhookSecret: secret });
    const body = JSON.stringify({ type: 'report.completed', id: 'rep_1' });
    const sig = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    const result = await client.verifyWebhookSignature('tpa_1', body, sig);
    expect(result).toBe(true);
  });

  it('rejects a wrong-secret webhook', async () => {
    const client = new CheckrMockClient({ webhookSecret: 'right-secret' });
    const body = '{"type":"report.completed"}';
    const wrongSig = createHmac('sha256', 'wrong-secret').update(body, 'utf8').digest('hex');
    const result = await client.verifyWebhookSignature('tpa_1', body, wrongSig);
    expect(result).toBe(false);
  });

  it('rejects a tampered webhook body (even with correct secret)', async () => {
    const secret = 'test-secret';
    const client = new CheckrMockClient({ webhookSecret: secret });
    const sig = createHmac('sha256', secret).update('original', 'utf8').digest('hex');
    const result = await client.verifyWebhookSignature('tpa_1', 'tampered', sig);
    expect(result).toBe(false);
  });

  it('returns false when no webhook secret configured', async () => {
    const client = new CheckrMockClient(); // no secret
    const result = await client.verifyWebhookSignature('tpa_1', 'body', 'sig');
    expect(result).toBe(false);
  });
});

describe('CheckrDisabledClient', () => {
  it('rejects all operations with auth error', async () => {
    const c = new CheckrDisabledClient();
    expect((await c.createCandidate('tpa_1', sampleCandidate)).ok).toBe(false);
    expect((await c.createReport('tpa_1', sampleReport)).ok).toBe(false);
    expect((await c.fetchReport('tpa_1', 'rep_1')).ok).toBe(false);
    expect((await c.cancelReport('tpa_1', 'rep_1')).ok).toBe(false);
    expect(await c.verifyWebhookSignature('tpa_1', 'body', 'sig')).toBe(false);
  });
});

describe('verifyCheckrHmac', () => {
  it('accepts a matching HMAC', () => {
    const body = '{"foo":"bar"}';
    const secret = 'abc123';
    const sig = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    expect(verifyCheckrHmac(body, secret, sig)).toBe(true);
  });

  it('rejects a different body', () => {
    const secret = 'abc123';
    const sig = createHmac('sha256', secret).update('body-a', 'utf8').digest('hex');
    expect(verifyCheckrHmac('body-b', secret, sig)).toBe(false);
  });

  it('rejects a different secret', () => {
    const body = 'body';
    const sig = createHmac('sha256', 'secret-a').update(body, 'utf8').digest('hex');
    expect(verifyCheckrHmac(body, 'secret-b', sig)).toBe(false);
  });

  it('handles whitespace in the signature header', () => {
    const body = 'body';
    const secret = 'sec';
    const sig = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    expect(verifyCheckrHmac(body, secret, `  ${sig}  `)).toBe(true);
  });

  it('handles unicode payloads', () => {
    const body = JSON.stringify({ name: '日本語 🔒' });
    const secret = 'unicode-secret';
    const sig = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    expect(verifyCheckrHmac(body, secret, sig)).toBe(true);
  });
});
