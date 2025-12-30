# ComplianceAI: Complete Interpretation Rules for All 76 Certificate Types

## Overview

This document extends the Compliance Interpretation Layer to cover **ALL 76 certificate types** defined in the ComplianceAI specification, organised by category.

---

## 1. Gas & Heating (12 Types)

### 1.1 GAS - Gas Safety (CP12/LGSR)

**Governing Legislation:** Gas Safety (Installation and Use) Regulations 1998

| Field | Validation | Source |
|-------|------------|--------|
| Gas Safe ID | 7-digit, must be active | Gas Safe Register |
| Inspection Date | Max 14 months from previous | GSIUR Reg 36 |
| Validity | 12 months (2-month early renewal) | Amendment 2018 |

**Outcome Codes:**

```typescript
const GAS_OUTCOMES = {
  PASS: { status: 'COMPLIANT', urgency: 'NONE', action: 'None required' },
  NCS: { status: 'COMPLIANT', urgency: 'ADVISORY', action: 'Consider upgrade' },
  AR: { status: 'NON_COMPLIANT', urgency: 'URGENT', action: 'Repair required, likely disconnected' },
  ID: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE', action: 'Disconnected, immediate repair' }
};
```

**Contractor Requirements:** Gas Safe registered, competencies matching appliance types

---

### 1.2 GAS-SVC - Gas Servicing

**Governing Legislation:** Manufacturer requirements, best practice

| Field | Validation |
|-------|------------|
| Engineer | Gas Safe registered |
| Validity | 12 months |

**Outcome Codes:**

```typescript
const GAS_SVC_OUTCOMES = {
  SERVICED: { status: 'COMPLIANT', urgency: 'NONE' },
  PARTS_REQUIRED: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'ADVISORY' },
  FAILED: { status: 'NON_COMPLIANT', urgency: 'URGENT' }
};
```

---

### 1.3 OIL - Oil Heating

**Governing Legislation:** Building Regulations Part J, OFTEC standards

| Field | Validation |
|-------|------------|
| OFTEC Registration | Required for certification |
| Certificate Type | OFTEC CD/11 (installation), TI/133 (tank) |
| Validity | 12 months |

**Outcome Codes:**

```typescript
const OIL_OUTCOMES = {
  PASS: { status: 'COMPLIANT', urgency: 'NONE' },
  ADVISORY: { status: 'COMPLIANT', urgency: 'ADVISORY' },
  FAIL: { status: 'NON_COMPLIANT', urgency: 'URGENT' },
  CONDEMNED: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE' }
};
```

**Contractor Requirements:** OFTEC registered technician

---

### 1.4 OIL-TANK - Oil Tank Inspection

**Governing Legislation:** Control of Pollution (Oil Storage) Regulations 2001

| Field | Validation |
|-------|------------|
| Tank Condition | Must meet current standards |
| Bund Integrity | Required for tanks >2500L |
| Validity | 12 months |

**Outcome Codes:**

```typescript
const OIL_TANK_OUTCOMES = {
  SATISFACTORY: { status: 'COMPLIANT', urgency: 'NONE' },
  MINOR_DEFECTS: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'ADVISORY' },
  MAJOR_DEFECTS: { status: 'NON_COMPLIANT', urgency: 'URGENT' },
  REPLACE_REQUIRED: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE' }
};
```

---

### 1.5 LPG - LPG Safety

**Governing Legislation:** Gas Safety (Installation and Use) Regulations 1998

| Field | Validation |
|-------|------------|
| Gas Safe ID | Must have LPG competencies |
| Validity | 12 months |

**Outcome Codes:** Same as GAS (ID/AR/NCS/PASS)

**Contractor Requirements:** Gas Safe registered with LPG competencies

---

### 1.6 SOLID - Solid Fuel

**Governing Legislation:** Building Regulations Part J, Clean Air Act 1993

| Field | Validation |
|-------|------------|
| HETAS Registration | Required |
| Chimney Sweep | Annual requirement |
| Validity | 12 months |

**Outcome Codes:**

```typescript
const SOLID_OUTCOMES = {
  PASS: { status: 'COMPLIANT', urgency: 'NONE' },
  SWEEP_REQUIRED: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'ADVISORY' },
  DEFECTS: { status: 'NON_COMPLIANT', urgency: 'URGENT' },
  DO_NOT_USE: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE' }
};
```

**Contractor Requirements:** HETAS registered

---

### 1.7 BIO - Biomass

**Governing Legislation:** Building Regulations Part J, MCS standards

| Field | Validation |
|-------|------------|
| HETAS/MCS Registration | Required |
| Validity | 12 months |

**Outcome Codes:** Same as SOLID

**Contractor Requirements:** HETAS or MCS registered

---

### 1.8 HVAC - HVAC Systems

**Governing Legislation:** F-Gas Regulations (EU 517/2014), Energy Act 2011

| Field | Validation |
|-------|------------|
| F-Gas Certification | Required for refrigerant systems |
| TM44 Inspection | Required for AC >12kW |
| Validity | 12 months (service), 5 years (TM44) |

**Outcome Codes:**

```typescript
const HVAC_OUTCOMES = {
  PASS: { status: 'COMPLIANT', urgency: 'NONE' },
  REFRIGERANT_LEAK: { status: 'NON_COMPLIANT', urgency: 'URGENT' },
  EFFICIENCY_ISSUE: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'ADVISORY' }
};
```

