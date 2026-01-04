import { describe, it, expect, beforeEach } from 'vitest';
import {
  determineNextAction,
  findNextTier,
  getThresholdForTier,
  shouldSkipAITiers,
  getAvailableTiers,
  calculateTotalCostEstimate,
  isAITier,
  getTierStatus,
  InMemoryCostTracker,
  DEFAULT_CONFIG,
  TIER_ORDER,
  TIER_COST_ESTIMATES,
  type OrchestratorConfig,
  type TierResult,
  type CostTracker,
} from '../server/services/extraction/decisions';

describe('Pure Decision Functions', () => {
  describe('TIER_ORDER', () => {
    it('should have correct ordering from tier-0 to tier-4', () => {
      expect(TIER_ORDER['tier-0']).toBe(0);
      expect(TIER_ORDER['tier-0.5']).toBe(1);
      expect(TIER_ORDER['tier-1']).toBe(2);
      expect(TIER_ORDER['tier-1.5']).toBe(3);
      expect(TIER_ORDER['tier-2']).toBe(4);
      expect(TIER_ORDER['tier-3']).toBe(5);
      expect(TIER_ORDER['tier-4']).toBe(6);
    });

    it('should have tier-0 as lowest and tier-4 as highest', () => {
      expect(TIER_ORDER['tier-0']).toBeLessThan(TIER_ORDER['tier-4']);
    });
  });

  describe('TIER_COST_ESTIMATES', () => {
    it('should have zero cost for non-AI tiers', () => {
      expect(TIER_COST_ESTIMATES['tier-0']).toBe(0);
      expect(TIER_COST_ESTIMATES['tier-0.5']).toBe(0);
      expect(TIER_COST_ESTIMATES['tier-1']).toBe(0);
      expect(TIER_COST_ESTIMATES['tier-4']).toBe(0);
    });

    it('should have positive costs for AI tiers', () => {
      expect(TIER_COST_ESTIMATES['tier-1.5']).toBe(0.003);
      expect(TIER_COST_ESTIMATES['tier-2']).toBe(0.0015);
      expect(TIER_COST_ESTIMATES['tier-3']).toBe(0.01);
    });

    it('should have tier-3 as most expensive', () => {
      expect(TIER_COST_ESTIMATES['tier-3']).toBeGreaterThan(TIER_COST_ESTIMATES['tier-1.5']);
      expect(TIER_COST_ESTIMATES['tier-3']).toBeGreaterThan(TIER_COST_ESTIMATES['tier-2']);
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have sensible default thresholds', () => {
      expect(DEFAULT_CONFIG.minimumAcceptableConfidence).toBe(0.85);
      expect(DEFAULT_CONFIG.highConfidenceThreshold).toBe(0.95);
    });

    it('should have reasonable cost ceiling', () => {
      expect(DEFAULT_CONFIG.maxCostPerDocument).toBe(0.05);
    });

    it('should enable all tiers by default', () => {
      expect(DEFAULT_CONFIG.enabledTiers).toContain('tier-0');
      expect(DEFAULT_CONFIG.enabledTiers).toContain('tier-1');
      expect(DEFAULT_CONFIG.enabledTiers).toContain('tier-3');
      expect(DEFAULT_CONFIG.enabledTiers).toContain('tier-4');
    });

    it('should abort on cost exceeded by default', () => {
      expect(DEFAULT_CONFIG.abortOnCostExceeded).toBe(true);
    });

    it('should have lower thresholds for complex document types', () => {
      expect(DEFAULT_CONFIG.documentTypeThresholds['FRA']).toBe(0.70);
      expect(DEFAULT_CONFIG.documentTypeThresholds['ASB']).toBe(0.75);
    });
  });
});

