/**
 * HL7v2 Message Parser
 *
 * Parses HL7v2 pipe-delimited messages commonly used by clinical labs
 * (CRL, LabCorp, Quest) to deliver drug test results.
 *
 * Supports ORU^R01 (Observation Result Unsolicited) messages which contain:
 *   - MSH: Message Header
 *   - PID: Patient Identification
 *   - OBR: Observation Request (test order info)
 *   - OBX: Observation Result (individual panel results)
 *
 * This parser is intentionally lenient — it extracts what it can from
 * malformed messages and returns structured errors for missing segments.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface HL7Message {
  segments: HL7Segment[];
  rawText: string;
}

export interface HL7Segment {
  type: string;
  fields: string[];
  raw: string;
}

export interface HL7ParsedResult {
  messageHeader: MSHData | null;
  patient: PIDData | null;
  observationRequests: OBRData[];
  observationResults: OBXData[];
  errors: string[];
}

export interface MSHData {
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  messageDateTime: string;
  messageType: string;
  messageControlId: string;
  processingId: string;
  versionId: string;
}

export interface PIDData {
  patientId: string;
  externalId: string;
  lastName: string;
  firstName: string;
  dateOfBirth: string;
  sex: string;
  ssn: string;
}

export interface OBRData {
  setId: string;
  placerOrderNumber: string;
  fillerOrderNumber: string;
  universalServiceId: string;
  observationDateTime: string;
  resultStatus: string;
  specimenSource: string;
}

export interface OBXData {
  setId: string;
  valueType: string;
  observationId: string;
  observationSubId: string;
  observationValue: string;
  units: string;
  referenceRange: string;
  abnormalFlags: string;
  resultStatus: string;
}

// ============================================================================
// DRUG PANEL MAPPING
// ============================================================================

/**
 * Map common HL7 observation IDs (LOINC codes and vendor-specific codes)
 * to human-readable drug panel types.
 */
const DRUG_PANEL_MAP: Record<string, string> = {
  // LOINC codes for common drug screening panels
  '3397-7': 'amphetamines',
  '3398-5': 'barbiturates',
  '3399-3': 'benzodiazepines',
  '3426-4': 'cannabinoids',
  '3427-2': 'cocaine',
  '16234-4': 'methadone',
  '3773-9': 'methamphetamine',
  '3774-7': 'opiates',
  '3879-4': 'phencyclidine',
  '19659-8': 'propoxyphene',
  '12291-2': 'oxycodone',
  '43770-0': 'ecstasy_mdma',
  '3778-8': 'alcohol_ethanol',
  // Vendor-specific shorthand codes
  AMP: 'amphetamines',
  BAR: 'barbiturates',
  BZO: 'benzodiazepines',
  THC: 'cannabinoids',
  COC: 'cocaine',
  MTD: 'methadone',
  MET: 'methamphetamine',
  OPI: 'opiates',
  PCP: 'phencyclidine',
  OXY: 'oxycodone',
  ETH: 'alcohol_ethanol',
};

export function mapObservationIdToPanelType(observationId: string): string {
  // Try exact match first
  if (DRUG_PANEL_MAP[observationId]) {
    return DRUG_PANEL_MAP[observationId];
  }
  // Try extracting the code portion (some labs send "CODE^Description")
  const code = observationId.split('^')[0]?.trim();
  if (code && DRUG_PANEL_MAP[code]) {
    return DRUG_PANEL_MAP[code];
  }
  return observationId; // Return raw if no mapping found
}

// ============================================================================
// PARSER
// ============================================================================

/**
 * Parse a raw HL7v2 message string into structured segments.
 * HL7v2 uses \r as segment delimiter (but we also accept \n and \r\n).
 * Fields within a segment are pipe-delimited.
 */
export function parseHL7Message(rawText: string): HL7Message {
  if (!rawText || typeof rawText !== 'string') {
    return { segments: [], rawText: '' };
  }

  // Normalize line endings — HL7 standard is \r but files often have \r\n or \n
  const normalized = rawText.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
  const lines = normalized.split('\r').filter((line) => line.trim().length > 0);

  const segments: HL7Segment[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // MSH segment is special: the field separator (|) is in field 1,
    // so MSH-1 is the pipe character itself. We handle this by inserting
    // an empty string at position 0.
    if (trimmed.startsWith('MSH')) {
      const fields = trimmed.split('|');
      // fields[0] = 'MSH', fields[1] = encoding chars, etc.
      segments.push({
        type: 'MSH',
        fields,
        raw: trimmed,
      });
    } else {
      const fields = trimmed.split('|');
      const type = fields[0] || '';
      segments.push({ type, fields, raw: trimmed });
    }
  }

  return { segments, rawText };
}

