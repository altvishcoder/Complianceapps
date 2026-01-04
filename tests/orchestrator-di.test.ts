import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractCertificateWithDI } from '../server/services/extraction/orchestrator-di';
import { 
  createTestDependencies, 
  setDependencies, 
  resetDependencies,
  type ExtractionDependencies,
  type ExtractionSettings,
  type AIExtractionResult,
  DEFAULT_DOCUMENT_THRESHOLDS,
} from '../server/services/extraction/dependencies';
import type { FormatAnalysis } from '../server/services/extraction/format-detector';
import type { TemplateExtractionResult } from '../server/services/extraction/template-patterns';

describe('extractCertificateWithDI', () => {
  const testBuffer = Buffer.from('test document content');
  const testCertificateId = 'test-cert-123';

  beforeEach(() => {
    resetDependencies();
  });

  afterEach(() => {
    resetDependencies();
  });

  describe('Tier 0 - Format Detection', () => {
    it('should always run format detection first', async () => {
      let analyseDocumentCalled = false;
      
      const deps = createTestDependencies({
        analyseDocument: async () => {
          analyseDocumentCalled = true;
          return {
            format: 'pdf-native' as const,
            classification: 'structured_certificate' as const,
            pageCount: 1,
            hasTextLayer: true,
            isScanned: false,
            isHybrid: false,
            textQuality: 0.9,
            avgCharsPerPage: 2000,
            textContent: 'Test content',
            detectedCertificateType: 'GAS' as const,
          };
        },
        extractWithTemplate: () => ({
          success: true,
          data: {
            certificateType: 'GAS' as const,
            certificateNumber: 'CERT-001',
            propertyAddress: '123 Test St',
            uprn: null,
            inspectionDate: '2024-01-15',
            expiryDate: '2025-01-15',
            nextInspectionDate: null,
            outcome: 'PASS',
            engineerName: 'John Smith',
            engineerRegistration: 'GAS123',
            contractorName: null,
            contractorRegistration: null,
            appliances: [],
            defects: [],
            additionalFields: {},
          },
          confidence: 0.90,
          matchedFields: 8,
          totalExpectedFields: 10,
        }),
      });

      const result = await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'application/pdf',
        'test.pdf',
        {},
        deps
      );

      expect(analyseDocumentCalled).toBe(true);
      expect(result.tierAudit[0].tier).toBe('tier-0');
      expect(result.tierAudit[0].status).toBe('success');
    });
  });

  describe('Tier 0.5 - QR and Metadata', () => {
    it('should attempt QR extraction for scanned documents', async () => {
      let qrExtractionCalled = false;

      const deps = createTestDependencies({
        analyseDocument: async () => ({
          format: 'pdf-scanned' as const,
          classification: 'structured_certificate' as const,
          pageCount: 1,
          hasTextLayer: false,
          isScanned: true,
          isHybrid: false,
          textQuality: 0,
          avgCharsPerPage: 0,
          textContent: null,
          detectedCertificateType: 'GAS' as const,
        }),
        extractQRMetadata: async () => {
          qrExtractionCalled = true;
          return {
            hasVerificationData: false,
            qrCodes: [],
            metadata: null,
            extractedData: {},
          };
        },
      });

      await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'application/pdf',
        'test.pdf',
        {},
        deps
      );

      expect(qrExtractionCalled).toBe(true);
    });

    it('should return early with QR data when verification data found', async () => {
      const deps = createTestDependencies({
        analyseDocument: async () => ({
          format: 'image' as const,
          classification: 'structured_certificate' as const,
          pageCount: 1,
          hasTextLayer: false,
          isScanned: true,
          isHybrid: false,
          textQuality: 0,
          avgCharsPerPage: 0,
          textContent: null,
          detectedCertificateType: 'GAS' as const,
        }),
        extractQRMetadata: async () => ({
          hasVerificationData: true,
          qrCodes: [{
            provider: 'gas-safe' as const,
            url: 'https://www.gassaferegister.co.uk/verify/abc123',
            verificationCode: 'ABC123',
            rawData: 'gs://verification/abc123',
          }],
          metadata: { source: 'Gas Safe Register' },
          extractedData: {
            verificationCode: 'ABC123',
            gasSafeId: 'GS-555555',
          },
        }),
      });

      const result = await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'image/jpeg',
        'test.jpg',
        {},
        deps
      );

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-0.5');
      expect(result.confidence).toBe(0.95);
      expect(result.data?.engineerRegistration).toBe('GS-555555');
    });
  });

  describe('Tier 1 - Template Extraction', () => {
    it('should use template extraction when text layer exists', async () => {
      let templateCalled = false;

      const deps = createTestDependencies({
        analyseDocument: async () => ({
          format: 'pdf-native' as const,
          classification: 'structured_certificate' as const,
          pageCount: 1,
          hasTextLayer: true,
          isScanned: false,
          isHybrid: false,
          textQuality: 0.9,
          avgCharsPerPage: 2000,
          textContent: 'Certificate content with patterns',
          detectedCertificateType: 'GAS' as const,
        }),
        extractWithTemplate: () => {
          templateCalled = true;
          return {
            success: true,
            data: {
              certificateType: 'GAS' as const,
              certificateNumber: 'CERT-001',
              propertyAddress: '123 Test St',
              uprn: null,
              inspectionDate: '2024-01-15',
              expiryDate: '2025-01-15',
              nextInspectionDate: null,
              outcome: 'PASS',
              engineerName: 'John Smith',
              engineerRegistration: 'GAS123',
              contractorName: null,
              contractorRegistration: null,
              appliances: [],
              defects: [],
              additionalFields: {},
            },
            confidence: 0.92,
            matchedFields: 9,
            totalExpectedFields: 10,
          };
        },
      });

      const result = await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'application/pdf',
        'test.pdf',
        {},
        deps
      );

      expect(templateCalled).toBe(true);
      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-1');
      expect(result.confidence).toBe(0.92);
    });

    it('should apply document-type-specific thresholds', async () => {
      const deps = createTestDependencies({
        getSettings: async () => ({
          aiEnabled: true,
          tier1Threshold: 0.85,
          tier2Threshold: 0.80,
          tier3Threshold: 0.70,
          maxCostPerDocument: 0.05,
          documentTypeThresholds: { 'FRA': 0.70 },
          customPatterns: {},
        }),
        analyseDocument: async () => ({
          format: 'pdf-native' as const,
          classification: 'complex_document' as const,
          pageCount: 15,
          hasTextLayer: true,
          isScanned: false,
          isHybrid: false,
          textQuality: 0.85,
          avgCharsPerPage: 3000,
          textContent: 'Fire Risk Assessment content',
          detectedCertificateType: 'FRA' as const,
        }),
        extractWithTemplate: () => ({
          success: true,
          data: {
            certificateType: 'FRA' as const,
            certificateNumber: 'FRA-2024-001',
            propertyAddress: '123 Test St',
            uprn: null,
            inspectionDate: '2024-01-15',
            expiryDate: '2025-01-15',
            nextInspectionDate: null,
            outcome: 'PASS',
            engineerName: 'Jane Assessor',
            engineerRegistration: null,
            contractorName: null,
            contractorRegistration: null,
            appliances: [],
            defects: [],
            additionalFields: {},
          },
          confidence: 0.72,
          matchedFields: 6,
          totalExpectedFields: 10,
        }),
      });

      const result = await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'application/pdf',
        'fra.pdf',
        {},
        deps
      );

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-1');
      expect(result.confidence).toBe(0.72);
    });
  });

  describe('AI Disabled Flow', () => {
    it('should skip AI tiers when AI is disabled', async () => {
      const deps = createTestDependencies({
        getSettings: async () => ({
          aiEnabled: false,
          tier1Threshold: 0.85,
          tier2Threshold: 0.80,
          tier3Threshold: 0.70,
          maxCostPerDocument: 0.05,
          documentTypeThresholds: {},
          customPatterns: {},
        }),
        analyseDocument: async () => ({
          format: 'pdf-native' as const,
          classification: 'structured_certificate' as const,
          pageCount: 1,
          hasTextLayer: true,
          isScanned: false,
          isHybrid: false,
          textQuality: 0.9,
          avgCharsPerPage: 2000,
          textContent: 'Certificate content',
          detectedCertificateType: 'GAS' as const,
        }),
        extractWithTemplate: () => ({
          success: true,
          data: {
            certificateType: 'GAS' as const,
            certificateNumber: 'CERT-001',
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
          },
          confidence: 0.50,
          matchedFields: 2,
          totalExpectedFields: 10,
        }),
      });

      const result = await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'application/pdf',
        'test.pdf',
        {},
        deps
      );

      expect(result.success).toBe(false);
      expect(result.finalTier).toBe('tier-4');
      expect(result.requiresReview).toBe(true);
      expect(result.warnings).toContain('AI processing is disabled. Certificate requires manual review.');

      const skippedTiers = result.tierAudit.filter(t => t.status === 'skipped');
      expect(skippedTiers.length).toBe(3);
      expect(skippedTiers.map(t => t.tier)).toContain('tier-1.5');
      expect(skippedTiers.map(t => t.tier)).toContain('tier-2');
      expect(skippedTiers.map(t => t.tier)).toContain('tier-3');
    });

    it('should force AI when forceAI option is set', async () => {
      let claudeTextCalled = false;

      const deps = createTestDependencies({
        getSettings: async () => ({
          aiEnabled: false,
          tier1Threshold: 0.85,
          tier2Threshold: 0.80,
          tier3Threshold: 0.70,
          maxCostPerDocument: 0.05,
          documentTypeThresholds: {},
          customPatterns: {},
        }),
        analyseDocument: async () => ({
          format: 'pdf-native' as const,
          classification: 'structured_certificate' as const,
          pageCount: 1,
          hasTextLayer: true,
          isScanned: false,
          isHybrid: false,
          textQuality: 0.9,
          avgCharsPerPage: 2000,
          textContent: 'Certificate content',
          detectedCertificateType: 'GAS' as const,
        }),
        extractWithTemplate: () => ({
          success: true,
          data: {
            certificateType: 'GAS' as const,
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
          },
          confidence: 0.40,
          matchedFields: 1,
          totalExpectedFields: 10,
        }),
        extractWithClaudeText: async () => {
          claudeTextCalled = true;
          return {
            success: true,
            data: {
              certificateType: 'GAS' as const,
              certificateNumber: 'CERT-001',
              propertyAddress: '123 Test St',
              uprn: null,
              inspectionDate: '2024-01-15',
              expiryDate: '2025-01-15',
              nextInspectionDate: null,
              outcome: 'PASS',
              engineerName: 'John Smith',
              engineerRegistration: 'GAS123',
              contractorName: null,
              contractorRegistration: null,
              appliances: [],
              defects: [],
              additionalFields: {},
            },
            confidence: 0.90,
            cost: 0.003,
          };
        },
      });

      const result = await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'application/pdf',
        'test.pdf',
        { forceAI: true },
        deps
      );

      expect(claudeTextCalled).toBe(true);
      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-1.5');
    });
  });

  describe('Tier 1.5 - Claude Text Enhancement', () => {
    it('should escalate to Claude text when template confidence is low', async () => {
      let claudeTextCalled = false;

      const deps = createTestDependencies({
        analyseDocument: async () => ({
          format: 'pdf-native' as const,
          classification: 'structured_certificate' as const,
          pageCount: 1,
          hasTextLayer: true,
          isScanned: false,
          isHybrid: false,
          textQuality: 0.9,
          avgCharsPerPage: 2000,
          textContent: 'Certificate content',
          detectedCertificateType: 'GAS' as const,
        }),
        extractWithTemplate: () => ({
          success: true,
          data: {
            certificateType: 'GAS' as const,
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
          },
          confidence: 0.30,
          matchedFields: 1,
          totalExpectedFields: 10,
        }),
        extractWithClaudeText: async () => {
          claudeTextCalled = true;
          return {
            success: true,
            data: {
              certificateType: 'GAS' as const,
              certificateNumber: 'CERT-001',
              propertyAddress: '123 Test St',
              uprn: null,
              inspectionDate: '2024-01-15',
              expiryDate: '2025-01-15',
              nextInspectionDate: null,
              outcome: 'PASS',
              engineerName: 'John Smith',
              engineerRegistration: 'GAS123',
              contractorName: null,
              contractorRegistration: null,
              appliances: [],
              defects: [],
              additionalFields: {},
            },
            confidence: 0.90,
            cost: 0.003,
          };
        },
      });

      const result = await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'application/pdf',
        'test.pdf',
        {},
        deps
      );

      expect(claudeTextCalled).toBe(true);
      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-1.5');
      expect(result.totalCost).toBeCloseTo(0.003, 4);
    });
  });

  describe('Cost Ceiling', () => {
    it('should stop escalation when cost limit exceeded', async () => {
      const deps = createTestDependencies({
        getSettings: async () => ({
          aiEnabled: true,
          tier1Threshold: 0.85,
          tier2Threshold: 0.80,
          tier3Threshold: 0.70,
          maxCostPerDocument: 0.002,
          documentTypeThresholds: {},
          customPatterns: {},
        }),
        analyseDocument: async () => ({
          format: 'pdf-native' as const,
          classification: 'structured_certificate' as const,
          pageCount: 1,
          hasTextLayer: true,
          isScanned: false,
          isHybrid: false,
          textQuality: 0.9,
          avgCharsPerPage: 2000,
          textContent: 'Certificate content',
          detectedCertificateType: 'GAS' as const,
        }),
        extractWithTemplate: () => ({
          success: true,
          data: {
            certificateType: 'GAS' as const,
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
          },
          confidence: 0.30,
          matchedFields: 1,
          totalExpectedFields: 10,
        }),
        extractWithClaudeText: async () => ({
          success: true,
          data: {
            certificateType: 'GAS' as const,
            certificateNumber: 'CERT-001',
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
          },
          confidence: 0.60,
          cost: 0.003,
        }),
      });

      const result = await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'application/pdf',
        'test.pdf',
        {},
        deps
      );

      expect(result.success).toBe(false);
      expect(result.requiresReview).toBe(true);
      expect(result.warnings.some(w => w.includes('Cost limit exceeded'))).toBe(true);
    });
  });

  describe('Tier Audit Recording', () => {
    it('should record audit entries for all attempted tiers', async () => {
      const auditRecords: any[] = [];

      const deps = createTestDependencies({
        analyseDocument: async () => ({
          format: 'pdf-native' as const,
          classification: 'structured_certificate' as const,
          pageCount: 1,
          hasTextLayer: true,
          isScanned: false,
          isHybrid: false,
          textQuality: 0.9,
          avgCharsPerPage: 2000,
          textContent: 'Certificate content',
          detectedCertificateType: 'GAS' as const,
        }),
        extractWithTemplate: () => ({
          success: true,
          data: {
            certificateType: 'GAS' as const,
            certificateNumber: 'CERT-001',
            propertyAddress: '123 Test St',
            uprn: null,
            inspectionDate: null,
            expiryDate: null,
            nextInspectionDate: null,
            outcome: 'PASS',
            engineerName: 'John Smith',
            engineerRegistration: null,
            contractorName: null,
            contractorRegistration: null,
            appliances: [],
            defects: [],
            additionalFields: {},
          },
          confidence: 0.90,
          matchedFields: 5,
          totalExpectedFields: 10,
        }),
        recordTierAudit: async (record) => {
          auditRecords.push(record);
        },
      });

      await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'application/pdf',
        'test.pdf',
        {},
        deps
      );

      expect(auditRecords.length).toBeGreaterThanOrEqual(2);
      expect(auditRecords[0].tier).toBe('tier-0');
      expect(auditRecords[1].tier).toBe('tier-1');
      expect(auditRecords[1].status).toBe('success');
    });
  });

  describe('Tier 2 - Azure Document Intelligence', () => {
    it('should use Azure DI when configured and previous tiers insufficient', async () => {
      let azureCalled = false;

      const deps = createTestDependencies({
        analyseDocument: async () => ({
          format: 'pdf-native' as const,
          classification: 'structured_certificate' as const,
          pageCount: 1,
          hasTextLayer: true,
          isScanned: false,
          isHybrid: false,
          textQuality: 0.9,
          avgCharsPerPage: 2000,
          textContent: 'Certificate content',
          detectedCertificateType: 'GAS' as const,
        }),
        extractWithTemplate: () => ({
          success: true,
          data: {
            certificateType: 'GAS' as const,
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
          },
          confidence: 0.30,
          matchedFields: 1,
          totalExpectedFields: 10,
        }),
        extractWithClaudeText: async () => ({
          success: true,
          data: {
            certificateType: 'GAS' as const,
            certificateNumber: 'CERT-001',
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
          },
          confidence: 0.60,
          cost: 0.003,
        }),
        isAzureDIConfigured: () => true,
        extractWithAzureDI: async () => {
          azureCalled = true;
          return {
            success: true,
            data: {
              certificateType: 'GAS' as const,
              certificateNumber: 'CERT-001',
              propertyAddress: '123 Test St',
              uprn: null,
              inspectionDate: '2024-01-15',
              expiryDate: '2025-01-15',
              nextInspectionDate: null,
              outcome: 'PASS',
              engineerName: 'John Smith',
              engineerRegistration: 'GAS123',
              contractorName: null,
              contractorRegistration: null,
              appliances: [],
              defects: [],
              additionalFields: {},
            },
            confidence: 0.88,
            cost: 0.0015,
          };
        },
      });

      const result = await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'application/pdf',
        'test.pdf',
        {},
        deps
      );

      expect(azureCalled).toBe(true);
      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-2');
    });

    it('should skip Azure DI when not configured', async () => {
      let azureCalled = false;

      const deps = createTestDependencies({
        analyseDocument: async () => ({
          format: 'pdf-native' as const,
          classification: 'structured_certificate' as const,
          pageCount: 1,
          hasTextLayer: true,
          isScanned: false,
          isHybrid: false,
          textQuality: 0.9,
          avgCharsPerPage: 2000,
          textContent: 'Certificate content',
          detectedCertificateType: 'GAS' as const,
        }),
        extractWithTemplate: () => ({
          success: true,
          data: {
            certificateType: 'GAS' as const,
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
          },
          confidence: 0.30,
          matchedFields: 1,
          totalExpectedFields: 10,
        }),
        extractWithClaudeText: async () => ({
          success: true,
          data: {
            certificateType: 'GAS' as const,
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
          },
          confidence: 0.60,
          cost: 0.003,
        }),
        isAzureDIConfigured: () => false,
        extractWithAzureDI: async () => {
          azureCalled = true;
          return {
            success: false,
            data: {
              certificateType: 'UNKNOWN' as const,
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
            },
            confidence: 0,
            cost: 0,
          };
        },
      });

      await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'application/pdf',
        'test.pdf',
        {},
        deps
      );

      expect(azureCalled).toBe(false);
    });
  });

  describe('Tier 3 - Claude Vision', () => {
    it('should use Claude Vision for images', async () => {
      let visionCalled = false;

      const deps = createTestDependencies({
        analyseDocument: async () => ({
          format: 'image' as const,
          classification: 'structured_certificate' as const,
          pageCount: 1,
          hasTextLayer: false,
          isScanned: true,
          isHybrid: false,
          textQuality: 0,
          avgCharsPerPage: 0,
          textContent: null,
          detectedCertificateType: 'GAS' as const,
        }),
        extractQRMetadata: async () => ({
          hasVerificationData: false,
          qrCodes: [],
          metadata: null,
          extractedData: {},
        }),
        isAzureDIConfigured: () => false,
        extractWithClaudeVision: async () => {
          visionCalled = true;
          return {
            success: true,
            data: {
              certificateType: 'GAS' as const,
              certificateNumber: 'CERT-001',
              propertyAddress: '123 Test St',
              uprn: null,
              inspectionDate: '2024-01-15',
              expiryDate: '2025-01-15',
              nextInspectionDate: null,
              outcome: 'PASS',
              engineerName: 'John Smith',
              engineerRegistration: 'GAS123',
              contractorName: null,
              contractorRegistration: null,
              appliances: [],
              defects: [],
              additionalFields: {},
            },
            confidence: 0.85,
            cost: 0.01,
          };
        },
      });

      const result = await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'image/jpeg',
        'test.jpg',
        {},
        deps
      );

      expect(visionCalled).toBe(true);
      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-3');
    });
  });

  describe('Tier 4 - Manual Review Fallback', () => {
    it('should route to manual review when all tiers exhausted', async () => {
      const deps = createTestDependencies({
        analyseDocument: async () => ({
          format: 'pdf-native' as const,
          classification: 'complex_document' as const,
          pageCount: 20,
          hasTextLayer: true,
          isScanned: false,
          isHybrid: false,
          textQuality: 0.7,
          avgCharsPerPage: 3000,
          textContent: 'Complex document content',
          detectedCertificateType: 'FRA' as const,
        }),
        extractWithTemplate: () => ({
          success: true,
          data: {
            certificateType: 'FRA' as const,
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
          },
          confidence: 0.20,
          matchedFields: 0,
          totalExpectedFields: 10,
        }),
        extractWithClaudeText: async () => ({
          success: true,
          data: {
            certificateType: 'FRA' as const,
            certificateNumber: 'FRA-001',
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
          },
          confidence: 0.55,
          cost: 0.003,
        }),
        isAzureDIConfigured: () => false,
        extractWithClaudeVisionFromPDF: async () => ({
          success: true,
          data: {
            certificateType: 'FRA' as const,
            certificateNumber: 'FRA-001',
            propertyAddress: '123 Test Building',
            uprn: null,
            inspectionDate: null,
            expiryDate: null,
            nextInspectionDate: null,
            outcome: null,
            engineerName: 'J. Assessor',
            engineerRegistration: null,
            contractorName: null,
            contractorRegistration: null,
            appliances: [],
            defects: [],
            additionalFields: {},
          },
          confidence: 0.65,
          cost: 0.01,
        }),
      });

      const result = await extractCertificateWithDI(
        testCertificateId,
        testBuffer,
        'application/pdf',
        'test.pdf',
        {},
        deps
      );

      expect(result.success).toBe(false);
      expect(result.finalTier).toBe('tier-4');
      expect(result.requiresReview).toBe(true);
      expect(result.warnings.some(w => w.includes('manual review'))).toBe(true);
    });
  });
});
