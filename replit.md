# ComplianceAI

## Overview
ComplianceAI is a compliance management platform for UK social housing organizations. It enables property managers to track compliance certificates (gas safety, electrical, fire risk, etc.), manage properties organized by schemes and blocks, and handle remedial actions. The platform uses AI-powered document extraction to process uploaded compliance certificates, aiming to streamline compliance workflows and improve safety in social housing.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
-   **Framework**: React 18 with TypeScript, using Vite.
-   **Routing**: Wouter.
-   **State Management**: TanStack React Query.
-   **UI Components**: shadcn/ui built on Radix UI.
-   **Styling**: Tailwind CSS v4 with CSS variables.

### Backend
-   **Runtime**: Node.js with Express.js.
-   **Language**: TypeScript with ES modules.
-   **API Design**: RESTful JSON API endpoints under `/api/*`.
-   **Build Process**: esbuild for server, Vite for client.

### Data Layer
-   **ORM**: Drizzle ORM with PostgreSQL dialect.
-   **Database**: PostgreSQL.
-   **Migrations**: Drizzle Kit.
-   **Schema Architecture**: Fully modular schema with 90+ tables organized in 15 domain files at `shared/schema/tables/`:
    - **Domain Files**: base.ts, core-auth.ts, org-structure.ts, assets.ts, compliance.ts, config.ts, chatbot.ts, api.ts, contractor.ts, risk.ts, audit.ts, reporting.ts, ml.ts, cache.ts
    - **Design Pattern**: Tables import ONLY from drizzle-orm/pg-core, relations centralized in `relations.ts`, insert schemas in `schemas/index.ts`, types in `types/index.ts`
    - **Main Export**: `shared/schema.ts` re-exports from modular structure via barrel exports
    - **Recent Additions**: systemLogs, riskSnapshots, cacheRegions, cacheStats, cacheClearAudit tables
-   **Data Model**: Follows UKHDS 5-level asset hierarchy with optional linking and verification status. Organisation is implicit.
    - **UKHDS Hierarchy Terminology** (aligned with Housing Association usage):
      - **Scheme (Site Layer)**: Portfolio, Estate, Development - `schemes` table
      - **Block (Building Layer)**: Physical building structure - `blocks` table (what UKHDS calls "Property")
      - **Dwelling (Property Layer)**: The lettable home (flat, house) - `properties` table. UI displays as "Dwelling (Property)"
      - **Space (Room Layer)**: Rooms and communal areas - `spaces` table. Spaces attach to properties, blocks, or schemes.
      - **Component (Asset Layer)**: Equipment and assets (Boiler, Smoke Alarm, Consumer Unit) - `components` table with `propertyId` or `spaceId`
    - **Key Design Decision**: Properties ARE Dwellings (single entity). Units table was eliminated - spaces now attach directly to properties (rooms), blocks (communal areas), or schemes (estate-wide spaces).
    - **Flexible Space Hierarchy**: Spaces can attach at three levels:
      - **Property-level**: Rooms within a dwelling (Kitchen, Bedroom) - via `spaces.propertyId`
      - **Block-level**: Communal areas within a building (Stairwell, Plant Room) - via `spaces.blockId`
      - **Scheme-level**: Estate-wide communal spaces (Community Hall) - via `spaces.schemeId`
-   **Compliance Type Taxonomy**: Supports 80 compliance types across 16 compliance streams aligned with UK social housing regulations.
-   **Compliance Streams**: 16 high-level compliance categories (Gas & Heating, Electrical, Energy, Fire Safety, Asbestos, Water Safety, Lifting Equipment, Building Safety, External Areas, Security, HRB-specific, Housing Health, Accessibility, Pest Control, Waste, Communal) with system protection (isSystem streams cannot be deleted, only disabled).
-   **Configuration Data**: Comprehensive industry-standard configuration:
    - 80 certificate types across all compliance streams
    - 45 extraction schemas for AI document processing
    - 64 compliance rules with UK legislation references (Gas Safety Regs 1998, BS 7671, RRO 2005, CAR 2012, LOLER 1998, BSA 2022, etc.)
    - 46 normalisation rules for data standardisation
    - 70 classification codes with remedial action automation settings (autoCreateAction, actionSeverity, costEstimateLow/High)
    - 36 component types aligned with HACT standards
    - 84 detection patterns for certificate type identification (FILENAME and TEXT_CONTENT patterns with priority-based matching)
    - 27 outcome rules for compliance result interpretation (supports field checks, array matching for appliances/defects, and UK legislation references)

### Navigation Structure
-   **Overview Hub**: Overview, Analytics, Ingestion, Reporting (main dashboards)
-   **Asset Management**: Property Hierarchy (admin/manager only), Properties, Components
-   **Operations**: Certificates, Risk Radar, Remedial Actions, Calendar, Risk Maps, Asset Health (super admin), Remedial Kanban (super admin), Human Review (admin/manager)
-   **Contractor Management**: Contractors (expandable for contractor reports/analytics)
-   **Monitoring**: System Health, Ingestion Control, Chatbot Analytics, Audit Log, Test Suite, Model Insights (admin/manager access required)
-   **Administration**: User Management, Configuration, Factory Settings, Knowledge Training, Integrations, API Integration, API Documentation (admin only)
-   **Resources**: Data Import, Video Library, Help Guide