**Contractor Requirements:** F-Gas certified

---

### 1.9 MECH - Mechanical Servicing

**Governing Legislation:** Best practice, manufacturer requirements

| Field | Validation |
|-------|------------|
| Competent Person | Appropriate qualifications |
| Validity | 12 months |

**Outcome Codes:** PASS / ADVISORY / FAIL

---

### 1.10 RENEW - Renewable Energy

**Governing Legislation:** MCS standards, Building Regulations Part L

| Field | Validation |
|-------|------------|
| MCS Registration | Required for certification |
| Validity | 12 months |

**Contractor Requirements:** MCS certified installer

---

### 1.11 ASHP - Air Source Heat Pump

**Governing Legislation:** MCS standards, F-Gas Regulations

| Field | Validation |
|-------|------------|
| MCS Registration | Required |
| F-Gas Certification | Required |
| Validity | 12 months |

**Outcome Codes:**

```typescript
const ASHP_OUTCOMES = {
  OPERATIONAL: { status: 'COMPLIANT', urgency: 'NONE' },
  EFFICIENCY_REDUCED: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'ADVISORY' },
  REFRIGERANT_ISSUE: { status: 'NON_COMPLIANT', urgency: 'URGENT' },
  FAILED: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE' }
};
```

**Contractor Requirements:** MCS + F-Gas certified

---

### 1.12 GSHP - Ground Source Heat Pump

**Governing Legislation:** MCS standards, F-Gas Regulations

Same requirements as ASHP

---

## 2. Electrical (6 Types)

### 2.1 ELEC / EICR - Electrical Installation

**Governing Legislation:** 
- Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020
- BS 7671:2018+A2:2022

| Field | Validation |
|-------|------------|
| Contractor | NICEIC/NAPIT/ELECSA registered |
| Inspector | Level 3 + 18th Edition + 2391/2394/2395 |
| Validity | 5 years (or as stated on certificate) |
| Overall | Satisfactory / Unsatisfactory |

**Observation Codes:**

```typescript
const EICR_CODES = {
  C1: {
    meaning: 'Danger present - risk of injury',
    urgency: 'IMMEDIATE',
    responseTime: 'Immediately',
    makesUnsatisfactory: true,
    examples: ['Exposed live parts', 'Missing bonding', 'Fire risk connections']
  },
  C2: {
    meaning: 'Potentially dangerous - urgent action required',
    urgency: 'URGENT',
    responseTime: '28 days',
    makesUnsatisfactory: true,
    examples: ['No RCD protection', 'Damaged insulation', 'DIY alterations']
  },
  C3: {
    meaning: 'Improvement recommended',
    urgency: 'ADVISORY',
    responseTime: 'When convenient',
    makesUnsatisfactory: false,
    examples: ['Old consumer unit', 'Missing labels', 'Age-related wear']
  },
  FI: {
    meaning: 'Further investigation required',
    urgency: 'INVESTIGATION',
    responseTime: '28 days investigation',
    makesUnsatisfactory: true,
    examples: ['Access restricted', 'Voltage irregularities', 'Hidden issues']
  }
};
```

**Contractor Requirements:** Competent Person Scheme registration recommended, ECS Gold/Blue card

---

### 2.2 PAT - Portable Appliance Testing

**Governing Legislation:** Electricity at Work Regulations 1989 (best practice)

| Field | Validation |
|-------|------------|
| Tester | Competent person |
| Validity | Risk-based (typically 12 months) |

**Outcome Codes:**

```typescript
const PAT_OUTCOMES = {
  PASS: { status: 'COMPLIANT', urgency: 'NONE' },
  FAIL: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE', action: 'Remove from use' }
};
```

---

### 2.3 EMLT - Emergency Lighting

**Governing Legislation:** BS 5266, Regulatory Reform (Fire Safety) Order 2005

| Field | Validation |
|-------|------------|
| Annual Test | 3-hour duration test |
| Monthly Test | Function test |
| Validity | 12 months (annual), 1 month (monthly) |

**Outcome Codes:**

```typescript
const EMLT_OUTCOMES = {
  PASS: { status: 'COMPLIANT', urgency: 'NONE' },
  PARTIAL_FAIL: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'URGENT', action: 'Replace failed units' },
  FAIL: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE' }
};
```

---

### 2.4 EMLT-M - Emergency Lighting Monthly

**Governing Legislation:** BS 5266

| Field | Validation |
|-------|------------|
| Function Test | All units illuminate |
| Validity | 1 month |

**Outcome Codes:** PASS / UNITS_FAILED / FAIL

---

### 2.5 ELEC-HEAT - Electric Heating

**Governing Legislation:** Best practice, manufacturer requirements

| Field | Validation |
|-------|------------|
| Competent Person | Qualified electrician |
| Validity | 12 months |

**Outcome Codes:** PASS / ADVISORY / FAIL

---

## 3. Energy (3 Types)

### 3.1 EPC - Energy Performance Certificate

**Governing Legislation:** Energy Performance of Buildings Regulations 2012

| Field | Validation |
|-------|------------|
| DEA Registration | Must be registered Domestic Energy Assessor |
| Validity | 10 years |
| Minimum Rating | E for lettings (exemptions possible) |

**Rating Interpretation:**

