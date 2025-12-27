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

// Relations
export const organisationRelations = relations(organisations, ({ many }) => ({
  users: many(users),
  schemes: many(schemes),
  certificates: many(certificates),
  humanReviews: many(humanReviews),
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
