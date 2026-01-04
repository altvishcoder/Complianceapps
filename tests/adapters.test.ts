import { describe, it, expect, beforeEach } from 'vitest';
import {
  StubExtractionAdapter,
  createSuccessfulAdapter,
  createFailingAdapter,
  createLowConfidenceAdapter,
  createCostlyAdapter,
  createUnavailableAdapter,
} from '../server/services/extraction/adapters/stub-adapter';
import {
  InMemoryTierAuditSink,
  type ExtractionContext,
  type TierAuditEntry,
} from '../server/services/extraction/adapters/types';

describe('StubExtractionAdapter', () => {
  const testBuffer = Buffer.from('test document content');
  const testContext: ExtractionContext = { documentId: 'test-doc-1' };

  describe('Basic functionality', () => {
    it('should return configured response on extract', async () => {
      const adapter = new StubExtractionAdapter({
        name: 'test-adapter',
        tier: 'tier-1',
        responses: [{
          success: true,
          confidence: 0.90,
          data: { certificateNumber: 'ABC123' } as any,
          provider: 'test',
          tier: 'tier-1',
          costIncurred: 0,
          processingTimeMs: 10,
        }],
      });

      const result = await adapter.extract(testBuffer, testContext);
      
      expect(result.success).toBe(true);
      expect(result.confidence).toBe(0.90);
      expect(result.data?.certificateNumber).toBe('ABC123');
    });

    it('should track call count', async () => {
      const adapter = new StubExtractionAdapter({
        name: 'test-adapter',
        tier: 'tier-1',
        responses: [{
          success: true,
          confidence: 0.90,
          data: null,
          provider: 'test',
          tier: 'tier-1',
          costIncurred: 0,
          processingTimeMs: 10,
        }],
      });

      expect(adapter.getCallCount()).toBe(0);
      await adapter.extract(testBuffer, testContext);
      expect(adapter.getCallCount()).toBe(1);
      await adapter.extract(testBuffer, testContext);
      expect(adapter.getCallCount()).toBe(2);
    });

    it('should reset call count', async () => {
      const adapter = new StubExtractionAdapter({
        name: 'test-adapter',
        tier: 'tier-1',
        responses: [{
          success: true,
          confidence: 0.90,
          data: null,
          provider: 'test',
          tier: 'tier-1',
          costIncurred: 0,
          processingTimeMs: 10,
        }],
      });

      await adapter.extract(testBuffer, testContext);
      await adapter.extract(testBuffer, testContext);
      adapter.reset();
      expect(adapter.getCallCount()).toBe(0);
    });

    it('should throw error when response is an Error', async () => {
      const testError = new Error('API timeout');
      const adapter = new StubExtractionAdapter({
        name: 'test-adapter',
        tier: 'tier-1',
        responses: [testError],
      });

      await expect(adapter.extract(testBuffer, testContext)).rejects.toThrow('API timeout');
    });

    it('should cycle through multiple responses', async () => {
      const adapter = new StubExtractionAdapter({
        name: 'test-adapter',
        tier: 'tier-1',
        responses: [
          {
            success: true,
            confidence: 0.60,
            data: null,
            provider: 'test',
            tier: 'tier-1',
            costIncurred: 0,
            processingTimeMs: 10,
          },
          {
            success: true,
            confidence: 0.90,
            data: null,
            provider: 'test',
            tier: 'tier-1',
            costIncurred: 0,
            processingTimeMs: 10,
          },
        ],
      });

      const result1 = await adapter.extract(testBuffer, testContext);
      expect(result1.confidence).toBe(0.60);
      
      const result2 = await adapter.extract(testBuffer, testContext);
      expect(result2.confidence).toBe(0.90);
    });

    it('should repeat last response when exhausted', async () => {
      const adapter = new StubExtractionAdapter({
        name: 'test-adapter',
        tier: 'tier-1',
        responses: [{
          success: true,
          confidence: 0.95,
          data: null,
          provider: 'test',
          tier: 'tier-1',
          costIncurred: 0,
          processingTimeMs: 10,
        }],
      });

      await adapter.extract(testBuffer, testContext);
      await adapter.extract(testBuffer, testContext);
      const result = await adapter.extract(testBuffer, testContext);
      expect(result.confidence).toBe(0.95);
    });
  });

  describe('Availability', () => {
    it('should report availability status', () => {
      const availableAdapter = new StubExtractionAdapter({
        name: 'test',
        tier: 'tier-1',
        responses: [],
        available: true,
      });
      expect(availableAdapter.isAvailable()).toBe(true);

      const unavailableAdapter = new StubExtractionAdapter({
        name: 'test',
        tier: 'tier-1',
        responses: [],
        available: false,
      });
      expect(unavailableAdapter.isAvailable()).toBe(false);
    });

    it('should allow changing availability', () => {
      const adapter = new StubExtractionAdapter({
        name: 'test',
        tier: 'tier-1',
        responses: [],
        available: true,
      });

      expect(adapter.isAvailable()).toBe(true);
      adapter.setAvailable(false);
      expect(adapter.isAvailable()).toBe(false);
    });
  });

  describe('Properties', () => {
    it('should expose name, tier, and costPerCall', () => {
      const adapter = new StubExtractionAdapter({
        name: 'claude-vision',
        tier: 'tier-3',
        costPerCall: 0.01,
        responses: [],
      });

      expect(adapter.name).toBe('claude-vision');
      expect(adapter.tier).toBe('tier-3');
      expect(adapter.costPerCall).toBe(0.01);
    });

    it('should default costPerCall to 0', () => {
      const adapter = new StubExtractionAdapter({
        name: 'test',
        tier: 'tier-1',
        responses: [],
      });

      expect(adapter.costPerCall).toBe(0);
    });
  });
});

