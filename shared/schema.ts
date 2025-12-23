import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, real, json, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'MANAGER', 'OFFICER', 'VIEWER']);
export const complianceStatusEnum = pgEnum('compliance_status', ['COMPLIANT', 'EXPIRING_SOON', 'OVERDUE', 'NON_COMPLIANT', 'ACTION_REQUIRED', 'UNKNOWN']);
export const propertyTypeEnum = pgEnum('property_type', ['HOUSE', 'FLAT', 'BUNGALOW', 'MAISONETTE', 'BEDSIT', 'STUDIO']);
export const tenureEnum = pgEnum('tenure', ['SOCIAL_RENT', 'AFFORDABLE_RENT', 'SHARED_OWNERSHIP', 'LEASEHOLD', 'TEMPORARY']);
export const certificateTypeEnum = pgEnum('certificate_type', ['GAS_SAFETY', 'EICR', 'EPC', 'FIRE_RISK_ASSESSMENT', 'LEGIONELLA_ASSESSMENT', 'ASBESTOS_SURVEY', 'LIFT_LOLER', 'OTHER']);
export const certificateStatusEnum = pgEnum('certificate_status', ['UPLOADED', 'PROCESSING', 'EXTRACTED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'FAILED']);
export const certificateOutcomeEnum = pgEnum('certificate_outcome', ['SATISFACTORY', 'UNSATISFACTORY', 'PASS', 'FAIL', 'AT_RISK', 'IMMEDIATELY_DANGEROUS']);
export const severityEnum = pgEnum('severity', ['IMMEDIATE', 'URGENT', 'PRIORITY', 'ROUTINE', 'ADVISORY']);
export const actionStatusEnum = pgEnum('action_status', ['OPEN', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']);

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const certificates = pgTable("certificates", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  blockId: varchar("block_id").references(() => blocks.id),
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

// Relations
export const organisationRelations = relations(organisations, ({ many }) => ({
  users: many(users),
  schemes: many(schemes),
  certificates: many(certificates),
}));

export const userRelations = relations(users, ({ one }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id],
  }),
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

// Zod Schemas
export const insertOrganisationSchema = createInsertSchema(organisations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertSchemeSchema = createInsertSchema(schemes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBlockSchema = createInsertSchema(blocks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCertificateSchema = createInsertSchema(certificates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExtractionSchema = createInsertSchema(extractions).omit({ id: true, createdAt: true });
export const insertRemedialActionSchema = createInsertSchema(remedialActions).omit({ id: true, createdAt: true, updatedAt: true });

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