describe('findNextTier', () => {
  const allTiers = DEFAULT_CONFIG.enabledTiers;

  it('should return tier-0.5 after tier-0', () => {
    expect(findNextTier('tier-0', allTiers)).toBe('tier-0.5');
  });

  it('should return tier-1 after tier-0.5', () => {
    expect(findNextTier('tier-0.5', allTiers)).toBe('tier-1');
  });

  it('should return tier-1.5 after tier-1', () => {
    expect(findNextTier('tier-1', allTiers)).toBe('tier-1.5');
  });

  it('should return tier-2 after tier-1.5', () => {
    expect(findNextTier('tier-1.5', allTiers)).toBe('tier-2');
  });

  it('should return tier-3 after tier-2', () => {
    expect(findNextTier('tier-2', allTiers)).toBe('tier-3');
  });

  it('should return tier-4 after tier-3', () => {
    expect(findNextTier('tier-3', allTiers)).toBe('tier-4');
  });

  it('should return null after tier-4 (last tier)', () => {
    expect(findNextTier('tier-4', allTiers)).toBeNull();
  });

  it('should skip unavailable tiers', () => {
    const limitedTiers: typeof allTiers = ['tier-0', 'tier-1', 'tier-3'];
    expect(findNextTier('tier-1', limitedTiers)).toBe('tier-3');
  });

  it('should return null when current tier is the only one', () => {
    expect(findNextTier('tier-1', ['tier-1'])).toBeNull();
  });
});

describe('getThresholdForTier', () => {
  it('should return high confidence threshold for tier-0', () => {
    expect(getThresholdForTier('tier-0', undefined, DEFAULT_CONFIG)).toBe(0.95);
  });

  it('should return high confidence threshold for tier-0.5', () => {
    expect(getThresholdForTier('tier-0.5', undefined, DEFAULT_CONFIG)).toBe(0.95);
  });

  it('should return minimum acceptable threshold for tier-1', () => {
    expect(getThresholdForTier('tier-1', undefined, DEFAULT_CONFIG)).toBe(0.85);
  });

  it('should return 0 for tier-4 (human review)', () => {
    expect(getThresholdForTier('tier-4', undefined, DEFAULT_CONFIG)).toBe(0);
  });

  it('should use document-type-specific threshold when available', () => {
    expect(getThresholdForTier('tier-1', 'FRA', DEFAULT_CONFIG)).toBe(0.70);
    expect(getThresholdForTier('tier-1', 'ASB', DEFAULT_CONFIG)).toBe(0.75);
  });

  it('should be case-insensitive for document types', () => {
    expect(getThresholdForTier('tier-1', 'fra', DEFAULT_CONFIG)).toBe(0.70);
    expect(getThresholdForTier('tier-1', 'Fra', DEFAULT_CONFIG)).toBe(0.70);
  });

  it('should fall back to default when document type not in config', () => {
    expect(getThresholdForTier('tier-1', 'UNKNOWN_TYPE', DEFAULT_CONFIG)).toBe(0.85);
  });
});

describe('InMemoryCostTracker', () => {
  let costTracker: InMemoryCostTracker;

  beforeEach(() => {
    costTracker = new InMemoryCostTracker();
  });

  describe('recordCost', () => {
    it('should track total cost', () => {
      costTracker.recordCost(0.003, 'claude-text');
      expect(costTracker.getTotalCost()).toBe(0.003);
    });

    it('should accumulate costs from multiple providers', () => {
      costTracker.recordCost(0.003, 'claude-text');
      costTracker.recordCost(0.01, 'claude-vision');
      expect(costTracker.getTotalCost()).toBeCloseTo(0.013, 10);
    });

    it('should track costs by provider', () => {
      costTracker.recordCost(0.003, 'claude-text');
      costTracker.recordCost(0.002, 'claude-text');
      costTracker.recordCost(0.01, 'claude-vision');
      
      const byProvider = costTracker.getCostByProvider();
      expect(byProvider['claude-text']).toBe(0.005);
      expect(byProvider['claude-vision']).toBe(0.01);
    });
  });

  describe('isWithinBudget', () => {
    it('should return true when within budget', () => {
      expect(costTracker.isWithinBudget(0.01, 0.05)).toBe(true);
    });

    it('should return true when exactly at budget', () => {
      costTracker.recordCost(0.04, 'test');
      expect(costTracker.isWithinBudget(0.01, 0.05)).toBe(true);
    });

    it('should return false when would exceed budget', () => {
      costTracker.recordCost(0.04, 'test');
      expect(costTracker.isWithinBudget(0.02, 0.05)).toBe(false);
    });

    it('should return false when already over budget', () => {
      costTracker.recordCost(0.06, 'test');
      expect(costTracker.isWithinBudget(0.01, 0.05)).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear total cost', () => {
      costTracker.recordCost(0.01, 'test');
      costTracker.reset();
      expect(costTracker.getTotalCost()).toBe(0);
    });

    it('should clear costs by provider', () => {
      costTracker.recordCost(0.01, 'test');
      costTracker.reset();
      expect(costTracker.getCostByProvider()).toEqual({});
    });
  });
});

