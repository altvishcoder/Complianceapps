import { db } from '../db';
import { 
  properties, 
  certificates, 
  remedialActions, 
  blocks,
  schemes,
  propertyRiskSnapshots,
  riskFactorDefinitions,
  riskAlerts,
  complianceStreams
} from '@shared/schema';
import { eq, and, lt, gt, gte, lte, isNull, sql, desc, inArray, count, or } from 'drizzle-orm';
import { logger } from '../logger';

export type RiskTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface RiskFactorWeights {
  expiry: number;
  defect: number;
  assetProfile: number;
  coverageGap: number;
  externalFactor: number;
}

export interface PropertyRiskData {
  propertyId: string;
  organisationId: string;
  overallScore: number;
  riskTier: RiskTier;
  expiryRiskScore: number;
  defectRiskScore: number;
  assetProfileRiskScore: number;
  coverageGapRiskScore: number;
  externalFactorRiskScore: number;
  factorBreakdown: {
    expiringCertificates: number;
    overdueCertificates: number;
    openDefects: number;
    criticalDefects: number;
    missingStreams: string[];
    assetAge: number | null;
    isHRB: boolean;
    hasVulnerableOccupants: boolean;
    epcRating: string | null;
  };
  triggeringFactors: string[];
  recommendedActions: string[];
  legislationReferences: string[];
}

const DEFAULT_WEIGHTS: RiskFactorWeights = {
  expiry: 30,
  defect: 25,
  assetProfile: 20,
  coverageGap: 15,
  externalFactor: 10,
};

const TIER_THRESHOLDS = {
  CRITICAL: 45,
  HIGH: 35,
  MEDIUM: 20,
};

