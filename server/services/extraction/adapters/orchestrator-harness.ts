import type { ExtractionTier } from '../types';
import { 
  InMemoryTierAuditSink,
  type ExtractionAdapter, 
  type ExtractionResult, 
  type ExtractionContext,
  type TierAuditSink,
  type TierAuditEntry,
} from './types';
import { 
  determineNextAction, 
  getAvailableTiers,
  InMemoryCostTracker,
  TIER_ORDER,
  DEFAULT_CONFIG,
  type OrchestratorConfig,
  type CostTracker,
} from '../decisions';

export interface OrchestratorResult {
  success: boolean;
  aborted: boolean;
  reason: string | null;
  finalTier: ExtractionTier | null;
  bestResult: ExtractionResult | null;
  attempts: TierAuditEntry[];
  totalCost: number;
  totalProcessingTimeMs: number;
}

export interface OrchestratorDependencies {
  adapters: Map<ExtractionTier, ExtractionAdapter>;
  config: OrchestratorConfig;
  costTracker: CostTracker;
  auditSink: TierAuditSink;
}

export class TestableOrchestrator {
  private adapters: Map<ExtractionTier, ExtractionAdapter>;
  private config: OrchestratorConfig;
  private costTracker: CostTracker;
  private auditSink: TierAuditSink;

  constructor(deps: OrchestratorDependencies) {
    this.adapters = deps.adapters;
    this.config = deps.config;
    this.costTracker = deps.costTracker;
    this.auditSink = deps.auditSink;
  }

  async extract(
    document: Buffer, 
    context: ExtractionContext,
    documentType?: string
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const availableTiers = this.getAvailableTiers();
    
    if (availableTiers.length === 0) {
      return {
        success: false,
        aborted: true,
        reason: 'No adapters available',
        finalTier: null,
        bestResult: null,
        attempts: [],
        totalCost: 0,
        totalProcessingTimeMs: Date.now() - startTime,
      };
    }

    let currentTierIndex = 0;
    let bestResult: ExtractionResult | null = null;
    const attempts: TierAuditEntry[] = [];

    while (currentTierIndex < availableTiers.length) {
      const currentTier = availableTiers[currentTierIndex];
      const adapter = this.adapters.get(currentTier);
      
      if (!adapter || !adapter.isAvailable()) {
        currentTierIndex++;
        continue;
      }

      const tierStartTime = Date.now();
      let result: ExtractionResult | null = null;
      let error: Error | null = null;

      try {
        result = await adapter.extract(document, context);
        this.costTracker.recordCost(result.costIncurred, adapter.name);
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
      }

      const auditEntry: TierAuditEntry = {
        documentId: context.documentId,
        tier: currentTier,
        provider: adapter.name,
        timestamp: new Date(),
        success: result?.success ?? false,
        confidence: result?.confidence ?? null,
        costIncurred: result?.costIncurred ?? 0,
        escalationReason: null,
        durationMs: Date.now() - tierStartTime,
      };

      const decision = determineNextAction(
        result ? { success: result.success, confidence: result.confidence, costIncurred: result.costIncurred } : null,
        error,
        this.config,
        this.costTracker,
        currentTier,
        availableTiers,
        documentType
      );

      if (decision.action === 'escalate') {
        auditEntry.escalationReason = decision.reason;
        if (result) {
          bestResult = result;
        }
        const nextTierIndex = availableTiers.indexOf(decision.nextTier);
        currentTierIndex = nextTierIndex >= 0 ? nextTierIndex : availableTiers.length;
      } else if (decision.action === 'complete') {
        if (result) {
          bestResult = result;
        }
        await this.auditSink.recordAttempt(auditEntry);
        attempts.push(auditEntry);
        
        return {
          success: bestResult?.success ?? false,
          aborted: false,
          reason: decision.reason,
          finalTier: currentTier,
          bestResult,
          attempts,
          totalCost: this.costTracker.getTotalCost(),
          totalProcessingTimeMs: Date.now() - startTime,
        };
      } else if (decision.action === 'abort') {
        auditEntry.escalationReason = decision.reason;
        await this.auditSink.recordAttempt(auditEntry);
        attempts.push(auditEntry);
        
        return {
          success: false,
          aborted: true,
          reason: decision.reason,
          finalTier: currentTier,
          bestResult,
          attempts,
          totalCost: this.costTracker.getTotalCost(),
          totalProcessingTimeMs: Date.now() - startTime,
        };
      }

      await this.auditSink.recordAttempt(auditEntry);
      attempts.push(auditEntry);
    }

    return {
      success: bestResult?.success ?? false,
      aborted: false,
      reason: 'All tiers exhausted',
      finalTier: availableTiers[availableTiers.length - 1] ?? null,
      bestResult,
      attempts,
      totalCost: this.costTracker.getTotalCost(),
      totalProcessingTimeMs: Date.now() - startTime,
    };
  }

  private getAvailableTiers(): ExtractionTier[] {
    const configuredTiers = getAvailableTiers(this.config);
    return configuredTiers
      .filter(tier => this.adapters.has(tier))
      .sort((a, b) => TIER_ORDER[a] - TIER_ORDER[b]);
  }

  getTotalCost(): number {
    return this.costTracker.getTotalCost();
  }

  getAuditLog(): TierAuditEntry[] {
    return this.auditSink.getAuditLog();
  }
}

export function createTestOrchestrator(
  adapters: Array<ExtractionAdapter>,
  configOverrides: Partial<OrchestratorConfig> = {}
): { orchestrator: TestableOrchestrator; costTracker: InMemoryCostTracker; auditSink: InMemoryTierAuditSink } {
  const adapterMap = new Map<ExtractionTier, ExtractionAdapter>();
  for (const adapter of adapters) {
    adapterMap.set(adapter.tier, adapter);
  }

  const costTracker = new InMemoryCostTracker();
  const auditSink = new InMemoryTierAuditSink();
  const config = { ...DEFAULT_CONFIG, ...configOverrides };

  const orchestrator = new TestableOrchestrator({
    adapters: adapterMap,
    config,
    costTracker,
    auditSink,
  });

  return { orchestrator, costTracker, auditSink };
}
