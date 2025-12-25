# ComplianceAI™ Model Ownership — Phase 1
## Schema & Validation Foundation

---

## Phase Overview

| Aspect | Details |
|--------|---------|
| **Duration** | Week 1 (3-5 days) |
| **Objective** | Establish versioned extraction schemas and validators |
| **Prerequisites** | Core app built (from Complete Build Guide) |
| **Outcome** | Type-safe extraction output with JSON validation |

```
WHAT WE'RE BUILDING:

┌─────────────────────────────────────────────────────────┐
│              BEHAVIOUR CONTRACT                         │
│                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌───────────┐  │
│   │  TypeScript │ -> │    Zod      │ -> │  Database │  │
│   │   Types     │    │  Validators │    │  Schema   │  │
│   └─────────────┘    └─────────────┘    └───────────┘  │
│                                                         │
│   "If it doesn't match the schema, it's not valid"     │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Add Database Tables

### Prompt 1.1: Database Schema Migration

Copy this entire prompt into Replit Agent:

```
Add new database tables to support the extraction schema system and model tracking.

Update prisma/schema.prisma by ADDING these new models (keep all existing models):

// ==========================================
// EXTRACTION SCHEMAS (Behaviour Contract)
// ==========================================

model ExtractionSchema {
  id              String   @id @default(cuid())
  version         String   // "v1.0", "v1.1", etc.
  documentType    String   // GAS_SAFETY, EICR, FRA, etc.
  schemaJson      Json     // The actual JSON schema definition
  promptTemplate  String?  @db.Text // Associated prompt template
  isActive        Boolean  @default(false)
  isDeprecated    Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  extractionRuns  ExtractionRun[]
  
  @@unique([version, documentType])
  @@index([documentType, isActive])
}

// ==========================================
// EXTRACTION RUNS (Raw Model Output)
// ==========================================

model ExtractionRun {
  id                String   @id @default(cuid())
  certificateId     String
  schemaId          String?
  
  // Model info
  modelVersion      String   // "claude-sonnet-4-20250514"
  promptVersion     String   // "gas_v1.0"
  schemaVersion     String   // "v1.0"
  
  // Document classification
  documentType      String
  classificationConfidence Float @default(0)
  
  // Extraction outputs (progressive refinement)
  rawOutput         Json     // First-pass extraction from AI
  validatedOutput   Json?    // After schema validation
  repairedOutput    Json?    // After repair prompts (Phase 3)
  normalisedOutput  Json?    // After normalisation rules (Phase 6)
  finalOutput       Json?    // After human review (Phase 4)
  
  // Quality metrics
  confidence        Float    @default(0)
  processingTier    Int      @default(4)
  processingTimeMs  Int      @default(0)
  processingCost    Float    @default(0)
  
  // Validation tracking
  validationErrors  Json     @default("[]")
  validationPassed  Boolean  @default(false)
  repairAttempts    Int      @default(0)
  
  // Status
  status            ExtractionStatus @default(PENDING)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  certificate       Certificate       @relation(fields: [certificateId], references: [id], onDelete: Cascade)
  schema            ExtractionSchema? @relation(fields: [schemaId], references: [id])
  humanReview       HumanReview?
  
  @@index([certificateId])
  @@index([documentType, createdAt])
  @@index([status])
}

enum ExtractionStatus {
  PENDING
  PROCESSING
  VALIDATION_FAILED
  REPAIR_IN_PROGRESS
  AWAITING_REVIEW
  APPROVED
  REJECTED
}

// ==========================================
// HUMAN REVIEWS (Data Flywheel - Phase 4)
// ==========================================

model HumanReview {
  id                String   @id @default(cuid())
  extractionRunId   String   @unique
  reviewerId        String
  organisationId    String
  
  // The approved output
  approvedOutput    Json
  
  // What changed (for learning)
  fieldChanges      Json     @default("[]") // [{field, before, after, reason}]
  addedItems        Json     @default("[]")
  removedItems      Json     @default("[]")
  
  // Error categorisation for improvement targeting
  errorTags         String[] // ["missed_table_row", "wrong_date_format"]
  
  // Quality indicators
  wasCorrect        Boolean  @default(false) // No changes needed
  changeCount       Int      @default(0)
  reviewTimeSeconds Int?
  
  // Notes
  reviewerNotes     String?
  
  reviewedAt        DateTime @default(now())
  
  extractionRun     ExtractionRun @relation(fields: [extractionRunId], references: [id], onDelete: Cascade)
  reviewer          User          @relation(fields: [reviewerId], references: [id])
  organisation      Organisation  @relation(fields: [organisationId], references: [id])
  
  @@index([organisationId, reviewedAt])
  @@index([reviewerId])
  @@index([errorTags])
}

// ==========================================
// BENCHMARKS (Evaluation - Phase 5)
// ==========================================

model BenchmarkSet {
  id              String   @id @default(cuid())
  name            String   // "benchmark_v1", "eicr_edge_cases"
  description     String?
  documentTypes   String[] // Which doc types this covers
  isLocked        Boolean  @default(false)
  itemCount       Int      @default(0)
  
  createdAt       DateTime @default(now())
  lockedAt        DateTime?
  
  items           BenchmarkItem[]
  evalRuns        EvalRun[]
}

model BenchmarkItem {
  id                String   @id @default(cuid())
  benchmarkSetId    String
  certificateId     String
  
  // The "gold standard" expected output
  expectedOutput    Json
  
  // Metadata about difficulty
  difficulty        String   @default("medium") // "easy", "medium", "hard"
  challengeTypes    String[] // ["messy_scan", "handwritten", "multi_page"]
  notes             String?
  
  createdAt         DateTime @default(now())
  
  benchmarkSet      BenchmarkSet @relation(fields: [benchmarkSetId], references: [id], onDelete: Cascade)
  certificate       Certificate  @relation(fields: [certificateId], references: [id])
  
  @@unique([benchmarkSetId, certificateId])
}

