# ComplianceAI™ Complete Build Guide
## Master Index & Phase Overview

---

## Overview

This document provides a complete, phased approach to building ComplianceAI™ - an AI-powered compliance management system for UK social housing. The build is split into:

- **Core Build Phases (1-6)**: Base application functionality
- **Extended Architecture (E1-E4)**: HACT-aligned data model, component extraction, regulatory reports

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COMPLIANCEAI™                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DATA INPUT                     PROCESSING                 OUTPUTS      │
│  ───────────                    ──────────                 ───────      │
│                                                                         │
│  ┌──────────────┐              ┌─────────────┐        ┌──────────────┐ │
│  │ CSV/Excel    │──────────────│             │        │ Compliance   │ │
│  │ Import       │              │             │        │ Dashboard    │ │
│  │              │              │  AI         │        │              │ │
│  │ • Properties │              │  Extraction │        │ • By Stream  │ │
│  │ • Units      │              │  (Claude)   │        │ • By Property│ │
│  │ • Components │              │             │        │ • By Unit    │ │
│  └──────────────┘              │             │        └──────────────┘ │
│                                │  • Dates    │                         │
│  ┌──────────────┐              │  • Defects  │        ┌──────────────┐ │
│  │ Certificate  │──────────────│  • Assets   │────────│ Remedial     │ │
│  │ Upload       │              │  • Status   │        │ Actions      │ │
│  │              │              │             │        │              │ │
│  │ • Gas (CP12) │              └─────────────┘        │ • Priority   │ │
│  │ • EICR       │                    │                │ • Due Dates  │ │
│  │ • FRA        │                    │                │ • Tracking   │ │
│  │ • New Build  │                    ▼                └──────────────┘ │
│  │ • EPC        │              ┌─────────────┐                         │
│  └──────────────┘              │ Component   │        ┌──────────────┐ │
│                                │ Linking     │        │ Regulatory   │ │
│                                │             │────────│ Reports      │ │
│                                │ • Match     │        │              │ │
│                                │ • Create    │        │ • TSM (BS01-6)│ │
│                                │ • Update    │        │ • Building   │ │
│                                └─────────────┘        │   Safety     │ │
│                                                       │ • Compliance │ │
│                                                       └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + Prisma |
| Auth | NextAuth.js |
| AI | Claude API (Vision) |
| Storage | Cloudflare R2 / S3 |
| UI | Tailwind + shadcn/ui |
| Deploy | Docker → Render/Fly |

---

## Core Build Phases

### Phase 1: Project Foundation (Day 1-2)
**File:** `build-phases/Build-Phase1-Project-Foundation.md`

Sets up the base project with:
- Next.js 14 scaffold
- Environment configuration
- Docker & deployment config
- Health check API
- VS Code settings

**8 Prompts**

---

### Phase 2: Database & Authentication (Day 2-3)
**File:** `build-phases/Build-Phase2-Database-Auth.md`

Establishes data layer:
- Complete Prisma schema (14 models)
- 8 compliance streams seed
- NextAuth configuration
- Auth helpers & middleware
- Login page

**7 Prompts**

---

### Phase 3: Dashboard Layout (Day 3-4)
**File:** `build-phases/Build-Phase3-Dashboard-Layout.md`

Creates the app shell:
- Sidebar navigation
- Header component
- Dashboard layout
- Stats cards
- Compliance chart
- Upcoming expiries

**9 Prompts**

---

### Phase 4: Properties Management (Day 4-5)
**File:** `build-phases/Build-Phase4-Properties.md`

Full property CRUD:
- Properties list with filters
- Property detail page
- Add/edit forms
- Property APIs

**5 Prompts**

---

### Phase 5: Certificates & AI Processing (Day 5-7)
**File:** `build-phases/Build-Phase5-Certificates.md`

Certificate upload and extraction:
- S3/R2 storage utility
- Upload dropzone
- Upload page with progress
- AI extraction service
- Certificate APIs

**8 Prompts**

---

### Phase 6: Compliance & Actions (Day 7-8)
**File:** `build-phases/Build-Phase6-Compliance-Actions.md`

Compliance management:
- Compliance overview dashboard
- Stream cards
- Remedial actions page
- Reports page
- Report generation API

**6 Prompts**

---

## Extended Architecture

### File: `extended-phases/Extended-Architecture-Simplified.md`

