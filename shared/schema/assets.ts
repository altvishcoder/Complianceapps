import { pgTable, text, varchar, timestamp, boolean, integer, json, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { properties, blocks, schemes } from "./org-structure";
import { organisations, users } from "./core-auth";

export const importStatusEnum = pgEnum('import_status', [
  'PENDING', 'VALIDATING', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'FAILED', 'CANCELLED'
]);

export const importRowStatusEnum = pgEnum('import_row_status', [
  'PENDING', 'VALID', 'INVALID', 'IMPORTED', 'SKIPPED', 'FAILED'
]);

export const componentCategoryEnum = pgEnum('component_category', [
  'HEATING', 'ELECTRICAL', 'FIRE_SAFETY', 'WATER', 'VENTILATION',
  'STRUCTURE', 'ACCESS', 'SECURITY', 'EXTERNAL', 'OTHER'
]);

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
  propertyId: varchar("property_id").references(() => properties.id),
  blockId: varchar("block_id").references(() => blocks.id),
  schemeId: varchar("scheme_id").references(() => schemes.id),
  name: varchar("name", { length: 255 }).notNull(),
  spaceType: varchar("space_type", { length: 100 }),
  isActive: boolean("is_active").default(true),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const components = pgTable("components", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  propertyId: varchar("property_id").references(() => properties.id),
  spaceId: varchar("space_id").references(() => spaces.id),
  blockId: varchar("block_id").references(() => blocks.id),
  componentTypeId: varchar("component_type_id").references(() => componentTypes.id),
  name: varchar("name", { length: 255 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 255 }),
  model: varchar("model", { length: 255 }),
  serialNumber: varchar("serial_number", { length: 255 }),
  installDate: timestamp("install_date"),
  isActive: boolean("is_active").default(true),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

export const dataImports = pgTable("data_imports", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  uploadedById: varchar("uploaded_by_id").references(() => users.id).notNull(),
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
  importId: varchar("import_id").references(() => dataImports.id, { onDelete: 'cascade' }).notNull(),
  rowNumber: integer("row_number").notNull(),
  status: importRowStatusEnum("status").notNull().default('PENDING'),
  sourceData: json("source_data").notNull(),
  validationErrors: json("validation_errors"),
  createdRecordId: varchar("created_record_id"),
  createdRecordType: text("created_record_type"),
  processedAt: timestamp("processed_at"),
});

export type ComponentType = typeof componentTypes.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type Component = typeof components.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type DataImport = typeof dataImports.$inferSelect;
export type DataImportRow = typeof dataImportRows.$inferSelect;

export const insertComponentTypeSchema = createInsertSchema(componentTypes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSpaceSchema = createInsertSchema(spaces).omit({ id: true, createdAt: true, updatedAt: true });
export const insertComponentSchema = createInsertSchema(components).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDataImportSchema = createInsertSchema(dataImports).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertComponentType = z.infer<typeof insertComponentTypeSchema>;
export type InsertSpace = z.infer<typeof insertSpaceSchema>;
export type InsertComponent = z.infer<typeof insertComponentSchema>;
export type InsertDataImport = z.infer<typeof insertDataImportSchema>;
