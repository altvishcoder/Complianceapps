# ComplianceAI™ Build Guide — Phase 2
## Database Schema & Authentication

---

## Phase Overview

| Aspect | Details |
|--------|---------|
| **Duration** | Day 2-3 |
| **Objective** | Complete database schema, auth system |
| **Prerequisites** | Phase 1 complete |
| **Outcome** | Working login, database with all tables |

```
WHAT WE'RE BUILDING:

┌─────────────────────────────────────────────────────────┐
│              DATABASE & AUTH LAYER                      │
│                                                         │
│   ┌───────────┐   ┌───────────┐   ┌───────────┐        │
│   │PostgreSQL │ ─►│  Prisma   │ ─►│ Next.js   │        │
│   │ Database  │   │   ORM     │   │   App     │        │
│   └───────────┘   └───────────┘   └───────────┘        │
│                                                         │
│   + Organisation/User models                            │
│   + Property/Asset models                               │
│   + Compliance/Certificate models                       │
│   + NextAuth authentication                             │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Complete Prisma Schema

### Prompt 2.1: Database Schema

```
Create the complete Prisma schema for ComplianceAI.

Replace the contents of prisma/schema.prisma with:

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==========================================
// ORGANISATION & AUTH
// ==========================================

model Organisation {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  address      String?
  contactEmail String?
  logoUrl      String?
  settings     Json     @default("{}")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  users             User[]
  properties        Property[]
  certificates      Certificate[]
  complianceRecords ComplianceRecord[]
  auditLogs         AuditLog[]
  processingUsage   ProcessingUsage[]

  @@index([slug])
}

model User {
  id             String    @id @default(cuid())
  email          String    @unique
  name           String?
  passwordHash   String
  role           Role      @default(OFFICER)
  organisationId String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  lastLoginAt    DateTime?

  organisation Organisation  @relation(fields: [organisationId], references: [id])
  certificates Certificate[] @relation("UploadedBy")
  extractions  Extraction[]  @relation("ReviewedBy")
  auditLogs    AuditLog[]

  @@index([organisationId])
}

enum Role {
  ADMIN
  MANAGER
  OFFICER
  VIEWER
}

// ==========================================
// PROPERTY & ASSETS
// ==========================================

model Property {
  id             String         @id @default(cuid())
  organisationId String
  uprn           String
  addressLine1   String
  addressLine2   String?
  city           String
  postcode       String
  propertyType   PropertyType   @default(OTHER)
  bedrooms       Int?
  block          String?
  scheme         String?
  status         PropertyStatus @default(ACTIVE)
  metadata       Json           @default("{}")
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  organisation      Organisation       @relation(fields: [organisationId], references: [id])
  assets            Asset[]
  certificates      Certificate[]
  complianceRecords ComplianceRecord[]
  remedialActions   RemedialAction[]

  @@unique([organisationId, uprn])
  @@index([organisationId])
  @@index([organisationId, postcode])
}

enum PropertyType {
  HOUSE
  FLAT
  BUNGALOW
  MAISONETTE
  BEDSIT
  OTHER
}

enum PropertyStatus {
  ACTIVE
  VOID
  SOLD
  DEMOLISHED
}

model Asset {
  id           String      @id @default(cuid())
  propertyId   String
  assetType    AssetType
  location     String?
  serialNumber String?
  manufacturer String?
  model        String?
  installDate  DateTime?
  status       AssetStatus @default(ACTIVE)
  metadata     Json        @default("{}")
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  property          Property           @relation(fields: [propertyId], references: [id])
  certificates      Certificate[]
  complianceRecords ComplianceRecord[]

  @@index([propertyId])
}

enum AssetType {
  BOILER
  LIFT
  FIRE_DOOR
  SMOKE_ALARM
  CO_ALARM
  ELECTRICAL_INSTALLATION
  ASBESTOS_MATERIAL
  WATER_SYSTEM
  OTHER
}

enum AssetStatus {
  ACTIVE
  REPLACED
  REMOVED
}