describe('determineNextAction', () => {
  let costTracker: InMemoryCostTracker;
  const allTiers = DEFAULT_CONFIG.enabledTiers;

  beforeEach(() => {
    costTracker = new InMemoryCostTracker();
  });

  describe('Error Handling', () => {
    it('should escalate on error when next tier available', () => {
      const error = new Error('API timeout');
      const decision = determineNextAction(
        null,
        error,
        DEFAULT_CONFIG,
        costTracker,
        'tier-1',
        allTiers
      );

      expect(decision.action).toBe('escalate');
      if (decision.action === 'escalate') {
        expect(decision.nextTier).toBe('tier-1.5');
        expect(decision.reason).toContain('API timeout');
      }
    });

    it('should abort on error when no more tiers available', () => {
      const error = new Error('Final tier failed');
      const decision = determineNextAction(
        null,
        error,
        DEFAULT_CONFIG,
        costTracker,
        'tier-4',
        allTiers
      );

      expect(decision.action).toBe('abort');
      expect(decision.reason).toContain('All tiers exhausted');
    });
  });

  describe('Confidence-based Completion', () => {
    it('should complete when confidence meets threshold', () => {
      const result: TierResult = { success: true, confidence: 0.90, costIncurred: 0 };
      const decision = determineNextAction(
        result,
        null,
        DEFAULT_CONFIG,
        costTracker,
        'tier-1',
        allTiers
      );

      expect(decision.action).toBe('complete');
      expect(decision.reason).toContain('meets threshold');
    });

    it('should complete when confidence exactly equals threshold', () => {
      const result: TierResult = { success: true, confidence: 0.85, costIncurred: 0 };
      const decision = determineNextAction(
        result,
        null,
        DEFAULT_CONFIG,
        costTracker,
        'tier-1',
        allTiers
      );

      expect(decision.action).toBe('complete');
    });

    it('should escalate when confidence below threshold', () => {
      const result: TierResult = { success: true, confidence: 0.70, costIncurred: 0 };
      const decision = determineNextAction(
        result,
        null,
        DEFAULT_CONFIG,
        costTracker,
        'tier-1',
        allTiers
      );

      expect(decision.action).toBe('escalate');
      if (decision.action === 'escalate') {
        expect(decision.nextTier).toBe('tier-1.5');
        expect(decision.reason).toContain('below threshold');
      }
    });
  });

  describe('Document Type Thresholds', () => {
    it('should use lower threshold for FRA documents', () => {
      const result: TierResult = { success: true, confidence: 0.72, costIncurred: 0 };
      const decision = determineNextAction(
        result,
        null,
        DEFAULT_CONFIG,
        costTracker,
        'tier-1',
        allTiers,
        'FRA'
      );

      expect(decision.action).toBe('complete');
    });

    it('should still escalate FRA when below document-type threshold', () => {
      const result: TierResult = { success: true, confidence: 0.65, costIncurred: 0 };
      const decision = determineNextAction(
        result,
        null,
        DEFAULT_CONFIG,
        costTracker,
        'tier-1',
        allTiers,
        'FRA'
      );

      expect(decision.action).toBe('escalate');
    });
  });

  describe('Cost Ceiling', () => {
    it('should abort when cost ceiling would be exceeded', () => {
      costTracker.recordCost(0.048, 'previous-tier');
      const result: TierResult = { success: true, confidence: 0.70, costIncurred: 0 };
      
      const decision = determineNextAction(
        result,
        null,
        DEFAULT_CONFIG,
        costTracker,
        'tier-1',
        allTiers
      );

      expect(decision.action).toBe('abort');
      expect(decision.reason).toContain('Cost ceiling');
    });

    it('should complete with best effort when cost exceeded and abortOnCostExceeded is false', () => {
      costTracker.recordCost(0.048, 'previous-tier');
      const result: TierResult = { success: true, confidence: 0.70, costIncurred: 0 };
      const config = { ...DEFAULT_CONFIG, abortOnCostExceeded: false };
      
      const decision = determineNextAction(
        result,
        null,
        config,
        costTracker,
        'tier-1',
        allTiers
      );

      expect(decision.action).toBe('complete');
      expect(decision.reason).toContain('Cost limit reached');
    });

    it('should allow escalation when within budget', () => {
      costTracker.recordCost(0.01, 'previous-tier');
      const result: TierResult = { success: true, confidence: 0.70, costIncurred: 0 };
      
      const decision = determineNextAction(
        result,
        null,
        DEFAULT_CONFIG,
        costTracker,
        'tier-1',
        allTiers
      );

      expect(decision.action).toBe('escalate');
    });
  });

  describe('Tier Exhaustion', () => {
    it('should complete at tier-4 since threshold is 0', () => {
      const result: TierResult = { success: true, confidence: 0.50, costIncurred: 0 };
      const decision = determineNextAction(
        result,
        null,
        DEFAULT_CONFIG,
        costTracker,
        'tier-4',
        allTiers
      );

      expect(decision.action).toBe('complete');
      expect(decision.reason).toContain('meets threshold');
    });

    it('should complete with best effort when at last enabled tier with low confidence', () => {
      const result: TierResult = { success: true, confidence: 0.50, costIncurred: 0 };
      const limitedTiers: typeof allTiers = ['tier-0', 'tier-1', 'tier-2'];
      const decision = determineNextAction(
        result,
        null,
        DEFAULT_CONFIG,
        costTracker,
        'tier-2',
        limitedTiers
      );

      expect(decision.action).toBe('complete');
      expect(decision.reason).toContain('All tiers exhausted');
    });
  });

  describe('Edge Cases', () => {
    it('should abort when no result and no error', () => {
      const decision = determineNextAction(
        null,
        null,
        DEFAULT_CONFIG,
        costTracker,
        'tier-1',
        allTiers
      );

      expect(decision.action).toBe('abort');
      expect(decision.reason).toContain('Unexpected state');
    });
  });
});

