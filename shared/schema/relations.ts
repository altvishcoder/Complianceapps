import { relations } from "drizzle-orm";
import { users, organisations, sessions, accounts, staffMembers } from "./core-auth";

export const organisationsRelations = relations(organisations, ({ many }) => ({
  users: many(users),
  staffMembers: many(staffMembers),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id],
  }),
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const staffMembersRelations = relations(staffMembers, ({ one }) => ({
  organisation: one(organisations, {
    fields: [staffMembers.organisationId],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [staffMembers.userId],
    references: [users.id],
  }),
}));
