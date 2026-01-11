# ComplianceAI Architecture Guide

A practical guide for new contributors to understand the codebase structure and domain ownership.

## Project Structure Overview

```
├── client/                 # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/     # Reusable UI components (shadcn/ui + Radix)
│   │   ├── pages/          # Route-based page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── contexts/       # React context providers
│   │   ├── lib/            # Utilities, API client, query client
│   │   └── config/         # Frontend configuration (icons, maps)
│   └── index.html
│
├── server/                 # Express.js backend
│   ├── routes/             # Domain-specific API routers
│   │   └── admin/          # Admin-only operations
│   ├── storage/            # Database access layer
│   │   ├── domains/        # Domain-specific storage modules
│   │   └── providers/      # Cloud storage providers (S3, Azure, etc.)
│   ├── services/           # Business logic and integrations
│   │   ├── ai/             # AI provider abstractions
│   │   └── extraction/     # Document extraction pipeline
│   ├── middleware/         # Express middleware
│   └── routes.ts           # Main router registration
│
├── shared/                 # Shared code between client/server
│   └── schema/             # Drizzle ORM schema definitions
│       ├── tables/         # Table definitions by domain
│       ├── schemas/        # Zod validation schemas
│       ├── types/          # TypeScript type exports
│       └── relations.ts    # Table relationships
│
├── migrations/             # Drizzle database migrations
├── tests/                  # Unit and integration tests
├── e2e/                    # Playwright E2E tests
└── docs/                   # Documentation
```

### Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `drizzle.config.ts` | Database migration config |
| `vite.config.ts` | Frontend build config |
| `playwright.config.ts` | E2E testing config |
| `.env.example` | Environment variable template |
| `replit.md` | Project documentation for AI agents |

## Domain Ownership Map

Each domain router owns a specific area of functionality. When adding features, identify the correct domain first.

### Core Domain Routers

| Router | Path | Responsibility |
|--------|------|----------------|
| `certificates.routes.ts` | `/api/certificates` | Certificate CRUD, uploads, AI extraction, status management |
| `properties.routes.ts` | `/api/properties` | Property CRUD, search, geo-location, hierarchy links |
| `remedial.routes.ts` | `/api/actions` | Remedial action management, status workflows, assignments |
| `contractors.routes.ts` | `/api/contractors` | Contractor profiles, staff management, certifications |
| `hierarchy.routes.ts` | `/api/schemes`, `/api/blocks`, `/api/organisations` | Organizational hierarchy (Scheme → Block → Property) |

### Configuration & System Routers

| Router | Path | Responsibility |
|--------|------|----------------|
| `configuration.routes.ts` | `/api/config/*` | Compliance streams, certificate types, rules, factory settings |
| `auth-endpoints.routes.ts` | `/api/auth/*` | Authentication, SSO providers, session management |
| `branding.routes.ts` | `/api/branding` | Tenant branding, white-label customization |
| `system.routes.ts` | `/api/system/*` | Health checks, cache management, system operations |

### Specialized Routers

| Router | Path | Responsibility |
|--------|------|----------------|
| `extraction.routes.ts` | `/api/extraction/*` | Document extraction API, processing status |
| `analytics.routes.ts` | `/api/analytics/*` | Reporting, dashboard stats, compliance metrics |
| `golden-thread.routes.ts` | `/api/golden-thread/*` | Building safety compliance tracking |
| `ml.routes.ts` | `/api/ml/*` | ML predictions, pattern analysis |
| `search.routes.ts` | `/api/search/*` | Global search across entities |

### Admin Router (`server/routes/admin/`)

Protected administrative operations requiring elevated permissions:

| Module | Responsibility |
|--------|----------------|
| `index.ts` | Admin router aggregation |
| `users.ts` | User management, role assignment |
| `cloud-config.ts` | Storage provider configuration |
| `db-optimization.ts` | Database performance management |
| `bulk-seed.ts` | Demo data seeding |

## Storage Layer Architecture

The storage layer provides a clean abstraction over database operations.

### Structure

```
server/storage/
├── index.ts          # Exports storage singleton and interfaces
├── interfaces.ts     # IStorage interface definitions
├── base.ts           # Base storage class with shared logic
├── domains/          # Domain-specific storage implementations
│   ├── users.storage.ts
│   ├── properties.storage.ts
│   ├── certificates.storage.ts
│   ├── remedials.storage.ts
│   ├── contractors.storage.ts
│   ├── configuration.storage.ts
│   ├── components.storage.ts
│   ├── api.storage.ts
│   └── system.storage.ts
└── providers/        # Cloud storage providers
    ├── types.ts      # IStorageProvider interface
    ├── factory.ts    # Provider selection factory
    ├── replit.ts     # Replit Object Storage
    ├── s3.ts         # AWS S3 / MinIO
    ├── azure-blob.ts # Azure Blob Storage
    └── local.ts      # Local filesystem
```

### Database Schema Organization

```
shared/schema/
├── index.ts          # Main export barrel
├── relations.ts      # All table relationships (centralized)
├── tables/           # Table definitions grouped by domain
│   ├── core-auth.ts  # Users, sessions, roles
│   ├── org-structure.ts # Schemes, blocks, organisations
│   ├── assets.ts     # Properties, spaces, components
│   ├── compliance.ts # Certificates, extractions
│   ├── contractor.ts # Contractors, staff
│   ├── config.ts     # Certificate types, rules, streams
│   ├── audit.ts      # Audit logs
│   ├── risk.ts       # Risk assessments
│   └── ...
├── schemas/          # Zod schemas (insert/update validation)
└── types/            # TypeScript type exports
```