export function calculateRiskTier(score: number): RiskTier {
  if (score >= TIER_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (score >= TIER_THRESHOLDS.HIGH) return 'HIGH';
  if (score >= TIER_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

export async function calculateExpiryRiskScore(propertyId: string): Promise<{
  score: number;
  expiringCount: number;
  overdueCount: number;
  factors: string[];
  legislation: string[];
}> {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const certs = await db.select({
    id: certificates.id,
    certificateType: certificates.certificateType,
    expiryDate: certificates.expiryDate,
    outcome: certificates.outcome,
  })
  .from(certificates)
  .where(eq(certificates.propertyId, propertyId));

  let overdueCount = 0;
  let expiringWithin7Days = 0;
  let expiringWithin30Days = 0;
  const factors: string[] = [];
  const legislation: string[] = [];

  for (const cert of certs) {
    if (!cert.expiryDate) continue;
    
    const expiryDate = new Date(cert.expiryDate);
    
    if (expiryDate < now) {
      overdueCount++;
      factors.push(`${cert.certificateType} certificate overdue`);
      
      if (cert.certificateType === 'GAS_SAFETY') {
        legislation.push('Gas Safety (Installation and Use) Regulations 1998 - Reg 36');
      } else if (cert.certificateType === 'EICR') {
        legislation.push('Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020');
      }
    } else if (expiryDate <= sevenDaysFromNow) {
      expiringWithin7Days++;
      factors.push(`${cert.certificateType} expires within 7 days`);
    } else if (expiryDate <= thirtyDaysFromNow) {
      expiringWithin30Days++;
      factors.push(`${cert.certificateType} expires within 30 days`);
    }
  }

  let score = 0;
  score += overdueCount * 30;
  score += expiringWithin7Days * 20;
  score += expiringWithin30Days * 10;
  
  score = Math.min(100, score);

  return {
    score,
    expiringCount: expiringWithin7Days + expiringWithin30Days,
    overdueCount,
    factors,
    legislation: Array.from(new Set(legislation)),
  };
}

export async function calculateDefectRiskScore(propertyId: string): Promise<{
  score: number;
  openDefects: number;
  criticalDefects: number;
  factors: string[];
  legislation: string[];
}> {
  const actions = await db.select({
    id: remedialActions.id,
    severity: remedialActions.severity,
    status: remedialActions.status,
    description: remedialActions.description,
  })
  .from(remedialActions)
  .where(and(
    eq(remedialActions.propertyId, propertyId),
    or(
      eq(remedialActions.status, 'OPEN'),
      eq(remedialActions.status, 'IN_PROGRESS'),
      eq(remedialActions.status, 'SCHEDULED')
    )
  ));

  let criticalCount = 0;
  let urgentCount = 0;
  let routineCount = 0;
  const factors: string[] = [];
  const legislation: string[] = [];

  for (const action of actions) {
    switch (action.severity) {
      case 'IMMEDIATE':
        criticalCount++;
        factors.push(`Immediate defect: ${action.description?.substring(0, 50) || 'Unspecified'}`);
        break;
      case 'URGENT':
      case 'PRIORITY':
        urgentCount++;
        factors.push(`Urgent defect requiring attention`);
        break;
      case 'ROUTINE':
      case 'ADVISORY':
        routineCount++;
        break;
    }
  }

  if (criticalCount > 0) {
    legislation.push('Housing Act 2004 - Category 1 Hazard');
  }

  let score = 0;
  score += criticalCount * 35;
  score += urgentCount * 15;
  score += routineCount * 5;
  
  score = Math.min(100, score);

  return {
    score,
    openDefects: actions.length,
    criticalDefects: criticalCount,
    factors,
    legislation,
  };
}

export async function calculateAssetProfileRiskScore(propertyId: string): Promise<{
  score: number;
  assetAge: number | null;
  isHRB: boolean;
  hasVulnerableOccupants: boolean;
  factors: string[];
  legislation: string[];
}> {
  const property = await db.select({
    constructionYear: properties.constructionYear,
    numberOfFloors: properties.numberOfFloors,
    vulnerableOccupant: properties.vulnerableOccupant,
    hasAsbestos: properties.hasAsbestos,
    hasSprinklers: properties.hasSprinklers,
    blockId: properties.blockId,
  })
  .from(properties)
  .where(eq(properties.id, propertyId))
  .limit(1);

  if (property.length === 0) {
    return { score: 0, assetAge: null, isHRB: false, hasVulnerableOccupants: false, factors: [], legislation: [] };
  }

  const prop = property[0];
  const factors: string[] = [];
  const legislation: string[] = [];
  let score = 0;

  const currentYear = new Date().getFullYear();
  const assetAge = prop.constructionYear ? currentYear - prop.constructionYear : null;

  if (assetAge && assetAge > 50) {
    score += 20;
    factors.push(`Building age: ${assetAge} years (pre-1974)`);
  } else if (assetAge && assetAge > 30) {
    score += 10;
    factors.push(`Building age: ${assetAge} years`);
  }

  const isHRB = (prop.numberOfFloors || 1) >= 7;
  if (isHRB) {
    score += 25;
    factors.push('High-Rise Building (7+ floors) - Building Safety Act applies');
    legislation.push('Building Safety Act 2022');
  }

  if (prop.vulnerableOccupant) {
    score += 20;
    factors.push('Vulnerable occupants present - enhanced duty of care');
    legislation.push('Equality Act 2010', 'Care Act 2014');
  }

  if (prop.hasAsbestos) {
    score += 15;
    factors.push('Asbestos containing materials present');
    legislation.push('Control of Asbestos Regulations 2012');
  }

  if (!prop.hasSprinklers && isHRB) {
    score += 10;
    factors.push('No sprinkler system in high-rise building');
  }

  score = Math.min(100, score);

  return {
    score,
    assetAge,
    isHRB,
    hasVulnerableOccupants: prop.vulnerableOccupant,
    factors,
    legislation: Array.from(new Set(legislation)),
  };
}

export async function calculateCoverageGapRiskScore(propertyId: string): Promise<{
  score: number;
  missingStreams: string[];
  factors: string[];
  legislation: string[];
}> {
  const property = await db.select({
    hasGas: properties.hasGas,
    hasElectricity: properties.hasElectricity,
    hasAsbestos: properties.hasAsbestos,
    numberOfFloors: properties.numberOfFloors,
  })
  .from(properties)
  .where(eq(properties.id, propertyId))
  .limit(1);

  if (property.length === 0) {
    return { score: 0, missingStreams: [], factors: [], legislation: [] };
  }

  const prop = property[0];

  const existingCerts = await db.select({
    certificateType: certificates.certificateType,
  })
  .from(certificates)
  .where(eq(certificates.propertyId, propertyId));

  const existingTypes = new Set(existingCerts.map(c => c.certificateType));

  const missingStreams: string[] = [];
  const factors: string[] = [];
  const legislation: string[] = [];
  let score = 0;

  if (prop.hasGas && !existingTypes.has('GAS_SAFETY')) {
    missingStreams.push('Gas Safety');
    factors.push('Missing Gas Safety Certificate (CP12/LGSR)');
    legislation.push('Gas Safety (Installation and Use) Regulations 1998');
    score += 30;
  }

  if (prop.hasElectricity && !existingTypes.has('EICR')) {
    missingStreams.push('Electrical');
    factors.push('Missing EICR Certificate');
    legislation.push('Electrical Safety Standards Regulations 2020');
    score += 25;
  }

  if (!existingTypes.has('EPC')) {
    missingStreams.push('Energy');
    factors.push('Missing Energy Performance Certificate');
    legislation.push('Energy Performance of Buildings Regulations 2012');
    score += 15;
  }

  const isHRB = (prop.numberOfFloors || 1) >= 7;
  if (isHRB && !existingTypes.has('FIRE_RISK_ASSESSMENT')) {
    missingStreams.push('Fire Safety');
    factors.push('Missing Fire Risk Assessment for HRB');
    legislation.push('Regulatory Reform (Fire Safety) Order 2005', 'Building Safety Act 2022');
    score += 30;
  } else if (!existingTypes.has('FIRE_RISK_ASSESSMENT')) {
    score += 10;
  }

  score = Math.min(100, score);

  return {
    score,
    missingStreams,
    factors,
    legislation: Array.from(new Set(legislation)),
  };
}

export async function calculateExternalFactorRiskScore(propertyId: string): Promise<{
  score: number;
  epcRating: string | null;
  factors: string[];
  legislation: string[];
}> {
  const property = await db.select({
    epcRating: properties.epcRating,
    localAuthority: properties.localAuthority,
  })
  .from(properties)
  .where(eq(properties.id, propertyId))
  .limit(1);

  if (property.length === 0) {
    return { score: 0, epcRating: null, factors: [], legislation: [] };
  }

  const prop = property[0];
  const factors: string[] = [];
  const legislation: string[] = [];
  let score = 0;

  const epcScores: Record<string, number> = {
    'G': 40,
    'F': 35,
    'E': 10,
    'D': 5,
    'C': 0,
    'B': 0,
    'A': 0,
  };

  if (prop.epcRating) {
    const epcScore = epcScores[prop.epcRating.toUpperCase()] || 0;
    score += epcScore;
    
    if (prop.epcRating.toUpperCase() === 'F' || prop.epcRating.toUpperCase() === 'G') {
      factors.push(`EPC Rating ${prop.epcRating} - Below MEES threshold`);
      legislation.push('Minimum Energy Efficiency Standards Regulations 2015');
    } else if (prop.epcRating.toUpperCase() === 'E') {
      factors.push(`EPC Rating ${prop.epcRating} - At MEES threshold`);
    }
  }

  score = Math.min(100, score);

  return {
    score,
    epcRating: prop.epcRating,
    factors,
    legislation,
  };
}

export async function calculatePropertyRiskScore(
  propertyId: string,
  organisationId: string,
  weights: RiskFactorWeights = DEFAULT_WEIGHTS
): Promise<PropertyRiskData> {
  const [expiry, defect, assetProfile, coverageGap, externalFactor] = await Promise.all([
    calculateExpiryRiskScore(propertyId),
    calculateDefectRiskScore(propertyId),
    calculateAssetProfileRiskScore(propertyId),
    calculateCoverageGapRiskScore(propertyId),
    calculateExternalFactorRiskScore(propertyId),
  ]);

  const totalWeight = weights.expiry + weights.defect + weights.assetProfile + weights.coverageGap + weights.externalFactor;
  
  const overallScore = Math.round(
    (expiry.score * weights.expiry +
     defect.score * weights.defect +
     assetProfile.score * weights.assetProfile +
     coverageGap.score * weights.coverageGap +
     externalFactor.score * weights.externalFactor) / totalWeight
  );

  const riskTier = calculateRiskTier(overallScore);

  const allFactors = [
    ...expiry.factors,
    ...defect.factors,
    ...assetProfile.factors,
    ...coverageGap.factors,
    ...externalFactor.factors,
  ];

  const allLegislation = Array.from(new Set([
    ...expiry.legislation,
    ...defect.legislation,
    ...assetProfile.legislation,
    ...coverageGap.legislation,
    ...externalFactor.legislation,
  ]));

  const recommendedActions = generateRecommendedActions(riskTier, {
    expiryFactors: expiry.factors,
    defectFactors: defect.factors,
    coverageGapFactors: coverageGap.factors,
    assetProfileFactors: assetProfile.factors,
  });

  return {
    propertyId,
    organisationId,
    overallScore,
    riskTier,
    expiryRiskScore: expiry.score,
    defectRiskScore: defect.score,
    assetProfileRiskScore: assetProfile.score,
    coverageGapRiskScore: coverageGap.score,
    externalFactorRiskScore: externalFactor.score,
    factorBreakdown: {
      expiringCertificates: expiry.expiringCount,
      overdueCertificates: expiry.overdueCount,
      openDefects: defect.openDefects,
      criticalDefects: defect.criticalDefects,
      missingStreams: coverageGap.missingStreams,
      assetAge: assetProfile.assetAge,
      isHRB: assetProfile.isHRB,
      hasVulnerableOccupants: assetProfile.hasVulnerableOccupants,
      epcRating: externalFactor.epcRating,
    },
    triggeringFactors: allFactors,
    recommendedActions,
    legislationReferences: allLegislation,
  };
}

function generateRecommendedActions(
  tier: RiskTier,
  factors: {
    expiryFactors: string[];
    defectFactors: string[];
    coverageGapFactors: string[];
    assetProfileFactors: string[];
  }
): string[] {
  const actions: string[] = [];

  if (factors.expiryFactors.some(f => f.includes('overdue'))) {
    actions.push('URGENT: Schedule immediate inspection for overdue certificates');
  }
  if (factors.expiryFactors.some(f => f.includes('7 days'))) {
    actions.push('Schedule renewal for certificates expiring within 7 days');
  }

  if (factors.defectFactors.some(f => f.includes('Critical'))) {
    actions.push('URGENT: Address critical defects immediately');
  }

  if (factors.coverageGapFactors.length > 0) {
    actions.push('Arrange missing compliance certificates');
  }

  if (factors.assetProfileFactors.some(f => f.includes('High-Rise'))) {
    actions.push('Review Building Safety Case for HRB compliance');
  }

  if (factors.assetProfileFactors.some(f => f.includes('Vulnerable'))) {
    actions.push('Review Personal Emergency Evacuation Plans (PEEPs)');
  }

  return actions;
}

export async function saveRiskSnapshot(riskData: PropertyRiskData): Promise<string> {
  await db.update(propertyRiskSnapshots)
    .set({ isLatest: false })
    .where(and(
      eq(propertyRiskSnapshots.propertyId, riskData.propertyId),
      eq(propertyRiskSnapshots.isLatest, true)
    ));

  const previousSnapshot = await db.select({
    overallScore: propertyRiskSnapshots.overallScore,
  })
  .from(propertyRiskSnapshots)
  .where(eq(propertyRiskSnapshots.propertyId, riskData.propertyId))
  .orderBy(desc(propertyRiskSnapshots.createdAt))
  .limit(1);

  const previousScore = previousSnapshot.length > 0 ? previousSnapshot[0].overallScore : null;
  const scoreChange = previousScore !== null ? riskData.overallScore - previousScore : null;
  const trendDirection = scoreChange === null ? null : scoreChange > 0 ? 'INCREASING' : scoreChange < 0 ? 'DECREASING' : 'STABLE';

  const [snapshot] = await db.insert(propertyRiskSnapshots).values({
    organisationId: riskData.organisationId,
    propertyId: riskData.propertyId,
    overallScore: riskData.overallScore,
    riskTier: riskData.riskTier,
    expiryRiskScore: riskData.expiryRiskScore,
    defectRiskScore: riskData.defectRiskScore,
    assetProfileRiskScore: riskData.assetProfileRiskScore,
    coverageGapRiskScore: riskData.coverageGapRiskScore,
    externalFactorRiskScore: riskData.externalFactorRiskScore,
    factorBreakdown: riskData.factorBreakdown,
    triggeringFactors: riskData.triggeringFactors,
    recommendedActions: riskData.recommendedActions,
    legislationReferences: riskData.legislationReferences,
    previousScore,
    scoreChange,
    trendDirection,
    isLatest: true,
  }).returning({ id: propertyRiskSnapshots.id });

  logger.info({
    propertyId: riskData.propertyId,
    overallScore: riskData.overallScore,
    riskTier: riskData.riskTier,
    previousScore,
    scoreChange,
  }, 'Risk snapshot saved');

  return snapshot.id;
}

export async function createRiskAlert(
  riskData: PropertyRiskData,
  snapshotId: string
): Promise<string | null> {
  if (riskData.riskTier === 'LOW') {
    return null;
  }

  const existingAlert = await db.select({ id: riskAlerts.id })
    .from(riskAlerts)
    .where(and(
      eq(riskAlerts.propertyId, riskData.propertyId),
      eq(riskAlerts.status, 'OPEN')
    ))
    .limit(1);

  if (existingAlert.length > 0) {
    await db.update(riskAlerts)
      .set({
        riskScore: riskData.overallScore,
        riskTier: riskData.riskTier,
        triggeringFactors: riskData.triggeringFactors,
        updatedAt: new Date(),
      })
      .where(eq(riskAlerts.id, existingAlert[0].id));
    return existingAlert[0].id;
  }

  const slaHours = riskData.riskTier === 'CRITICAL' ? 24 : riskData.riskTier === 'HIGH' ? 72 : 168;
  const dueDate = new Date(Date.now() + slaHours * 60 * 60 * 1000);

  const [alert] = await db.insert(riskAlerts).values({
    organisationId: riskData.organisationId,
    propertyId: riskData.propertyId,
    snapshotId,
    alertType: `${riskData.riskTier}_RISK`,
    riskTier: riskData.riskTier,
    title: `${riskData.riskTier} Risk Alert - Immediate Action Required`,
    description: riskData.triggeringFactors.slice(0, 3).join('; ') || 'Multiple risk factors detected',
    triggeringFactors: riskData.triggeringFactors,
    riskScore: riskData.overallScore,
    dueDate,
    slaHours,
  }).returning({ id: riskAlerts.id });

  logger.info({
    alertId: alert.id,
    propertyId: riskData.propertyId,
    riskTier: riskData.riskTier,
    slaHours,
  }, 'Risk alert created');

  return alert.id;
}

export async function calculateAllPropertyRisks(organisationId: string): Promise<{
  processed: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}> {
  const orgProperties = await db.select({
    id: properties.id,
    blockId: properties.blockId,
  })
  .from(properties)
  .innerJoin(blocks, eq(properties.blockId, blocks.id))
  .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
  .where(eq(schemes.organisationId, organisationId));

  const stats = { processed: 0, critical: 0, high: 0, medium: 0, low: 0 };

  for (const prop of orgProperties) {
    try {
      const riskData = await calculatePropertyRiskScore(prop.id, organisationId);
      const snapshotId = await saveRiskSnapshot(riskData);
      await createRiskAlert(riskData, snapshotId);

      stats.processed++;
      switch (riskData.riskTier) {
        case 'CRITICAL': stats.critical++; break;
        case 'HIGH': stats.high++; break;
        case 'MEDIUM': stats.medium++; break;
        case 'LOW': stats.low++; break;
      }
    } catch (error) {
      logger.error({ propertyId: prop.id, error }, 'Failed to calculate risk score');
    }
  }

  logger.info({ organisationId, ...stats }, 'Batch risk calculation complete');

  return stats;
}

export async function getPortfolioRiskSummary(organisationId: string): Promise<{
  totalProperties: number;
  distribution: { tier: RiskTier; count: number; percentage: number }[];
  averageScore: number;
  criticalAlerts: number;
  trendsUp: number;
  trendsDown: number;
}> {
  const snapshots = await db.select({
    riskTier: propertyRiskSnapshots.riskTier,
    overallScore: propertyRiskSnapshots.overallScore,
    trendDirection: propertyRiskSnapshots.trendDirection,
  })
  .from(propertyRiskSnapshots)
  .where(and(
    eq(propertyRiskSnapshots.organisationId, organisationId),
    eq(propertyRiskSnapshots.isLatest, true)
  ));

  const alerts = await db.select({ count: count() })
    .from(riskAlerts)
    .where(and(
      eq(riskAlerts.organisationId, organisationId),
      eq(riskAlerts.status, 'OPEN'),
      eq(riskAlerts.riskTier, 'CRITICAL')
    ));

  const totalProperties = snapshots.length;
  const tierCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  let totalScore = 0;
  let trendsUp = 0;
  let trendsDown = 0;

  for (const snap of snapshots) {
    tierCounts[snap.riskTier as RiskTier]++;
    totalScore += snap.overallScore;
    if (snap.trendDirection === 'INCREASING') trendsUp++;
    if (snap.trendDirection === 'DECREASING') trendsDown++;
  }

  return {
    totalProperties,
    distribution: [
      { tier: 'CRITICAL', count: tierCounts.CRITICAL, percentage: totalProperties > 0 ? Math.round((tierCounts.CRITICAL / totalProperties) * 100) : 0 },
      { tier: 'HIGH', count: tierCounts.HIGH, percentage: totalProperties > 0 ? Math.round((tierCounts.HIGH / totalProperties) * 100) : 0 },
      { tier: 'MEDIUM', count: tierCounts.MEDIUM, percentage: totalProperties > 0 ? Math.round((tierCounts.MEDIUM / totalProperties) * 100) : 0 },
      { tier: 'LOW', count: tierCounts.LOW, percentage: totalProperties > 0 ? Math.round((tierCounts.LOW / totalProperties) * 100) : 0 },
    ],
    averageScore: totalProperties > 0 ? Math.round(totalScore / totalProperties) : 0,
    criticalAlerts: alerts[0]?.count || 0,
    trendsUp,
    trendsDown,
  };
}
