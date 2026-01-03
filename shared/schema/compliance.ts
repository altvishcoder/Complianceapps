import { pgTable, text, varchar, timestamp, boolean, integer, json, pgEnum, real } from "drizzle-orm/pg-core";
import { organisations, users } from "./core-auth";
import { properties, blocks } from "./org-structure";
import { components } from "./assets";

export const severityEnum = pgEnum('severity', ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export const actionStatusEnum = pgEnum('action_status', ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export const extractionStatusEnum = pgEnum('extraction_status', [
  'PENDING', 'PROCESSING', 'VALIDATION_FAILED', 'REPAIR_IN_PROGRESS', 
  'AWAITING_REVIEW', 'APPROVED', 'REJECTED'
]);
export const extractionTierStatusEnum = pgEnum('extraction_tier_status', ['success', 'escalated', 'skipped', 'failed', 'pending']);

export const certificates = pgTable("certificates", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id),
  propertyId: varchar("property_id").references(() => properties.id),
  blockId: varchar("block_id").references(() => blocks.id),
  certificateType: varchar("certificate_type", { length: 100 }),
  status: varchar("status", { length: 50 }),
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const componentCertificates = pgTable("component_certificates", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  componentId: varchar("component_id").references(() => components.id).notNull(),
  certificateId: varchar("certificate_id").references(() => certificates.id).notNull(),
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
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

export const extractionRuns = pgTable("extraction_runs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateId: varchar("certificate_id").references(() => certificates.id, { onDelete: 'cascade' }).notNull(),
  schemaId: varchar("schema_id"),
  modelVersion: text("model_version").notNull(),
  promptVersion: text("prompt_version").notNull(),
  schemaVersion: text("schema_version").notNull(),
  documentType: text("document_type").notNull(),
  classificationConfidence: real("classification_confidence").notNull().default(0),
  rawOutput: json("raw_output").notNull(),
  validatedOutput: json("validated_output"),
  repairedOutput: json("repaired_output"),
  normalisedOutput: json("normalised_output"),
  finalOutput: json("final_output"),
  confidence: real("confidence").notNull().default(0),
  processingTier: integer("processing_tier").notNull().default(6),
  tierName: text("tier_name"),
  processingTimeMs: integer("processing_time_ms").notNull().default(0),
  processingCost: real("processing_cost").notNull().default(0),
  validationErrors: json("validation_errors").notNull().default([]),
  validationPassed: boolean("validation_passed").notNull().default(false),
  repairAttempts: integer("repair_attempts").notNull().default(0),
  status: extractionStatusEnum("status").notNull().default('PENDING'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const extractionTierAudits = pgTable("extraction_tier_audits", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateId: varchar("certificate_id").references(() => certificates.id, { onDelete: 'cascade' }).notNull(),
  extractionRunId: varchar("extraction_run_id").references(() => extractionRuns.id, { onDelete: 'cascade' }),
  tier: text("tier").notNull(),
  tierOrder: integer("tier_order").notNull(),
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  processingTimeMs: integer("processing_time_ms").notNull().default(0),
  status: extractionTierStatusEnum("status").notNull().default('pending'),
  confidence: real("confidence").notNull().default(0),
  cost: real("cost").notNull().default(0),
  extractedFieldCount: integer("extracted_field_count").notNull().default(0),
  escalationReason: text("escalation_reason"),
  documentFormat: text("document_format"),
  documentClassification: text("document_classification"),
  pageCount: integer("page_count"),
  textQuality: real("text_quality"),
  qrCodesFound: json("qr_codes_found"),
  metadataExtracted: json("metadata_extracted"),
  rawOutput: json("raw_output"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const humanReviews = pgTable("human_reviews", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  extractionRunId: varchar("extraction_run_id").references(() => extractionRuns.id, { onDelete: 'cascade' }).notNull().unique(),
  reviewerId: varchar("reviewer_id").references(() => users.id).notNull(),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  approvedOutput: json("approved_output").notNull(),
  fieldChanges: json("field_changes").notNull().default([]),
  addedItems: json("added_items").notNull().default([]),
  removedItems: json("removed_items").notNull().default([]),
  errorTags: text("error_tags").array(),
  wasCorrect: boolean("was_correct").notNull().default(false),
  changeCount: integer("change_count").notNull().default(0),
  reviewTimeSeconds: integer("review_time_seconds"),
  reviewerNotes: text("reviewer_notes"),
  reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
});

export const fieldConfidenceScores = pgTable("field_confidence_scores", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  extractionRunId: varchar("extraction_run_id").references(() => extractionRuns.id, { onDelete: 'cascade' }).notNull(),
  certificateType: text("certificate_type").notNull(),
  fieldName: text("field_name").notNull(),
  confidenceScore: real("confidence_score").notNull(),
  extractedValue: text("extracted_value"),
  correctedValue: text("corrected_value"),
  wasCorrected: boolean("was_corrected").notNull().default(false),
  correctionReason: text("correction_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

export type Certificate = typeof certificates.$inferSelect;
export type ComponentCertificate = typeof componentCertificates.$inferSelect;
export type RemedialAction = typeof remedialActions.$inferSelect;
export type Extraction = typeof extractions.$inferSelect;
export type ExtractionRun = typeof extractionRuns.$inferSelect;
export type ExtractionTierAudit = typeof extractionTierAudits.$inferSelect;
export type HumanReview = typeof humanReviews.$inferSelect;
export type FieldConfidenceScore = typeof fieldConfidenceScores.$inferSelect;
export type CertificateVersion = typeof certificateVersions.$inferSelect;
