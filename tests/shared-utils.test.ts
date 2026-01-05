import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AWAABS_LAW_PHASES,
  getPhaseByStatus,
  getPhaseById,
  getCertificateTypesForPhase,
  getClassificationCodesForPhase,
  getAllActivePhaseFilters,
  getPhaseStatusLabel,
  getPhaseStatusBadgeVariant,
  type AwaabsLawPhase,
} from '../shared/awaabs-law';
import {
  getStreamCodeForCertType,
  detectCertTypeFromFilename,
  toDbCertificateType,
  normalizeCertificateTypeCode,
  type CertificateTypeCode,
} from '../shared/certificate-type-mapping';
import {
  APP_VERSION,
  APP_NAME,
  getVersionInfo,
  RELEASE_NOTES,
} from '../shared/version';

describe('Awaabs Law Utilities', () => {
  describe('AWAABS_LAW_PHASES constant', () => {
    it('should have 3 phases', () => {
      expect(AWAABS_LAW_PHASES).toHaveLength(3);
    });

    it('should have phase1, phase2, and phase3', () => {
      const phaseIds = AWAABS_LAW_PHASES.map(p => p.id);
      expect(phaseIds).toContain('phase1');
      expect(phaseIds).toContain('phase2');
      expect(phaseIds).toContain('phase3');
    });

    it('phase1 should be active and about damp & mould', () => {
      const phase1 = AWAABS_LAW_PHASES.find(p => p.id === 'phase1');
      expect(phase1?.status).toBe('active');
      expect(phase1?.description).toContain('Damp');
    });

    it('phase2 should be preview status', () => {
      const phase2 = AWAABS_LAW_PHASES.find(p => p.id === 'phase2');
      expect(phase2?.status).toBe('preview');
    });

    it('phase3 should be future status', () => {
      const phase3 = AWAABS_LAW_PHASES.find(p => p.id === 'phase3');
      expect(phase3?.status).toBe('future');
    });
  });

  describe('getPhaseByStatus', () => {
    it('should return active phases', () => {
      const activePhases = getPhaseByStatus('active');
      expect(activePhases.length).toBeGreaterThan(0);
      activePhases.forEach(p => expect(p.status).toBe('active'));
    });

    it('should return preview phases', () => {
      const previewPhases = getPhaseByStatus('preview');
      expect(previewPhases.length).toBeGreaterThan(0);
      previewPhases.forEach(p => expect(p.status).toBe('preview'));
    });

    it('should return future phases', () => {
      const futurePhases = getPhaseByStatus('future');
      expect(futurePhases.length).toBeGreaterThan(0);
      futurePhases.forEach(p => expect(p.status).toBe('future'));
    });
  });

  describe('getPhaseById', () => {
    it('should return phase1 correctly', () => {
      const phase = getPhaseById('phase1');
      expect(phase).toBeDefined();
      expect(phase?.id).toBe('phase1');
      expect(phase?.name).toBe('Phase 1');
    });

    it('should return phase2 correctly', () => {
      const phase = getPhaseById('phase2');
      expect(phase).toBeDefined();
      expect(phase?.id).toBe('phase2');
    });

    it('should return phase3 correctly', () => {
      const phase = getPhaseById('phase3');
      expect(phase).toBeDefined();
      expect(phase?.id).toBe('phase3');
    });

    it('should return undefined for invalid phase', () => {
      const phase = getPhaseById('phase4' as AwaabsLawPhase);
      expect(phase).toBeUndefined();
    });
  });

  describe('getCertificateTypesForPhase', () => {
    it('should return certificate types for phase1', () => {
      const types = getCertificateTypesForPhase('phase1');
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain('DAMP_MOULD_SURVEY');
    });

    it('should return certificate types for phase2', () => {
      const types = getCertificateTypesForPhase('phase2');
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain('EICR');
    });

    it('should return certificate types for phase3', () => {
      const types = getCertificateTypesForPhase('phase3');
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain('GAS_SAFETY');
    });

    it('should return empty array for invalid phase', () => {
      const types = getCertificateTypesForPhase('invalid' as AwaabsLawPhase);
      expect(types).toEqual([]);
    });
  });

  describe('getClassificationCodesForPhase', () => {
    it('should return classification codes for phase1', () => {
      const codes = getClassificationCodesForPhase('phase1');
      expect(codes.length).toBeGreaterThan(0);
      expect(codes).toContain('DAMP_MODERATE');
    });

    it('should return classification codes for phase2', () => {
      const codes = getClassificationCodesForPhase('phase2');
      expect(codes.length).toBeGreaterThan(0);
      expect(codes).toContain('C1');
    });

    it('should return empty array for invalid phase', () => {
      const codes = getClassificationCodesForPhase('invalid' as AwaabsLawPhase);
      expect(codes).toEqual([]);
    });
  });

  describe('getAllActivePhaseFilters', () => {
    it('should return certificate types from active phases', () => {
      const filters = getAllActivePhaseFilters();
      expect(filters.certificateTypes.length).toBeGreaterThan(0);
    });

    it('should return classification codes from active phases', () => {
      const filters = getAllActivePhaseFilters();
      expect(filters.classificationCodes.length).toBeGreaterThan(0);
    });

    it('should only include active phase data', () => {
      const filters = getAllActivePhaseFilters();
      expect(filters.certificateTypes).toContain('DAMP_MOULD_SURVEY');
      expect(filters.certificateTypes).not.toContain('EICR');
    });
  });

  describe('getPhaseStatusLabel', () => {
    it('should return "Active" for active status', () => {
      expect(getPhaseStatusLabel('active')).toBe('Active');
    });

    it('should return "Preview (2026)" for preview status', () => {
      expect(getPhaseStatusLabel('preview')).toBe('Preview (2026)');
    });

    it('should return "Future (2027)" for future status', () => {
      expect(getPhaseStatusLabel('future')).toBe('Future (2027)');
    });
  });

  describe('getPhaseStatusBadgeVariant', () => {
    it('should return "default" for active status', () => {
      expect(getPhaseStatusBadgeVariant('active')).toBe('default');
    });

    it('should return "secondary" for preview status', () => {
      expect(getPhaseStatusBadgeVariant('preview')).toBe('secondary');
    });

    it('should return "outline" for future status', () => {
      expect(getPhaseStatusBadgeVariant('future')).toBe('outline');
    });
  });
});

