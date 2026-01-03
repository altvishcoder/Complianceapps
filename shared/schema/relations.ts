import { relations } from "drizzle-orm";
import { users, organisations, sessions, accounts, staffMembers } from "./core-auth";
import { schemes, blocks, properties } from "./org-structure";
import { componentTypes, spaces, components } from "./assets";
import { certificates, componentCertificates } from "./compliance";

export const organisationsRelations = relations(organisations, ({ many }) => ({
  users: many(users),
  staffMembers: many(staffMembers),
  schemes: many(schemes),
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

export const schemesRelations = relations(schemes, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [schemes.organisationId],
    references: [organisations.id],
  }),
  blocks: many(blocks),
}));

export const blocksRelations = relations(blocks, ({ one, many }) => ({
  scheme: one(schemes, {
    fields: [blocks.schemeId],
    references: [schemes.id],
  }),
  properties: many(properties),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  block: one(blocks, {
    fields: [properties.blockId],
    references: [blocks.id],
  }),
  components: many(components),
  spaces: many(spaces),
}));

export const componentTypesRelations = relations(componentTypes, ({ many }) => ({
  components: many(components),
}));

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  property: one(properties, {
    fields: [spaces.propertyId],
    references: [properties.id],
  }),
  block: one(blocks, {
    fields: [spaces.blockId],
    references: [blocks.id],
  }),
  scheme: one(schemes, {
    fields: [spaces.schemeId],
    references: [schemes.id],
  }),
  components: many(components),
}));

export const componentsRelations = relations(components, ({ one, many }) => ({
  property: one(properties, {
    fields: [components.propertyId],
    references: [properties.id],
  }),
  space: one(spaces, {
    fields: [components.spaceId],
    references: [spaces.id],
  }),
  block: one(blocks, {
    fields: [components.blockId],
    references: [blocks.id],
  }),
  componentType: one(componentTypes, {
    fields: [components.componentTypeId],
    references: [componentTypes.id],
  }),
  componentCertificates: many(componentCertificates),
}));

export const certificatesRelations = relations(certificates, ({ one, many }) => ({
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
  uploadedByUser: one(users, {
    fields: [certificates.uploadedBy],
    references: [users.id],
  }),
  componentCertificates: many(componentCertificates),
}));

export const componentCertificatesRelations = relations(componentCertificates, ({ one }) => ({
  component: one(components, {
    fields: [componentCertificates.componentId],
    references: [components.id],
  }),
  certificate: one(certificates, {
    fields: [componentCertificates.certificateId],
    references: [certificates.id],
  }),
}));
