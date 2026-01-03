import { pgEnum, varchar, timestamp } from "drizzle-orm/pg-core";

export const complianceStatusEnum = pgEnum('compliance_status', ['COMPLIANT', 'EXPIRING_SOON', 'OVERDUE', 'NON_COMPLIANT', 'ACTION_REQUIRED', 'UNKNOWN']);
export const linkStatusEnum = pgEnum('link_status', ['VERIFIED', 'UNVERIFIED']);

export const baseIdColumn = () => varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID());
export const timestampColumns = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};
export const softDeleteColumn = {
  deletedAt: timestamp("deleted_at"),
};