model EvalRun {
  id                String   @id @default(cuid())
  benchmarkSetId    String
  
  // What was tested
  modelVersion      String
  promptVersion     String
  schemaVersion     String
  
  // Aggregate scores
  overallScore      Float
  exactMatchRate    Float
  evidenceAccuracy  Float
  schemaValidRate   Float
  
  // Detailed results
  scores            Json     // {by_field, by_doc_type}
  itemResults       Json     // Per-item scores
  
  // Comparison to previous
  previousRunId     String?
  regressions       Json     @default("[]")
  improvements      Json     @default("[]")
  scoreDelta        Float?
  
  // Release decision
  passedGating      Boolean?
  gatingNotes       String?
  
  createdAt         DateTime @default(now())
  
  benchmarkSet      BenchmarkSet @relation(fields: [benchmarkSetId], references: [id])
  previousRun       EvalRun?     @relation("EvalComparison", fields: [previousRunId], references: [id])
  nextRuns          EvalRun[]    @relation("EvalComparison")
  
  @@index([benchmarkSetId, createdAt])
}

// ==========================================
// COMPLIANCE RULES (Domain Logic - Phase 6)
// ==========================================

model ComplianceRule {
  id                String   @id @default(cuid())
  ruleCode          String   @unique  // "EICR_C1_URGENT"
  ruleName          String
  documentType      String
  
  // Rule definition
  conditions        Json     // [{field, operator, value}]
  conditionLogic    String   @default("AND") // "AND" or "OR"
  
  // Actions
  action            String   // "FLAG_URGENT", "MARK_INCOMPLETE", "AUTO_FAIL", "INFO"
  priority          String?  // "P1", "P2", "P3"
  
  // Documentation
  description       String
  legislation       String?
  
  isActive          Boolean  @default(true)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([documentType, isActive])
}

model NormalisationRule {
  id              String   @id @default(cuid())
  ruleName        String
  fieldPath       String   // "engineer.company", "inspection.outcome"
  ruleType        String   // "MAPPING", "REGEX", "TRANSFORM"
  
  // Rule definition
  inputPatterns   String[] // Patterns to match
  outputValue     String?  // Mapped value (for MAPPING type)
  transformFn     String?  // Transform function name (for TRANSFORM type)
  
  priority        Int      @default(0) // Higher = applied first
  isActive        Boolean  @default(true)
  
  @@index([fieldPath, isActive])
}

Also ADD these relations to EXISTING models:

In the Certificate model, add:
  extractionRuns  ExtractionRun[]
  benchmarkItems  BenchmarkItem[]

In the User model, add:
  humanReviews    HumanReview[]

In the Organisation model, add:
  humanReviews    HumanReview[]

After updating the schema, run:
npx prisma migrate dev --name add_model_ownership_tables
npx prisma generate

Then verify the migration succeeded by checking that all new tables exist.
```

---

## Step 2: Create TypeScript Types

### Prompt 1.2: Extraction Schema Types

```
Create TypeScript types for the extraction schemas.

1. Create directory: src/lib/extraction-schemas/

2. Create src/lib/extraction-schemas/types.ts:

// ==========================================
// CORE TYPES
// ==========================================

export type DocumentType = 
  | 'GAS_SAFETY' 
  | 'EICR' 
  | 'FIRE_RISK_ASSESSMENT' 
  | 'ASBESTOS' 
  | 'LEGIONELLA' 
  | 'EPC' 
  | 'LIFT_LOLER'
  | 'SMOKE_CO_ALARM'
  | 'UNKNOWN';

export type InspectionOutcome = 
  | 'PASS' 
  | 'FAIL' 
  | 'SATISFACTORY' 
  | 'UNSATISFACTORY' 
  | 'ADVISORY' 
  | 'INCOMPLETE'
  | 'NOT_APPLICABLE';

export type Priority = 'P1' | 'P2' | 'P3';
export type Severity = 'info' | 'warning' | 'critical';

// ==========================================
// EVIDENCE (Critical for accuracy)
// ==========================================

export interface Evidence {
  page: number;
  text_snippet: string;
  bbox?: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ==========================================
// FINDINGS
// ==========================================

export interface Observation {
  id: string;
  description: string;
  location: string | null;
  severity: Severity | null;
  code?: string;  // e.g., C1, C2, C3 for EICR
  evidence: Evidence | null;
}

export interface RemedialAction {
  id: string;
  description: string;
  priority: Priority | null;
  due_date: string | null;  // ISO date
  location: string | null;
  status?: 'open' | 'in_progress' | 'completed';
  evidence: Evidence | null;
}

export interface MissingField {
  field: string;
  reason: 'not_found' | 'unclear' | 'not_applicable' | 'poor_quality';
}

// ==========================================
// BASE EXTRACTION SCHEMA
// ==========================================

export interface BaseExtractionSchema {
  // Schema metadata
  schema_version: string;
  document_type: DocumentType;
  
  // Source document info
  source: {
    filename: string;
    upload_id: string;
    pages: number;
    processing_tier: number;
  };
  
  // Property information
  property: {
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    postcode: string | null;
    uprn: string | null;
    evidence: Evidence | null;
  };
  
  // Inspection details
  inspection: {
    date: string | null;  // ISO date YYYY-MM-DD
    next_due_date: string | null;
    outcome: InspectionOutcome | null;
    standard: string | null;  // Regulatory standard reference
    evidence: Evidence | null;
  };
  
  // Engineer/Inspector details
  engineer: {
    name: string | null;
    company: string | null;
    registration_id: string | null;
    registration_type: string | null;
    qualification: string | null;
    evidence: Evidence | null;
  };
  
