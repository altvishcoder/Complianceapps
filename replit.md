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
-   **Compliance Type Taxonomy**: Supports 80 compliance types across 16 categories aligned with UK social housing regulations.
-   **Configuration Data**: Extensive certificate types, extraction schemas, compliance rules, normalization rules, component types, and classification codes.

### Key Features
-   **AI-powered Document Extraction**: Processes uploaded compliance certificates using AI, covering 45 extraction schemas.
-   **Configuration-Driven Remedial Actions**: Generates remedial actions based on configurable classification codes and UK legislation references.
-   **CSV Import**: Supports importing properties, units, and components via CSV templates.
-   **Seeding & Demo Data**: Option to seed demo data for testing and development.
-   **External Ingestion API**: Machine-to-machine API for external systems to submit compliance certificates with Bearer token authentication and async processing via pg-boss job queue.

### Security
-   **User Role Hierarchy**: Hierarchical RBAC system with roles like LASHAN_SUPER_USER, SUPER_ADMIN, SYSTEM_ADMIN, COMPLIANCE_MANAGER, ADMIN, MANAGER, OFFICER, and VIEWER.
-   **Authentication**: Username/password authentication with bcrypt, `X-User-Id` header for user identification.
-   **Admin Factory Settings Authorization**: Restricted access to critical settings with server-side validation and audit logging.
-   **Rate Limiting**: PostgreSQL-backed rate limiting.

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