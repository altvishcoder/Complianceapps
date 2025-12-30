# ComplianceAI Compliance Types Specification
## Social Housing Industry - Complete Reference

**Version:** 3.0  
**Date:** December 2025  
**Author:** LASHAN Digital

---

## Overview

This specification defines all compliance types, certificate codes, classification rules, domain rules and validation logic for ComplianceAI in the UK social housing sector.

---

## 1. Compliance Type Taxonomy

### Master List of Compliance Types

| Code | Compliance Type | Category | Statutory Requirement | Frequency |
|------|----------------|----------|----------------------|-----------|
| **GAS** | Gas Safety | Gas & Heating | Yes | Annual |
| **GAS-SVC** | Gas Servicing | Gas & Heating | Best Practice | Annual |
| **OIL** | Oil Heating | Gas & Heating | Best Practice | Annual |
| **OIL-TANK** | Oil Tank Inspection | Gas & Heating | Best Practice | Annual |
| **LPG** | LPG Safety | Gas & Heating | Yes | Annual |
| **SOLID** | Solid Fuel | Gas & Heating | Yes | Annual |
| **BIO** | Biomass | Gas & Heating | Best Practice | Annual |
| **HVAC** | HVAC Systems | Gas & Heating | Best Practice | Annual |
| **MECH** | Mechanical Servicing | Gas & Heating | Best Practice | Annual |
| **RENEW** | Renewable Energy | Gas & Heating | Best Practice | Annual |
| **ASHP** | Air Source Heat Pump | Gas & Heating | Best Practice | Annual |
| **GSHP** | Ground Source Heat Pump | Gas & Heating | Best Practice | Annual |
| **ELEC** | Electrical Installation | Electrical | Yes | 5 Years |
| **EICR** | EICR | Electrical | Yes | 5 Years |
| **PAT** | PAT Testing | Electrical | Best Practice | Annual |
| **EMLT** | Emergency Lighting | Electrical | Yes | Annual |
| **EMLT-M** | Emergency Lighting Monthly | Electrical | Yes | Monthly |
| **ELEC-HEAT** | Electric Heating | Electrical | Best Practice | Annual |
| **EPC** | Energy Performance Certificate | Energy | Yes | 10 Years |
| **SAP** | SAP Assessment | Energy | Yes | On Build/Change |
| **DEC** | Display Energy Certificate | Energy | Yes | Annual |
| **FIRE** | Fire Risk Assessment | Fire Safety | Yes | Annual |
| **FRA** | Fire Risk Assessment | Fire Safety | Yes | Annual |
| **FRAEW** | External Wall Fire Appraisal | Fire Safety | Yes (HRB) | 5 Years |
| **FD** | Fire Door Inspection | Fire Safety | Yes | Quarterly/Annual |
| **FD-Q** | Fire Door Quarterly | Fire Safety | Yes (HRB) | Quarterly |
| **FD-A** | Fire Door Annual | Fire Safety | Yes (HRB) | Annual |
| **FA** | Fire Alarm | Fire Safety | Yes | Annual |
| **FA-W** | Fire Alarm Weekly Test | Fire Safety | Yes | Weekly |
| **FA-Q** | Fire Alarm Quarterly | Fire Safety | Yes | Quarterly |
| **SD** | Smoke Detector | Fire Safety | Yes | Annual |
| **CO** | Carbon Monoxide Detector | Fire Safety | Yes | Annual |
| **SPRINK** | Sprinkler System | Fire Safety | Yes | Annual |
| **DRY** | Dry Riser | Fire Safety | Yes | 6 Monthly |
| **WET** | Wet Riser | Fire Safety | Yes | 6 Monthly |
| **AOV** | Automatic Opening Vent | Fire Safety | Yes | Annual |
| **SMOKE-V** | Smoke Ventilation | Fire Safety | Yes | Annual |
| **EXT** | Fire Extinguisher | Fire Safety | Yes | Annual |
| **COMPART** | Compartmentation Survey | Fire Safety | Best Practice | 5 Years |
| **ASB** | Asbestos Survey | Asbestos | Yes | On Acquisition |
| **ASB-M** | Asbestos Management | Asbestos | Yes | Annual |
| **ASB-R** | Asbestos Re-inspection | Asbestos | Yes | Annual |
| **ASB-D** | Asbestos Demolition | Asbestos | Yes | Before Works |
| **ASB-REF** | Asbestos Refurbishment | Asbestos | Yes | Before Works |
| **LEG** | Legionella Risk Assessment | Water Safety | Yes | 2 Years |
| **LEG-M** | Legionella Monitoring | Water Safety | Yes | Monthly |
| **WATER** | Water Hygiene | Water Safety | Best Practice | Annual |
| **TANK** | Water Tank Inspection | Water Safety | Best Practice | Annual |
| **TMV** | TMV Servicing | Water Safety | Yes | Annual |
| **LIFT** | Lift Inspection (LOLER) | Lifting Equipment | Yes | 6 Monthly |
| **LIFT-M** | Lift Monthly Check | Lifting Equipment | Yes (HRB) | Monthly |
| **STAIR** | Stairlift | Lifting Equipment | Yes | 6 Monthly |
| **HOIST** | Hoist | Lifting Equipment | Yes | 6 Monthly |
| **PLAT** | Platform Lift | Lifting Equipment | Yes | 6 Monthly |
| **HHSRS** | HHSRS Assessment | Building Safety | Yes | On Complaint |
| **STRUCT** | Structural Survey | Building Safety | Best Practice | 5 Years |
| **DAMP** | Damp & Mould Survey | Building Safety | Yes | On Report |
| **ROOF** | Roof Survey | Building Safety | Best Practice | 5 Years |
| **CHIMNEY** | Chimney Inspection | Building Safety | Best Practice | Annual |
| **GUTTER** | Gutter Clearance | Building Safety | Best Practice | Annual |
| **DRAIN** | Drainage Survey | Building Safety | Best Practice | 5 Years |
| **LIGHT** | Lightning Protection | Building Safety | Best Practice | Annual |
| **PLAY** | Playground Inspection | External Areas | Yes | Annual |
| **PLAY-Q** | Playground Quarterly | External Areas | Yes | Quarterly |
| **TREE** | Tree Survey | External Areas | Best Practice | 3 Years |
| **FALL** | Fall Arrest/Anchor Points | Access Equipment | Yes | Annual |
| **ACCESS** | Access Equipment | Access Equipment | Yes | Annual |
| **CCTV** | CCTV Maintenance | Security | Best Practice | Annual |
| **ENTRY** | Door Entry System | Security | Best Practice | Annual |
| **ALARM** | Intruder Alarm | Security | Best Practice | Annual |
| **SIB** | Secure Information Box | HRB Specific | Yes (HRB) | Annual |
| **WAYFIND** | Wayfinding Signage | HRB Specific | Yes (HRB) | On Install |
| **SC** | Safety Case | HRB Specific | Yes (HRB) | 2 Years |
| **RES** | Resident Engagement Strategy | HRB Specific | Yes (HRB) | 2 Years |
| **PEEP** | PEEP Assessment | HRB Specific | Yes (HRB) | Annual |
| **BEEP** | Building Emergency Evac Plan | HRB Specific | Yes (HRB) | Annual |