/**
 * Extract structured data from a parsed HL7v2 ORU^R01 message.
 * Returns all found data plus a list of non-fatal errors.
 */
export function extractHL7Data(message: HL7Message): HL7ParsedResult {
  const errors: string[] = [];
  let messageHeader: MSHData | null = null;
  let patient: PIDData | null = null;
  const observationRequests: OBRData[] = [];
  const observationResults: OBXData[] = [];

  if (message.segments.length === 0) {
    errors.push('Empty HL7 message — no segments found');
    return { messageHeader, patient, observationRequests, observationResults, errors };
  }

  for (const segment of message.segments) {
    try {
      switch (segment.type) {
        case 'MSH':
          messageHeader = parseMSH(segment);
          break;
        case 'PID':
          patient = parsePID(segment);
          break;
        case 'OBR':
          observationRequests.push(parseOBR(segment));
          break;
        case 'OBX':
          observationResults.push(parseOBX(segment));
          break;
        // EVN, NK1, ORC, etc. — ignored for drug testing purposes
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Error parsing ${segment.type} segment: ${message}`);
    }
  }

  if (!messageHeader) {
    errors.push('Missing MSH (Message Header) segment');
  }
  if (!patient) {
    errors.push('Missing PID (Patient Identification) segment');
  }
  if (observationRequests.length === 0) {
    errors.push('No OBR (Observation Request) segments found');
  }
  if (observationResults.length === 0) {
    errors.push('No OBX (Observation Result) segments found');
  }

  return { messageHeader, patient, observationRequests, observationResults, errors };
}

/**
 * Convenience function: parse raw text and extract data in one call.
 */
export function parseHL7Results(rawText: string): HL7ParsedResult {
  const message = parseHL7Message(rawText);
  return extractHL7Data(message);
}

// ============================================================================
// SEGMENT PARSERS
// ============================================================================

function safeField(fields: string[], index: number): string {
  return fields[index]?.trim() ?? '';
}

function safeComponent(field: string, index: number): string {
  const parts = field.split('^');
  return parts[index]?.trim() ?? '';
}

function parseMSH(segment: HL7Segment): MSHData {
  const f = segment.fields;
  return {
    sendingApplication: safeField(f, 2),
    sendingFacility: safeField(f, 3),
    receivingApplication: safeField(f, 4),
    receivingFacility: safeField(f, 5),
    messageDateTime: safeField(f, 6),
    messageType: safeField(f, 8),
    messageControlId: safeField(f, 9),
    processingId: safeField(f, 10),
    versionId: safeField(f, 11),
  };
}

function parsePID(segment: HL7Segment): PIDData {
  const f = segment.fields;
  const patientName = safeField(f, 5);
  return {
    patientId: safeField(f, 2),
    externalId: safeComponent(safeField(f, 3), 0),
    lastName: safeComponent(patientName, 0),
    firstName: safeComponent(patientName, 1),
    dateOfBirth: safeField(f, 7),
    sex: safeField(f, 8),
    ssn: safeField(f, 19),
  };
}

function parseOBR(segment: HL7Segment): OBRData {
  const f = segment.fields;
  return {
    setId: safeField(f, 1),
    placerOrderNumber: safeField(f, 2),
    fillerOrderNumber: safeField(f, 3),
    universalServiceId: safeField(f, 4),
    observationDateTime: safeField(f, 7),
    resultStatus: safeField(f, 25),
    specimenSource: safeField(f, 15),
  };
}

function parseOBX(segment: HL7Segment): OBXData {
  const f = segment.fields;
  return {
    setId: safeField(f, 1),
    valueType: safeField(f, 2),
    observationId: safeField(f, 3),
    observationSubId: safeField(f, 4),
    observationValue: safeField(f, 5),
    units: safeField(f, 6),
    referenceRange: safeField(f, 7),
    abnormalFlags: safeField(f, 8),
    resultStatus: safeField(f, 11),
  };
}
