import { pgTable, text, varchar, timestamp, boolean, integer, json } from "drizzle-orm/pg-core";
import { organisations, users } from "./core-auth";
import { properties, blocks } from "./org-structure";
import { components } from "./assets";

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

export type Certificate = typeof certificates.$inferSelect;
export type ComponentCertificate = typeof componentCertificates.$inferSelect;
