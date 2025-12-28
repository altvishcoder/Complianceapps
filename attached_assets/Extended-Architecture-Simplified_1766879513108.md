# ComplianceAI™ Extended Architecture
## Simplified HACT-Aligned Data Model & Component Extraction

---

## Overview

This extension adds:
1. **HACT-aligned entity model** (Property → Unit → Component)
2. **Simple data import** (CSV/Excel for properties and assets)
3. **Enhanced AI extraction** (extract components/assets from certificates)
4. **Component-level compliance tracking**
5. **Regulatory reports** (TSM metrics, Building Safety, without tenant data)

```
SIMPLIFIED ARCHITECTURE:

┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐ │
│  │ CSV/Excel   │    │ New Build   │    │ Compliance Certificates │ │
│  │ Import      │    │ Handover    │    │ (Gas, EICR, Fire, etc.) │ │
│  │             │    │ Documents   │    │                         │ │
│  │ Properties  │    │             │    │                         │ │
│  │ Units       │    │ Extracts:   │    │ Extracts:               │ │
│  │ Assets      │    │ • Components│    │ • Inspection dates      │ │
│  └──────┬──────┘    │ • Install   │    │ • Expiry dates          │ │
│         │           │   dates     │    │ • Defects/observations  │ │
│         │           │ • Specs     │    │ • Component status      │ │
│         │           └──────┬──────┘    └───────────┬─────────────┘ │
│         │                  │                       │               │
│         └──────────────────┼───────────────────────┘               │
│                            ▼                                        │
├─────────────────────────────────────────────────────────────────────┤
│                     COMPLIANCEAI CORE                               │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                                                                 │ │
│  │   Property ──┬── Unit ──┬── Component ──── ComplianceRecord    │ │
│  │              │          │                                       │ │
│  │   (UPRN,     │  (Flat,  │  (Boiler,        (Status, Expiry,    │ │
│  │    Address)  │   House) │   Alarm, etc.)    Defects)           │ │
│  │              │          │                                       │ │
│  └──────────────┴──────────┴───────────────────────────────────────┘ │
│                            │                                        │
│                            ▼                                        │
├─────────────────────────────────────────────────────────────────────┤
│                        OUTPUTS                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐│
│  │  Compliance  │  │  Remedial    │  │  Regulatory Reports        ││
│  │  Dashboard   │  │  Actions     │  │  • TSM Metrics (TP02-TP05) ││
│  │              │  │  Tracking    │  │  • Building Safety         ││
│  │  By Property │  │              │  │  • Gas/EICR Compliance     ││
│  │  By Component│  │  Priorities  │  │  • Awaab's Law             ││
│  │  By Stream   │  │  Due Dates   │  │                            ││
│  └──────────────┘  └──────────────┘  └────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase E1: Extended Data Model (Day 1)

### Prompt E1.1: Extend Prisma Schema

```
Extend the Prisma schema to add HACT-aligned Unit and Component models.

Update prisma/schema.prisma - add after the Property model:

// ==========================================
// HACT-ALIGNED UNIT MODEL
// ==========================================

model Unit {
  id              String       @id @default(cuid())
  organisationId  String
  propertyId      String
  unitRef         String       // Unique unit reference (e.g., Flat 1, Unit A)
  uprn            String?      // Unit-specific UPRN if different from property
  unitType        UnitType     @default(FLAT)
  floorLevel      Int?         // Ground = 0, Basement = -1
  bedrooms        Int?
  heatingType     HeatingType?
  epcRating       String?      // A-G
  epcExpiryDate   DateTime?
  isVoid          Boolean      @default(false)
  status          UnitStatus   @default(ACTIVE)
  metadata        Json         @default("{}")
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  organisation      Organisation       @relation(fields: [organisationId], references: [id])
  property          Property           @relation(fields: [propertyId], references: [id])
  components        Component[]
  certificates      Certificate[]
  complianceRecords ComplianceRecord[]
  remedialActions   RemedialAction[]

  @@unique([organisationId, unitRef])
  @@index([propertyId])
  @@index([organisationId, status])
}

enum UnitType {
  FLAT
  HOUSE
  BUNGALOW
  MAISONETTE
  BEDSIT
  ROOM
  STUDIO
  OTHER
}

enum UnitStatus {
  ACTIVE
  VOID
  SOLD
  DEMOLISHED
  OTHER
}

enum HeatingType {
  GAS_CENTRAL
  ELECTRIC
  DISTRICT
  OIL
  LPG
  HEAT_PUMP
  SOLID_FUEL
  NONE
  UNKNOWN
}

// ==========================================
// HACT-ALIGNED COMPONENT/ASSET MODEL
// ==========================================

model Component {
  id                String            @id @default(cuid())
  organisationId    String
  propertyId        String?           // Building-level components (lifts, communal boilers)
  unitId            String?           // Unit-level components (boilers, alarms)
  componentRef      String            // Unique component reference
  componentType     ComponentType
  location          String?           // e.g., "Kitchen", "Hallway", "Plant Room"
  manufacturer      String?
  model             String?
  serialNumber      String?
  installedDate     DateTime?
  warrantyExpiry    DateTime?
  expectedLifeYears Int?
  condition         ComponentCondition @default(UNKNOWN)
  status            ComponentStatus    @default(IN_SERVICE)
  lastInspected     DateTime?
  nextInspectionDue DateTime?
  notes             String?
  metadata          Json              @default("{}")
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  organisation      Organisation       @relation(fields: [organisationId], references: [id])
  property          Property?          @relation(fields: [propertyId], references: [id])
  unit              Unit?              @relation(fields: [unitId], references: [id])
  certificates      Certificate[]
  complianceRecords ComplianceRecord[]
  remedialActions   RemedialAction[]

  @@unique([organisationId, componentRef])
  @@index([propertyId])
  @@index([unitId])
  @@index([componentType])
  @@index([status])
  @@index([nextInspectionDue])
}

