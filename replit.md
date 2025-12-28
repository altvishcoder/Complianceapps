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

### Data Model
The application follows a hierarchical property structure:
- **Organisation** → owns multiple **Schemes**
- **Scheme** → contains multiple **Blocks**
- **Block** → contains multiple **Properties**
- **Property** → has multiple **Certificates** and **Remedial Actions**
- **Certificate** → has **Extractions** (AI-processed data)

Key enums define compliance statuses, property types, certificate types, and action severities aligned with UK housing regulations.

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