---

## 2. Compliance Categories

### Category Definitions

```typescript
enum ComplianceCategory {
  GAS_HEATING = 'Gas & Heating',
  ELECTRICAL = 'Electrical',
  ENERGY = 'Energy',
  FIRE_SAFETY = 'Fire Safety',
  ASBESTOS = 'Asbestos',
  WATER_SAFETY = 'Water Safety',
  LIFTING_EQUIPMENT = 'Lifting Equipment',
  BUILDING_SAFETY = 'Building Safety',
  EXTERNAL_AREAS = 'External Areas',
  ACCESS_EQUIPMENT = 'Access Equipment',
  SECURITY = 'Security',
  HRB_SPECIFIC = 'HRB Specific'
}
```

### Category Hierarchy

```typescript
const complianceCategoryHierarchy = {
  'Gas & Heating': {
    subcategories: ['Gas', 'Oil', 'Solid Fuel', 'Renewable', 'HVAC'],
    types: ['GAS', 'GAS-SVC', 'OIL', 'OIL-TANK', 'LPG', 'SOLID', 'BIO', 
            'HVAC', 'MECH', 'RENEW', 'ASHP', 'GSHP']
  },
  'Electrical': {
    subcategories: ['Fixed Wiring', 'Portable Appliances', 'Emergency Systems', 'Heating'],
    types: ['ELEC', 'EICR', 'PAT', 'EMLT', 'EMLT-M', 'ELEC-HEAT']
  },
  'Energy': {
    subcategories: ['Certification', 'Assessment'],
    types: ['EPC', 'SAP', 'DEC']
  },
  'Fire Safety': {
    subcategories: ['Risk Assessment', 'Doors', 'Detection', 'Suppression', 'Ventilation'],
    types: ['FIRE', 'FRA', 'FRAEW', 'FD', 'FD-Q', 'FD-A', 'FA', 'FA-W', 'FA-Q', 
            'SD', 'CO', 'SPRINK', 'DRY', 'WET', 'AOV', 'SMOKE-V', 'EXT', 'COMPART']
  },
  'Asbestos': {
    subcategories: ['Survey', 'Management', 'Works'],
    types: ['ASB', 'ASB-M', 'ASB-R', 'ASB-D', 'ASB-REF']
  },
  'Water Safety': {
    subcategories: ['Legionella', 'Hygiene', 'Equipment'],
    types: ['LEG', 'LEG-M', 'WATER', 'TANK', 'TMV']
  },
  'Lifting Equipment': {
    subcategories: ['Lifts', 'Domestic Equipment'],
    types: ['LIFT', 'LIFT-M', 'STAIR', 'HOIST', 'PLAT']
  },
  'Building Safety': {
    subcategories: ['Assessment', 'Structure', 'Fabric'],
    types: ['HHSRS', 'STRUCT', 'DAMP', 'ROOF', 'CHIMNEY', 'GUTTER', 'DRAIN', 'LIGHT']
  },
  'External Areas': {
    subcategories: ['Play Areas', 'Grounds'],
    types: ['PLAY', 'PLAY-Q', 'TREE']
  },
  'Access Equipment': {
    subcategories: ['Fall Protection', 'Access'],
    types: ['FALL', 'ACCESS']
  },
  'Security': {
    subcategories: ['Surveillance', 'Access Control', 'Alarm'],
    types: ['CCTV', 'ENTRY', 'ALARM']
  },
  'HRB Specific': {
    subcategories: ['Building Safety Act', 'Fire Safety Regs'],
    types: ['SIB', 'WAYFIND', 'SC', 'RES', 'PEEP', 'BEEP']
  }
};
```

---

## 3. Certificate Code Reference

### Gas & Heating Certificates