  // Findings
  findings: {
    observations: Observation[];
    remedial_actions: RemedialAction[];
  };
  
  // Extraction quality metadata
  extraction_metadata: {
    confidence: number;  // 0.0 to 1.0
    missing_fields: MissingField[];
    warnings: string[];
    processing_notes: string[];
  };
}

// ==========================================
// HELPER TYPES
// ==========================================

export interface ExtractionResult<T extends BaseExtractionSchema = BaseExtractionSchema> {
  success: boolean;
  data: T;
  validation: {
    valid: boolean;
    errors: ValidationError[];
  };
  processing: {
    tier: number;
    cost: number;
    time_ms: number;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

3. Create src/lib/extraction-schemas/gas-safety.ts:

import { 
  BaseExtractionSchema, 
  Evidence, 
  Priority 
} from './types';

// ==========================================
// GAS SAFETY CERTIFICATE SCHEMA (LGSR/CP12)
// ==========================================

export interface GasAppliance {
  id: string;
  type: string;  // "Boiler", "Fire", "Cooker", "Water Heater"
  location: string | null;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  
  checks: {
    flue_flow: 'pass' | 'fail' | 'na' | null;
    spillage: 'pass' | 'fail' | 'na' | null;
    ventilation: 'pass' | 'fail' | 'na' | null;
    visual_condition: 'pass' | 'fail' | null;
    operation: 'pass' | 'fail' | null;
    safety_device: 'pass' | 'fail' | 'na' | null;
  };
  
  result: 'PASS' | 'FAIL' | 'NOT_TESTED' | 'NOT_INSPECTED';
  defects: string[];
  actions_required: string[];
  evidence: Evidence | null;
}

export interface GasSafetySchema extends BaseExtractionSchema {
  document_type: 'GAS_SAFETY';
  
  gas_specific: {
    // Certificate info
    certificate_number: string | null;
    certificate_type: 'LGSR' | 'CP12' | 'SERVICE' | 'OTHER' | null;
    
    // Landlord details
    landlord_name: string | null;
    landlord_address: string | null;
    
    // Gas Safe registration
    gas_safe_number: string | null;  // 6-7 digits
    gas_safe_id_verified: boolean | null;
    
    // Appliances
    appliances: GasAppliance[];
    appliance_count: number;
    
    // Safety checks
    safety_checks: {
      flue_flow_test: boolean | null;
      spillage_test: boolean | null;
      ventilation_adequate: boolean | null;
      visual_condition: 'satisfactory' | 'unsatisfactory' | null;
      pipework_condition: 'satisfactory' | 'unsatisfactory' | null;
    };
    
    // Alarms
    alarms: {
      co_alarm_present: boolean | null;
      co_alarm_tested: boolean | null;
      co_alarm_working: boolean | null;
      smoke_alarm_present: boolean | null;
      smoke_alarm_tested: boolean | null;
    };
    
    // Meter info
    meter: {
      location: string | null;
      emergency_control_accessible: boolean | null;
    };
  };
}

// Default empty Gas Safety extraction
export function createEmptyGasSafetyExtraction(): GasSafetySchema {
  return {
    schema_version: 'v1.0',
    document_type: 'GAS_SAFETY',
    source: {
      filename: '',
      upload_id: '',
      pages: 0,
      processing_tier: 4,
    },
    property: {
      address_line_1: null,
      address_line_2: null,
      city: null,
      postcode: null,
      uprn: null,
      evidence: null,
    },
    inspection: {
      date: null,
      next_due_date: null,
      outcome: null,
      standard: 'Gas Safety (Installation and Use) Regulations 1998',
      evidence: null,
    },
    engineer: {
      name: null,
      company: null,
      registration_id: null,
      registration_type: 'Gas Safe',
      qualification: null,
      evidence: null,
    },
    findings: {
      observations: [],
      remedial_actions: [],
    },
    gas_specific: {
      certificate_number: null,
      certificate_type: null,
      landlord_name: null,
      landlord_address: null,
      gas_safe_number: null,
      gas_safe_id_verified: null,
      appliances: [],
      appliance_count: 0,
      safety_checks: {
        flue_flow_test: null,
        spillage_test: null,
        ventilation_adequate: null,
        visual_condition: null,
        pipework_condition: null,
      },
      alarms: {
        co_alarm_present: null,
        co_alarm_tested: null,
        co_alarm_working: null,
        smoke_alarm_present: null,
        smoke_alarm_tested: null,
      },
      meter: {
        location: null,
        emergency_control_accessible: null,
      },
    },
    extraction_metadata: {
      confidence: 0,
      missing_fields: [],
      warnings: [],
      processing_notes: [],
    },
  };
}

4. Create src/lib/extraction-schemas/eicr.ts:

import { BaseExtractionSchema, Evidence } from './types';

// ==========================================
// EICR SCHEMA (Electrical Installation Condition Report)
// ==========================================

export type EICRCodeType = 'C1' | 'C2' | 'C3' | 'FI' | 'LIM' | 'N/A';

export interface EICRCode {
  id: string;
  code: EICRCodeType;
  description: string;
  location: string | null;
  circuit: string | null;
  item_number: string | null;
  evidence: Evidence | null;
}

export interface EICRSchema extends BaseExtractionSchema {
  document_type: 'EICR';
  
  eicr_specific: {
    // Report details
    report_reference: string | null;
    report_type: 'PERIODIC' | 'INITIAL' | 'MINOR_WORKS' | null;
    
    // Overall assessment
    overall_assessment: 'SATISFACTORY' | 'UNSATISFACTORY' | 'FURTHER_INVESTIGATION' | null;
    
    // Client details
    client_name: string | null;
    client_address: string | null;
    
    // Registration
    registration: {
      scheme: string | null;  // "NICEIC", "NAPIT", "ELECSA", etc.
      registration_number: string | null;
    };
    
    // Installation details
    installation_details: {
      age_of_installation: string | null;
      evidence_of_alterations: boolean | null;
      alterations_details: string | null;
      consumer_unit_location: string | null;
      consumer_unit_type: string | null;
      earthing_arrangement: string | null;  // TN-S, TN-C-S, TT, etc.
      main_switch_rating: string | null;
    };
    
    // Test results summary
    test_results: {
      circuits_tested: number | null;
      circuits_satisfactory: number | null;
      rcd_present: boolean | null;
      rcd_tested: boolean | null;
    };
    
    // Codes found
    codes: EICRCode[];
    code_summary: {
      c1_count: number;
      c2_count: number;
      c3_count: number;
      fi_count: number;
    };
    
    // Limitations
    limitations: string[];
    
    // Recommended interval
    recommended_interval_months: number | null;
  };
}

5. Create src/lib/extraction-schemas/fire-risk.ts:

import { BaseExtractionSchema, Evidence, Priority } from './types';

// ==========================================
// FIRE RISK ASSESSMENT SCHEMA
// ==========================================

export type RiskLevel = 'TRIVIAL' | 'TOLERABLE' | 'MODERATE' | 'SUBSTANTIAL' | 'INTOLERABLE';

export interface FireHazard {
  id: string;
  category: string;  // "Sources of ignition", "Fuel sources", etc.
  description: string;
  location: string | null;
  risk_level: RiskLevel | null;
  control_measures: string[];
  evidence: Evidence | null;
}

export interface FireAction {
  id: string;
  action: string;
  priority: Priority;
  responsible_person: string | null;
  target_date: string | null;  // ISO date
  category: string | null;
  evidence: Evidence | null;
}

export interface FireRiskSchema extends BaseExtractionSchema {
  document_type: 'FIRE_RISK_ASSESSMENT';
  
  fra_specific: {
    // Assessment details
    assessment_reference: string | null;
    assessment_type: 'TYPE_1' | 'TYPE_2' | 'TYPE_3' | 'TYPE_4' | null;
    
    // Overall risk
    overall_risk: RiskLevel | null;
    
    // Building details
    building: {
      type: string | null;  // "Block of flats", "House", etc.
      floors: number | null;
      construction_type: string | null;
      year_built: string | null;
      occupancy_type: string | null;
      sleeping_risk: boolean | null;
    };
    
    // Fire safety systems
    fire_safety_systems: {
      detection_type: string | null;  // "Grade A", "LD1", etc.
      alarm_type: string | null;
      emergency_lighting: boolean | null;
      emergency_lighting_adequate: boolean | null;
      sprinklers: boolean | null;
      dry_riser: boolean | null;
      wet_riser: boolean | null;
    };
    
    // Means of escape
    means_of_escape: {
      escape_routes_adequate: boolean | null;
      signage_adequate: boolean | null;
      travel_distances_acceptable: boolean | null;
      final_exits_adequate: boolean | null;
      issues: string[];
    };
    
    // Compartmentation
    compartmentation: {
      adequate: boolean | null;
      flat_entrance_doors: 'FD30' | 'FD60' | 'NON_FIRE' | 'MIXED' | null;
      issues: string[];
    };
    
    // Hazards and actions
    hazards: FireHazard[];
    actions: FireAction[];
    
    // Priority summary
    priority_summary: {
      immediate_actions: number;
      short_term_actions: number;
      medium_term_actions: number;
    };
  };
}

6. Create src/lib/extraction-schemas/asbestos.ts:

import { BaseExtractionSchema, Evidence } from './types';

// ==========================================
// ASBESTOS SURVEY SCHEMA
// ==========================================

export type AsbestosType = 'CHRYSOTILE' | 'AMOSITE' | 'CROCIDOLITE' | 'MIXED' | 'PRESUMED' | 'NOT_DETECTED';
export type MaterialCondition = 'GOOD' | 'LOW' | 'MEDIUM' | 'HIGH' | 'DAMAGED';
export type SurveyType = 'MANAGEMENT' | 'REFURBISHMENT' | 'DEMOLITION' | 'REINSPECTION';

export interface AsbestosMaterial {
  id: string;
  location: string;
  room: string | null;
  material_type: string;  // "Textured coating", "Floor tiles", etc.
  asbestos_type: AsbestosType;
  condition: MaterialCondition;
  surface_treatment: string | null;
  accessibility: 'EASY' | 'MEDIUM' | 'DIFFICULT' | null;
  
  // Risk assessment
  material_score: number | null;
  priority_score: number | null;
  total_risk_score: number | null;
  
  // Recommendations
  recommendation: 'MANAGE' | 'ENCAPSULATE' | 'REMOVE' | 'LABEL' | 'MONITOR' | null;
  
  evidence: Evidence | null;
}

export interface AsbestosSchema extends BaseExtractionSchema {
  document_type: 'ASBESTOS';
  
  asbestos_specific: {
    // Survey details
    survey_reference: string | null;
    survey_type: SurveyType | null;
    
    // Surveyor details
    surveyor_qualifications: string | null;
    ukas_accreditation: string | null;
    
    // Results summary
    asbestos_found: boolean;
    acm_count: number;  // Asbestos Containing Materials count
    presumed_count: number;
    
    // Materials found
    materials: AsbestosMaterial[];
    
    // Risk summary
    risk_summary: {
      high_risk_count: number;
      medium_risk_count: number;
      low_risk_count: number;
    };
    
    // Recommendations
    management_recommendations: string[];
    removal_required: boolean;
    
    // Re-inspection
    reinspection_date: string | null;  // ISO date
    reinspection_interval_months: number | null;
    
    // Areas not accessed
    areas_not_accessed: string[];
    limitations: string[];
  };
}

7. Create src/lib/extraction-schemas/legionella.ts:

import { BaseExtractionSchema, Evidence, Priority } from './types';

// ==========================================
// LEGIONELLA RISK ASSESSMENT SCHEMA
// ==========================================

export type WaterSystemType = 'HOT_WATER' | 'COLD_WATER' | 'COOLING_TOWER' | 'SPA' | 'OTHER';

export interface WaterSystem {
  id: string;
  system_type: WaterSystemType;
  description: string;
  location: string | null;
  
  // Risk factors
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  dead_legs: boolean | null;
  storage_tanks: boolean | null;
  
  // Temperature readings
  temperatures: {
    hot_flow: number | null;  // °C
    hot_return: number | null;
    cold: number | null;
    sentinel_taps_compliant: boolean | null;
  };
  
  // Control measures
  control_measures: string[];
  
  evidence: Evidence | null;
}

export interface LegionellaAction {
  id: string;
  action: string;
  priority: Priority;
  system: string | null;
  responsible_person: string | null;
  target_date: string | null;
  evidence: Evidence | null;
}

export interface LegionellaSchema extends BaseExtractionSchema {
  document_type: 'LEGIONELLA';
  
  legionella_specific: {
    // Assessment details
    assessment_reference: string | null;
    
    // Responsible person
    responsible_person: string | null;
    competent_person: string | null;
    
    // Overall risk
    overall_risk: 'LOW' | 'MEDIUM' | 'HIGH' | null;
    
    // Water systems
    water_systems: WaterSystem[];
    
    // Temperature compliance
    temperature_compliance: {
      hot_water_compliant: boolean | null;  // >50°C at outlets
      cold_water_compliant: boolean | null;  // <20°C
      calorifier_compliant: boolean | null;  // >60°C
    };
    
    // Schematic available
    schematic_available: boolean | null;
    
    // Control scheme
    control_scheme: {
      in_place: boolean | null;
      flushing_regime: boolean | null;
      temperature_monitoring: boolean | null;
      descaling_programme: boolean | null;
    };
    
    // Actions
    actions: LegionellaAction[];
    
    // Review
    review_date: string | null;
    review_interval_months: number | null;
  };
}

8. Create src/lib/extraction-schemas/epc.ts:

import { BaseExtractionSchema, Evidence } from './types';

// ==========================================
// ENERGY PERFORMANCE CERTIFICATE SCHEMA
// ==========================================

export type EPCRating = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface EPCRecommendation {
  id: string;
  improvement: string;
  typical_saving: string | null;
  indicative_cost: string | null;
  rating_after: EPCRating | null;
  evidence: Evidence | null;
}

export interface EPCSchema extends BaseExtractionSchema {
  document_type: 'EPC';
  
  epc_specific: {
    // Certificate details
    certificate_reference: string | null;
    
    // Ratings
    current_rating: EPCRating | null;
    potential_rating: EPCRating | null;
    current_score: number | null;  // 1-100
    potential_score: number | null;
    
    // Environmental impact
    current_co2_rating: EPCRating | null;
    potential_co2_rating: EPCRating | null;
    
    // Property details
    property_type: string | null;
    built_form: string | null;
    floor_area: number | null;  // m²
    
    // Energy usage
    energy_usage: {
      lighting: string | null;
      heating: string | null;
      hot_water: string | null;
    };
    
    // Primary heating
    main_heating: {
      description: string | null;
      fuel: string | null;
      efficiency: string | null;
    };
    
    // Insulation
    insulation: {
      walls: string | null;
      roof: string | null;
      floor: string | null;
      windows: string | null;
    };
    
    // Recommendations
    recommendations: EPCRecommendation[];
    
    // Costs
    estimated_costs: {
      lighting: number | null;  // £/year
      heating: number | null;
      hot_water: number | null;
      total: number | null;
    };
  };
}

9. Create src/lib/extraction-schemas/lift-loler.ts:

import { BaseExtractionSchema, Evidence, Priority } from './types';

// ==========================================
// LIFT EXAMINATION (LOLER) SCHEMA
// ==========================================

export interface LiftDefect {
  id: string;
  description: string;
  risk_level: 'IMMEDIATE' | 'SHORT_TERM' | 'OBSERVATION' | null;
  priority: Priority;
  action_required: string;
  deadline: string | null;  // ISO date
  evidence: Evidence | null;
}

export interface LiftLolerSchema extends BaseExtractionSchema {
  document_type: 'LIFT_LOLER';
  
  lift_specific: {
    // Report details
    report_number: string | null;
    examination_type: 'THOROUGH' | 'SUPPLEMENTARY' | 'TEST' | null;
    
    // Lift identification
    lift_id: string | null;
    lift_number: string | null;
    lift_type: 'PASSENGER' | 'GOODS' | 'PLATFORM' | 'STAIRLIFT' | 'SERVICE' | null;
    
    // Technical details
    manufacturer: string | null;
    year_installed: string | null;
    safe_working_load: string | null;  // SWL in kg
    persons_capacity: number | null;
    floors_served: number | null;
    
    // Examination result
    safe_to_use: boolean | null;
    
    // Defects
    defects: LiftDefect[];
    defect_summary: {
      immediate_count: number;
      short_term_count: number;
      observation_count: number;
    };
    
    // Continuing examination
    next_thorough_examination: string | null;  // ISO date
    examination_interval_months: number | null;
    
    // Insurance
    insurance_company: string | null;
    policy_number: string | null;
  };
}

10. Create src/lib/extraction-schemas/index.ts:

// Re-export all types
export * from './types';
export * from './gas-safety';
export * from './eicr';
export * from './fire-risk';
export * from './asbestos';
export * from './legionella';
export * from './epc';
export * from './lift-loler';

import { DocumentType, BaseExtractionSchema } from './types';
import { GasSafetySchema, createEmptyGasSafetyExtraction } from './gas-safety';
import { EICRSchema } from './eicr';
import { FireRiskSchema } from './fire-risk';
import { AsbestosSchema } from './asbestos';
import { LegionellaSchema } from './legionella';
import { EPCSchema } from './epc';
import { LiftLolerSchema } from './lift-loler';

// Type mapping
export type ExtractionSchemaMap = {
  GAS_SAFETY: GasSafetySchema;
  EICR: EICRSchema;
  FIRE_RISK_ASSESSMENT: FireRiskSchema;
  ASBESTOS: AsbestosSchema;
  LEGIONELLA: LegionellaSchema;
  EPC: EPCSchema;
  LIFT_LOLER: LiftLolerSchema;
  SMOKE_CO_ALARM: BaseExtractionSchema;
  UNKNOWN: BaseExtractionSchema;
};

// Schema version registry
export const SCHEMA_VERSIONS: Record<DocumentType, string> = {
  GAS_SAFETY: 'v1.0',
  EICR: 'v1.0',
  FIRE_RISK_ASSESSMENT: 'v1.0',
  ASBESTOS: 'v1.0',
  LEGIONELLA: 'v1.0',
  EPC: 'v1.0',
  LIFT_LOLER: 'v1.0',
  SMOKE_CO_ALARM: 'v1.0',
  UNKNOWN: 'v1.0',
};

export function getSchemaVersion(docType: DocumentType): string {
  return SCHEMA_VERSIONS[docType] || 'v1.0';
}
```

---

## Step 3: Create Zod Validators

### Prompt 1.3: Zod Schema Validators

```
Create Zod validators for all extraction schemas.

1. Create directory: src/lib/extraction-schemas/validators/

2. Create src/lib/extraction-schemas/validators/base.ts:

import { z } from 'zod';

// ==========================================
// EVIDENCE SCHEMA
// ==========================================

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const EvidenceSchema = z.object({
  page: z.number().int().min(1),
  text_snippet: z.string().min(1).max(1000),
  bbox: BoundingBoxSchema.optional(),
});

// ==========================================
// COMMON FIELD SCHEMAS
// ==========================================

// UK Postcode
export const PostcodeSchema = z.string()
  .regex(/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, 'Invalid UK postcode format')
  .nullable();

// ISO Date (YYYY-MM-DD)
export const ISODateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(val => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, 'Invalid date value')
  .nullable();

// Reasonable date (not too far in past or future)
export const ReasonableDateSchema = ISODateSchema.refine(val => {
  if (!val) return true;
  const date = new Date(val);
  const now = new Date();
  const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
  const tenYearsFromNow = new Date(now.getFullYear() + 10, 11, 31);
  return date >= tenYearsAgo && date <= tenYearsFromNow;
}, 'Date seems unreasonable');

// ==========================================
// FINDING SCHEMAS
// ==========================================

export const ObservationSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  location: z.string().nullable(),
  severity: z.enum(['info', 'warning', 'critical']).nullable(),
  code: z.string().optional(),
  evidence: EvidenceSchema.nullable(),
});

export const RemedialActionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(3, 'Remedial action description too short'),
  priority: z.enum(['P1', 'P2', 'P3']).nullable(),
  due_date: ISODateSchema,
  location: z.string().nullable(),
  status: z.enum(['open', 'in_progress', 'completed']).optional(),
  evidence: EvidenceSchema.nullable(),
});

