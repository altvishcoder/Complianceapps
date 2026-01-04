import type { ExtractionTier, TierStatus } from './types';

export interface OrchestratorConfig {
  minimumAcceptableConfidence: number;
  highConfidenceThreshold: number;
  maxCostPerDocument: number;
  enabledTiers: ExtractionTier[];
  abortOnCostExceeded: boolean;
  documentTypeThresholds: Record<string, number>;
}

export const DEFAULT_CONFIG: OrchestratorConfig = {
  minimumAcceptableConfidence: 0.85,
  highConfidenceThreshold: 0.95,
  maxCostPerDocument: 0.05,
  enabledTiers: ['tier-0', 'tier-0.5', 'tier-1', 'tier-1.5', 'tier-2', 'tier-3', 'tier-4'],
  abortOnCostExceeded: true,
  documentTypeThresholds: {
    'FRA': 0.70,
    'FIRE_RISK_ASSESSMENT': 0.70,
    'BSC': 0.70,
    'BUILDING_SAFETY': 0.70,
    'ASB': 0.75,
    'ASBESTOS': 0.75,
  },
};

export const TIER_ORDER: Record<ExtractionTier, number> = {
  'tier-0': 0,
  'tier-0.5': 1,
  'tier-1': 2,
  'tier-1.5': 3,
  'tier-2': 4,
  'tier-3': 5,
  'tier-4': 6,
};

export const TIER_COST_ESTIMATES: Record<ExtractionTier, number> = {
  'tier-0': 0,
  'tier-0.5': 0,
  'tier-1': 0,
  'tier-1.5': 0.003,
  'tier-2': 0.0015,
  'tier-3': 0.01,
  'tier-4': 0,
};

export interface CostTracker {
  recordCost(amount: number, provider: string): void;
  getTotalCost(): number;
  getCostByProvider(): Record<string, number>;
  isWithinBudget(additionalCost: number, maxCost: number): boolean;
  reset(): void;
}

export class InMemoryCostTracker implements CostTracker {
  private totalCost = 0;
  private costByProvider: Record<string, number> = {};

  recordCost(amount: number, provider: string): void {
    this.totalCost += amount;
    this.costByProvider[provider] = (this.costByProvider[provider] ?? 0) + amount;
  }

  getTotalCost(): number {
    return this.totalCost;
  }

  getCostByProvider(): Record<string, number> {
    return { ...this.costByProvider };
  }

  isWithinBudget(additionalCost: number, maxCost: number): boolean {
    return (this.totalCost + additionalCost) <= maxCost;
  }

  reset(): void {
    this.totalCost = 0;
    this.costByProvider = {};
  }
}

export type OrchestratorDecision = 
  | { action: 'complete'; reason: string }
  | { action: 'escalate'; reason: string; nextTier: ExtractionTier }
  | { action: 'abort'; reason: string };

export interface TierResult {
  success: boolean;
  confidence: number;
  costIncurred: number;
}

export function findNextTier(
  currentTier: ExtractionTier, 
  availableTiers: ExtractionTier[]
): ExtractionTier | null {
  const sorted = [...availableTiers].sort((a, b) => TIER_ORDER[a] - TIER_ORDER[b]);
  const currentIndex = sorted.indexOf(currentTier);
  return sorted[currentIndex + 1] ?? null;
}

export function getThresholdForTier(
  tier: ExtractionTier,
  documentType: string | undefined,
  config: OrchestratorConfig
): number {
  if (documentType && config.documentTypeThresholds[documentType.toUpperCase()]) {
    return config.documentTypeThresholds[documentType.toUpperCase()];
  }
  
  switch (tier) {
    case 'tier-0':
    case 'tier-0.5':
      return config.highConfidenceThreshold;
    case 'tier-1':
    case 'tier-1.5':
    case 'tier-2':
      return config.minimumAcceptableConfidence;
    case 'tier-3':
      return 0.70;
    case 'tier-4':
      return 0;
    default:
      return config.minimumAcceptableConfidence;
  }
}

export function determineNextAction(
  currentResult: TierResult | null,
  error: Error | null,
  config: OrchestratorConfig,
  costTracker: CostTracker,
  currentTier: ExtractionTier,
  availableTiers: ExtractionTier[],
  documentType?: string
): OrchestratorDecision {
  if (error) {
    const nextTier = findNextTier(currentTier, availableTiers);
    if (!nextTier) {
      return { action: 'abort', reason: `All tiers exhausted after error: ${error.message}` };
    }
    return { action: 'escalate', reason: `Error in ${currentTier}: ${error.message}`, nextTier };
  }

  if (currentResult) {
    const threshold = getThresholdForTier(currentTier, documentType, config);
    
    if (currentResult.confidence >= threshold) {
      return { action: 'complete', reason: `Confidence ${currentResult.confidence.toFixed(2)} meets threshold ${threshold}` };
    }

    const nextTier = findNextTier(currentTier, availableTiers);
    if (!nextTier) {
      return { action: 'complete', reason: `All tiers exhausted, returning best effort with confidence ${currentResult.confidence.toFixed(2)}` };
    }

    const nextTierCost = TIER_COST_ESTIMATES[nextTier];
    if (!costTracker.isWithinBudget(nextTierCost, config.maxCostPerDocument)) {
      if (config.abortOnCostExceeded) {
        return { 
          action: 'abort', 
          reason: `Cost ceiling reached: ${costTracker.getTotalCost().toFixed(4)} + ${nextTierCost.toFixed(4)} exceeds ${config.maxCostPerDocument}` 
        };
      }
      return { 
        action: 'complete', 
        reason: `Cost limit reached, returning best effort with confidence ${currentResult.confidence.toFixed(2)}` 
      };
    }

    return { 
      action: 'escalate', 
      reason: `Confidence ${currentResult.confidence.toFixed(2)} below threshold ${threshold}`,
      nextTier 
    };
  }

  return { action: 'abort', reason: 'Unexpected state: no result and no error' };
}

export function shouldSkipAITiers(aiEnabled: boolean): ExtractionTier[] {
  if (!aiEnabled) {
    return ['tier-1.5', 'tier-2', 'tier-3'];
  }
  return [];
}

export function getAvailableTiers(
  config: OrchestratorConfig, 
  skipTiers: ExtractionTier[] = []
): ExtractionTier[] {
  return config.enabledTiers
    .filter(tier => !skipTiers.includes(tier))
    .sort((a, b) => TIER_ORDER[a] - TIER_ORDER[b]);
}

export function calculateTotalCostEstimate(tiers: ExtractionTier[]): number {
  return tiers.reduce((sum, tier) => sum + TIER_COST_ESTIMATES[tier], 0);
}

export function isAITier(tier: ExtractionTier): boolean {
  return tier === 'tier-1.5' || tier === 'tier-2' || tier === 'tier-3';
}

export function getTierStatus(decision: OrchestratorDecision): TierStatus {
  switch (decision.action) {
    case 'complete':
      return 'success';
    case 'escalate':
      return 'escalated';
    case 'abort':
      return 'failed';
    default:
      return 'failed';
  }
}
