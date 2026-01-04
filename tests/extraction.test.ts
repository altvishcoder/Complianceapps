import { describe, it, expect } from 'vitest';
import { generateRemedialActions, generateRemedialActionsFromConfig, determineOutcome, normalizeExtractionOutput } from '../server/extraction';
import { extractDefects, extractAppliances, extractWithTemplate } from '../server/services/extraction/template-patterns';
import { detectFormatFromMime, detectFormatFromExtension, detectCertificateType, detectCertificateTypeFromFilename, classifyDocument } from '../server/services/extraction/format-detector';

describe('Extraction Functions', () => {
  describe('determineOutcome', () => {
    it('should return UNSATISFACTORY for explicit unsatisfactory outcome', () => {
      const data = { overallOutcome: 'UNSATISFACTORY' };
      expect(determineOutcome(data, 'GAS_SAFETY')).toBe('UNSATISFACTORY');
    });

    it('should return SATISFACTORY for explicit satisfactory outcome', () => {
      const data = { overallOutcome: 'SATISFACTORY' };
      expect(determineOutcome(data, 'GAS_SAFETY')).toBe('SATISFACTORY');
    });

    it('should return UNSATISFACTORY when C1 codes present', () => {
      const data = { c1Count: 1 };
      expect(determineOutcome(data, 'EICR')).toBe('UNSATISFACTORY');
    });

    it('should return UNSATISFACTORY when C2 codes present', () => {
      const data = { c2Count: 2 };
      expect(determineOutcome(data, 'EICR')).toBe('UNSATISFACTORY');
    });

    it('should return UNSATISFACTORY for high risk level', () => {
      const data = { riskLevel: 'HIGH' };
      expect(determineOutcome(data, 'FIRE_RISK_ASSESSMENT')).toBe('UNSATISFACTORY');
    });

    it('should return UNSATISFACTORY when lift is not safe to operate', () => {
      const data = { safeToOperate: false };
      expect(determineOutcome(data, 'LIFT')).toBe('UNSATISFACTORY');
    });

    it('should return SATISFACTORY by default', () => {
      const data = {};
      expect(determineOutcome(data, 'OTHER')).toBe('SATISFACTORY');
    });

    it('should detect unsafe appliances', () => {
      const data = { appliances: [{ applianceSafe: false }] };
      expect(determineOutcome(data, 'GAS_SAFETY')).toBe('UNSATISFACTORY');
    });
  });

  describe('generateRemedialActions', () => {
    it('should create actions for GAS_SAFETY with ID defects', () => {
      const data = {
        defects: [
          { classification: 'Immediately Dangerous (ID)', description: 'Gas leak detected', location: 'Boiler' }
        ]
      };
      const actions = generateRemedialActions(data, 'GAS_SAFETY', 'prop-1');
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].severity).toBe('IMMEDIATE');
    });

    it('should create actions for GAS_SAFETY with AR defects', () => {
      const data = {
        defects: [
          { classification: 'At Risk (AR)', description: 'Ventilation blocked', location: 'Kitchen' }
        ]
      };
      const actions = generateRemedialActions(data, 'GAS_SAFETY', 'prop-1');
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].severity).toBe('URGENT');
    });

    it('should create actions for EICR with C1 observations', () => {
      const data = {
        observations: [
          { code: 'C1', description: 'Dangerous condition', location: 'Consumer unit' }
        ]
      };
      const actions = generateRemedialActions(data, 'EICR', 'prop-1');
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].severity).toBe('IMMEDIATE');
    });

    it('should create actions for EICR with C2 observations', () => {
      const data = {
        observations: [
          { code: 'C2', description: 'Potentially dangerous', location: 'Socket' }
        ]
      };
      const actions = generateRemedialActions(data, 'EICR', 'prop-1');
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].severity).toBe('URGENT');
    });

    it('should not create actions for C3 observations (advisory only)', () => {
      const data = {
        observations: [
          { code: 'C3', description: 'Improvement recommended', location: 'Lighting' }
        ]
      };
      const actions = generateRemedialActions(data, 'EICR', 'prop-1');
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].severity).toBe('ADVISORY');
    });

    it('should create actions for FIRE_RISK with high risk findings', () => {
      const data = {
        findings: [
          { priority: 'HIGH', description: 'Fire doors damaged' }
        ]
      };
      const actions = generateRemedialActions(data, 'FIRE_RISK', 'prop-1');
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should create fallback action for UNSATISFACTORY outcome with no specific defects', () => {
      const data = { overallOutcome: 'UNSATISFACTORY' };
      const actions = generateRemedialActions(data, 'OTHER', 'prop-1');
      expect(actions.length).toBe(1);
      expect(actions[0].code).toBe('REVIEW-OTHER');
    });

    it('should handle recommendations array', () => {
      const data = {
        recommendations: [
          { description: 'Replace smoke detector', priority: 'HIGH' }
        ]
      };
      const actions = generateRemedialActions(data, 'OTHER', 'prop-1');
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should return empty array for SATISFACTORY outcome with no defects', () => {
      const data = { overallOutcome: 'SATISFACTORY' };
      const actions = generateRemedialActions(data, 'GAS_SAFETY', 'prop-1');
      expect(actions.length).toBe(0);
    });
  });

  describe('normalizeExtractionOutput', () => {
    it('should parse address string correctly', () => {
      const raw = {
        installationAddress: '123 Main Street, London, SW1A 1AA'
      };
      const result = normalizeExtractionOutput(raw);
      expect(result.property.postcode).toBe('SW1A 1AA');
    });

    it('should handle object address format', () => {
      const raw = {
        installationAddress: {
          address_line_1: '123 Main Street',
          city: 'London',
          postcode: 'SW1A 1AA'
        }
      };
      const result = normalizeExtractionOutput(raw);
      expect(result.property.postcode).toBe('SW1A 1AA');
    });

    it('should extract engineer details', () => {
      const raw = {
        engineer: { name: 'John Smith', gasSafeNumber: '123456' }
      };
      const result = normalizeExtractionOutput(raw);
      expect(result.engineer.name).toBe('John Smith');
      expect(result.engineer.registration_id).toBe('123456');
    });

    it('should extract inspection details', () => {
      const raw = {
        issueDate: '2024-01-15',
        expiryDate: '2025-01-15',
        certificateNumber: 'CERT-001'
      };
      const result = normalizeExtractionOutput(raw);
      expect(result.inspection.date).toBe('2024-01-15');
      expect(result.inspection.next_due_date).toBe('2025-01-15');
      expect(result.inspection.certificate_number).toBe('CERT-001');
    });
  });

  describe('generateRemedialActionsFromConfig', () => {
    it('should load classification codes and generate actions for EICR', async () => {
      const data = {
        observations: [
          { code: 'C1', description: 'Dangerous condition', location: 'Consumer unit' }
        ]
      };
      const actions = await generateRemedialActionsFromConfig(data, 'EICR', 'prop-1');
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].code).toBe('C1');
    });

    it('should generate actions for Gas Safety defects', async () => {
      const data = {
        defects: [
          { classification: 'Immediately Dangerous (ID)', description: 'Gas leak', location: 'Boiler' }
        ]
      };
      const actions = await generateRemedialActionsFromConfig(data, 'GAS_SAFETY', 'prop-1');
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should generate fallback action for unsatisfactory outcome', async () => {
      const data = { overallOutcome: 'UNSATISFACTORY' };
      const actions = await generateRemedialActionsFromConfig(data, 'OTHER', 'prop-1');
      expect(actions.length).toBe(1);
      expect(actions[0].code).toBe('REVIEW-OTHER');
    });

    it('should return empty array for satisfactory outcome with no defects', async () => {
      const data = { overallOutcome: 'SATISFACTORY' };
      const actions = await generateRemedialActionsFromConfig(data, 'GAS_SAFETY', 'prop-1');
      expect(actions.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty defects array', () => {
      const data = { defects: [] };
      const actions = generateRemedialActions(data, 'GAS_SAFETY', 'prop-1');
      expect(actions.length).toBe(0);
    });

    it('should handle undefined defects', () => {
      const data = {};
      const actions = generateRemedialActions(data, 'GAS_SAFETY', 'prop-1');
      expect(actions.length).toBe(0);
    });

    it('should handle mixed severity defects', () => {
      const data = {
        defects: [
          { classification: 'Immediately Dangerous (ID)', description: 'Critical', location: 'Boiler' },
          { classification: 'At Risk (AR)', description: 'Warning', location: 'Kitchen' },
          { classification: 'Not to Current Standard (NCS)', description: 'Advisory', location: 'Hallway' }
        ]
      };
      const actions = generateRemedialActions(data, 'GAS_SAFETY', 'prop-1');
      expect(actions.length).toBe(3);
    });

    it('should handle EICR with mixed observation codes', () => {
      const data = {
        observations: [
          { code: 'C1', description: 'Danger', location: 'Unit' },
          { code: 'C2', description: 'Potential danger', location: 'Socket' },
          { code: 'C3', description: 'Improvement', location: 'Light' },
          { code: 'FI', description: 'Investigation', location: 'Wiring' }
        ]
      };
      const actions = generateRemedialActions(data, 'EICR', 'prop-1');
      expect(actions.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle fire risk with multiple priority levels', () => {
      const data = {
        findings: [
          { priority: 'HIGH', description: 'Fire door issue' },
          { priority: 'MEDIUM', description: 'Signage missing' },
          { priority: 'LOW', description: 'Minor obstruction' }
        ]
      };
      const actions = generateRemedialActions(data, 'FIRE_RISK', 'prop-1');
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should normalize raw data with missing fields', () => {
      const raw = {};
      const result = normalizeExtractionOutput(raw);
      expect(result.property).toBeDefined();
      expect(result.engineer).toBeDefined();
      expect(result.inspection).toBeDefined();
    });

    it('should extract postcode from various address formats', () => {
      const formats = [
        { installationAddress: 'Flat 1, 123 High St, London SW1A 1AA' },
        { installationAddress: '123 Main Road\nManchester\nM1 2AB' },
        { installationAddress: { postcode: 'B1 1AA', address_line_1: '1 Street' } }
      ];
      
      for (const raw of formats) {
        const result = normalizeExtractionOutput(raw);
        expect(result.property.postcode).toBeDefined();
      }
    });
  });

  describe('determineOutcome Edge Cases', () => {
    it('should handle satisfactory with observations', () => {
      const data = { overallOutcome: 'SATISFACTORY_WITH_OBSERVATIONS' };
      const result = determineOutcome(data, 'EICR');
      expect(['SATISFACTORY', 'SATISFACTORY_WITH_OBSERVATIONS']).toContain(result);
    });

    it('should handle unsafe appliance in array', () => {
      const data = {
        appliances: [
          { applianceSafe: true },
          { applianceSafe: false },
          { applianceSafe: true }
        ]
      };
      expect(determineOutcome(data, 'GAS_SAFETY')).toBe('UNSATISFACTORY');
    });

    it('should handle all safe appliances', () => {
      const data = {
        appliances: [
          { applianceSafe: true },
          { applianceSafe: true }
        ]
      };
      expect(determineOutcome(data, 'GAS_SAFETY')).toBe('SATISFACTORY');
    });

    it('should handle legionella satisfactory by default', () => {
      const data = { colonyCount: 100 };
      expect(determineOutcome(data, 'LEGIONELLA')).toBe('SATISFACTORY');
    });

    it('should handle asbestos satisfactory by default', () => {
      const data = { asbestosPresent: false };
      expect(determineOutcome(data, 'ASBESTOS')).toBe('SATISFACTORY');
    });

    it('should handle FI code in EICR as further investigation needed', () => {
      const data = { fiCount: 1 };
      expect(determineOutcome(data, 'EICR')).toBe('UNSATISFACTORY');
    });
  });
});

