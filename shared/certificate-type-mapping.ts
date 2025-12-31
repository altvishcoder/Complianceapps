export type CertificateTypeCode = 
  | 'GAS' | 'GAS_SVC' | 'OIL' | 'LPG' | 'SOLID' | 'ASHP' | 'GSHP' | 'BIO' | 'HVAC' | 'MECH'
  | 'EICR' | 'ELEC' | 'EIC' | 'PAT' | 'EMLT' | 'EMLT_M' | 'MEIWC'
  | 'EPC' | 'SAP' | 'DEC' | 'MEES' | 'RET'
  | 'FRA' | 'FRAEW' | 'FIRE_ALARM' | 'FIRE_EXT' | 'FIRE_DOOR' | 'FD_Q' | 'SMOKE_CO' | 'AOV' | 'SPRINKLER' | 'DRY_RISER' | 'WET_RISER'
  | 'LEG_RA' | 'LEG_MONITOR' | 'WATER_TANK' | 'TMV' | 'SHOWER'
  | 'ASB_SURVEY' | 'ASB_MGMT' | 'ASB_REFURB' | 'ASBESTOS'
  | 'LOLER' | 'LIFT' | 'STAIR_LIFT' | 'HOIST' | 'PLATFORM' | 'SFE' | 'SCAFFOLD'
  | 'PLAY' | 'GYM' | 'TREE' | 'FENCE' | 'PAVING'
  | 'CCTV' | 'ACCESS_CTRL' | 'INTRUDER' | 'WARDEN'
  | 'FORM_A' | 'FORM_B' | 'EWS1' | 'BSR_REG' | 'RESIDENT' | 'GOLDEN_THREAD' | 'SAFETY_CASE'
  | 'HHSRS' | 'DS' | 'HS'
  | 'MOBILITY' | 'SENSORY' | 'GRAB'
  | 'PEST' | 'BIRDNET' | 'CARCASS'
  | 'WASTE' | 'BULKY' | 'RECYCLING'
  | 'COMMUNAL' | 'SIGNAGE' | 'ESC_ROUTE' | 'BALCONY' | 'ROOF_ACCESS'
  | 'OTHER' | 'UNKNOWN' | 'FIRE_RISK';

// Map certificate type code to compliance stream code
export function getStreamCodeForCertType(certType: CertificateTypeCode): string {
  const mapping: Record<string, string> = {
    'GAS': 'GAS_HEATING', 'GAS_SVC': 'GAS_HEATING', 'OIL': 'GAS_HEATING', 
    'LPG': 'GAS_HEATING', 'SOLID': 'GAS_HEATING', 'ASHP': 'GAS_HEATING', 
    'GSHP': 'GAS_HEATING', 'BIO': 'GAS_HEATING', 'HVAC': 'GAS_HEATING', 'MECH': 'GAS_HEATING',
    'EICR': 'ELECTRICAL', 'ELEC': 'ELECTRICAL', 'EIC': 'ELECTRICAL', 
    'PAT': 'ELECTRICAL', 'EMLT': 'ELECTRICAL', 'EMLT_M': 'ELECTRICAL', 'MEIWC': 'ELECTRICAL',
    'EPC': 'ENERGY', 'SAP': 'ENERGY', 'DEC': 'ENERGY', 'MEES': 'ENERGY', 'RET': 'ENERGY',
    'FRA': 'FIRE_SAFETY', 'FRAEW': 'FIRE_SAFETY', 'FIRE_ALARM': 'FIRE_SAFETY', 
    'FIRE_EXT': 'FIRE_SAFETY', 'FIRE_DOOR': 'FIRE_SAFETY', 'FD_Q': 'FIRE_SAFETY',
    'SMOKE_CO': 'FIRE_SAFETY', 'AOV': 'FIRE_SAFETY', 'SPRINKLER': 'FIRE_SAFETY',
    'DRY_RISER': 'FIRE_SAFETY', 'WET_RISER': 'FIRE_SAFETY', 'FIRE_RISK': 'FIRE_SAFETY',
    'LEG_RA': 'WATER_SAFETY', 'LEG_MONITOR': 'WATER_SAFETY', 
    'WATER_TANK': 'WATER_SAFETY', 'TMV': 'WATER_SAFETY', 'SHOWER': 'WATER_SAFETY',
    'ASB_SURVEY': 'ASBESTOS', 'ASB_MGMT': 'ASBESTOS', 'ASB_REFURB': 'ASBESTOS', 'ASBESTOS': 'ASBESTOS',
    'LOLER': 'LIFTING', 'LIFT': 'LIFTING', 'STAIR_LIFT': 'LIFTING', 
    'HOIST': 'LIFTING', 'PLATFORM': 'LIFTING', 'SFE': 'LIFTING', 'SCAFFOLD': 'LIFTING',
    'PLAY': 'EXTERNAL', 'GYM': 'EXTERNAL', 'TREE': 'EXTERNAL', 'FENCE': 'EXTERNAL', 'PAVING': 'EXTERNAL',
    'CCTV': 'SECURITY', 'ACCESS_CTRL': 'SECURITY', 'INTRUDER': 'SECURITY', 'WARDEN': 'SECURITY',
    'FORM_A': 'HRB_SPECIFIC', 'FORM_B': 'HRB_SPECIFIC', 'EWS1': 'HRB_SPECIFIC', 
    'BSR_REG': 'BUILDING_SAFETY', 'HHSRS': 'BUILDING_SAFETY', 'DS': 'BUILDING_SAFETY', 'HS': 'BUILDING_SAFETY',
  };
  return mapping[certType] || 'OTHER';
}