| Type Code | Certificate Code | Certificate Name | Issued By |
|-----------|-----------------|------------------|-----------|
| GAS | CP12 | Landlord Gas Safety Record | Gas Safe Engineer |
| GAS | LGSR | Landlord Gas Safety Record | Gas Safe Engineer |
| GAS-SVC | GSC | Gas Service Certificate | Gas Safe Engineer |
| OIL | OFTEC-CD/11 | Oil Installation Report | OFTEC Technician |
| OIL | OFTEC-TI/133 | Oil Tank Inspection | OFTEC Technician |
| LPG | LPG-CP | LPG Safety Certificate | Gas Safe Engineer |
| SOLID | HETAS-CERT | Solid Fuel Certificate | HETAS Engineer |
| BIO | HETAS-BIO | Biomass Certificate | HETAS Engineer |
| HVAC | F-GAS | F-Gas Certificate | F-Gas Certified |
| ASHP | MCS-CERT | MCS Certificate | MCS Installer |

### Electrical Certificates

| Type Code | Certificate Code | Certificate Name | Issued By |
|-----------|-----------------|------------------|-----------|
| ELEC | EICR | Electrical Installation Condition Report | Registered Electrician |
| ELEC | EIC | Electrical Installation Certificate | Registered Electrician |
| ELEC | MEIWC | Minor Electrical Works Certificate | Registered Electrician |
| PAT | PAT-CERT | PAT Test Certificate | Competent Person |
| EMLT | EM-LT-CERT | Emergency Lighting Certificate | Competent Person |
| EPC | EPC | Energy Performance Certificate | DEA |
| SAP | SAP-CALC | SAP Calculation | SAP Assessor |
| DEC | DEC | Display Energy Certificate | DEA |

### Fire Safety Certificates

| Type Code | Certificate Code | Certificate Name | Issued By |
|-----------|-----------------|------------------|-----------|
| FIRE/FRA | FRA | Fire Risk Assessment | Fire Risk Assessor |
| FRAEW | FRAEW | Fire Risk Appraisal External Walls | Fire Engineer |
| FRAEW | EWS1 | External Wall System Form | Fire Engineer |
| FD | FD-INSP | Fire Door Inspection Report | FDIS Inspector |
| FA | FA-CERT | Fire Alarm Certificate | Competent Engineer |
| FA | BS5839-CERT | BS 5839 Compliance Certificate | Fire Alarm Engineer |
| SPRINK | SPRINK-CERT | Sprinkler System Certificate | LPCB Contractor |
| DRY | DRY-CERT | Dry Riser Certificate | Competent Person |
| WET | WET-CERT | Wet Riser Certificate | Competent Person |
| AOV | AOV-CERT | AOV Test Certificate | Competent Person |
| EXT | EXT-CERT | Fire Extinguisher Certificate | BAFE Contractor |

### Asbestos Certificates

| Type Code | Certificate Code | Certificate Name | Issued By |
|-----------|-----------------|------------------|-----------|
| ASB | ASB-MS | Management Survey | UKAS Surveyor |
| ASB | ASB-RD | Refurbishment & Demolition Survey | UKAS Surveyor |
| ASB-M | ASB-PLAN | Asbestos Management Plan | Duty Holder |
| ASB-R | ASB-REINSP | Re-inspection Report | UKAS Surveyor |

### Water Safety Certificates

| Type Code | Certificate Code | Certificate Name | Issued By |
|-----------|-----------------|------------------|-----------|
| LEG | LRA | Legionella Risk Assessment | Competent Assessor |
| LEG-M | LEG-MON | Legionella Monitoring Log | Competent Person |
| WATER | WATER-HYG | Water Hygiene Report | Competent Person |
| TANK | TANK-INSP | Water Tank Inspection | Competent Person |
| TMV | TMV-CERT | TMV Service Certificate | Competent Person |

### Lifting Equipment Certificates

| Type Code | Certificate Code | Certificate Name | Issued By |
|-----------|-----------------|------------------|-----------|
| LIFT | LOLER | LOLER Thorough Examination | Competent Person |
| LIFT | SAF-CERT | SAFed Examination Certificate | SAFed Member |
| STAIR | STAIR-CERT | Stairlift Examination | Competent Person |
| HOIST | HOIST-CERT | Hoist Examination | Competent Person |
| PLAT | PLAT-CERT | Platform Lift Examination | Competent Person |

---

## 4. Document Classification Rules

### Classification Keywords