describe('Certificate Type Mapping Utilities', () => {
  describe('getStreamCodeForCertType', () => {
    it('should map GAS to GAS_HEATING', () => {
      expect(getStreamCodeForCertType('GAS')).toBe('GAS_HEATING');
    });

    it('should map EICR to ELECTRICAL', () => {
      expect(getStreamCodeForCertType('EICR')).toBe('ELECTRICAL');
    });

    it('should map EPC to ENERGY', () => {
      expect(getStreamCodeForCertType('EPC')).toBe('ENERGY');
    });

    it('should map FRA to FIRE_SAFETY', () => {
      expect(getStreamCodeForCertType('FRA')).toBe('FIRE_SAFETY');
    });

    it('should map LEG_RA to WATER_SAFETY', () => {
      expect(getStreamCodeForCertType('LEG_RA')).toBe('WATER_SAFETY');
    });

    it('should map ASB_SURVEY to ASBESTOS', () => {
      expect(getStreamCodeForCertType('ASB_SURVEY')).toBe('ASBESTOS');
    });

    it('should map LOLER to LIFTING', () => {
      expect(getStreamCodeForCertType('LOLER')).toBe('LIFTING');
    });

    it('should map PLAY to EXTERNAL', () => {
      expect(getStreamCodeForCertType('PLAY')).toBe('EXTERNAL');
    });

    it('should map CCTV to SECURITY', () => {
      expect(getStreamCodeForCertType('CCTV')).toBe('SECURITY');
    });

    it('should map EWS1 to HRB_SPECIFIC', () => {
      expect(getStreamCodeForCertType('EWS1')).toBe('HRB_SPECIFIC');
    });

    it('should return OTHER for unknown types', () => {
      expect(getStreamCodeForCertType('UNKNOWN' as CertificateTypeCode)).toBe('OTHER');
    });

    it('should handle heating system types', () => {
      expect(getStreamCodeForCertType('OIL')).toBe('GAS_HEATING');
      expect(getStreamCodeForCertType('LPG')).toBe('GAS_HEATING');
      expect(getStreamCodeForCertType('ASHP')).toBe('GAS_HEATING');
      expect(getStreamCodeForCertType('GSHP')).toBe('GAS_HEATING');
    });

    it('should handle electrical types', () => {
      expect(getStreamCodeForCertType('PAT')).toBe('ELECTRICAL');
      expect(getStreamCodeForCertType('EMLT')).toBe('ELECTRICAL');
      expect(getStreamCodeForCertType('MEIWC')).toBe('ELECTRICAL');
    });
  });

  describe('detectCertTypeFromFilename', () => {
    it('should detect GAS_SAFETY from LGSR filename', () => {
      expect(detectCertTypeFromFilename('LGSR_123.pdf')).toBe('GAS_SAFETY');
    });

    it('should detect GAS_SAFETY from CP12 filename', () => {
      expect(detectCertTypeFromFilename('CP12_cert.pdf')).toBe('GAS_SAFETY');
    });

    it('should detect GAS_SAFETY from gas-safety filename', () => {
      expect(detectCertTypeFromFilename('gas-safety-2024.pdf')).toBe('GAS_SAFETY');
    });

    it('should detect GAS_SAFETY from GAS_SAFETY filename', () => {
      expect(detectCertTypeFromFilename('GAS_SAFETY_RECORD.pdf')).toBe('GAS_SAFETY');
    });

    it('should detect EICR from EICR filename', () => {
      expect(detectCertTypeFromFilename('EICR_Report.pdf')).toBe('EICR');
    });

    it('should detect EICR from electrical filename', () => {
      expect(detectCertTypeFromFilename('electrical_inspection.pdf')).toBe('EICR');
    });

    it('should detect EPC from EPC filename', () => {
      expect(detectCertTypeFromFilename('EPC_Certificate.pdf')).toBe('EPC');
    });

    it('should detect EPC from energy filename', () => {
      expect(detectCertTypeFromFilename('energy_performance.pdf')).toBe('EPC');
    });

    it('should detect FIRE_RISK_ASSESSMENT from FRA filename', () => {
      expect(detectCertTypeFromFilename('FRA_2024.pdf')).toBe('FIRE_RISK_ASSESSMENT');
    });

    it('should detect FIRE_RISK_ASSESSMENT from fire-risk filename', () => {
      expect(detectCertTypeFromFilename('fire-risk-assessment.pdf')).toBe('FIRE_RISK_ASSESSMENT');
    });

    it('should detect EICR from PAT filename', () => {
      expect(detectCertTypeFromFilename('PAT_testing.pdf')).toBe('EICR');
    });

    it('should detect LEGIONELLA_ASSESSMENT from legionella filename', () => {
      expect(detectCertTypeFromFilename('legionella_risk.pdf')).toBe('LEGIONELLA_ASSESSMENT');
    });

    it('should detect LEGIONELLA_ASSESSMENT from water filename', () => {
      expect(detectCertTypeFromFilename('water_safety.pdf')).toBe('LEGIONELLA_ASSESSMENT');
    });

    it('should detect ASBESTOS_SURVEY from asbestos filename', () => {
      expect(detectCertTypeFromFilename('asbestos_survey.pdf')).toBe('ASBESTOS_SURVEY');
    });

    it('should detect LIFT_LOLER from LOLER filename', () => {
      expect(detectCertTypeFromFilename('LOLER_inspection.pdf')).toBe('LIFT_LOLER');
    });

    it('should detect LIFT_LOLER from lift filename', () => {
      expect(detectCertTypeFromFilename('lift_certificate.pdf')).toBe('LIFT_LOLER');
    });

    it('should return null for unknown filename', () => {
      expect(detectCertTypeFromFilename('random_document.pdf')).toBeNull();
    });

    it('should be case insensitive', () => {
      expect(detectCertTypeFromFilename('lgsr_123.PDF')).toBe('GAS_SAFETY');
      expect(detectCertTypeFromFilename('Eicr_Report.pdf')).toBe('EICR');
    });
  });

  describe('toDbCertificateType', () => {
    it('should map GAS to GAS_SAFETY', () => {
      expect(toDbCertificateType('GAS')).toBe('GAS_SAFETY');
    });

    it('should map GAS_SVC to GAS_SAFETY', () => {
      expect(toDbCertificateType('GAS_SVC')).toBe('GAS_SAFETY');
    });

    it('should map FRA to FIRE_RISK_ASSESSMENT', () => {
      expect(toDbCertificateType('FRA')).toBe('FIRE_RISK_ASSESSMENT');
    });

    it('should map FRAEW to FIRE_RISK_ASSESSMENT', () => {
      expect(toDbCertificateType('FRAEW')).toBe('FIRE_RISK_ASSESSMENT');
    });

    it('should map FIRE_RISK to FIRE_RISK_ASSESSMENT', () => {
      expect(toDbCertificateType('FIRE_RISK')).toBe('FIRE_RISK_ASSESSMENT');
    });

    it('should map LEG_RA to LEGIONELLA_ASSESSMENT', () => {
      expect(toDbCertificateType('LEG_RA')).toBe('LEGIONELLA_ASSESSMENT');
    });

    it('should map LEG_MONITOR to LEGIONELLA_ASSESSMENT', () => {
      expect(toDbCertificateType('LEG_MONITOR')).toBe('LEGIONELLA_ASSESSMENT');
    });

    it('should map ASB_SURVEY to ASBESTOS_SURVEY', () => {
      expect(toDbCertificateType('ASB_SURVEY')).toBe('ASBESTOS_SURVEY');
    });

    it('should map ASBESTOS to ASBESTOS_SURVEY', () => {
      expect(toDbCertificateType('ASBESTOS')).toBe('ASBESTOS_SURVEY');
    });

    it('should map LOLER to LIFT_LOLER', () => {
      expect(toDbCertificateType('LOLER')).toBe('LIFT_LOLER');
    });

    it('should map LIFT to LIFT_LOLER', () => {
      expect(toDbCertificateType('LIFT')).toBe('LIFT_LOLER');
    });

    it('should pass through EICR unchanged', () => {
      expect(toDbCertificateType('EICR')).toBe('EICR');
    });

    it('should pass through EPC unchanged', () => {
      expect(toDbCertificateType('EPC')).toBe('EPC');
    });

    it('should return OTHER for unknown types', () => {
      expect(toDbCertificateType('UNKNOWN' as CertificateTypeCode)).toBe('OTHER');
    });
  });

  describe('normalizeCertificateTypeCode', () => {
    it('should return UNKNOWN for null', () => {
      expect(normalizeCertificateTypeCode(null)).toBe('UNKNOWN');
    });

    it('should return UNKNOWN for undefined', () => {
      expect(normalizeCertificateTypeCode(undefined)).toBe('UNKNOWN');
    });

    it('should return UNKNOWN for empty string', () => {
      expect(normalizeCertificateTypeCode('')).toBe('UNKNOWN');
    });

    it('should normalize GAS_SAFETY to GAS', () => {
      expect(normalizeCertificateTypeCode('GAS_SAFETY')).toBe('GAS');
    });

    it('should normalize LGSR to GAS', () => {
      expect(normalizeCertificateTypeCode('LGSR')).toBe('GAS');
    });

    it('should normalize CP12 to GAS', () => {
      expect(normalizeCertificateTypeCode('CP12')).toBe('GAS');
    });

    it('should normalize "Gas Safety" to GAS', () => {
      expect(normalizeCertificateTypeCode('Gas Safety')).toBe('GAS');
    });

    it('should normalize gas service variants', () => {
      expect(normalizeCertificateTypeCode('GAS_SVC')).toBe('GAS_SVC');
      expect(normalizeCertificateTypeCode('Gas Service')).toBe('GAS_SVC');
    });

    it('should normalize ELECTRICAL to EICR', () => {
      expect(normalizeCertificateTypeCode('ELECTRICAL')).toBe('EICR');
      expect(normalizeCertificateTypeCode('Electrical Installation')).toBe('EICR');
    });

    it('should normalize PAT variants', () => {
      expect(normalizeCertificateTypeCode('PAT')).toBe('PAT');
      expect(normalizeCertificateTypeCode('Portable Appliance')).toBe('PAT');
    });

    it('should normalize emergency lighting', () => {
      expect(normalizeCertificateTypeCode('EMLT')).toBe('EMLT');
      expect(normalizeCertificateTypeCode('Emergency Light')).toBe('EMLT');
    });

    it('should normalize EPC variants', () => {
      expect(normalizeCertificateTypeCode('EPC')).toBe('EPC');
      expect(normalizeCertificateTypeCode('ENERGY')).toBe('EPC');
      expect(normalizeCertificateTypeCode('Energy Performance')).toBe('EPC');
    });

    it('should normalize fire risk assessment variants', () => {
      expect(normalizeCertificateTypeCode('FRA')).toBe('FRA');
      expect(normalizeCertificateTypeCode('FIRE_RISK_ASSESSMENT')).toBe('FRA');
      expect(normalizeCertificateTypeCode('Fire Risk')).toBe('FRA');
    });

    it('should normalize fire safety types', () => {
      expect(normalizeCertificateTypeCode('FIRE_ALARM')).toBe('FIRE_ALARM');
      expect(normalizeCertificateTypeCode('Fire Alarm')).toBe('FIRE_ALARM');
      expect(normalizeCertificateTypeCode('FIRE_EXT')).toBe('FIRE_EXT');
      expect(normalizeCertificateTypeCode('Fire Extinguisher')).toBe('FIRE_EXT');
      expect(normalizeCertificateTypeCode('FIRE_DOOR')).toBe('FIRE_DOOR');
      expect(normalizeCertificateTypeCode('Fire Door')).toBe('FIRE_DOOR');
    });

    it('should normalize smoke and CO detectors', () => {
      expect(normalizeCertificateTypeCode('SMOKE_CO')).toBe('SMOKE_CO');
      expect(normalizeCertificateTypeCode('Smoke')).toBe('SMOKE_CO');
      expect(normalizeCertificateTypeCode('Carbon Monoxide Detector')).toBe('SMOKE_CO');
    });

    it('should normalize legionella variants', () => {
      expect(normalizeCertificateTypeCode('LEGIONELLA_ASSESSMENT')).toBe('LEG_RA');
      expect(normalizeCertificateTypeCode('LEGIONELLA')).toBe('LEG_RA');
      expect(normalizeCertificateTypeCode('LEG_RA')).toBe('LEG_RA');
    });

    it('should normalize asbestos variants', () => {
      expect(normalizeCertificateTypeCode('ASBESTOS_SURVEY')).toBe('ASB_SURVEY');
      expect(normalizeCertificateTypeCode('ASBESTOS')).toBe('ASB_SURVEY');
      expect(normalizeCertificateTypeCode('ASB_SURVEY')).toBe('ASB_SURVEY');
    });

    it('should normalize lifting equipment', () => {
      expect(normalizeCertificateTypeCode('LIFT_LOLER')).toBe('LOLER');
      expect(normalizeCertificateTypeCode('LOLER')).toBe('LOLER');
      expect(normalizeCertificateTypeCode('LIFT')).toBe('LIFT');
      expect(normalizeCertificateTypeCode('Passenger Lift')).toBe('LIFT');
      expect(normalizeCertificateTypeCode('STAIR_LIFT')).toBe('STAIR_LIFT');
      expect(normalizeCertificateTypeCode('Stair Lift')).toBe('STAIR_LIFT');
    });

    it('should normalize external area types', () => {
      expect(normalizeCertificateTypeCode('PLAY')).toBe('PLAY');
      expect(normalizeCertificateTypeCode('Play Area')).toBe('PLAY');
      expect(normalizeCertificateTypeCode('GYM')).toBe('GYM');
      expect(normalizeCertificateTypeCode('TREE')).toBe('TREE');
      expect(normalizeCertificateTypeCode('FENCE')).toBe('FENCE');
    });

    it('should normalize security types', () => {
      expect(normalizeCertificateTypeCode('CCTV')).toBe('CCTV');
      expect(normalizeCertificateTypeCode('ACCESS_CTRL')).toBe('ACCESS_CTRL');
      expect(normalizeCertificateTypeCode('Access Control')).toBe('ACCESS_CTRL');
    });

    it('should normalize building safety types', () => {
      expect(normalizeCertificateTypeCode('FORM_A')).toBe('FORM_A');
      expect(normalizeCertificateTypeCode('Form A')).toBe('FORM_A');
      expect(normalizeCertificateTypeCode('FORM_B')).toBe('FORM_B');
      expect(normalizeCertificateTypeCode('Form B')).toBe('FORM_B');
      expect(normalizeCertificateTypeCode('EWS1')).toBe('EWS1');
      expect(normalizeCertificateTypeCode('BSR_REG')).toBe('BSR_REG');
      expect(normalizeCertificateTypeCode('Building Safety')).toBe('BSR_REG');
    });

    it('should normalize HHSRS types', () => {
      expect(normalizeCertificateTypeCode('HHSRS')).toBe('HHSRS');
      expect(normalizeCertificateTypeCode('DS')).toBe('DS');
      expect(normalizeCertificateTypeCode('Damp')).toBe('DS');
    });

    it('should normalize accessibility types', () => {
      expect(normalizeCertificateTypeCode('MOBILITY')).toBe('MOBILITY');
      expect(normalizeCertificateTypeCode('SENSORY')).toBe('SENSORY');
      expect(normalizeCertificateTypeCode('GRAB')).toBe('GRAB');
    });

    it('should normalize pest control types', () => {
      expect(normalizeCertificateTypeCode('PEST')).toBe('PEST');
      expect(normalizeCertificateTypeCode('BIRDNET')).toBe('BIRDNET');
    });

    it('should normalize waste types', () => {
      expect(normalizeCertificateTypeCode('WASTE')).toBe('WASTE');
      expect(normalizeCertificateTypeCode('BULKY')).toBe('BULKY');
      expect(normalizeCertificateTypeCode('RECYCLING')).toBe('RECYCLING');
    });

    it('should normalize communal area types', () => {
      expect(normalizeCertificateTypeCode('COMMUNAL')).toBe('COMMUNAL');
      expect(normalizeCertificateTypeCode('SIGNAGE')).toBe('SIGNAGE');
      expect(normalizeCertificateTypeCode('ESC_ROUTE')).toBe('ESC_ROUTE');
      expect(normalizeCertificateTypeCode('Escape Route')).toBe('ESC_ROUTE');
      expect(normalizeCertificateTypeCode('BALCONY')).toBe('BALCONY');
      expect(normalizeCertificateTypeCode('ROOF_ACCESS')).toBe('ROOF_ACCESS');
    });

    it('should handle case insensitivity', () => {
      expect(normalizeCertificateTypeCode('gas_safety')).toBe('GAS');
      expect(normalizeCertificateTypeCode('Eicr')).toBe('EICR');
      expect(normalizeCertificateTypeCode('epc')).toBe('EPC');
    });

    it('should handle whitespace', () => {
      expect(normalizeCertificateTypeCode('  GAS_SAFETY  ')).toBe('GAS');
      expect(normalizeCertificateTypeCode('\tEICR\n')).toBe('EICR');
    });

    it('should return OTHER for recognized OTHER', () => {
      expect(normalizeCertificateTypeCode('OTHER')).toBe('OTHER');
    });

    it('should return UNKNOWN for unrecognized types', () => {
      expect(normalizeCertificateTypeCode('RANDOM_TYPE')).toBe('UNKNOWN');
      expect(normalizeCertificateTypeCode('xyz123')).toBe('UNKNOWN');
    });
  });
});

