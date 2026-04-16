import { describe, it, expect } from 'vitest';
import {
  parseHL7Message,
  extractHL7Data,
  parseHL7Results,
  mapObservationIdToPanelType,
} from '../hl7-parser';

// Sample HL7v2 ORU^R01 message (drug test result)
const VALID_ORU_R01 = [
  'MSH|^~\\&|CRL_LAB|CRL_FACILITY|TPA_APP|TPA_FACILITY|20260415120000||ORU^R01|MSG001|P|2.5',
  'PID|1||PAT-12345||Doe^John||19900115|M|||123 Main St^^Springfield^IL^62701|||||||555-12-6789',
  'OBR|1|ORD-98765|FILL-11111|49590^Drug Screen Panel 10|||20260414100000||||||||||||||||||F',
  'OBX|1|ST|THC^Cannabinoids||NEGATIVE||NEGATIVE|N|||F',
  'OBX|2|ST|COC^Cocaine||NEGATIVE||NEGATIVE|N|||F',
  'OBX|3|ST|AMP^Amphetamines||NEGATIVE||NEGATIVE|N|||F',
  'OBX|4|ST|OPI^Opiates||POSITIVE||NEGATIVE|A|||F',
  'OBX|5|ST|PCP^Phencyclidine||NEGATIVE||NEGATIVE|N|||F',
].join('\r');

const MULTI_PANEL_MESSAGE = [
  'MSH|^~\\&|QUEST|QUEST_FACILITY|TPA|TPA_FACILITY|20260415130000||ORU^R01|MSG002|P|2.5',
  'PID|1||PAT-67890||Smith^Jane||19850320|F',
  'OBR|1|ORD-11111|FILL-22222|81001^Drug Screen 5 Panel|||20260414080000||||||||||||||||F',
  'OBX|1|ST|3397-7^Amphetamines||NEGATIVE||NEGATIVE||N|||F',
  'OBX|2|ST|3426-4^Cannabinoids||NEGATIVE||NEGATIVE||N|||F',
  'OBX|3|ST|3427-2^Cocaine||NEGATIVE||NEGATIVE||N|||F',
  'OBX|4|ST|3774-7^Opiates||NEGATIVE||NEGATIVE||N|||F',
  'OBX|5|ST|3879-4^Phencyclidine||NEGATIVE||NEGATIVE||N|||F',
  'OBR|2|ORD-11111|FILL-22223|81002^Alcohol Panel|||20260414080000||||||||||||||||F',
  'OBX|6|ST|3778-8^Alcohol||0.00||<0.02||N|||F',
].join('\r');

describe('parseHL7Message', () => {
  it('parses a valid HL7v2 message into segments', () => {
    const msg = parseHL7Message(VALID_ORU_R01);
    expect(msg.segments.length).toBe(8); // MSH + PID + OBR + 5x OBX
    expect(msg.segments[0].type).toBe('MSH');
    expect(msg.segments[1].type).toBe('PID');
    expect(msg.segments[2].type).toBe('OBR');
    expect(msg.segments[3].type).toBe('OBX');
  });

  it('handles \\n line endings', () => {
    const msg = parseHL7Message(VALID_ORU_R01.replace(/\r/g, '\n'));
    expect(msg.segments.length).toBe(8);
  });

  it('handles \\r\\n line endings', () => {
    const msg = parseHL7Message(VALID_ORU_R01.replace(/\r/g, '\r\n'));
    expect(msg.segments.length).toBe(8);
  });

  it('returns empty segments for null/undefined/empty input', () => {
    expect(parseHL7Message('').segments.length).toBe(0);
    expect(parseHL7Message(null as any).segments.length).toBe(0);
    expect(parseHL7Message(undefined as any).segments.length).toBe(0);
  });
});