describe('Factory Functions', () => {
  const testBuffer = Buffer.from('test');
  const testContext: ExtractionContext = { documentId: 'test-1' };

  describe('createSuccessfulAdapter', () => {
    it('should create adapter with high confidence', async () => {
      const adapter = createSuccessfulAdapter('tier-1', 0.92);
      const result = await adapter.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.confidence).toBe(0.92);
      expect(result.tier).toBe('tier-1');
    });

    it('should include default certificate data', async () => {
      const adapter = createSuccessfulAdapter('tier-2', 0.85);
      const result = await adapter.extract(testBuffer, testContext);

      expect(result.data?.certificateType).toBe('GAS_SAFETY');
      expect(result.data?.certificateNumber).toBe('TEST-tier-2-001');
    });

    it('should merge custom data', async () => {
      const adapter = createSuccessfulAdapter('tier-1', 0.90, { 
        certificateNumber: 'CUSTOM-123',
        engineerName: 'John Smith',
      });
      const result = await adapter.extract(testBuffer, testContext);

      expect(result.data?.certificateNumber).toBe('CUSTOM-123');
      expect((result.data as any)?.engineerName).toBe('John Smith');
    });
  });

  describe('createFailingAdapter', () => {
    it('should throw default error', async () => {
      const adapter = createFailingAdapter('tier-2');
      await expect(adapter.extract(testBuffer, testContext))
        .rejects.toThrow('tier-2 extraction failed');
    });

    it('should throw custom error', async () => {
      const customError = new Error('API rate limit exceeded');
      const adapter = createFailingAdapter('tier-3', customError);
      await expect(adapter.extract(testBuffer, testContext))
        .rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('createLowConfidenceAdapter', () => {
    it('should create adapter with specified low confidence', async () => {
      const adapter = createLowConfidenceAdapter('tier-1', 0.55);
      const result = await adapter.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.confidence).toBe(0.55);
    });
  });

  describe('createCostlyAdapter', () => {
    it('should create adapter with specified cost', async () => {
      const adapter = createCostlyAdapter('tier-3', 0.88, 0.015);
      const result = await adapter.extract(testBuffer, testContext);

      expect(result.costIncurred).toBe(0.015);
      expect(adapter.costPerCall).toBe(0.015);
    });
  });

  describe('createUnavailableAdapter', () => {
    it('should create unavailable adapter', () => {
      const adapter = createUnavailableAdapter('tier-2');
      expect(adapter.isAvailable()).toBe(false);
    });
  });
});

describe('InMemoryTierAuditSink', () => {
  let auditSink: InMemoryTierAuditSink;

  beforeEach(() => {
    auditSink = new InMemoryTierAuditSink();
  });

  const createAuditEntry = (tier: string, confidence: number): TierAuditEntry => ({
    documentId: 'doc-1',
    tier: tier as any,
    provider: `stub-${tier}`,
    timestamp: new Date(),
    success: true,
    confidence,
    costIncurred: 0,
    escalationReason: null,
    durationMs: 10,
  });

  describe('recordAttempt', () => {
    it('should record audit entry', async () => {
      const entry = createAuditEntry('tier-1', 0.85);
      await auditSink.recordAttempt(entry);

      const log = auditSink.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].tier).toBe('tier-1');
    });

    it('should record multiple entries in order', async () => {
      await auditSink.recordAttempt(createAuditEntry('tier-1', 0.60));
      await auditSink.recordAttempt(createAuditEntry('tier-1.5', 0.75));
      await auditSink.recordAttempt(createAuditEntry('tier-2', 0.88));

      const log = auditSink.getAuditLog();
      expect(log).toHaveLength(3);
      expect(log[0].tier).toBe('tier-1');
      expect(log[1].tier).toBe('tier-1.5');
      expect(log[2].tier).toBe('tier-2');
    });
  });

  describe('getAuditLog', () => {
    it('should return empty array when no entries', () => {
      const log = auditSink.getAuditLog();
      expect(log).toEqual([]);
    });

    it('should return copy of entries (not reference)', async () => {
      await auditSink.recordAttempt(createAuditEntry('tier-1', 0.85));
      
      const log1 = auditSink.getAuditLog();
      const log2 = auditSink.getAuditLog();
      
      expect(log1).not.toBe(log2);
      expect(log1).toEqual(log2);
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await auditSink.recordAttempt(createAuditEntry('tier-1', 0.85));
      await auditSink.recordAttempt(createAuditEntry('tier-2', 0.90));
      
      auditSink.clear();
      
      expect(auditSink.getAuditLog()).toHaveLength(0);
    });
  });
});