### Key Features
-   **AI-powered Document Extraction**: Processes uploaded compliance certificates using AI, covering 45 extraction schemas.
-   **Configuration-Driven Remedial Actions**: Generates remedial actions based on configurable classification codes and UK legislation references.
-   **CSV Import**: Supports importing properties and components via CSV templates.
-   **Seeding & Demo Data**: Option to seed demo data for testing and development.
-   **External Ingestion API**: Machine-to-machine API for external systems to submit compliance certificates with Bearer token authentication and async processing via pg-boss job queue.
-   **AI Assistant Chatbot**: 5-layer cost-optimized architecture for compliance guidance:
    - **Layer 0**: Intent Classification - keyword-based routing (greeting, navigation, database, faq, off_topic, complex)
    - **Layer 1**: FAQ Cache with TF-IDF - 12+ compliance FAQs with semantic matching (gas, electrical, fire, legionella, asbestos)
    - **Layer 2**: Database Queries - property/certificate lookups, compliance status searches
    - **Layer 3**: LLM Handler - Claude 3.5 Haiku for complex queries (256 max tokens)
    - **Layer 4**: Response Enhancement - context-aware follow-up suggestions

### Security
-   **User Role Hierarchy**: Hierarchical RBAC system with roles like LASHAN_SUPER_USER, SUPER_ADMIN, SYSTEM_ADMIN, COMPLIANCE_MANAGER, ADMIN, MANAGER, OFFICER, and VIEWER.
-   **Authentication**: BetterAuth-only authentication at `/api/auth/*`:
    - Email/password authentication with bcrypt (12 rounds)
    - 7-day session expiry with daily refresh
    - Session validation via `fromNodeHeaders` (converts Express headers to WHATWG Headers)
    - Microsoft Entra ID SSO via Generic OAuth plugin (optional, requires AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)
    - PostgreSQL-backed sessions, accounts, and verifications tables
    - **Frontend Client**: `client/src/lib/auth-client.ts` for BetterAuth React integration (basePath: `/api/auth`)
    - **Demo Credentials**: superadmin@complianceai.co.uk / SuperAdmin2025!
-   **Admin Factory Settings Authorization**: Restricted access to critical settings with server-side validation and audit logging.
-   **Rate Limiting**: PostgreSQL-backed rate limiting.

### Testing Infrastructure
-   **API Documentation**: OpenAPI 3.0 spec with Swagger UI at `/api/docs`, auto-generated from Zod schemas via zod-to-openapi.
-   **Unit/Integration Tests**: Vitest with test coverage reports, testing storage and extraction logic.
-   **E2E Testing**: Playwright for cross-browser testing (Chrome, Firefox, Safari, Mobile), including visual regression and WCAG 2.1 AA accessibility tests.
-   **API Testing**: Supertest for HTTP endpoint testing with session handling.
-   **Contract Testing**: Pact for consumer-driven contract testing between frontend and API.
-   **Test Commands**:
    - `npx vitest run` - Run unit/integration tests
    - `npx playwright test` - Run E2E tests (requires server running)
    - `npx playwright test e2e/visual-regression.spec.ts --update-snapshots` - Update visual baselines
    - `npx playwright test e2e/accessibility.spec.ts` - Run accessibility tests

### Production Infrastructure
-   **Logging**: Structured JSON logging using Pino.
-   **Error Tracking**: Sentry integration for error monitoring.
-   **System Health Monitoring**: Admin page to monitor database, API server, and job queue status.

### Version Management
-   **Current Version**: 0.9.0 (pre-release)
-   **Version Source**: `shared/version.ts` exports APP_VERSION, APP_NAME, and RELEASE_NOTES
-   **API Endpoints**:
    - `GET /api/version` - Returns version, name, environment, build time, uptime, and release highlights
    - `GET /api/version/releases` - Returns full release history
-   **UI Display**: Version shown in sidebar footer and System Health page header
-   **Changelog**: `CHANGELOG.md` follows Keep a Changelog format
-   **Pre-1.0 Convention**: Minor version may include breaking changes, patch for features/fixes

## External Dependencies

### Database
-   **PostgreSQL**: Primary database.

### AI/ML Services
-   **Anthropic Claude Vision**: Used for AI-powered certificate document extraction (Claude 3.5 Sonnet).

### Third-Party Libraries
-   **Charts**: Recharts.
-   **File Processing**: Multer (file uploads), xlsx (spreadsheet handling).
-   **Email**: Nodemailer.
-   **Date Handling**: date-fns.

### Replit-Specific
-   `@replit/vite-plugin-runtime-error-modal`
-   `@replit/vite-plugin-cartographer`
-   `@replit/vite-plugin-dev-banner`
-   `vite-plugin-meta-images`