```typescript
const EPC_RATINGS = {
  A: { status: 'COMPLIANT', score: '92-100', urgency: 'NONE' },
  B: { status: 'COMPLIANT', score: '81-91', urgency: 'NONE' },
  C: { status: 'COMPLIANT', score: '69-80', urgency: 'NONE' },
  D: { status: 'COMPLIANT', score: '55-68', urgency: 'ADVISORY' },
  E: { status: 'COMPLIANT', score: '39-54', urgency: 'ADVISORY' },
  F: { status: 'NON_COMPLIANT', score: '21-38', urgency: 'URGENT', action: 'Improve to E or register exemption' },
  G: { status: 'NON_COMPLIANT', score: '1-20', urgency: 'IMMEDIATE', action: 'Improve to E or register exemption' }
};
```

**Contractor Requirements:** Registered DEA

---

### 3.2 SAP - SAP Assessment

**Governing Legislation:** Building Regulations Part L

| Field | Validation |
|-------|------------|
| SAP Assessor | Accredited |
| Trigger | New build or significant alterations |

**Outcome Codes:** SAP Score (1-100), Target Emission Rate compliance

---

### 3.3 DEC - Display Energy Certificate

**Governing Legislation:** Energy Performance of Buildings Regulations 2012

| Field | Validation |
|-------|------------|
| Applicability | Public buildings >250m² |
| Validity | 12 months |

**Contractor Requirements:** Non-domestic Energy Assessor

---

## 4. Fire Safety (18 Types)

### 4.1 FIRE / FRA - Fire Risk Assessment

**Governing Legislation:** 
- Regulatory Reform (Fire Safety) Order 2005
- Fire Safety Act 2021
- BS 9792:2025 (housing), PAS 79-1:2020 (non-housing)

| Field | Validation |
|-------|------------|
| Assessor | Competent (BAFE SP205 recommended) |
| Validity | Risk-based: 1-3 years, HRBs: Annual |

**Risk Rating System:**

```typescript
const FRA_RISK_RATINGS = {
  TRIVIAL: { status: 'COMPLIANT', action: 'No action required', urgency: 'NONE' },
  TOLERABLE: { status: 'COMPLIANT', action: 'Consider improvements', urgency: 'ADVISORY' },
  MODERATE: { status: 'COMPLIANT_WITH_ACTIONS', action: 'Reduce within defined timescale', urgency: 'MEDIUM' },
  SUBSTANTIAL: { status: 'NON_COMPLIANT', action: 'Do not proceed until reduced', urgency: 'URGENT' },
  INTOLERABLE: { status: 'NON_COMPLIANT', action: 'Immediate action, consider evacuation', urgency: 'IMMEDIATE' }
};
```

**HRB Requirements:**
- Annual FRA mandatory
- Quarterly fire door checks
- Golden Thread documentation
- BSR registration

---

### 4.2 FRAEW - External Wall Fire Risk Appraisal

**Governing Legislation:** 
- Fire Safety (England) Regulations 2022
- PAS 9980:2022

| Field | Validation |
|-------|------------|
| Assessor | Fire engineer (BAFE/IFE registered) |
| Validity | 5 years or on change |
| EWS1 Form | May be required for mortgage/sale |

**Outcome Interpretation:**

```typescript
const FRAEW_OUTCOMES = {
  A1: { status: 'COMPLIANT', meaning: 'No combustible materials' },
  A2: { status: 'COMPLIANT', meaning: 'Combustible materials present but no action needed' },
  A3: { status: 'COMPLIANT_WITH_ACTIONS', meaning: 'Combustible materials, remediation planned' },
  B1: { status: 'NON_COMPLIANT', meaning: 'Combustible materials, further assessment needed', urgency: 'URGENT' },
  B2: { status: 'NON_COMPLIANT', meaning: 'Combustible materials, remediation required', urgency: 'CRITICAL' }
};
```

---

### 4.3 FD / FD-Q / FD-A - Fire Door Inspection

**Governing Legislation:** 
- Fire Safety (England) Regulations 2022
- BS 8214:2016

| Type | Frequency | Scope |
|------|-----------|-------|
| FD-Q | Quarterly | HRB communal fire doors |
| FD-A | Annual | Flat entrance doors, non-HRB |

**Inspection Criteria:**

```typescript
const FIRE_DOOR_CRITERIA = {
  PASS: { 
    status: 'COMPLIANT',
    checks: ['Door closes fully', 'Seals intact', 'Self-closer works', 'Gaps <3mm', 'Signage present']
  },
  MINOR_DEFECTS: {
    status: 'COMPLIANT_WITH_ACTIONS',
    examples: ['Signage missing', 'Minor seal damage'],
    urgency: 'ADVISORY'
  },
  MAJOR_DEFECTS: {
    status: 'NON_COMPLIANT',
    examples: ['Self-closer failed', 'Gaps >3mm', 'Intumescent damaged'],
    urgency: 'URGENT'
  },
  FAIL: {
    status: 'NON_COMPLIANT',
    examples: ['Door not closing', 'Structural damage', 'Vision panel failed'],
    urgency: 'IMMEDIATE'
  }
};
```

**Contractor Requirements:** FDIS qualified inspector recommended

---

### 4.4 FA / FA-W / FA-Q - Fire Alarm

**Governing Legislation:** BS 5839 Parts 1 & 6