export const MissingFieldSchema = z.object({
  field: z.string().min(1),
  reason: z.enum(['not_found', 'unclear', 'not_applicable', 'poor_quality']),
});

// ==========================================
// BASE EXTRACTION SCHEMA
// ==========================================

export const BaseExtractionValidator = z.object({
  schema_version: z.string().min(1),
  document_type: z.enum([
    'GAS_SAFETY', 'EICR', 'FIRE_RISK_ASSESSMENT', 
    'ASBESTOS', 'LEGIONELLA', 'EPC', 'LIFT_LOLER',
    'SMOKE_CO_ALARM', 'UNKNOWN'
  ]),
  
  source: z.object({
    filename: z.string().min(1),
    upload_id: z.string().min(1),
    pages: z.number().int().min(1),
    processing_tier: z.number().int().min(1).max(4),
  }),
  
  property: z.object({
    address_line_1: z.string().min(1).nullable(),
    address_line_2: z.string().nullable(),
    city: z.string().nullable(),
    postcode: PostcodeSchema,
    uprn: z.string().nullable(),
    evidence: EvidenceSchema.nullable(),
  }),
  
  inspection: z.object({
    date: ReasonableDateSchema,
    next_due_date: ISODateSchema,
    outcome: z.enum([
      'PASS', 'FAIL', 'SATISFACTORY', 'UNSATISFACTORY', 
      'ADVISORY', 'INCOMPLETE', 'NOT_APPLICABLE'
    ]).nullable(),
    standard: z.string().nullable(),
    evidence: EvidenceSchema.nullable(),
  }),
  
  engineer: z.object({
    name: z.string().min(2).nullable(),
    company: z.string().nullable(),
    registration_id: z.string().nullable(),
    registration_type: z.string().nullable(),
    qualification: z.string().nullable(),
    evidence: EvidenceSchema.nullable(),
  }),
  
  findings: z.object({
    observations: z.array(ObservationSchema),
    remedial_actions: z.array(RemedialActionSchema),
  }),
  
  extraction_metadata: z.object({
    confidence: z.number().min(0).max(1),
    missing_fields: z.array(MissingFieldSchema),
    warnings: z.array(z.string()),
    processing_notes: z.array(z.string()),
  }),
});

