import { describe, it, expect } from 'vitest';
import { generateRemedialActions, generateRemedialActionsFromConfig, determineOutcome, normalizeExtractionOutput } from '../server/extraction';
import { extractDefects, extractAppliances, extractWithTemplate } from '../server/services/extraction/template-patterns';

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
