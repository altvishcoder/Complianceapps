import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, real, json, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum('user_role', ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'COMPLIANCE_MANAGER', 'ADMIN', 'MANAGER', 'OFFICER', 'VIEWER']);
export const complianceStatusEnum = pgEnum('compliance_status', ['COMPLIANT', 'EXPIRING_SOON', 'OVERDUE', 'NON_COMPLIANT', 'ACTION_REQUIRED', 'UNKNOWN']);
export const propertyTypeEnum = pgEnum('property_type', ['HOUSE', 'FLAT', 'BUNGALOW', 'MAISONETTE', 'BEDSIT', 'STUDIO']);
export const tenureEnum = pgEnum('tenure', ['SOCIAL_RENT', 'AFFORDABLE_RENT', 'SHARED_OWNERSHIP', 'LEASEHOLD', 'TEMPORARY']);
export const certificateTypeEnum = pgEnum('certificate_type', ['GAS_SAFETY', 'EICR', 'EPC', 'FIRE_RISK_ASSESSMENT', 'LEGIONELLA_ASSESSMENT', 'ASBESTOS_SURVEY', 'LIFT_LOLER', 'OTHER']);
export const certificateStatusEnum = pgEnum('certificate_status', ['UPLOADED', 'PROCESSING', 'EXTRACTED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'FAILED']);
export const certificateOutcomeEnum = pgEnum('certificate_outcome', ['SATISFACTORY', 'UNSATISFACTORY', 'PASS', 'FAIL', 'AT_RISK', 'IMMEDIATELY_DANGEROUS']);
export const severityEnum = pgEnum('severity', ['IMMEDIATE', 'URGENT', 'PRIORITY', 'ROUTINE', 'ADVISORY']);
export const actionStatusEnum = pgEnum('action_status', ['OPEN', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']);
export const propertySourceEnum = pgEnum('property_source', ['MANUAL', 'AUTO_EXTRACTED', 'IMPORTED']);
export const linkStatusEnum = pgEnum('link_status', ['VERIFIED', 'UNVERIFIED']);

// Lashan Owned Model Enums
export const extractionStatusEnum = pgEnum('extraction_status', [
  'PENDING', 'PROCESSING', 'VALIDATION_FAILED', 'REPAIR_IN_PROGRESS', 
  'AWAITING_REVIEW', 'APPROVED', 'REJECTED'
]);

// Chatbot Enums
export const chatIntentEnum = pgEnum('chat_intent', [
  'greeting', 'navigation', 'database', 'faq', 'rag', 'off_topic', 'complex'
]);
export const chatResponseSourceEnum = pgEnum('chat_response_source', [
  'static', 'faq_cache', 'faq_tfidf', 'database', 'rag', 'llm'
]);
export const staffStatusEnum = pgEnum('staff_status', ['ACTIVE', 'PENDING', 'SUSPENDED', 'INACTIVE']);

// Tables
export const organisations = pgTable("organisations", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  settings: json("settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password"),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default('VIEWER'),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const staffMembers = pgTable("staff_members", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  department: text("department"),
  roleTitle: text("role_title"),
  employeeId: text("employee_id"),
  status: staffStatusEnum("status").notNull().default('ACTIVE'),
  tradeSpecialism: text("trade_specialism"),
  gasSafeNumber: text("gas_safe_number"),
  nicEicNumber: text("niceic_number"),
  notes: text("notes"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verifications = pgTable("verifications", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const schemes = pgTable("schemes", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id),
  name: text("name").notNull(),
  reference: text("reference").notNull(),
  complianceStatus: complianceStatusEnum("compliance_status").notNull().default('UNKNOWN'),
  linkStatus: linkStatusEnum("link_status").notNull().default('VERIFIED'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const blocks = pgTable("blocks", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  schemeId: varchar("scheme_id").references(() => schemes.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  reference: text("reference").notNull(),
  hasLift: boolean("has_lift").notNull().default(false),
  hasCommunalBoiler: boolean("has_communal_boiler").notNull().default(false),
  complianceStatus: complianceStatusEnum("compliance_status").notNull().default('UNKNOWN'),
  linkStatus: linkStatusEnum("link_status").notNull().default('VERIFIED'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  blockId: varchar("block_id").references(() => blocks.id, { onDelete: 'cascade' }),
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
  linkStatus: linkStatusEnum("link_status").notNull().default('VERIFIED'),
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
  
  // Geocoding fields for risk maps
  latitude: real("latitude"),
  longitude: real("longitude"),
  ward: text("ward"),
  wardCode: text("ward_code"),
  lsoa: text("lsoa"),
  msoa: text("msoa"),
  geocodedAt: timestamp("geocoded_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
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
  complianceStreamId: varchar("compliance_stream_id"), // Link to compliance stream
  status: certificateStatusEnum("status").notNull().default('UPLOADED'),
  certificateNumber: text("certificate_number"),
  issueDate: text("issue_date"),
  expiryDate: text("expiry_date"),
  outcome: certificateOutcomeEnum("outcome"),
  uploadedById: varchar("uploaded_by_id").references(() => users.id),
  reviewedById: varchar("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  currentVersionId: varchar("current_version_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
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
  deletedAt: timestamp("deleted_at"),
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
  isInternal: boolean("is_internal").notNull().default(false),
  employeeId: text("employee_id"),
  department: text("department"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// ==========================================
// LASHAN OWNED MODEL TABLES
// ==========================================

// Extraction Schemas (Behaviour Contract)
export const extractionSchemas = pgTable("extraction_schemas", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  version: text("version").notNull(), // "v1.0", "v1.1", etc.
  documentType: text("document_type").notNull(), // GAS_SAFETY, EICR, FRA, etc.
  complianceStreamId: varchar("compliance_stream_id"), // Link to compliance stream (FK added after stream table defined)
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
  processingTier: integer("processing_tier").notNull().default(6), // 0-6 ordinal (tier-0 to tier-4)
  tierName: text("tier_name"), // Canonical tier string: "tier-0", "tier-0.5", "tier-1", "tier-1.5", "tier-2", "tier-3", "tier-4"
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

// Extraction Tier Status Enum
export const extractionTierStatusEnum = pgEnum('extraction_tier_status', [
  'success',      // Extraction completed with sufficient confidence
  'escalated',    // Confidence too low, moving to next tier
  'skipped',      // Tier was skipped (e.g., AI disabled)
  'failed',       // Tier failed to process
  'pending'       // Not yet attempted
]);

// Extraction Tier Audits (tracks each tier a certificate passes through)
export const extractionTierAudits = pgTable("extraction_tier_audits", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateId: varchar("certificate_id").references(() => certificates.id, { onDelete: 'cascade' }).notNull(),
  extractionRunId: varchar("extraction_run_id").references(() => extractionRuns.id, { onDelete: 'cascade' }),
  
  // Tier identification
  tier: text("tier").notNull(), // "tier-0", "tier-0.5", "tier-1", "tier-1.5", "tier-2", "tier-3", "tier-4"
  tierOrder: integer("tier_order").notNull(), // 0, 1, 2, 3, 4, 5, 6 for ordering
  
  // Timing
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  processingTimeMs: integer("processing_time_ms").notNull().default(0),
  
  // Results
  status: extractionTierStatusEnum("status").notNull().default('pending'),
  confidence: real("confidence").notNull().default(0),
  cost: real("cost").notNull().default(0), // Cost in GBP
  extractedFieldCount: integer("extracted_field_count").notNull().default(0),
  
  // Why it moved to next tier
  escalationReason: text("escalation_reason"),
  
  // Document analysis (Tier 0)
  documentFormat: text("document_format"), // pdf-native, pdf-scanned, docx, xlsx, image, etc.
  documentClassification: text("document_classification"), // structured_certificate, complex_document, etc.
  pageCount: integer("page_count"),
  textQuality: real("text_quality"), // 0-1 quality score
  
  // QR/Metadata (Tier 0.5)
  qrCodesFound: json("qr_codes_found"), // [{provider, url, verificationCode}]
  metadataExtracted: json("metadata_extracted"), // {dateTaken, gpsCoordinates, software}
  
  // Raw output for debugging
  rawOutput: json("raw_output"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  complianceStreamId: varchar("compliance_stream_id"), // Link to compliance stream
  
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
  complianceStreamId: varchar("compliance_stream_id"), // Link to compliance stream
  
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

// Compliance Streams Configuration (Gas Safety, Electrical, Fire Safety, etc.)
export const complianceStreams = pgTable("compliance_streams", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(), // "GAS_HEATING", "ELECTRICAL", "FIRE_SAFETY", etc.
  name: text("name").notNull(), // "Gas & Heating Safety"
  description: text("description"),
  
  // Stream configuration
  colorCode: text("color_code"), // Hex color for UI display
  iconName: text("icon_name"), // Icon identifier for UI
  
  // System flags
  isSystem: boolean("is_system").notNull().default(false), // Cannot be deleted/modified if true
  isActive: boolean("is_active").notNull().default(true), // Can be disabled without deletion
  
  displayOrder: integer("display_order").notNull().default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Certificate Types Configuration
export const certificateTypes = pgTable("certificate_types", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(), // "GAS_SAFETY", "EICR", etc.
  name: text("name").notNull(), // "Gas Safety Certificate (CP12)"
  shortName: text("short_name").notNull(), // "Gas Safety"
  complianceStream: text("compliance_stream").notNull(), // "GAS_HEATING", "ELECTRICAL", "FIRE_SAFETY", etc.
  streamId: varchar("stream_id").references(() => complianceStreams.id), // FK to compliance_streams
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
  complianceStreamId: varchar("compliance_stream_id"), // Link to compliance stream
  
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

// Certificate Detection Patterns Configuration
// Configurable patterns for detecting certificate types from filenames and text content
export const detectionPatternTypeEnum = pgEnum('detection_pattern_type', ['FILENAME', 'TEXT_CONTENT']);
export const detectionMatcherTypeEnum = pgEnum('detection_matcher_type', ['CONTAINS', 'REGEX', 'STARTS_WITH', 'ENDS_WITH']);

export const certificateDetectionPatterns = pgTable("certificate_detection_patterns", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateTypeId: varchar("certificate_type_id").references(() => certificateTypes.id),
  certificateTypeCode: text("certificate_type_code").notNull(), // Target certificate type code (GAS_SAFETY, EICR, etc.)
  
  patternType: detectionPatternTypeEnum("pattern_type").notNull(), // FILENAME or TEXT_CONTENT
  matcherType: detectionMatcherTypeEnum("matcher_type").notNull().default('CONTAINS'), // How to match
  pattern: text("pattern").notNull(), // The pattern to match (e.g., "LGSR", "CP12", "Gas Safe Register")
  caseSensitive: boolean("case_sensitive").notNull().default(false),
  
  // Multi-pattern support - all patterns must match if specified
  additionalPatterns: text("additional_patterns").array(), // AND conditions (all must match)
  
  priority: integer("priority").notNull().default(0), // Higher = evaluated first
  description: text("description"), // Human-readable description
  
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false), // System patterns cannot be deleted
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Certificate Outcome Rules Configuration
// Configurable rules for determining SATISFACTORY/UNSATISFACTORY outcomes
export const outcomeRuleOperatorEnum = pgEnum('outcome_rule_operator', [
  'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 
  'GREATER_THAN', 'LESS_THAN', 'GREATER_OR_EQUAL', 'LESS_OR_EQUAL',
  'IS_TRUE', 'IS_FALSE', 'IS_NULL', 'IS_NOT_NULL',
  'IN_LIST', 'NOT_IN_LIST', 'REGEX_MATCH',
  'ARRAY_ANY_MATCH', 'ARRAY_ALL_MATCH' // For checking arrays of appliances/defects
]);

export const certificateOutcomeRules = pgTable("certificate_outcome_rules", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateTypeId: varchar("certificate_type_id").references(() => certificateTypes.id),
  certificateTypeCode: text("certificate_type_code").notNull(), // Target certificate type code
  
  ruleName: text("rule_name").notNull(), // Human-readable name
  ruleGroup: text("rule_group"), // Group related rules (e.g., "appliance_safety", "defect_checks")
  
  // Condition definition
  fieldPath: text("field_path").notNull(), // JSON path to the field (e.g., "appliances", "defects", "overallOutcome")
  operator: outcomeRuleOperatorEnum("operator").notNull(),
  value: text("value"), // Value to compare against (for simple operators)
  valueList: text("value_list").array(), // List of values (for IN_LIST operators)
  
  // For array field matching (ARRAY_ANY_MATCH, ARRAY_ALL_MATCH)
  arrayFieldPath: text("array_field_path"), // Field within array item (e.g., "status", "outcome")
  arrayMatchPatterns: text("array_match_patterns").array(), // Patterns to match within array items
  
  // Outcome when rule triggers
  outcome: text("outcome").notNull().default('UNSATISFACTORY'), // SATISFACTORY or UNSATISFACTORY
  
  priority: integer("priority").notNull().default(0), // Higher = evaluated first
  stopOnMatch: boolean("stop_on_match").notNull().default(true), // Stop evaluating if this rule matches
  
  description: text("description"), // Human-readable description
  legislation: text("legislation"), // UK legislation reference
  
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false), // System rules cannot be deleted
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==========================================
// HACT-ALIGNED EXTENDED ARCHITECTURE
// ==========================================


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
  name: text("name").notNull().unique(),              // "Gas Boiler" - must be unique
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


// Space type enum for UKHDS
export const spaceTypeEnum = pgEnum('space_type', ['ROOM', 'COMMUNAL_AREA', 'EXTERNAL', 'CIRCULATION', 'UTILITY', 'STORAGE', 'OTHER']);

// Spaces (specific locations - UKHDS hierarchy level 5)
// Can attach to properties (dwellings), blocks (communal areas), or schemes (estate-wide)
export const spaces = pgTable("spaces", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  // Hierarchical attachment - spaces can link to properties (dwellings), blocks, or schemes
  // At least one should be set; if multiple are set, the most specific takes precedence
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }),
  blockId: varchar("block_id").references(() => blocks.id, { onDelete: 'cascade' }),
  schemeId: varchar("scheme_id").references(() => schemes.id, { onDelete: 'cascade' }),
  
  name: text("name").notNull(),                       // "Boiler Cupboard", "Communal Stairwell", etc.
  reference: text("reference"),                        // Space reference code
  spaceType: spaceTypeEnum("space_type").notNull().default('ROOM'),
  
  description: text("description"),
  
  // Location details
  floor: text("floor"),                               // "Ground", "1st", "Basement"
  accessNotes: text("access_notes"),
  
  // Compliance fields
  areaSqMeters: real("area_sq_meters"),
  isAccessible: boolean("is_accessible").notNull().default(true),
  requiresKeyAccess: boolean("requires_key_access").notNull().default(false),
  
  linkStatus: linkStatusEnum("link_status").notNull().default('VERIFIED'),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Components (assets within units/properties - UKHDS hierarchy)
export const components = pgTable("components", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  // Hierarchical location (all optional for UKHDS flexibility)
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }),
  spaceId: varchar("space_id").references(() => spaces.id, { onDelete: 'cascade' }),
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

// ==========================================
// CHATBOT TABLES
// ==========================================

// Chatbot Conversations (for multi-turn context)
export const chatbotConversations = pgTable("chatbot_conversations", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").references(() => users.id),
  sessionId: text("session_id").notNull(),
  
  title: text("title"),
  messageCount: integer("message_count").notNull().default(0),
  tokensUsed: integer("tokens_used").notNull().default(0),
  
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chatbot Messages (individual messages in conversations)
export const chatbotMessages = pgTable("chatbot_messages", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: varchar("conversation_id").references(() => chatbotConversations.id, { onDelete: 'cascade' }).notNull(),
  
  role: text("role").notNull(),
  content: text("content").notNull(),
  
  intent: chatIntentEnum("intent"),
  responseSource: chatResponseSourceEnum("response_source"),
  confidence: real("confidence"),
  
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  responseTimeMs: integer("response_time_ms"),
  
  ragDocumentsUsed: json("rag_documents_used"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chatbot Analytics (aggregated usage metrics)
export const chatbotAnalytics = pgTable("chatbot_analytics", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  date: text("date").notNull(),
  hour: integer("hour"),
  
  totalQueries: integer("total_queries").notNull().default(0),
  staticResponses: integer("static_responses").notNull().default(0),
  faqHits: integer("faq_hits").notNull().default(0),
  databaseQueries: integer("database_queries").notNull().default(0),
  ragQueries: integer("rag_queries").notNull().default(0),
  llmQueries: integer("llm_queries").notNull().default(0),
  
  totalInputTokens: integer("total_input_tokens").notNull().default(0),
  totalOutputTokens: integer("total_output_tokens").notNull().default(0),
  estimatedCostCents: integer("estimated_cost_cents").notNull().default(0),
  
  avgResponseTimeMs: integer("avg_response_time_ms"),
  
  topIntents: json("top_intents"),
  topTopics: json("top_topics"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Knowledge Embeddings (for RAG vector search)
export const knowledgeEmbeddings = pgTable("knowledge_embeddings", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id"),
  
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  
  metadata: json("metadata"),
  
  embeddingModel: text("embedding_model").notNull(),
  embedding: text("embedding"),
  
  riskScore: real("risk_score"),
  
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

// Factory Settings (rate limits and system configuration - Lashan super user only)
export const factorySettings = pgTable("factory_settings", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  valueType: text("value_type").notNull().default('string'), // string, number, boolean, json
  category: text("category").notNull().default('general'),
  isEditable: boolean("is_editable").notNull().default(true),
  validationRules: json("validation_rules"), // {min: 0, max: 100} for number types
  updatedById: varchar("updated_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Factory Settings Audit (change log for factory settings)
export const factorySettingsAudit = pgTable("factory_settings_audit", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  settingId: varchar("setting_id").references(() => factorySettings.id, { onDelete: 'cascade' }).notNull(),
  key: text("key").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value").notNull(),
  changedById: varchar("changed_by_id").references(() => users.id).notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

// API Clients (for external integrations)
export const apiClientStatusEnum = pgEnum('api_client_status', ['ACTIVE', 'SUSPENDED', 'REVOKED']);

export const apiClients = pgTable("api_clients", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  
  name: text("name").notNull(),
  description: text("description"),
  
  // Authentication
  apiKey: text("api_key").notNull().unique(),          // Hashed API key
  apiKeyPrefix: text("api_key_prefix").notNull(),      // First 8 chars for identification
  apiSecret: text("api_secret"),                        // Optional HMAC secret (hashed)
  
  // Permissions
  scopes: text("scopes").array().notNull().default([]), // ["ingestions:write", "certificates:read"]
  
  // Rate limiting (can override factory defaults)
  rateLimitOverride: json("rate_limit_override"),      // {uploadsPerMinute: 100}
  
  // Status
  status: apiClientStatusEnum("status").notNull().default('ACTIVE'),
  
  // Usage tracking
  lastUsedAt: timestamp("last_used_at"),
  requestCount: integer("request_count").notNull().default(0),
  
  // Metadata
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Upload Sessions (for large file uploads)
export const uploadSessionStatusEnum = pgEnum('upload_session_status', ['PENDING', 'UPLOADING', 'COMPLETED', 'EXPIRED', 'FAILED']);

export const uploadSessions = pgTable("upload_sessions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  apiClientId: varchar("api_client_id").references(() => apiClients.id),
  
  // File metadata
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  contentType: text("content_type").notNull(),
  checksum: text("checksum"),                          // MD5/SHA256 for validation
  
  // Storage
  uploadUrl: text("upload_url"),                        // Pre-signed upload URL
  objectPath: text("object_path"),                      // Final storage path
  
  // Status
  status: uploadSessionStatusEnum("status").notNull().default('PENDING'),
  
  // Expiry
  expiresAt: timestamp("expires_at").notNull(),
  
  // Idempotency
  idempotencyKey: text("idempotency_key").unique(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Ingestion Jobs (async certificate processing)
export const ingestionJobStatusEnum = pgEnum('ingestion_job_status', ['QUEUED', 'UPLOADING', 'PROCESSING', 'EXTRACTING', 'COMPLETE', 'FAILED', 'CANCELLED']);
export const ingestionChannelEnum = pgEnum('ingestion_channel', ['MANUAL_UPLOAD', 'EXTERNAL_API', 'BULK_IMPORT', 'DEMO']);

export const ingestionJobs = pgTable("ingestion_jobs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  apiClientId: varchar("api_client_id").references(() => apiClients.id),
  uploadSessionId: varchar("upload_session_id").references(() => uploadSessions.id),
  batchId: varchar("batch_id").references(() => ingestionBatches.id),
  
  // Ingestion channel (source)
  channel: ingestionChannelEnum("channel").notNull().default('MANUAL_UPLOAD'),
  
  // Certificate metadata
  certificateType: certificateTypeEnum("certificate_type").notNull(),
  propertyUprn: text("property_uprn"),
  propertyId: varchar("property_id").references(() => properties.id),
  
  // Source file
  fileName: text("file_name").notNull(),
  objectPath: text("object_path"),
  
  // Processing
  status: ingestionJobStatusEnum("status").notNull().default('QUEUED'),
  progress: integer("progress").notNull().default(0),
  statusMessage: text("status_message"),
  
  // Result
  certificateId: varchar("certificate_id").references(() => certificates.id),
  extractionId: varchar("extraction_id"),
  errorDetails: json("error_details"),
  
  // Retry handling
  attemptCount: integer("attempt_count").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Webhook
  webhookUrl: text("webhook_url"),
  webhookDelivered: boolean("webhook_delivered").notNull().default(false),
  
  // Idempotency
  idempotencyKey: text("idempotency_key").unique(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Rate limiting entries for PostgreSQL-backed rate limiting
export const rateLimitEntries = pgTable("rate_limit_entries", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: varchar("client_id").notNull(),
  requestCount: integer("request_count").notNull().default(0),
  windowStart: timestamp("window_start").notNull(),
  windowResetAt: timestamp("window_reset_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert/Select types for rate limiting
export const insertRateLimitEntrySchema = createInsertSchema(rateLimitEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRateLimitEntry = z.infer<typeof insertRateLimitEntrySchema>;
export type RateLimitEntry = typeof rateLimitEntries.$inferSelect;

// Relations
export const organisationRelations = relations(organisations, ({ many }) => ({
  users: many(users),
  schemes: many(schemes),
  certificates: many(certificates),
  humanReviews: many(humanReviews),
  dataImports: many(dataImports),
  apiClients: many(apiClients),
  ingestionJobs: many(ingestionJobs),
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
  spaces: many(spaces),
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

export const extractionRunRelations = relations(extractionRuns, ({ one, many }) => ({
  certificate: one(certificates, {
    fields: [extractionRuns.certificateId],
    references: [certificates.id],
  }),
  schema: one(extractionSchemas, {
    fields: [extractionRuns.schemaId],
    references: [extractionSchemas.id],
  }),
  tierAudits: many(extractionTierAudits),
}));

export const extractionTierAuditRelations = relations(extractionTierAudits, ({ one }) => ({
  certificate: one(certificates, {
    fields: [extractionTierAudits.certificateId],
    references: [certificates.id],
  }),
  extractionRun: one(extractionRuns, {
    fields: [extractionTierAudits.extractionRunId],
    references: [extractionRuns.id],
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

export const componentRelations = relations(components, ({ one, many }) => ({
  property: one(properties, {
    fields: [components.propertyId],
    references: [properties.id],
  }),
  space: one(spaces, {
    fields: [components.spaceId],
    references: [spaces.id],
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
export const insertStaffMemberSchema = createInsertSchema(staffMembers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSchemeSchema = createInsertSchema(schemes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBlockSchema = createInsertSchema(blocks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIngestionBatchSchema = createInsertSchema(ingestionBatches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCertificateSchema = createInsertSchema(certificates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExtractionSchema = createInsertSchema(extractions).omit({ id: true, createdAt: true });
export const insertRemedialActionSchema = createInsertSchema(remedialActions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractorSchema = createInsertSchema(contractors).omit({ id: true, createdAt: true, updatedAt: true });

// Lashan Owned Model Insert Schemas
export const insertExtractionSchemaSchema = createInsertSchema(extractionSchemas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExtractionRunSchema = createInsertSchema(extractionRuns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExtractionTierAuditSchema = createInsertSchema(extractionTierAudits).omit({ id: true, createdAt: true });
export const insertHumanReviewSchema = createInsertSchema(humanReviews).omit({ id: true, reviewedAt: true });
export const insertBenchmarkSetSchema = createInsertSchema(benchmarkSets).omit({ id: true, createdAt: true });
export const insertBenchmarkItemSchema = createInsertSchema(benchmarkItems).omit({ id: true, createdAt: true });
export const insertEvalRunSchema = createInsertSchema(evalRuns).omit({ id: true, createdAt: true });
export const insertComplianceRuleSchema = createInsertSchema(complianceRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNormalisationRuleSchema = createInsertSchema(normalisationRules).omit({ id: true });

// Configuration Insert Schemas
export const insertComplianceStreamSchema = createInsertSchema(complianceStreams).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCertificateTypeSchema = createInsertSchema(certificateTypes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClassificationCodeSchema = createInsertSchema(classificationCodes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDetectionPatternSchema = createInsertSchema(certificateDetectionPatterns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOutcomeRuleSchema = createInsertSchema(certificateOutcomeRules).omit({ id: true, createdAt: true, updatedAt: true });

// HACT Architecture Insert Schemas
export const insertComponentTypeSchema = createInsertSchema(componentTypes).omit({ id: true, createdAt: true, updatedAt: true });
// Space schema with validation: spaces attach to exactly one hierarchy level (property, block, or scheme)
export const insertSpaceSchema = createInsertSchema(spaces)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .refine(
    (data) => {
      const attachments = [data.propertyId, data.blockId, data.schemeId].filter(Boolean);
      return attachments.length === 1;
    },
    { message: "Space must attach to exactly one level: propertyId (dwelling), blockId (communal), or schemeId (estate)" }
  );
export const insertComponentSchema = createInsertSchema(components).omit({ id: true, createdAt: true, updatedAt: true });
export const insertComponentCertificateSchema = createInsertSchema(componentCertificates).omit({ id: true, createdAt: true });
export const insertDataImportSchema = createInsertSchema(dataImports).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDataImportRowSchema = createInsertSchema(dataImportRows).omit({ id: true });

// Types
export type Organisation = typeof organisations.$inferSelect;
export type InsertOrganisation = z.infer<typeof insertOrganisationSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type StaffMember = typeof staffMembers.$inferSelect;
export type InsertStaffMember = z.infer<typeof insertStaffMemberSchema>;

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

export type ExtractionTierAudit = typeof extractionTierAudits.$inferSelect;
export type InsertExtractionTierAudit = z.infer<typeof insertExtractionTierAuditSchema>;

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
export type ComplianceStream = typeof complianceStreams.$inferSelect;
export type InsertComplianceStream = z.infer<typeof insertComplianceStreamSchema>;

export type CertificateType = typeof certificateTypes.$inferSelect;
export type InsertCertificateType = z.infer<typeof insertCertificateTypeSchema>;

export type ClassificationCode = typeof classificationCodes.$inferSelect;
export type InsertClassificationCode = z.infer<typeof insertClassificationCodeSchema>;

export type DetectionPattern = typeof certificateDetectionPatterns.$inferSelect;
export type InsertDetectionPattern = z.infer<typeof insertDetectionPatternSchema>;

export type OutcomeRule = typeof certificateOutcomeRules.$inferSelect;
export type InsertOutcomeRule = z.infer<typeof insertOutcomeRuleSchema>;

// HACT Architecture Types
export type ComponentType = typeof componentTypes.$inferSelect;
export type InsertComponentType = z.infer<typeof insertComponentTypeSchema>;

export type Space = typeof spaces.$inferSelect;
export type InsertSpace = z.infer<typeof insertSpaceSchema>;

export type Component = typeof components.$inferSelect;
export type InsertComponent = z.infer<typeof insertComponentSchema>;

export type ComponentCertificate = typeof componentCertificates.$inferSelect;
export type InsertComponentCertificate = z.infer<typeof insertComponentCertificateSchema>;

export type DataImport = typeof dataImports.$inferSelect;
export type InsertDataImport = z.infer<typeof insertDataImportSchema>;

export type DataImportRow = typeof dataImportRows.$inferSelect;
export type InsertDataImportRow = z.infer<typeof insertDataImportRowSchema>;

// Factory Settings schemas and types
export const insertFactorySettingSchema = createInsertSchema(factorySettings).omit({ id: true, createdAt: true, updatedAt: true });
export type FactorySetting = typeof factorySettings.$inferSelect;
export type InsertFactorySetting = z.infer<typeof insertFactorySettingSchema>;

export const insertFactorySettingsAuditSchema = createInsertSchema(factorySettingsAudit).omit({ id: true, changedAt: true });
export type FactorySettingsAudit = typeof factorySettingsAudit.$inferSelect;
export type InsertFactorySettingsAudit = z.infer<typeof insertFactorySettingsAuditSchema>;

// API Clients schemas and types
export const insertApiClientSchema = createInsertSchema(apiClients).omit({ id: true, createdAt: true, updatedAt: true, lastUsedAt: true, requestCount: true });
export type ApiClient = typeof apiClients.$inferSelect;
export type InsertApiClient = z.infer<typeof insertApiClientSchema>;

// Upload Sessions schemas and types
export const insertUploadSessionSchema = createInsertSchema(uploadSessions).omit({ id: true, createdAt: true, completedAt: true });
export type UploadSession = typeof uploadSessions.$inferSelect;
export type InsertUploadSession = z.infer<typeof insertUploadSessionSchema>;

// Ingestion Batches schemas and types
export type IngestionBatch = typeof ingestionBatches.$inferSelect;
export type InsertIngestionBatch = z.infer<typeof insertIngestionBatchSchema>;

// Ingestion Jobs schemas and types
export const insertIngestionJobSchema = createInsertSchema(ingestionJobs).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true, lastAttemptAt: true, nextRetryAt: true });
export type IngestionJob = typeof ingestionJobs.$inferSelect;
export type InsertIngestionJob = z.infer<typeof insertIngestionJobSchema>;

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
// SYSTEM LOGS
// ==========================================

export const logLevelEnum = pgEnum('log_level', ['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
export const logSourceEnum = pgEnum('log_source', ['api', 'job-queue', 'extraction', 'webhook', 'http', 'system']);

export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  level: logLevelEnum("level").notNull(),
  source: logSourceEnum("source").notNull().default('system'),
  message: text("message").notNull(),
  context: json("context"),
  requestId: text("request_id"),
  userId: varchar("user_id"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({ id: true });
export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;

// ==========================================
// RISK MAPS & SNAPSHOTS
// ==========================================

export const riskLevelEnum = pgEnum('risk_level', ['property', 'block', 'scheme', 'ward', 'organisation']);
export const riskTrendEnum = pgEnum('risk_trend', ['improving', 'stable', 'deteriorating']);

export const riskSnapshots = pgTable("risk_snapshots", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  level: riskLevelEnum("level").notNull(),
  levelId: varchar("level_id").notNull(),
  levelName: text("level_name"),
  
  compositeScore: real("composite_score").notNull(),
  gasScore: real("gas_score"),
  electricalScore: real("electrical_score"),
  fireScore: real("fire_score"),
  asbestosScore: real("asbestos_score"),
  liftScore: real("lift_score"),
  waterScore: real("water_score"),
  
  criticalDefects: integer("critical_defects").notNull().default(0),
  majorDefects: integer("major_defects").notNull().default(0),
  minorDefects: integer("minor_defects").notNull().default(0),
  
  propertyCount: integer("property_count").notNull().default(0),
  unitCount: integer("unit_count").notNull().default(0),
  
  previousScore: real("previous_score"),
  trend: riskTrendEnum("trend"),
  
  latitude: real("latitude"),
  longitude: real("longitude"),
  
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
});

export const insertRiskSnapshotSchema = createInsertSchema(riskSnapshots).omit({ id: true });
export type RiskSnapshot = typeof riskSnapshots.$inferSelect;
export type InsertRiskSnapshot = z.infer<typeof insertRiskSnapshotSchema>;

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

// Audit Trail Enums
export const auditActorTypeEnum = pgEnum('audit_actor_type', ['USER', 'SYSTEM', 'API']);
export const auditEventTypeEnum = pgEnum('audit_event_type', [
  'CERTIFICATE_UPLOADED',
  'CERTIFICATE_PROCESSED',
  'CERTIFICATE_STATUS_CHANGED',
  'CERTIFICATE_APPROVED',
  'CERTIFICATE_REJECTED',
  'CERTIFICATE_DELETED',
  'EXTRACTION_COMPLETED',
  'REMEDIAL_ACTION_CREATED',
  'REMEDIAL_ACTION_UPDATED',
  'REMEDIAL_ACTION_COMPLETED',
  'PROPERTY_CREATED',
  'PROPERTY_UPDATED',
  'PROPERTY_DELETED',
  'COMPONENT_CREATED',
  'COMPONENT_UPDATED',
  'USER_LOGIN',
  'USER_LOGOUT',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_ROLE_CHANGED',
  'SETTINGS_CHANGED',
  'API_KEY_CREATED',
  'API_KEY_REVOKED',
  'BULK_IMPORT_COMPLETED',
]);
export const auditEntityTypeEnum = pgEnum('audit_entity_type', [
  'CERTIFICATE', 'PROPERTY', 'COMPONENT', 'REMEDIAL_ACTION', 
  'USER', 'ORGANISATION', 'API_KEY', 'SETTINGS'
]);

// Audit Events Table - tracks all changes for compliance
export const auditEvents = pgTable("audit_events", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  actorId: varchar("actor_id"),
  actorName: text("actor_name"),
  actorType: auditActorTypeEnum("actor_type").notNull().default('USER'),
  eventType: auditEventTypeEnum("event_type").notNull(),
  entityType: auditEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  entityName: text("entity_name"),
  propertyId: varchar("property_id").references(() => properties.id),
  certificateId: varchar("certificate_id").references(() => certificates.id),
  beforeState: json("before_state"),
  afterState: json("after_state"),
  changes: json("changes"),
  message: text("message").notNull(),
  metadata: json("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Audit Events Insert Schema
export const insertAuditEventSchema = createInsertSchema(auditEvents).omit({ id: true, createdAt: true });
export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;

// =====================================================
// PREDICTIVE COMPLIANCE RADAR - RISK SCORING SYSTEM
// =====================================================

export const riskTierEnum = pgEnum('risk_tier', ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export const riskFactorTypeEnum = pgEnum('risk_factor_type', [
  'EXPIRY_RISK',
  'DEFECT_RISK', 
  'ASSET_PROFILE_RISK',
  'COVERAGE_GAP_RISK',
  'EXTERNAL_FACTOR_RISK'
]);
export const riskAlertStatusEnum = pgEnum('risk_alert_status', ['OPEN', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED', 'DISMISSED']);

export const propertyRiskSnapshots = pgTable("property_risk_snapshots", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  snapshotDate: timestamp("snapshot_date").defaultNow().notNull(),
  
  overallScore: integer("overall_score").notNull().default(0),
  riskTier: riskTierEnum("risk_tier").notNull().default('LOW'),
  
  expiryRiskScore: integer("expiry_risk_score").notNull().default(0),
  defectRiskScore: integer("defect_risk_score").notNull().default(0),
  assetProfileRiskScore: integer("asset_profile_risk_score").notNull().default(0),
  coverageGapRiskScore: integer("coverage_gap_risk_score").notNull().default(0),
  externalFactorRiskScore: integer("external_factor_risk_score").notNull().default(0),
  
  factorBreakdown: json("factor_breakdown").$type<{
    expiringCertificates: number;
    overdueCertificates: number;
    openDefects: number;
    criticalDefects: number;
    missingStreams: string[];
    assetAge: number | null;
    isHRB: boolean;
    hasVulnerableOccupants: boolean;
    epcRating: string | null;
  }>(),
  
  triggeringFactors: text("triggering_factors").array(),
  recommendedActions: text("recommended_actions").array(),
  legislationReferences: text("legislation_references").array(),
  
  previousScore: integer("previous_score"),
  scoreChange: integer("score_change"),
  trendDirection: text("trend_direction"),
  
  isLatest: boolean("is_latest").notNull().default(true),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const riskFactorDefinitions = pgTable("risk_factor_definitions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id),
  factorType: riskFactorTypeEnum("factor_type").notNull(),
  factorName: text("factor_name").notNull(),
  description: text("description"),
  
  weight: integer("weight").notNull().default(20),
  maxScore: integer("max_score").notNull().default(100),
  
  thresholds: json("thresholds").$type<{
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  }>(),
  
  calculationLogic: text("calculation_logic"),
  legislationReference: text("legislation_reference"),
  
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false),
  priority: integer("priority").notNull().default(50),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const riskAlerts = pgTable("risk_alerts", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  snapshotId: varchar("snapshot_id").references(() => propertyRiskSnapshots.id),
  
  alertType: text("alert_type").notNull(),
  riskTier: riskTierEnum("risk_tier").notNull(),
  status: riskAlertStatusEnum("status").notNull().default('OPEN'),
  
  title: text("title").notNull(),
  description: text("description").notNull(),
  triggeringFactors: text("triggering_factors").array(),
  
  riskScore: integer("risk_score").notNull(),
  previousScore: integer("previous_score"),
  
  dueDate: timestamp("due_date"),
  slaHours: integer("sla_hours"),
  escalationLevel: integer("escalation_level").notNull().default(0),
  
  acknowledgedById: varchar("acknowledged_by_id").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedById: varchar("resolved_by_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  
  linkedRemedialActionIds: text("linked_remedial_action_ids").array(),
  linkedCertificateIds: text("linked_certificate_ids").array(),
  
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPropertyRiskSnapshotSchema = createInsertSchema(propertyRiskSnapshots).omit({ 
  id: true, createdAt: true, calculatedAt: true 
});
export const insertRiskFactorDefinitionSchema = createInsertSchema(riskFactorDefinitions).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertRiskAlertSchema = createInsertSchema(riskAlerts).omit({ 
  id: true, createdAt: true, updatedAt: true 
});

export type PropertyRiskSnapshot = typeof propertyRiskSnapshots.$inferSelect;
export type InsertPropertyRiskSnapshot = z.infer<typeof insertPropertyRiskSnapshotSchema>;

export type RiskFactorDefinition = typeof riskFactorDefinitions.$inferSelect;
export type InsertRiskFactorDefinition = z.infer<typeof insertRiskFactorDefinitionSchema>;

export type RiskAlert = typeof riskAlerts.$inferSelect;
export type InsertRiskAlert = z.infer<typeof insertRiskAlertSchema>;

// =====================================================
// CONTRACTOR VERIFICATION SYSTEM
// UK Building Safety Act & Social Housing Regulation Act Compliance
// =====================================================

export const contractorRegistrationTypeEnum = pgEnum('contractor_registration_type', [
  'GAS_SAFE',           // Gas Safe Register - required for all gas work
  'NICEIC',             // National Inspection Council for Electrical Installation
  'NAPIT',              // National Association of Professional Inspectors and Testers
  'ELECSA',             // Electrical Competent Person Scheme
  'ECS',                // Electrotechnical Certification Scheme
  'OFTEC',              // Oil Firing Technical Association
  'HETAS',              // Solid fuel heating
  'BESCA',              // Building Engineering Services Competence Assessment
  'FENSA',              // Fenestration Self-Assessment Scheme
  'CHAS',               // Contractors Health and Safety Assessment
  'SAFE_CONTRACTOR',    // SafeContractor accreditation
  'CONSTRUCTIONLINE',   // Constructionline verified
  'CIOB',               // Chartered Institute of Building - Principal Contractor
  'PAS_8672',           // Building Safety Act Principal Contractor competence
  'SSIP',               // Safety Schemes in Procurement
  'OTHER'
]);

export const contractorVerificationStatusEnum = pgEnum('contractor_verification_status', [
  'UNVERIFIED',         // Not yet verified
  'PENDING',            // Verification in progress
  'VERIFIED',           // Manually verified as valid
  'EXPIRED',            // Registration has expired
  'SUSPENDED',          // Registration suspended by issuing body
  'REVOKED',            // Registration revoked
  'FAILED'              // Verification failed
]);

export const contractorWorkCategoryEnum = pgEnum('contractor_work_category', [
  'GAS_BOILER',         // Gas boiler installation/service
  'GAS_APPLIANCES',     // Gas appliance work
  'GAS_FIRES',          // Gas fire installation
  'ELECTRICAL_INSTALL', // Electrical installation
  'ELECTRICAL_TEST',    // Electrical testing/inspection
  'FIRE_ALARM',         // Fire alarm systems
  'FIRE_DOOR',          // Fire door installation
  'FIRE_EXTINGUISHER',  // Fire extinguisher service
  'LIFT_MAINTENANCE',   // Lift/elevator maintenance
  'LEGIONELLA',         // Legionella risk assessment
  'ASBESTOS_SURVEY',    // Asbestos surveys
  'ASBESTOS_REMOVAL',   // Asbestos removal (licensed)
  'WATER_HYGIENE',      // Water hygiene testing
  'EPC_ASSESSMENT',     // EPC assessments
  'GENERAL_MAINTENANCE',// General property maintenance
  'ROOFING',            // Roofing work
  'PLUMBING',           // Plumbing work
  'OTHER'
]);

// Contractor certifications/registrations
export const contractorCertifications = pgTable("contractor_certifications", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  contractorId: varchar("contractor_id").references(() => contractors.id, { onDelete: 'cascade' }).notNull(),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  
  registrationType: contractorRegistrationTypeEnum("registration_type").notNull(),
  registrationNumber: text("registration_number").notNull(),
  registrationName: text("registration_name"),
  
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"),
  
  verificationStatus: contractorVerificationStatusEnum("verification_status").notNull().default('UNVERIFIED'),
  verifiedAt: timestamp("verified_at"),
  verifiedById: varchar("verified_by_id").references(() => users.id),
  verificationMethod: text("verification_method"),
  verificationNotes: text("verification_notes"),
  
  workCategories: text("work_categories").array(),
  
  documentUrl: text("document_url"),
  documentId: varchar("document_id"),
  
  isActive: boolean("is_active").notNull().default(true),
  
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Verification history for audit trail
export const contractorVerificationHistory = pgTable("contractor_verification_history", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  contractorId: varchar("contractor_id").references(() => contractors.id, { onDelete: 'cascade' }).notNull(),
  certificationId: varchar("certification_id").references(() => contractorCertifications.id, { onDelete: 'cascade' }),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  
  verificationType: text("verification_type").notNull(),
  previousStatus: contractorVerificationStatusEnum("previous_status"),
  newStatus: contractorVerificationStatusEnum("new_status").notNull(),
  
  verifiedById: varchar("verified_by_id").references(() => users.id),
  verifiedByName: text("verified_by_name"),
  verificationMethod: text("verification_method").notNull(),
  
  lookupUrl: text("lookup_url"),
  screenshotUrl: text("screenshot_url"),
  notes: text("notes"),
  
  registrationDataSnapshot: json("registration_data_snapshot"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Contractor alerts for expiring certifications
export const contractorAlerts = pgTable("contractor_alerts", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  contractorId: varchar("contractor_id").references(() => contractors.id, { onDelete: 'cascade' }).notNull(),
  certificationId: varchar("certification_id").references(() => contractorCertifications.id, { onDelete: 'cascade' }),
  
  alertType: text("alert_type").notNull(),
  severity: severityEnum("severity").notNull().default('PRIORITY'),
  status: riskAlertStatusEnum("status").notNull().default('OPEN'),
  
  title: text("title").notNull(),
  description: text("description").notNull(),
  
  dueDate: timestamp("due_date"),
  slaHours: integer("sla_hours"),
  
  acknowledgedById: varchar("acknowledged_by_id").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedById: varchar("resolved_by_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Contractor work assignments tracking
export const contractorAssignments = pgTable("contractor_assignments", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  contractorId: varchar("contractor_id").references(() => contractors.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  remedialActionId: varchar("remedial_action_id").references(() => remedialActions.id),
  
  workCategory: contractorWorkCategoryEnum("work_category").notNull(),
  description: text("description"),
  
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  status: actionStatusEnum("status").notNull().default('OPEN'),
  
  verifiedCertificationsAtAssignment: text("verified_certifications").array(),
  
  assignedById: varchar("assigned_by_id").references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  
  notes: text("notes"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas for contractor verification tables
export const insertContractorCertificationSchema = createInsertSchema(contractorCertifications).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertContractorVerificationHistorySchema = createInsertSchema(contractorVerificationHistory).omit({ 
  id: true, createdAt: true 
});
export const insertContractorAlertSchema = createInsertSchema(contractorAlerts).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertContractorAssignmentSchema = createInsertSchema(contractorAssignments).omit({ 
  id: true, createdAt: true, updatedAt: true 
});

// Types for contractor verification tables
export type ContractorCertification = typeof contractorCertifications.$inferSelect;
export type InsertContractorCertification = z.infer<typeof insertContractorCertificationSchema>;

export type ContractorVerificationHistory = typeof contractorVerificationHistory.$inferSelect;
export type InsertContractorVerificationHistory = z.infer<typeof insertContractorVerificationHistorySchema>;

export type ContractorAlert = typeof contractorAlerts.$inferSelect;
export type InsertContractorAlert = z.infer<typeof insertContractorAlertSchema>;

export type ContractorAssignment = typeof contractorAssignments.$inferSelect;
export type InsertContractorAssignment = z.infer<typeof insertContractorAssignmentSchema>;

// =====================================================
// CONTRACTOR SLA & PERFORMANCE TRACKING
// =====================================================

// SLA Priority levels
export const slaPriorityEnum = pgEnum('sla_priority', [
  'EMERGENCY',    // 24 hours or less
  'URGENT',       // 3 days
  'HIGH',         // 7 days
  'STANDARD',     // 28 days
  'LOW'           // 60 days
]);

// SLA compliance status
export const slaComplianceStatusEnum = pgEnum('sla_compliance_status', [
  'ON_TRACK',     // Within SLA timeframe
  'AT_RISK',      // 75%+ of SLA time used
  'BREACHED',     // SLA deadline passed
  'COMPLETED',    // Finished within SLA
  'COMPLETED_LATE' // Finished but after SLA
]);

// Contractor SLA Profiles - Define SLA targets per work category
export const contractorSLAProfiles = pgTable("contractor_sla_profiles", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  
  name: text("name").notNull(),
  description: text("description"),
  workCategory: contractorWorkCategoryEnum("work_category").notNull(),
  priority: slaPriorityEnum("priority").notNull(),
  
  responseTimeHours: integer("response_time_hours").notNull(),
  completionTimeHours: integer("completion_time_hours").notNull(),
  
  penaltyPercentage: integer("penalty_percentage").default(0),
  bonusPercentage: integer("bonus_percentage").default(0),
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Contractor Job Performance - Track actual performance per assignment
export const contractorJobPerformance = pgTable("contractor_job_performance", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  contractorId: varchar("contractor_id").references(() => contractors.id).notNull(),
  assignmentId: varchar("assignment_id").references(() => contractorAssignments.id),
  
  slaProfileId: varchar("sla_profile_id").references(() => contractorSLAProfiles.id),
  priority: slaPriorityEnum("priority").notNull(),
  
  assignedAt: timestamp("assigned_at").notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  slaDeadline: timestamp("sla_deadline").notNull(),
  responseDeadline: timestamp("response_deadline"),
  
  slaStatus: slaComplianceStatusEnum("sla_status").notNull().default('ON_TRACK'),
  
  responseTimeMinutes: integer("response_time_minutes"),
  completionTimeMinutes: integer("completion_time_minutes"),
  slaBreachMinutes: integer("sla_breach_minutes"),
  
  firstTimeFixRate: boolean("first_time_fix"),
  returnVisitRequired: boolean("return_visit_required").default(false),
  defectsRaised: integer("defects_raised").default(0),
  
  notes: text("notes"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Contractor Ratings - Customer/property manager satisfaction
export const contractorRatings = pgTable("contractor_ratings", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  contractorId: varchar("contractor_id").references(() => contractors.id).notNull(),
  jobPerformanceId: varchar("job_performance_id").references(() => contractorJobPerformance.id),
  
  ratedById: varchar("rated_by_id").references(() => users.id),
  
  overallRating: integer("overall_rating").notNull(),
  qualityRating: integer("quality_rating"),
  timelinessRating: integer("timeliness_rating"),
  communicationRating: integer("communication_rating"),
  safetyRating: integer("safety_rating"),
  
  feedback: text("feedback"),
  wouldRecommend: boolean("would_recommend"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for SLA tables
export const insertContractorSLAProfileSchema = createInsertSchema(contractorSLAProfiles).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertContractorJobPerformanceSchema = createInsertSchema(contractorJobPerformance).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertContractorRatingSchema = createInsertSchema(contractorRatings).omit({ 
  id: true, createdAt: true 
});

// Types for SLA tables
export type ContractorSLAProfile = typeof contractorSLAProfiles.$inferSelect;
export type InsertContractorSLAProfile = z.infer<typeof insertContractorSLAProfileSchema>;

export type ContractorJobPerformance = typeof contractorJobPerformance.$inferSelect;
export type InsertContractorJobPerformance = z.infer<typeof insertContractorJobPerformanceSchema>;

export type ContractorRating = typeof contractorRatings.$inferSelect;
export type InsertContractorRating = z.infer<typeof insertContractorRatingSchema>;

// =====================================================
// GOLDEN THREAD COMPLIANCE TABLES
// =====================================================

// Certificate Versions - tracks all document versions when re-uploaded
export const certificateVersions = pgTable("certificate_versions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateId: varchar("certificate_id").references(() => certificates.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storageKey: text("storage_key"),
  
  extractedData: json("extracted_data"),
  extractionRunId: varchar("extraction_run_id"),
  
  uploadedById: varchar("uploaded_by_id").references(() => users.id),
  uploadReason: text("upload_reason"),
  
  supersededAt: timestamp("superseded_at"),
  supersededById: varchar("superseded_by_id"),
  supersededReason: text("superseded_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Change Scope Enum - categorizes what type of entity was changed
export const changeScopeEnum = pgEnum('change_scope', [
  'PROPERTY', 'COMPONENT', 'BUILDING_FABRIC', 'CERTIFICATE', 
  'REMEDIAL_ACTION', 'CONTRACTOR', 'USER', 'SETTINGS', 'SCHEME', 'BLOCK'
]);

// Audit Field Changes - detailed field-level change tracking
export const auditFieldChanges = pgTable("audit_field_changes", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  auditEventId: varchar("audit_event_id").references(() => auditEvents.id, { onDelete: 'cascade' }).notNull(),
  
  tableName: text("table_name").notNull(),
  recordId: varchar("record_id").notNull(),
  changeScope: changeScopeEnum("change_scope").notNull(),
  
  fieldName: text("field_name").notNull(),
  fieldLabel: text("field_label"),
  previousValue: json("previous_value"),
  newValue: json("new_value"),
  
  isSignificant: boolean("is_significant").notNull().default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// UKHDS Export Jobs - tracks export requests for golden thread handover
export const ukhdsExportStatusEnum = pgEnum('ukhds_export_status', [
  'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'
]);

export const ukhdsExports = pgTable("ukhds_exports", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  requestedById: varchar("requested_by_id").references(() => users.id).notNull(),
  
  exportType: text("export_type").notNull().default('FULL'),
  exportFormat: text("export_format").notNull().default('JSON'),
  
  status: ukhdsExportStatusEnum("status").notNull().default('PENDING'),
  
  includeProperties: boolean("include_properties").notNull().default(true),
  includeComponents: boolean("include_components").notNull().default(true),
  includeCertificates: boolean("include_certificates").notNull().default(true),
  includeCertificateVersions: boolean("include_certificate_versions").notNull().default(true),
  includeAuditTrail: boolean("include_audit_trail").notNull().default(true),
  includeRemedialActions: boolean("include_remedial_actions").notNull().default(true),
  
  dateRangeStart: timestamp("date_range_start"),
  dateRangeEnd: timestamp("date_range_end"),
  schemeIds: text("scheme_ids").array(),
  
  totalRecords: integer("total_records"),
  processedRecords: integer("processed_records").default(0),
  
  storageKey: text("storage_key"),
  downloadUrl: text("download_url"),
  expiresAt: timestamp("expires_at"),
  
  errorMessage: text("error_message"),
  metadata: json("metadata"),
  
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Compliance Calendar Events - legislative dates, company-wide events, and compliance stream tasks
export const calendarEventTypeEnum = pgEnum('calendar_event_type', [
  'LEGISLATIVE', 'COMPANY_WIDE', 'STREAM_TASK', 'CERTIFICATE_EXPIRY', 'REMEDIAL_DUE', 'INSPECTION'
]);

export const calendarEventRecurrenceEnum = pgEnum('calendar_event_recurrence', [
  'NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'
]);

export const complianceCalendarEvents = pgTable("compliance_calendar_events", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  
  title: text("title").notNull(),
  description: text("description"),
  
  eventType: calendarEventTypeEnum("event_type").notNull(),
  complianceStreamId: varchar("compliance_stream_id").references(() => complianceStreams.id),
  
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  allDay: boolean("all_day").notNull().default(true),
  
  recurrence: calendarEventRecurrenceEnum("recurrence").notNull().default('NONE'),
  recurrenceEndDate: timestamp("recurrence_end_date"),
  
  propertyId: varchar("property_id").references(() => properties.id),
  certificateId: varchar("certificate_id").references(() => certificates.id),
  remedialActionId: varchar("remedial_action_id").references(() => remedialActions.id),
  
  reminderDaysBefore: integer("reminder_days_before").default(7),
  reminderSent: boolean("reminder_sent").notNull().default(false),
  
  legislationReference: text("legislation_reference"),
  priority: text("priority").notNull().default('MEDIUM'),
  
  colour: text("colour").default('#3B82F6'),
  
  createdById: varchar("created_by_id").references(() => users.id),
  isSystemGenerated: boolean("is_system_generated").notNull().default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Scheduled Reports - automated report generation
export const reportFrequencyEnum = pgEnum('report_frequency', ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']);
export const reportFormatEnum = pgEnum('report_format', ['PDF', 'CSV', 'EXCEL']);

export const scheduledReports = pgTable("scheduled_reports", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  
  name: text("name").notNull(),
  templateId: varchar("template_id"),
  templateName: text("template_name").notNull(),
  
  frequency: reportFrequencyEnum("frequency").notNull(),
  cronExpression: text("cron_expression"),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  
  format: reportFormatEnum("format").notNull().default('PDF'),
  recipients: text("recipients").array().default([]),
  
  filters: json("filters").$type<{
    dateRangeType?: string;
    complianceStreamId?: string;
    schemeIds?: string[];
  }>(),
  
  isActive: boolean("is_active").notNull().default(true),
  
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Report Templates - reusable report configurations
export const reportTemplates = pgTable("report_templates", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id),
  
  name: text("name").notNull(),
  description: text("description"),
  sections: text("sections").array().default([]),
  
  defaultFilters: json("default_filters").$type<{
    dateRangeType?: string;
    complianceStreamId?: string;
  }>(),
  
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Generated Reports - historical record of generated reports
export const generatedReports = pgTable("generated_reports", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  
  name: text("name").notNull(),
  templateId: varchar("template_id").references(() => reportTemplates.id),
  scheduledReportId: varchar("scheduled_report_id").references(() => scheduledReports.id),
  
  format: reportFormatEnum("format").notNull().default('PDF'),
  storageKey: text("storage_key"),
  fileSize: integer("file_size"),
  
  filters: json("filters"),
  status: text("status").notNull().default('READY'),
  
  generatedById: varchar("generated_by_id").references(() => users.id),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScheduledReportSchema = createInsertSchema(scheduledReports).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertReportTemplateSchema = createInsertSchema(reportTemplates).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertGeneratedReportSchema = createInsertSchema(generatedReports).omit({ 
  id: true, createdAt: true 
});

export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type InsertScheduledReport = z.infer<typeof insertScheduledReportSchema>;
export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;
export type GeneratedReport = typeof generatedReports.$inferSelect;
export type InsertGeneratedReport = z.infer<typeof insertGeneratedReportSchema>;

// Insert schemas for Golden Thread tables
export const insertCertificateVersionSchema = createInsertSchema(certificateVersions).omit({ 
  id: true, createdAt: true 
});
export const insertAuditFieldChangeSchema = createInsertSchema(auditFieldChanges).omit({ 
  id: true, createdAt: true 
});
export const insertUkhdsExportSchema = createInsertSchema(ukhdsExports).omit({ 
  id: true, createdAt: true, startedAt: true, completedAt: true 
});

export const insertComplianceCalendarEventSchema = createInsertSchema(complianceCalendarEvents).omit({ 
  id: true, createdAt: true, updatedAt: true 
});

// Types for Golden Thread tables
export type CertificateVersion = typeof certificateVersions.$inferSelect;
export type InsertCertificateVersion = z.infer<typeof insertCertificateVersionSchema>;

export type AuditFieldChange = typeof auditFieldChanges.$inferSelect;
export type InsertAuditFieldChange = z.infer<typeof insertAuditFieldChangeSchema>;

export type UkhdsExport = typeof ukhdsExports.$inferSelect;
export type InsertUkhdsExport = z.infer<typeof insertUkhdsExportSchema>;

export type ComplianceCalendarEvent = typeof complianceCalendarEvents.$inferSelect;
export type InsertComplianceCalendarEvent = z.infer<typeof insertComplianceCalendarEventSchema>;

// =====================================================
// ML PREDICTIVE COMPLIANCE MODELS
// =====================================================

// ML Model status enum
export const mlModelStatusEnum = pgEnum('ml_model_status', ['TRAINING', 'ACTIVE', 'INACTIVE', 'FAILED']);
export const mlPredictionTypeEnum = pgEnum('ml_prediction_type', ['BREACH_PROBABILITY', 'DAYS_TO_BREACH', 'RISK_CATEGORY']);
export const mlFeedbackTypeEnum = pgEnum('ml_feedback_type', ['CORRECT', 'INCORRECT', 'PARTIALLY_CORRECT']);

// ML Models - stores trained model weights and configuration
export const mlModels = pgTable("ml_models", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  
  modelName: text("model_name").notNull(),
  modelVersion: integer("model_version").notNull().default(1),
  predictionType: mlPredictionTypeEnum("prediction_type").notNull(),
  status: mlModelStatusEnum("status").notNull().default('TRAINING'),
  
  // Model architecture/weights stored as JSON (TensorFlow.js compatible)
  modelWeights: json("model_weights").$type<number[][]>(),
  modelConfig: json("model_config").$type<{
    inputFeatures: string[];
    hiddenLayers: number[];
    outputSize: number;
    activation: string;
  }>(),
  
  // Training configuration
  learningRate: text("learning_rate").notNull().default('0.01'),
  epochs: integer("epochs").notNull().default(100),
  batchSize: integer("batch_size").notNull().default(32),
  featureWeights: json("feature_weights").$type<Record<string, number>>(),
  
  // Training metrics
  trainingAccuracy: text("training_accuracy"),
  validationAccuracy: text("validation_accuracy"),
  trainingLoss: text("training_loss"),
  validationLoss: text("validation_loss"),
  trainingProgress: integer("training_progress").notNull().default(0),
  trainingSamples: integer("training_samples").notNull().default(0),
  lastTrainedAt: timestamp("last_trained_at"),
  
  // Performance tracking
  totalPredictions: integer("total_predictions").notNull().default(0),
  correctPredictions: integer("correct_predictions").notNull().default(0),
  feedbackCount: integer("feedback_count").notNull().default(0),
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ML Predictions - individual predictions for properties/certificates
export const mlPredictions = pgTable("ml_predictions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  modelId: varchar("model_id").references(() => mlModels.id).notNull(),
  
  propertyId: varchar("property_id").references(() => properties.id),
  certificateId: varchar("certificate_id").references(() => certificates.id),
  complianceStreamCode: text("compliance_stream_code"),
  
  predictionType: mlPredictionTypeEnum("prediction_type").notNull(),
  
  // Two-tier confidence: Statistical vs ML
  statisticalScore: integer("statistical_score"), // Rule-based score (0-100)
  statisticalConfidence: integer("statistical_confidence"), // Confidence in statistical (0-100)
  
  mlScore: integer("ml_score"), // ML-predicted score (0-100)
  mlConfidence: integer("ml_confidence"), // ML confidence (0-100)
  
  // Prediction details
  predictedBreachDate: timestamp("predicted_breach_date"),
  predictedDaysToBreach: integer("predicted_days_to_breach"),
  predictedRiskCategory: text("predicted_risk_category"),
  
  // Input features used for this prediction
  inputFeatures: json("input_features").$type<Record<string, number>>(),
  
  // Actual outcome (for feedback loop)
  actualOutcome: text("actual_outcome"),
  actualBreachDate: timestamp("actual_breach_date"),
  wasAccurate: boolean("was_accurate"),
  
  // Test prediction flag
  isTest: boolean("is_test").notNull().default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// ML Feedback - human feedback for improving models
export const mlFeedback = pgTable("ml_feedback", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  predictionId: varchar("prediction_id").references(() => mlPredictions.id).notNull(),
  
  feedbackType: mlFeedbackTypeEnum("feedback_type").notNull(),
  feedbackNotes: text("feedback_notes"),
  
  correctedScore: integer("corrected_score"),
  correctedCategory: text("corrected_category"),
  
  submittedById: varchar("submitted_by_id").references(() => users.id),
  submittedByName: text("submitted_by_name"),
  
  // Was this feedback used to retrain?
  usedForTraining: boolean("used_for_training").notNull().default(false),
  trainingBatchId: varchar("training_batch_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ML Training History - track training runs
export const mlTrainingRuns = pgTable("ml_training_runs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  modelId: varchar("model_id").references(() => mlModels.id).notNull(),
  
  status: mlModelStatusEnum("status").notNull().default('TRAINING'),
  
  // Training configuration for this run
  learningRate: text("learning_rate").notNull(),
  epochs: integer("epochs").notNull(),
  batchSize: integer("batch_size").notNull(),
  
  // Progress tracking
  currentEpoch: integer("current_epoch").notNull().default(0),
  trainingProgress: integer("training_progress").notNull().default(0),
  
  // Results
  trainingSamples: integer("training_samples").notNull().default(0),
  validationSamples: integer("validation_samples").notNull().default(0),
  finalAccuracy: text("final_accuracy"),
  finalLoss: text("final_loss"),
  
  // Epoch-by-epoch history
  epochHistory: json("epoch_history").$type<Array<{
    epoch: number;
    loss: number;
    accuracy: number;
    valLoss?: number;
    valAccuracy?: number;
  }>>(),
  
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
});

// Insert schemas for ML tables
export const insertMlModelSchema = createInsertSchema(mlModels).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertMlPredictionSchema = createInsertSchema(mlPredictions).omit({ 
  id: true, createdAt: true 
});
export const insertMlFeedbackSchema = createInsertSchema(mlFeedback).omit({ 
  id: true, createdAt: true 
});
export const insertMlTrainingRunSchema = createInsertSchema(mlTrainingRuns).omit({ 
  id: true, startedAt: true 
});

// Types for ML tables
export type MlModel = typeof mlModels.$inferSelect;
export type InsertMlModel = z.infer<typeof insertMlModelSchema>;

export type MlPrediction = typeof mlPredictions.$inferSelect;
export type InsertMlPrediction = z.infer<typeof insertMlPredictionSchema>;

export type MlFeedback = typeof mlFeedback.$inferSelect;
export type InsertMlFeedback = z.infer<typeof insertMlFeedbackSchema>;

export type MlTrainingRun = typeof mlTrainingRuns.$inferSelect;
export type InsertMlTrainingRun = z.infer<typeof insertMlTrainingRunSchema>;

// Navigation Configuration - Database-driven navigation
export const navigationSections = pgTable("navigation_sections", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id),
  
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  iconKey: text("icon_key").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  defaultOpen: boolean("default_open").notNull().default(false),
  
  requiresRole: text("requires_role"), // 'admin' | 'adminOrManager' | 'factorySettings' | null
  
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const navigationItems = pgTable("navigation_items", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sectionId: varchar("section_id").references(() => navigationSections.id).notNull(),
  
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  href: text("href").notNull(),
  iconKey: text("icon_key").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  
  requiresAdmin: boolean("requires_admin").notNull().default(false),
  requiresFactorySettings: boolean("requires_factory_settings").notNull().default(false),
  requiresAITools: boolean("requires_ai_tools").notNull().default(false),
  requiresRole: text("requires_role"), // More granular role requirement
  
  featureFlagKey: text("feature_flag_key"), // Optional feature flag to check
  metadata: json("metadata").$type<Record<string, unknown>>(),
  
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const navigationItemRoles = pgTable("navigation_item_roles", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  navigationItemId: varchar("navigation_item_id").references(() => navigationItems.id, { onDelete: 'cascade' }).notNull(),
  role: text("role").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  { name: "unique_item_role", unique: true, columns: [table.navigationItemId, table.role] }
]);

export const iconRegistry = pgTable("icon_registry", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  iconKey: text("icon_key").notNull().unique(),
  lucideName: text("lucide_name").notNull(),
  customSvg: text("custom_svg"),
  category: text("category"),
  
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNavigationSectionSchema = createInsertSchema(navigationSections).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertNavigationItemSchema = createInsertSchema(navigationItems).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertIconRegistrySchema = createInsertSchema(iconRegistry).omit({ 
  id: true, createdAt: true 
});

export type NavigationSection = typeof navigationSections.$inferSelect;
export type InsertNavigationSection = z.infer<typeof insertNavigationSectionSchema>;
export type NavigationItem = typeof navigationItems.$inferSelect;
export type InsertNavigationItem = z.infer<typeof insertNavigationItemSchema>;
export type NavigationItemRole = typeof navigationItemRoles.$inferSelect;
export type IconRegistryEntry = typeof iconRegistry.$inferSelect;
export type InsertIconRegistryEntry = z.infer<typeof insertIconRegistrySchema>;

export type NavigationItemWithRoles = NavigationItem & { allowedRoles: string[] };

// Cache Management Enums
export const cacheLayerEnum = pgEnum('cache_layer', [
  'CLIENT',      // React Query client-side cache
  'API',         // Server-side API response cache
  'DATABASE',    // Database query cache
  'MEMORY',      // In-memory application cache
  'SESSION'      // Session storage cache
]);

export const cacheClearScopeEnum = pgEnum('cache_clear_scope', [
  'REGION',      // Single cache region
  'CATEGORY',    // Category of regions (e.g., all risk-related)
  'LAYER',       // Entire cache layer
  'ALL'          // All caches (requires confirmation)
]);

export const cacheClearStatusEnum = pgEnum('cache_clear_status', [
  'SUCCESS',
  'PARTIAL',
  'FAILED',
  'DRY_RUN'
]);

// Cache Regions - Catalogue of managed cache areas
export const cacheRegions = pgTable("cache_regions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  layer: cacheLayerEnum("layer").notNull(),
  category: text("category").notNull(), // e.g., 'risk', 'property', 'certificate', 'config'
  
  queryKeyPattern: text("query_key_pattern"), // For React Query - e.g., '/api/risk/*'
  cacheKeyPattern: text("cache_key_pattern"), // For server-side - e.g., 'risk:*'
  
  autoRefreshSeconds: integer("auto_refresh_seconds"), // TTL if applicable
  isAutoCleared: boolean("is_auto_cleared").notNull().default(false),
  isProtected: boolean("is_protected").notNull().default(false), // Requires extra confirmation
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  
  metadata: json("metadata").$type<{
    estimatedEntries?: number;
    maxSizeBytes?: number;
    dependentRegions?: string[];
    refreshStrategy?: 'manual' | 'ttl' | 'event';
  }>(),
  
  lastClearedAt: timestamp("last_cleared_at"),
  lastClearedBy: varchar("last_cleared_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Cache Statistics - Aggregated metrics per region
export const cacheStats = pgTable("cache_stats", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  regionId: varchar("region_id").references(() => cacheRegions.id, { onDelete: 'cascade' }).notNull(),
  
  windowStart: timestamp("window_start").notNull(),
  windowEnd: timestamp("window_end").notNull(),
  
  hitCount: integer("hit_count").notNull().default(0),
  missCount: integer("miss_count").notNull().default(0),
  evictionCount: integer("eviction_count").notNull().default(0),
  
  estimatedEntries: integer("estimated_entries").notNull().default(0),
  estimatedSizeBytes: integer("estimated_size_bytes").notNull().default(0),
  
  avgResponseTimeMs: real("avg_response_time_ms"),
  
  source: text("source").notNull().default('system'), // 'system' | 'manual_sample'
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cache Clear Audit Log - Complete history of cache operations
export const cacheClearAudit = pgTable("cache_clear_audit", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  scope: cacheClearScopeEnum("scope").notNull(),
  scopeIdentifier: text("scope_identifier"), // Region ID, category name, layer name
  
  initiatedBy: varchar("initiated_by").references(() => users.id).notNull(),
  initiatorRole: text("initiator_role").notNull(),
  initiatorIp: text("initiator_ip"),
  
  reason: text("reason").notNull(),
  confirmationToken: text("confirmation_token"), // For 'ALL' scope
  
  isDryRun: boolean("is_dry_run").notNull().default(false),
  status: cacheClearStatusEnum("status").notNull(),
  
  affectedRegions: json("affected_regions").$type<{
    regionId: string;
    regionName: string;
    layer: string;
    status: string;
    entriesCleared?: number;
    error?: string;
  }[]>(),
  
  totalEntriesCleared: integer("total_entries_cleared").notNull().default(0),
  executionTimeMs: integer("execution_time_ms"),
  
  beforeState: json("before_state").$type<{
    totalEntries: number;
    totalSizeBytes: number;
    byLayer: Record<string, number>;
  }>(),
  afterState: json("after_state").$type<{
    totalEntries: number;
    totalSizeBytes: number;
    byLayer: Record<string, number>;
  }>(),
  
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for cache tables
export const insertCacheRegionSchema = createInsertSchema(cacheRegions).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertCacheStatsSchema = createInsertSchema(cacheStats).omit({ 
  id: true, createdAt: true 
});
export const insertCacheClearAuditSchema = createInsertSchema(cacheClearAudit).omit({ 
  id: true, createdAt: true 
});

// Types for cache tables
export type CacheRegion = typeof cacheRegions.$inferSelect;
export type InsertCacheRegion = z.infer<typeof insertCacheRegionSchema>;

export type CacheStats = typeof cacheStats.$inferSelect;
export type InsertCacheStats = z.infer<typeof insertCacheStatsSchema>;

export type CacheClearAudit = typeof cacheClearAudit.$inferSelect;
export type InsertCacheClearAudit = z.infer<typeof insertCacheClearAuditSchema>;

export type CacheLayer = 'CLIENT' | 'API' | 'DATABASE' | 'MEMORY' | 'SESSION';
export type CacheClearScope = 'REGION' | 'CATEGORY' | 'LAYER' | 'ALL';
