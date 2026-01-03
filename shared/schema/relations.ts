import { relations } from "drizzle-orm";

import {
  organisations,
  users,
  schemes,
  blocks,
  properties,
  certificates,
  extractions,
  remedialActions,
  extractionSchemas,
  extractionRuns,
  extractionTierAudits,
  humanReviews,
  benchmarkSets,
  benchmarkItems,
  evalRuns,
  componentTypes,
  components,
  spaces,
  componentCertificates,
  dataImports,
  dataImportRows,
  apiClients,
  ingestionJobs,
} from "./tables";

export const organisationRelations = relations(organisations, ({ many }) => ({
  users: many(users),
  schemes: many(schemes),
  certificates: many(certificates),
  humanReviews: many(humanReviews),
  dataImports: many(dataImports),
  apiClients: many(apiClients),
  ingestionJobs: many(ingestionJobs),
}));

export const userRelations = relations(users, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id],
  }),
  humanReviews: many(humanReviews),
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
  spaces: many(spaces),
  components: many(components),
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
  extractionRuns: many(extractionRuns),
  benchmarkItems: many(benchmarkItems),
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

export const extractionSchemaRelations = relations(extractionSchemas, ({ many }) => ({
  extractionRuns: many(extractionRuns),
}));

export const extractionRunRelations = relations(extractionRuns, ({ one, many }) => ({
  certificate: one(certificates, {
    fields: [extractionRuns.certificateId],
    references: [certificates.id],
  }),
  schema: one(extractionSchemas, {
    fields: [extractionRuns.schemaId],
    references: [extractionSchemas.id],
  }),
  tierAudits: many(extractionTierAudits),
}));

export const extractionTierAuditRelations = relations(extractionTierAudits, ({ one }) => ({
  certificate: one(certificates, {
    fields: [extractionTierAudits.certificateId],
    references: [certificates.id],
  }),
  extractionRun: one(extractionRuns, {
    fields: [extractionTierAudits.extractionRunId],
    references: [extractionRuns.id],
  }),
}));

export const humanReviewRelations = relations(humanReviews, ({ one }) => ({
  extractionRun: one(extractionRuns, {
    fields: [humanReviews.extractionRunId],
    references: [extractionRuns.id],
  }),
  reviewer: one(users, {
    fields: [humanReviews.reviewerId],
    references: [users.id],
  }),
  organisation: one(organisations, {
    fields: [humanReviews.organisationId],
    references: [organisations.id],
  }),
}));

export const benchmarkSetRelations = relations(benchmarkSets, ({ many }) => ({
  items: many(benchmarkItems),
  evalRuns: many(evalRuns),
}));

export const benchmarkItemRelations = relations(benchmarkItems, ({ one }) => ({
  benchmarkSet: one(benchmarkSets, {
    fields: [benchmarkItems.benchmarkSetId],
    references: [benchmarkSets.id],
  }),
  certificate: one(certificates, {
    fields: [benchmarkItems.certificateId],
    references: [certificates.id],
  }),
}));

export const evalRunRelations = relations(evalRuns, ({ one }) => ({
  benchmarkSet: one(benchmarkSets, {
    fields: [evalRuns.benchmarkSetId],
    references: [benchmarkSets.id],
  }),
  previousRun: one(evalRuns, {
    fields: [evalRuns.previousRunId],
    references: [evalRuns.id],
  }),
}));

export const componentTypeRelations = relations(componentTypes, ({ many }) => ({
  components: many(components),
}));

export const componentRelations = relations(components, ({ one, many }) => ({
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

export const componentCertificateRelations = relations(componentCertificates, ({ one }) => ({
  component: one(components, {
    fields: [componentCertificates.componentId],
    references: [components.id],
  }),
  certificate: one(certificates, {
    fields: [componentCertificates.certificateId],
    references: [certificates.id],
  }),
}));

export const dataImportRelations = relations(dataImports, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [dataImports.organisationId],
    references: [organisations.id],
  }),
  uploadedBy: one(users, {
    fields: [dataImports.uploadedById],
    references: [users.id],
  }),
  rows: many(dataImportRows),
}));

export const dataImportRowRelations = relations(dataImportRows, ({ one }) => ({
  import: one(dataImports, {
    fields: [dataImportRows.importId],
    references: [dataImports.id],
  }),
}));
