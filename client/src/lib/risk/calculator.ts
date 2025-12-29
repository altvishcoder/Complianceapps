import type { ComplianceStream, StreamScore, DefectCounts, RiskScore } from './types';

export const STREAM_WEIGHTS: Record<ComplianceStream, number> = {
  gas: 0.25,
  electrical: 0.20,
  fire: 0.25,
  asbestos: 0.15,
  lift: 0.10,
  water: 0.05,
};

export const DEFECT_PENALTIES = {
  critical: 15,
  major: 5,
  minor: 1,
};

export function calculateCompositeScore(streams: StreamScore[], defects: DefectCounts): number {
  if (streams.length === 0) return 100;
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const stream of streams) {
    const weight = STREAM_WEIGHTS[stream.stream] || 0.1;
    weightedSum += stream.compliance * weight;
    totalWeight += weight;
  }
  
  const baseScore = totalWeight > 0 ? weightedSum / totalWeight * 100 : 100;
  
  const penalty = 
    (defects.critical * DEFECT_PENALTIES.critical) +
    (defects.major * DEFECT_PENALTIES.major) +
    (defects.minor * DEFECT_PENALTIES.minor);
  
  return Math.max(0, Math.min(100, Math.round(baseScore - penalty)));
}

export function calculateStreamCompliance(compliant: number, total: number): number {
  if (total === 0) return 1;
  return compliant / total;
}

export function determineTrend(currentScore: number, previousScore: number | null | undefined): 'improving' | 'stable' | 'deteriorating' {
  if (previousScore === null || previousScore === undefined) return 'stable';
  
  const diff = currentScore - previousScore;
  
  if (diff > 2) return 'improving';
  if (diff < -2) return 'deteriorating';
  return 'stable';
}

export function mapDefectCodeToSeverity(code: string, stream: ComplianceStream): 'critical' | 'major' | 'minor' {
  const upperCode = code.toUpperCase();
  
  if (stream === 'gas') {
    if (upperCode === 'ID' || upperCode === 'IMMEDIATELY DANGEROUS') return 'critical';
    if (upperCode === 'AR' || upperCode === 'AT RISK') return 'major';
    if (upperCode === 'NCS' || upperCode === 'NOT TO CURRENT STANDARDS') return 'minor';
  }
  
  if (stream === 'electrical') {
    if (upperCode === 'C1' || upperCode === 'CODE 1') return 'critical';
    if (upperCode === 'C2' || upperCode === 'CODE 2') return 'major';
    if (upperCode === 'C3' || upperCode === 'FI' || upperCode === 'FURTHER INVESTIGATION') return 'minor';
  }
  
  if (stream === 'fire') {
    if (upperCode === 'INTOLERABLE' || upperCode === 'HIGH') return 'critical';
    if (upperCode === 'SUBSTANTIAL' || upperCode === 'MEDIUM') return 'major';
    if (upperCode === 'TOLERABLE' || upperCode === 'LOW' || upperCode === 'ADVISORY') return 'minor';
  }
  
  if (upperCode.includes('CRITICAL') || upperCode.includes('URGENT')) return 'critical';
  if (upperCode.includes('MAJOR') || upperCode.includes('SIGNIFICANT')) return 'major';
  
  return 'minor';
}

export function aggregateRiskScores(scores: RiskScore[]): RiskScore {
  if (scores.length === 0) {
    return {
      compositeScore: 100,
      streams: [],
      defects: { critical: 0, major: 0, minor: 0 },
      trend: 'stable',
      propertyCount: 0,
      unitCount: 0,
    };
  }
  
  const totalPropertyCount = scores.reduce((sum, s) => sum + s.propertyCount, 0);
  const totalUnitCount = scores.reduce((sum, s) => sum + s.unitCount, 0);
  
  const totalDefects: DefectCounts = {
    critical: scores.reduce((sum, s) => sum + s.defects.critical, 0),
    major: scores.reduce((sum, s) => sum + s.defects.major, 0),
    minor: scores.reduce((sum, s) => sum + s.defects.minor, 0),
  };
  
  const streamMap = new Map<ComplianceStream, { total: number; compliant: number; overdue: number; dueSoon: number }>();
  
  for (const score of scores) {
    for (const stream of score.streams) {
      const existing = streamMap.get(stream.stream) || { total: 0, compliant: 0, overdue: 0, dueSoon: 0 };
      existing.total += stream.total;
      existing.compliant += stream.compliant;
      existing.overdue += stream.overdueCount;
      existing.dueSoon += stream.dueSoonCount;
      streamMap.set(stream.stream, existing);
    }
  }
  
  const aggregatedStreams: StreamScore[] = Array.from(streamMap.entries()).map(([stream, data]) => ({
    stream,
    compliance: calculateStreamCompliance(data.compliant, data.total),
    total: data.total,
    compliant: data.compliant,
    overdueCount: data.overdue,
    dueSoonCount: data.dueSoon,
  }));
  
  const compositeScore = calculateCompositeScore(aggregatedStreams, totalDefects);
  
  let improving = 0;
  let deteriorating = 0;
  for (const score of scores) {
    if (score.trend === 'improving') improving++;
    if (score.trend === 'deteriorating') deteriorating++;
  }
  
  let trend: 'improving' | 'stable' | 'deteriorating' = 'stable';
  if (improving > deteriorating * 2) trend = 'improving';
  if (deteriorating > improving * 2) trend = 'deteriorating';
  
  return {
    compositeScore,
    streams: aggregatedStreams,
    defects: totalDefects,
    trend,
    propertyCount: totalPropertyCount,
    unitCount: totalUnitCount,
  };
}
