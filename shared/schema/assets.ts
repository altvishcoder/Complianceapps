import { pgTable, text, varchar, timestamp, boolean, integer, json, pgEnum } from "drizzle-orm/pg-core";
import { properties, blocks, schemes } from "./org-structure";

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

export type ComponentType = typeof componentTypes.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type Component = typeof components.$inferSelect;
