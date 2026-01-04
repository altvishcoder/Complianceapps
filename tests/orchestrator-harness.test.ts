import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableOrchestrator,
  createTestOrchestrator,
  type OrchestratorDependencies,
} from '../server/services/extraction/adapters/orchestrator-harness';
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
} from '../server/services/extraction/adapters/types';
import {
  InMemoryCostTracker,
  DEFAULT_CONFIG,
  type OrchestratorConfig,
} from '../server/services/extraction/decisions';

describe('TestableOrchestrator', () => {
  const testBuffer = Buffer.from('test document content');
  const testContext: ExtractionContext = { documentId: 'test-doc-1' };

  describe('Happy Path Scenarios', () => {
    it('should complete at first tier when confidence meets threshold', async () => {
      const { orchestrator, auditSink } = createTestOrchestrator([
        createSuccessfulAdapter('tier-1', 0.92),
        createSuccessfulAdapter('tier-1.5', 0.95),
      ]);

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.aborted).toBe(false);
      expect(result.finalTier).toBe('tier-1');
      expect(result.bestResult?.confidence).toBe(0.92);
      expect(auditSink.getAuditLog()).toHaveLength(1);
    });

    it('should return high confidence result immediately', async () => {
      const { orchestrator } = createTestOrchestrator([
        createSuccessfulAdapter('tier-0.5', 0.98),
      ]);

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-0.5');
    });
  });

  describe('Tier Escalation Scenarios', () => {
    it('should escalate from template to Claude when confidence is low', async () => {
      const templateAdapter = createLowConfidenceAdapter('tier-1', 0.65);
      const claudeAdapter = createSuccessfulAdapter('tier-1.5', 0.92);

      const { orchestrator, auditSink } = createTestOrchestrator([
        templateAdapter,
        claudeAdapter,
      ]);

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-1.5');
      expect(result.bestResult?.confidence).toBe(0.92);
      
      const log = auditSink.getAuditLog();
      expect(log).toHaveLength(2);
      expect(log[0].tier).toBe('tier-1');
      expect(log[0].escalationReason).toContain('below threshold');
      expect(log[1].tier).toBe('tier-1.5');
    });

    it('should escalate through multiple tiers until success', async () => {
      const { orchestrator, auditSink } = createTestOrchestrator([
        createLowConfidenceAdapter('tier-1', 0.50),
        createLowConfidenceAdapter('tier-1.5', 0.65),
        createLowConfidenceAdapter('tier-2', 0.75),
        createSuccessfulAdapter('tier-3', 0.90),
      ]);

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-3');
      expect(auditSink.getAuditLog()).toHaveLength(4);
    });

    it('should escalate on error and recover at next tier', async () => {
      const { orchestrator, auditSink } = createTestOrchestrator([
        createFailingAdapter('tier-1', new Error('Template parsing failed')),
        createSuccessfulAdapter('tier-1.5', 0.88),
      ]);

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-1.5');
      
      const log = auditSink.getAuditLog();
      expect(log[0].escalationReason).toContain('Template parsing failed');
    });

    it('should skip unavailable adapters', async () => {
      const { orchestrator, auditSink } = createTestOrchestrator([
        createLowConfidenceAdapter('tier-1', 0.60),
        createUnavailableAdapter('tier-1.5'),
        createSuccessfulAdapter('tier-2', 0.90),
      ]);

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-2');
      expect(auditSink.getAuditLog()).toHaveLength(2);
    });
  });

  describe('Claude Vision → Azure DI Fallback', () => {
    it('should fall back to Azure when Claude Vision fails', async () => {
      const { orchestrator, auditSink } = createTestOrchestrator([
        createFailingAdapter('tier-3', new Error('Claude API timeout')),
        createSuccessfulAdapter('tier-4', 0.85),
      ], {
        enabledTiers: ['tier-3', 'tier-4'],
      });

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-4');
      
      const log = auditSink.getAuditLog();
      expect(log).toHaveLength(2);
      expect(log[0].tier).toBe('tier-3');
      expect(log[0].escalationReason).toContain('Claude API timeout');
    });

    it('should fall back to Azure when Claude confidence is low', async () => {
      const { orchestrator } = createTestOrchestrator([
        createLowConfidenceAdapter('tier-3', 0.55),
        createSuccessfulAdapter('tier-4', 0.88),
      ], {
        enabledTiers: ['tier-3', 'tier-4'],
      });

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-4');
    });
  });

  describe('Cost Ceiling Abort', () => {
    it('should abort when cost ceiling would be exceeded', async () => {
      const { orchestrator, costTracker, auditSink } = createTestOrchestrator([
        createCostlyAdapter('tier-1', 0.60, 0.048),
        createCostlyAdapter('tier-1.5', 0.70, 0.015),
      ], {
        maxCostPerDocument: 0.05,
        abortOnCostExceeded: true,
      });

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.aborted).toBe(true);
      expect(result.reason).toContain('Cost ceiling');
      expect(costTracker.getTotalCost()).toBe(0.048);
      
      const log = auditSink.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].escalationReason).toContain('Cost ceiling');
    });

    it('should complete with best effort when cost exceeded but abortOnCostExceeded is false', async () => {
      const { orchestrator } = createTestOrchestrator([
        createCostlyAdapter('tier-1', 0.60, 0.048),
        createCostlyAdapter('tier-1.5', 0.90, 0.015),
      ], {
        maxCostPerDocument: 0.05,
        abortOnCostExceeded: false,
      });

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.aborted).toBe(false);
      expect(result.success).toBe(true);
      expect(result.bestResult?.confidence).toBe(0.60);
      expect(result.reason).toContain('Cost limit reached');
    });

    it('should allow processing when within budget', async () => {
      const { orchestrator, costTracker } = createTestOrchestrator([
        createCostlyAdapter('tier-1', 0.60, 0.01),
        createCostlyAdapter('tier-1.5', 0.90, 0.01),
      ], {
        maxCostPerDocument: 0.05,
      });

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-1.5');
      expect(costTracker.getTotalCost()).toBeCloseTo(0.02, 10);
    });

    it('should track cumulative costs across tiers', async () => {
      const { orchestrator, costTracker } = createTestOrchestrator([
        createCostlyAdapter('tier-1', 0.50, 0.001),
        createCostlyAdapter('tier-1.5', 0.60, 0.003),
        createCostlyAdapter('tier-2', 0.70, 0.0015),
        createCostlyAdapter('tier-3', 0.90, 0.01),
      ], {
        maxCostPerDocument: 0.05,
      });

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(costTracker.getTotalCost()).toBeCloseTo(0.001 + 0.003 + 0.0015 + 0.01, 10);
    });
  });

  describe('Tier Audit Recording', () => {
    it('should record audit entry for each tier attempted', async () => {
      const { orchestrator, auditSink } = createTestOrchestrator([
        createLowConfidenceAdapter('tier-1', 0.50),
        createLowConfidenceAdapter('tier-1.5', 0.60),
        createSuccessfulAdapter('tier-2', 0.90),
      ]);

      await orchestrator.extract(testBuffer, testContext);

      const log = auditSink.getAuditLog();
      expect(log).toHaveLength(3);
      
      expect(log[0].tier).toBe('tier-1');
      expect(log[0].confidence).toBe(0.50);
      expect(log[0].escalationReason).toContain('below threshold');
      
      expect(log[1].tier).toBe('tier-1.5');
      expect(log[1].confidence).toBe(0.60);
      expect(log[1].escalationReason).toContain('below threshold');
      
      expect(log[2].tier).toBe('tier-2');
      expect(log[2].confidence).toBe(0.90);
      expect(log[2].escalationReason).toBeNull();
    });

    it('should record processing time for each tier', async () => {
      const { orchestrator, auditSink } = createTestOrchestrator([
        createSuccessfulAdapter('tier-1', 0.92),
      ]);

      await orchestrator.extract(testBuffer, testContext);

      const log = auditSink.getAuditLog();
      expect(log[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should record cost for each tier', async () => {
      const { orchestrator, auditSink } = createTestOrchestrator([
        createCostlyAdapter('tier-1', 0.60, 0.001),
        createCostlyAdapter('tier-1.5', 0.90, 0.003),
      ]);

      await orchestrator.extract(testBuffer, testContext);

      const log = auditSink.getAuditLog();
      expect(log[0].costIncurred).toBe(0.001);
      expect(log[1].costIncurred).toBe(0.003);
    });

    it('should record document ID in all audit entries', async () => {
      const context: ExtractionContext = { documentId: 'unique-doc-123' };
      const { orchestrator, auditSink } = createTestOrchestrator([
        createLowConfidenceAdapter('tier-1', 0.60),
        createSuccessfulAdapter('tier-1.5', 0.90),
      ]);

      await orchestrator.extract(testBuffer, context);

      const log = auditSink.getAuditLog();
      expect(log.every(entry => entry.documentId === 'unique-doc-123')).toBe(true);
    });
  });

  describe('Document Type Thresholds', () => {
    it('should use lower threshold for FRA documents', async () => {
      const { orchestrator } = createTestOrchestrator([
        createLowConfidenceAdapter('tier-1', 0.72),
        createSuccessfulAdapter('tier-1.5', 0.90),
      ]);

      const result = await orchestrator.extract(testBuffer, testContext, 'FRA');

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-1');
    });

    it('should still escalate FRA when below document-type threshold', async () => {
      const { orchestrator } = createTestOrchestrator([
        createLowConfidenceAdapter('tier-1', 0.65),
        createSuccessfulAdapter('tier-1.5', 0.90),
      ]);

      const result = await orchestrator.extract(testBuffer, testContext, 'FRA');

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-1.5');
    });

    it('should use standard threshold for unknown document types', async () => {
      const { orchestrator } = createTestOrchestrator([
        createLowConfidenceAdapter('tier-1', 0.80),
        createSuccessfulAdapter('tier-1.5', 0.90),
      ]);

      const result = await orchestrator.extract(testBuffer, testContext, 'UNKNOWN_TYPE');

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-1.5');
    });
  });

  describe('Tier Exhaustion', () => {
    it('should return best effort when all tiers exhausted with low confidence', async () => {
      const { orchestrator } = createTestOrchestrator([
        createLowConfidenceAdapter('tier-1', 0.50),
        createLowConfidenceAdapter('tier-1.5', 0.60),
      ], {
        enabledTiers: ['tier-1', 'tier-1.5'],
      });

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.bestResult?.confidence).toBe(0.60);
    });

    it('should abort when all tiers fail with errors', async () => {
      const { orchestrator } = createTestOrchestrator([
        createFailingAdapter('tier-1', new Error('Tier 1 failed')),
        createFailingAdapter('tier-1.5', new Error('Tier 1.5 failed')),
      ], {
        enabledTiers: ['tier-1', 'tier-1.5'],
      });

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.aborted).toBe(true);
      expect(result.reason).toContain('exhausted');
    });
  });

  describe('Edge Cases', () => {
    it('should handle no adapters available', async () => {
      const { orchestrator } = createTestOrchestrator([]);

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.aborted).toBe(true);
      expect(result.reason).toContain('No adapters available');
    });

    it('should handle all adapters unavailable', async () => {
      const { orchestrator } = createTestOrchestrator([
        createUnavailableAdapter('tier-1'),
        createUnavailableAdapter('tier-1.5'),
      ]);

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(false);
    });

    it('should handle single tier completing successfully', async () => {
      const { orchestrator } = createTestOrchestrator([
        createSuccessfulAdapter('tier-1', 0.95),
      ], {
        enabledTiers: ['tier-1'],
      });

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-1');
    });

    it('should track total processing time', async () => {
      const { orchestrator } = createTestOrchestrator([
        createSuccessfulAdapter('tier-1', 0.90),
      ]);

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle Gas Safety Certificate extraction path', async () => {
      const { orchestrator, auditSink } = createTestOrchestrator([
        createLowConfidenceAdapter('tier-0.5', 0.30),
        createSuccessfulAdapter('tier-1', 0.92, {
          certificateType: 'GAS_SAFETY',
          certificateNumber: 'GSR-2024-001',
          engineerName: 'John Smith',
        }),
      ]);

      const result = await orchestrator.extract(testBuffer, {
        documentId: 'gas-cert-1',
        certificateType: 'GAS_SAFETY',
      });

      expect(result.success).toBe(true);
      expect(result.bestResult?.data?.certificateNumber).toBe('GSR-2024-001');
    });

    it('should handle Fire Risk Assessment with complex extraction', async () => {
      const { orchestrator } = createTestOrchestrator([
        createLowConfidenceAdapter('tier-1', 0.55),
        createLowConfidenceAdapter('tier-1.5', 0.68),
        createSuccessfulAdapter('tier-3', 0.82, {
          certificateType: 'FIRE_RISK_ASSESSMENT',
          outcome: 'PASS',
        }),
      ]);

      const result = await orchestrator.extract(testBuffer, testContext, 'FRA');

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-3');
    });

    it('should handle scanned document requiring OCR', async () => {
      const { orchestrator } = createTestOrchestrator([
        createFailingAdapter('tier-1', new Error('No text layer detected')),
        createSuccessfulAdapter('tier-3', 0.88, {
          certificateType: 'EICR',
          certificateNumber: 'EICR-2024-001',
        }),
      ], {
        enabledTiers: ['tier-1', 'tier-3'],
      });

      const result = await orchestrator.extract(testBuffer, testContext);

      expect(result.success).toBe(true);
      expect(result.finalTier).toBe('tier-3');
    });
  });
});