3. Create src/lib/extraction-schemas/validators/gas-safety.ts:

import { z } from 'zod';
import { BaseExtractionValidator, EvidenceSchema } from './base';

// Gas Safe number: 6-7 digits
const GasSafeNumberSchema = z.string()
  .regex(/^\d{6,7}$/, 'Gas Safe number must be 6-7 digits')
  .nullable();

const GasApplianceChecksSchema = z.object({
  flue_flow: z.enum(['pass', 'fail', 'na']).nullable(),
  spillage: z.enum(['pass', 'fail', 'na']).nullable(),
  ventilation: z.enum(['pass', 'fail', 'na']).nullable(),
  visual_condition: z.enum(['pass', 'fail']).nullable(),
  operation: z.enum(['pass', 'fail']).nullable(),
  safety_device: z.enum(['pass', 'fail', 'na']).nullable(),
});

const GasApplianceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  location: z.string().nullable(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  serial_number: z.string().nullable(),
  checks: GasApplianceChecksSchema,
  result: z.enum(['PASS', 'FAIL', 'NOT_TESTED', 'NOT_INSPECTED']),
  defects: z.array(z.string()),
  actions_required: z.array(z.string()),
  evidence: EvidenceSchema.nullable(),
});

export const GasSafetyValidator = BaseExtractionValidator.extend({
  document_type: z.literal('GAS_SAFETY'),
  
  gas_specific: z.object({
    certificate_number: z.string().nullable(),
    certificate_type: z.enum(['LGSR', 'CP12', 'SERVICE', 'OTHER']).nullable(),
    landlord_name: z.string().nullable(),
    landlord_address: z.string().nullable(),
    gas_safe_number: GasSafeNumberSchema,
    gas_safe_id_verified: z.boolean().nullable(),
    appliances: z.array(GasApplianceSchema),
    appliance_count: z.number().int().min(0),
    safety_checks: z.object({
      flue_flow_test: z.boolean().nullable(),
      spillage_test: z.boolean().nullable(),
      ventilation_adequate: z.boolean().nullable(),
      visual_condition: z.enum(['satisfactory', 'unsatisfactory']).nullable(),
      pipework_condition: z.enum(['satisfactory', 'unsatisfactory']).nullable(),
    }),
    alarms: z.object({
      co_alarm_present: z.boolean().nullable(),
      co_alarm_tested: z.boolean().nullable(),
      co_alarm_working: z.boolean().nullable(),
      smoke_alarm_present: z.boolean().nullable(),
      smoke_alarm_tested: z.boolean().nullable(),
    }),
    meter: z.object({
      location: z.string().nullable(),
      emergency_control_accessible: z.boolean().nullable(),
    }),
  }),
});