```typescript
const classificationKeywords = {
  // Gas & Heating
  'GAS': {
    primary: ['cp12', 'lgsr', 'gas safety', 'landlord gas safety record', 
              'gas safe', 'gas safety certificate'],
    secondary: ['boiler', 'gas appliance', 'flue', 'gas meter'],
    exclusions: ['lpg', 'bottled gas']
  },
  'OIL': {
    primary: ['oftec', 'oil boiler', 'oil tank', 'oil installation', 
              'kerosene', 'heating oil'],
    secondary: ['oil burner', 'oil storage', 'oil supply'],
    exclusions: ['cooking oil', 'oil filter']
  },
  'SOLID': {
    primary: ['hetas', 'solid fuel', 'wood burner', 'coal', 'log burner',
              'multi-fuel', 'stove installation'],
    secondary: ['chimney', 'flue liner', 'hearth'],
    exclusions: []
  },
  'LPG': {
    primary: ['lpg', 'propane', 'butane', 'bottled gas', 'calor gas'],
    secondary: ['lpg installation', 'lpg appliance'],
    exclusions: []
  },
  
  // Electrical
  'EICR': {
    primary: ['eicr', 'electrical installation condition report', 
              'periodic inspection', 'electrical inspection'],
    secondary: ['fixed wiring', 'electrical test', 'bs 7671'],
    exclusions: ['pat test', 'portable']
  },
  'PAT': {
    primary: ['pat', 'portable appliance', 'pat test', 'pat testing'],
    secondary: ['appliance test', 'portable electrical'],
    exclusions: ['fixed wiring', 'eicr']
  },
  'EMLT': {
    primary: ['emergency lighting', 'emergency light test', 'em lighting'],
    secondary: ['exit sign', 'maintained luminaire', 'non-maintained'],
    exclusions: []
  },
  'EPC': {
    primary: ['epc', 'energy performance certificate', 'energy rating'],
    secondary: ['energy efficiency', 'eer rating'],
    exclusions: ['dec', 'display energy']
  },
  
  // Fire Safety
  'FRA': {
    primary: ['fire risk assessment', 'fra', 'fire safety assessment'],
    secondary: ['type 1', 'type 2', 'type 3', 'type 4', 'pas 79'],
    exclusions: ['fraew', 'external wall']
  },
  'FRAEW': {
    primary: ['fraew', 'fire risk appraisal external wall', 'external wall fire',
              'ews1', 'pas 9980', 'cladding assessment'],
    secondary: ['external wall system', 'façade fire'],
    exclusions: []
  },
  'FD': {
    primary: ['fire door', 'fire door inspection', 'fd30', 'fd60', 'fdis'],
    secondary: ['intumescent', 'smoke seal', 'self closer', 'door inspection'],
    exclusions: []
  },
  'FA': {
    primary: ['fire alarm', 'fire detection', 'bs 5839', 'fire alarm test'],
    secondary: ['smoke detector', 'heat detector', 'call point', 'sounder'],
    exclusions: []
  },
  'SPRINK': {
    primary: ['sprinkler', 'sprinkler system', 'fire suppression'],
    secondary: ['lpcb', 'firas', 'bs en 12845'],
    exclusions: ['garden sprinkler']
  },
  
  // Asbestos
  'ASB': {
    primary: ['asbestos', 'acm', 'asbestos survey', 'asbestos containing'],
    secondary: ['management survey', 'refurbishment survey', 'demolition survey',
                'r&d survey', 'asbestos register'],
    exclusions: []
  },
  
  // Water Safety
  'LEG': {
    primary: ['legionella', 'lra', 'legionella risk assessment', 'l8'],
    secondary: ['legionnaires', 'water risk', 'water hygiene', 'hsg274'],
    exclusions: []
  },
  'TMV': {
    primary: ['tmv', 'thermostatic mixing valve', 'tmv service', 'tmv test'],
    secondary: ['blending valve', 'anti-scald'],
    exclusions: []
  },
  
  // Lifting Equipment
  'LIFT': {
    primary: ['loler', 'lift inspection', 'lift examination', 'passenger lift',
              'goods lift', 'lift thorough examination'],
    secondary: ['safed', 'lift test', 'lift certificate'],
    exclusions: ['stairlift', 'platform lift', 'hoist']
  },
  'STAIR': {
    primary: ['stairlift', 'stair lift', 'chairlift'],
    secondary: ['domestic lift', 'stair climber'],
    exclusions: []
  },
  'HOIST': {
    primary: ['hoist', 'ceiling hoist', 'tracking hoist', 'patient hoist'],
    secondary: ['lifting hoist', 'mobile hoist'],
    exclusions: []
  }
};
```

### Classification Logic

```typescript
interface ClassificationResult {
  complianceType: string;
  confidence: 'high' | 'medium' | 'low';
  matchedKeywords: string[];
  suggestedCategory: string;
}

function classifyDocument(content: string, filename: string): ClassificationResult {
  const normalizedContent = content.toLowerCase();
  const normalizedFilename = filename.toLowerCase();
  
  let bestMatch = { type: '', score: 0, keywords: [] };
  
  for (const [type, keywords] of Object.entries(classificationKeywords)) {
    let score = 0;
    let matched = [];
    
    // Check exclusions first
    const hasExclusion = keywords.exclusions.some(ex => 
      normalizedContent.includes(ex) || normalizedFilename.includes(ex)
    );
    if (hasExclusion) continue;
    
    // Primary keywords (high weight)
    for (const kw of keywords.primary) {
      if (normalizedContent.includes(kw) || normalizedFilename.includes(kw)) {
        score += 10;
        matched.push(kw);
      }
    }
    
    // Secondary keywords (lower weight)
    for (const kw of keywords.secondary) {
      if (normalizedContent.includes(kw)) {
        score += 3;
        matched.push(kw);
      }
    }
    
    if (score > bestMatch.score) {
      bestMatch = { type, score, keywords: matched };
    }
  }
  
  return {
    complianceType: bestMatch.type || 'UNKNOWN',
    confidence: bestMatch.score >= 20 ? 'high' : bestMatch.score >= 10 ? 'medium' : 'low',
    matchedKeywords: bestMatch.keywords,
    suggestedCategory: getCategoryForType(bestMatch.type)
  };
}
```

---

## 5. Domain Rules

### Validity Periods