## Service Layer

### Key Services (`server/services/`)

| Service | Purpose |
|---------|---------|
| `audit.ts` | Audit logging with change tracking |
| `cache.ts` | Query result caching |
| `risk-scoring.ts` | Property/certificate risk calculations |
| `expiry-alerts.ts` | Certificate expiry notifications |
| `ai-assistant.ts` | Chatbot with 5-layer architecture |
| `confidence-scoring.ts` | Extraction confidence metrics |
| `duplicate-detection.ts` | Certificate duplicate checking |

### AI Providers (`server/services/ai/providers/`)

Abstracted AI provider system with fallback support:

| Provider | File | Purpose |
|----------|------|---------|
| Claude | `claude.ts` | Primary LLM (vision + text) |
| Azure DI | `azure-di.ts` | Document Intelligence OCR |
| Tesseract | `tesseract.ts` | Local OCR fallback |
| Ollama | `ollama.ts` | Self-hosted LLM option |

Register providers in `registry.ts`. The system automatically falls back when providers fail.

### Extraction Pipeline (`server/services/extraction/`)

Document processing workflow:

```
format-detector.ts → orchestrator.ts → [claude-vision.ts | azure-di.ts]
                                            ↓
                                    classification-linker.ts
                                            ↓
                                    outcome-evaluator.ts
```

| Module | Responsibility |
|--------|----------------|
| `orchestrator.ts` | Coordinates extraction workflow |
| `format-detector.ts` | Identifies document format (PDF, image, etc.) |
| `claude-vision.ts` | Claude-based visual document extraction |
| `azure-di.ts` | Azure Document Intelligence extraction |
| `classification-linker.ts` | Links extractions to certificate types |
| `pattern-detector.ts` | Template pattern matching |
| `outcome-evaluator.ts` | Determines extraction quality |

## Development Guidelines

### Adding New Routes

1. Create router file in `server/routes/`:
```typescript
import { Router } from "express";
import { storage } from "../storage";

export const myDomainRouter = Router();

myDomainRouter.get("/", async (req, res) => {
  const data = await storage.listMyDomain();
  res.json(data);
});
```

2. Register in `server/routes.ts`:
```typescript
import { myDomainRouter } from "./routes/my-domain.routes";
app.use('/api/my-domain', myDomainRouter);
```

### Adding New Storage Methods

1. Add interface method in `server/storage/interfaces.ts`:
```typescript
export interface IMyDomainStorage {
  listMyDomain(): Promise<MyDomain[]>;
  createMyDomain(data: InsertMyDomain): Promise<MyDomain>;
}
```

2. Implement in `server/storage/domains/my-domain.storage.ts`:
```typescript
export class MyDomainStorage implements IMyDomainStorage {
  async listMyDomain() {
    return db.select().from(myDomainTable);
  }
}
```

3. Export from `server/storage/index.ts`

### Adding Schema Tables

1. Create or update table file in `shared/schema/tables/`:
```typescript
export const myTable = pgTable("my_table", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

2. Add insert schema in `shared/schema/schemas/`:
```typescript
export const insertMyTableSchema = createInsertSchema(myTable).omit({ id: true, createdAt: true });
export type InsertMyTable = z.infer<typeof insertMyTableSchema>;
export type MyTable = typeof myTable.$inferSelect;
```

3. Add relations in `shared/schema/relations.ts`

4. Export from barrel files

5. Generate migration: `npm run db:generate`

### Testing Requirements

- **Unit tests**: Vitest for services and utilities (`tests/`)
- **API tests**: Supertest for route testing
- **E2E tests**: Playwright for user flows (`e2e/`)
- **Coverage target**: Maintain existing coverage levels

Run tests:
```bash
npm test              # Unit tests
npm run test:e2e      # E2E tests
npm run test:coverage # Coverage report
```

### Code Style Conventions

- Use TypeScript strict mode
- Follow existing patterns in neighboring files
- Use Zod for all API validation
- Add `data-testid` attributes to interactive elements
- Use existing UI components from `client/src/components/ui/`
- Keep routes thin; business logic goes in services
- Use storage interface for all database access

## Multi-Cloud Deployment

### Storage Provider Abstraction

The `IStorageProvider` interface enables cloud-agnostic file storage:

```typescript
interface IStorageProvider {
  upload(key: string, data: Buffer, options?: UploadOptions): Promise<string>;
  download(key: string): Promise<Buffer>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}
```

Configure via `STORAGE_PROVIDER` env var: `replit`, `s3`, `azure_blob`, `gcs`, `local`

### AI Provider Fallback System

Providers are registered with priority. The system tries each in order:

```typescript
// In registry.ts
registerProvider('claude', claudeProvider, { priority: 1 });
registerProvider('azure-di', azureDIProvider, { priority: 2 });
registerProvider('tesseract', tesseractProvider, { priority: 3 });
```

If Claude fails, Azure DI is attempted. If that fails, Tesseract runs locally.

### Environment Configuration

Copy `.env.example` to `.env` and configure:

| Category | Key Variables |
|----------|---------------|
| Database | `DATABASE_URL` |
| Storage | `STORAGE_PROVIDER`, `AWS_*`, `AZURE_*`, `GCS_*` |
| AI | `ANTHROPIC_API_KEY`, `AZURE_DOCUMENT_INTELLIGENCE_*` |
| SSO | `AZURE_*`, `GOOGLE_*`, `OKTA_*`, `KEYCLOAK_*` |
| Security | `SESSION_SECRET`, `BETTER_AUTH_SECRET` |

See `.env.example` for complete documentation of all variables.
