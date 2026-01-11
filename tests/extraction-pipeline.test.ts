import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FormatAnalysis } from '../server/services/extraction/format-detector';
import type { QRMetadataResult } from '../server/services/extraction/qr-metadata';
import type { ExtractionDependencies, ExtractionSettings } from '../server/services/extraction/dependencies';

vi.mock('../server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
    }),
  },
}));

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

const createMockFormatAnalysis = (overrides: Partial<FormatAnalysis> = {}): FormatAnalysis => ({
  format: 'pdf-native',
  classification: 'structured_certificate',
  detectedCertificateType: 'GAS_SAFETY',
  hasTextLayer: true,
  isScanned: false,
  isHybrid: false,
  textContent: 'Test certificate content',
  pageCount: 1,
  textQuality: 0.9,
  avgCharsPerPage: 500,
  ...overrides,
});

const createMockQRMetadata = (overrides: Partial<QRMetadataResult> = {}): QRMetadataResult => ({
  hasVerificationData: false,
  qrCodes: [],
  metadata: null,
  extractedData: {},
  ...overrides,
});

const createMockSettings = (overrides: Partial<ExtractionSettings> = {}): ExtractionSettings => ({
  aiEnabled: true,
  tier1Threshold: 0.85,
  tier2Threshold: 0.80,
  tier3Threshold: 0.70,
  maxCostPerDocument: 0.05,
  documentTypeThresholds: {},
  customPatterns: {},
  ...overrides,
});

const createMockExtractedData = (overrides = {}) => ({
  certificateType: 'GAS_SAFETY' as const,
  certificateNumber: 'GSR-2024-001',
  propertyAddress: '123 Test Street',
  uprn: '12345678901',
  inspectionDate: '2024-01-15',
  expiryDate: '2025-01-15',
  nextInspectionDate: '2025-01-15',
  outcome: 'PASS' as const,
  engineerName: 'John Smith',
  engineerRegistration: '123456',
  contractorName: 'Test Gas Ltd',
  contractorRegistration: 'GS123456',
  appliances: [],
  defects: [],
  additionalFields: {},
  ...overrides,
});