```typescript
const validityPeriods = {
  // Gas & Heating - Annual
  'GAS': { months: 12, warningDays: 30, criticalDays: 14 },
  'GAS-SVC': { months: 12, warningDays: 30, criticalDays: 14 },
  'OIL': { months: 12, warningDays: 30, criticalDays: 14 },
  'LPG': { months: 12, warningDays: 30, criticalDays: 14 },
  'SOLID': { months: 12, warningDays: 30, criticalDays: 14 },
  'BIO': { months: 12, warningDays: 30, criticalDays: 14 },
  'ASHP': { months: 12, warningDays: 30, criticalDays: 14 },
  'GSHP': { months: 12, warningDays: 30, criticalDays: 14 },
  
  // Electrical
  'EICR': { months: 60, warningDays: 90, criticalDays: 30 },
  'PAT': { months: 12, warningDays: 30, criticalDays: 14 },
  'EMLT': { months: 12, warningDays: 30, criticalDays: 14 },
  
  // Energy
  'EPC': { months: 120, warningDays: 180, criticalDays: 90 },
  'DEC': { months: 12, warningDays: 30, criticalDays: 14 },
  
  // Fire Safety
  'FRA': { months: 12, warningDays: 30, criticalDays: 14 },
  'FRAEW': { months: 60, warningDays: 180, criticalDays: 90 },
  'FD-Q': { months: 3, warningDays: 14, criticalDays: 7 },
  'FD-A': { months: 12, warningDays: 30, criticalDays: 14 },
  'FA': { months: 12, warningDays: 30, criticalDays: 14 },
  'SPRINK': { months: 12, warningDays: 30, criticalDays: 14 },
  'DRY': { months: 6, warningDays: 30, criticalDays: 14 },
  'WET': { months: 6, warningDays: 30, criticalDays: 14 },
  'AOV': { months: 12, warningDays: 30, criticalDays: 14 },
  'EXT': { months: 12, warningDays: 30, criticalDays: 14 },
  
  // Asbestos
  'ASB': { months: 0, warningDays: 0, criticalDays: 0 }, // No expiry - one time
  'ASB-R': { months: 12, warningDays: 30, criticalDays: 14 },
  
  // Water Safety
  'LEG': { months: 24, warningDays: 60, criticalDays: 30 },
  'TMV': { months: 12, warningDays: 30, criticalDays: 14 },
  
  // Lifting Equipment
  'LIFT': { months: 6, warningDays: 30, criticalDays: 14 },
  'LIFT-M': { months: 1, warningDays: 7, criticalDays: 3 },
  'STAIR': { months: 6, warningDays: 30, criticalDays: 14 },
  'HOIST': { months: 6, warningDays: 30, criticalDays: 14 },
  
  // HRB Specific
  'SC': { months: 24, warningDays: 90, criticalDays: 30 },
  'RES': { months: 24, warningDays: 90, criticalDays: 30 },
  'PEEP': { months: 12, warningDays: 30, criticalDays: 14 },
  'BEEP': { months: 12, warningDays: 30, criticalDays: 14 },
  'SIB': { months: 12, warningDays: 30, criticalDays: 14 }
};
```

### Outcome Classifications

```typescript
const outcomeClassifications = {
  'GAS': {
    pass: ['satisfactory', 'pass', 'safe', 'compliant'],
    fail: ['unsatisfactory', 'fail', 'unsafe', 'immediately dangerous', 'id', 
           'at risk', 'ar', 'not to current standards', 'ncs'],
    advisory: ['improvement recommended', 'advisory']
  },
  'EICR': {
    pass: ['satisfactory', 'c3', 'no observations'],
    fail: ['unsatisfactory', 'c1', 'c2', 'danger present', 'potentially dangerous'],
    advisory: ['fi', 'further investigation']
  },
  'FRA': {
    pass: ['low risk', 'trivial risk', 'tolerable risk'],
    fail: ['high risk', 'intolerable risk', 'substantial risk'],
    advisory: ['moderate risk', 'medium risk']
  },
  'FRAEW': {
    pass: ['low risk', 'a1', 'a2', 'b1'],
    fail: ['high risk', 'b2'],
    advisory: ['medium risk', 'a3']
  },
  'LIFT': {
    pass: ['satisfactory', 'no defects'],
    fail: ['defects found', 'unsafe', 'prohibition notice'],
    advisory: ['minor defects', 'advisory']
  },
  'ASB': {
    pass: ['no acm found', 'naf', 'presumed acm free'],
    fail: ['acm found', 'asbestos present', 'presumed acm'],
    advisory: ['acm suspected', 'sampling required']
  }
};
```

### Property Type Applicability

```typescript
const propertyTypeApplicability = {
  // General Needs
  'general_needs': {
    required: ['GAS', 'EICR', 'EPC', 'SD', 'CO'],
    conditional: ['EMLT', 'FA', 'FRA'],
    optional: ['PAT', 'ASB', 'LEG']
  },
  
  // HMO
  'hmo': {
    required: ['GAS', 'EICR', 'EPC', 'SD', 'CO', 'FRA', 'FA', 'EMLT'],
    conditional: ['ASB', 'LEG'],
    optional: ['PAT']
  },
  
  // Sheltered/Extra Care
  'sheltered': {
    required: ['GAS', 'EICR', 'EPC', 'SD', 'CO', 'FRA', 'FA', 'EMLT', 'LEG'],
    conditional: ['LIFT', 'STAIR', 'HOIST', 'AOV'],
    optional: ['PAT', 'ASB', 'TMV']
  },
  
  // Higher Risk Building (18m+/7+ storeys)
  'hrb': {
    required: ['GAS', 'EICR', 'EPC', 'SD', 'CO', 'FRA', 'FA', 'EMLT', 'LEG',
               'LIFT', 'FD-Q', 'FD-A', 'SIB', 'WAYFIND', 'SC', 'RES', 'BEEP'],
    conditional: ['FRAEW', 'SPRINK', 'DRY', 'WET', 'AOV', 'SMOKE-V', 'PEEP'],
    optional: ['PAT', 'ASB']
  },
  
  // Block/Communal (under HRB threshold)
  'block': {
    required: ['FRA', 'EMLT', 'FA'],
    conditional: ['LIFT', 'AOV', 'DRY', 'LEG'],
    optional: ['FD', 'EXT']
  }
};
```