// ==========================================
// COMPLIANCE STREAMS
// ==========================================

model ComplianceStream {
  id                     String   @id @default(cuid())
  code                   String   @unique
  name                   String
  description            String?
  defaultFrequencyMonths Int
  legislation            String?
  isStatutory            Boolean  @default(true)
  isActive               Boolean  @default(true)
  config                 Json     @default("{}")

  certificates      Certificate[]
  complianceRecords ComplianceRecord[]
  extractionPrompts ExtractionPrompt[]
}

// ==========================================
// CERTIFICATES
// ==========================================

model Certificate {
  id                 String            @id @default(cuid())
  organisationId     String
  propertyId         String
  assetId            String?
  complianceStreamId String
  originalFilename   String
  storagePath        String
  fileSize           Int
  mimeType           String
  uploadedById       String
  uploadedAt         DateTime          @default(now())
  source             CertificateSource @default(UPLOAD)
  processingStatus   ProcessingStatus  @default(PENDING)
  processingTier     Int?
  processingCost     Float?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  organisation     Organisation     @relation(fields: [organisationId], references: [id])
  property         Property         @relation(fields: [propertyId], references: [id])
  asset            Asset?           @relation(fields: [assetId], references: [id])
  complianceStream ComplianceStream @relation(fields: [complianceStreamId], references: [id])
  uploadedBy       User             @relation("UploadedBy", fields: [uploadedById], references: [id])
  extractions      Extraction[]
  complianceRecord ComplianceRecord?
  processingUsage  ProcessingUsage[]

  @@index([organisationId])
  @@index([organisationId, processingStatus])
  @@index([propertyId])
}

enum CertificateSource {
  UPLOAD
  EMAIL
  API
  CONTRACTOR_PORTAL
}

enum ProcessingStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  REVIEW_REQUIRED
}

// ==========================================
// EXTRACTIONS
// ==========================================

model Extraction {
  id            String           @id @default(cuid())
  certificateId String
  rawResponse   Json
  extractedData Json
  confidence    Float
  status        ExtractionStatus @default(PENDING_REVIEW)
  reviewedById  String?
  reviewedAt    DateTime?
  reviewNotes   String?
  createdAt     DateTime         @default(now())

  certificate Certificate @relation(fields: [certificateId], references: [id])
  reviewedBy  User?       @relation("ReviewedBy", fields: [reviewedById], references: [id])

  @@index([certificateId])
}

enum ExtractionStatus {
  AUTO_APPROVED
  PENDING_REVIEW
  APPROVED
  REJECTED
}

// ==========================================
// COMPLIANCE RECORDS
// ==========================================

model ComplianceRecord {
  id                 String            @id @default(cuid())
  organisationId     String
  propertyId         String
  assetId            String?
  complianceStreamId String
  certificateId      String            @unique
  status             ComplianceStatus
  inspectionDate     DateTime
  expiryDate         DateTime?
  nextDueDate        DateTime
  outcome            InspectionOutcome
  contractor         String?
  engineerName       String?
  certificateNumber  String?
  defects            Json              @default("[]")
  metadata           Json              @default("{}")
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  organisation     Organisation     @relation(fields: [organisationId], references: [id])
  property         Property         @relation(fields: [propertyId], references: [id])
  asset            Asset?           @relation(fields: [assetId], references: [id])
  complianceStream ComplianceStream @relation(fields: [complianceStreamId], references: [id])
  certificate      Certificate      @relation(fields: [certificateId], references: [id])
  remedialActions  RemedialAction[]

  @@index([organisationId])
  @@index([organisationId, status])
  @@index([organisationId, nextDueDate])
  @@index([propertyId])
}

enum ComplianceStatus {
  COMPLIANT
  NON_COMPLIANT
  OVERDUE
  DUE_SOON
  NOT_APPLICABLE
}

enum InspectionOutcome {
  PASS
  FAIL
  ADVISORY
  UNABLE_TO_ACCESS
}

// ==========================================
// REMEDIAL ACTIONS
// ==========================================

