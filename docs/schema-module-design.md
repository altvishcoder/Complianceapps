# Schema Module Design

## Overview
This document describes the modular schema architecture for ComplianceAI. The original monolithic `shared/schema.ts` (3100+ lines, 88 tables) is being split into logical modules based on FK ownership analysis.

## Current Status: Phase 0/1 Complete (Design Validation)

**What was validated:**
- All 88 tables assigned to 13 modules (verified via automated FK analysis)
- No circular dependencies exist in the module dependency graph
- Centralized relations approach works (prototype in `shared/schema/relations.ts`)
- TypeScript compilation passes for prototype modules

**What remains for Phase 2 (Implementation):**
- Migrate remaining tables from `shared/schema.ts` to module files
- Add insert schemas and typed exports to each module
- Expand relations.ts to cover all modules
- Update barrel exports in `shared/schema/index.ts`
- The original `shared/schema.ts` remains the source of truth until Phase 2 is complete

## Module Structure

```
shared/
├── schema.ts          # Legacy file - will re-export from modules
└── schema/
    ├── index.ts       # Barrel export
    ├── base.ts        # Shared enums
    ├── core-auth.ts   # Authentication (6 tables)
    ├── org-structure.ts   # Hierarchy (3 tables)
    ├── assets.ts      # Physical assets (4 tables)
    ├── compliance.ts  # Certificates, rules (11 tables)
    ├── extraction.ts  # AI extraction + benchmarks (11 tables)
    ├── chatbot.ts     # Chatbot + AI suggestions (6 tables)
    ├── api.ts         # API, webhooks, ingestion (10 tables)
    ├── risk.ts        # Risk management (4 tables)
    ├── audit.ts       # Audit logging (2 tables)
    ├── ml.ts          # Machine learning (5 tables)
    ├── contractor.ts  # Contractor management (9 tables)
    ├── reporting.ts   # Reports + calendar (5 tables)
    ├── config.ts      # Settings, navigation, cache (12 tables)
    └── relations.ts   # Drizzle relations (centralized)
```

## Bridge Table Strategy

Bridge tables that reference entities from multiple modules are placed with the **orchestrating domain**:
- `componentCertificates` → compliance.ts (certificates orchestrate component compliance)
- `ingestionJobs` → api.ts (API layer orchestrates ingestion)

This means some modules will have import dependencies on other modules. The migration order accounts for this by migrating prerequisite modules first.

## Definitive Table Inventory (88 tables, FK-based grouping)

### core-auth.ts (6 tables) - No external FKs
1. organisations (line 36) - ROOT
2. users (line 46) → organisations
3. staffMembers (line 60) → organisations, users
4. sessions (line 80) → users
5. accounts (line 91) → users
6. verifications (line 107) - standalone

### org-structure.ts (3 tables) → core-auth
7. schemes (line 116) → organisations
8. blocks (line 128) → schemes
9. properties (line 142) → blocks

### assets.ts (3 tables) → org-structure
10. componentTypes (line 755) - standalone
11. spaces (line 787) → properties, blocks, schemes
12. components (line 818) → properties, spaces, blocks, componentTypes

### compliance.ts (15 tables) → org-structure, core-auth, assets
13. ingestionBatches → organisations
14. certificates → organisations, properties, blocks, ingestionBatches, users
15. remedialActions → certificates, properties
16. complianceRules → complianceStreams
17. normalisationRules - standalone
18. complianceStreams - standalone
19. certificateTypes → complianceStreams
20. classificationCodes → certificateTypes
21. extractionSchemas - standalone (extraction config)
22. detectionPatterns → certificateTypes
23. outcomeRules → certificateTypes
24. certificateDetectionPatterns → certificateTypes
25. certificateOutcomeRules → certificateTypes
26. certificateVersions → certificates
27. componentCertificates → components, certificates (bridge table)

### extraction.ts (15 tables) → compliance, core-auth
25. extractions → certificates
26. extractionSchemas - standalone
27. extractionRuns → certificates, extractionSchemas
28. extractionTierAudits → extractionRuns
29. humanReviews → extractionRuns, users
30. fieldConfidenceScores → extractionRuns
31. autoApprovalThresholds → organisations
32. confidenceBaselines - standalone
33. benchmarkSets → organisations
34. benchmarkItems → benchmarkSets, certificates
35. evalRuns → benchmarkSets
36. evalResults → evalRuns
37. evalSets - standalone
38. humanReviewQueue - standalone
39. humanReviewStats - standalone

### chatbot.ts (6 tables) → core-auth
36. chatbotConversations (line 908) → users
37. chatbotMessages (line 922) → chatbotConversations
38. chatbotAnalytics (line 943) → organisations
39. knowledgeEmbeddings (line 969) - standalone
40. aiSuggestions (line 1008) → organisations, users

### api.ts (11 tables) → core-auth, compliance
41. apiClients (line 1141) → organisations, users
42. uploadSessions (line 1175) → organisations, apiClients
43. ingestionJobs (line 1207) → organisations, apiClients, uploadSessions, ingestionBatches, properties, certificates
44. rateLimitEntries (line 1255) → organisations
45. apiLogs (line 1754) - standalone
46. apiMetrics (line 1770) - standalone
47. webhookEndpoints (line 1786) → organisations
48. webhookEvents (line 1806) → webhookEndpoints
49. webhookDeliveries (line 1817) → webhookEvents
50. incomingWebhookLogs (line 1834) → organisations
51. apiKeys (line 1847) → organisations