enum ComponentType {
  // Heating & Hot Water
  BOILER
  WATER_HEATER
  HEAT_PUMP
  RADIATOR
  // Safety Devices
  SMOKE_ALARM
  CO_ALARM
  HEAT_DETECTOR
  FIRE_DOOR
  FIRE_EXTINGUISHER
  EMERGENCY_LIGHTING
  // Electrical
  CONSUMER_UNIT
  ELECTRICAL_INSTALLATION
  // Lifts & Access
  LIFT
  STAIRLIFT
  DOOR_ENTRY
  // Water Systems
  WATER_TANK
  TMV_VALVE
  // Ventilation
  EXTRACTOR_FAN
  MVHR
  // Other
  EV_CHARGER
  SOLAR_PANEL
  OTHER
}

enum ComponentCondition {
  EXCELLENT
  GOOD
  FAIR
  POOR
  CRITICAL
  UNKNOWN
}

enum ComponentStatus {
  IN_SERVICE
  OUT_OF_SERVICE
  AWAITING_REPAIR
  AWAITING_REPLACEMENT
  DECOMMISSIONED
  REMOVED
}

// ==========================================
// UPDATE EXISTING MODELS FOR HIERARCHY
// ==========================================

Update Property model - add relation:
  units             Unit[]
  components        Component[]

Update Certificate model - add optional links:
  unitId            String?
  componentId       String?
  
  unit              Unit?       @relation(fields: [unitId], references: [id])
  component         Component?  @relation(fields: [componentId], references: [id])

Update ComplianceRecord model - add optional links:
  unitId            String?
  componentId       String?
  
  unit              Unit?       @relation(fields: [unitId], references: [id])
  component         Component?  @relation(fields: [componentId], references: [id])

Update RemedialAction model - add optional links:
  unitId            String?
  componentId       String?
  
  unit              Unit?       @relation(fields: [unitId], references: [id])
  component         Component?  @relation(fields: [componentId], references: [id])

// ==========================================
// DATA IMPORT TRACKING
// ==========================================

model DataImport {
  id              String       @id @default(cuid())
  organisationId  String
  importType      ImportType
  filename        String
  status          ImportStatus @default(PENDING)
  totalRows       Int          @default(0)
  processedRows   Int          @default(0)
  successRows     Int          @default(0)
  errorRows       Int          @default(0)
  errors          Json         @default("[]")
  uploadedById    String
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime     @default(now())

  organisation Organisation @relation(fields: [organisationId], references: [id])
  uploadedBy   User         @relation(fields: [uploadedById], references: [id])

  @@index([organisationId])
  @@index([status])
}

enum ImportType {
  PROPERTIES
  UNITS
  COMPONENTS
  COMBINED    // Properties + Units + Components in one file
}

enum ImportStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  PARTIAL
}

Run migration:
npx prisma migrate dev --name add-units-components
npx prisma generate
```

---

## Phase E2: Data Import (Day 2)

### Prompt E2.1: Import Template Generator

```
Create an API to generate import templates.

Create src/lib/import/templates.ts:

export interface ImportTemplate {
  name: string;
  description: string;
  columns: ColumnDef[];
}

interface ColumnDef {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum';
  enumValues?: string[];
  description: string;
  example: string;
}

