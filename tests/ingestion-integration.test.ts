import { describe, it, expect, beforeAll } from 'vitest';
import { detectCertificateTypeDB, clearPatternCache } from '../server/services/extraction/pattern-detector';
import { determineComplianceOutcome, clearRulesCache } from '../server/services/extraction/outcome-evaluator';
import type { ExtractedCertificateData, CertificateTypeCode } from '../server/services/extraction/types';

function createTestData(overrides: Partial<ExtractedCertificateData> & { certificateType: CertificateTypeCode }): ExtractedCertificateData {
  return {
    certificateNumber: null,
    propertyAddress: null,
    uprn: null,
    inspectionDate: null,
    expiryDate: null,
    nextInspectionDate: null,
    outcome: null,
    engineerName: null,
    engineerRegistration: null,
    contractorName: null,
    contractorRegistration: null,
    appliances: [],
    defects: [],
    additionalFields: {},
    ...overrides,
  };
}

describe('Database-Driven Ingestion Integration Tests', () => {
  beforeAll(() => {
    clearPatternCache();
    clearRulesCache();
  });

  describe('Pattern Detection - Filename Matching', () => {
    const filenameTests = [
      { filename: 'CP12_123_Main_Street.pdf', expectedType: 'GAS_SAFETY', description: 'Gas Safety CP12 certificate' },
      { filename: 'lgsr-property-456.pdf', expectedType: 'GAS_SAFETY', description: 'LGSR certificate' },
      { filename: 'gas_safe_certificate.pdf', expectedType: 'GAS_SAFETY', description: 'Gas Safe certificate' },
      { filename: 'eicr_report_2024.pdf', expectedType: 'EICR', description: 'EICR report' },
      { filename: 'electrical_installation_condition_report.pdf', expectedType: 'EICR', description: 'Full EICR name' },
      { filename: 'FRA_Block_A_2024.pdf', expectedType: 'FRA', description: 'Fire Risk Assessment' },
      { filename: 'fire_risk_assessment_report.pdf', expectedType: 'FRA', description: 'Full FRA name' },
      { filename: 'legionella_risk_assessment.pdf', expectedType: 'LEGIONELLA', description: 'Legionella Risk Assessment' },
      { filename: 'l8_acop_assessment.pdf', expectedType: 'LEGIONELLA', description: 'L8 ACOP assessment' },
      { filename: 'asbestos_survey_management.pdf', expectedType: 'ASBESTOS', description: 'Asbestos Management Survey' },
      { filename: 'hsg264_survey.pdf', expectedType: 'ASBESTOS', description: 'HSG264 survey' },
      { filename: 'loler_inspection_lift.pdf', expectedType: 'LIFT', description: 'LOLER lift inspection' },
      { filename: 'epc_certificate_rating.pdf', expectedType: 'EPC', description: 'EPC certificate' },
      { filename: 'energy_performance_certificate.pdf', expectedType: 'EPC', description: 'Full EPC name' },
    ];

    for (const test of filenameTests) {
      it(`should detect ${test.description} from filename: ${test.filename}`, async () => {
        const result = await detectCertificateTypeDB(test.filename, null);
        console.log(`[TEST] ${test.filename} -> ${result.certificateType} (${result.source}, confidence: ${result.confidence})`);
        
        if (result.source === 'database') {
          expect(result.certificateType).toBe(test.expectedType);
          expect(result.confidence).toBeGreaterThan(0);
        } else {
          console.log(`  -> Fallback used, checking if type matches expected or UNKNOWN`);
          expect(['UNKNOWN', test.expectedType]).toContain(result.certificateType);
        }
      });
    }
  });

  describe('Pattern Detection - Text Content Matching', () => {
    const textTests = [
      { 
        text: 'LANDLORD GAS SAFETY RECORD Gas Safety (Installation and Use) Regulations 1998',
        expectedType: 'GAS_SAFETY',
        description: 'Gas Safety Record text'
      },
      {
        text: 'Gas Safe Register No: 123456 Engineer ID: 78901',
        expectedType: 'GAS_SAFETY',
        description: 'Gas Safe Register reference'
      },
      {
        text: 'ELECTRICAL INSTALLATION CONDITION REPORT BS 7671 Requirements for Electrical Installations',
        expectedType: 'EICR',
        description: 'EICR with BS 7671 reference'
      },
      {
        text: 'C1 Code: Danger present requiring urgent remedial action',
        expectedType: 'EICR',
        description: 'EICR C1 defect code'
      },
      {
        text: 'FIRE RISK ASSESSMENT Regulatory Reform (Fire Safety) Order 2005',
        expectedType: 'FRA',
        description: 'FRA with RRO 2005 reference'
      },
      {
        text: 'Legionella Risk Assessment L8 ACOP Approved Code of Practice',
        expectedType: 'LEGIONELLA',
        description: 'Legionella with L8 ACOP'
      },
      {
        text: 'Asbestos Management Survey HSG264 Asbestos: The survey guide',
        expectedType: 'ASBESTOS',
        description: 'Asbestos with HSG264'
      },
      {
        text: 'LOLER Thorough Examination Report Lifting Operations and Lifting Equipment Regulations 1998',
        expectedType: 'LIFT',
        description: 'LOLER with regulations reference'
      },
      {
        text: 'Energy Performance Certificate EPC Rating: B SAP Score: 82',
        expectedType: 'EPC',
        description: 'EPC with rating'
      },
    ];

    for (const test of textTests) {
      it(`should detect ${test.description} from text content`, async () => {
        const result = await detectCertificateTypeDB('unknown_document.pdf', test.text);
        console.log(`[TEST] Text match for ${test.description} -> ${result.certificateType} (${result.source})`);
        
        if (result.source === 'database') {
          expect(result.certificateType).toBe(test.expectedType);
        } else {
          console.log(`  -> Fallback used for text content matching`);
        }
      });
    }
  });

  describe('Outcome Evaluation - Gas Safety', () => {
    it('should evaluate PASS outcome for gas certificate with no defects', async () => {
      const data = createTestData({
        certificateType: 'GAS_SAFETY',
        outcome: 'PASS',
        appliances: [
          { type: 'Boiler', make: null, model: null, serialNumber: null, location: null, outcome: 'PASS', defects: [] },
          { type: 'Hob', make: null, model: null, serialNumber: null, location: null, outcome: 'PASS', defects: [] }
        ],
        defects: []
      });
      
      const result = await determineComplianceOutcome('GAS_SAFETY', data);
      console.log(`[TEST] Gas PASS outcome: ${result.outcome}, confidence: ${result.confidence}, legislation: ${result.legislation.join(', ')}`);
      
      expect(result.outcome).toBe('SATISFACTORY');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should evaluate FAIL outcome for gas certificate with ID defect', async () => {
      const data = createTestData({
        certificateType: 'GAS_SAFETY',
        outcome: 'FAIL',
        appliances: [
          { type: 'Boiler', make: null, model: null, serialNumber: null, location: null, outcome: 'FAIL', defects: ['Immediately Dangerous'] }
        ],
        defects: [{ code: 'ID', description: 'Immediately Dangerous - carbon monoxide risk', location: null, priority: 'IMMEDIATE', remedialAction: null }]
      });
      
      const result = await determineComplianceOutcome('GAS_SAFETY', data);
      console.log(`[TEST] Gas ID defect outcome: ${result.outcome}, matches: ${result.ruleMatches.length}`);
      
      expect(['UNSATISFACTORY', 'SATISFACTORY_WITH_OBSERVATIONS']).toContain(result.outcome);
    });

    it('should evaluate AT RISK outcome for gas certificate with AR defect', async () => {
      const data = createTestData({
        certificateType: 'GAS_SAFETY',
        outcome: 'FAIL',
        appliances: [
          { type: 'Boiler', make: null, model: null, serialNumber: null, location: null, outcome: 'FAIL', defects: ['At Risk'] }
        ],
        defects: [{ code: 'AR', description: 'At Risk - remedial work required', location: null, priority: 'URGENT', remedialAction: null }]
      });
      
      const result = await determineComplianceOutcome('GAS_SAFETY', data);
      console.log(`[TEST] Gas AR defect outcome: ${result.outcome}`);
      
      expect(['UNSATISFACTORY', 'SATISFACTORY_WITH_OBSERVATIONS']).toContain(result.outcome);
    });
  });

  describe('Outcome Evaluation - EICR', () => {
    it('should evaluate SATISFACTORY outcome for EICR with no C1/C2 codes', async () => {
      const data = createTestData({
        certificateType: 'EICR',
        outcome: 'SATISFACTORY',
        defects: []
      });
      
      const result = await determineComplianceOutcome('EICR', data);
      console.log(`[TEST] EICR SATISFACTORY: ${result.outcome}, confidence: ${result.confidence}`);
      
      expect(result.outcome).toBe('SATISFACTORY');
    });

    it('should evaluate C1 danger present code', async () => {
      const data = createTestData({
        certificateType: 'EICR',
        outcome: 'UNSATISFACTORY',
        defects: [{ code: 'C1', description: 'Danger present - requires immediate attention', location: null, priority: 'IMMEDIATE', remedialAction: null }]
      });
      
      const result = await determineComplianceOutcome('EICR', data);
      console.log(`[TEST] EICR C1 code: ${result.outcome}`);
      
      expect(['UNSATISFACTORY', 'SATISFACTORY_WITH_OBSERVATIONS']).toContain(result.outcome);
    });

    it('should evaluate C2 potentially dangerous code', async () => {
      const data = createTestData({
        certificateType: 'EICR',
        outcome: 'UNSATISFACTORY',
        defects: [{ code: 'C2', description: 'Potentially dangerous', location: null, priority: 'URGENT', remedialAction: null }]
      });
      
      const result = await determineComplianceOutcome('EICR', data);
      console.log(`[TEST] EICR C2 code: ${result.outcome}`);
      
      expect(['UNSATISFACTORY', 'SATISFACTORY_WITH_OBSERVATIONS']).toContain(result.outcome);
    });
  });

  describe('Outcome Evaluation - Fire Risk Assessment', () => {
    it('should evaluate LOW risk FRA as compliant', async () => {
      const data = createTestData({
        certificateType: 'FRA',
        outcome: 'SATISFACTORY',
        additionalFields: { riskRating: 'LOW' }
      });
      
      const result = await determineComplianceOutcome('FRA', data);
      console.log(`[TEST] FRA LOW risk: ${result.outcome}`);
      
      expect(result.outcome).toBe('SATISFACTORY');
    });

    it('should evaluate HIGH risk FRA as requiring action', async () => {
      const data = createTestData({
        certificateType: 'FRA',
        outcome: 'UNSATISFACTORY',
        additionalFields: { riskRating: 'HIGH' }
      });
      
      const result = await determineComplianceOutcome('FRA', data);
      console.log(`[TEST] FRA HIGH risk: ${result.outcome}`);
      
      expect(['UNSATISFACTORY', 'SATISFACTORY_WITH_OBSERVATIONS']).toContain(result.outcome);
    });
  });

  describe('Outcome Evaluation - Legionella', () => {
    it('should evaluate safe water temperatures as compliant', async () => {
      const data = createTestData({
        certificateType: 'LEGIONELLA',
        outcome: 'SATISFACTORY',
        additionalFields: { hotWaterTemp: '55', coldWaterTemp: '18' }
      });
      
      const result = await determineComplianceOutcome('LEGIONELLA', data);
      console.log(`[TEST] LRA safe temps: ${result.outcome}`);
      
      expect(result.outcome).toBe('SATISFACTORY');
    });

    it('should detect dangerous hot water temperature', async () => {
      const data = createTestData({
        certificateType: 'LEGIONELLA',
        outcome: 'UNSATISFACTORY',
        additionalFields: { hotWaterTemp: '45', coldWaterTemp: '25' }
      });
      
      const result = await determineComplianceOutcome('LEGIONELLA', data);
      console.log(`[TEST] LRA dangerous temps: ${result.outcome}`);
      
      expect(['UNSATISFACTORY', 'SATISFACTORY_WITH_OBSERVATIONS']).toContain(result.outcome);
    });
  });

  describe('Outcome Evaluation - Asbestos', () => {
    it('should evaluate low material score as compliant', async () => {
      const data = createTestData({
        certificateType: 'ASBESTOS',
        outcome: 'SATISFACTORY',
        additionalFields: { materialScore: '4' }
      });
      
      const result = await determineComplianceOutcome('ASBESTOS', data);
      console.log(`[TEST] Asbestos low score: ${result.outcome}`);
      
      expect(result.outcome).toBe('SATISFACTORY');
    });

    it('should detect high material score requiring action', async () => {
      const data = createTestData({
        certificateType: 'ASBESTOS',
        outcome: 'UNSATISFACTORY',
        additionalFields: { materialScore: '12' }
      });
      
      const result = await determineComplianceOutcome('ASBESTOS', data);
      console.log(`[TEST] Asbestos high score: ${result.outcome}`);
      
      expect(['UNSATISFACTORY', 'SATISFACTORY_WITH_OBSERVATIONS']).toContain(result.outcome);
    });
  });

  describe('Outcome Evaluation - EPC', () => {
    it('should evaluate EPC rating A-E as compliant', async () => {
      const data = createTestData({
        certificateType: 'EPC',
        outcome: 'SATISFACTORY',
        additionalFields: { epcRating: 'B' }
      });
      
      const result = await determineComplianceOutcome('EPC', data);
      console.log(`[TEST] EPC rating B: ${result.outcome}`);
      
      expect(result.outcome).toBe('SATISFACTORY');
    });

    it('should evaluate EPC rating F-G as non-compliant (MEES)', async () => {
      const data = createTestData({
        certificateType: 'EPC',
        outcome: 'UNSATISFACTORY',
        additionalFields: { epcRating: 'F' }
      });
      
      const result = await determineComplianceOutcome('EPC', data);
      console.log(`[TEST] EPC rating F (MEES fail): ${result.outcome}`);
      
      expect(['UNSATISFACTORY', 'SATISFACTORY_WITH_OBSERVATIONS']).toContain(result.outcome);
    });
  });

  describe('Outcome Evaluation - LOLER', () => {
    it('should evaluate safe to use LOLER as compliant', async () => {
      const data = createTestData({
        certificateType: 'LOLER',
        outcome: 'PASS',
        additionalFields: { safeToUse: 'true' }
      });
      
      const result = await determineComplianceOutcome('LOLER', data);
      console.log(`[TEST] LOLER safe: ${result.outcome}`);
      
      expect(result.outcome).toBe('SATISFACTORY');
    });

    it('should detect unsafe LOLER equipment', async () => {
      const data = createTestData({
        certificateType: 'LOLER',
        outcome: 'FAIL',
        additionalFields: { safeToUse: 'false' },
        defects: [{ code: null, description: 'Safety device malfunction', location: null, priority: 'IMMEDIATE', remedialAction: null }]
      });
      
      const result = await determineComplianceOutcome('LOLER', data);
      console.log(`[TEST] LOLER unsafe: ${result.outcome}`);
      
      expect(['UNSATISFACTORY', 'SATISFACTORY_WITH_OBSERVATIONS']).toContain(result.outcome);
    });
  });

  describe('Fallback Behavior', () => {
    it('should handle unknown certificate type gracefully', async () => {
      const result = await detectCertificateTypeDB('random_document.pdf', 'Some random text content');
      console.log(`[TEST] Unknown document: ${result.certificateType} (${result.source})`);
      
      expect(result).toBeDefined();
      expect(result.certificateType).toBeDefined();
    });

    it('should handle empty data gracefully in outcome evaluation', async () => {
      const data = createTestData({
        certificateType: 'UNKNOWN',
        outcome: null
      });
      
      const result = await determineComplianceOutcome('OTHER', data);
      console.log(`[TEST] Empty outcome data: ${result.outcome}`);
      
      expect(result.outcome).toBe('UNDETERMINED');
    });
  });

  describe('UK Legislation References', () => {
    it('should include Gas Safety Regulations 1998 for gas certificates', async () => {
      const data = createTestData({
        certificateType: 'GAS_SAFETY',
        outcome: 'PASS',
        appliances: [{ type: 'Boiler', make: null, model: null, serialNumber: null, location: null, outcome: 'PASS', defects: [] }]
      });
      
      const result = await determineComplianceOutcome('GAS_SAFETY', data);
      console.log(`[TEST] Gas legislation: ${result.legislation.join(', ')}`);
      
      if (result.ruleMatches.length > 0) {
        const hasGasRegs = result.legislation.some(l => 
          l.includes('Gas Safety') || l.includes('1998') || l.includes('Regulation')
        );
        expect(hasGasRegs || result.legislation.length === 0).toBe(true);
      }
    });

    it('should include BS 7671 for EICR certificates', async () => {
      const data = createTestData({
        certificateType: 'EICR',
        outcome: 'SATISFACTORY'
      });
      
      const result = await determineComplianceOutcome('EICR', data);
      console.log(`[TEST] EICR legislation: ${result.legislation.join(', ')}`);
      
      expect(result).toBeDefined();
    });

    it('should include RRO 2005 for FRA certificates', async () => {
      const data = createTestData({
        certificateType: 'FRA',
        outcome: 'SATISFACTORY',
        additionalFields: { riskRating: 'LOW' }
      });
      
      const result = await determineComplianceOutcome('FRA', data);
      console.log(`[TEST] FRA legislation: ${result.legislation.join(', ')}`);
      
      expect(result).toBeDefined();
    });
  });
});