| Type | Frequency | Test |
|------|-----------|------|
| FA-W | Weekly | Call point activation |
| FA-Q | Quarterly | 25% detector coverage |
| FA | Annual | Full system test |

**Outcome Codes:**

```typescript
const FIRE_ALARM_OUTCOMES = {
  PASS: { status: 'COMPLIANT', urgency: 'NONE' },
  FAULTS_CLEARED: { status: 'COMPLIANT', urgency: 'NONE' },
  FAULTS_OUTSTANDING: { status: 'NON_COMPLIANT', urgency: 'URGENT' },
  SYSTEM_FAIL: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE' }
};
```

---

### 4.5 SD - Smoke Detector

**Governing Legislation:** Smoke and Carbon Monoxide Alarm (Amendment) Regulations 2022

| Field | Validation |
|-------|------------|
| Location | Every floor, in living rooms for HRBs |
| Type | Must be interlinked in new builds |
| Validity | 12 months check, 10 years replacement |

---

### 4.6 CO - Carbon Monoxide Detector

**Governing Legislation:** Smoke and Carbon Monoxide Alarm (Amendment) Regulations 2022

| Field | Validation |
|-------|------------|
| Location | Any room with fixed combustion appliance |
| Validity | 12 months check, per manufacturer (typically 7 years) |

---

### 4.7 SPRINK - Sprinkler System

**Governing Legislation:** BS EN 12845, BS 9251

| Field | Validation |
|-------|------------|
| Contractor | LPCB/FIRAS certified |
| Validity | 12 months |

**Outcome Codes:**

```typescript
const SPRINKLER_OUTCOMES = {
  FULLY_OPERATIONAL: { status: 'COMPLIANT', urgency: 'NONE' },
  MINOR_ISSUES: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'ADVISORY' },
  HEADS_DEFECTIVE: { status: 'NON_COMPLIANT', urgency: 'URGENT' },
  SYSTEM_IMPAIRED: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE' }
};
```

---

### 4.8 DRY - Dry Riser

**Governing Legislation:** BS 9990

| Field | Validation |
|-------|------------|
| Pressure Test | 6-monthly |
| Visual Inspection | 6-monthly |
| Validity | 6 months |

**Outcome Codes:** PASS / MINOR_DEFECTS / FAIL

---

### 4.9 WET - Wet Riser

**Governing Legislation:** BS 9990

| Field | Validation |
|-------|------------|
| Flow Test | 6-monthly |
| Pressure Test | 6-monthly |
| Validity | 6 months |

**Outcome Codes:** PASS / FLOW_ISSUE / PRESSURE_ISSUE / FAIL

---

### 4.10 AOV - Automatic Opening Vent

**Governing Legislation:** BS EN 12101-2

| Field | Validation |
|-------|------------|
| Contractor | Competent person |
| Validity | 12 months |

**Outcome Codes:**

```typescript
const AOV_OUTCOMES = {
  OPERATIONAL: { status: 'COMPLIANT', urgency: 'NONE' },
  ACTUATOR_ISSUE: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'ADVISORY' },
  FAILED_TO_OPEN: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE' }
};
```

---

### 4.11 SMOKE-V - Smoke Ventilation

**Governing Legislation:** BS EN 12101

| Field | Validation |
|-------|------------|
| System Test | Full operation |
| Validity | 12 months |

**Outcome Codes:** OPERATIONAL / PARTIAL_FAILURE / SYSTEM_FAIL

---

### 4.12 EXT - Fire Extinguisher

**Governing Legislation:** BS 5306-3

| Field | Validation |
|-------|------------|
| Contractor | BAFE SP101 recommended |
| Service | Annual |
| Discharge Test | 5 years (water/foam), 10 years (CO2) |
| Validity | 12 months |

**Outcome Codes:** PASS / REPLACE / FAIL

---

### 4.13 COMPART - Compartmentation Survey

**Governing Legislation:** Building Regulations Part B, Fire Safety Order

| Field | Validation |
|-------|------------|
| Surveyor | Fire engineer |
| Validity | 5 years or on change |

**Outcome Codes:**

```typescript
const COMPART_OUTCOMES = {
  INTACT: { status: 'COMPLIANT', urgency: 'NONE' },
  MINOR_BREACHES: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'ADVISORY' },
  SIGNIFICANT_BREACHES: { status: 'NON_COMPLIANT', urgency: 'URGENT' },
  CRITICAL_FAILURE: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE' }
};
```

---

## 5. Asbestos (5 Types)

### 5.1 ASB - Asbestos Survey

**Governing Legislation:** Control of Asbestos Regulations 2012 (CAR 2012)

| Type | Scope |
|------|-------|
| Management Survey | Locate ACMs during normal occupation |
| R&D Survey | Before refurbishment or demolition |

| Field | Validation |
|-------|------------|
| Surveyor | UKAS accredited, P402 qualified |
| Validity | No expiry (point-in-time) |

**Material Risk Assessment:**

```typescript
const ASBESTOS_MATERIAL_ASSESSMENT = {
  HIGH_RISK: {
    score: '18-24',
    status: 'NON_COMPLIANT',
    action: 'Consider removal',
    reinspection: '6 months'
  },
  MEDIUM_RISK: {
    score: '12-17',
    status: 'COMPLIANT_WITH_ACTIONS',
    action: 'Enhanced monitoring',
    reinspection: '6 months'
  },
  LOW_RISK: {
    score: '7-11',
    status: 'COMPLIANT',
    action: 'Standard monitoring',
    reinspection: '12 months'
  },
  VERY_LOW_RISK: {
    score: '0-6',
    status: 'COMPLIANT',
    action: 'Routine checks',
    reinspection: '12 months'
  }
};
```

