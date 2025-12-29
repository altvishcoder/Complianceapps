import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, real, json, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OFFICER', 'VIEWER']);
export const complianceStatusEnum = pgEnum('compliance_status', ['COMPLIANT', 'EXPIRING_SOON', 'OVERDUE', 'NON_COMPLIANT', 'ACTION_REQUIRED', 'UNKNOWN']);
export const propertyTypeEnum = pgEnum('property_type', ['HOUSE', 'FLAT', 'BUNGALOW', 'MAISONETTE', 'BEDSIT', 'STUDIO']);
export const tenureEnum = pgEnum('tenure', ['SOCIAL_RENT', 'AFFORDABLE_RENT', 'SHARED_OWNERSHIP', 'LEASEHOLD', 'TEMPORARY']);
export const certificateTypeEnum = pgEnum('certificate_type', ['GAS_SAFETY', 'EICR', 'EPC', 'FIRE_RISK_ASSESSMENT', 'LEGIONELLA_ASSESSMENT', 'ASBESTOS_SURVEY', 'LIFT_LOLER', 'OTHER']);
export const certificateStatusEnum = pgEnum('certificate_status', ['UPLOADED', 'PROCESSING', 'EXTRACTED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'FAILED']);
export const certificateOutcomeEnum = pgEnum('certificate_outcome', ['SATISFACTORY', 'UNSATISFACTORY', 'PASS', 'FAIL', 'AT_RISK', 'IMMEDIATELY_DANGEROUS']);
export const severityEnum = pgEnum('severity', ['IMMEDIATE', 'URGENT', 'PRIORITY', 'ROUTINE', 'ADVISORY']);
export const actionStatusEnum = pgEnum('action_status', ['OPEN', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']);
export const propertySourceEnum = pgEnum('property_source', ['MANUAL', 'AUTO_EXTRACTED', 'IMPORTED']);

// Lashan Owned Model Enums
export const extractionStatusEnum = pgEnum('extraction_status', [
  'PENDING', 'PROCESSING', 'VALIDATION_FAILED', 'REPAIR_IN_PROGRESS', 
  'AWAITING_REVIEW', 'APPROVED', 'REJECTED'
]);

// Tables
export const organisations = pgTable("organisations", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  settings: json("settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default('VIEWER'),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const schemes = pgTable("schemes", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  name: text("name").notNull(),
  reference: text("reference").notNull(),
  complianceStatus: complianceStatusEnum("compliance_status").notNull().default('UNKNOWN'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const blocks = pgTable("blocks", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  schemeId: varchar("scheme_id").references(() => schemes.id, { onDelete: 'cascade' }).notNull(),
  name: text("name").notNull(),
  reference: text("reference").notNull(),
  hasLift: boolean("has_lift").notNull().default(false),
  hasCommunalBoiler: boolean("has_communal_boiler").notNull().default(false),
  complianceStatus: complianceStatusEnum("compliance_status").notNull().default('UNKNOWN'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  blockId: varchar("block_id").references(() => blocks.id, { onDelete: 'cascade' }).notNull(),
  uprn: text("uprn").notNull().unique(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  postcode: text("postcode").notNull(),
  propertyType: propertyTypeEnum("property_type").notNull(),
  tenure: tenureEnum("tenure").notNull(),
  bedrooms: integer("bedrooms").notNull().default(1),
  hasGas: boolean("has_gas").notNull().default(true),
  complianceStatus: complianceStatusEnum("compliance_status").notNull().default('UNKNOWN'),
  source: propertySourceEnum("source").notNull().default('MANUAL'),
  needsVerification: boolean("needs_verification").notNull().default(false),
  extractedMetadata: json("extracted_metadata"),
  
  // Additional compliance fields
  vulnerableOccupant: boolean("vulnerable_occupant").notNull().default(false),
  epcRating: text("epc_rating"),                      // A, B, C, D, E, F, G
  constructionYear: integer("construction_year"),
  numberOfFloors: integer("number_of_floors").default(1),
  hasElectricity: boolean("has_electricity").notNull().default(true),
  hasAsbestos: boolean("has_asbestos").notNull().default(false),
  hasSprinklers: boolean("has_sprinklers").notNull().default(false),
  localAuthority: text("local_authority"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Ingestion batches for server-side batch processing
export const ingestionBatches = pgTable("ingestion_batches", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  name: text("name"),
  totalFiles: integer("total_files").notNull().default(0),
  completedFiles: integer("completed_files").notNull().default(0),
  failedFiles: integer("failed_files").notNull().default(0),
  status: text("status").notNull().default('PENDING'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const certificates = pgTable("certificates", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  blockId: varchar("block_id").references(() => blocks.id),
  batchId: varchar("batch_id").references(() => ingestionBatches.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storageKey: text("storage_key"),
  certificateType: certificateTypeEnum("certificate_type").notNull(),
  status: certificateStatusEnum("status").notNull().default('UPLOADED'),
  certificateNumber: text("certificate_number"),
  issueDate: text("issue_date"),
  expiryDate: text("expiry_date"),
  outcome: certificateOutcomeEnum("outcome"),
  uploadedById: varchar("uploaded_by_id").references(() => users.id),
  reviewedById: varchar("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const extractions = pgTable("extractions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateId: varchar("certificate_id").references(() => certificates.id, { onDelete: 'cascade' }).notNull(),
  method: text("method").notNull(),
  model: text("model"),
  promptVersion: text("prompt_version"),
  rawResponse: json("raw_response"),
  extractedData: json("extracted_data"),
  confidence: real("confidence"),
  textQuality: text("text_quality"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const remedialActions = pgTable("remedial_actions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateId: varchar("certificate_id").references(() => certificates.id, { onDelete: 'cascade' }).notNull(),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  code: text("code"),
  category: text("category"),
  description: text("description").notNull(),
  location: text("location"),
  severity: severityEnum("severity").notNull(),
  status: actionStatusEnum("status").notNull().default('OPEN'),
  dueDate: text("due_date"),
  resolvedAt: timestamp("resolved_at"),
  costEstimate: text("cost_estimate"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Contractor Status Enum
export const contractorStatusEnum = pgEnum('contractor_status', ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']);

// Contractors Table
export const contractors = pgTable("contractors", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  companyName: text("company_name").notNull(),
  tradeType: text("trade_type").notNull(),
  registrationNumber: text("registration_number"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  gasRegistration: text("gas_registration"),
  electricalRegistration: text("electrical_registration"),
  status: contractorStatusEnum("status").notNull().default('PENDING'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==========================================
// LASHAN OWNED MODEL TABLES
// ==========================================

// Extraction Schemas (Behaviour Contract)
export const extractionSchemas = pgTable("extraction_schemas", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  version: text("version").notNull(), // "v1.0", "v1.1", etc.
  documentType: text("document_type").notNull(), // GAS_SAFETY, EICR, FRA, etc.
  schemaJson: json("schema_json").notNull(), // The actual JSON schema definition
  promptTemplate: text("prompt_template"), // Associated prompt template
  isActive: boolean("is_active").notNull().default(false),
  isDeprecated: boolean("is_deprecated").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Extraction Runs (Raw Model Output with Progressive Refinement)
export const extractionRuns = pgTable("extraction_runs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateId: varchar("certificate_id").references(() => certificates.id, { onDelete: 'cascade' }).notNull(),
  schemaId: varchar("schema_id").references(() => extractionSchemas.id),
  
  // Model info
  modelVersion: text("model_version").notNull(), // "claude-sonnet-4-20250514"
  promptVersion: text("prompt_version").notNull(), // "gas_v1.0"
  schemaVersion: text("schema_version").notNull(), // "v1.0"
  
  // Document classification
  documentType: text("document_type").notNull(),
  classificationConfidence: real("classification_confidence").notNull().default(0),
  
  // Extraction outputs (progressive refinement)
  rawOutput: json("raw_output").notNull(), // First-pass extraction from AI
  validatedOutput: json("validated_output"), // After schema validation
  repairedOutput: json("repaired_output"), // After repair prompts (Phase 3)
  normalisedOutput: json("normalised_output"), // After normalisation rules (Phase 6)
  finalOutput: json("final_output"), // After human review (Phase 4)
  
  // Quality metrics
  confidence: real("confidence").notNull().default(0),
  processingTier: integer("processing_tier").notNull().default(4),
  processingTimeMs: integer("processing_time_ms").notNull().default(0),
  processingCost: real("processing_cost").notNull().default(0),
  
  // Validation tracking
  validationErrors: json("validation_errors").notNull().default([]),
  validationPassed: boolean("validation_passed").notNull().default(false),
  repairAttempts: integer("repair_attempts").notNull().default(0),
  
  // Status
  status: extractionStatusEnum("status").notNull().default('PENDING'),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Human Reviews (Data Flywheel - Phase 4)
export const humanReviews = pgTable("human_reviews", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  extractionRunId: varchar("extraction_run_id").references(() => extractionRuns.id, { onDelete: 'cascade' }).notNull().unique(),
  reviewerId: varchar("reviewer_id").references(() => users.id).notNull(),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  
  // The approved output
  approvedOutput: json("approved_output").notNull(),
  
  // What changed (for learning)
  fieldChanges: json("field_changes").notNull().default([]), // [{field, before, after, reason}]
  addedItems: json("added_items").notNull().default([]),
  removedItems: json("removed_items").notNull().default([]),
  
  // Error categorisation for improvement targeting
  errorTags: text("error_tags").array(), // ["missed_table_row", "wrong_date_format"]
  
  // Quality indicators
  wasCorrect: boolean("was_correct").notNull().default(false), // No changes needed
  changeCount: integer("change_count").notNull().default(0),
  reviewTimeSeconds: integer("review_time_seconds"),
  
  // Notes
  reviewerNotes: text("reviewer_notes"),
  
  reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
});

// Benchmark Sets (Evaluation - Phase 5)
export const benchmarkSets = pgTable("benchmark_sets", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(), // "benchmark_v1", "eicr_edge_cases"
  description: text("description"),
  documentTypes: text("document_types").array(), // Which doc types this covers
  isLocked: boolean("is_locked").notNull().default(false),
  itemCount: integer("item_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lockedAt: timestamp("locked_at"),
});

// Benchmark Items
export const benchmarkItems = pgTable("benchmark_items", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  benchmarkSetId: varchar("benchmark_set_id").references(() => benchmarkSets.id, { onDelete: 'cascade' }).notNull(),
  certificateId: varchar("certificate_id").references(() => certificates.id).notNull(),
  
  // The "gold standard" expected output
  expectedOutput: json("expected_output").notNull(),
  
  // Metadata about difficulty
  difficulty: text("difficulty").notNull().default("medium"), // "easy", "medium", "hard"
  challengeTypes: text("challenge_types").array(), // ["messy_scan", "handwritten", "multi_page"]
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Evaluation Runs
export const evalRuns = pgTable("eval_runs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  benchmarkSetId: varchar("benchmark_set_id").references(() => benchmarkSets.id).notNull(),
  
  // What was tested
  modelVersion: text("model_version").notNull(),
  promptVersion: text("prompt_version").notNull(),
  schemaVersion: text("schema_version").notNull(),
  
  // Aggregate scores
  overallScore: real("overall_score").notNull(),
  exactMatchRate: real("exact_match_rate").notNull(),
  evidenceAccuracy: real("evidence_accuracy").notNull(),
  schemaValidRate: real("schema_valid_rate").notNull(),
  
  // Detailed results
  scores: json("scores").notNull(), // {by_field, by_doc_type}
  itemResults: json("item_results").notNull(), // Per-item scores
  
  // Comparison to previous
  previousRunId: varchar("previous_run_id"),
  regressions: json("regressions").notNull().default([]),
  improvements: json("improvements").notNull().default([]),
  scoreDelta: real("score_delta"),
  
  // Release decision
  passedGating: boolean("passed_gating"),
  gatingNotes: text("gating_notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Compliance Rules (Domain Logic - Phase 6)
export const complianceRules = pgTable("compliance_rules", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ruleCode: text("rule_code").notNull().unique(), // "EICR_C1_URGENT"
  ruleName: text("rule_name").notNull(),
  documentType: text("document_type").notNull(),
  
  // Rule definition
  conditions: json("conditions").notNull(), // [{field, operator, value}]
  conditionLogic: text("condition_logic").notNull().default("AND"), // "AND" or "OR"
  
  // Actions
  action: text("action").notNull(), // "FLAG_URGENT", "MARK_INCOMPLETE", "AUTO_FAIL", "INFO"
  priority: text("priority"), // "P1", "P2", "P3"
  
  // Documentation
  description: text("description").notNull(),
  legislation: text("legislation"),
  
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Normalisation Rules (Domain Logic - Phase 6)
export const normalisationRules = pgTable("normalisation_rules", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ruleName: text("rule_name").notNull(),
  fieldPath: text("field_path").notNull(), // "engineer.company", "inspection.outcome"
  ruleType: text("rule_type").notNull(), // "MAPPING", "REGEX", "TRANSFORM"
  
  // Rule definition
  inputPatterns: text("input_patterns").array(), // Patterns to match
  outputValue: text("output_value"), // Mapped value (for MAPPING type)
  transformFn: text("transform_fn"), // Transform function name (for TRANSFORM type)
  
  priority: integer("priority").notNull().default(0), // Higher = applied first
  isActive: boolean("is_active").notNull().default(true),
});

// ==========================================
// SYSTEM CONFIGURATION TABLES
// ==========================================

// Certificate Types Configuration
export const certificateTypes = pgTable("certificate_types", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(), // "GAS_SAFETY", "EICR", etc.
  name: text("name").notNull(), // "Gas Safety Certificate (CP12)"
  shortName: text("short_name").notNull(), // "Gas Safety"
  complianceStream: text("compliance_stream").notNull(), // "GAS", "ELECTRICAL", "FIRE", etc.
  description: text("description"),
  
  // Validity configuration
  validityMonths: integer("validity_months").notNull().default(12),
  warningDays: integer("warning_days").notNull().default(30),
  
  // Required fields for extraction
  requiredFields: text("required_fields").array(), // ["issueDate", "expiryDate", "engineerName"]
  
  // Display order and status
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Classification Codes Configuration (C1, C2, FI, etc.)
export const classificationCodes = pgTable("classification_codes", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull(), // "C1", "C2", "C3", "FI", "LIM", "N/A"
  name: text("name").notNull(), // "Danger Present"
  certificateTypeId: varchar("certificate_type_id").references(() => certificateTypes.id),
  
  // Classification details
  severity: text("severity").notNull(), // "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"
  colorCode: text("color_code"), // Hex color for UI display
  description: text("description").notNull(),
  actionRequired: text("action_required"), // What action is required for this code
  timeframeHours: integer("timeframe_hours"), // Time to remediate (null = no deadline)
  
  // Remedial action settings
  autoCreateAction: boolean("auto_create_action").notNull().default(true), // Whether to auto-create remedial action
  actionSeverity: text("action_severity"), // IMMEDIATE, URGENT, ROUTINE, ADVISORY
  costEstimateLow: integer("cost_estimate_low"), // Lower bound cost estimate in pence
  costEstimateHigh: integer("cost_estimate_high"), // Upper bound cost estimate in pence
  
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==========================================
// HACT-ALIGNED EXTENDED ARCHITECTURE
// ==========================================

// Unit Types (rooms/areas within a property)
export const unitTypeEnum = pgEnum('unit_type', [
  'DWELLING',        // Primary living space
  'COMMUNAL_AREA',   // Shared hallway, lobby, etc.
  'PLANT_ROOM',      // Mechanical/electrical room
  'ROOF_SPACE',      // Roof/attic area
  'BASEMENT',        // Basement/cellar
  'EXTERNAL',        // External grounds
  'GARAGE',          // Garage or parking
  'COMMERCIAL',      // Commercial unit
  'OTHER'
]);

// Component Categories (HACT asset hierarchy)
export const componentCategoryEnum = pgEnum('component_category', [
  'HEATING',         // Boilers, radiators, heat pumps
  'ELECTRICAL',      // Consumer units, wiring, sockets
  'FIRE_SAFETY',     // Alarms, extinguishers, doors
  'WATER',           // Tanks, pipes, water heaters
  'VENTILATION',     // Extractors, HVAC systems
  'STRUCTURE',       // Roofs, walls, foundations
  'ACCESS',          // Lifts, stairs, ramps
  'SECURITY',        // Door entry, CCTV
  'EXTERNAL',        // Fencing, paving, drainage
  'OTHER'
]);

// Import Status
export const importStatusEnum = pgEnum('import_status', [
  'PENDING',
  'VALIDATING',
  'VALIDATED',
  'IMPORTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
]);

// Import Row Status
export const importRowStatusEnum = pgEnum('import_row_status', [
  'PENDING',
  'VALID',
  'INVALID',
  'IMPORTED',
  'SKIPPED',
  'FAILED'
]);

// Component Types Configuration (like boiler model, alarm type, etc.)
export const componentTypes = pgTable("component_types", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),             // "GAS_BOILER", "SMOKE_ALARM", etc.
  name: text("name").notNull(),                       // "Gas Boiler"
  category: componentCategoryEnum("category").notNull(),
  description: text("description"),
  
  // HACT mapping
  hactElementCode: text("hact_element_code"),         // HACT element reference
  expectedLifespanYears: integer("expected_lifespan_years"),
  
  // Compliance linkage
  relatedCertificateTypes: text("related_certificate_types").array(), // ["GAS_SAFETY"]
  inspectionFrequencyMonths: integer("inspection_frequency_months"),
  
  // Risk classification for TSM reporting
  isHighRisk: boolean("is_high_risk").notNull().default(false),
  buildingSafetyRelevant: boolean("building_safety_relevant").notNull().default(false),
  
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Units (rooms/areas within a property - HACT hierarchy)
export const units = pgTable("units", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  
  name: text("name").notNull(),                       // "Kitchen", "Communal Hall", etc.
  reference: text("reference"),                        // Unit reference code
  unitType: unitTypeEnum("unit_type").notNull(),
  floor: text("floor"),                               // "Ground", "1st", "Basement"
  
  description: text("description"),
  
  // HACT reference
  hactLocationCode: text("hact_location_code"),
  
  // Compliance fields
  areaSqMeters: real("area_sq_meters"),               // Room/unit area
  isAccessible: boolean("is_accessible").notNull().default(false),
  fireCompartment: text("fire_compartment"),          // Fire compartmentation zone
  asbestosPresent: boolean("asbestos_present").notNull().default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Components (assets within units/properties - HACT hierarchy)
export const components = pgTable("components", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  // Hierarchical location (at least one required)
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }),
  unitId: varchar("unit_id").references(() => units.id, { onDelete: 'cascade' }),
  blockId: varchar("block_id").references(() => blocks.id, { onDelete: 'cascade' }),
  
  componentTypeId: varchar("component_type_id").references(() => componentTypes.id).notNull(),
  
  // Identification
  assetTag: text("asset_tag"),                        // Physical asset label
  serialNumber: text("serial_number"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  
  // Location details
  location: text("location"),                          // Specific location description
  accessNotes: text("access_notes"),
  
  // Lifecycle
  installDate: text("install_date"),
  expectedReplacementDate: text("expected_replacement_date"),
  warrantyExpiry: text("warranty_expiry"),
  
  // Status
  condition: text("condition"),                        // "GOOD", "FAIR", "POOR", "CRITICAL"
  isActive: boolean("is_active").notNull().default(true),
  
  // Source tracking
  source: propertySourceEnum("source").notNull().default('MANUAL'),
  needsVerification: boolean("needs_verification").notNull().default(false),
  
  // Last inspection link (for quick access)
  lastInspectionDate: text("last_inspection_date"),
  nextInspectionDue: text("next_inspection_due"),
  
  // Additional compliance fields
  complianceStatus: complianceStatusEnum("compliance_status").notNull().default('UNKNOWN'),
  certificateRequired: text("certificate_required"),   // Links to certificate type code
  riskLevel: text("risk_level"),                       // HIGH, MEDIUM, LOW
  lastServiceDate: text("last_service_date"),
  nextServiceDue: text("next_service_due"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Component Certificates (many-to-many: certificates can cover multiple components)
export const componentCertificates = pgTable("component_certificates", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  componentId: varchar("component_id").references(() => components.id, { onDelete: 'cascade' }).notNull(),
  certificateId: varchar("certificate_id").references(() => certificates.id, { onDelete: 'cascade' }).notNull(),
  
  // Extraction reference (how this link was established)
  isAutoLinked: boolean("is_auto_linked").notNull().default(false),
  extractionConfidence: real("extraction_confidence"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Video Library (demo/tutorial videos)
export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  uploadedById: varchar("uploaded_by_id").references(() => users.id),
  
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  duration: integer("duration"),
  
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storageKey: text("storage_key").notNull(),
  thumbnailKey: text("thumbnail_key"),
  
  viewCount: integer("view_count").notNull().default(0),
  downloadCount: integer("download_count").notNull().default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Suggestions (tracking recommendation lifecycle)
export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "ACTIVE",
  "IN_PROGRESS",
  "RESOLVED",
  "DISMISSED",
  "AUTO_RESOLVED"
]);

export const suggestionCategoryEnum = pgEnum("suggestion_category", [
  "PROMPT",
  "PREPROCESSING",
  "VALIDATION",
  "TRAINING",
  "QUALITY",
  "REVIEW"
]);

export const aiSuggestions = pgTable("ai_suggestions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  
  // Suggestion details
  suggestionKey: text("suggestion_key").notNull(),
  category: suggestionCategoryEnum("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  
  // Impact and effort
  impact: text("impact").notNull(),
  effort: text("effort").notNull(),
  actionable: boolean("actionable").default(true),
  
  // Action details (for navigation)
  actionLabel: text("action_label"),
  actionRoute: text("action_route"),
  
  // Progress tracking
  status: suggestionStatusEnum("status").notNull().default("ACTIVE"),
  currentValue: integer("current_value"),
  targetValue: integer("target_value"),
  progressPercent: integer("progress_percent").default(0),
  
  // Metrics at time of creation
  snapshotMetrics: json("snapshot_metrics"),
  
  // Action tracking
  actionedAt: timestamp("actioned_at"),
  actionedById: varchar("actioned_by_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  dismissedAt: timestamp("dismissed_at"),
  dismissReason: text("dismiss_reason"),
  
  // Auto-resolution
  autoResolveCondition: text("auto_resolve_condition"),
  lastCheckedAt: timestamp("last_checked_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Data Imports (tracking CSV/Excel imports)
export const dataImports = pgTable("data_imports", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  uploadedById: varchar("uploaded_by_id").references(() => users.id).notNull(),
  
  // Import identification
  name: text("name").notNull(),
  importType: text("import_type").notNull(),           // "PROPERTIES", "UNITS", "COMPONENTS"
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),               // "CSV", "XLSX"
  fileSize: integer("file_size").notNull(),
  
  // Mapping configuration (column mapping from source to target fields)
  columnMapping: json("column_mapping"),               // {sourceColumn: targetField}
  
  // Status
  status: importStatusEnum("status").notNull().default('PENDING'),
  
  // Statistics
  totalRows: integer("total_rows").notNull().default(0),
  validRows: integer("valid_rows").notNull().default(0),
  invalidRows: integer("invalid_rows").notNull().default(0),
  importedRows: integer("imported_rows").notNull().default(0),
  skippedRows: integer("skipped_rows").notNull().default(0),
  
  // Import options
  upsertMode: boolean("upsert_mode").notNull().default(false),  // Update existing records
  dryRun: boolean("dry_run").notNull().default(false),
  
  // Results
  errorSummary: json("error_summary"),                 // Aggregated error types
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Data Import Rows (per-row status for detailed error tracking)
export const dataImportRows = pgTable("data_import_rows", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  importId: varchar("import_id").references(() => dataImports.id, { onDelete: 'cascade' }).notNull(),
  
  rowNumber: integer("row_number").notNull(),
  status: importRowStatusEnum("status").notNull().default('PENDING'),
  
  // Original data
  sourceData: json("source_data").notNull(),
  
  // Validation
  validationErrors: json("validation_errors"),         // [{field, error, value}]
  
  // Result
  createdRecordId: varchar("created_record_id"),       // ID of created/updated record
  createdRecordType: text("created_record_type"),      // "property", "unit", "component"
  
  processedAt: timestamp("processed_at"),
});

// Relations
export const organisationRelations = relations(organisations, ({ many }) => ({
  users: many(users),
  schemes: many(schemes),
  certificates: many(certificates),
  humanReviews: many(humanReviews),
  dataImports: many(dataImports),
}));

export const userRelations = relations(users, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id],
  }),
  humanReviews: many(humanReviews),
}));

export const schemeRelations = relations(schemes, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [schemes.organisationId],
    references: [organisations.id],
  }),
  blocks: many(blocks),
}));

export const blockRelations = relations(blocks, ({ one, many }) => ({
  scheme: one(schemes, {
    fields: [blocks.schemeId],
    references: [schemes.id],
  }),
  properties: many(properties),
}));

export const propertyRelations = relations(properties, ({ one, many }) => ({
  block: one(blocks, {
    fields: [properties.blockId],
    references: [blocks.id],
  }),
  certificates: many(certificates),
  remedialActions: many(remedialActions),
  units: many(units),
  components: many(components),
}));

export const certificateRelations = relations(certificates, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [certificates.organisationId],
    references: [organisations.id],
  }),
  property: one(properties, {
    fields: [certificates.propertyId],
    references: [properties.id],
  }),
  block: one(blocks, {
    fields: [certificates.blockId],
    references: [blocks.id],
  }),
  uploadedBy: one(users, {
    fields: [certificates.uploadedById],
    references: [users.id],
  }),
  extractions: many(extractions),
  remedialActions: many(remedialActions),
  extractionRuns: many(extractionRuns),
  benchmarkItems: many(benchmarkItems),
}));

export const extractionRelations = relations(extractions, ({ one }) => ({
  certificate: one(certificates, {
    fields: [extractions.certificateId],
    references: [certificates.id],
  }),
}));

export const remedialActionRelations = relations(remedialActions, ({ one }) => ({
  certificate: one(certificates, {
    fields: [remedialActions.certificateId],
    references: [certificates.id],
  }),
  property: one(properties, {
    fields: [remedialActions.propertyId],
    references: [properties.id],
  }),
}));

// Lashan Owned Model Relations
export const extractionSchemaRelations = relations(extractionSchemas, ({ many }) => ({
  extractionRuns: many(extractionRuns),
}));

export const extractionRunRelations = relations(extractionRuns, ({ one }) => ({
  certificate: one(certificates, {
    fields: [extractionRuns.certificateId],
    references: [certificates.id],
  }),
  schema: one(extractionSchemas, {
    fields: [extractionRuns.schemaId],
    references: [extractionSchemas.id],
  }),
}));

export const humanReviewRelations = relations(humanReviews, ({ one }) => ({
  extractionRun: one(extractionRuns, {
    fields: [humanReviews.extractionRunId],
    references: [extractionRuns.id],
  }),
  reviewer: one(users, {
    fields: [humanReviews.reviewerId],
    references: [users.id],
  }),
  organisation: one(organisations, {
    fields: [humanReviews.organisationId],
    references: [organisations.id],
  }),
}));

export const benchmarkSetRelations = relations(benchmarkSets, ({ many }) => ({
  items: many(benchmarkItems),
  evalRuns: many(evalRuns),
}));

export const benchmarkItemRelations = relations(benchmarkItems, ({ one }) => ({
  benchmarkSet: one(benchmarkSets, {
    fields: [benchmarkItems.benchmarkSetId],
    references: [benchmarkSets.id],
  }),
  certificate: one(certificates, {
    fields: [benchmarkItems.certificateId],
    references: [certificates.id],
  }),
}));

export const evalRunRelations = relations(evalRuns, ({ one }) => ({
  benchmarkSet: one(benchmarkSets, {
    fields: [evalRuns.benchmarkSetId],
    references: [benchmarkSets.id],
  }),
  previousRun: one(evalRuns, {
    fields: [evalRuns.previousRunId],
    references: [evalRuns.id],
  }),
}));

// HACT Architecture Relations
export const componentTypeRelations = relations(componentTypes, ({ many }) => ({
  components: many(components),
}));

export const unitRelations = relations(units, ({ one, many }) => ({
  property: one(properties, {
    fields: [units.propertyId],
    references: [properties.id],
  }),
  components: many(components),
}));

export const componentRelations = relations(components, ({ one, many }) => ({
  property: one(properties, {
    fields: [components.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [components.unitId],
    references: [units.id],
  }),
  block: one(blocks, {
    fields: [components.blockId],
    references: [blocks.id],
  }),
  componentType: one(componentTypes, {
    fields: [components.componentTypeId],
    references: [componentTypes.id],
  }),
  componentCertificates: many(componentCertificates),
}));

export const componentCertificateRelations = relations(componentCertificates, ({ one }) => ({
  component: one(components, {
    fields: [componentCertificates.componentId],
    references: [components.id],
  }),
  certificate: one(certificates, {
    fields: [componentCertificates.certificateId],
    references: [certificates.id],
  }),
}));

export const dataImportRelations = relations(dataImports, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [dataImports.organisationId],
    references: [organisations.id],
  }),
  uploadedBy: one(users, {
    fields: [dataImports.uploadedById],
    references: [users.id],
  }),
  rows: many(dataImportRows),
}));

export const dataImportRowRelations = relations(dataImportRows, ({ one }) => ({
  import: one(dataImports, {
    fields: [dataImportRows.importId],
    references: [dataImports.id],
  }),
}));

// Zod Schemas
export const insertOrganisationSchema = createInsertSchema(organisations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertSchemeSchema = createInsertSchema(schemes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBlockSchema = createInsertSchema(blocks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCertificateSchema = createInsertSchema(certificates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExtractionSchema = createInsertSchema(extractions).omit({ id: true, createdAt: true });
export const insertRemedialActionSchema = createInsertSchema(remedialActions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractorSchema = createInsertSchema(contractors).omit({ id: true, createdAt: true, updatedAt: true });

// Lashan Owned Model Insert Schemas
export const insertExtractionSchemaSchema = createInsertSchema(extractionSchemas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExtractionRunSchema = createInsertSchema(extractionRuns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHumanReviewSchema = createInsertSchema(humanReviews).omit({ id: true, reviewedAt: true });
export const insertBenchmarkSetSchema = createInsertSchema(benchmarkSets).omit({ id: true, createdAt: true });
export const insertBenchmarkItemSchema = createInsertSchema(benchmarkItems).omit({ id: true, createdAt: true });
export const insertEvalRunSchema = createInsertSchema(evalRuns).omit({ id: true, createdAt: true });
export const insertComplianceRuleSchema = createInsertSchema(complianceRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNormalisationRuleSchema = createInsertSchema(normalisationRules).omit({ id: true });

// Configuration Insert Schemas
export const insertCertificateTypeSchema = createInsertSchema(certificateTypes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClassificationCodeSchema = createInsertSchema(classificationCodes).omit({ id: true, createdAt: true, updatedAt: true });

// HACT Architecture Insert Schemas
export const insertComponentTypeSchema = createInsertSchema(componentTypes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUnitSchema = createInsertSchema(units).omit({ id: true, createdAt: true, updatedAt: true });
export const insertComponentSchema = createInsertSchema(components).omit({ id: true, createdAt: true, updatedAt: true });
export const insertComponentCertificateSchema = createInsertSchema(componentCertificates).omit({ id: true, createdAt: true });
export const insertDataImportSchema = createInsertSchema(dataImports).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDataImportRowSchema = createInsertSchema(dataImportRows).omit({ id: true });

// Types
export type Organisation = typeof organisations.$inferSelect;
export type InsertOrganisation = z.infer<typeof insertOrganisationSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Scheme = typeof schemes.$inferSelect;
export type InsertScheme = z.infer<typeof insertSchemeSchema>;

export type Block = typeof blocks.$inferSelect;
export type InsertBlock = z.infer<typeof insertBlockSchema>;

export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;

export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;

export type Extraction = typeof extractions.$inferSelect;
export type InsertExtraction = z.infer<typeof insertExtractionSchema>;

export type RemedialAction = typeof remedialActions.$inferSelect;
export type InsertRemedialAction = z.infer<typeof insertRemedialActionSchema>;

export type Contractor = typeof contractors.$inferSelect;
export type InsertContractor = z.infer<typeof insertContractorSchema>;

// Lashan Owned Model Types
export type ExtractionSchema = typeof extractionSchemas.$inferSelect;
export type InsertExtractionSchema = z.infer<typeof insertExtractionSchemaSchema>;

export type ExtractionRun = typeof extractionRuns.$inferSelect;
export type InsertExtractionRun = z.infer<typeof insertExtractionRunSchema>;

export type HumanReview = typeof humanReviews.$inferSelect;
export type InsertHumanReview = z.infer<typeof insertHumanReviewSchema>;

export type BenchmarkSet = typeof benchmarkSets.$inferSelect;
export type InsertBenchmarkSet = z.infer<typeof insertBenchmarkSetSchema>;

export type BenchmarkItem = typeof benchmarkItems.$inferSelect;
export type InsertBenchmarkItem = z.infer<typeof insertBenchmarkItemSchema>;

export type EvalRun = typeof evalRuns.$inferSelect;
export type InsertEvalRun = z.infer<typeof insertEvalRunSchema>;

export type ComplianceRule = typeof complianceRules.$inferSelect;
export type InsertComplianceRule = z.infer<typeof insertComplianceRuleSchema>;

export type NormalisationRule = typeof normalisationRules.$inferSelect;
export type InsertNormalisationRule = z.infer<typeof insertNormalisationRuleSchema>;

// Configuration Types
export type CertificateType = typeof certificateTypes.$inferSelect;
export type InsertCertificateType = z.infer<typeof insertCertificateTypeSchema>;

export type ClassificationCode = typeof classificationCodes.$inferSelect;
export type InsertClassificationCode = z.infer<typeof insertClassificationCodeSchema>;

// HACT Architecture Types
export type ComponentType = typeof componentTypes.$inferSelect;
export type InsertComponentType = z.infer<typeof insertComponentTypeSchema>;

export type Unit = typeof units.$inferSelect;
export type InsertUnit = z.infer<typeof insertUnitSchema>;

export type Component = typeof components.$inferSelect;
export type InsertComponent = z.infer<typeof insertComponentSchema>;

export type ComponentCertificate = typeof componentCertificates.$inferSelect;
export type InsertComponentCertificate = z.infer<typeof insertComponentCertificateSchema>;

export type DataImport = typeof dataImports.$inferSelect;
export type InsertDataImport = z.infer<typeof insertDataImportSchema>;

export type DataImportRow = typeof dataImportRows.$inferSelect;
export type InsertDataImportRow = z.infer<typeof insertDataImportRowSchema>;

export const insertVideoSchema = createInsertSchema(videos).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true, downloadCount: true });
export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;

export const insertAiSuggestionSchema = createInsertSchema(aiSuggestions).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  actionedAt: true,
  resolvedAt: true,
  dismissedAt: true,
  lastCheckedAt: true
});
export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type InsertAiSuggestion = z.infer<typeof insertAiSuggestionSchema>;

// ==========================================
// API MONITORING & INTEGRATIONS
// ==========================================

// Webhook auth types
export const webhookAuthTypeEnum = pgEnum('webhook_auth_type', ['NONE', 'API_KEY', 'BEARER', 'HMAC_SHA256']);
export const webhookStatusEnum = pgEnum('webhook_status', ['ACTIVE', 'PAUSED', 'FAILED', 'DISABLED']);
export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', ['PENDING', 'SENT', 'FAILED', 'RETRYING']);

// API Request Logs - Track individual API requests
export const apiLogs = pgTable("api_logs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  method: text("method").notNull(),
  path: text("path").notNull(),
  statusCode: integer("status_code").notNull(),
  duration: integer("duration").notNull(),
  requestBody: json("request_body"),
  responseBody: json("response_body"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  userId: varchar("user_id").references(() => users.id),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// API Metrics - Aggregated metrics per endpoint/day
export const apiMetrics = pgTable("api_metrics", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  date: text("date").notNull(),
  requestCount: integer("request_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  avgDuration: integer("avg_duration").notNull().default(0),
  p95Duration: integer("p95_duration").notNull().default(0),
  minDuration: integer("min_duration").notNull().default(0),
  maxDuration: integer("max_duration").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Webhook Endpoints - Outbound webhook configurations
export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  authType: webhookAuthTypeEnum("auth_type").notNull().default('NONE'),
  authValue: text("auth_value"),
  headers: json("headers"),
  events: text("events").array().notNull(),
  status: webhookStatusEnum("status").notNull().default('ACTIVE'),
  retryCount: integer("retry_count").notNull().default(3),
  timeoutMs: integer("timeout_ms").notNull().default(30000),
  lastDeliveryAt: timestamp("last_delivery_at"),
  lastDeliveryStatus: text("last_delivery_status"),
  failureCount: integer("failure_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Webhook Events - Queue of events to be delivered
export const webhookEvents = pgTable("webhook_events", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventType: text("event_type").notNull(),
  payload: json("payload").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Webhook Deliveries - Track each delivery attempt
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  webhookEndpointId: varchar("webhook_endpoint_id").references(() => webhookEndpoints.id, { onDelete: 'cascade' }).notNull(),
  eventId: varchar("event_id").references(() => webhookEvents.id).notNull(),
  status: webhookDeliveryStatusEnum("status").notNull().default('PENDING'),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextRetryAt: timestamp("next_retry_at"),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Incoming Webhook Logs - Log received webhooks from external systems
export const incomingWebhookLogs = pgTable("incoming_webhook_logs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  source: text("source").notNull(),
  eventType: text("event_type"),
  payload: json("payload").notNull(),
  headers: json("headers"),
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// API Keys for external integrations
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  scopes: text("scopes").array().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas for new tables
export const insertApiLogSchema = createInsertSchema(apiLogs).omit({ id: true, createdAt: true });
export const insertApiMetricSchema = createInsertSchema(apiMetrics).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWebhookEndpointSchema = createInsertSchema(webhookEndpoints).omit({ id: true, createdAt: true, updatedAt: true, lastDeliveryAt: true, lastDeliveryStatus: true, failureCount: true });
export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({ id: true, createdAt: true, processed: true });
export const insertWebhookDeliverySchema = createInsertSchema(webhookDeliveries).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIncomingWebhookLogSchema = createInsertSchema(incomingWebhookLogs).omit({ id: true, createdAt: true });
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, createdAt: true, lastUsedAt: true });

// Types for new tables
export type ApiLog = typeof apiLogs.$inferSelect;
export type InsertApiLog = z.infer<typeof insertApiLogSchema>;

export type ApiMetric = typeof apiMetrics.$inferSelect;
export type InsertApiMetric = z.infer<typeof insertApiMetricSchema>;

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type InsertWebhookEndpoint = z.infer<typeof insertWebhookEndpointSchema>;

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type InsertWebhookDelivery = z.infer<typeof insertWebhookDeliverySchema>;

export type IncomingWebhookLog = typeof incomingWebhookLogs.$inferSelect;
export type InsertIncomingWebhookLog = z.infer<typeof insertIncomingWebhookLogSchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