describe('Extraction Pipeline Tests', () => {
  describe('Format Detection', () => {
    it('should detect PDF from mime type', async () => {
      const { detectFormatFromMime } = await import('../server/services/extraction/format-detector');
      expect(detectFormatFromMime('application/pdf')).toBe('pdf-native');
    });

    it('should detect image formats from mime type', async () => {
      const { detectFormatFromMime } = await import('../server/services/extraction/format-detector');
      expect(detectFormatFromMime('image/jpeg')).toBe('image');
      expect(detectFormatFromMime('image/png')).toBe('image');
      expect(detectFormatFromMime('image/tiff')).toBe('image');
    });

    it('should detect document formats from extension', async () => {
      const { detectFormatFromExtension } = await import('../server/services/extraction/format-detector');
      expect(detectFormatFromExtension('document.pdf')).toBe('pdf-native');
      expect(detectFormatFromExtension('document.docx')).toBe('docx');
      expect(detectFormatFromExtension('data.xlsx')).toBe('xlsx');
      expect(detectFormatFromExtension('data.csv')).toBe('csv');
    });

    it('should detect certificate type from filename', async () => {
      const { detectCertificateTypeFromFilename } = await import('../server/services/extraction/format-detector');
      expect(detectCertificateTypeFromFilename('gas_safety_certificate.pdf')).toBe('GAS_SAFETY');
      expect(detectCertificateTypeFromFilename('EICR_report.pdf')).toBe('EICR');
      const fraResult = detectCertificateTypeFromFilename('fire_risk_assessment.pdf');
      expect(['FRA', 'FIRE_RISK_ASSESSMENT']).toContain(fraResult);
    });

    it('should classify document based on content', async () => {
      const { classifyDocument } = await import('../server/services/extraction/format-detector');
      const gasResult = classifyDocument('Gas Safety Record CP12', 'GAS_SAFETY');
      expect(['structured_certificate', 'unknown']).toContain(gasResult);
      expect(classifyDocument('Some random document', 'UNKNOWN')).toBe('unknown');
    });

    it('should detect certificate type from text content', async () => {
      const { detectCertificateType } = await import('../server/services/extraction/format-detector');
      expect(detectCertificateType('Landlord Gas Safety Record')).toBe('GAS_SAFETY');
      expect(detectCertificateType('Electrical Installation Condition Report')).toBe('EICR');
      const fraResult = detectCertificateType('Fire Risk Assessment');
      expect(['FRA', 'FIRE_RISK_ASSESSMENT']).toContain(fraResult);
      expect(detectCertificateType('Energy Performance Certificate Rating: B')).toBe('EPC');
    });
  });

  describe('Template Pattern Extraction', () => {
    it('should extract certificate number from text', async () => {
      const { extractWithTemplate } = await import('../server/services/extraction/template-patterns');
      const text = `Gas Safety Certificate
Certificate No: GS-2024-001
Gas Safe Reg: 123456
Inspection Date: 15/01/2024
Property Address: 123 Main Street`;
      const result = extractWithTemplate(text, 'GAS');
      expect(result.data).toBeDefined();
    });

    it('should extract defects from EICR text', async () => {
      const { extractDefects } = await import('../server/services/extraction/template-patterns');
      const text = 'Circuit 1: C1 - Danger present. Socket: C2 - Potentially dangerous';
      const defects = extractDefects(text);
      expect(defects.length).toBeGreaterThanOrEqual(2);
      expect(defects.some(d => d.code === 'C1')).toBe(true);
      expect(defects.some(d => d.code === 'C2')).toBe(true);
    });

    it('should extract gas appliances from text', async () => {
      const { extractAppliances } = await import('../server/services/extraction/template-patterns');
      const text = 'Appliance 1: Boiler - Worcester Greenstar - Safe';
      const appliances = extractAppliances(text, 'GAS');
      expect(appliances.length).toBeGreaterThan(0);
    });

    it('should handle empty text gracefully', async () => {
      const { extractWithTemplate } = await import('../server/services/extraction/template-patterns');
      const result = extractWithTemplate('', 'GAS');
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should return low confidence for unknown certificate types', async () => {
      const { extractWithTemplate } = await import('../server/services/extraction/template-patterns');
      const result = extractWithTemplate('random text', 'UNKNOWN_TYPE' as any);
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  describe('Outcome Evaluation', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should evaluate UNSATISFACTORY for high-severity defects', async () => {
      const { clearRulesCache } = await import('../server/services/extraction/outcome-evaluator');
      clearRulesCache();
      
      const data = {
        certificateType: 'GAS_SAFETY',
        outcome: 'UNSATISFACTORY',
        defects: [{ code: 'ID', description: 'Immediately Dangerous' }],
      } as any;
      
      expect(data.outcome).toBe('UNSATISFACTORY');
    });

    it('should evaluate SATISFACTORY when no defects present', async () => {
      const data = {
        certificateType: 'GAS_SAFETY',
        outcome: 'SATISFACTORY',
        defects: [],
      } as any;
      
      expect(data.outcome).toBe('SATISFACTORY');
    });

    it('should handle EICR with C1/C2 observations', () => {
      const data = {
        certificateType: 'EICR',
        observations: [
          { code: 'C1', description: 'Danger' },
          { code: 'C2', description: 'Potential danger' },
        ],
      };
      
      const hasUnsafeObservations = data.observations.some(
        o => o.code === 'C1' || o.code === 'C2'
      );
      expect(hasUnsafeObservations).toBe(true);
    });
  });

  describe('Extraction Orchestrator with Dependency Injection', () => {
    let mockDeps: ExtractionDependencies;

    beforeEach(() => {
      mockDeps = {
        getSettings: vi.fn().mockResolvedValue(createMockSettings()),
        analyseDocument: vi.fn().mockResolvedValue(createMockFormatAnalysis()),
        extractQRMetadata: vi.fn().mockResolvedValue(createMockQRMetadata()),
        extractWithTemplate: vi.fn().mockReturnValue({
          success: false,
          confidence: 0.5,
          data: createMockExtractedData(),
          matchedFields: 3,
        }),
        extractWithClaudeText: vi.fn().mockResolvedValue({
          success: true,
          confidence: 0.9,
          data: createMockExtractedData(),
          cost: 0.003,
        }),
        extractWithAzureDI: vi.fn().mockResolvedValue({
          success: true,
          confidence: 0.85,
          data: createMockExtractedData(),
          cost: 0.0015,
          rawText: 'Extracted text',
          structuredData: {},
          pageCount: 1,
        }),
        extractWithClaudeVision: vi.fn().mockResolvedValue({
          success: true,
          confidence: 0.85,
          data: createMockExtractedData(),
          cost: 0.01,
        }),
        isAzureDIConfigured: vi.fn().mockReturnValue(false),
        recordTierAudit: vi.fn().mockResolvedValue(undefined),
      };
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should complete at tier-0.5 with QR verification data', async () => {
      const { extractCertificateWithDI } = await import('../server/services/extraction/orchestrator-di');
      
      mockDeps.analyseDocument = vi.fn().mockResolvedValue(createMockFormatAnalysis({
        format: 'image',
        isScanned: true,
        hasTextLayer: false,
      }));
      
      mockDeps.extractQRMetadata = vi.fn().mockResolvedValue(createMockQRMetadata({
        hasVerificationData: true,
        qrCodes: [{ provider: 'gas-safe', url: 'https://verify.example.com', verificationCode: 'GAS123' }],
        extractedData: { verificationCode: 'GAS123', gasSafeId: '123456' },
      }));

      const result = await extractCertificateWithDI(
        'test-cert-id',
        Buffer.from('test'),
        'image/jpeg',
        'certificate.jpg',
        {},
        mockDeps
      );

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-0.5');
      expect(result.confidence).toBe(0.95);
      expect(result.totalCost).toBe(0);
    });

    it('should complete at tier-1 with high confidence template extraction', async () => {
      const { extractCertificateWithDI } = await import('../server/services/extraction/orchestrator-di');
      
      mockDeps.extractWithTemplate = vi.fn().mockReturnValue({
        success: true,
        confidence: 0.9,
        data: createMockExtractedData(),
        matchedFields: 8,
      });

      const result = await extractCertificateWithDI(
        'test-cert-id',
        Buffer.from('test'),
        'application/pdf',
        'certificate.pdf',
        {},
        mockDeps
      );

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-1');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.totalCost).toBe(0);
    });

    it('should escalate to tier-1.5 when template confidence is low', async () => {
      const { extractCertificateWithDI } = await import('../server/services/extraction/orchestrator-di');
      
      mockDeps.extractWithTemplate = vi.fn().mockReturnValue({
        success: true,
        confidence: 0.5,
        data: createMockExtractedData({ certificateNumber: null }),
        matchedFields: 2,
      });

      const result = await extractCertificateWithDI(
        'test-cert-id',
        Buffer.from('test'),
        'application/pdf',
        'certificate.pdf',
        {},
        mockDeps
      );

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-1.5');
      expect(mockDeps.extractWithClaudeText).toHaveBeenCalled();
    });

    it('should use Azure DI when configured and tier-1.5 fails', async () => {
      const { extractCertificateWithDI } = await import('../server/services/extraction/orchestrator-di');
      
      mockDeps.isAzureDIConfigured = vi.fn().mockReturnValue(true);
      mockDeps.extractWithTemplate = vi.fn().mockReturnValue({
        success: false,
        confidence: 0.3,
        data: createMockExtractedData(),
        matchedFields: 1,
      });
      mockDeps.extractWithClaudeText = vi.fn().mockResolvedValue({
        success: false,
        confidence: 0.4,
        data: createMockExtractedData(),
        cost: 0.003,
      });

      const result = await extractCertificateWithDI(
        'test-cert-id',
        Buffer.from('test'),
        'application/pdf',
        'certificate.pdf',
        {},
        mockDeps
      );

      expect(mockDeps.extractWithAzureDI).toHaveBeenCalled();
      expect(result.finalTier).toBe('tier-2');
    });

    it('should skip AI tiers when AI is disabled', async () => {
      const { extractCertificateWithDI } = await import('../server/services/extraction/orchestrator-di');
      
      mockDeps.getSettings = vi.fn().mockResolvedValue(createMockSettings({ aiEnabled: false }));
      mockDeps.extractWithTemplate = vi.fn().mockReturnValue({
        success: false,
        confidence: 0.5,
        data: createMockExtractedData(),
        matchedFields: 3,
      });

      const result = await extractCertificateWithDI(
        'test-cert-id',
        Buffer.from('test'),
        'application/pdf',
        'certificate.pdf',
        {},
        mockDeps
      );

      expect(result.requiresReview).toBe(true);
      expect(result.finalTier).toBe('tier-4');
      expect(mockDeps.extractWithClaudeText).not.toHaveBeenCalled();
      expect(mockDeps.extractWithAzureDI).not.toHaveBeenCalled();
    });

    it('should stop extraction when cost limit is exceeded', async () => {
      const { extractCertificateWithDI } = await import('../server/services/extraction/orchestrator-di');
      
      mockDeps.getSettings = vi.fn().mockResolvedValue(createMockSettings({ maxCostPerDocument: 0.001 }));
      mockDeps.extractWithTemplate = vi.fn().mockReturnValue({
        success: false,
        confidence: 0.3,
        data: createMockExtractedData(),
        matchedFields: 1,
      });
      mockDeps.extractWithClaudeText = vi.fn().mockResolvedValue({
        success: false,
        confidence: 0.5,
        data: createMockExtractedData(),
        cost: 0.01,
      });

      const result = await extractCertificateWithDI(
        'test-cert-id',
        Buffer.from('test'),
        'application/pdf',
        'certificate.pdf',
        {},
        mockDeps
      );

      expect(result.requiresReview).toBe(true);
      expect(result.warnings.some(w => w.includes('Cost limit exceeded'))).toBe(true);
    });

    it('should force AI processing with forceAI option', async () => {
      const { extractCertificateWithDI } = await import('../server/services/extraction/orchestrator-di');
      
      mockDeps.getSettings = vi.fn().mockResolvedValue(createMockSettings({ aiEnabled: false }));
      mockDeps.extractWithTemplate = vi.fn().mockReturnValue({
        success: false,
        confidence: 0.3,
        data: createMockExtractedData(),
        matchedFields: 1,
      });

      await extractCertificateWithDI(
        'test-cert-id',
        Buffer.from('test'),
        'application/pdf',
        'certificate.pdf',
        { forceAI: true },
        mockDeps
      );

      expect(mockDeps.extractWithClaudeText).toHaveBeenCalled();
    });

    it('should record tier audit for each tier attempted', async () => {
      const { extractCertificateWithDI } = await import('../server/services/extraction/orchestrator-di');
      
      mockDeps.extractWithTemplate = vi.fn().mockReturnValue({
        success: true,
        confidence: 0.9,
        data: createMockExtractedData(),
        matchedFields: 8,
      });

      const result = await extractCertificateWithDI(
        'test-cert-id',
        Buffer.from('test'),
        'application/pdf',
        'certificate.pdf',
        {},
        mockDeps
      );

      expect(mockDeps.recordTierAudit).toHaveBeenCalled();
      expect(result.tierAudit.length).toBeGreaterThan(0);
      expect(result.tierAudit.some(t => t.tier === 'tier-0')).toBe(true);
      expect(result.tierAudit.some(t => t.tier === 'tier-1')).toBe(true);
    });
  });

  describe('Extraction Error Handling', () => {
    it('should handle format analysis failure gracefully', async () => {
      const mockDeps: ExtractionDependencies = {
        getSettings: vi.fn().mockResolvedValue(createMockSettings()),
        analyseDocument: vi.fn().mockRejectedValue(new Error('PDF parsing failed')),
        extractQRMetadata: vi.fn().mockResolvedValue(createMockQRMetadata()),
        extractWithTemplate: vi.fn(),
        extractWithClaudeText: vi.fn(),
        extractWithAzureDI: vi.fn(),
        extractWithClaudeVision: vi.fn(),
        isAzureDIConfigured: vi.fn().mockReturnValue(false),
        recordTierAudit: vi.fn(),
      };

      const { extractCertificateWithDI } = await import('../server/services/extraction/orchestrator-di');
      
      await expect(extractCertificateWithDI(
        'test-cert-id',
        Buffer.from('test'),
        'application/pdf',
        'certificate.pdf',
        {},
        mockDeps
      )).rejects.toThrow();
    });

    it('should handle Claude Text errors and escalate to Azure DI', async () => {
      const mockDeps: ExtractionDependencies = {
        getSettings: vi.fn().mockResolvedValue(createMockSettings()),
        analyseDocument: vi.fn().mockResolvedValue(createMockFormatAnalysis()),
        extractQRMetadata: vi.fn().mockResolvedValue(createMockQRMetadata()),
        extractWithTemplate: vi.fn().mockReturnValue({
          success: false,
          confidence: 0.3,
          data: createMockExtractedData(),
          matchedFields: 1,
        }),
        extractWithClaudeText: vi.fn().mockResolvedValue({
          success: false,
          confidence: 0.3,
          data: createMockExtractedData(),
          cost: 0.003,
          error: 'Claude API error',
        }),
        extractWithAzureDI: vi.fn().mockResolvedValue({
          success: true,
          confidence: 0.85,
          data: createMockExtractedData(),
          cost: 0.0015,
          rawText: 'text',
          structuredData: {},
          pageCount: 1,
        }),
        extractWithClaudeVision: vi.fn(),
        isAzureDIConfigured: vi.fn().mockReturnValue(true),
        recordTierAudit: vi.fn(),
      };

      const { extractCertificateWithDI } = await import('../server/services/extraction/orchestrator-di');
      
      const result = await extractCertificateWithDI(
        'test-cert-id',
        Buffer.from('test'),
        'application/pdf',
        'certificate.pdf',
        {},
        mockDeps
      );

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-2');
      expect(mockDeps.extractWithAzureDI).toHaveBeenCalled();
    });
  });

  describe('Extraction Types and Constants', () => {
    it('should export TIER_CONFIDENCE_THRESHOLDS with correct values', async () => {
      const { TIER_CONFIDENCE_THRESHOLDS } = await import('../server/services/extraction/types');
      
      expect(TIER_CONFIDENCE_THRESHOLDS['tier-0']).toBe(0);
      expect(TIER_CONFIDENCE_THRESHOLDS['tier-0.5']).toBe(0.95);
      expect(TIER_CONFIDENCE_THRESHOLDS['tier-1']).toBe(0.85);
      expect(TIER_CONFIDENCE_THRESHOLDS['tier-2']).toBe(0.80);
    });

    it('should export TIER_COSTS with correct values', async () => {
      const { TIER_COSTS } = await import('../server/services/extraction/types');
      
      expect(TIER_COSTS['tier-0']).toBe(0);
      expect(TIER_COSTS['tier-1']).toBe(0);
      expect(TIER_COSTS['tier-1.5']).toBeGreaterThan(0);
      expect(TIER_COSTS['tier-3']).toBeGreaterThan(TIER_COSTS['tier-2']);
    });

    it('should have tier costs increase progressively', async () => {
      const { TIER_COSTS } = await import('../server/services/extraction/types');
      
      expect(TIER_COSTS['tier-0']).toBeLessThanOrEqual(TIER_COSTS['tier-1']);
      expect(TIER_COSTS['tier-1']).toBeLessThanOrEqual(TIER_COSTS['tier-1.5']);
      expect(TIER_COSTS['tier-2']).toBeLessThanOrEqual(TIER_COSTS['tier-3']);
    });
  });
});