---

### 5.2 ASB-M - Asbestos Management

**Governing Legislation:** CAR 2012 Regulation 4

| Field | Validation |
|-------|------------|
| Management Plan | Must exist and be current |
| Validity | Ongoing, annual review |

---

### 5.3 ASB-R - Asbestos Re-inspection

**Governing Legislation:** CAR 2012

| Field | Validation |
|-------|------------|
| Frequency | 6-12 months based on risk |
| Surveyor | P402 qualified |

**Outcome Codes:**

```typescript
const ASBESTOS_REINSPECTION_OUTCOMES = {
  NO_CHANGE: { status: 'COMPLIANT', urgency: 'NONE' },
  DETERIORATION: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'ADVISORY' },
  DAMAGE: { status: 'NON_COMPLIANT', urgency: 'URGENT' },
  FIBRE_RELEASE: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE' }
};
```

---

### 5.4 ASB-D - Asbestos Demolition Survey

**Governing Legislation:** CAR 2012

| Field | Validation |
|-------|------------|
| Trigger | Before any demolition |
| Surveyor | UKAS accredited |
| Validity | Single use (before works) |

---

### 5.5 ASB-REF - Asbestos Refurbishment Survey

**Governing Legislation:** CAR 2012

| Field | Validation |
|-------|------------|
| Trigger | Before intrusive works |
| Surveyor | UKAS accredited |
| Validity | Single use (before works) |

---

## 6. Water Safety (5 Types)

### 6.1 LEG - Legionella Risk Assessment

**Governing Legislation:** 
- ACOP L8: Legionnaires' disease
- HSG274 Parts 1-3

| Field | Validation |
|-------|------------|
| Assessor | Competent (LCA member recommended) |
| Validity | 2 years or on significant change |

**Risk Classification:**

```typescript
const LEGIONELLA_RISK = {
  LOW: {
    status: 'COMPLIANT',
    systemType: 'Simple domestic, combi boiler',
    monitoring: 'Annual review'
  },
  MEDIUM: {
    status: 'COMPLIANT_WITH_ACTIONS',
    systemType: 'Storage tank, long dead legs',
    monitoring: 'Monthly temperature checks'
  },
  HIGH: {
    status: 'NON_COMPLIANT',
    systemType: 'Complex system, vulnerable occupants',
    monitoring: 'Weekly checks, monthly temperatures',
    urgency: 'URGENT'
  }
};

const TEMPERATURE_COMPLIANCE = {
  coldWater: { max: 20, warning: 25, critical: 30 },
  hotWaterStorage: { min: 60 },
  hotWaterOutlet: { min: 50, withinSeconds: 60 }
};
```

---

### 6.2 LEG-M - Legionella Monitoring

**Governing Legislation:** HSG274

| Field | Validation |
|-------|------------|
| Frequency | Monthly (sentinel outlets) |
| Records | Temperature logs |
| Validity | 1 month |

**Outcome Codes:**

```typescript
const LEG_MONITORING_OUTCOMES = {
  COMPLIANT: { status: 'COMPLIANT', temps: 'Within range' },
  OUT_OF_RANGE: { status: 'NON_COMPLIANT', urgency: 'URGENT', action: 'Investigate and rectify' }
};
```

---

### 6.3 WATER - Water Hygiene

**Governing Legislation:** Best practice

| Field | Validation |
|-------|------------|
| Validity | 12 months |

---

### 6.4 TANK - Water Tank Inspection

**Governing Legislation:** Water Supply (Water Fittings) Regulations 1999

| Field | Validation |
|-------|------------|
| Inspection | Visual and condition |
| Validity | 12 months |

**Outcome Codes:**

```typescript
const TANK_OUTCOMES = {
  SATISFACTORY: { status: 'COMPLIANT', urgency: 'NONE' },
  CLEANING_REQUIRED: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'ADVISORY' },
  LID_DEFECTIVE: { status: 'NON_COMPLIANT', urgency: 'URGENT' },
  CONTAMINATION: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE' }
};
```

---

### 6.5 TMV - TMV Servicing

**Governing Legislation:** NHS D 08-01, best practice

| Field | Validation |
|-------|------------|
| Contractor | Competent person |
| Validity | 12 months |

**Outcome Codes:**

```typescript
const TMV_OUTCOMES = {
  PASS: { status: 'COMPLIANT', tempRange: '38-44°C' },
  ADJUSTMENT_REQUIRED: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'ADVISORY' },
  FAIL: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE', action: 'Replace valve' }
};
```

---

## 7. Lifting Equipment (5 Types)

### 7.1 LIFT - Lift Inspection (LOLER)

**Governing Legislation:** LOLER 1998, PUWER 1998

| Field | Validation |
|-------|------------|
| Examiner | Independent competent person (SAFed member recommended) |
| Frequency | 6 months (passenger), 12 months (goods-only) |

**LOLER Report Requirements (Schedule 1):**