describe('Adapter Scenario Tests', () => {
  const testBuffer = Buffer.from('test document');
  const testContext: ExtractionContext = { documentId: 'scenario-test-1' };

  describe('Template → Claude Fallback Scenario', () => {
    it('should simulate escalation from template to Claude', async () => {
      const templateAdapter = createLowConfidenceAdapter('tier-1', 0.65);
      const claudeAdapter = createSuccessfulAdapter('tier-1.5', 0.92);

      const templateResult = await templateAdapter.extract(testBuffer, testContext);
      expect(templateResult.confidence).toBeLessThan(0.85);

      const claudeResult = await claudeAdapter.extract(testBuffer, testContext);
      expect(claudeResult.confidence).toBeGreaterThanOrEqual(0.85);
      expect(claudeResult.success).toBe(true);
    });
  });

  describe('Claude Vision → Azure DI Fallback Scenario', () => {
    it('should simulate escalation on Claude error', async () => {
      const claudeAdapter = createFailingAdapter('tier-3', new Error('Claude timeout'));
      const azureAdapter = createSuccessfulAdapter('tier-2', 0.88);

      await expect(claudeAdapter.extract(testBuffer, testContext)).rejects.toThrow();
      
      const azureResult = await azureAdapter.extract(testBuffer, testContext);
      expect(azureResult.success).toBe(true);
    });
  });

  describe('Cost Tracking Scenario', () => {
    it('should track costs across multiple adapters', async () => {
      const adapters = [
        createCostlyAdapter('tier-1.5', 0.70, 0.003),
        createCostlyAdapter('tier-2', 0.75, 0.0015),
        createCostlyAdapter('tier-3', 0.90, 0.01),
      ];

      let totalCost = 0;
      for (const adapter of adapters) {
        const result = await adapter.extract(testBuffer, testContext);
        totalCost += result.costIncurred;
        
        if (result.confidence >= 0.85) {
          break;
        }
      }

      expect(totalCost).toBeCloseTo(0.003 + 0.0015 + 0.01, 10);
    });
  });

  describe('Audit Trail Recording', () => {
    it('should record complete audit trail', async () => {
      const auditSink = new InMemoryTierAuditSink();
      const adapters = [
        createLowConfidenceAdapter('tier-1', 0.60),
        createLowConfidenceAdapter('tier-1.5', 0.70),
        createSuccessfulAdapter('tier-2', 0.90),
      ];

      for (const adapter of adapters) {
        const startTime = Date.now();
        const result = await adapter.extract(testBuffer, testContext);
        
        await auditSink.recordAttempt({
          documentId: testContext.documentId,
          tier: adapter.tier,
          provider: adapter.name,
          timestamp: new Date(),
          success: result.success,
          confidence: result.confidence,
          costIncurred: result.costIncurred,
          escalationReason: result.confidence < 0.85 ? 'Low confidence' : null,
          durationMs: Date.now() - startTime,
        });

        if (result.confidence >= 0.85) {
          break;
        }
      }

      const log = auditSink.getAuditLog();
      expect(log).toHaveLength(3);
      expect(log[0].escalationReason).toBe('Low confidence');
      expect(log[1].escalationReason).toBe('Low confidence');
      expect(log[2].escalationReason).toBeNull();
    });
  });
});