describe('extractHL7Data', () => {
  it('extracts MSH, PID, OBR, and OBX data from valid ORU^R01', () => {
    const msg = parseHL7Message(VALID_ORU_R01);
    const data = extractHL7Data(msg);

    expect(data.messageHeader).not.toBeNull();
    expect(data.messageHeader!.sendingApplication).toBe('CRL_LAB');
    expect(data.messageHeader!.sendingFacility).toBe('CRL_FACILITY');
    expect(data.messageHeader!.messageControlId).toBe('MSG001');

    expect(data.patient).not.toBeNull();
    expect(data.patient!.lastName).toBe('Doe');
    expect(data.patient!.firstName).toBe('John');
    expect(data.patient!.dateOfBirth).toBe('19900115');
    expect(data.patient!.externalId).toBe('PAT-12345');

    expect(data.observationRequests.length).toBe(1);
    expect(data.observationRequests[0].placerOrderNumber).toBe('ORD-98765');
    expect(data.observationRequests[0].resultStatus).toBe('F');

    expect(data.observationResults.length).toBe(5);
    expect(data.observationResults[0].observationValue).toBe('NEGATIVE');
    expect(data.observationResults[3].observationValue).toBe('POSITIVE');
    expect(data.observationResults[3].abnormalFlags).toBe('A');

    expect(data.errors.length).toBe(0);
  });

  it('extracts multiple OBR segments (multi-panel)', () => {
    const msg = parseHL7Message(MULTI_PANEL_MESSAGE);
    const data = extractHL7Data(msg);

    expect(data.observationRequests.length).toBe(2);
    expect(data.observationResults.length).toBe(6);
    expect(data.errors.length).toBe(0);
  });

  it('reports missing segments as errors without crashing', () => {
    const msgNoPatient = 'MSH|^~\\&|LAB|FAC|APP|FAC|20260101||ORU^R01|MSG1|P|2.5';
    const data = parseHL7Results(msgNoPatient);

    expect(data.messageHeader).not.toBeNull();
    expect(data.patient).toBeNull();
    expect(data.errors).toContain('Missing PID (Patient Identification) segment');
    expect(data.errors).toContain('No OBR (Observation Request) segments found');
    expect(data.errors).toContain('No OBX (Observation Result) segments found');
  });

  it('reports empty message error', () => {
    const data = parseHL7Results('');
    expect(data.errors).toContain('Empty HL7 message — no segments found');
  });

  it('handles malformed segment gracefully', () => {
    const malformed = [
      'MSH|^~\\&|LAB|FAC|APP|FAC|20260101||ORU^R01|MSG1|P|2.5',
      'PID|incomplete',
      'OBR|1|ORD-1|FILL-1|CODE|||20260101||||||||||||||||F',
      'OBX|1|ST|THC||NEGATIVE||NEGATIVE||N|||F',
    ].join('\r');

    const data = parseHL7Results(malformed);
    // Should not crash — PID is incomplete but parsed what it can
    expect(data.patient).not.toBeNull();
    expect(data.patient!.lastName).toBe(''); // missing data = empty string
    expect(data.observationResults.length).toBe(1);
  });
});

describe('mapObservationIdToPanelType', () => {
  it('maps LOINC codes to panel types', () => {
    expect(mapObservationIdToPanelType('3426-4')).toBe('cannabinoids');
    expect(mapObservationIdToPanelType('3427-2')).toBe('cocaine');
    expect(mapObservationIdToPanelType('3774-7')).toBe('opiates');
  });

  it('maps vendor shorthand codes', () => {
    expect(mapObservationIdToPanelType('THC')).toBe('cannabinoids');
    expect(mapObservationIdToPanelType('COC')).toBe('cocaine');
    expect(mapObservationIdToPanelType('AMP')).toBe('amphetamines');
  });

  it('maps component-style codes (CODE^Description)', () => {
    expect(mapObservationIdToPanelType('THC^Cannabinoids')).toBe('cannabinoids');
    expect(mapObservationIdToPanelType('3427-2^Cocaine Metabolites')).toBe('cocaine');
  });

  it('returns raw ID for unknown codes', () => {
    expect(mapObservationIdToPanelType('UNKNOWN-123')).toBe('UNKNOWN-123');
  });
});

describe('parseHL7Results (convenience)', () => {
  it('parses raw text and extracts data in one call', () => {
    const data = parseHL7Results(VALID_ORU_R01);
    expect(data.messageHeader).not.toBeNull();
    expect(data.patient).not.toBeNull();
    expect(data.observationResults.length).toBe(5);
    expect(data.errors.length).toBe(0);
  });
});