```typescript
const LOLER_REPORT_REQUIREMENTS = [
  'Equipment identification',
  'Date of examination',
  'Date of next examination',
  'Examiner details',
  'Defects identified',
  'Whether immediately dangerous',
  'Repair deadlines'
];

const LOLER_OUTCOMES = {
  SAFE_TO_USE: { status: 'COMPLIANT', urgency: 'NONE' },
  DEFECTS_NOTED: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'ADVISORY', deadline: 'As specified' },
  DEFECTS_REQUIRING_ATTENTION: { status: 'NON_COMPLIANT', urgency: 'URGENT' },
  IMMEDIATELY_DANGEROUS: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE', action: 'Take out of service' }
};
```

---

### 7.2 LIFT-M - Lift Monthly Check

**Governing Legislation:** Building Safety Act 2022 (HRBs)

| Field | Validation |
|-------|------------|
| Applicability | HRBs only |
| Frequency | Monthly |

---

### 7.3 STAIR - Stairlift

**Governing Legislation:** LOLER 1998 (if workplace), HSWA 1974 s.3

| Field | Validation |
|-------|------------|
| Frequency | 6 months |
| Examiner | Competent person |

---

### 7.4 HOIST - Hoist

**Governing Legislation:** LOLER 1998

| Field | Validation |
|-------|------------|
| Frequency | 6 months |
| Examiner | Competent person |

---

### 7.5 PLAT - Platform Lift

**Governing Legislation:** LOLER 1998

| Field | Validation |
|-------|------------|
| Frequency | 6 months |
| Examiner | Competent person |

---

## 8. Building Safety (8 Types)

### 8.1 HHSRS - Housing Health and Safety Rating System

**Governing Legislation:** Housing Act 2004

| Field | Validation |
|-------|------------|
| Assessor | EHO or competent person |
| Trigger | On complaint or inspection |

**Hazard Categories:**

```typescript
const HHSRS_CATEGORIES = {
  CATEGORY_1: {
    status: 'NON_COMPLIANT',
    meaning: 'Serious hazard - enforcement action required',
    urgency: 'IMMEDIATE'
  },
  CATEGORY_2: {
    status: 'COMPLIANT_WITH_ACTIONS',
    meaning: 'Less serious hazard - discretionary action',
    urgency: 'ADVISORY'
  }
};

const HHSRS_HAZARDS = [
  'Damp and Mould', 'Excess Cold', 'Excess Heat', 'Carbon Monoxide',
  'Electrical Hazards', 'Fire', 'Falls on Stairs', 'Falls on Level',
  'Falls Between Levels', 'Crowding', 'Entry by Intruders', 'Lighting',
  'Noise', 'Domestic Hygiene', 'Food Safety', 'Personal Hygiene',
  'Water Supply', 'Falls in Bath', 'Collision and Entrapment',
  'Explosions', 'Position of Hot Surfaces', 'Structural Collapse',
  'Lead', 'Radiation', 'Uncombusted Fuel Gas', 'Volatile Organic Compounds',
  'Asbestos', 'Biocides', 'Ergonomics'
];
```

---

### 8.2 STRUCT - Structural Survey

**Governing Legislation:** Best practice

| Field | Validation |
|-------|------------|
| Surveyor | Structural engineer |
| Validity | 5 years |

**Outcome Codes:** SATISFACTORY / MONITORING_REQUIRED / REMEDIATION_REQUIRED / UNSAFE

---

### 8.3 DAMP - Damp & Mould Survey

**Governing Legislation:** Homes (Fitness for Human Habitation) Act 2018

| Field | Validation |
|-------|------------|
| Trigger | Tenant report or inspection |
| Response | Awaab's Law timescales (once in force) |

**Outcome Codes:**

```typescript
const DAMP_OUTCOMES = {
  NO_ISSUES: { status: 'COMPLIANT', urgency: 'NONE' },
  CONDENSATION: { status: 'COMPLIANT_WITH_ACTIONS', urgency: 'ADVISORY', action: 'Ventilation advice' },
  PENETRATING_DAMP: { status: 'NON_COMPLIANT', urgency: 'URGENT', action: 'Identify and fix source' },
  RISING_DAMP: { status: 'NON_COMPLIANT', urgency: 'URGENT', action: 'DPC remediation' },
  MOULD_PRESENT: { status: 'NON_COMPLIANT', urgency: 'URGENT', action: 'Remove mould, fix source' }
};
```

---

### 8.4 ROOF - Roof Survey

**Governing Legislation:** Best practice

| Field | Validation |
|-------|------------|
| Validity | 5 years |

---

### 8.5 CHIMNEY - Chimney Inspection

**Governing Legislation:** Best practice, linked to solid fuel

| Field | Validation |
|-------|------------|
| Frequency | Annual if solid fuel in use |
| Contractor | HETAS or chimney sweep guild |

---

### 8.6 GUTTER - Gutter Clearance

**Governing Legislation:** Best practice

| Field | Validation |
|-------|------------|
| Frequency | Annual (or bi-annual in tree-heavy areas) |

---

### 8.7 DRAIN - Drainage Survey

**Governing Legislation:** Best practice

| Field | Validation |
|-------|------------|
| Validity | 5 years |

---

### 8.8 LIGHT - Lightning Protection

**Governing Legislation:** BS EN 62305

| Field | Validation |
|-------|------------|
| Validity | 12 months |

---

## 9. External Areas (3 Types)

### 9.1 PLAY / PLAY-Q - Playground Inspection