describe('shouldSkipAITiers', () => {
  it('should return AI tiers when AI is disabled', () => {
    const skipped = shouldSkipAITiers(false);
    expect(skipped).toContain('tier-1.5');
    expect(skipped).toContain('tier-2');
    expect(skipped).toContain('tier-3');
  });

  it('should return empty array when AI is enabled', () => {
    const skipped = shouldSkipAITiers(true);
    expect(skipped).toHaveLength(0);
  });
});

describe('getAvailableTiers', () => {
  it('should return all enabled tiers when no skip list', () => {
    const available = getAvailableTiers(DEFAULT_CONFIG);
    expect(available).toHaveLength(7);
  });

  it('should filter out skipped tiers', () => {
    const available = getAvailableTiers(DEFAULT_CONFIG, ['tier-1.5', 'tier-2', 'tier-3']);
    expect(available).not.toContain('tier-1.5');
    expect(available).not.toContain('tier-2');
    expect(available).not.toContain('tier-3');
    expect(available).toContain('tier-0');
    expect(available).toContain('tier-1');
    expect(available).toContain('tier-4');
  });

  it('should return tiers in correct order', () => {
    const available = getAvailableTiers(DEFAULT_CONFIG);
    expect(available[0]).toBe('tier-0');
    expect(available[available.length - 1]).toBe('tier-4');
  });
});