model RemedialAction {
  id                 String         @id @default(cuid())
  complianceRecordId String?
  organisationId     String
  certificateId      String?
  propertyId         String
  description        String
  priority           ActionPriority
  status             ActionStatus   @default(OPEN)
  source             String         @default("EXTRACTION")
  dueDate            DateTime?
  completedDate      DateTime?
  assignedTo         String?
  workOrderRef       String?
  notes              String?
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt

  complianceRecord ComplianceRecord? @relation(fields: [complianceRecordId], references: [id])
  property         Property          @relation(fields: [propertyId], references: [id])

  @@index([complianceRecordId])
  @@index([status])
  @@index([organisationId, status])
}

enum ActionPriority {
  EMERGENCY
  URGENT
  ROUTINE
}

enum ActionStatus {
  OPEN
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

// ==========================================
// AI & PROCESSING
// ==========================================

model ExtractionPrompt {
  id                 String   @id @default(cuid())
  complianceStreamId String
  contractor         String?
  version            Int      @default(1)
  promptText         String   @db.Text
  isActive           Boolean  @default(true)
  usageCount         Int      @default(0)
  avgConfidence      Float?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  complianceStream ComplianceStream @relation(fields: [complianceStreamId], references: [id])

  @@unique([complianceStreamId, contractor, version])
  @@index([complianceStreamId, isActive])
}

model ProcessingUsage {
  id               String   @id @default(cuid())
  organisationId   String
  certificateId    String
  tier             Int
  method           String
  cost             Float
  processingTimeMs Int
  success          Boolean
  errorMessage     String?
  createdAt        DateTime @default(now())

  organisation Organisation @relation(fields: [organisationId], references: [id])
  certificate  Certificate  @relation(fields: [certificateId], references: [id])

  @@index([organisationId, createdAt])
}

// ==========================================
// AUDIT LOG
// ==========================================

model AuditLog {
  id             String   @id @default(cuid())
  organisationId String
  userId         String?
  action         String
  entityType     String
  entityId       String?
  previousData   Json?
  newData        Json?
  ipAddress      String?
  userAgent      String?
  createdAt      DateTime @default(now())

  organisation Organisation @relation(fields: [organisationId], references: [id])
  user         User?        @relation(fields: [userId], references: [id])

  @@index([organisationId, createdAt])
  @@index([organisationId, entityType, entityId])
}

After creating this schema, run:
npx prisma generate
npx prisma migrate dev --name initial
```

---

## Step 2: Create Seed Script

### Prompt 2.2: Database Seed

```
Create the database seed script.

Create prisma/seed.ts:

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create compliance streams
  const streams = [
    { 
      code: 'GAS', 
      name: 'Gas Safety', 
      frequencyMonths: 12, 
      legislation: 'Gas Safety (Installation and Use) Regulations 1998',
      description: 'Annual gas safety inspection and certification'
    },
    { 
      code: 'ELECTRICAL', 
      name: 'Electrical Safety', 
      frequencyMonths: 60, 
      legislation: 'Electrical Safety Standards Regulations 2020',
      description: 'Electrical Installation Condition Report (EICR)'
    },
    { 
      code: 'FIRE', 
      name: 'Fire Risk Assessment', 
      frequencyMonths: 12, 
      legislation: 'Regulatory Reform (Fire Safety) Order 2005',
      description: 'Fire risk assessment for communal areas'
    },
    { 
      code: 'ASBESTOS', 
      name: 'Asbestos Management', 
      frequencyMonths: 12, 
      legislation: 'Control of Asbestos Regulations 2012',
      description: 'Asbestos survey and management plan'
    },
    { 
      code: 'LEGIONELLA', 
      name: 'Legionella Risk Assessment', 
      frequencyMonths: 24, 
      legislation: 'HSE ACoP L8',
      description: 'Water system risk assessment for legionella'
    },
    { 
      code: 'LIFT', 
      name: 'Lift Safety (LOLER)', 
      frequencyMonths: 6, 
      legislation: 'LOLER 1998',
      description: 'Thorough examination of lifting equipment'
    },
    { 
      code: 'EPC', 
      name: 'Energy Performance Certificate', 
      frequencyMonths: 120, 
      legislation: 'Energy Performance Regulations',
      description: 'Energy efficiency rating certificate'
    },
    { 
      code: 'SMOKE_ALARM', 
      name: 'Smoke & CO Alarms', 
      frequencyMonths: 12, 
      legislation: 'Smoke and CO Alarm Regulations 2015',
      description: 'Smoke and carbon monoxide alarm testing'
    },
  ];