export type GasSafetyValidated = z.infer<typeof GasSafetyValidator>;

4. Create src/lib/extraction-schemas/validators/eicr.ts:

import { z } from 'zod';
import { BaseExtractionValidator, EvidenceSchema } from './base';

const EICRCodeSchema = z.object({
  id: z.string().min(1),
  code: z.enum(['C1', 'C2', 'C3', 'FI', 'LIM', 'N/A']),
  description: z.string().min(1),
  location: z.string().nullable(),
  circuit: z.string().nullable(),
  item_number: z.string().nullable(),
  evidence: EvidenceSchema.nullable(),
});

export const EICRValidator = BaseExtractionValidator.extend({
  document_type: z.literal('EICR'),
  
  eicr_specific: z.object({
    report_reference: z.string().nullable(),
    report_type: z.enum(['PERIODIC', 'INITIAL', 'MINOR_WORKS']).nullable(),
    overall_assessment: z.enum(['SATISFACTORY', 'UNSATISFACTORY', 'FURTHER_INVESTIGATION']).nullable(),
    client_name: z.string().nullable(),
    client_address: z.string().nullable(),
    registration: z.object({
      scheme: z.string().nullable(),
      registration_number: z.string().nullable(),
    }),
    installation_details: z.object({
      age_of_installation: z.string().nullable(),
      evidence_of_alterations: z.boolean().nullable(),
      alterations_details: z.string().nullable(),
      consumer_unit_location: z.string().nullable(),
      consumer_unit_type: z.string().nullable(),
      earthing_arrangement: z.string().nullable(),
      main_switch_rating: z.string().nullable(),
    }),
    test_results: z.object({
      circuits_tested: z.number().int().min(0).nullable(),
      circuits_satisfactory: z.number().int().min(0).nullable(),
      rcd_present: z.boolean().nullable(),
      rcd_tested: z.boolean().nullable(),
    }),
    codes: z.array(EICRCodeSchema),
    code_summary: z.object({
      c1_count: z.number().int().min(0),
      c2_count: z.number().int().min(0),
      c3_count: z.number().int().min(0),
      fi_count: z.number().int().min(0),
    }),
    limitations: z.array(z.string()),
    recommended_interval_months: z.number().int().min(1).nullable(),
  }),
});