describe('calculateTotalCostEstimate', () => {
  it('should return 0 for non-AI tiers only', () => {
    const cost = calculateTotalCostEstimate(['tier-0', 'tier-0.5', 'tier-1', 'tier-4']);
    expect(cost).toBe(0);
  });

  it('should sum costs for AI tiers', () => {
    const cost = calculateTotalCostEstimate(['tier-1.5', 'tier-2', 'tier-3']);
    expect(cost).toBe(0.003 + 0.0015 + 0.01);
  });

  it('should return 0 for empty tier list', () => {
    const cost = calculateTotalCostEstimate([]);
    expect(cost).toBe(0);
  });
});

describe('isAITier', () => {
  it('should return true for tier-1.5', () => {
    expect(isAITier('tier-1.5')).toBe(true);
  });

  it('should return true for tier-2', () => {
    expect(isAITier('tier-2')).toBe(true);
  });

  it('should return true for tier-3', () => {
    expect(isAITier('tier-3')).toBe(true);
  });

  it('should return false for non-AI tiers', () => {
    expect(isAITier('tier-0')).toBe(false);
    expect(isAITier('tier-0.5')).toBe(false);
    expect(isAITier('tier-1')).toBe(false);
    expect(isAITier('tier-4')).toBe(false);
  });
});

describe('getTierStatus', () => {
  it('should return success for complete action', () => {
    expect(getTierStatus({ action: 'complete', reason: 'test' })).toBe('success');
  });

  it('should return escalated for escalate action', () => {
    expect(getTierStatus({ action: 'escalate', reason: 'test', nextTier: 'tier-2' })).toBe('escalated');
  });

  it('should return failed for abort action', () => {
    expect(getTierStatus({ action: 'abort', reason: 'test' })).toBe('failed');
  });
});

describe('Escalation Scenarios (Integration)', () => {
  let costTracker: InMemoryCostTracker;

  beforeEach(() => {
    costTracker = new InMemoryCostTracker();
  });

  it('should simulate template → Claude fallback', () => {
    const templateResult: TierResult = { success: true, confidence: 0.65, costIncurred: 0 };
    const allTiers = DEFAULT_CONFIG.enabledTiers;
    
    const decision = determineNextAction(
      templateResult,
      null,
      DEFAULT_CONFIG,
      costTracker,
      'tier-1',
      allTiers
    );

    expect(decision.action).toBe('escalate');
    if (decision.action === 'escalate') {
      expect(decision.nextTier).toBe('tier-1.5');
    }
  });

  it('should simulate Claude Vision → Azure escalation on error', () => {
    const error = new Error('Claude API rate limit exceeded');
    const allTiers = DEFAULT_CONFIG.enabledTiers;
    
    const decision = determineNextAction(
      null,
      error,
      DEFAULT_CONFIG,
      costTracker,
      'tier-3',
      allTiers
    );

    expect(decision.action).toBe('escalate');
    if (decision.action === 'escalate') {
      expect(decision.nextTier).toBe('tier-4');
    }
  });

  it('should simulate full escalation chain with cost tracking', () => {
    const allTiers = DEFAULT_CONFIG.enabledTiers;
    const config = { ...DEFAULT_CONFIG, maxCostPerDocument: 0.004 };
    
    const tier1Result: TierResult = { success: true, confidence: 0.60, costIncurred: 0 };
    let decision = determineNextAction(tier1Result, null, config, costTracker, 'tier-1', allTiers);
    expect(decision.action).toBe('escalate');
    if (decision.action === 'escalate') {
      expect(decision.nextTier).toBe('tier-1.5');
    }

    costTracker.recordCost(0.003, 'tier-1.5');
    const tier15Result: TierResult = { success: true, confidence: 0.65, costIncurred: 0.003 };
    decision = determineNextAction(tier15Result, null, config, costTracker, 'tier-1.5', allTiers);
    expect(decision.action).toBe('abort');
    expect(decision.reason).toContain('Cost ceiling');
  });
});
