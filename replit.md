# ComplianceAI

## Overview

ComplianceAI is a compliance management platform designed for UK social housing organizations. It enables property managers to track compliance certificates (gas safety, electrical, fire risk, etc.), manage properties organized by schemes and blocks, and handle remedial actions. The application uses AI-powered document extraction to process uploaded compliance certificates.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **Fonts**: Inter (body), Outfit (display headings), JetBrains Mono (code)

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful JSON API endpoints under `/api/*`
- **Build Process**: esbuild for server bundling, Vite for client bundling

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all table definitions and Zod validation schemas
- **Database**: PostgreSQL (connection via `DATABASE_URL` environment variable)
- **Migrations**: Drizzle Kit with `drizzle-kit push` command

### Data Model (HACT/UKHDS Aligned)
The application follows the UKHDS 5-level asset hierarchy with housing terminology:

| Level | Housing Term | HACT/UKHDS Term | Description |
|-------|-------------|-----------------|-------------|
| 1 | **Organisation** | Housing Association | Top-level entity owning properties |
| 2 | **Scheme** | Site | Estate or housing development |
| 3 | **Block** | Property/Building | Physical building within a scheme |
| 4 | **Property** | Unit/Dwelling | Individual residential unit |
| 5 | **Unit** | Space/Room | Room or area within a property |
| 6 | **Component** | Component | Fixture/equipment (boiler, alarm, etc.) |

Hierarchy relationships:
- **Organisation** → owns multiple **Schemes** (Sites)
- **Scheme** → contains multiple **Blocks** (Properties/Buildings)
- **Block** → contains multiple **Properties** (Units/Dwellings)
- **Property** → contains multiple **Units** (Spaces/Rooms) and has **Certificates** and **Remedial Actions**
- **Unit** → contains **Components** (fixtures/equipment)
- **Certificate** → has **Extractions** (AI-processed data)

Key enums define compliance statuses, property types, certificate types, and action severities aligned with UK housing regulations.

### Compliance Fields
Extended schema fields for UK social housing compliance:

**Properties**: `vulnerableOccupant`, `epcRating` (A-G), `constructionYear`, `numberOfFloors`, `hasElectricity`, `hasAsbestos`, `hasSprinklers`, `localAuthority`

**Units**: `areaSqMeters`, `isAccessible`, `fireCompartment`, `asbestosPresent`

**Components**: `complianceStatus`, `certificateRequired`, `riskLevel` (HIGH/MEDIUM/LOW), `lastServiceDate`, `nextServiceDue`

### CSV Import Templates
The Data Import feature supports importing properties, units, and components from CSV files:
- **Templates**: `/api/imports/templates/:type/download` - blank CSV with headers
- **Samples**: `/api/imports/samples/:type/download` - CSV with realistic UK housing example data
- Sample files located in `public/samples/` directory
- All templates include compliance fields for comprehensive data import

### Seeding & Demo Data
- **SEED_DEMO_DATA** environment variable controls demo data seeding (default: `false`)
- Configuration data (certificate types, classification codes, etc.) always seeds automatically
- Minimal bootstrap creates admin user even without demo data
- Set `SEED_DEMO_DATA=true` to seed demo organisations, schemes, blocks, properties, and users

### Configuration-Driven Remedial Actions
The system uses a configuration-driven approach for generating remedial actions:
- **Classification Codes** table stores severity settings and action generation rules
- Fields include: `autoCreateAction`, `actionSeverity`, `costEstimateLow`, `costEstimateHigh`
- `generateRemedialActionsFromConfig` loads codes from database and applies configured rules
- Falls back to hardcoded logic if no configuration exists
- Supports EICR (C1/C2/C3), Gas Safety (ID/AR/NCS), and Fire Risk (HIGH/MEDIUM/LOW)

### Test Suite
Comprehensive test suite using Vitest:
- `tests/extraction.test.ts` - Unit tests for extraction functions
- `tests/api.test.ts` - API endpoint integration tests
- `tests/storage.test.ts` - Storage CRUD operation tests
- `tests/config-driven.test.ts` - Configuration-driven remedial action tests
- Run with: `npx vitest run`

### Development vs Production
- Development: Vite dev server with HMR, served through Express middleware
- Production: Static files served from `dist/public`, server bundled to `dist/index.cjs`

### Security Architecture