export type EICRValidated = z.infer<typeof EICRValidator>;

5. Create src/lib/extraction-schemas/validators/index.ts:

import { z } from 'zod';
import { DocumentType } from '../types';
import { BaseExtractionValidator } from './base';
import { GasSafetyValidator } from './gas-safety';
import { EICRValidator } from './eicr';
// Import other validators as created

export * from './base';
export * from './gas-safety';
export * from './eicr';

// Validator registry
const VALIDATORS: Record<DocumentType, z.ZodSchema> = {
  GAS_SAFETY: GasSafetyValidator,
  EICR: EICRValidator,
  FIRE_RISK_ASSESSMENT: BaseExtractionValidator,
  ASBESTOS: BaseExtractionValidator,
  LEGIONELLA: BaseExtractionValidator,
  EPC: BaseExtractionValidator,
  LIFT_LOLER: BaseExtractionValidator,
  SMOKE_CO_ALARM: BaseExtractionValidator,
  UNKNOWN: BaseExtractionValidator,
};

export function getValidatorForDocType(docType: DocumentType): z.ZodSchema {
  return VALIDATORS[docType] || BaseExtractionValidator;
}

export interface ValidationResult {
  valid: boolean;
  data?: any;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

export function validateExtraction(
  docType: DocumentType,
  data: unknown
): ValidationResult {
  const validator = getValidatorForDocType(docType);
  const result = validator.safeParse(data);
  
  if (result.success) {
    return {
      valid: true,
      data: result.data,
      errors: [],
    };
  }
  
  return {
    valid: false,
    errors: result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  };
}
```

---

## Step 4: Create Seed Data

### Prompt 1.4: Seed Extraction Schemas

```
Create seed script for extraction schemas.

Update prisma/seed.ts to add extraction schema seeding:

// Add to existing seed.ts

// Seed extraction schemas
async function seedExtractionSchemas() {
  const schemas = [
    {
      version: 'v1.0',
      documentType: 'GAS_SAFETY',
      isActive: true,
      schemaJson: {
        name: 'Gas Safety Certificate Schema',
        version: 'v1.0',
        requiredFields: [
          'property.address_line_1',
          'inspection.date',
          'inspection.outcome',
          'engineer.name',
          'gas_specific.gas_safe_number',
        ],
        evidenceRequired: [
          'inspection.date',
          'inspection.outcome',
          'gas_specific.appliances',
        ],
      },
    },
    {
      version: 'v1.0',
      documentType: 'EICR',
      isActive: true,
      schemaJson: {
        name: 'EICR Schema',
        version: 'v1.0',
        requiredFields: [
          'property.address_line_1',
          'inspection.date',
          'eicr_specific.overall_assessment',
          'engineer.name',
        ],
        evidenceRequired: [
          'inspection.date',
          'eicr_specific.overall_assessment',
          'eicr_specific.codes',
        ],
      },
    },
    {
      version: 'v1.0',
      documentType: 'FIRE_RISK_ASSESSMENT',
      isActive: true,
      schemaJson: {
        name: 'Fire Risk Assessment Schema',
        version: 'v1.0',
        requiredFields: [
          'property.address_line_1',
          'inspection.date',
          'fra_specific.overall_risk',
        ],
        evidenceRequired: [
          'inspection.date',
          'fra_specific.overall_risk',
        ],
      },
    },
    {
      version: 'v1.0',
      documentType: 'ASBESTOS',
      isActive: true,
      schemaJson: {
        name: 'Asbestos Survey Schema',
        version: 'v1.0',
        requiredFields: [
          'property.address_line_1',
          'inspection.date',
          'asbestos_specific.survey_type',
        ],
        evidenceRequired: [
          'inspection.date',
          'asbestos_specific.materials',
        ],
      },
    },
    {
      version: 'v1.0',
      documentType: 'LEGIONELLA',
      isActive: true,
      schemaJson: {
        name: 'Legionella Risk Assessment Schema',
        version: 'v1.0',
        requiredFields: [
          'property.address_line_1',
          'inspection.date',
          'legionella_specific.overall_risk',
        ],
        evidenceRequired: [
          'inspection.date',
          'legionella_specific.water_systems',
        ],
      },
    },
    {
      version: 'v1.0',
      documentType: 'EPC',
      isActive: true,
      schemaJson: {
        name: 'EPC Schema',
        version: 'v1.0',
        requiredFields: [
          'property.address_line_1',
          'epc_specific.current_rating',
        ],
        evidenceRequired: [
          'epc_specific.current_rating',
        ],
      },
    },
    {
      version: 'v1.0',
      documentType: 'LIFT_LOLER',
      isActive: true,
      schemaJson: {
        name: 'LOLER Examination Schema',
        version: 'v1.0',
        requiredFields: [
          'property.address_line_1',
          'inspection.date',
          'lift_specific.safe_to_use',
        ],
        evidenceRequired: [
          'inspection.date',
          'lift_specific.safe_to_use',
        ],
      },
    },
  ];

  for (const schema of schemas) {
    await prisma.extractionSchema.upsert({
      where: {
        version_documentType: {
          version: schema.version,
          documentType: schema.documentType,
        },
      },
      update: {
        isActive: schema.isActive,
        schemaJson: schema.schemaJson,
      },
      create: schema,
    });
  }

  console.log('Extraction schemas seeded');
}

// Call in main function
async function main() {
  // ... existing seed code ...
  
  await seedExtractionSchemas();
}

After updating, run:
npx prisma db seed
```

---

## Verification Checklist

After completing Phase 1, verify:

```
□ Database migration successful
  - Run: npx prisma studio
  - Check these tables exist:
    - ExtractionSchema
    - ExtractionRun
    - HumanReview
    - BenchmarkSet
    - BenchmarkItem
    - EvalRun
    - ComplianceRule
    - NormalisationRule

□ TypeScript types compile
  - Run: npx tsc --noEmit
  - No errors in src/lib/extraction-schemas/

□ Zod validators work
  - Create a test file and validate sample data
  - Both valid and invalid data cases pass

□ Schemas seeded
  - Check ExtractionSchema table has 7 active schemas

□ IDE shows proper types
  - Import types in a component
  - Autocomplete works for GasSafetySchema, etc.
```

---

## What's Next

Phase 2 will add:
- Document type classifier
- Routing to document-specific extractors
- Classification confidence tracking

The schemas and validators from Phase 1 will be used to validate all extraction outputs.

---

## Files Created in Phase 1

```
prisma/
  schema.prisma (updated)
  seed.ts (updated)

src/lib/extraction-schemas/
  types.ts
  gas-safety.ts
  eicr.ts
  fire-risk.ts
  asbestos.ts
  legionella.ts
  epc.ts
  lift-loler.ts
  index.ts
  validators/
    base.ts
    gas-safety.ts
    eicr.ts
    index.ts
```
