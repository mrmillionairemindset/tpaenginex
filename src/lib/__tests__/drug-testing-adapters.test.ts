import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'crypto';

import { EScreenMockAdapter, EScreenDisabledAdapter } from '@/modules/drug-testing/adapters/escreen';
import { FormFoxMockAdapter, FormFoxDisabledAdapter } from '@/modules/drug-testing/adapters/formfox';
import { CRLMockAdapter } from '@/modules/drug-testing/adapters/crl';
import { QuestMockAdapter } from '@/modules/drug-testing/adapters/quest';
import { LabCorpMockAdapter, parseSftpResultFile } from '@/modules/drug-testing/adapters/labcorp';
import { verifyHmacSignature } from '@/modules/drug-testing/adapters/shared';
import { getAdapter, isValidAdapterType, ADAPTER_TYPES } from '@/modules/drug-testing/adapters';
import type { CanonicalOrder, AdapterConfig } from '@/modules/adapter-interface';

const sampleOrder: CanonicalOrder = {
  orderId: '11111111-1111-1111-1111-111111111111',
  tpaOrgId: 'tpa_001',
  personId: 'person_001',
  personFirstName: 'John',
  personLastName: 'Doe',
  personDOB: '1990-01-15',
  serviceType: 'drug_screen',
  isDOT: false,
  panelCodes: ['SAP-5-50'],
  collectionSite: 'SITE-001',
};

const mockConfig: AdapterConfig = {
  adapterId: 'escreen',
  apiKey: 'test-key',
  webhookSecret: 'test-secret',
};

// ============================================================================
// ADAPTER REGISTRY
// ============================================================================

describe('Adapter Registry', () => {
  it('lists all 5 adapter types', () => {
    expect(ADAPTER_TYPES).toEqual(['escreen', 'formfox', 'crl', 'quest', 'labcorp']);
  });

  it('validates adapter types correctly', () => {
    expect(isValidAdapterType('escreen')).toBe(true);
    expect(isValidAdapterType('formfox')).toBe(true);
    expect(isValidAdapterType('crl')).toBe(true);
    expect(isValidAdapterType('quest')).toBe(true);
    expect(isValidAdapterType('labcorp')).toBe(true);
    expect(isValidAdapterType('unknown')).toBe(false);
    expect(isValidAdapterType('')).toBe(false);
  });

  it('creates mock adapters by default', () => {
    for (const type of ADAPTER_TYPES) {
      const adapter = getAdapter(type, { adapterId: type });
      expect(adapter).toBeDefined();
      expect(typeof adapter.submitOrder).toBe('function');
      expect(typeof adapter.fetchResults).toBe('function');
      expect(typeof adapter.handleWebhook).toBe('function');
    }
  });
});

// ============================================================================
// SUBMIT ORDER
// ============================================================================

describe('Mock Adapters — submitOrder', () => {
  it('eScreen mock returns external ref', async () => {
    const adapter = new EScreenMockAdapter();
    await adapter.initialize(mockConfig);
    const ref = await adapter.submitOrder(sampleOrder);
    expect(ref.externalId).toMatch(/^es_mock_/);
    expect(ref.externalRef).toBeTruthy();
  });

  it('FormFox mock returns eCCF number', async () => {
    const adapter = new FormFoxMockAdapter();
    await adapter.initialize(mockConfig);
    const ref = await adapter.submitOrder(sampleOrder);
    expect(ref.externalId).toMatch(/^ff_mock_/);
    expect(ref.externalRef).toMatch(/^ECCF-/);
    expect((ref.rawResponse as any).eccfPdfUrl).toContain('.pdf');
  });

  it('CRL mock returns requisition number', async () => {
    const adapter = new CRLMockAdapter();
    await adapter.initialize(mockConfig);
    const ref = await adapter.submitOrder(sampleOrder);
    expect(ref.externalId).toMatch(/^crl_mock_/);
    expect(ref.externalRef).toMatch(/^CRL-REQ-/);
  });

  it('Quest mock returns Quest-format ref', async () => {
    const adapter = new QuestMockAdapter();
    await adapter.initialize(mockConfig);
    const ref = await adapter.submitOrder(sampleOrder);
    expect(ref.externalId).toMatch(/^quest_mock_/);
    expect(ref.externalRef).toMatch(/^QD-/);
  });

  it('LabCorp mock returns accession number', async () => {
    const adapter = new LabCorpMockAdapter();
    await adapter.initialize(mockConfig);
    const ref = await adapter.submitOrder(sampleOrder);
    expect(ref.externalId).toMatch(/^lc_mock_/);
    expect(ref.externalRef).toMatch(/^LC-/);
  });

  it('uses submit fixtures when provided', async () => {
    const fixture = { externalId: 'custom-id', externalRef: 'CUSTOM-REF' };
    const adapter = new EScreenMockAdapter({
      submitFixtures: new Map([[sampleOrder.orderId, fixture]]),
    });
    await adapter.initialize(mockConfig);
    const ref = await adapter.submitOrder(sampleOrder);
    expect(ref.externalId).toBe('custom-id');
    expect(ref.externalRef).toBe('CUSTOM-REF');
  });
});

// ============================================================================
// FETCH RESULTS
// ============================================================================

describe('Mock Adapters — fetchResults', () => {
  it('returns negative result by default', async () => {
    const adapter = new EScreenMockAdapter();
    await adapter.initialize(mockConfig);
    const result = await adapter.fetchResults('ext-123');
    expect(result.resultValue).toBe('negative');
    expect(result.rawData).toEqual({ mock: true });
  });

  it('uses result fixtures when provided', async () => {
    const fixture = {
      externalId: 'ext-123',
      orderId: 'ord-123',
      panelType: '10-panel',
      resultValue: 'positive',
      rawData: { custom: true },
    };
    const adapter = new QuestMockAdapter({
      resultFixtures: new Map([['ext-123', fixture]]),
    });
    await adapter.initialize(mockConfig);
    const result = await adapter.fetchResults('ext-123');
    expect(result.resultValue).toBe('positive');
    expect(result.panelType).toBe('10-panel');
  });
});