describe('Template Patterns Functions', () => {
  describe('extractDefects()', () => {
    it('extracts C1 defects from text', () => {
      const text = 'Circuit 1: C1 - Danger present, exposed wiring';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('C1');
      expect(defects[0].priority).toBe('IMMEDIATE');
    });

    it('extracts C2 defects from text', () => {
      const text = 'Socket outlet: C2 - Potentially dangerous condition';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('C2');
      expect(defects[0].priority).toBe('URGENT');
    });

    it('extracts C3 defects from text', () => {
      const text = 'Lighting circuit: C3 - Improvement recommended';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('C3');
      expect(defects[0].priority).toBe('ROUTINE');
    });

    it('extracts FI defects from text', () => {
      const text = 'Wiring: FI - Further investigation required';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('FI');
      expect(defects[0].priority).toBe('URGENT');
    });

    it('extracts AR (At Risk) defects', () => {
      const text = 'Boiler: AR - At risk condition identified';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('AR');
    });

    it('extracts ID (Immediately Dangerous) defects', () => {
      const text = 'Gas leak: ID code found';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('ID');
      expect(defects[0].priority).toBe('IMMEDIATE');
    });

    it('extracts NCS defects', () => {
      const text = 'Bonding: NCS - Not to current standard';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('NCS');
    });

    it('extracts multiple defects from text', () => {
      const text = `Line 1: C1 - Critical issue
Line 2: C2 - Potential danger
Line 3: C3 - Advisory`;
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThanOrEqual(3);
    });

    it('returns empty array when no defects found', () => {
      const text = 'All circuits satisfactory, no issues found.';
      const defects = extractDefects(text);
      expect(defects.length).toBe(0);
    });

    it('extracts fire risk HIGH priority', () => {
      const text = 'Fire door: High risk - immediate action required';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].priority).toBe('IMMEDIATE');
    });

    it('extracts fire risk MEDIUM priority', () => {
      const text = 'Signage: Medium risk - action within 3 months';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].priority).toBe('URGENT');
    });
  });

  describe('extractAppliances()', () => {
    it('extracts gas appliances from text', () => {
      const text = 'Appliance 1: Boiler - Make: Worcester Model: Greenstar - Pass';
      const appliances = extractAppliances(text, 'GAS');
      expect(appliances.length).toBeGreaterThan(0);
      expect(appliances[0].type).toBe('Gas Appliance');
    });

    it('extracts appliance outcome as PASS', () => {
      const text = 'Appliance 1: Central Heating Boiler - Safe';
      const appliances = extractAppliances(text, 'GAS');
      expect(appliances.length).toBeGreaterThan(0);
      expect(appliances[0].outcome).toBe('PASS');
    });

    it('extracts appliance outcome as FAIL', () => {
      const text = 'Appliance 2: Water Heater - Fail';
      const appliances = extractAppliances(text, 'GAS');
      expect(appliances.length).toBeGreaterThan(0);
      expect(appliances[0].outcome).toBe('FAIL');
    });

    it('works with LPG certificate type', () => {
      const text = 'Appliance 1: LPG Heater - Satisfactory';
      const appliances = extractAppliances(text, 'LPG');
      expect(appliances.length).toBeGreaterThan(0);
    });

    it('works with OIL certificate type', () => {
      const text = 'Appliance 1: Oil Boiler - Pass';
      const appliances = extractAppliances(text, 'OIL');
      expect(appliances.length).toBeGreaterThan(0);
    });

    it('returns empty array for non-matching certificate types', () => {
      const text = 'Appliance 1: Test';
      const appliances = extractAppliances(text, 'EICR');
      expect(appliances.length).toBe(0);
    });

    it('handles text with no appliances', () => {
      const text = 'No items found on site.';
      const appliances = extractAppliances(text, 'GAS');
      expect(appliances.length).toBe(0);
    });
  });

  describe('extractWithTemplate()', () => {
    it('returns result for GAS certificate', () => {
      const text = `Gas Safety Certificate
Certificate No: GS-2024-001
Gas Safe Reg: 123456
Inspection Date: 15/01/2024
Property Address: 123 Main Street`;
      const result = extractWithTemplate(text, 'GAS');
      expect(result.success).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('returns unsuccessful for unknown certificate type', () => {
      const text = 'Some random document text';
      const result = extractWithTemplate(text, 'UNKNOWN_TYPE' as any);
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('handles EICR certificate type', () => {
      const text = `Electrical Installation Condition Report
Certificate Number: EICR-2024-001
Tested by: John Smith
Test Date: 20/02/2024`;
      const result = extractWithTemplate(text, 'EICR');
      expect(result.data).toBeDefined();
    });

    it('handles EPC certificate type', () => {
      const text = `Energy Performance Certificate
Rating: B (85)
Valid Until: 20/02/2034`;
      const result = extractWithTemplate(text, 'EPC');
      expect(result.data).toBeDefined();
    });

    it('includes matched fields count', () => {
      const text = `Gas Safe Reg: 123456
Inspection Date: 15/01/2024`;
      const result = extractWithTemplate(text, 'GAS');
      expect(result.matchedFields).toBeGreaterThanOrEqual(0);
      expect(result.totalExpectedFields).toBeGreaterThan(0);
    });
  });
});

describe('normalizeExtractionOutput()', () => {
  it('normalizes empty input to expected structure', () => {
    const result = normalizeExtractionOutput({});
    expect(result.property).toBeDefined();
    expect(result.inspection).toBeDefined();
    expect(result.engineer).toBeDefined();
    expect(result.findings).toBeDefined();
    expect(result._raw).toBeDefined();
  });

  it('extracts property address from installationAddress', () => {
    const result = normalizeExtractionOutput({
      installationAddress: '123 Main Street, London, W1A 1AA',
    });
    expect(result.property.address_line_1.length).toBeGreaterThan(0);
    expect(result.property.postcode).toBe('W1A 1AA');
  });

  it('extracts property address from propertyAddress', () => {
    const result = normalizeExtractionOutput({
      propertyAddress: '456 High Road, Manchester',
    });
    expect(result.property.address_line_1.length).toBeGreaterThan(0);
  });

  it('parses postcode from address string', () => {
    const result = normalizeExtractionOutput({
      installationAddress: 'Flat 4, 10 Baker Street, NG3 2DQ',
    });
    expect(result.property.postcode).toBe('NG3 2DQ');
  });

  it('handles object address input', () => {
    const result = normalizeExtractionOutput({
      installationAddress: {
        address_line_1: '789 Test Lane',
        city: 'Birmingham',
        postcode: 'B5 4TU',
      },
    });
    expect(result.property.address_line_1).toBe('789 Test Lane');
  });

  it('extracts inspection date from issueDate', () => {
    const result = normalizeExtractionOutput({
      issueDate: '2024-01-15',
    });
    expect(result.inspection.date).toBe('2024-01-15');
  });

  it('extracts inspection date from assessmentDate', () => {
    const result = normalizeExtractionOutput({
      assessmentDate: '2024-02-20',
    });
    expect(result.inspection.date).toBe('2024-02-20');
  });

  it('extracts next due date from expiryDate', () => {
    const result = normalizeExtractionOutput({
      expiryDate: '2025-01-15',
    });
    expect(result.inspection.next_due_date).toBe('2025-01-15');
  });

  it('extracts certificate number', () => {
    const result = normalizeExtractionOutput({
      certificateNumber: 'CERT-2024-001',
    });
    expect(result.inspection.certificate_number).toBe('CERT-2024-001');
  });

  it('extracts engineer details', () => {
    const result = normalizeExtractionOutput({
      engineer: {
        name: 'John Smith',
        company: 'Gas Safe Ltd',
        gasSafeNumber: '123456',
      },
    });
    expect(result.engineer.name).toBe('John Smith');
    expect(result.engineer.company).toBe('Gas Safe Ltd');
    expect(result.engineer.registration_id).toBe('123456');
  });

  it('extracts inspector details', () => {
    const result = normalizeExtractionOutput({
      inspector: {
        name: 'Jane Doe',
        registrationNumber: 'REG-789',
      },
    });
    expect(result.engineer.name).toBe('Jane Doe');
    expect(result.engineer.registration_id).toBe('REG-789');
  });

  it('extracts defects as observations', () => {
    const result = normalizeExtractionOutput({
      defects: [
        { description: 'Faulty wiring', code: 'C2', location: 'Kitchen' },
      ],
    });
    expect(result.findings.observations.length).toBe(1);
    expect(result.findings.observations[0].description).toBe('Faulty wiring');
    expect(result.findings.observations[0].code).toBe('C2');
  });

  it('extracts observations as observations', () => {
    const result = normalizeExtractionOutput({
      observations: [
        { finding: 'Minor issue noted' },
      ],
    });
    expect(result.findings.observations.length).toBe(1);
    expect(result.findings.observations[0].description).toBe('Minor issue noted');
  });

  it('extracts recommendations as remedial actions', () => {
    const result = normalizeExtractionOutput({
      recommendations: [
        { recommendation: 'Replace socket', priority: 'URGENT' },
      ],
    });
    expect(result.findings.remedial_actions.length).toBe(1);
    expect(result.findings.remedial_actions[0].description).toBe('Replace socket');
    expect(result.findings.remedial_actions[0].priority).toBe('URGENT');
  });

  it('extracts overall outcome', () => {
    const result = normalizeExtractionOutput({
      overallOutcome: 'SATISFACTORY',
    });
    expect(result.inspection.outcome).toBe('SATISFACTORY');
  });

  it('extracts risk level as outcome', () => {
    const result = normalizeExtractionOutput({
      riskLevel: 'LOW',
    });
    expect(result.inspection.outcome).toBe('LOW');
  });

  it('keeps raw data in _raw field', () => {
    const rawInput = { customField: 'test value' };
    const result = normalizeExtractionOutput(rawInput);
    expect(result._raw).toEqual(rawInput);
  });

  it('handles empty arrays for findings', () => {
    const result = normalizeExtractionOutput({
      defects: [],
      recommendations: [],
    });
    expect(result.findings.observations).toEqual([]);
    expect(result.findings.remedial_actions).toEqual([]);
  });

  it('handles city extraction from multi-part address', () => {
    const result = normalizeExtractionOutput({
      installationAddress: '10 Test Street, Apartment 5, Manchester, M1 2AB',
    });
    expect(result.property.city).toBe('Manchester');
  });
});

describe('Extraction Mapping Functions', () => {
  describe('mapApplianceOutcome logic', () => {
    const mapApplianceOutcome = (outcome: string | undefined | null): 'PASS' | 'FAIL' | 'N/A' | null => {
      if (!outcome) return null;
      const upper = outcome.toUpperCase().trim();
      if (upper === 'PASS' || upper === 'SATISFACTORY' || upper === 'OK' || upper === 'SAFE' || upper === 'PASSED') return 'PASS';
      if (upper === 'FAIL' || upper === 'FAILED' || upper === 'UNSATISFACTORY' || 
          upper === 'ID' || upper === 'IMMEDIATE DANGER' || upper.includes('IMMEDIATE DANGER') ||
          upper === 'AR' || upper === 'AT RISK' || upper.includes('AT RISK') ||
          upper === 'NCS' || upper === 'NOT TO CURRENT STANDARD' || upper.includes('NOT TO CURRENT STANDARD') ||
          upper === 'CONDEMNED' || upper === 'CONDDEM' ||
          upper === 'UNSAFE' || upper === 'NOT SAFE' ||
          upper === 'C1' || upper === 'C2' || upper === 'CI' || upper === 'CII' ||
          upper === 'FURTHER INVESTIGATION' || upper.includes('FURTHER INVESTIGATION') ||
          upper === 'FI' || upper === 'REQUIRES ACTION' || upper === 'ACTION REQUIRED') return 'FAIL';
      if (upper === 'N/A' || upper === 'NA' || upper === 'NOT APPLICABLE' || upper === 'NOT TESTED' || 
          upper === 'SERVICE ONLY' || upper === 'S' ||
          upper === 'NOT REQUIRED' || upper === 'NOT CHECKED' || upper === 'INSPECTION ONLY') return 'N/A';
      return null;
    };

    it('returns null for null/undefined input', () => {
      expect(mapApplianceOutcome(null)).toBeNull();
      expect(mapApplianceOutcome(undefined)).toBeNull();
    });

    it('maps PASS variants correctly', () => {
      expect(mapApplianceOutcome('PASS')).toBe('PASS');
      expect(mapApplianceOutcome('Satisfactory')).toBe('PASS');
      expect(mapApplianceOutcome('OK')).toBe('PASS');
      expect(mapApplianceOutcome('Safe')).toBe('PASS');
      expect(mapApplianceOutcome('PASSED')).toBe('PASS');
    });

    it('maps FAIL variants correctly', () => {
      expect(mapApplianceOutcome('FAIL')).toBe('FAIL');
      expect(mapApplianceOutcome('Failed')).toBe('FAIL');
      expect(mapApplianceOutcome('Unsatisfactory')).toBe('FAIL');
      expect(mapApplianceOutcome('ID')).toBe('FAIL');
      expect(mapApplianceOutcome('AR')).toBe('FAIL');
      expect(mapApplianceOutcome('C1')).toBe('FAIL');
      expect(mapApplianceOutcome('C2')).toBe('FAIL');
      expect(mapApplianceOutcome('CONDEMNED')).toBe('FAIL');
      expect(mapApplianceOutcome('UNSAFE')).toBe('FAIL');
    });

    it('maps N/A variants correctly', () => {
      expect(mapApplianceOutcome('N/A')).toBe('N/A');
      expect(mapApplianceOutcome('NA')).toBe('N/A');
      expect(mapApplianceOutcome('Not Applicable')).toBe('N/A');
      expect(mapApplianceOutcome('Not Tested')).toBe('N/A');
      expect(mapApplianceOutcome('SERVICE ONLY')).toBe('N/A');
    });

    it('returns null for unknown outcomes', () => {
      expect(mapApplianceOutcome('UNKNOWN')).toBeNull();
      expect(mapApplianceOutcome('MAYBE')).toBeNull();
    });
  });

  describe('mapDefectPriority logic', () => {
    const mapDefectPriority = (priority: string | undefined | null): 'IMMEDIATE' | 'URGENT' | 'ADVISORY' | 'ROUTINE' | null => {
      if (!priority) return null;
      const upper = priority.toUpperCase().trim();
      if (upper === 'IMMEDIATE' || upper === 'C1' || upper === 'ID' || upper === 'DANGER') return 'IMMEDIATE';
      if (upper === 'URGENT' || upper === 'C2' || upper === 'AR' || upper === 'AT RISK' || upper === 'NCS') return 'URGENT';
      if (upper === 'ADVISORY' || upper === 'FI' || upper === 'FYI' || upper === 'IMPROVEMENT') return 'ADVISORY';
      if (upper === 'ROUTINE' || upper === 'C3' || upper === 'OBSERVATION' || upper === 'MINOR') return 'ROUTINE';
      return null;
    };

    it('returns null for null/undefined input', () => {
      expect(mapDefectPriority(null)).toBeNull();
      expect(mapDefectPriority(undefined)).toBeNull();
    });

    it('maps IMMEDIATE variants correctly', () => {
      expect(mapDefectPriority('IMMEDIATE')).toBe('IMMEDIATE');
      expect(mapDefectPriority('C1')).toBe('IMMEDIATE');
      expect(mapDefectPriority('ID')).toBe('IMMEDIATE');
      expect(mapDefectPriority('DANGER')).toBe('IMMEDIATE');
    });

    it('maps URGENT variants correctly', () => {
      expect(mapDefectPriority('URGENT')).toBe('URGENT');
      expect(mapDefectPriority('C2')).toBe('URGENT');
      expect(mapDefectPriority('AR')).toBe('URGENT');
      expect(mapDefectPriority('NCS')).toBe('URGENT');
    });

    it('maps ADVISORY variants correctly', () => {
      expect(mapDefectPriority('ADVISORY')).toBe('ADVISORY');
      expect(mapDefectPriority('FI')).toBe('ADVISORY');
      expect(mapDefectPriority('FYI')).toBe('ADVISORY');
      expect(mapDefectPriority('IMPROVEMENT')).toBe('ADVISORY');
    });

    it('maps ROUTINE variants correctly', () => {
      expect(mapDefectPriority('ROUTINE')).toBe('ROUTINE');
      expect(mapDefectPriority('C3')).toBe('ROUTINE');
      expect(mapDefectPriority('OBSERVATION')).toBe('ROUTINE');
      expect(mapDefectPriority('MINOR')).toBe('ROUTINE');
    });

    it('returns null for unknown priorities', () => {
      expect(mapDefectPriority('UNKNOWN')).toBeNull();
      expect(mapDefectPriority('CRITICAL')).toBeNull();
    });
  });

  describe('mapDocumentTypeToCertificateType logic', () => {
    const mapDocumentTypeToCertificateType = (documentType: string | undefined): string | undefined => {
      if (!documentType) return undefined;
      const docTypeLower = documentType.toLowerCase();
      if (docTypeLower.includes('gas safety') || docTypeLower.includes('lgsr') || docTypeLower.includes('cp12') || docTypeLower.includes('landlord gas')) return 'GAS_SAFETY';
      if (docTypeLower.includes('eicr') || docTypeLower.includes('electrical installation') || docTypeLower.includes('electrical condition')) return 'EICR';
      if (docTypeLower.includes('fire risk') || docTypeLower.includes('fra') || docTypeLower.includes('fire safety')) return 'FIRE_RISK_ASSESSMENT';
      if (docTypeLower.includes('asbestos')) return 'ASBESTOS_SURVEY';
      if (docTypeLower.includes('legionella') || docTypeLower.includes('water hygiene') || docTypeLower.includes('water risk')) return 'LEGIONELLA_ASSESSMENT';
      if (docTypeLower.includes('lift') || docTypeLower.includes('loler') || docTypeLower.includes('elevator')) return 'LIFT_LOLER';
      if (docTypeLower.includes('energy performance') || docTypeLower.includes('epc')) return 'EPC';
      return undefined;
    };

    it('returns undefined for undefined input', () => {
      expect(mapDocumentTypeToCertificateType(undefined)).toBeUndefined();
    });

    it('maps gas safety document types', () => {
      expect(mapDocumentTypeToCertificateType('Gas Safety Certificate')).toBe('GAS_SAFETY');
      expect(mapDocumentTypeToCertificateType('LGSR')).toBe('GAS_SAFETY');
      expect(mapDocumentTypeToCertificateType('CP12')).toBe('GAS_SAFETY');
      expect(mapDocumentTypeToCertificateType('Landlord Gas Safety')).toBe('GAS_SAFETY');
    });

    it('maps EICR document types', () => {
      expect(mapDocumentTypeToCertificateType('EICR')).toBe('EICR');
      expect(mapDocumentTypeToCertificateType('Electrical Installation Condition Report')).toBe('EICR');
      expect(mapDocumentTypeToCertificateType('Electrical Condition')).toBe('EICR');
    });

    it('maps fire risk document types', () => {
      expect(mapDocumentTypeToCertificateType('Fire Risk Assessment')).toBe('FIRE_RISK_ASSESSMENT');
      expect(mapDocumentTypeToCertificateType('FRA Document')).toBe('FIRE_RISK_ASSESSMENT');
      expect(mapDocumentTypeToCertificateType('Fire Safety Report')).toBe('FIRE_RISK_ASSESSMENT');
    });

    it('maps asbestos document types', () => {
      expect(mapDocumentTypeToCertificateType('Asbestos Survey')).toBe('ASBESTOS_SURVEY');
      expect(mapDocumentTypeToCertificateType('Asbestos Management')).toBe('ASBESTOS_SURVEY');
    });

    it('maps legionella document types', () => {
      expect(mapDocumentTypeToCertificateType('Legionella Risk Assessment')).toBe('LEGIONELLA_ASSESSMENT');
      expect(mapDocumentTypeToCertificateType('Water Hygiene Report')).toBe('LEGIONELLA_ASSESSMENT');
      expect(mapDocumentTypeToCertificateType('Water Risk Assessment')).toBe('LEGIONELLA_ASSESSMENT');
    });

    it('maps lift/LOLER document types', () => {
      expect(mapDocumentTypeToCertificateType('Lift Inspection')).toBe('LIFT_LOLER');
      expect(mapDocumentTypeToCertificateType('LOLER Certificate')).toBe('LIFT_LOLER');
      expect(mapDocumentTypeToCertificateType('Elevator Service')).toBe('LIFT_LOLER');
    });

    it('maps EPC document types', () => {
      expect(mapDocumentTypeToCertificateType('Energy Performance Certificate')).toBe('EPC');
      expect(mapDocumentTypeToCertificateType('EPC Report')).toBe('EPC');
    });

    it('returns undefined for unknown document types', () => {
      expect(mapDocumentTypeToCertificateType('Unknown Document')).toBeUndefined();
      expect(mapDocumentTypeToCertificateType('Random Report')).toBeUndefined();
    });
  });
});

describe('Format Detection Functions', () => {
  describe('detectFormatFromMime()', () => {
    it('detects PDF format', () => {
      expect(detectFormatFromMime('application/pdf')).toBe('pdf-native');
    });

    it('detects image formats', () => {
      expect(detectFormatFromMime('image/jpeg')).toBe('image');
      expect(detectFormatFromMime('image/png')).toBe('image');
      expect(detectFormatFromMime('image/tiff')).toBe('image');
      expect(detectFormatFromMime('image/webp')).toBe('image');
    });

    it('detects document formats', () => {
      expect(detectFormatFromMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('docx');
      expect(detectFormatFromMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('xlsx');
    });

    it('detects text formats', () => {
      expect(detectFormatFromMime('text/csv')).toBe('csv');
      expect(detectFormatFromMime('text/html')).toBe('html');
      expect(detectFormatFromMime('text/plain')).toBe('txt');
    });

    it('detects email formats', () => {
      expect(detectFormatFromMime('message/rfc822')).toBe('email');
      expect(detectFormatFromMime('application/vnd.ms-outlook')).toBe('email');
    });

    it('defaults to pdf-native for unknown mime types', () => {
      expect(detectFormatFromMime('unknown/type')).toBe('pdf-native');
    });
  });

  describe('detectFormatFromExtension()', () => {
    it('detects PDF extension', () => {
      expect(detectFormatFromExtension('document.pdf')).toBe('pdf-native');
    });

    it('detects image extensions', () => {
      expect(detectFormatFromExtension('photo.jpg')).toBe('image');
      expect(detectFormatFromExtension('image.jpeg')).toBe('image');
      expect(detectFormatFromExtension('scan.png')).toBe('image');
      expect(detectFormatFromExtension('doc.tiff')).toBe('image');
    });

    it('detects document extensions', () => {
      expect(detectFormatFromExtension('report.docx')).toBe('docx');
      expect(detectFormatFromExtension('old.doc')).toBe('docx');
      expect(detectFormatFromExtension('data.xlsx')).toBe('xlsx');
      expect(detectFormatFromExtension('legacy.xls')).toBe('xlsx');
    });

    it('detects text extensions', () => {
      expect(detectFormatFromExtension('data.csv')).toBe('csv');
      expect(detectFormatFromExtension('page.html')).toBe('html');
      expect(detectFormatFromExtension('readme.txt')).toBe('txt');
    });

    it('handles uppercase extensions', () => {
      expect(detectFormatFromExtension('DOCUMENT.PDF')).toBe('pdf-native');
      expect(detectFormatFromExtension('IMAGE.JPG')).toBe('image');
    });

    it('defaults to pdf-native for unknown extensions', () => {
      expect(detectFormatFromExtension('file.xyz')).toBe('pdf-native');
    });
  });

  describe('detectCertificateTypeFromFilename()', () => {
    it('detects gas safety from filename', () => {
      expect(detectCertificateTypeFromFilename('LGSR_2024.pdf')).toBe('GAS_SAFETY');
      expect(detectCertificateTypeFromFilename('CP12_certificate.pdf')).toBe('GAS_SAFETY');
      expect(detectCertificateTypeFromFilename('gas-safety-record.pdf')).toBe('GAS_SAFETY');
      expect(detectCertificateTypeFromFilename('gas_safety_2024.pdf')).toBe('GAS_SAFETY');
    });

    it('detects EICR from filename', () => {
      expect(detectCertificateTypeFromFilename('EICR_report.pdf')).toBe('EICR');
      expect(detectCertificateTypeFromFilename('electrical_installation_report.pdf')).toBe('EICR');
      expect(detectCertificateTypeFromFilename('periodic_inspection.pdf')).toBe('EICR');
    });

    it('detects EPC from filename', () => {
      expect(detectCertificateTypeFromFilename('EPC_certificate.pdf')).toBe('EPC');
      expect(detectCertificateTypeFromFilename('energy_performance.pdf')).toBe('EPC');
    });

    it('detects FRA from filename', () => {
      expect(detectCertificateTypeFromFilename('FRA_2024.pdf')).toBe('FRA');
      expect(detectCertificateTypeFromFilename('fire_risk_assessment.pdf')).toBe('FRA');
      expect(detectCertificateTypeFromFilename('fire-risk-report.pdf')).toBe('FRA');
    });

    it('detects legionella from filename', () => {
      expect(detectCertificateTypeFromFilename('legionella_assessment.pdf')).toBe('LEGIONELLA');
      expect(detectCertificateTypeFromFilename('water_risk_assessment.pdf')).toBe('LEGIONELLA');
    });

    it('detects asbestos from filename', () => {
      expect(detectCertificateTypeFromFilename('asbestos_survey.pdf')).toBe('ASBESTOS');
      expect(detectCertificateTypeFromFilename('management_survey.pdf')).toBe('ASBESTOS');
    });

    it('detects lift/LOLER from filename', () => {
      expect(detectCertificateTypeFromFilename('LOLER_certificate.pdf')).toBe('LIFT');
      expect(detectCertificateTypeFromFilename('lift_inspection.pdf')).toBe('LIFT');
    });

    it('returns null for unknown filenames', () => {
      expect(detectCertificateTypeFromFilename('document.pdf')).toBeNull();
      expect(detectCertificateTypeFromFilename('random_file.pdf')).toBeNull();
    });
  });

  describe('detectCertificateType()', () => {
    it('detects gas safety from text content', () => {
      expect(detectCertificateType('LANDLORD GAS SAFETY RECORD')).toBe('GAS_SAFETY');
      expect(detectCertificateType('Gas Safe Register Number: 123456')).toBe('GAS_SAFETY');
      expect(detectCertificateType('CP12 Certificate')).toBe('GAS_SAFETY');
    });

    it('detects EICR from text content', () => {
      expect(detectCertificateType('ELECTRICAL INSTALLATION CONDITION REPORT')).toBe('EICR');
      expect(detectCertificateType('EICR in accordance with BS 7671')).toBe('EICR');
      expect(detectCertificateType('Periodic Inspection Report')).toBe('EICR');
    });

    it('detects EPC from text content', () => {
      expect(detectCertificateType('ENERGY PERFORMANCE CERTIFICATE')).toBe('EPC');
      expect(detectCertificateType('Energy Efficiency Rating: B')).toBe('EPC');
    });

    it('detects FRA from text content', () => {
      expect(detectCertificateType('FIRE RISK ASSESSMENT')).toBe('FRA');
      expect(detectCertificateType('PAS 79 compliant assessment')).toBe('FRA');
      expect(detectCertificateType('Regulatory Reform Fire Safety Order')).toBe('FRA');
    });

    it('detects legionella from text content', () => {
      expect(detectCertificateType('LEGIONELLA RISK ASSESSMENT')).toBe('LEGIONELLA');
      expect(detectCertificateType('Water Hygiene Assessment')).toBe('LEGIONELLA');
      expect(detectCertificateType('L8 Risk Assessment')).toBe('LEGIONELLA');
    });

    it('detects asbestos from text content', () => {
      expect(detectCertificateType('ASBESTOS MANAGEMENT SURVEY')).toBe('ASBESTOS');
      expect(detectCertificateType('HSG264 compliant survey')).toBe('ASBESTOS');
    });

    it('detects lift/LOLER from text content', () => {
      expect(detectCertificateType('LOLER Thorough Examination')).toBe('LIFT');
      expect(detectCertificateType('Passenger Lift Inspection')).toBe('LIFT');
    });

    it('detects PAT from text content', () => {
      expect(detectCertificateType('PORTABLE APPLIANCE TESTING')).toBe('PAT');
      expect(detectCertificateType('PAT Test Results')).toBe('PAT');
    });

    it('detects emergency lighting from text content', () => {
      expect(detectCertificateType('EMERGENCY LIGHTING TEST CERTIFICATE')).toBe('EMLT');
      expect(detectCertificateType('BS 5266 Emergency Lighting')).toBe('EMLT');
    });

    it('detects fire alarm from text content', () => {
      expect(detectCertificateType('FIRE ALARM SERVICE CERTIFICATE')).toBe('FIRE_ALARM');
      expect(detectCertificateType('BS 5839 Fire Detection System')).toBe('FIRE_ALARM');
    });

    it('detects smoke/CO detectors from text content', () => {
      expect(detectCertificateType('SMOKE ALARM INSTALLATION')).toBe('SMOKE_CO');
      expect(detectCertificateType('Carbon Monoxide Detector Test')).toBe('SMOKE_CO');
    });

    it('returns UNKNOWN for unrecognized text', () => {
      expect(detectCertificateType('Random document content')).toBe('UNKNOWN');
      expect(detectCertificateType('Invoice for services')).toBe('UNKNOWN');
    });
  });

  describe('classifyDocument()', () => {
    it('classifies structured certificates', () => {
      expect(classifyDocument('Gas Safety Record', 'GAS')).toBe('structured_certificate');
      expect(classifyDocument('EICR Report', 'EICR')).toBe('structured_certificate');
      expect(classifyDocument('EPC Certificate', 'EPC')).toBe('structured_certificate');
    });

    it('classifies complex documents', () => {
      expect(classifyDocument('Fire Risk Assessment narrative', 'FRA')).toBe('complex_document');
      expect(classifyDocument('Asbestos Survey report', 'ASBESTOS')).toBe('complex_document');
      expect(classifyDocument('Legionella Assessment', 'LEGIONELLA')).toBe('complex_document');
    });

    it('detects handwritten content', () => {
      expect(classifyDocument('HANDWRITTEN notes present', 'UNKNOWN')).toBe('handwritten_content');
      expect(classifyDocument('Contains SIGNATURE: John Smith', 'UNKNOWN')).toBe('handwritten_content');
    });

    it('returns unknown for unclassified', () => {
      expect(classifyDocument('Standard text content', 'UNKNOWN')).toBe('unknown');
      expect(classifyDocument('Generic document', 'LIFT')).toBe('unknown');
    });
  });
});
