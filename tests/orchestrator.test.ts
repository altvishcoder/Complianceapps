import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
    }),
  },
}));

vi.mock('../server/services/extraction/format-detector', () => ({
  analyseDocument: vi.fn(),
  detectFormatFromMime: vi.fn().mockReturnValue('pdf-native'),
  detectFormatFromExtension: vi.fn().mockReturnValue('pdf-native'),
  detectCertificateType: vi.fn().mockReturnValue('GAS_SAFETY'),
  detectCertificateTypeFromFilename: vi.fn().mockReturnValue('GAS_SAFETY'),
  classifyDocument: vi.fn().mockReturnValue('structured_certificate'),
}));

vi.mock('../server/services/extraction/qr-metadata', () => ({
  extractQRAndMetadata: vi.fn(),
}));

vi.mock('../server/services/extraction/template-patterns', () => ({
  extractWithTemplate: vi.fn(),
  extractDefects: vi.fn().mockReturnValue([]),
  extractAppliances: vi.fn().mockReturnValue([]),
}));

vi.mock('../server/services/extraction/claude-text', () => ({
  extractWithClaudeText: vi.fn().mockResolvedValue({
    success: false,
    confidence: 0.5,
    data: {},
    cost: 0.003,
  }),
}));

vi.mock('../server/services/extraction/azure-di', () => ({
  extractWithAzureDI: vi.fn().mockResolvedValue({
    success: false,
    confidence: 0.5,
    data: {},
    cost: 0.0015,
    rawText: '',
    structuredData: {},
    pageCount: 1,
  }),
  isAzureDIConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock('../server/services/extraction/claude-vision', () => ({
  extractWithClaudeVision: vi.fn().mockResolvedValue({
    success: false,
    confidence: 0.5,
    data: {},
    cost: 0.01,
  }),
  extractWithClaudeVisionFromPDF: vi.fn().mockResolvedValue({
    success: false,
    confidence: 0.5,
    data: {},
    cost: 0.01,
  }),
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

import { db } from '../server/db';
import { analyseDocument } from '../server/services/extraction/format-detector';
import { extractQRAndMetadata } from '../server/services/extraction/qr-metadata';
import { extractWithTemplate } from '../server/services/extraction/template-patterns';
import { isAzureDIConfigured, extractWithAzureDI } from '../server/services/extraction/azure-di';
import { extractWithClaudeText } from '../server/services/extraction/claude-text';
import { extractCertificate } from '../server/services/extraction/orchestrator';

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

describe('Extraction Orchestrator Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockResolvedValue([
        { key: 'AI_EXTRACTION_ENABLED', value: 'true' },
        { key: 'TIER1_CONFIDENCE_THRESHOLD', value: '0.85' },
        { key: 'MAX_COST_PER_DOCUMENT', value: '0.05' },
      ]),
    } as any);
  });

  describe('QR Code Verification Path', () => {
    it('should complete at tier-0.5 when QR verification data is present', async () => {
      vi.mocked(analyseDocument).mockResolvedValue({
        format: 'image',
        detectedCertificateType: 'GAS_SAFETY',
        isScanned: true,
        pageCount: 1,
        hasText: false,
        textContent: '',
        classification: 'structured_certificate',
        qualityScore: 0.8,
      } as any);

      vi.mocked(extractQRAndMetadata).mockResolvedValue({
        hasVerificationData: true,
        qrCodes: [{ provider: 'gas-safe', url: 'https://verify.gassafe.co.uk', verificationCode: 'GAS123456', rawData: 'GAS123456' }],
        metadata: null,
        extractedData: {
          certificateNumber: 'GAS123456',
          gasEngineerRegistration: '123456',
        },
      } as any);
      
      const result = await extractCertificate(
        'test-cert-id',
        Buffer.from('test'),
        'image/jpeg',
        'gas_certificate.jpg'
      );

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-0.5');
      expect(result.confidence).toBe(0.95);
    });
  });

  describe('AI Disabled Path', () => {
    it('should skip AI tiers when AI processing is disabled', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue([
          { key: 'AI_EXTRACTION_ENABLED', value: 'false' },
        ]),
      } as any);

      vi.mocked(analyseDocument).mockResolvedValue({
        format: 'pdf-native',
        detectedCertificateType: 'GAS_SAFETY',
        isScanned: false,
        pageCount: 1,
        hasText: true,
        textContent: 'Gas Safety Record',
        classification: 'structured_certificate',
        qualityScore: 0.9,
      } as any);

      vi.mocked(extractQRAndMetadata).mockResolvedValue({
        hasVerificationData: false,
        qrCodes: [],
        metadata: null,
        extractedData: {},
      } as any);

      vi.mocked(extractWithTemplate).mockResolvedValue({
        success: true,
        confidence: 0.6,
        data: createMockExtractedData(),
        matchedFields: 3,
      } as any);
      
      const result = await extractCertificate(
        'test-cert-id',
        Buffer.from('test'),
        'application/pdf',
        'gas.pdf'
      );

      expect(result.requiresReview).toBe(true);
      expect(result.finalTier).toBe('tier-4');
      expect(extractWithClaudeText).not.toHaveBeenCalled();
      expect(extractWithAzureDI).not.toHaveBeenCalled();
    });
  });

  describe('Azure DI Path', () => {
    it('should use Azure DI when configured', async () => {
      vi.mocked(isAzureDIConfigured).mockReturnValue(true);

      vi.mocked(analyseDocument).mockResolvedValue({
        format: 'pdf-scanned',
        detectedCertificateType: 'GAS_SAFETY',
        isScanned: true,
        pageCount: 1,
        hasText: false,
        textContent: '',
        classification: 'structured_certificate',
        qualityScore: 0.7,
      } as any);

      vi.mocked(extractQRAndMetadata).mockResolvedValue({
        hasVerificationData: false,
        qrCodes: [],
        metadata: null,
        extractedData: {},
      } as any);

      vi.mocked(extractWithTemplate).mockResolvedValue({
        success: false,
        confidence: 0.3,
        data: createMockExtractedData(),
        matchedFields: 0,
      } as any);

      vi.mocked(extractWithClaudeText).mockResolvedValue({
        success: false,
        confidence: 0.4,
        data: createMockExtractedData(),
        cost: 0.002,
      } as any);

      vi.mocked(extractWithAzureDI).mockResolvedValue({
        success: true,
        confidence: 0.85,
        data: createMockExtractedData({ certificateNumber: 'GSR-2024-002' }),
        cost: 0.0015,
        rawText: 'Extracted text from Azure DI',
        structuredData: {},
        pageCount: 1,
      } as any);
      
      const result = await extractCertificate(
        'test-cert-id',
        Buffer.from('test'),
        'application/pdf',
        'scanned_gas.pdf'
      );

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-2');
      expect(extractWithAzureDI).toHaveBeenCalled();
    });
  });
});