---

## 6. Data Extraction Rules

### Field Extraction Patterns

```typescript
const extractionPatterns = {
  // Certificate Reference Numbers
  'certificateNumber': {
    'GAS': /(?:certificate|report|ref)[\s#:]*([A-Z0-9\-\/]+)/i,
    'EICR': /(?:certificate|report|ref)[\s#:]*([A-Z0-9\-\/]+)/i,
    'EPC': /(\d{4}-\d{4}-\d{4}-\d{4}-\d{4})/,
    'LIFT': /(?:report|ref|exam)[\s#:]*([A-Z0-9\-\/]+)/i
  },
  
  // Dates
  'inspectionDate': {
    pattern: /(?:inspection|test|assessment|survey)\s*date[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    formats: ['DD/MM/YYYY', 'DD-MM-YYYY', 'DD/MM/YY']
  },
  'expiryDate': {
    pattern: /(?:expiry|expires|valid until|next due)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    formats: ['DD/MM/YYYY', 'DD-MM-YYYY', 'DD/MM/YY']
  },
  'nextDueDate': {
    pattern: /(?:next|due|retest)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    formats: ['DD/MM/YYYY', 'DD-MM-YYYY', 'DD/MM/YY']
  },
  
  // Address
  'address': {
    pattern: /(?:property|premises|address)[:\s]*([A-Za-z0-9\s,]+(?:[\r\n][A-Za-z0-9\s,]+)*)/i
  },
  'uprn': {
    pattern: /(?:uprn)[:\s]*(\d{10,12})/i
  },
  'postcode': {
    pattern: /([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i
  },
  
  // Engineer/Assessor
  'engineerName': {
    pattern: /(?:engineer|technician|assessor|inspector)[:\s]*([A-Za-z\s]+)/i
  },
  'registrationNumber': {
    'GAS': /(?:gas safe|registration)[\s#:]*(\d{6,7})/i,
    'EICR': /(?:registration|competent scheme)[\s#:]*([A-Z0-9]+)/i
  },
  
  // Outcome
  'outcome': {
    'GAS': /(?:overall|assessment|result)[:\s]*(satisfactory|unsatisfactory|pass|fail)/i,
    'EICR': /(?:overall|assessment)[:\s]*(satisfactory|unsatisfactory)/i,
    'FRA': /(?:overall|risk)[:\s]*(low|medium|high|trivial|tolerable|moderate|substantial|intolerable)/i
  }
};
```

---

## 7. Compliance Status Calculation

### Status Definitions

```typescript
enum ComplianceStatus {
  COMPLIANT = 'Compliant',           // Valid certificate, not expiring soon
  EXPIRING = 'Expiring Soon',        // Within warning period
  EXPIRED = 'Expired',               // Past expiry date
  OVERDUE = 'Overdue',               // No certificate on record, past due
  MISSING = 'Missing',               // No certificate on record
  FAILED = 'Failed',                 // Certificate with unsatisfactory outcome
  NOT_APPLICABLE = 'N/A'             // Not required for this property
}
```

### Status Calculation Logic

```typescript
function calculateComplianceStatus(
  certificate: Certificate | null,
  complianceType: string,
  propertyType: string
): ComplianceStatus {
  
  // Check if compliance type is required for property type
  const applicability = propertyTypeApplicability[propertyType];
  if (!applicability.required.includes(complianceType) && 
      !applicability.conditional.includes(complianceType)) {
    return ComplianceStatus.NOT_APPLICABLE;
  }
  
  // No certificate on record
  if (!certificate) {
    return ComplianceStatus.MISSING;
  }
  
  // Check outcome
  const outcomes = outcomeClassifications[complianceType];
  if (outcomes?.fail.includes(certificate.outcome?.toLowerCase())) {
    return ComplianceStatus.FAILED;
  }
  
  // Check expiry
  const validity = validityPeriods[complianceType];
  const today = new Date();
  const expiryDate = certificate.expiryDate || 
    addMonths(certificate.inspectionDate, validity.months);
  
  if (expiryDate < today) {
    return ComplianceStatus.EXPIRED;
  }
  
  const daysUntilExpiry = differenceInDays(expiryDate, today);
  if (daysUntilExpiry <= validity.criticalDays) {
    return ComplianceStatus.EXPIRING; // Critical
  }
  if (daysUntilExpiry <= validity.warningDays) {
    return ComplianceStatus.EXPIRING; // Warning
  }
  
  return ComplianceStatus.COMPLIANT;
}
```

---

## 8. Compliance Score Calculation

### Weighting by Category

```typescript
const categoryWeights = {
  'Gas & Heating': 0.20,
  'Electrical': 0.15,
  'Fire Safety': 0.25,
  'Asbestos': 0.10,
  'Water Safety': 0.10,
  'Lifting Equipment': 0.05,
  'Building Safety': 0.05,
  'HRB Specific': 0.10  // Only for HRBs
};
```

### Score Calculation

