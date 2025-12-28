# ComplianceAI™ Build Guide — Phase 1
## Project Foundation & Setup

---

## Phase Overview

| Aspect | Details |
|--------|---------|
| **Duration** | Day 1-2 |
| **Objective** | Project scaffold, environment, infrastructure |
| **Prerequisites** | GitHub account, Replit account, Anthropic API key |
| **Outcome** | Running Next.js app with basic structure |

```
WHAT WE'RE BUILDING:

┌─────────────────────────────────────────────────────────┐
│                PROJECT FOUNDATION                       │
│                                                         │
│   GitHub Repo ──► Replit ──► Next.js 14 App            │
│                                                         │
│   + Docker configs                                      │
│   + Environment setup                                   │
│   + Project structure                                   │
│   + Essential configurations                            │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Accounts & Prerequisites

### Checklist (Complete Before Starting)

```
□ Create GitHub repository (private)
  - Name: compliance-ai
  - Add .gitignore: Node

□ Create/have Replit account
  - Pro account recommended for database access

□ Get Anthropic API key
  - From console.anthropic.com
  - Save for later use

□ Create Cloudflare account
  - For R2 storage (S3-compatible)
  - Create bucket: compliance-documents

□ Have VS Code installed locally
  - Optional but recommended for deep work
```

---

## Step 2: Connect GitHub to Replit

### Steps

1. Go to [replit.com](https://replit.com)
2. Click **Create Repl**
3. Select **Import from GitHub**
4. Authorize GitHub access
5. Select your `compliance-ai` repository
6. Choose template: **Next.js**

This creates bidirectional sync — Replit commits push to GitHub automatically.

---

## Step 3: Scaffold Project

### Prompt 1.1: Initial Project Setup

Copy this entire prompt into Replit Agent:

```
Create a Next.js 14 application with the following setup:

Project name: compliance-ai

Tech stack:
- Next.js 14 with App Router
- TypeScript (strict mode)
- Tailwind CSS
- shadcn/ui components
- Prisma ORM with PostgreSQL
- NextAuth.js for authentication

Project structure:
/src
  /app
    /api (API routes)
    /(auth) (login, register pages)
    /(dashboard) (main application)
  /components
    /ui (shadcn components)
    /features (feature-specific components)
  /lib
    /db (Prisma client)
    /ai (Claude API integration)
    /document-processing (OCR pipeline)
    /api (helpers)
    /utils (utilities)
/prisma
  schema.prisma
/scripts
/docs

Initial setup:
1. Initialize with TypeScript strict mode
2. Configure Tailwind with custom colors:
   - compliant: emerald-500
   - due-soon: amber-500
   - overdue: red-500
   - primary: blue-600
3. Set up Prisma with PostgreSQL connection
4. Install packages: date-fns, zod, lucide-react, recharts, pdf-parse, @anthropic-ai/sdk

Create a landing page that says "ComplianceAI - Intelligent Compliance Management"
```

---

## Step 4: Create Configuration Files

### Prompt 1.2: Environment Configuration

```
Create the following configuration files:

1. Create .env.example with these variables (this file gets committed):

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/complianceai"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# AI Services
ANTHROPIC_API_KEY="sk-ant-..."

# Cloud OCR (optional - for Tier 3)
CLOUD_OCR_PROVIDER="aws-textract"
AWS_REGION="eu-west-2"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""

# File Storage (S3-compatible)
S3_ENDPOINT="https://account-id.r2.cloudflarestorage.com"
S3_BUCKET="compliance-documents"
S3_ACCESS_KEY=""
S3_SECRET_KEY=""
S3_REGION="auto"

# Environment
NODE_ENV="development"

2. Update .gitignore to include:

# Environment
.env
.env.local
.env.*.local

# Dependencies
node_modules/

# Build
.next/
out/
dist/