  for (const stream of streams) {
    await prisma.complianceStream.upsert({
      where: { code: stream.code },
      update: {},
      create: {
        code: stream.code,
        name: stream.name,
        description: stream.description,
        defaultFrequencyMonths: stream.frequencyMonths,
        legislation: stream.legislation,
        isStatutory: true,
      },
    });
  }
  console.log('Created compliance streams');

  // Create demo organisation
  const org = await prisma.organisation.upsert({
    where: { slug: 'demo-housing' },
    update: {},
    create: {
      name: 'Demo Housing Association',
      slug: 'demo-housing',
      contactEmail: 'admin@demo-housing.org',
      address: '123 Housing Street, London, SW1A 1AA',
    },
  });
  console.log('Created demo organisation');

  // Create demo admin user
  const passwordHash = await hash('demo123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@demo-housing.org' },
    update: {},
    create: {
      email: 'admin@demo-housing.org',
      name: 'Admin User',
      passwordHash,
      role: 'ADMIN',
      organisationId: org.id,
    },
  });
  console.log('Created demo admin user (admin@demo-housing.org / demo123)');

  // Create demo properties
  const properties = [
    { uprn: '100000000001', addressLine1: '1 Example Street', city: 'London', postcode: 'SW1A 1AA', propertyType: 'FLAT', bedrooms: 2 },
    { uprn: '100000000002', addressLine1: '2 Example Street', city: 'London', postcode: 'SW1A 1AB', propertyType: 'FLAT', bedrooms: 1 },
    { uprn: '100000000003', addressLine1: '3 Example Street', city: 'London', postcode: 'SW1A 1AC', propertyType: 'HOUSE', bedrooms: 3 },
    { uprn: '100000000004', addressLine1: '4 Example Street', city: 'London', postcode: 'SW1A 1AD', propertyType: 'FLAT', bedrooms: 2 },
    { uprn: '100000000005', addressLine1: '5 Example Street', city: 'London', postcode: 'SW1A 1AE', propertyType: 'BUNGALOW', bedrooms: 2 },
  ];

  for (const prop of properties) {
    await prisma.property.upsert({
      where: { 
        organisationId_uprn: { 
          organisationId: org.id, 
          uprn: prop.uprn 
        } 
      },
      update: {},
      create: {
        organisationId: org.id,
        uprn: prop.uprn,
        addressLine1: prop.addressLine1,
        city: prop.city,
        postcode: prop.postcode,
        propertyType: prop.propertyType as any,
        bedrooms: prop.bedrooms,
      },
    });
  }
  console.log('Created demo properties');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

Also update package.json to add the prisma seed configuration:

{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}

Then run:
npm install bcryptjs @types/bcryptjs ts-node
npx prisma db seed
```

---

## Step 3: Set Up Authentication

### Prompt 2.3: NextAuth Configuration

```
Set up NextAuth.js authentication.

1. Create src/lib/auth.ts:

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from './db';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  
  pages: {
    signIn: '/login',
    error: '/login',
  },
  
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { organisation: true },
        });
        
        if (!user) {
          throw new Error('Invalid email or password');
        }
        
        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error('Invalid email or password');
        }
        
        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organisationId: user.organisationId,
          organisationName: user.organisation.name,
        };
      },
    }),
  ],
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.organisationId = user.organisationId;
        token.organisationName = user.organisationName;
      }
      return token;
    },
    
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.organisationId = token.organisationId as string;
        session.user.organisationName = token.organisationName as string;
      }
      return session;
    },
  },
};