```typescript
function calculateComplianceScore(
  property: Property,
  certificates: Certificate[]
): number {
  const applicableTypes = getApplicableTypes(property.propertyType);
  let totalWeight = 0;
  let weightedScore = 0;
  
  for (const type of applicableTypes) {
    const category = getCategoryForType(type);
    const weight = categoryWeights[category] / getTypesInCategory(category).length;
    totalWeight += weight;
    
    const cert = certificates.find(c => c.complianceType === type);
    const status = calculateComplianceStatus(cert, type, property.propertyType);
    
    const statusScore = {
      'Compliant': 100,
      'Expiring Soon': 70,
      'Expired': 20,
      'Missing': 0,
      'Failed': 0,
      'Overdue': 0,
      'N/A': null
    }[status];
    
    if (statusScore !== null) {
      weightedScore += weight * statusScore;
    }
  }
  
  return Math.round((weightedScore / totalWeight) * 100) / 100;
}
```

---

## 9. Database Schema Updates

### Prisma Schema Additions

```prisma
// Compliance Type Master Data
model ComplianceType {
  id                String   @id @default(uuid())
  code              String   @unique
  name              String
  category          String
  subcategory       String?
  
  // Statutory Requirements
  isStatutory       Boolean  @default(false)
  legislation       String?
  
  // Validity
  validityMonths    Int
  warningDays       Int
  criticalDays      Int
  
  // Classification
  keywords          String[] // For document classification
  certificateCodes  String[] // Valid certificate codes
  
  // Applicability
  appliesToGeneral  Boolean  @default(true)
  appliesToHMO      Boolean  @default(true)
  appliesToSheltered Boolean @default(true)
  appliesToHRB      Boolean  @default(false)
  appliesToBlock    Boolean  @default(false)
  
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  certificates      Certificate[]
  
  @@index([code])
  @@index([category])
}

// Certificate Outcomes
model CertificateOutcome {
  id              String   @id @default(uuid())
  complianceType  String
  outcomeValue    String
  outcomeCategory String   // 'pass', 'fail', 'advisory'
  description     String?
  
  @@unique([complianceType, outcomeValue])
}

// Property Compliance Requirements
model PropertyComplianceRequirement {
  id              String   @id @default(uuid())
  propertyId      String
  complianceType  String
  requirement     String   // 'required', 'conditional', 'optional', 'not_applicable'
  reason          String?  // Why this requirement
  
  property        Property @relation(fields: [propertyId], references: [id])
  
  @@unique([propertyId, complianceType])
}
```

---

## 10. API Endpoints

### Compliance Types API

```typescript
// GET /api/compliance-types
// Returns all active compliance types

// GET /api/compliance-types/:code
// Returns specific compliance type with full details

// GET /api/compliance-types/category/:category
// Returns compliance types for a category

// GET /api/compliance-types/property-type/:propertyType
// Returns applicable compliance types for property type
```

### Certificate Classification API

```typescript
// POST /api/certificates/classify
// Body: { content: string, filename: string }
// Returns: ClassificationResult

// POST /api/certificates/validate
// Body: { certificate: Certificate, complianceType: string }
// Returns: ValidationResult with any issues
```

---

## 11. UI Configuration

### Filter Options

```typescript
const complianceFilters = {
  categories: [
    { value: 'all', label: 'All Categories' },
    { value: 'gas_heating', label: 'Gas & Heating' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'fire_safety', label: 'Fire Safety' },
    { value: 'asbestos', label: 'Asbestos' },
    { value: 'water_safety', label: 'Water Safety' },
    { value: 'lifting', label: 'Lifting Equipment' },
    { value: 'building', label: 'Building Safety' },
    { value: 'hrb', label: 'HRB Specific' }
  ],
  
  status: [
    { value: 'all', label: 'All Status' },
    { value: 'compliant', label: 'Compliant' },
    { value: 'expiring', label: 'Expiring Soon' },
    { value: 'expired', label: 'Expired' },
    { value: 'missing', label: 'Missing' },
    { value: 'failed', label: 'Failed' }
  ],
  
  propertyTypes: [
    { value: 'all', label: 'All Properties' },
    { value: 'general_needs', label: 'General Needs' },
    { value: 'hmo', label: 'HMO' },
    { value: 'sheltered', label: 'Sheltered/Extra Care' },
    { value: 'hrb', label: 'Higher Risk Building' },
    { value: 'block', label: 'Block/Communal' }
  ]
};
```

### Dashboard Cards

```typescript
const dashboardConfig = {
  summaryCards: [
    { type: 'GAS', label: 'Gas Safety', icon: 'flame' },
    { type: 'EICR', label: 'Electrical', icon: 'zap' },
    { type: 'FRA', label: 'Fire Safety', icon: 'fire' },
    { type: 'ASB', label: 'Asbestos', icon: 'alert-triangle' },
    { type: 'LEG', label: 'Water Safety', icon: 'droplet' },
    { type: 'LIFT', label: 'Lifting Equipment', icon: 'arrow-up' },
    { type: 'EPC', label: 'Energy', icon: 'leaf' }
  ]
};
```

---

## 12. Migration Script

### Seed Compliance Types