# Database
*.db
prisma/migrations/*_migration_lock.toml

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store

# Uploads (local dev)
uploads/
tmp/

3. Create a .env file (copy from .env.example) and set your actual values.
Don't commit .env file.
```

### Prompt 1.3: Next.js Configuration

```
Update next.config.js with these settings:

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',  // Required for Docker deployment
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  
  // External packages that need to be bundled
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'tesseract.js'],
  },
};

module.exports = nextConfig;
```

---

## Step 5: Create Infrastructure Files

### Prompt 1.4: Dockerfile

```
Create a Dockerfile for production deployment:

# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl curl

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runner stage
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

### Prompt 1.5: Docker Compose (Local Development)

```
Create docker-compose.yml for local development:

version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/complianceai
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: complianceai
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Prompt 1.6: Render Deployment Config

```
Create render.yaml for Render.com deployment:

services:
  - type: web
    name: complianceai
    runtime: docker
    region: frankfurt
    plan: starter
    
    healthCheckPath: /api/health
    
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: complianceai-db
          property: connectionString
      - key: NEXTAUTH_URL
        value: https://complianceai.onrender.com
      - key: NEXTAUTH_SECRET
        generateValue: true
      - key: NODE_ENV
        value: production
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: S3_ENDPOINT
        sync: false
      - key: S3_BUCKET
        sync: false
      - key: S3_ACCESS_KEY
        sync: false
      - key: S3_SECRET_KEY
        sync: false

databases:
  - name: complianceai-db
    plan: starter
    region: frankfurt
    postgresMajorVersion: 16

Note: After creating this file, to deploy:
1. Push code to GitHub
2. Go to render.com → New → Blueprint
3. Connect repository
4. Set secret environment variables in dashboard
5. Deploy

Estimated cost: ~$14/month (web + database)
```

---

## Step 6: Create Health Check Endpoint

### Prompt 1.7: Health Check API

```
Create a health check endpoint for deployment monitoring.

Create src/app/api/health/route.ts:

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { status: string; latency?: number }> = {};
  
  // Database check
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latency: Date.now() - start };
  } catch (error) {
    checks.database = { status: 'error' };
  }
  
  // Calculate overall health
  const healthy = Object.values(checks).every(c => c.status === 'ok');
  
  return NextResponse.json(
    { 
      status: healthy ? 'healthy' : 'degraded', 
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}

Also create the Prisma client file at src/lib/db.ts:

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

---

## Step 7: Create VS Code Configuration

### Prompt 1.8: VS Code Settings

```
Create VS Code configuration for the project.

1. Create .vscode/settings.json:

{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ],
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  },
  "files.associations": {
    "*.css": "tailwindcss"
  }
}

2. Create .vscode/extensions.json:

{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "usernamehw.errorlens"
  ]
}

3. Create .prettierrc:

{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

---

## Verification Checklist

After completing Phase 1, verify:

```
□ Project runs locally
  - Run: npm run dev
  - Visit: http://localhost:3000
  - See landing page

□ Prisma is configured
  - prisma/schema.prisma exists
  - src/lib/db.ts exists

□ Health endpoint works
  - Visit: http://localhost:3000/api/health
  - Returns JSON with status

□ Docker builds (optional)
  - Run: docker build -t complianceai .
  - No errors in build

□ Files created:
  - .env.example
  - .env (not committed)
  - Dockerfile
  - docker-compose.yml
  - render.yaml
  - next.config.js (updated)
  - .vscode/settings.json

□ Git is syncing
  - Changes appear in GitHub repo
```

---

## What's Next

Phase 2 will add:
- Complete database schema
- Authentication with NextAuth
- User and organisation management

---

## Files Created in Phase 1

```
Root:
  .env.example
  .env (not committed)
  .gitignore (updated)
  Dockerfile
  docker-compose.yml
  render.yaml
  next.config.js (updated)
  .prettierrc

.vscode/
  settings.json
  extensions.json

src/lib/
  db.ts

src/app/api/health/
  route.ts
```

---

## Quick Reference: Commands

```bash
# Development
npm run dev                  # Start dev server
npm run build                # Build for production
npm run start                # Start production server

# Prisma
npx prisma generate          # Generate client
npx prisma migrate dev       # Run migrations (dev)
npx prisma studio            # Database browser

# Docker
docker build -t complianceai .
docker-compose up -d
```
