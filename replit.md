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
-   **Data Model**: Follows UKHDS 5-level asset hierarchy (Organisation, Scheme, Block, Property, Unit, Component).
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

### Key Features
-   **AI-powered Document Extraction**: Processes uploaded compliance certificates using AI, covering 45 extraction schemas.
-   **Configuration-Driven Remedial Actions**: Generates remedial actions based on configurable classification codes and UK legislation references.
-   **CSV Import**: Supports importing properties, units, and components via CSV templates.
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
-   **Authentication**: Unified `/api/auth/*` path with dual system support:
    - **Legacy Auth**: Session-based endpoints at `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/change-password`
    - **BetterAuth**: Modern TypeScript-native authentication at `/api/auth/*` (handles sign-in/email, sign-up/email, session, sign-out, OAuth callbacks) with:
      - Email/password authentication with bcrypt (12 rounds)
      - 7-day session expiry with daily refresh
      - Microsoft Entra ID SSO via Generic OAuth plugin (optional, requires AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)
      - PostgreSQL-backed sessions, accounts, and verifications tables
    - **Frontend Client**: `client/src/lib/auth-client.ts` for BetterAuth React integration (basePath: `/api/auth`)
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