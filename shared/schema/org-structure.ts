import { pgTable, text, varchar, timestamp, boolean, integer, json } from "drizzle-orm/pg-core";
import { organisations } from "./core-auth";

export const schemes = pgTable("schemes", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  address: text("address"),
  postcode: varchar("postcode", { length: 20 }),
  isActive: boolean("is_active").default(true),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const blocks = pgTable("blocks", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  schemeId: varchar("scheme_id").references(() => schemes.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  address: text("address"),
  postcode: varchar("postcode", { length: 20 }),
  buildYear: integer("build_year"),
  numberOfFloors: integer("number_of_floors"),
  isActive: boolean("is_active").default(true),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  blockId: varchar("block_id").references(() => blocks.id),
  uprn: varchar("uprn", { length: 50 }),
  address: text("address"),
  postcode: varchar("postcode", { length: 20 }),
  propertyType: varchar("property_type", { length: 100 }),
  isActive: boolean("is_active").default(true),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Scheme = typeof schemes.$inferSelect;
export type Block = typeof blocks.$inferSelect;
export type Property = typeof properties.$inferSelect;