// ============================================================================
// WEBHOOK VERIFICATION
// ============================================================================

describe('Webhook Verification', () => {
  it('verifies HMAC-SHA256 signature correctly', () => {
    const body = '{"event":"drug_screening.completed"}';
    const secret = 'webhook-secret-123';
    const sig = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    expect(verifyHmacSignature(body, secret, sig)).toBe(true);
  });

  it('rejects wrong signature', () => {
    const body = '{"event":"test"}';
    const secret = 'correct-secret';
    const wrongSig = createHmac('sha256', 'wrong-secret').update(body, 'utf8').digest('hex');
    expect(verifyHmacSignature(body, secret, wrongSig)).toBe(false);
  });

  it('rejects tampered body', () => {
    const secret = 'my-secret';
    const sig = createHmac('sha256', secret).update('original', 'utf8').digest('hex');
    expect(verifyHmacSignature('tampered', secret, sig)).toBe(false);
  });

  it('handles prefix stripping (sha256=)', () => {
    const body = '{"data":true}';
    const secret = 'sec';
    const sig = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    expect(verifyHmacSignature(body, secret, `sha256=${sig}`, 'sha256=')).toBe(true);
  });

  it('returns false for empty secret or signature', () => {
    expect(verifyHmacSignature('body', '', 'sig')).toBe(false);
    expect(verifyHmacSignature('body', 'secret', '')).toBe(false);
  });

  it('eScreen mock verifies webhook with configured secret', async () => {
    const secret = 'es-webhook-secret';
    const adapter = new EScreenMockAdapter({ webhookSecret: secret });
    await adapter.initialize(mockConfig);
    const body = '{"type":"drug_screening.completed"}';
    const sig = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    expect(adapter.verifyWebhookSignature(body, sig)).toBe(true);
  });

  it('FormFox mock rejects without configured secret', async () => {
    const adapter = new FormFoxMockAdapter(); // no webhookSecret
    await adapter.initialize(mockConfig);
    expect(adapter.verifyWebhookSignature('body', 'sig')).toBe(false);
  });
});

// ============================================================================
// DISABLED ADAPTER
// ============================================================================

describe('Disabled Adapters', () => {
  it('throws on all operations', async () => {
    const adapter = new EScreenDisabledAdapter();
    await expect(adapter.submitOrder(sampleOrder)).rejects.toThrow('not enabled');
    await expect(adapter.fetchResults('ref')).rejects.toThrow('not enabled');
    await expect(adapter.checkStatus('ref')).rejects.toThrow('not enabled');
    await expect(adapter.handleWebhook({})).rejects.toThrow('not enabled');
  });

  it('returns unhealthy health check', async () => {
    const adapter = new EScreenDisabledAdapter();
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(false);
    expect(health.message).toContain('disabled');
  });
});

// ============================================================================
// LABCORP SFTP PARSER
// ============================================================================

describe('LabCorp SFTP Result File Parser', () => {
  it('parses valid pipe-delimited result file', () => {
    const content = [
      '# LabCorp Results Export',
      'ACC001|REQ001|PAT001|Doe|John|20260414|THC|Cannabinoids|NEGATIVE|50ng/ml|false|NEGATIVE|20260415',
      'ACC001|REQ001|PAT001|Doe|John|20260414|COC|Cocaine|NEGATIVE|150ng/ml|false|NEGATIVE|20260415',
    ].join('\n');

    const results = parseSftpResultFile(content);
    expect(results.length).toBe(1); // grouped by accession
    expect(results[0].accessionNumber).toBe('ACC001');
    expect(results[0].panels.length).toBe(2);
    expect(results[0].panels[0].result).toBe('NEGATIVE');
    expect(results[0].overallResult).toBe('NEGATIVE');
  });

  it('returns empty array for empty/null input', () => {
    expect(parseSftpResultFile('')).toEqual([]);
    expect(parseSftpResultFile(null as any)).toEqual([]);
  });

  it('skips comment lines and short lines', () => {
    const content = [
      '# Header comment',
      'too|few|fields',
      'ACC002|REQ002|PAT002|Smith|Jane|20260414|AMP|Amphetamines|NEGATIVE|500ng/ml|false|NEGATIVE|20260415',
    ].join('\n');

    const results = parseSftpResultFile(content);
    expect(results.length).toBe(1);
    expect(results[0].accessionNumber).toBe('ACC002');
  });
});

// ============================================================================
// CRL HL7 WEBHOOK HANDLING
// ============================================================================

describe('CRL Mock — HL7 webhook handling', () => {
  it('processes HL7v2 ORU^R01 webhook payload', async () => {
    const adapter = new CRLMockAdapter();
    await adapter.initialize(mockConfig);

    const hl7Message = [
      'MSH|^~\\&|CRL|CRL_LAB|TPA|TPA_FACILITY|20260415||ORU^R01|MSG-555|P|2.5',
      'PID|1||PAT-100||Smith^Jane||19850320|F',
      'OBR|1|ORD-200|FILL-300|49590^Drug Screen|||20260414||||||||||||||||F',
      'OBX|1|ST|THC^Cannabinoids||NEGATIVE||NEGATIVE||N|||F',
    ].join('\r');

    const event = await adapter.handleWebhook(hl7Message);
    expect(event.eventType).toBe('hl7.oru_r01');
    expect(event.externalId).toBe('MSG-555');
    expect(event.orderId).toBe('ORD-200');
  });
});