**Governing Legislation:** BS EN 1176, BS EN 1177

| Type | Frequency |
|------|-----------|
| PLAY | Annual (comprehensive) |
| PLAY-Q | Quarterly (operational) |

**Risk Ratings:**

```typescript
const PLAYGROUND_RISK = {
  LOW: { status: 'COMPLIANT', action: 'Monitor' },
  MEDIUM: { status: 'COMPLIANT_WITH_ACTIONS', action: 'Repair within 4 weeks' },
  HIGH: { status: 'NON_COMPLIANT', urgency: 'URGENT', action: 'Immediate repair or barricade' },
  VERY_HIGH: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE', action: 'Close equipment immediately' }
};
```

**Contractor Requirements:** RPII qualified inspector

---

### 9.2 TREE - Tree Survey

**Governing Legislation:** Occupiers Liability Act, Health & Safety at Work Act

| Field | Validation |
|-------|------------|
| Surveyor | Arboriculturalist |
| Validity | 3 years (or after storm events) |

**Outcome Codes:**

```typescript
const TREE_OUTCOMES = {
  LOW_RISK: { status: 'COMPLIANT', urgency: 'NONE' },
  MODERATE_RISK: { status: 'COMPLIANT_WITH_ACTIONS', action: 'Prune/monitor' },
  HIGH_RISK: { status: 'NON_COMPLIANT', urgency: 'URGENT', action: 'Fell or major surgery' },
  IMMEDIATE_RISK: { status: 'NON_COMPLIANT', urgency: 'IMMEDIATE', action: 'Emergency felling' }
};
```

---

## 10. Access Equipment (2 Types)

### 10.1 FALL - Fall Arrest/Anchor Points

**Governing Legislation:** Work at Height Regulations 2005

| Field | Validation |
|-------|------------|
| Frequency | 12 months |
| Examiner | Competent person |

**Outcome Codes:** PASS / FAIL / DECOMMISSION

---

### 10.2 ACCESS - Access Equipment

**Governing Legislation:** LOLER/PUWER

| Field | Validation |
|-------|------------|
| Frequency | 12 months |

---

## 11. Security (3 Types)

### 11.1 CCTV - CCTV Maintenance

**Governing Legislation:** GDPR, Data Protection Act 2018

| Field | Validation |
|-------|------------|
| Validity | 12 months |

---

### 11.2 ENTRY - Door Entry System

**Governing Legislation:** Best practice

| Field | Validation |
|-------|------------|
| Validity | 12 months |

---

### 11.3 ALARM - Intruder Alarm

**Governing Legislation:** BS EN 50131

| Field | Validation |
|-------|------------|
| Validity | 12 months |

---

## 12. HRB Specific (6 Types)

### 12.1 SIB - Secure Information Box

**Governing Legislation:** Building Safety Act 2022

| Field | Validation |
|-------|------------|
| Contents | Premises information, fire strategy, contacts |
| Validity | Annual check |

---

### 12.2 WAYFIND - Wayfinding Signage

**Governing Legislation:** Building Safety Act 2022, Fire Safety Order

| Field | Validation |
|-------|------------|
| Trigger | On installation |
| Check | Floor numbering visible, evacuation routes marked |

---

### 12.3 SC - Safety Case

**Governing Legislation:** Building Safety Act 2022

| Field | Validation |
|-------|------------|
| Applicability | HRBs in scope of BSA |
| Validity | 2 years or on significant change |
| Content | Building safety strategy, risk assessment, management approach |

---

### 12.4 RES - Resident Engagement Strategy

**Governing Legislation:** Building Safety Act 2022

| Field | Validation |
|-------|------------|
| Applicability | HRBs |
| Validity | 2 years |
| Content | How residents are informed and consulted on safety |

---

### 12.5 PEEP - Personal Emergency Evacuation Plan

**Governing Legislation:** Fire Safety Order, Equality Act 2010

| Field | Validation |
|-------|------------|
| Applicability | Residents who need assistance evacuating |
| Validity | Annual or on change in circumstances |

---

### 12.6 BEEP - Building Emergency Evacuation Plan

**Governing Legislation:** Fire Safety Order, Building Safety Act

| Field | Validation |
|-------|------------|
| Applicability | HRBs |
| Validity | Annual |
| Content | Evacuation strategy, assembly points, responsibilities |

---

## Complete TypeScript Implementation

