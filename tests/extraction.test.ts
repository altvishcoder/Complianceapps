import { describe, it, expect } from 'vitest';
import { generateRemedialActions, generateRemedialActionsFromConfig, determineOutcome, normalizeExtractionOutput } from '../server/extraction';

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
});