describe('createTestOrchestrator Helper', () => {
  it('should create orchestrator with default config', () => {
    const { orchestrator, costTracker, auditSink } = createTestOrchestrator([
      createSuccessfulAdapter('tier-1', 0.90),
    ]);

    expect(orchestrator).toBeInstanceOf(TestableOrchestrator);
    expect(costTracker.getTotalCost()).toBe(0);
    expect(auditSink.getAuditLog()).toHaveLength(0);
  });

  it('should accept config overrides', async () => {
    const { orchestrator } = createTestOrchestrator([
      createLowConfidenceAdapter('tier-1', 0.80),
    ], {
      minimumAcceptableConfidence: 0.75,
    });

    const result = await orchestrator.extract(
      Buffer.from('test'),
      { documentId: 'test' }
    );

    expect(result.success).toBe(true);
    expect(result.finalTier).toBe('tier-1');
  });

  it('should map adapters by tier', async () => {
    const tier1Adapter = createSuccessfulAdapter('tier-1', 0.60);
    const tier2Adapter = createSuccessfulAdapter('tier-2', 0.90);
    
    const { orchestrator } = createTestOrchestrator([tier1Adapter, tier2Adapter]);

    const result = await orchestrator.extract(
      Buffer.from('test'),
      { documentId: 'test' }
    );

    expect(tier1Adapter.getCallCount()).toBe(1);
    expect(tier2Adapter.getCallCount()).toBe(1);
  });
});
