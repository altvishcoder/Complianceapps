import { pgTable, text, varchar, timestamp, boolean, integer, real, json, pgEnum } from "drizzle-orm/pg-core";
import { complianceStatusEnum, linkStatusEnum, propertySourceEnum } from './base';

export const componentCategoryEnum = pgEnum('component_category', [
  'HEATING',
  'ELECTRICAL',
  'FIRE_SAFETY',
  'WATER',
  'VENTILATION',
  'STRUCTURE',
  'ACCESS',
  'SECURITY',
  'EXTERNAL',
  'OTHER'
]);

export const importStatusEnum = pgEnum('import_status', [
  'PENDING',
  'VALIDATING',
  'VALIDATED',
  'IMPORTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
]);

export const importRowStatusEnum = pgEnum('import_row_status', [
  'PENDING',
  'VALID',
  'INVALID',
  'IMPORTED',
  'SKIPPED',
  'FAILED'
]);

export const spaceTypeEnum = pgEnum('space_type', ['ROOM', 'COMMUNAL_AREA', 'EXTERNAL', 'CIRCULATION', 'UTILITY', 'STORAGE', 'OTHER']);

export const componentTypes = pgTable("component_types", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull().unique(),
  category: componentCategoryEnum("category").notNull(),
  description: text("description"),
  hactElementCode: text("hact_element_code"),
  expectedLifespanYears: integer("expected_lifespan_years"),
  relatedCertificateTypes: text("related_certificate_types").array(),
  inspectionFrequencyMonths: integer("inspection_frequency_months"),
  isHighRisk: boolean("is_high_risk").notNull().default(false),
  buildingSafetyRelevant: boolean("building_safety_relevant").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const spaces = pgTable("spaces", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id"),
  blockId: varchar("block_id"),
  schemeId: varchar("scheme_id"),
  name: text("name").notNull(),
  reference: text("reference"),
  spaceType: spaceTypeEnum("space_type").notNull().default('ROOM'),
  description: text("description"),
  floor: text("floor"),
  accessNotes: text("access_notes"),
  areaSqMeters: real("area_sq_meters"),
  isAccessible: boolean("is_accessible").notNull().default(true),
  requiresKeyAccess: boolean("requires_key_access").notNull().default(false),
  linkStatus: linkStatusEnum("link_status").notNull().default('VERIFIED'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const components = pgTable("components", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id"),
  spaceId: varchar("space_id"),
  blockId: varchar("block_id"),
  componentTypeId: varchar("component_type_id").notNull(),
  assetTag: text("asset_tag"),
  serialNumber: text("serial_number"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  location: text("location"),
  accessNotes: text("access_notes"),
  installDate: text("install_date"),
  expectedReplacementDate: text("expected_replacement_date"),
  warrantyExpiry: text("warranty_expiry"),
  condition: text("condition"),
  isActive: boolean("is_active").notNull().default(true),
  source: propertySourceEnum("source").notNull().default('MANUAL'),
  needsVerification: boolean("needs_verification").notNull().default(false),
  lastInspectionDate: text("last_inspection_date"),
  nextInspectionDue: text("next_inspection_due"),
  complianceStatus: complianceStatusEnum("compliance_status").notNull().default('UNKNOWN'),
  certificateRequired: text("certificate_required"),
  riskLevel: text("risk_level"),
  lastServiceDate: text("last_service_date"),
  nextServiceDue: text("next_service_due"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const componentCertificates = pgTable("component_certificates", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  componentId: varchar("component_id").notNull(),
  certificateId: varchar("certificate_id").notNull(),
  isAutoLinked: boolean("is_auto_linked").notNull().default(false),
  extractionConfidence: real("extraction_confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  uploadedById: varchar("uploaded_by_id"),
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

export const dataImports = pgTable("data_imports", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  uploadedById: varchar("uploaded_by_id").notNull(),
  name: text("name").notNull(),
  importType: text("import_type").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  columnMapping: json("column_mapping"),
  status: importStatusEnum("status").notNull().default('PENDING'),
  totalRows: integer("total_rows").notNull().default(0),
  validRows: integer("valid_rows").notNull().default(0),
  invalidRows: integer("invalid_rows").notNull().default(0),
  importedRows: integer("imported_rows").notNull().default(0),
  skippedRows: integer("skipped_rows").notNull().default(0),
  upsertMode: boolean("upsert_mode").notNull().default(false),
  dryRun: boolean("dry_run").notNull().default(false),
  errorSummary: json("error_summary"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dataImportRows = pgTable("data_import_rows", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  importId: varchar("import_id").notNull(),
  rowNumber: integer("row_number").notNull(),
  status: importRowStatusEnum("status").notNull().default('PENDING'),
  sourceData: json("source_data").notNull(),
  validationErrors: json("validation_errors"),
  createdRecordId: varchar("created_record_id"),
  createdRecordType: text("created_record_type"),
  processedAt: timestamp("processed_at"),
});