// Detect certificate type from filename - returns DB-compatible enum values
export function detectCertTypeFromFilename(filename: string): string | null {
  const upper = filename.toUpperCase();
  if (upper.includes('LGSR') || upper.includes('CP12') || upper.includes('GAS_SAFETY') || 
      upper.includes('GAS-SAFETY') || upper.includes('GASSAFETY')) return 'GAS_SAFETY';
  if (upper.includes('EICR') || upper.includes('ELECTRICAL')) return 'EICR';
  if (upper.includes('EPC') || upper.includes('ENERGY')) return 'EPC';
  if (upper.includes('FRA') || upper.includes('FIRE_RISK') || upper.includes('FIRE-RISK')) return 'FIRE_RISK_ASSESSMENT';
  if (upper.includes('PAT')) return 'EICR'; // PAT falls under electrical
  if (upper.includes('LEGIONELLA') || upper.includes('WATER')) return 'LEGIONELLA_ASSESSMENT';
  if (upper.includes('ASBESTOS')) return 'ASBESTOS_SURVEY';
  if (upper.includes('LOLER') || upper.includes('LIFT')) return 'LIFT_LOLER';
  return null;
}

// Map internal type code to DB-compatible enum value
export function toDbCertificateType(certType: CertificateTypeCode): string {
  const mapping: Record<string, string> = {
    'GAS': 'GAS_SAFETY', 'GAS_SVC': 'GAS_SAFETY', 
    'FRA': 'FIRE_RISK_ASSESSMENT', 'FRAEW': 'FIRE_RISK_ASSESSMENT', 'FIRE_RISK': 'FIRE_RISK_ASSESSMENT',
    'LEG_RA': 'LEGIONELLA_ASSESSMENT', 'LEG_MONITOR': 'LEGIONELLA_ASSESSMENT',
    'ASB_SURVEY': 'ASBESTOS_SURVEY', 'ASB_MGMT': 'ASBESTOS_SURVEY', 'ASBESTOS': 'ASBESTOS_SURVEY',
    'LOLER': 'LIFT_LOLER', 'LIFT': 'LIFT_LOLER',
    'EICR': 'EICR', 'EPC': 'EPC',
  };
  return mapping[certType] || 'OTHER';
}

