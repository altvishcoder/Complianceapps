export type AwaabsLawPhase = 'phase1' | 'phase2' | 'phase3';

export interface AwaabsPhaseConfig {
  id: AwaabsLawPhase;
  name: string;
  description: string;
  status: 'active' | 'preview' | 'future';
  effectiveDate: string;
  certificateTypes: string[];
  classificationCodes: string[];
  hazardCategories: string[];
}

export const AWAABS_LAW_PHASES: AwaabsPhaseConfig[] = [
  {
    id: 'phase1',
    name: 'Phase 1',
    description: 'Damp & Mould',
    status: 'active',
    effectiveDate: '2025-10-27',
    certificateTypes: ['DAMP_MOULD_SURVEY', 'DAMP_SURVEY', 'MOULD_INSPECTION', 'CONDENSATION_REPORT'],
    classificationCodes: ['DAMP_MODERATE', 'DAMP_SEVERE', 'DAMP_CRITICAL', 'MOULD_PRESENT', 'MOULD_SEVERE'],
    hazardCategories: ['Damp and mould growth'],
  },
  {
    id: 'phase2',
    name: 'Phase 2',
    description: 'Fire, Electrical, Falls & Temperature',
    status: 'preview',
    effectiveDate: '2026-01-01',
    certificateTypes: ['EICR', 'FIRE_RISK_ASSESSMENT', 'EMERGENCY_LIGHTING', 'FIRE_ALARM', 'PAT'],
    classificationCodes: ['C1', 'C2', 'C3', 'FI', 'UNSATISFACTORY', 'HIGH_RISK', 'SIGNIFICANT_RISK'],
    hazardCategories: [
      'Excess cold',
      'Excess heat', 
      'Falls on stairs',
      'Falls on level surfaces',
      'Falls between levels',
      'Falls associated with baths',
      'Fire',
      'Electrical hazards',
      'Structural collapse',
      'Explosions',
    ],
  },
  {
    id: 'phase3',
    name: 'Phase 3',
    description: 'All HHSRS Hazards',
    status: 'future',
    effectiveDate: '2027-01-01',
    certificateTypes: ['GAS_SAFETY', 'LEGIONELLA_ASSESSMENT', 'ASBESTOS_SURVEY', 'LIFT_LOLER', 'EPC'],
    classificationCodes: ['AT_RISK', 'ID', 'IMMEDIATELY_DANGEROUS', 'NCS', 'UNSATISFACTORY'],
    hazardCategories: [
      'Crowding and space',
      'Entry by intruders',
      'Lighting',
      'Noise',
      'Domestic hygiene',
      'Food safety',
      'Personal hygiene',
      'Water supply',
      'Carbon monoxide',
      'Lead',
      'Radiation',
      'Uncombusted fuel gas',
      'Volatile organic compounds',
      'Biocides',
      'Asbestos',
      'Collision and entrapment',
      'Position of amenities',
      'Ergonomics',
    ],
  },
];

export function getPhaseByStatus(status: 'active' | 'preview' | 'future'): AwaabsPhaseConfig[] {
  return AWAABS_LAW_PHASES.filter(p => p.status === status);
}

export function getPhaseById(phaseId: AwaabsLawPhase): AwaabsPhaseConfig | undefined {
  return AWAABS_LAW_PHASES.find(p => p.id === phaseId);
}

export function getCertificateTypesForPhase(phaseId: AwaabsLawPhase): string[] {
  const phase = getPhaseById(phaseId);
  return phase?.certificateTypes || [];
}

export function getClassificationCodesForPhase(phaseId: AwaabsLawPhase): string[] {
  const phase = getPhaseById(phaseId);
  return phase?.classificationCodes || [];
}

export function getAllActivePhaseFilters(): { certificateTypes: string[]; classificationCodes: string[] } {
  const activePhases = AWAABS_LAW_PHASES.filter(p => p.status === 'active');
  return {
    certificateTypes: activePhases.flatMap(p => p.certificateTypes),
    classificationCodes: activePhases.flatMap(p => p.classificationCodes),
  };
}

export function getPhaseStatusLabel(status: 'active' | 'preview' | 'future'): string {
  switch (status) {
    case 'active': return 'Active';
    case 'preview': return 'Preview (2026)';
    case 'future': return 'Future (2027)';
  }
}

export function getPhaseStatusBadgeVariant(status: 'active' | 'preview' | 'future'): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'active': return 'default';
    case 'preview': return 'secondary';
    case 'future': return 'outline';
  }
}