export const IMPORT_TEMPLATES: Record<string, ImportTemplate> = {
  PROPERTIES: {
    name: 'Properties Import',
    description: 'Import properties with optional units',
    columns: [
      { name: 'uprn', required: true, type: 'string', description: 'Unique Property Reference Number', example: '100023456789' },
      { name: 'address_line_1', required: true, type: 'string', description: 'First line of address', example: '123 High Street' },
      { name: 'address_line_2', required: false, type: 'string', description: 'Second line (optional)', example: 'Flat 4B' },
      { name: 'city', required: true, type: 'string', description: 'City/Town', example: 'London' },
      { name: 'postcode', required: true, type: 'string', description: 'Postcode', example: 'SW1A 1AA' },
      { name: 'property_type', required: false, type: 'enum', enumValues: ['HOUSE', 'FLAT', 'BUNGALOW', 'MAISONETTE', 'BEDSIT', 'OTHER'], description: 'Property type', example: 'FLAT' },
      { name: 'bedrooms', required: false, type: 'number', description: 'Number of bedrooms', example: '2' },
      { name: 'year_built', required: false, type: 'number', description: 'Year of construction', example: '1985' },
      { name: 'storeys', required: false, type: 'number', description: 'Number of storeys', example: '4' },
      { name: 'heating_type', required: false, type: 'enum', enumValues: ['GAS_CENTRAL', 'ELECTRIC', 'DISTRICT', 'OIL', 'LPG', 'HEAT_PUMP', 'NONE'], description: 'Heating type', example: 'GAS_CENTRAL' },
    ],
  },
  
  UNITS: {
    name: 'Units Import',
    description: 'Import units/dwellings linked to existing properties',
    columns: [
      { name: 'property_uprn', required: true, type: 'string', description: 'Parent property UPRN', example: '100023456789' },
      { name: 'unit_ref', required: true, type: 'string', description: 'Unique unit reference', example: 'FLAT-1' },
      { name: 'unit_uprn', required: false, type: 'string', description: 'Unit-specific UPRN', example: '100023456790' },
      { name: 'unit_type', required: false, type: 'enum', enumValues: ['FLAT', 'HOUSE', 'BUNGALOW', 'MAISONETTE', 'BEDSIT', 'ROOM', 'STUDIO'], description: 'Unit type', example: 'FLAT' },
      { name: 'floor_level', required: false, type: 'number', description: 'Floor level (0=ground)', example: '2' },
      { name: 'bedrooms', required: false, type: 'number', description: 'Number of bedrooms', example: '1' },
      { name: 'heating_type', required: false, type: 'enum', enumValues: ['GAS_CENTRAL', 'ELECTRIC', 'DISTRICT', 'OIL', 'LPG', 'HEAT_PUMP', 'NONE'], description: 'Heating type', example: 'GAS_CENTRAL' },
      { name: 'epc_rating', required: false, type: 'string', description: 'EPC rating (A-G)', example: 'C' },
      { name: 'is_void', required: false, type: 'boolean', description: 'Is property void?', example: 'false' },
    ],
  },
  
  COMPONENTS: {
    name: 'Components/Assets Import',
    description: 'Import components linked to properties or units',
    columns: [
      { name: 'property_uprn', required: true, type: 'string', description: 'Property UPRN', example: '100023456789' },
      { name: 'unit_ref', required: false, type: 'string', description: 'Unit reference (if unit-level)', example: 'FLAT-1' },
      { name: 'component_ref', required: true, type: 'string', description: 'Unique component reference', example: 'BOILER-001' },
      { name: 'component_type', required: true, type: 'enum', enumValues: ['BOILER', 'WATER_HEATER', 'HEAT_PUMP', 'SMOKE_ALARM', 'CO_ALARM', 'FIRE_DOOR', 'CONSUMER_UNIT', 'LIFT', 'EXTRACTOR_FAN', 'OTHER'], description: 'Component type', example: 'BOILER' },
      { name: 'location', required: false, type: 'string', description: 'Location within property/unit', example: 'Kitchen' },
      { name: 'manufacturer', required: false, type: 'string', description: 'Manufacturer name', example: 'Worcester Bosch' },
      { name: 'model', required: false, type: 'string', description: 'Model number', example: 'Greenstar 8000' },
      { name: 'serial_number', required: false, type: 'string', description: 'Serial number', example: 'WB123456789' },
      { name: 'installed_date', required: false, type: 'date', description: 'Installation date (YYYY-MM-DD)', example: '2020-06-15' },
      { name: 'warranty_expiry', required: false, type: 'date', description: 'Warranty expiry date', example: '2025-06-15' },
      { name: 'condition', required: false, type: 'enum', enumValues: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'], description: 'Current condition', example: 'GOOD' },
      { name: 'status', required: false, type: 'enum', enumValues: ['IN_SERVICE', 'OUT_OF_SERVICE', 'AWAITING_REPAIR', 'DECOMMISSIONED'], description: 'Current status', example: 'IN_SERVICE' },
    ],
  },
};

export function generateCSVTemplate(templateType: keyof typeof IMPORT_TEMPLATES): string {
  const template = IMPORT_TEMPLATES[templateType];
  const headers = template.columns.map(c => c.name).join(',');
  const examples = template.columns.map(c => c.example).join(',');
  return `${headers}\n${examples}`;
}

export function generateExcelHeaders(templateType: keyof typeof IMPORT_TEMPLATES): string[] {
  return IMPORT_TEMPLATES[templateType].columns.map(c => c.name);
}
```

### Prompt E2.2: Import Processing Service

```
Create the import processing service.

Create src/lib/import/processor.ts:

import { prisma } from '@/lib/db';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

interface ImportResult {
  success: boolean;
  processed: number;
  created: number;
  updated: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

export async function processImport(
  organisationId: string,
  importType: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<ImportResult> {
  // Parse file
  const rows = parseFile(fileBuffer, mimeType);
  
  const result: ImportResult = {
    success: true,
    processed: 0,
    created: 0,
    updated: 0,
    errors: [],
  };
  
  switch (importType) {
    case 'PROPERTIES':
      await processPropertyImport(organisationId, rows, result);
      break;
    case 'UNITS':
      await processUnitImport(organisationId, rows, result);
      break;
    case 'COMPONENTS':
      await processComponentImport(organisationId, rows, result);
      break;
    default:
      throw new Error(`Unknown import type: ${importType}`);
  }
  
  result.success = result.errors.length === 0;
  return result;
}

function parseFile(buffer: Buffer, mimeType: string): Record<string, any>[] {
  if (mimeType === 'text/csv' || mimeType === 'application/csv') {
    return parse(buffer.toString(), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  }
  
  // Excel
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet);
}

async function processPropertyImport(
  organisationId: string,
  rows: Record<string, any>[],
  result: ImportResult
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    result.processed++;
    
    try {
      // Validate required fields
      if (!row.uprn) {
        result.errors.push({ row: i + 2, field: 'uprn', message: 'UPRN is required' });
        continue;
      }
      if (!row.address_line_1) {
        result.errors.push({ row: i + 2, field: 'address_line_1', message: 'Address is required' });
        continue;
      }
      
      // Upsert property
      const existing = await prisma.property.findUnique({
        where: { organisationId_uprn: { organisationId, uprn: row.uprn } },
      });
      
      const data = {
        organisationId,
        uprn: row.uprn,
        addressLine1: row.address_line_1,
        addressLine2: row.address_line_2 || null,
        city: row.city || '',
        postcode: row.postcode || '',
        propertyType: row.property_type || 'OTHER',
        bedrooms: row.bedrooms ? parseInt(row.bedrooms) : null,
        yearBuilt: row.year_built ? parseInt(row.year_built) : null,
        storeys: row.storeys ? parseInt(row.storeys) : null,
      };
      
      if (existing) {
        await prisma.property.update({
          where: { id: existing.id },
          data,
        });
        result.updated++;
      } else {
        await prisma.property.create({ data });
        result.created++;
      }
    } catch (error) {
      result.errors.push({
        row: i + 2,
        field: 'general',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

async function processUnitImport(
  organisationId: string,
  rows: Record<string, any>[],
  result: ImportResult
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    result.processed++;
    
    try {
      // Find parent property
      const property = await prisma.property.findUnique({
        where: { organisationId_uprn: { organisationId, uprn: row.property_uprn } },
      });
      
      if (!property) {
        result.errors.push({
          row: i + 2,
          field: 'property_uprn',
          message: `Property not found: ${row.property_uprn}`,
        });
        continue;
      }
      
      // Upsert unit
      const existing = await prisma.unit.findUnique({
        where: { organisationId_unitRef: { organisationId, unitRef: row.unit_ref } },
      });
      
      const data = {
        organisationId,
        propertyId: property.id,
        unitRef: row.unit_ref,
        uprn: row.unit_uprn || null,
        unitType: row.unit_type || 'FLAT',
        floorLevel: row.floor_level ? parseInt(row.floor_level) : null,
        bedrooms: row.bedrooms ? parseInt(row.bedrooms) : null,
        heatingType: row.heating_type || null,
        epcRating: row.epc_rating || null,
        isVoid: row.is_void === 'true' || row.is_void === true,
      };
      
      if (existing) {
        await prisma.unit.update({ where: { id: existing.id }, data });
        result.updated++;
      } else {
        await prisma.unit.create({ data });
        result.created++;
      }
    } catch (error) {
      result.errors.push({
        row: i + 2,
        field: 'general',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

async function processComponentImport(
  organisationId: string,
  rows: Record<string, any>[],
  result: ImportResult
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    result.processed++;
    
    try {
      // Find parent property
      const property = await prisma.property.findUnique({
        where: { organisationId_uprn: { organisationId, uprn: row.property_uprn } },
      });
      
      if (!property) {
        result.errors.push({
          row: i + 2,
          field: 'property_uprn',
          message: `Property not found: ${row.property_uprn}`,
        });
        continue;
      }
      
      // Find unit if specified
      let unitId = null;
      if (row.unit_ref) {
        const unit = await prisma.unit.findUnique({
          where: { organisationId_unitRef: { organisationId, unitRef: row.unit_ref } },
        });
        if (unit) {
          unitId = unit.id;
        }
      }
      
      // Upsert component
      const existing = await prisma.component.findUnique({
        where: { organisationId_componentRef: { organisationId, componentRef: row.component_ref } },
      });
      
      const data = {
        organisationId,
        propertyId: property.id,
        unitId,
        componentRef: row.component_ref,
        componentType: row.component_type,
        location: row.location || null,
        manufacturer: row.manufacturer || null,
        model: row.model || null,
        serialNumber: row.serial_number || null,
        installedDate: row.installed_date ? new Date(row.installed_date) : null,
        warrantyExpiry: row.warranty_expiry ? new Date(row.warranty_expiry) : null,
        condition: row.condition || 'UNKNOWN',
        status: row.status || 'IN_SERVICE',
      };
      
      if (existing) {
        await prisma.component.update({ where: { id: existing.id }, data });
        result.updated++;
      } else {
        await prisma.component.create({ data });
        result.created++;
      }
    } catch (error) {
      result.errors.push({
        row: i + 2,
        field: 'general',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

Install dependencies:
npm install csv-parse xlsx
```

### Prompt E2.3: Import API Routes

```
Create the import API endpoints.

Create src/app/api/import/template/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { IMPORT_TEMPLATES, generateCSVTemplate } from '@/lib/import/templates';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    const templateType = request.nextUrl.searchParams.get('type') as keyof typeof IMPORT_TEMPLATES;
    
    if (!templateType || !IMPORT_TEMPLATES[templateType]) {
      return NextResponse.json({ error: 'Invalid template type' }, { status: 400 });
    }
    
    const csv = generateCSVTemplate(templateType);
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${templateType.toLowerCase()}-template.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}

Create src/app/api/import/upload/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { processImport } from '@/lib/import/processor';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const importType = formData.get('importType') as string;
    
    if (!file || !importType) {
      return NextResponse.json(
        { error: 'File and import type are required' },
        { status: 400 }
      );
    }
    
    // Create import record
    const dataImport = await prisma.dataImport.create({
      data: {
        organisationId: orgId,
        importType: importType as any,
        filename: file.name,
        status: 'PROCESSING',
        uploadedById: session.user.id,
        startedAt: new Date(),
      },
    });
    
    // Process file
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await processImport(orgId, importType, buffer, file.type);
    
    // Update import record
    await prisma.dataImport.update({
      where: { id: dataImport.id },
      data: {
        status: result.success ? 'COMPLETED' : 'PARTIAL',
        totalRows: result.processed,
        processedRows: result.processed,
        successRows: result.created + result.updated,
        errorRows: result.errors.length,
        errors: result.errors as any,
        completedAt: new Date(),
      },
    });
    
    return NextResponse.json({
      importId: dataImport.id,
      ...result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## Phase E3: Enhanced AI Extraction (Day 3)

### Prompt E3.1: Component Extraction Prompts

```
Create enhanced extraction prompts that capture component/asset data.

Update src/lib/ai/extractor.ts:

// Add component extraction prompts

const EXTRACTION_PROMPTS: Record<string, string> = {
  GAS: `Extract the following from this Gas Safety Certificate (CP12/LGSR):

CERTIFICATE DETAILS:
- Certificate/report number
- Inspection date (YYYY-MM-DD)
- Next due date (YYYY-MM-DD)
- Overall outcome (PASS or FAIL)

ENGINEER & CONTRACTOR:
- Engineer name
- Gas Safe registration number
- Contractor/company name
- Contractor Gas Safe number

PROPERTY:
- Full property address
- UPRN if shown

APPLIANCES/COMPONENTS (list each one):
For each gas appliance found:
- Appliance type (BOILER, FIRE, COOKER, HOB, WATER_HEATER)
- Location (e.g., Kitchen, Utility Room)
- Make/Manufacturer
- Model
- Flue type
- Result (PASS/FAIL/NOT TESTED)
- Any defects or observations

DEFECTS:
- List any defects with classification (ID=Immediately Dangerous, AR=At Risk, NCS=Not to Current Standard)
- Remedial actions required

Return as JSON with structure:
{
  "certificateNumber": "",
  "inspectionDate": "",
  "nextDueDate": "",
  "outcome": "",
  "engineerName": "",
  "engineerGasSafeId": "",
  "contractor": "",
  "contractorGasSafeId": "",
  "propertyAddress": "",
  "uprn": "",
  "appliances": [
    {
      "type": "",
      "location": "",
      "manufacturer": "",
      "model": "",
      "flueType": "",
      "result": "",
      "defects": []
    }
  ],
  "defects": [
    {
      "description": "",
      "classification": "",
      "action": "",
      "priority": ""
    }
  ]
}`,

  ELECTRICAL: `Extract the following from this Electrical Installation Condition Report (EICR):

REPORT DETAILS:
- Report reference number
- Date of inspection (YYYY-MM-DD)
- Next inspection due (YYYY-MM-DD)
- Overall assessment (SATISFACTORY or UNSATISFACTORY)

INSPECTOR & CONTRACTOR:
- Inspector name
- Registration scheme (NICEIC, NAPIT, etc.)
- Registration number
- Contractor name

PROPERTY:
- Full property address
- UPRN if shown

INSTALLATION DETAILS:
- Consumer unit location
- Consumer unit make/model
- Number of circuits
- Type of earthing system (TN-C-S, TN-S, TT)
- Age of installation if known

OBSERVATIONS (list each one):
For each observation:
- Code (C1, C2, C3, FI)
- Circuit/location
- Description
- Recommended action

Return as JSON with structure:
{
  "reportReference": "",
  "inspectionDate": "",
  "nextDueDate": "",
  "outcome": "",
  "inspectorName": "",
  "registrationScheme": "",
  "registrationNumber": "",
  "contractor": "",
  "propertyAddress": "",
  "uprn": "",
  "consumerUnit": {
    "location": "",
    "manufacturer": "",
    "model": "",
    "circuits": 0
  },
  "earthingSystem": "",
  "installationAge": "",
  "observations": [
    {
      "code": "",
      "circuit": "",
      "location": "",
      "description": "",
      "action": ""
    }
  ]
}`,

  FIRE: `Extract the following from this Fire Risk Assessment:

ASSESSMENT DETAILS:
- Assessment reference
- Assessment date (YYYY-MM-DD)
- Next review date (YYYY-MM-DD)
- Overall risk rating (Trivial, Tolerable, Moderate, Substantial, Intolerable)

ASSESSOR:
- Assessor name
- Qualifications
- Company name

PROPERTY:
- Property address
- Property type (Block of flats, House, etc.)
- Number of storeys
- Number of units

FIRE SAFETY EQUIPMENT (list each):
For each item found:
- Equipment type (FIRE_DOOR, FIRE_EXTINGUISHER, SMOKE_ALARM, EMERGENCY_LIGHTING, etc.)
- Location
- Condition (Good, Fair, Poor)
- Last tested date if shown
- Notes

SIGNIFICANT FINDINGS:
- List all fire risks identified
- Priority (High, Medium, Low)
- Recommended action
- Target date

Return as JSON with structure:
{
  "assessmentReference": "",
  "assessmentDate": "",
  "nextReviewDate": "",
  "riskRating": "",
  "assessorName": "",
  "assessorQualifications": "",
  "contractor": "",
  "propertyAddress": "",
  "propertyType": "",
  "storeys": 0,
  "units": 0,
  "equipment": [
    {
      "type": "",
      "location": "",
      "condition": "",
      "lastTested": "",
      "notes": ""
    }
  ],
  "findings": [
    {
      "description": "",
      "priority": "",
      "action": "",
      "targetDate": ""
    }
  ]
}`,

  NEW_BUILD: `Extract the following from this New Build Handover/Completion Document:

PROPERTY DETAILS:
- Property address
- UPRN
- Plot number
- Property type (House, Flat, etc.)
- Number of bedrooms
- Number of storeys/floor level

CONSTRUCTION:
- Construction type (Traditional, Timber Frame, etc.)
- Developer name
- Build completion date
- Warranty provider (NHBC, Premier, etc.)
- Warranty number

COMPONENTS/INSTALLATIONS (list each):
For each component/system installed:
- Component type (BOILER, CONSUMER_UNIT, SMOKE_ALARM, etc.)
- Location
- Manufacturer
- Model
- Serial number
- Installation date
- Warranty expiry

CERTIFICATES PROVIDED:
List all certificates included in handover pack

Return as JSON with structure:
{
  "propertyAddress": "",
  "uprn": "",
  "plotNumber": "",
  "propertyType": "",
  "bedrooms": 0,
  "storeys": 0,
  "constructionType": "",
  "developer": "",
  "completionDate": "",
  "warrantyProvider": "",
  "warrantyNumber": "",
  "components": [
    {
      "type": "",
      "location": "",
      "manufacturer": "",
      "model": "",
      "serialNumber": "",
      "installedDate": "",
      "warrantyExpiry": ""
    }
  ],
  "certificates": []
}`,
};
```

### Prompt E3.2: Component Linking Logic

```
Create service to link extracted components to properties/units.

Create src/lib/ai/component-linker.ts:

import { prisma } from '@/lib/db';

interface ExtractedComponent {
  type: string;
  location?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installedDate?: string;
  warrantyExpiry?: string;
  condition?: string;
  result?: string;
  defects?: any[];
}

export async function linkExtractedComponents(
  organisationId: string,
  propertyId: string,
  unitId: string | null,
  components: ExtractedComponent[],
  certificateId: string
): Promise<string[]> {
  const linkedComponentIds: string[] = [];
  
  for (const comp of components) {
    // Map extracted type to ComponentType enum
    const componentType = mapComponentType(comp.type);
    if (!componentType) continue;
    
    // Generate a component reference
    const componentRef = generateComponentRef(
      propertyId,
      unitId,
      componentType,
      comp.serialNumber
    );
    
    // Try to find existing component
    let component = await prisma.component.findFirst({
      where: {
        organisationId,
        OR: [
          { componentRef },
          { serialNumber: comp.serialNumber || undefined },
        ],
      },
    });
    
    const componentData = {
      organisationId,
      propertyId,
      unitId,
      componentRef,
      componentType,
      location: comp.location || null,
      manufacturer: comp.manufacturer || null,
      model: comp.model || null,
      serialNumber: comp.serialNumber || null,
      installedDate: comp.installedDate ? new Date(comp.installedDate) : null,
      warrantyExpiry: comp.warrantyExpiry ? new Date(comp.warrantyExpiry) : null,
      condition: mapCondition(comp.condition || comp.result),
      status: comp.result === 'FAIL' ? 'AWAITING_REPAIR' : 'IN_SERVICE',
      lastInspected: new Date(),
    };
    
    if (component) {
      // Update existing component
      component = await prisma.component.update({
        where: { id: component.id },
        data: componentData,
      });
    } else {
      // Create new component
      component = await prisma.component.create({
        data: componentData,
      });
    }
    
    linkedComponentIds.push(component.id);
    
    // Link certificate to component
    await prisma.certificate.update({
      where: { id: certificateId },
      data: { componentId: component.id },
    });
  }
  
  return linkedComponentIds;
}

function mapComponentType(extractedType: string): string | null {
  const typeMap: Record<string, string> = {
    'BOILER': 'BOILER',
    'FIRE': 'OTHER', // Gas fire
    'COOKER': 'OTHER',
    'HOB': 'OTHER',
    'WATER_HEATER': 'WATER_HEATER',
    'CONSUMER_UNIT': 'CONSUMER_UNIT',
    'SMOKE_ALARM': 'SMOKE_ALARM',
    'CO_ALARM': 'CO_ALARM',
    'FIRE_DOOR': 'FIRE_DOOR',
    'FIRE_EXTINGUISHER': 'FIRE_EXTINGUISHER',
    'EMERGENCY_LIGHTING': 'EMERGENCY_LIGHTING',
    'EXTRACTOR_FAN': 'EXTRACTOR_FAN',
    'HEAT_PUMP': 'HEAT_PUMP',
    'LIFT': 'LIFT',
  };
  
  return typeMap[extractedType?.toUpperCase()] || null;
}

function mapCondition(result?: string): string {
  if (!result) return 'UNKNOWN';
  const r = result.toUpperCase();
  if (r === 'PASS' || r === 'GOOD' || r === 'SATISFACTORY') return 'GOOD';
  if (r === 'FAIR') return 'FAIR';
  if (r === 'POOR' || r === 'FAIL' || r === 'UNSATISFACTORY') return 'POOR';
  return 'UNKNOWN';
}

function generateComponentRef(
  propertyId: string,
  unitId: string | null,
  componentType: string,
  serialNumber?: string
): string {
  const base = unitId ? unitId.slice(-6) : propertyId.slice(-6);
  const serial = serialNumber?.slice(-4) || Math.random().toString(36).slice(-4).toUpperCase();
  return `${componentType}-${base}-${serial}`;
}
```

### Prompt E3.3: Update Process API to Extract Components

```
Update the certificate processing to extract and link components.

Update src/app/api/certificates/[id]/process/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { getFile } from '@/lib/storage';
import { extractFromDocument } from '@/lib/ai/extractor';
import { linkExtractedComponents } from '@/lib/ai/component-linker';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const certificate = await prisma.certificate.findFirst({
      where: { id: params.id, organisationId: orgId },
      include: { complianceStream: true },
    });
    
    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }
    
    await prisma.certificate.update({
      where: { id: params.id },
      data: { processingStatus: 'PROCESSING' },
    });
    
    try {
      const fileBuffer = await getFile(certificate.storagePath);
      
      const result = await extractFromDocument(
        fileBuffer,
        certificate.mimeType,
        certificate.complianceStream.code
      );
      
      // Store extraction
      await prisma.extraction.create({
        data: {
          certificateId: params.id,
          rawResponse: result.rawResponse as any,
          extractedData: result.data as any,
          confidence: result.confidence,
          status: result.confidence >= 0.9 ? 'AUTO_APPROVED' : 'PENDING_REVIEW',
        },
      });
      
      // Extract and link components if present
      const components = result.data.appliances || 
                         result.data.components || 
                         result.data.equipment || [];
      
      if (components.length > 0) {
        await linkExtractedComponents(
          orgId,
          certificate.propertyId!,
          certificate.unitId,
          components,
          certificate.id
        );
      }
      
      // Create remedial actions for defects
      const defects = result.data.defects || 
                      result.data.findings ||
                      result.data.observations?.filter((o: any) => o.code === 'C1' || o.code === 'C2') ||
                      [];
      
      for (const defect of defects) {
        await prisma.remedialAction.create({
          data: {
            organisationId: orgId,
            propertyId: certificate.propertyId!,
            unitId: certificate.unitId,
            description: defect.description || defect.action || 'Remedial action required',
            priority: mapDefectPriority(defect.classification || defect.code || defect.priority),
            source: 'EXTRACTION',
            dueDate: calculateDueDate(defect.classification || defect.code || defect.priority),
          },
        });
      }
      
      await prisma.certificate.update({
        where: { id: params.id },
        data: {
          processingStatus: result.confidence >= 0.9 ? 'COMPLETED' : 'REVIEW_REQUIRED',
          processingTier: result.tier,
          processingCost: result.cost,
        },
      });
      
      return NextResponse.json({
        extraction: result.data,
        confidence: result.confidence,
        componentsLinked: components.length,
        defectsFound: defects.length,
      });
      
    } catch (processingError) {
      await prisma.certificate.update({
        where: { id: params.id },
        data: { processingStatus: 'FAILED' },
      });
      throw processingError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

function mapDefectPriority(classification: string): string {
  const map: Record<string, string> = {
    'ID': 'EMERGENCY',
    'C1': 'EMERGENCY',
    'AR': 'URGENT',
    'C2': 'URGENT',
    'NCS': 'ROUTINE',
    'C3': 'ROUTINE',
    'HIGH': 'URGENT',
    'MEDIUM': 'ROUTINE',
    'LOW': 'ROUTINE',
  };
  return map[classification?.toUpperCase()] || 'ROUTINE';
}

function calculateDueDate(classification: string): Date {
  const days: Record<string, number> = {
    'ID': 0,
    'C1': 0,
    'EMERGENCY': 0,
    'AR': 7,
    'C2': 7,
    'URGENT': 7,
    'NCS': 28,
    'C3': 28,
    'ROUTINE': 28,
  };
  const d = days[classification?.toUpperCase()] ?? 28;
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000);
}
```

---

## Phase E4: Regulatory Reports (Day 4)

### Prompt E4.1: Report Definitions

```
Create report definitions for regulatory compliance.

Create src/lib/reports/definitions.ts:

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  category: 'TSM' | 'BUILDING_SAFETY' | 'COMPLIANCE' | 'OPERATIONAL';
  metrics: ReportMetric[];
}

export interface ReportMetric {
  code: string;
  name: string;
  description: string;
  calculation: 'count' | 'percentage' | 'average' | 'sum';
  query: string; // Will be converted to Prisma query
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: 'tsm-repairs',
    name: 'TSM Repairs Metrics',
    description: 'Tenant Satisfaction Measures for repairs (TP02, TP03)',
    category: 'TSM',
    metrics: [
      {
        code: 'BS01',
        name: 'Homes with valid gas safety certificate',
        description: 'Proportion of homes with valid gas certificate (where gas is supplied)',
        calculation: 'percentage',
        query: 'gasCompliance',
      },
      {
        code: 'BS02',
        name: 'Homes with valid EICR',
        description: 'Proportion of homes with valid electrical installation certificate',
        calculation: 'percentage',
        query: 'electricalCompliance',
      },
      {
        code: 'BS03',
        name: 'Homes with valid fire risk assessment',
        description: 'Proportion of buildings with valid fire risk assessment',
        calculation: 'percentage',
        query: 'fireCompliance',
      },
      {
        code: 'BS05',
        name: 'Homes with valid smoke alarms',
        description: 'Proportion of homes with working smoke alarms',
        calculation: 'percentage',
        query: 'smokeAlarmCompliance',
      },
      {
        code: 'BS06',
        name: 'Homes with valid CO alarms',
        description: 'Proportion of homes with CO alarms (where required)',
        calculation: 'percentage',
        query: 'coAlarmCompliance',
      },
    ],
  },
  {
    id: 'building-safety',
    name: 'Building Safety Report',
    description: 'Building Safety Act compliance for HRBs',
    category: 'BUILDING_SAFETY',
    metrics: [
      {
        code: 'HRB01',
        name: 'Higher Risk Buildings',
        description: 'Count of buildings 18m+ or 7+ storeys',
        calculation: 'count',
        query: 'higherRiskBuildings',
      },
      {
        code: 'HRB02',
        name: 'HRB Gas Compliance',
        description: 'HRBs with valid gas certificates',
        calculation: 'percentage',
        query: 'hrbGasCompliance',
      },
      {
        code: 'HRB03',
        name: 'HRB Fire Safety',
        description: 'HRBs with valid FRA',
        calculation: 'percentage',
        query: 'hrbFireCompliance',
      },
    ],
  },
  {
    id: 'compliance-summary',
    name: 'Compliance Summary',
    description: 'Overview of all compliance streams',
    category: 'COMPLIANCE',
    metrics: [
      {
        code: 'COMP01',
        name: 'Overall Compliance Rate',
        description: 'Percentage of all properties compliant across all streams',
        calculation: 'percentage',
        query: 'overallCompliance',
      },
      {
        code: 'COMP02',
        name: 'Overdue Certificates',
        description: 'Count of overdue compliance items',
        calculation: 'count',
        query: 'overdueCount',
      },
      {
        code: 'COMP03',
        name: 'Outstanding Actions',
        description: 'Count of open remedial actions',
        calculation: 'count',
        query: 'openActionsCount',
      },
    ],
  },
];
```

### Prompt E4.2: Report Generator Service

```
Create the report generation service.

Create src/lib/reports/generator.ts:

import { prisma } from '@/lib/db';
import { REPORT_DEFINITIONS } from './definitions';

interface ReportResult {
  reportId: string;
  reportName: string;
  generatedAt: Date;
  period: { from: Date; to: Date };
  metrics: Array<{
    code: string;
    name: string;
    value: number;
    denominator?: number;
    percentage?: number;
  }>;
}

export async function generateReport(
  organisationId: string,
  reportId: string,
  periodFrom: Date,
  periodTo: Date
): Promise<ReportResult> {
  const definition = REPORT_DEFINITIONS.find(r => r.id === reportId);
  if (!definition) {
    throw new Error(`Report not found: ${reportId}`);
  }
  
  const metrics = [];
  
  for (const metric of definition.metrics) {
    const result = await executeMetricQuery(
      organisationId,
      metric.query,
      periodFrom,
      periodTo
    );
    metrics.push({
      code: metric.code,
      name: metric.name,
      ...result,
    });
  }
  
  return {
    reportId,
    reportName: definition.name,
    generatedAt: new Date(),
    period: { from: periodFrom, to: periodTo },
    metrics,
  };
}

async function executeMetricQuery(
  organisationId: string,
  queryName: string,
  from: Date,
  to: Date
): Promise<{ value: number; denominator?: number; percentage?: number }> {
  switch (queryName) {
    case 'gasCompliance':
      return await getStreamCompliance(organisationId, 'GAS');
      
    case 'electricalCompliance':
      return await getStreamCompliance(organisationId, 'ELECTRICAL');
      
    case 'fireCompliance':
      return await getStreamCompliance(organisationId, 'FIRE');
      
    case 'smokeAlarmCompliance':
      return await getComponentCompliance(organisationId, 'SMOKE_ALARM');
      
    case 'coAlarmCompliance':
      return await getComponentCompliance(organisationId, 'CO_ALARM');
      
    case 'higherRiskBuildings':
      const hrbCount = await prisma.property.count({
        where: { organisationId, isHigherRiskBuilding: true },
      });
      return { value: hrbCount };
      
    case 'hrbGasCompliance':
      return await getHRBStreamCompliance(organisationId, 'GAS');
      
    case 'hrbFireCompliance':
      return await getHRBStreamCompliance(organisationId, 'FIRE');
      
    case 'overallCompliance':
      return await getOverallCompliance(organisationId);
      
    case 'overdueCount':
      const overdue = await prisma.complianceRecord.count({
        where: {
          organisationId,
          status: { in: ['OVERDUE', 'NON_COMPLIANT'] },
        },
      });
      return { value: overdue };
      
    case 'openActionsCount':
      const actions = await prisma.remedialAction.count({
        where: {
          organisationId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      });
      return { value: actions };
      
    default:
      return { value: 0 };
  }
}

async function getStreamCompliance(
  organisationId: string,
  streamCode: string
): Promise<{ value: number; denominator: number; percentage: number }> {
  const stream = await prisma.complianceStream.findFirst({
    where: { code: streamCode },
  });
  
  if (!stream) return { value: 0, denominator: 0, percentage: 100 };
  
  const total = await prisma.complianceRecord.count({
    where: { organisationId, complianceStreamId: stream.id },
  });
  
  const compliant = await prisma.complianceRecord.count({
    where: {
      organisationId,
      complianceStreamId: stream.id,
      status: 'COMPLIANT',
    },
  });
  
  return {
    value: compliant,
    denominator: total,
    percentage: total > 0 ? Math.round((compliant / total) * 100 * 10) / 10 : 100,
  };
}

async function getComponentCompliance(
  organisationId: string,
  componentType: string
): Promise<{ value: number; denominator: number; percentage: number }> {
  const total = await prisma.component.count({
    where: { organisationId, componentType: componentType as any, status: 'IN_SERVICE' },
  });
  
  const compliant = await prisma.component.count({
    where: {
      organisationId,
      componentType: componentType as any,
      status: 'IN_SERVICE',
      condition: { in: ['EXCELLENT', 'GOOD', 'FAIR'] },
    },
  });
  
  return {
    value: compliant,
    denominator: total,
    percentage: total > 0 ? Math.round((compliant / total) * 100 * 10) / 10 : 100,
  };
}

async function getHRBStreamCompliance(
  organisationId: string,
  streamCode: string
): Promise<{ value: number; denominator: number; percentage: number }> {
  const stream = await prisma.complianceStream.findFirst({
    where: { code: streamCode },
  });
  
  if (!stream) return { value: 0, denominator: 0, percentage: 100 };
  
  const total = await prisma.complianceRecord.count({
    where: {
      organisationId,
      complianceStreamId: stream.id,
      property: { isHigherRiskBuilding: true },
    },
  });
  
  const compliant = await prisma.complianceRecord.count({
    where: {
      organisationId,
      complianceStreamId: stream.id,
      status: 'COMPLIANT',
      property: { isHigherRiskBuilding: true },
    },
  });
  
  return {
    value: compliant,
    denominator: total,
    percentage: total > 0 ? Math.round((compliant / total) * 100 * 10) / 10 : 100,
  };
}

async function getOverallCompliance(
  organisationId: string
): Promise<{ value: number; denominator: number; percentage: number }> {
  const total = await prisma.complianceRecord.count({
    where: { organisationId },
  });
  
  const compliant = await prisma.complianceRecord.count({
    where: { organisationId, status: 'COMPLIANT' },
  });
  
  return {
    value: compliant,
    denominator: total,
    percentage: total > 0 ? Math.round((compliant / total) * 100 * 10) / 10 : 100,
  };
}
```

### Prompt E4.3: Reports API

```
Create the reports API endpoint.

Create src/app/api/reports/generate/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { generateReport, REPORT_DEFINITIONS } from '@/lib/reports';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const searchParams = request.nextUrl.searchParams;
    const reportId = searchParams.get('report');
    const format = searchParams.get('format') || 'json';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    
    if (!reportId) {
      // Return list of available reports
      return NextResponse.json({
        reports: REPORT_DEFINITIONS.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
          category: r.category,
        })),
      });
    }
    
    const periodFrom = from ? new Date(from) : new Date(new Date().setFullYear(new Date().getFullYear() - 1));
    const periodTo = to ? new Date(to) : new Date();
    
    const result = await generateReport(orgId, reportId, periodFrom, periodTo);
    
    if (format === 'csv') {
      const csv = formatReportAsCSV(result);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${reportId}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

function formatReportAsCSV(result: any): string {
  const lines = [
    `Report: ${result.reportName}`,
    `Generated: ${result.generatedAt.toISOString()}`,
    `Period: ${result.period.from.toISOString()} to ${result.period.to.toISOString()}`,
    '',
    'Code,Metric,Value,Total,Percentage',
    ...result.metrics.map((m: any) =>
      `${m.code},"${m.name}",${m.value},${m.denominator || ''},${m.percentage || ''}`
    ),
  ];
  return lines.join('\n');
}
```

---

## Verification Checklist

```
□ Phase E1: Data Model
  - Unit model created
  - Component model created
  - History tables added
  - Migration runs successfully

□ Phase E2: Data Import
  - Template download works (CSV)
  - Property import works
  - Unit import works
  - Component import works
  - Errors reported clearly

□ Phase E3: Component Extraction
  - Gas certificate extracts appliances
  - EICR extracts consumer unit + observations
  - FRA extracts fire safety equipment
  - Components linked to properties/units
  - Defects create remedial actions

□ Phase E4: Reports
  - TSM metrics calculate correctly
  - Building Safety report works
  - Compliance summary accurate
  - CSV export works
```

---

## Files Created

```
prisma/
  schema.prisma (extended with Unit, Component, DataImport)

src/lib/import/
  templates.ts
  processor.ts

src/lib/ai/
  extractor.ts (updated prompts)
  component-linker.ts

src/lib/reports/
  definitions.ts
  generator.ts

src/app/api/import/
  template/route.ts
  upload/route.ts

src/app/api/reports/
  generate/route.ts
```