2. Create src/types/next-auth.d.ts for TypeScript types:

import { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      organisationId: string;
      organisationName: string;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: string;
    organisationId: string;
    organisationName: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    organisationId: string;
    organisationName: string;
  }
}

3. Create src/app/api/auth/[...nextauth]/route.ts:

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

Run: npm install next-auth
```

### Prompt 2.4: Auth Helpers

```
Create authentication helper functions.

Create src/lib/auth-helpers.ts:

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from './auth';

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAuth(request?: NextRequest) {
  const session = await getSession();
  
  if (!session?.user) {
    throw new AuthError('Unauthorized', 401);
  }
  
  return session;
}

export async function requireRole(roles: string[], request?: NextRequest) {
  const session = await requireAuth(request);
  
  if (!roles.includes(session.user.role)) {
    throw new AuthError('Forbidden', 403);
  }
  
  return session;
}

export async function getCurrentOrganisation() {
  const session = await getSession();
  return session?.user?.organisationId || null;
}

export class AuthError extends Error {
  status: number;
  
  constructor(message: string, status: number = 401) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}

export function handleApiError(error: unknown) {
  console.error('API Error:', error);
  
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }
  
  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

### Prompt 2.5: Auth Middleware

```
Create middleware to protect routes.

Create src/middleware.ts:

import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Add custom logic here if needed
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Allow public routes
        if (
          pathname === '/' ||
          pathname === '/login' ||
          pathname === '/register' ||
          pathname.startsWith('/api/auth') ||
          pathname.startsWith('/api/health') ||
          pathname.startsWith('/_next') ||
          pathname.startsWith('/favicon')
        ) {
          return true;
        }
        
        // Require authentication for all other routes
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

---

## Step 4: Create Login Page

### Prompt 2.6: Login Page UI

```
Create the login page.

Create src/app/(auth)/login/page.tsx:

'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      
      if (result?.error) {
        setError(result.error);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">ComplianceAI</CardTitle>
          <CardDescription>
            Sign in to your account
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 text-center">
              <strong>Demo credentials:</strong><br />
              admin@demo-housing.org / demo123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

Also create the auth layout at src/app/(auth)/layout.tsx:

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

---

## Step 5: Create Session Provider

### Prompt 2.7: Session Provider

```
Create the session provider for client-side auth.

Create src/components/providers/SessionProvider.tsx:

'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

interface Props {
  children: React.ReactNode;
}

export function SessionProvider({ children }: Props) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  );
}

Update src/app/layout.tsx to include the provider:

import { Inter } from 'next/font/google';
import { SessionProvider } from '@/components/providers/SessionProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'ComplianceAI',
  description: 'Intelligent Compliance Management for Social Housing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

---

## Verification Checklist

After completing Phase 2, verify:

```
□ Database is set up
  - Run: npx prisma studio
  - All tables visible
  - Seed data present (compliance streams, demo org, demo user)

□ Login works
  - Visit: http://localhost:3000/login
  - Use demo credentials: admin@demo-housing.org / demo123
  - Redirects to /dashboard

□ Protected routes work
  - Visit /dashboard without logging in
  - Redirects to /login

□ Session works
  - Login successfully
  - Refresh page - still logged in

□ Auth helpers work
  - requireAuth throws if not logged in
  - requireRole checks role correctly
```

---

## What's Next

Phase 3 will add:
- Dashboard layout with sidebar
- Dashboard page with stats
- Navigation and header

---

## Files Created in Phase 2

```
prisma/
  schema.prisma (complete)
  seed.ts

src/lib/
  auth.ts
  auth-helpers.ts

src/types/
  next-auth.d.ts

src/middleware.ts

src/app/api/auth/[...nextauth]/
  route.ts

src/app/(auth)/
  layout.tsx
  login/page.tsx

src/components/providers/
  SessionProvider.tsx

src/app/layout.tsx (updated)
```