Extends the base application with HACT-aligned data model and enhanced extraction.

---

### Phase E1: Extended Data Model (Day 1)

Adds HACT property hierarchy:

```
Property → Unit → Component
```

New models:
- **Unit**: Dwelling/lettable unit (UPRN, bedrooms, heating, EPC)
- **Component**: Asset/equipment (boiler, alarm, lift, etc.)
- **DataImport**: Track import jobs

**1 Prompt** (schema extension)

---

### Phase E2: Data Import (Day 2)

Simple CSV/Excel import:

| Template | Fields |
|----------|--------|
| Properties | UPRN, address, type, bedrooms |
| Units | Property UPRN, unit ref, type, floor |
| Components | Property/Unit ref, type, manufacturer, model |

- Template generator
- Import processor (upsert logic)
- Import APIs

**3 Prompts**

---

### Phase E3: Enhanced AI Extraction (Day 3)

Extract components from certificates:

| Certificate | Extracted Components |
|-------------|---------------------|
| Gas (CP12) | Boilers, fires, cookers with make/model |
| EICR | Consumer unit, circuits |
| FRA | Fire doors, alarms, extinguishers |
| New Build | All installed components |

- Enhanced extraction prompts
- Component linking service
- Auto-create remedial actions from defects

**3 Prompts**

---

### Phase E4: Regulatory Reports (Day 4)

Generate compliance reports without tenant data:

| Report | Metrics |
|--------|---------|
| TSM Repairs | BS01-BS06 (gas, EICR, FRA, alarms) |
| Building Safety | HRB count, HRB compliance |
| Compliance Summary | Overall rate, overdue, actions |

- Report definitions
- Report generator service
- CSV export

**3 Prompts**

---

## Data Model Summary

### Core Entities

```
Organisation
  └── User
  └── Property
        └── Unit
              └── Component
        └── Component (building-level)
        └── Certificate
              └── Extraction
        └── ComplianceRecord
        └── RemedialAction

ComplianceStream (Gas, EICR, Fire, etc.)
```

### Key Relationships

- **Property** can have many **Units** (flats in a block)
- **Components** can be at Property level (lift) or Unit level (boiler)
- **Certificates** link to Property, optionally Unit and Component
- **ComplianceRecords** track status at any hierarchy level
- **RemedialActions** auto-generated from extracted defects

---

## Compliance Streams

| Code | Name | Frequency |
|------|------|-----------|
| GAS | Gas Safety (CP12) | Annual |
| ELECTRICAL | EICR | 5 years |
| FIRE | Fire Risk Assessment | Annual |
| ASBESTOS | Asbestos Survey | Periodic |
| LEGIONELLA | Legionella Risk | Annual |
| LIFT | Lift Safety (LOLER) | 6 months |
| EPC | Energy Certificate | 10 years |
| SMOKE_ALARM | Smoke Alarms | Annual |

---

## Regulatory Reports Output

### TSM Building Safety Metrics (no tenant data needed)

| Code | Metric | Source |
|------|--------|--------|
| BS01 | % homes with valid gas cert | ComplianceRecord (GAS) |
| BS02 | % homes with valid EICR | ComplianceRecord (ELECTRICAL) |
| BS03 | % buildings with valid FRA | ComplianceRecord (FIRE) |
| BS05 | % homes with smoke alarms | Component (SMOKE_ALARM) |
| BS06 | % homes with CO alarms | Component (CO_ALARM) |

### Building Safety Act

| Metric | Source |
|--------|--------|
| HRB Count | Property.isHigherRiskBuilding |
| HRB Compliance | ComplianceRecord by stream |

---

## Build Order

```
Week 1:
  Phase 1 → Phase 2 → Phase 3

Week 2:
  Phase 4 → Phase 5 → Phase 6

Week 3 (Extended):
  Phase E1 → E2 → E3 → E4
```

---

## Quick Start

1. Use prompts from Phase 1 to scaffold project
2. Follow each phase sequentially
3. Verify checklist at end of each phase
4. Extended phases are optional but recommended

---

## Files Included

```
build-phases/
  Build-Phase1-Project-Foundation.md
  Build-Phase2-Database-Auth.md
  Build-Phase3-Dashboard-Layout.md
  Build-Phase4-Properties.md
  Build-Phase5-Certificates.md
  Build-Phase6-Compliance-Actions.md

extended-phases/
  Extended-Architecture-Simplified.md
```