export function normalizeCertificateTypeCode(certType: string | undefined | null): CertificateTypeCode {
  if (!certType) {
    return 'UNKNOWN';
  }
  const upper = certType.toUpperCase().trim();
  
  if (upper === 'GAS_SAFETY' || upper === 'GAS' || upper === 'LGSR' || upper === 'CP12' || upper.includes('GAS SAFETY')) return 'GAS';
  if (upper === 'GAS_SVC' || upper.includes('GAS SERVICE')) return 'GAS_SVC';
  if (upper === 'OIL' || upper.includes('OIL BOILER')) return 'OIL';
  if (upper === 'LPG') return 'LPG';
  if (upper === 'EICR' || upper === 'ELECTRICAL' || upper.includes('ELECTRICAL INSTALLATION')) return 'EICR';
  if (upper === 'ELEC') return 'ELEC';
  if (upper === 'EIC') return 'EIC';
  if (upper === 'PAT' || upper.includes('PORTABLE APPLIANCE')) return 'PAT';
  if (upper === 'EMLT' || upper.includes('EMERGENCY LIGHT')) return 'EMLT';
  if (upper === 'EPC' || upper === 'ENERGY' || upper.includes('ENERGY PERFORMANCE')) return 'EPC';
  if (upper === 'SAP') return 'SAP';
  if (upper === 'DEC' || upper.includes('DISPLAY ENERGY')) return 'DEC';
  if (upper === 'FIRE_RISK_ASSESSMENT' || upper === 'FRA' || upper === 'FIRE' || upper.includes('FIRE RISK')) return 'FRA';
  if (upper === 'FIRE_RISK') return 'FIRE_RISK';
  if (upper === 'FRAEW' || upper.includes('EXTERNAL WALL')) return 'FRAEW';
  if (upper === 'FIRE_ALARM' || upper.includes('FIRE ALARM')) return 'FIRE_ALARM';
  if (upper === 'FIRE_EXT' || upper.includes('FIRE EXTINGUISHER')) return 'FIRE_EXT';
  if (upper === 'FIRE_DOOR' || upper.includes('FIRE DOOR')) return 'FIRE_DOOR';
  if (upper === 'SMOKE_CO' || upper.includes('SMOKE') || upper.includes('CARBON MONOXIDE DETECTOR')) return 'SMOKE_CO';
  if (upper === 'AOV') return 'AOV';
  if (upper === 'SPRINKLER') return 'SPRINKLER';
  if (upper === 'LEGIONELLA_ASSESSMENT' || upper === 'LEGIONELLA' || upper === 'LEG_RA' || upper.includes('LEGIONELLA')) return 'LEG_RA';
  if (upper === 'LEG_MONITOR' || upper.includes('LEGIONELLA MONITOR')) return 'LEG_MONITOR';
  if (upper === 'WATER_TANK' || upper.includes('WATER TANK')) return 'WATER_TANK';
  if (upper === 'TMV' || upper.includes('THERMOSTATIC MIXING')) return 'TMV';
  if (upper === 'ASBESTOS_SURVEY' || upper === 'ASBESTOS' || upper === 'ASB_SURVEY' || upper.includes('ASBESTOS')) return 'ASB_SURVEY';
  if (upper === 'ASB_MGMT' || upper.includes('ASBESTOS MANAGEMENT')) return 'ASB_MGMT';
  if (upper === 'LIFT_LOLER' || upper === 'LOLER' || upper.includes('LOLER')) return 'LOLER';
  if (upper === 'LIFT' || upper.includes('PASSENGER LIFT')) return 'LIFT';
  if (upper === 'STAIR_LIFT' || upper.includes('STAIR LIFT')) return 'STAIR_LIFT';
  if (upper === 'HOIST') return 'HOIST';
  if (upper === 'PLATFORM') return 'PLATFORM';
  if (upper === 'SFE' || upper.includes('SAFE FIRE EXIT')) return 'SFE';
  if (upper === 'SCAFFOLD') return 'SCAFFOLD';
  if (upper === 'PLAY' || upper.includes('PLAY AREA')) return 'PLAY';
  if (upper === 'GYM') return 'GYM';
  if (upper === 'TREE') return 'TREE';
  if (upper === 'FENCE') return 'FENCE';
  if (upper === 'PAVING') return 'PAVING';
  if (upper === 'CCTV') return 'CCTV';
  if (upper === 'ACCESS_CTRL' || upper.includes('ACCESS CONTROL')) return 'ACCESS_CTRL';
  if (upper === 'INTRUDER') return 'INTRUDER';
  if (upper === 'WARDEN') return 'WARDEN';
  if (upper === 'FORM_A' || upper.includes('FORM A')) return 'FORM_A';
  if (upper === 'FORM_B' || upper.includes('FORM B')) return 'FORM_B';
  if (upper === 'EWS1') return 'EWS1';
  if (upper === 'BSR_REG' || upper.includes('BUILDING SAFETY')) return 'BSR_REG';
  if (upper === 'RESIDENT') return 'RESIDENT';
  if (upper === 'GOLDEN_THREAD') return 'GOLDEN_THREAD';
  if (upper === 'SAFETY_CASE') return 'SAFETY_CASE';
  if (upper === 'HHSRS') return 'HHSRS';
  if (upper === 'DS' || upper.includes('DAMP')) return 'DS';
  if (upper === 'HS') return 'HS';
  if (upper === 'MOBILITY') return 'MOBILITY';
  if (upper === 'SENSORY') return 'SENSORY';
  if (upper === 'GRAB') return 'GRAB';
  if (upper === 'PEST') return 'PEST';
  if (upper === 'BIRDNET') return 'BIRDNET';
  if (upper === 'CARCASS') return 'CARCASS';
  if (upper === 'WASTE') return 'WASTE';
  if (upper === 'BULKY') return 'BULKY';
  if (upper === 'RECYCLING') return 'RECYCLING';
  if (upper === 'COMMUNAL') return 'COMMUNAL';
  if (upper === 'SIGNAGE') return 'SIGNAGE';
  if (upper === 'ESC_ROUTE' || upper.includes('ESCAPE ROUTE')) return 'ESC_ROUTE';
  if (upper === 'BALCONY') return 'BALCONY';
  if (upper === 'ROOF_ACCESS') return 'ROOF_ACCESS';
  if (upper === 'OTHER') return 'OTHER';
  
  return 'UNKNOWN';
}