```typescript
const complianceTypesSeed = [
  // Gas & Heating
  { code: 'GAS', name: 'Gas Safety', category: 'Gas & Heating', validityMonths: 12, warningDays: 30, criticalDays: 14, isStatutory: true, legislation: 'Gas Safety (Installation and Use) Regulations 1998' },
  { code: 'OIL', name: 'Oil Heating', category: 'Gas & Heating', validityMonths: 12, warningDays: 30, criticalDays: 14, isStatutory: false },
  { code: 'SOLID', name: 'Solid Fuel', category: 'Gas & Heating', validityMonths: 12, warningDays: 30, criticalDays: 14, isStatutory: true, legislation: 'Building Regulations Part J' },
  { code: 'LPG', name: 'LPG Safety', category: 'Gas & Heating', validityMonths: 12, warningDays: 30, criticalDays: 14, isStatutory: true },
  
  // Electrical
  { code: 'EICR', name: 'EICR', category: 'Electrical', validityMonths: 60, warningDays: 90, criticalDays: 30, isStatutory: true, legislation: 'Electrical Safety Standards Regulations 2020' },
  { code: 'PAT', name: 'PAT Testing', category: 'Electrical', validityMonths: 12, warningDays: 30, criticalDays: 14, isStatutory: false },
  { code: 'EMLT', name: 'Emergency Lighting', category: 'Electrical', validityMonths: 12, warningDays: 30, criticalDays: 14, isStatutory: true, legislation: 'RRO 2005' },
  
  // Energy
  { code: 'EPC', name: 'Energy Performance Certificate', category: 'Energy', validityMonths: 120, warningDays: 180, criticalDays: 90, isStatutory: true, legislation: 'Energy Performance Regulations 2012' },
  
  // Fire Safety
  { code: 'FRA', name: 'Fire Risk Assessment', category: 'Fire Safety', validityMonths: 12, warningDays: 30, criticalDays: 14, isStatutory: true, legislation: 'RRO 2005' },
  { code: 'FRAEW', name: 'External Wall Fire Appraisal', category: 'Fire Safety', validityMonths: 60, warningDays: 180, criticalDays: 90, isStatutory: true, legislation: 'Fire Safety Act 2021', appliesToHRB: true },
  { code: 'FD-Q', name: 'Fire Door Quarterly', category: 'Fire Safety', validityMonths: 3, warningDays: 14, criticalDays: 7, isStatutory: true, legislation: 'Fire Safety Regs 2022', appliesToHRB: true },
  { code: 'FD-A', name: 'Fire Door Annual', category: 'Fire Safety', validityMonths: 12, warningDays: 30, criticalDays: 14, isStatutory: true, legislation: 'Fire Safety Regs 2022', appliesToHRB: true },
  { code: 'FA', name: 'Fire Alarm', category: 'Fire Safety', validityMonths: 12, warningDays: 30, criticalDays: 14, isStatutory: true, legislation: 'BS 5839' },
  
  // Asbestos
  { code: 'ASB', name: 'Asbestos Survey', category: 'Asbestos', validityMonths: 0, warningDays: 0, criticalDays: 0, isStatutory: true, legislation: 'Control of Asbestos Regulations 2012' },
  { code: 'ASB-R', name: 'Asbestos Re-inspection', category: 'Asbestos', validityMonths: 12, warningDays: 30, criticalDays: 14, isStatutory: true },
  
  // Water Safety
  { code: 'LEG', name: 'Legionella Risk Assessment', category: 'Water Safety', validityMonths: 24, warningDays: 60, criticalDays: 30, isStatutory: true, legislation: 'HSE L8/HSG274' },
  { code: 'TMV', name: 'TMV Servicing', category: 'Water Safety', validityMonths: 12, warningDays: 30, criticalDays: 14, isStatutory: true },
  
  // Lifting Equipment
  { code: 'LIFT', name: 'Lift Inspection', category: 'Lifting Equipment', validityMonths: 6, warningDays: 30, criticalDays: 14, isStatutory: true, legislation: 'LOLER 1998' },
  { code: 'LIFT-M', name: 'Lift Monthly Check', category: 'Lifting Equipment', validityMonths: 1, warningDays: 7, criticalDays: 3, isStatutory: true, legislation: 'Fire Safety Regs 2022', appliesToHRB: true },
  { code: 'STAIR', name: 'Stairlift', category: 'Lifting Equipment', validityMonths: 6, warningDays: 30, criticalDays: 14, isStatutory: true, legislation: 'LOLER 1998' },
  { code: 'HOIST', name: 'Hoist', category: 'Lifting Equipment', validityMonths: 6, warningDays: 30, criticalDays: 14, isStatutory: true, legislation: 'LOLER 1998' },
  
  // HRB Specific
  { code: 'SC', name: 'Safety Case', category: 'HRB Specific', validityMonths: 24, warningDays: 90, criticalDays: 30, isStatutory: true, legislation: 'Building Safety Act 2022', appliesToHRB: true },
  { code: 'RES', name: 'Resident Engagement Strategy', category: 'HRB Specific', validityMonths: 24, warningDays: 90, criticalDays: 30, isStatutory: true, legislation: 'Building Safety Act 2022', appliesToHRB: true },
  { code: 'SIB', name: 'Secure Information Box', category: 'HRB Specific', validityMonths: 12, warningDays: 30, criticalDays: 14, isStatutory: true, legislation: 'Fire Safety Regs 2022', appliesToHRB: true }
];
```

---

## Summary

This specification provides:

1. **68 compliance types** covering all social housing requirements
2. **12 categories** for logical grouping
3. **Certificate code mappings** for document classification
4. **Keyword-based classification rules** for AI document processing
5. **Validity periods and alert thresholds** for each type
6. **Outcome classifications** (pass/fail/advisory)
7. **Property type applicability rules**
8. **Data extraction patterns** for certificate parsing
9. **Compliance score calculation** methodology
10. **Database schema** for storing compliance types
11. **API and UI configuration**

This enables ComplianceAI to handle the full range of social housing compliance requirements while maintaining clear classification and expiry tracking.
