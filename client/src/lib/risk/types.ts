export type ComplianceStream = 'gas' | 'electrical' | 'fire' | 'asbestos' | 'lift' | 'water';

export interface StreamScore {
  stream: ComplianceStream;
  compliance: number;
  total: number;
  compliant: number;
  overdueCount: number;
  dueSoonCount: number;
}

export interface DefectCounts {
  critical: number;
  major: number;
  minor: number;
}

export interface RiskScore {
  compositeScore: number;
  streams: StreamScore[];
  defects: DefectCounts;
  trend: 'improving' | 'stable' | 'deteriorating';
  propertyCount: number;
  unitCount: number;
  previousScore?: number;
  calculatedAt?: string;
}

export interface RiskFilters {
  level: 'property' | 'estate' | 'ward';
  streams: ComplianceStream[] | 'all';
  period: 'current' | '3m' | '6m' | '12m';
  maxScore?: number;
  showOnlyAtRisk?: boolean;
}

export interface AreaRisk {
  id: string;
  name: string;
  level: 'property' | 'estate' | 'ward';
  lat: number;
  lng: number;
  riskScore: RiskScore;
}

export type ScenarioType = 
  | 'advisory_as_failure'
  | 'certificate_slip'
  | 'dual_failure'
  | 'capacity_reduction'
  | 'hrb_only';

export interface Scenario {
  type: ScenarioType;
  enabled: boolean;
  params: {
    slipPercentage?: number;
    capacityReduction?: number;
  };
  impact?: {
    additionalPropertiesAtRisk: number;
    scoreChange: number;
  };
}

export interface ScenarioResult {
  baseline: {
    score: number;
    propertiesAtRisk: number;
  };
  scenario: {
    score: number;
    propertiesAtRisk: number;
  };
  impact: {
    scoreChange: number;
    additionalAtRisk: number;
    newHotspots: Array<{
      id: string;
      name: string;
      baselineScore: number;
      scenarioScore: number;
    }>;
  };
  affectedAreas: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    baselineScore: number;
    scenarioScore: number;
  }>;
}

export interface EvidenceData {
  area: {
    id: string;
    name: string;
    level: 'property' | 'estate' | 'ward';
  };
  summary: {
    compliance: number;
    openHighSeverity: number;
    avgFindingAge: number;
    hrbCount: number;
    blockCount: number;
    unitCount: number;
  };
  streams: StreamScore[];
  findings: Array<{
    id: string;
    ref: string;
    type: string;
    severity: 'critical' | 'major' | 'minor';
    propertyName: string;
    age: number;
    dueIn: number;
    certificateId: string;
  }>;
  certificateLinks: Array<{
    id: string;
    type: string;
    status: string;
    url: string;
  }>;
}