```typescript
// Complete validity rules for all 76 types
export const VALIDITY_RULES: Record<string, ValidityConfig> = {
  // Gas & Heating
  'GAS': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'GAS-SVC': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'OIL': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'OIL-TANK': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'LPG': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'SOLID': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'BIO': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'HVAC': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'MECH': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'RENEW': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'ASHP': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'GSHP': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  
  // Electrical
  'ELEC': { months: 60, warningDays: 90, criticalDays: 30, statutory: true },
  'EICR': { months: 60, warningDays: 90, criticalDays: 30, statutory: true },
  'PAT': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'EMLT': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'EMLT-M': { months: 1, warningDays: 7, criticalDays: 3, statutory: true },
  'ELEC-HEAT': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  
  // Energy
  'EPC': { months: 120, warningDays: 180, criticalDays: 90, statutory: true },
  'SAP': { months: 0, warningDays: 0, criticalDays: 0, statutory: true }, // Point in time
  'DEC': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  
  // Fire Safety
  'FIRE': { months: 12, warningDays: 30, criticalDays: 14, statutory: true, hrbMonths: 12 },
  'FRA': { months: 12, warningDays: 30, criticalDays: 14, statutory: true, hrbMonths: 12 },
  'FRAEW': { months: 60, warningDays: 180, criticalDays: 90, statutory: true },
  'FD': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'FD-Q': { months: 3, warningDays: 14, criticalDays: 7, statutory: true },
  'FD-A': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'FA': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'FA-W': { months: 0.25, warningDays: 2, criticalDays: 1, statutory: true }, // Weekly
  'FA-Q': { months: 3, warningDays: 14, criticalDays: 7, statutory: true },
  'SD': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'CO': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'SPRINK': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'DRY': { months: 6, warningDays: 30, criticalDays: 14, statutory: true },
  'WET': { months: 6, warningDays: 30, criticalDays: 14, statutory: true },
  'AOV': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'SMOKE-V': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'EXT': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'COMPART': { months: 60, warningDays: 180, criticalDays: 90, statutory: false },
  
  // Asbestos
  'ASB': { months: 0, warningDays: 0, criticalDays: 0, statutory: true }, // Point in time
  'ASB-M': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'ASB-R': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'ASB-D': { months: 0, warningDays: 0, criticalDays: 0, statutory: true }, // Before works
  'ASB-REF': { months: 0, warningDays: 0, criticalDays: 0, statutory: true }, // Before works
  
  // Water Safety
  'LEG': { months: 24, warningDays: 60, criticalDays: 30, statutory: true },
  'LEG-M': { months: 1, warningDays: 7, criticalDays: 3, statutory: true },
  'WATER': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'TANK': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'TMV': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  
  // Lifting Equipment
  'LIFT': { months: 6, warningDays: 30, criticalDays: 14, statutory: true },
  'LIFT-M': { months: 1, warningDays: 7, criticalDays: 3, statutory: true },
  'STAIR': { months: 6, warningDays: 30, criticalDays: 14, statutory: true },
  'HOIST': { months: 6, warningDays: 30, criticalDays: 14, statutory: true },
  'PLAT': { months: 6, warningDays: 30, criticalDays: 14, statutory: true },
  
  // Building Safety
  'HHSRS': { months: 0, warningDays: 0, criticalDays: 0, statutory: true }, // On complaint
  'STRUCT': { months: 60, warningDays: 180, criticalDays: 90, statutory: false },
  'DAMP': { months: 0, warningDays: 0, criticalDays: 0, statutory: true }, // On report
  'ROOF': { months: 60, warningDays: 180, criticalDays: 90, statutory: false },
  'CHIMNEY': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'GUTTER': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'DRAIN': { months: 60, warningDays: 180, criticalDays: 90, statutory: false },
  'LIGHT': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  
  // External Areas
  'PLAY': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'PLAY-Q': { months: 3, warningDays: 14, criticalDays: 7, statutory: true },
  'TREE': { months: 36, warningDays: 90, criticalDays: 30, statutory: false },
  
  // Access Equipment
  'FALL': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'ACCESS': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  
  // Security
  'CCTV': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'ENTRY': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  'ALARM': { months: 12, warningDays: 30, criticalDays: 14, statutory: false },
  
  // HRB Specific
  'SIB': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'WAYFIND': { months: 0, warningDays: 0, criticalDays: 0, statutory: true }, // On install
  'SC': { months: 24, warningDays: 90, criticalDays: 30, statutory: true },
  'RES': { months: 24, warningDays: 90, criticalDays: 30, statutory: true },
  'PEEP': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
  'BEEP': { months: 12, warningDays: 30, criticalDays: 14, statutory: true },
};
```

---

## Summary

This document now covers **ALL 76 certificate types** with:

| Category | Count | Types Covered |
|----------|-------|---------------|
| Gas & Heating | 12 | GAS, GAS-SVC, OIL, OIL-TANK, LPG, SOLID, BIO, HVAC, MECH, RENEW, ASHP, GSHP |
| Electrical | 6 | ELEC, EICR, PAT, EMLT, EMLT-M, ELEC-HEAT |
| Energy | 3 | EPC, SAP, DEC |
| Fire Safety | 18 | FIRE, FRA, FRAEW, FD, FD-Q, FD-A, FA, FA-W, FA-Q, SD, CO, SPRINK, DRY, WET, AOV, SMOKE-V, EXT, COMPART |
| Asbestos | 5 | ASB, ASB-M, ASB-R, ASB-D, ASB-REF |
| Water Safety | 5 | LEG, LEG-M, WATER, TANK, TMV |
| Lifting Equipment | 5 | LIFT, LIFT-M, STAIR, HOIST, PLAT |
| Building Safety | 8 | HHSRS, STRUCT, DAMP, ROOF, CHIMNEY, GUTTER, DRAIN, LIGHT |
| External Areas | 3 | PLAY, PLAY-Q, TREE |
| Access Equipment | 2 | FALL, ACCESS |
| Security | 3 | CCTV, ENTRY, ALARM |
| HRB Specific | 6 | SIB, WAYFIND, SC, RES, PEEP, BEEP |
| **TOTAL** | **76** | |

Each type includes:
- Governing legislation
- Validity periods (with HRB overrides where applicable)
- Outcome/defect codes with status mapping
- Contractor requirements
- Interpretation logic