### risk.ts (4 tables) → org-structure, compliance
51. riskSnapshots (line 1709) → organisations
52. propertyRiskSnapshots (line 1966) → properties
53. riskFactorDefinitions (line 2006) → organisations
54. riskAlerts (line 2034) → organisations, properties

### audit.ts (2 tables) → core-auth
55. auditEvents (line 1925) - standalone
56. auditFieldChanges (line 2433) → auditEvents

### ml.ts (5 tables) → extraction, core-auth
57. mlModels (line 2670) → organisations
58. mlPredictions (line 2714) → properties, certificates, mlModels
59. mlFeedback (line 2753) → mlPredictions, users
60. extractionCorrections (line 2783) - standalone
61. mlTrainingRuns (line 2811) - standalone

### contractor.ts (8 tables) → core-auth, org-structure
62. contractors (line 259) → organisations
63. contractorCertifications (line 2144) → contractors
64. contractorVerificationHistory (line 2175) → contractors
65. contractorAlerts (line 2199) → contractors
66. contractorAssignments (line 2227) → contractors, properties
67. contractorSLAProfiles (line 2302) → contractors
68. contractorJobPerformance (line 2323) → contractors, contractorAssignments
69. contractorRatings (line 2357) → contractors

### reporting.ts (5 tables) → org-structure, core-auth
71. ukhdsExports (line 2456) → organisations
72. complianceCalendarEvents (line 2501) → organisations, properties
73. scheduledReports (line 2541) → organisations, users
74. reportTemplates (line 2571) → organisations
75. generatedReports (line 2593) → scheduledReports

### config.ts (24 tables) → core-auth
76. videos → organisations, users
77. dataImports → organisations, users
78. dataImportRows → dataImports
79. factorySettings - standalone
80. factorySettingsAudit → factorySettings, users
81. systemLogs - standalone
82. navigationSections - standalone
83. navigationItems → navigationSections
84. navigationItemRoles → navigationItems
85. iconRegistry - standalone
86. cacheRegions - standalone
87. cacheStats → cacheRegions
88. cacheClearAudit → users
89. navigationConfig - standalone
90. settingAuditLog → users
91. systemSettings - standalone
92. cacheEntries - standalone
93. csvImportLogs - standalone
94. seedLog - standalone
95. systemHealthSnapshots - standalone
96. testSuiteResults - standalone
97. videoLibrary - standalone
98. helpGuideEntries - standalone
99. notificationQueue - standalone

**Total: 88 tables ✓** (verified via automated FK analysis - all assigned, no cycles)

## FK-Based Dependency Graph (VERIFIED via automated analysis)

```
Module                → Dependencies
──────────────────────────────────────────────────────────────
core-auth             → (none) - ROOT
org-structure         → core-auth
assets                → (none) - standalone types
config                → core-auth
compliance            → core-auth, org-structure
chatbot               → core-auth
api                   → compliance, core-auth, org-structure
contractor            → compliance, core-auth, org-structure
extraction            → compliance
ml                    → compliance, core-auth, org-structure
risk                  → core-auth
audit                 → compliance, core-auth, org-structure
reporting             → compliance, core-auth, org-structure
relations             → ALL modules (imports everything)
```

**Note**: No bidirectional dependencies detected. The graph is a proper DAG.

## Migration Order (safe sequence based on FK dependencies)

Phase 1 - Foundation (no external deps):
1. base.ts (shared enums)
2. core-auth.ts (users, organisations - ROOT tables)

Phase 2 - Hierarchy (depends on core-auth):
3. org-structure.ts (schemes, blocks, properties)
4. config.ts (factorySettings, navigation - minimal deps to users only)

Phase 3 - Core Domain (depends on org-structure):
5. assets.ts (componentTypes, spaces, components - NO certificates dep)
6. compliance.ts (certificates, rules, componentCertificates bridge)
7. contractor.ts (contractors + all subtables together)

Phase 4 - Integration (depends on compliance):
8. chatbot.ts (conversations, embeddings)
9. api.ts (apiClients, webhooks, apiKeys)
10. extraction.ts (runs, benchmarks - depends on certificates)
11. risk.ts (snapshots - depends on properties)

Phase 5 - Reporting & ML (depends on previous phases):
12. audit.ts (events)
13. reporting.ts (reports, calendar)
14. ml.ts (models, predictions - depends on extraction)

Phase 6 - Relations (LAST - imports ALL tables):
15. relations.ts (ALL Drizzle relations centralized)

## Backward Compatibility

After migration, `shared/schema.ts` becomes a passthrough:

```typescript
// shared/schema.ts
export * from './schema/index';
```

And `shared/schema/index.ts` re-exports all modules:

```typescript
export * from './base';
export * from './core-auth';
export * from './org-structure';
// ... all modules
export * from './relations';
```

## Relation Centralization

All Drizzle `relations()` stay in `relations.ts` to prevent circular imports:

```typescript
// shared/schema/relations.ts
import { relations } from "drizzle-orm";
import { users, organisations } from "./core-auth";
import { properties } from "./org-structure";
import { certificates } from "./compliance";
// ... import ALL tables

export const usersRelations = relations(users, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id],
  }),
}));
```

## Success Criteria
1. TypeScript build passes
2. All tests pass
3. `npm run db:push` shows no changes
4. Each table in exactly one module
5. No circular dependencies
6. Existing imports work unchanged