describe('Extraction Types and Constants (Real Exports)', () => {
  it('should export TIER_CONFIDENCE_THRESHOLDS with correct values', async () => {
    const { TIER_CONFIDENCE_THRESHOLDS } = await import('../server/services/extraction/types');
    
    expect(TIER_CONFIDENCE_THRESHOLDS['tier-0']).toBe(0);
    expect(TIER_CONFIDENCE_THRESHOLDS['tier-0.5']).toBe(0.95);
    expect(TIER_CONFIDENCE_THRESHOLDS['tier-1']).toBe(0.85);
    expect(TIER_CONFIDENCE_THRESHOLDS['tier-1.5']).toBe(0.80);
    expect(TIER_CONFIDENCE_THRESHOLDS['tier-2']).toBe(0.80);
    expect(TIER_CONFIDENCE_THRESHOLDS['tier-3']).toBe(0.70);
    expect(TIER_CONFIDENCE_THRESHOLDS['tier-4']).toBe(0);
  });

  it('should export TIER_COSTS with correct values', async () => {
    const { TIER_COSTS } = await import('../server/services/extraction/types');
    
    expect(TIER_COSTS['tier-0']).toBe(0);
    expect(TIER_COSTS['tier-0.5']).toBe(0);
    expect(TIER_COSTS['tier-1']).toBe(0);
    expect(TIER_COSTS['tier-1.5']).toBe(0.003);
    expect(TIER_COSTS['tier-2']).toBe(0.0015);
    expect(TIER_COSTS['tier-3']).toBe(0.01);
    expect(TIER_COSTS['tier-4']).toBe(0);
  });

  it('should have tier-0 as lowest cost', async () => {
    const { TIER_COSTS } = await import('../server/services/extraction/types');
    
    expect(TIER_COSTS['tier-0']).toBe(0);
    expect(TIER_COSTS['tier-1']).toBe(0);
    expect(TIER_COSTS['tier-3']).toBeGreaterThan(TIER_COSTS['tier-2']);
  });

  it('should have tier-1 threshold higher than tier-3', async () => {
    const { TIER_CONFIDENCE_THRESHOLDS } = await import('../server/services/extraction/types');
    
    expect(TIER_CONFIDENCE_THRESHOLDS['tier-1']).toBeGreaterThan(TIER_CONFIDENCE_THRESHOLDS['tier-3']);
  });
});

describe('Extraction Function Export', () => {
  it('should export extractCertificate function', () => {
    expect(typeof extractCertificate).toBe('function');
  });
});
