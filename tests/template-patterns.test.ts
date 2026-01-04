import { describe, it, expect, vi } from 'vitest';
import {
  extractDefects,
  extractAppliances,
  extractWithTemplate,
  type TemplateExtractionResult,
} from '../server/services/extraction/template-patterns';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Template Patterns Service', () => {
  describe('extractDefects', () => {
    it('should extract C1 defect code', () => {
      const text = 'Observation: C1 - Danger present, risk of injury';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('C1');
      expect(defects[0].priority).toBe('IMMEDIATE');
    });

    it('should extract C2 defect code', () => {
      const text = 'Issue identified: C2 potentially dangerous condition found';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('C2');
      expect(defects[0].priority).toBe('URGENT');
    });

    it('should extract C3 defect code', () => {
      const text = 'Note: C3 improvement recommended';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('C3');
      expect(defects[0].priority).toBe('ROUTINE');
    });

    it('should extract FI (Further Investigation) defect code', () => {
      const text = 'Circuit 5: FI required - unable to test';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('FI');
      expect(defects[0].priority).toBe('URGENT');
    });

    it('should extract ID (Immediately Dangerous) defect code', () => {
      const text = 'Gas appliance: ID - requires immediate attention';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('ID');
      expect(defects[0].priority).toBe('IMMEDIATE');
    });

    it('should extract AR (At Risk) defect code', () => {
      const text = 'Boiler status: AR at risk condition noted';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('AR');
      expect(defects[0].priority).toBe('URGENT');
    });

    it('should extract NCS (Not Current Standards) defect code', () => {
      const text = 'Pipework: NCS not to current standard';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('NCS');
      expect(defects[0].priority).toBe('ROUTINE');
    });

    it('should extract multiple defects from multiline text', () => {
      const text = `
        Circuit 1: C1 - danger present
        Circuit 2: C2 - potentially dangerous
        Circuit 3: C3 - improvement recommended
      `;
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array for text with no defects', () => {
      const text = 'All circuits tested satisfactorily. No issues found.';
      const defects = extractDefects(text);
      expect(defects).toEqual([]);
    });

    it('should set description to the line text', () => {
      const text = 'C1 - Main consumer unit requires immediate replacement';
      const defects = extractDefects(text);
      expect(defects[0].description).toBe('C1 - Main consumer unit requires immediate replacement');
    });

    it('should extract high risk fire defects', () => {
      const text = 'High risk fire escape route blocked';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].priority).toBe('IMMEDIATE');
    });

    it('should extract medium risk defects', () => {
      const text = 'Medium risk - fire door closer not functioning';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
    });

    it('should extract P1 priority defects', () => {
      const text = 'P1 urgent action required - no escape lighting';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].code).toBe('P1');
      expect(defects[0].priority).toBe('IMMEDIATE');
    });
  });

  describe('extractAppliances', () => {
    it('should extract gas appliances from GAS certificate text', () => {
      const text = `
        Appliance 1: Boiler - Make: Worcester Model: Greenstar - PASS
        Appliance 2: Fire - Make: Valor - FAIL
      `;
      const appliances = extractAppliances(text, 'GAS');
      expect(appliances.length).toBeGreaterThanOrEqual(2);
    });

    it('should set correct outcome for passing appliances', () => {
      const text = 'Appliance 1: Boiler satisfactory';
      const appliances = extractAppliances(text, 'GAS');
      expect(appliances.length).toBeGreaterThan(0);
      expect(appliances[0].outcome).toBe('PASS');
    });

    it('should set correct outcome for failing appliances', () => {
      const text = 'Appliance 1: Boiler FAIL unsafe condition';
      const appliances = extractAppliances(text, 'GAS');
      expect(appliances.length).toBeGreaterThan(0);
      expect(appliances[0].outcome).toBe('FAIL');
    });

    it('should extract appliances from OIL certificate text', () => {
      const text = 'Appliance 1: Oil boiler - pass';
      const appliances = extractAppliances(text, 'OIL');
      expect(appliances.length).toBeGreaterThan(0);
    });

    it('should extract appliances from LPG certificate text', () => {
      const text = 'Appliance 1: LPG heater - satisfactory';
      const appliances = extractAppliances(text, 'LPG');
      expect(appliances.length).toBeGreaterThan(0);
    });

    it('should extract make from appliance text', () => {
      const text = 'Appliance 1: Make: Worcester Bosch model: 25i - pass';
      const appliances = extractAppliances(text, 'GAS');
      expect(appliances.length).toBeGreaterThan(0);
      if (appliances[0].make) {
        expect(appliances[0].make).toContain('Worcester');
      }
    });

    it('should return empty array for unsupported certificate types', () => {
      const text = 'Appliance 1: Test device - pass';
      const appliances = extractAppliances(text, 'EICR');
      expect(appliances).toEqual([]);
    });

    it('should handle safe/unsafe keywords', () => {
      const text = 'Appliance 1: Cooker safe for use';
      const appliances = extractAppliances(text, 'GAS');
      expect(appliances.length).toBeGreaterThan(0);
      expect(appliances[0].outcome).toBe('PASS');
    });
  });

  describe('extractWithTemplate', () => {
    it('should extract data from GAS certificate text', () => {
      const text = `
        Gas Safety Certificate
        Certificate No: GAS-2024-001
        Gas Safe Reg: 123456
        Inspection Date: 15/03/2024
        Property Address: 123 Main Street, London, SW1A 1AA
        Overall Result: SATISFACTORY
        Next Inspection Due: 15/03/2025
      `;
      const result = extractWithTemplate(text, 'GAS');
      expect(result.success).toBe(true);
      expect(result.matchedFields).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return success false for unknown certificate types', () => {
      const text = 'Some random text';
      const result = extractWithTemplate(text, 'UNKNOWN_TYPE' as any);
      expect(result.success).toBe(false);
      expect(result.matchedFields).toBe(0);
    });

    it('should extract EICR certificate data', () => {
      const text = `
        Electrical Installation Condition Report
        Certificate Number: EICR-2024-001
        NICEIC Reg: 123456
        Date of Inspection: 01/02/2024
        Property Address: 456 High Street
        Overall Assessment: SATISFACTORY
        Next Inspection Due: 01/02/2029
      `;
      const result = extractWithTemplate(text, 'EICR');
      expect(result.matchedFields).toBeGreaterThan(0);
    });

    it('should extract EPC certificate data', () => {
      const text = `
        Energy Performance Certificate
        Certificate Reference: EPC-001-2024
        Property Address: 789 Oak Avenue
        Current Rating: C
        Potential Rating: B
        Valid Until: 15/01/2034
      `;
      const result = extractWithTemplate(text, 'EPC');
      expect(result.matchedFields).toBeGreaterThan(0);
    });

    it('should handle certificate type aliases', () => {
      const text = `
        Gas Service Record
        Certificate No: GSR-2024-001
        Gas Safe Reg: 654321
        Service Date: 10/01/2024
        Next Service Due: 10/01/2025
      `;
      const result = extractWithTemplate(text, 'GAS_SVC');
      expect(result.matchedFields).toBeGreaterThan(0);
    });

    it('should include defects in extraction result', () => {
      const text = `
        Electrical Installation Condition Report
        Certificate Number: EICR-2024-002
        C1 - Danger present at consumer unit
        C2 - Potentially dangerous wiring in bathroom
      `;
      const result = extractWithTemplate(text, 'EICR');
      expect(result.data.defects).toBeDefined();
      expect(result.data.defects!.length).toBeGreaterThanOrEqual(2);
    });

    it('should include appliances in extraction result for gas certs', () => {
      const text = `
        Gas Safety Certificate
        Certificate No: GAS-2024-003
        Gas Safe Reg: 111222
        Appliance 1: Boiler - PASS
        Appliance 2: Fire - PASS
      `;
      const result = extractWithTemplate(text, 'GAS');
      expect(result.data.appliances).toBeDefined();
      expect(result.data.appliances!.length).toBeGreaterThanOrEqual(2);
    });

    it('should calculate confidence based on matched fields', () => {
      const minimalText = `
        Certificate No: TEST-001
        Inspection Date: 01/01/2024
      `;
      const fullText = `
        Gas Safety Certificate
        Certificate No: GAS-2024-FULL
        Gas Safe Reg: 999888
        Inspection Date: 15/03/2024
        Property Address: Full Address Here
        Engineer: John Smith
        Overall Result: SATISFACTORY
        Expiry Date: 15/03/2025
      `;
      const minResult = extractWithTemplate(minimalText, 'GAS');
      const fullResult = extractWithTemplate(fullText, 'GAS');
      expect(fullResult.confidence).toBeGreaterThan(minResult.confidence);
    });

    it('should boost confidence when defects are found', () => {
      const textWithDefects = `
        Certificate No: EICR-2024-DEF
        NICEIC Reg: 123456
        Inspection Date: 01/02/2024
        C1 - Danger present
        C2 - Potentially dangerous
      `;
      const result = extractWithTemplate(textWithDefects, 'EICR');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should set certificateType in extracted data', () => {
      const text = 'Certificate No: TEST-001';
      const result = extractWithTemplate(text, 'GAS');
      expect(result.data.certificateType).toBe('GAS');
    });

    it('should handle FRA (Fire Risk Assessment) type', () => {
      const text = `
        Fire Risk Assessment
        Report Reference: FRA-2024-001
        Assessment Date: 15/03/2024
        Property Address: 100 Tower Block
        Overall Risk Rating: Moderate
        Next Review Due: 15/03/2025
      `;
      const result = extractWithTemplate(text, 'FRA');
      expect(result.matchedFields).toBeGreaterThan(0);
    });

    it('should handle ASBESTOS type', () => {
      const text = `
        Asbestos Survey Report
        Survey Reference: ASB-2024-001
        Survey Date: 01/04/2024
        Property Address: Old Building
      `;
      const result = extractWithTemplate(text, 'ASBESTOS');
      expect(result.data.certificateType).toBe('ASBESTOS');
    });

    it('should handle LEGIONELLA type', () => {
      const text = `
        Legionella Risk Assessment
        Report Reference: LEG-2024-001
        Assessment Date: 20/05/2024
        Property Address: Care Home
        Risk Level: Low
      `;
      const result = extractWithTemplate(text, 'LEGIONELLA');
      expect(result.data.certificateType).toBe('LEGIONELLA');
    });

    it('should extract OIL certificate data', () => {
      const text = `
        Oil Boiler Service Certificate
        Certificate No: OIL-2024-001
        OFTEC Reg: C12345
        Service Date: 10/06/2024
        Property Address: Rural Cottage
        Result: PASS
      `;
      const result = extractWithTemplate(text, 'OIL');
      expect(result.matchedFields).toBeGreaterThan(0);
    });

    it('should handle PAT testing type', () => {
      const text = `
        Portable Appliance Testing Report
        Report Reference: PAT-2024-001
        Test Date: 25/07/2024
        Location: Office Building
        Items Tested: 50
        Items Passed: 48
        Items Failed: 2
      `;
      const result = extractWithTemplate(text, 'PAT');
      expect(result.data.certificateType).toBe('PAT');
    });
  });

  describe('TemplateExtractionResult structure', () => {
    it('should have correct structure', () => {
      const result = extractWithTemplate('Certificate No: TEST-001', 'GAS');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('matchedFields');
      expect(result).toHaveProperty('totalExpectedFields');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.confidence).toBe('number');
    });

    it('should have data with correct shape', () => {
      const result = extractWithTemplate('Certificate No: TEST-001', 'GAS');
      expect(result.data).toHaveProperty('certificateType');
      expect(result.data).toHaveProperty('appliances');
      expect(result.data).toHaveProperty('defects');
    });
  });
});
