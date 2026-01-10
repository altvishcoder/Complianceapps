# SocialComply

## Overview
SocialComply is a compliance management platform designed for UK social housing organizations. Its primary purpose is to streamline the tracking of compliance certificates (e.g., gas safety, electrical, fire risk) and the management of remedial actions for properties organized by schemes and blocks. The platform leverages AI for document extraction from compliance certificates, aiming to enhance compliance workflows and improve safety standards within social housing.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
-   **Framework**: React 18 with TypeScript and Vite.
-   **Routing**: Wouter.
-   **State Management**: TanStack React Query.
-   **UI Components**: shadcn/ui built on Radix UI, styled with Tailwind CSS v4.

### Backend
-   **Runtime**: Node.js with Express.js.
-   **Language**: TypeScript with ES modules.
-   **API Design**: RESTful JSON API endpoints.
-   **Route Architecture**: Modular routers in `server/routes/` with mounted routers for admin and reports. Legacy routes in `routes.ts` being incrementally migrated.

### Data Layer
-   **ORM**: Drizzle ORM with PostgreSQL.
-   **Database**: PostgreSQL.
-   **Schema Architecture**: Modular schema with 90+ tables organized into domain files, following a design pattern that centralizes relations and exports.
-   **Data Model**: Implements the UKHDS 5-level asset hierarchy (Scheme, Block, Dwelling/Property, Space, Component) with flexible space hierarchy and optional linking.
-   **Compliance Taxonomy**: Supports 80 compliance types across 16 system-protected compliance streams aligned with UK social housing regulations.
-   **Configuration Data**: Comprehensive industry-standard configuration including 80 certificate types, 45 AI extraction schemas, 64 compliance rules with UK legislation references, 46 normalization rules, 70 classification codes with remedial action automation, 36 HACT-aligned component types, 84 detection patterns, and 27 outcome rules.

### Navigation Structure
-   Organized into key areas: Overview Hub, Asset Management, Operations, Contractor Management, Monitoring, Administration, and Resources.

### Key Features
-   **AI-powered Document Extraction**: Utilizes AI for processing compliance certificates based on 45 extraction schemas.
-   **Configuration-Driven Remedial Actions**: Automated generation of remedial actions using configurable classification codes and UK legislation.
-   **CSV Import**: Support for importing properties and components via CSV.
-   **External Ingestion API**: Machine-to-machine API for external systems to submit compliance certificates.
-   **AI Assistant Chatbot**: A 5-layer cost-optimized architecture for compliance guidance, featuring intent classification, FAQ cache, database queries, LLM handling (Claude 3.5 Haiku), and response enhancement.

### Security
-   **User Role Hierarchy**: Hierarchical Role-Based Access Control (RBAC) system with various roles.
-   **Authentication**: BetterAuth-only authentication with email/password (bcrypt), session management, and multi-provider SSO.
-   **SSO Providers**: Generic OIDC supporting Microsoft Entra ID, Google, Okta, Keycloak, and custom OIDC providers.
-   **SSO Configuration**: Environment variables control provider enablement (AZURE_*, GOOGLE_*, OKTA_*, KEYCLOAK_*, OIDC_*).
-   **Admin Factory Settings Authorization**: Restricted access to critical settings with server-side validation and audit logging.
-   **Rate Limiting**: PostgreSQL-backed rate limiting.

### API Error Handling
-   **Standardization**: Implements RFC 7807 Problem Details for all API errors, with hierarchical error classes and helper functions for consistent error responses.

### API Versioning
-   **Current Version**: v1
-   **Versioned Endpoints**: `/api/v1/*` (recommended) - adds `X-API-Version: v1` header
-   **Legacy Endpoints**: `/api/*` (deprecated) - adds `X-API-Deprecation-Warning` header
-   **Frontend Config**: `client/src/lib/api-config.ts` exports `apiUrl()` helper and `API_VERSION` constant
-   **Error Integration**: `client/src/lib/queryClient.ts` exports `ApiError` class for RFC 7807 structured error handling

### Testing Infrastructure
-   **API Documentation**: OpenAPI 3.0 spec with Swagger UI, auto-generated from Zod schemas.
-   **Testing Suites**: Vitest for unit/integration tests, Playwright for E2E testing (including visual regression and accessibility), Supertest for HTTP API testing, and Pact for consumer-driven contract testing.

### Production Infrastructure
-   **Logging & Monitoring**: Structured JSON logging (Pino) and Sentry integration for error tracking. System health monitoring page.
-   **Database Optimization**: Migration-based approach for database optimization including ~15 performance indexes and 12 materialized views across 6 categories for scalability, and optimization tables for cached calculations. Admin API for managing optimizations.

### Cloud-Agnostic Storage
-   **Storage Provider Abstraction**: `IStorageProvider` interface in `server/storage/providers/` supports multiple backends
-   **Supported Providers**: Replit Object Storage, Local Filesystem, AWS S3, Azure Blob Storage, GCS
-   **S3 Provider**: Full implementation with presigned URLs for AWS and MinIO deployments
-   **Azure Provider**: Full implementation with SAS tokens (note: cross-container visibility change not supported)
-   **Configuration**: `STORAGE_PROVIDER` env var selects provider (replit, local, s3, azure, gcs)
-   **Factory Pattern**: `StorageFactory` with runtime provider selection and health checks
-   **Features**: Upload/download, signed URLs, ACL policies, public object search, entity path normalization

### Asset Strategy
-   **Cloud-Agnostic Design**: All assets are bundled locally for offline deployment.
-   **Icon Registry**: Centralized icon management.
-   **Map Assets**: Localized Leaflet marker icons and configurable tile sources.
-   **Branding/White-Label**: Per-tenant branding support via a dedicated table and API, allowing dynamic application of logos, colors, and custom CSS.

## External Dependencies

### Database
-   PostgreSQL

### AI/ML Services
-   **AI Provider Abstraction**: `IOCRProvider`, `ILLMProvider`, `IVisionProvider` interfaces in `server/services/ai/providers/`
-   **Provider Registry**: `AIProviderRegistry` with priority-based selection and health-aware fallback
-   **Cloud Providers**: Claude (LLM + Vision, priority 20), Azure Document Intelligence (OCR + Document Analysis, priority 10)
-   **Offline Providers**: Tesseract.js (OCR, priority 50), Ollama (LLM + Vision, priority 60)
-   **Fallback Behavior**: Registry tries providers in priority order, skipping unhealthy instances for airgapped resilience
-   **Configuration**: Providers auto-initialize from environment variables (ANTHROPIC_API_KEY, AZURE_DOCUMENT_INTELLIGENCE_*, OLLAMA_BASE_URL)

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