describe('Version Utilities', () => {
  describe('APP_VERSION constant', () => {
    it('should be a valid semver string', () => {
      expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('APP_NAME constant', () => {
    it('should be SocialComply', () => {
      expect(APP_NAME).toBe('SocialComply');
    });
  });

  describe('getVersionInfo', () => {
    it('should return version info object', () => {
      const info = getVersionInfo();
      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('environment');
      expect(info).toHaveProperty('buildTime');
    });

    it('should include correct version', () => {
      const info = getVersionInfo();
      expect(info.version).toBe(APP_VERSION);
    });

    it('should include correct name', () => {
      const info = getVersionInfo();
      expect(info.name).toBe(APP_NAME);
    });

    it('should include environment', () => {
      const info = getVersionInfo();
      expect(['development', 'production', 'test']).toContain(info.environment);
    });

    it('should include ISO formatted build time', () => {
      const info = getVersionInfo();
      expect(info.buildTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('RELEASE_NOTES constant', () => {
    it('should have release notes for current version', () => {
      expect(RELEASE_NOTES[APP_VERSION]).toBeDefined();
    });

    it('should have date in each release', () => {
      Object.values(RELEASE_NOTES).forEach(release => {
        expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('should have highlights array in each release', () => {
      Object.values(RELEASE_NOTES).forEach(release => {
        expect(Array.isArray(release.highlights)).toBe(true);
      });
    });

    it('should have features array in each release', () => {
      Object.values(RELEASE_NOTES).forEach(release => {
        expect(Array.isArray(release.features)).toBe(true);
      });
    });

    it('should have fixes array in each release', () => {
      Object.values(RELEASE_NOTES).forEach(release => {
        expect(Array.isArray(release.fixes)).toBe(true);
      });
    });

    it('should have multiple versions documented', () => {
      expect(Object.keys(RELEASE_NOTES).length).toBeGreaterThan(1);
    });
  });
});