#### Admin Factory Settings Authorization
- Factory Settings page restricted to LASHAN_SUPER_USER and SUPER_ADMIN roles
- Server-side authorization via `requireAdminRole` middleware validates:
  1. Optional `ADMIN_API_TOKEN` environment variable (defense-in-depth)
  2. User ID from `X-User-Id` header
  3. User role from database lookup
- Type validation for settings: number fields reject NaN, boolean fields require 'true'/'false'
- All changes logged in `factory_settings_audit` table

#### Production Security Recommendations
- Configure `ADMIN_API_TOKEN` environment variable for additional security layer
- Implement proper session-based authentication (express-session + passport)
- Replace localStorage-based auth with server session validation
- Add rate limiting middleware for all API endpoints

### External Ingestion API
Machine-to-machine API for external systems to submit compliance certificates:

#### Authentication
- Bearer token authentication with API keys (prefix: `cai_`)
- API keys stored as SHA-256 hashes, prefix stored for lookup
- Rate limiting configurable via Factory Settings (default: 60 requests/min)
- X-RateLimit-* headers included in all responses

#### Endpoints
- **GET /api/v1/certificate-types** - List valid certificate types for ingestion
  - Returns: { certificateTypes: [{ code, name, shortName, complianceStream, description, validityMonths, requiredFields }] }
- **POST /api/v1/ingestions** - Submit certificate for processing
  - Fields: propertyId, certificateType, fileName, objectPath, webhookUrl, idempotencyKey
  - Validates certificateType against certificate_types database table
  - Returns: { id, status, message } or 400 with validTypes if invalid
- **GET /api/v1/ingestions/:id** - Check job status
  - Returns: { id, status, propertyId, certificateType, certificateId, statusMessage, errorDetails, createdAt, completedAt }
- **GET /api/v1/ingestions** - List jobs with pagination
  - Query params: limit, offset, status
- **POST /api/v1/uploads** - Create upload session for large files

#### Async Processing
- pg-boss job queue (`server/job-queue.ts`) handles async ingestion and webhook delivery
- 3 concurrent ingestion workers, 5 webhook workers
- Automatic retries with exponential backoff (3 retries max)
- Downloads files from Replit Object Storage (GCS)
- Integrates with existing Anthropic extraction pipeline
- Sends webhook callbacks on completion/failure

#### Admin UI
- **/admin/api-integration** - API Integration Guide page
  - Overview, Authentication, Endpoints, Webhooks, API Keys tabs
  - Code examples (curl, Node.js, Python)
  - API key generation and enable/disable management

### Production Infrastructure

#### Logging (Pino)
- Structured JSON logging via Pino (`server/logger.ts`)
- Component-scoped loggers: job-queue, api, extraction, webhook
- HTTP request logging middleware with pino-http
- Pretty-printed in development, JSON in production

#### Error Tracking (Sentry)
- Sentry v8 integration (`server/sentry.ts`)
- Express request instrumentation for full context
- Activate by setting `SENTRY_DSN` environment variable
- Sensitive headers (authorization, api-key, cookie) automatically stripped

#### Rate Limiting
- PostgreSQL-backed rate limiting via `rate_limit_entries` table
- Configurable window and limit via Factory Settings
- Automatic cleanup of expired entries every 5 minutes

#### System Health Monitoring
- **/admin/system-health** - Admin page showing:
  - Database connection status
  - API server status
  - Background job queue status
  - Real-time ingestion and webhook queue statistics
  - Accessible to Lashan Super User and Super Admin roles

## External Dependencies

### Database
- PostgreSQL database required via `DATABASE_URL` environment variable
- Uses `connect-pg-simple` for session storage

### AI/ML Services
- **Anthropic Claude Vision** (`@anthropic-ai/sdk`) for certificate document extraction
  - Uses Claude 3.5 Sonnet model with vision capabilities
  - Extracts data from certificate images (JPG, PNG, WebP)
  - Automatically detects issues and generates remedial actions
  - Requires `ANTHROPIC_API_KEY` environment variable

### Third-Party Libraries
- **Charts**: Recharts for data visualization
- **File Processing**: Multer for file uploads, xlsx for spreadsheet handling
- **Email**: Nodemailer for email notifications
- **Payments**: Stripe integration available
- **Date Handling**: date-fns for date manipulation

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal` for development error display
- `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner` for Replit integration
- Custom `vite-plugin-meta-images` for OpenGraph image handling with Replit domains