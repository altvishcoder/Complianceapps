# ComplianceAI - Replit Agent Prompts

Complete prompt sequence for building ComplianceAI using Replit Agent. Use these prompts in order, waiting for each phase to complete before starting the next.

---

## Prerequisites

Before starting, have these ready:
- DATABASE_URL - PostgreSQL connection string (Supabase or Neon)
- OPENAI_API_KEY - OpenAI API key with GPT-4o access
- CLERK_SECRET_KEY - Clerk authentication keys
- SUPABASE_URL + SUPABASE_SERVICE_KEY - For file storage

---

## Phase 1: Project Foundation

```
Build a Next.js 14 application called "ComplianceAI" for UK social housing compliance management.

TECH STACK:
- Next.js 14 with App Router and TypeScript
- Tailwind CSS with shadcn/ui components
- PostgreSQL with Prisma ORM
- Clerk for authentication

PROJECT STRUCTURE:
Create this folder structure:
/app
  /(auth)/sign-in, sign-up pages
  /(dashboard)/layout.tsx with sidebar navigation
  /(dashboard)/page.tsx - main dashboard
  /(dashboard)/properties/ - property management pages
  /(dashboard)/certificates/ - certificate pages
  /(dashboard)/compliance/ - compliance overview
  /api/ - API routes
/components/ui - shadcn components
/components/dashboard - dashboard components  
/lib/db.ts - Prisma client
/lib/ai/ - AI extraction code
/prisma/schema.prisma

PRISMA SCHEMA - Create these models:

1. Organisation (id, name, slug, settings JSON, timestamps)
2. User (id, clerkId, email, name, role enum [ADMIN/MANAGER/OFFICER/VIEWER], organisationId)
3. Scheme (id, organisationId, name, reference, complianceStatus enum)
4. Block (id, schemeId, name, reference, hasLift, hasCommunalBoiler, complianceStatus)
5. Property (id, blockId, uprn, addressLine1, addressLine2, city, postcode, propertyType enum, tenure enum, bedrooms, hasGas boolean, complianceStatus)
6. Certificate (id, organisationId, propertyId, blockId nullable, fileName, fileType, fileSize, storageKey, certificateType enum [GAS_SAFETY/EICR/EPC/FIRE_RISK_ASSESSMENT/OTHER], status enum [UPLOADED/PROCESSING/EXTRACTED/NEEDS_REVIEW/APPROVED/REJECTED/FAILED], certificateNumber, issueDate, expiryDate, outcome, uploadedById, reviewedById, timestamps)
7. Extraction (id, certificateId, method enum, model, promptVersion, rawResponse JSON, extractedData JSON, confidence float, textQuality enum, timestamps)
8. RemedialAction (id, certificateId, code, category, description, location, severity enum [IMMEDIATE/URGENT/PRIORITY/ROUTINE/ADVISORY], status enum, dueDate, resolvedAt, timestamps)
9. AuditEvent (id, entityType, entityId, action, userId, previousState JSON, newState JSON, timestamps)
10. Job (id, type, payload JSON, status enum, priority, attempts, scheduledFor, timestamps)

ComplianceStatus enum: COMPLIANT, EXPIRING_SOON, OVERDUE, NON_COMPLIANT, ACTION_REQUIRED, UNKNOWN

INITIAL UI:
- Dashboard layout with left sidebar (Properties, Certificates, Compliance, Actions, Settings)
- Dashboard page showing placeholder stats cards
- Basic navigation working

Install shadcn/ui and add: Button, Card, Input, Label, Select, Badge, Table, Dialog, DropdownMenu, Tabs

Set up Clerk authentication with protected routes for the dashboard.
```

---

## Phase 2: Property Management

```
Add complete property management to ComplianceAI.

PROPERTY HIERARCHY:
Properties are organized as: Organisation → Scheme → Block → Property

CREATE THESE PAGES:

1. /properties - Property List Page
- Table showing all properties with columns: Address, Postcode, Type, Compliance Status, Last Certificate
- Search by address/postcode
- Filter by compliance status
- "Add Property" button

2. /properties/new - Add Property Page
- Form with: Select Scheme, Select Block (or create new), Address fields, Postcode, Property Type dropdown, Tenure dropdown, Bedrooms, Has Gas checkbox
- Validate UK postcode format
- On submit: create property, redirect to property detail

3. /properties/[id] - Property Detail Page
- Property info card with edit button
- Compliance status badge (color coded)
- Tabs: Certificates, Actions, History
- Certificates tab: list of all certificates for this property with status badges
- "Upload Certificate" button

4. /schemes - Scheme Management
- List schemes with property count
- Add/edit scheme

5. /blocks - Block Management  
- List blocks with property count
- Add/edit block with: name, reference, hasLift, hasCommunalBoiler checkboxes

API ROUTES:
- GET/POST /api/properties - list and create
- GET/PATCH/DELETE /api/properties/[id] - single property operations
- GET/POST /api/schemes
- GET/POST /api/blocks

COMPLIANCE STATUS BADGE COMPONENT:
Create a reusable StatusBadge component:
- COMPLIANT: green
- EXPIRING_SOON: yellow  
- OVERDUE: red
- NON_COMPLIANT: red
- ACTION_REQUIRED: orange
- UNKNOWN: gray
```

---

## Phase 3: Certificate Upload & Storage

```
Add certificate upload functionality to ComplianceAI.

FILE STORAGE:
Use Supabase Storage (or S3-compatible). Create a bucket called "certificates".

Storage helper in /lib/storage.ts:
- uploadFile(buffer, fileName, orgId) - uploads to certificates/{orgId}/{uuid}.{ext}
- downloadFile(storageKey) - returns buffer
- getSignedUrl(storageKey) - for viewing

UPLOAD FLOW:

1. /certificates/upload - Upload Page
- Drag-and-drop zone for PDF/images (max 10MB)
- Property selector dropdown (searchable)
- Optional: Certificate type selector (will auto-detect if not selected)
- Upload button

2. POST /api/certificates - Upload Endpoint
- Validate file type (PDF, JPG, PNG)
- Validate file size
- Upload to storage
- Create Certificate record with status: UPLOADED
- Create AuditEvent: CERTIFICATE_UPLOADED
- Create Job: { type: 'PROCESS_CERTIFICATE', payload: { certificateId } }
- Return certificate ID

3. /certificates - Certificate List Page
- Table: File name, Property, Type, Status, Upload Date, Uploaded By
- Filter by status (especially NEEDS_REVIEW)
- Click row to go to detail

4. /certificates/[id] - Certificate Detail Page
- Show PDF/image preview (use iframe for PDF or img tag)
- Certificate info card
- If status is NEEDS_REVIEW or EXTRACTED: show Review section
- If status is APPROVED: show extracted data summary
- Timeline showing status changes from audit events

Add file upload input component with drag-and-drop support using react-dropzone or native drag events.
```

---

## Phase 4: AI Document Extraction

```
Implement AI-powered document extraction for ComplianceAI.

EXTRACTION PIPELINE in /lib/ai/extraction.ts:

The system must handle certificates of varying quality - from clean digital PDFs to old faded scanned documents.

STEP 1: DOCUMENT QUALITY ASSESSMENT
Create assessDocumentQuality(buffer, fileType) function:
- For PDFs: use pdf-parse to extract text
- Calculate quality score based on:
  * Text length (>500 chars = good)
  * Noise ratio (non-alphanumeric chars / total)
  * Presence of key terms (certificate, safety, inspection, date)
- Return: { textLength, quality: GOOD|FAIR|POOR|UNREADABLE, extractedText, recommendedMethod: TEXT|VISION }

STEP 2: CERTIFICATE CLASSIFICATION
Create classifyCertificate(text, imageBase64?) function:
- Use GPT-4o to identify certificate type
- Look for: "Gas Safe", "CP12" → GAS_SAFETY; "EICR", "C1/C2/C3" → EICR; "EPC", "Energy Rating" → EPC
- Return: { certificateType, confidence }

STEP 3: EXTRACTION (with intelligent routing)
Create extractCertificateData(buffer, fileType, certificateType) function:

Path A - GOOD QUALITY (text extraction worked):
- Send extracted text to GPT-4o with certificate-specific prompt
- Faster and cheaper

Path B - POOR QUALITY (scanned/old documents):
- Convert PDF pages to images using sharp or pdf-to-png
- Send images to GPT-4o Vision with high detail
- Better for handwriting, stamps, faded text

Path C - FALLBACK (if confidence < 0.5):
- Log that fallback is needed
- For now, return low confidence result
- (Later: integrate Google Document AI)

EXTRACTION PROMPTS - Create in /lib/ai/prompts/:

GAS_SAFETY prompt must extract:
- certificateNumber, propertyAddress (line1, postcode)
- inspectionDate (YYYY-MM-DD), expiryDate (YYYY-MM-DD)
- engineer: { name, gasSafeNumber (must be 7 digits) }
- contractor: { name, gasSafeNumber }
- appliances: array of { location, type, make, model, applianceSafe }
- overallOutcome: SATISFACTORY | AT_RISK | IMMEDIATELY_DANGEROUS | NOT_TO_CURRENT_STANDARD
- defects: array if any
- confidence: 0-1

EICR prompt must extract:
- reportNumber, propertyAddress
- inspectionDate, nextInspectionDate
- inspector: { name, registrationNumber }
- overallAssessment: SATISFACTORY | UNSATISFACTORY  
- observations: array of { itemNumber, description, code: C1|C2|C3|FI, location }
- c1Count, c2Count, c3Count, fiCount
- confidence: 0-1

ZOD VALIDATION in /lib/ai/schemas/:
Create Zod schemas for each certificate type to validate extracted data.
UK postcode regex: /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i
Gas Safe number: exactly 7 digits

OPENAI CONFIGURATION:
- Model: gpt-4o
- For vision: use detail: "high" 
- response_format: { type: "json_object" }
- temperature: 0.1 (low for consistent extraction)

CONFIDENCE SCORING:
- Start at 1.0
- Reduce by 0.1 for each missing required field
- Reduce by 0.2 if Gas Safe number format is invalid
- Reduce by 0.15 if dates can't be parsed
- Reduce by 0.1 for each validation error

PROCESS CERTIFICATE FUNCTION:
Create processCertificate(certificateId) that:
1. Update status to PROCESSING
2. Download file from storage
3. Assess quality
4. Classify type (if not set)
5. Extract data using appropriate method
6. Validate with Zod schema
7. Create Extraction record
8. Update Certificate: status = confidence >= 0.85 ? 'EXTRACTED' : 'NEEDS_REVIEW'
9. If confidence high, denormalize: issueDate, expiryDate, certificateNumber to Certificate
10. Create AuditEvent

Install: openai, pdf-parse, zod, sharp
```

---

## Phase 5: Review & Approval Workflow

```
Add the human review workflow for certificate verification.

REVIEW PAGE - /certificates/[id] when status is NEEDS_REVIEW or EXTRACTED:

1. DOCUMENT VIEWER (left side, 60% width)
- Display the original PDF/image
- For PDF: use iframe with src from signed URL
- For images: use img tag with zoom capability

2. EXTRACTION PANEL (right side, 40% width)

Confidence Indicator:
- Progress bar showing confidence percentage
- Color: green ≥85%, yellow 70-84%, red <70%
- Warning text if low confidence

Extracted Fields Form:
- Show all extracted fields as editable inputs
- Group by section: Property, Dates, Engineer, Outcome
- Highlight fields with validation errors in red
- "Edit" toggle to enable/disable editing

For Gas Safety show:
- Property address, postcode
- Inspection date (date picker)
- Expiry date (date picker)
- Engineer name, Gas Safe number
- Contractor name
- Overall outcome (dropdown)
- Appliances table (if any)
- Defects list (if any)

For EICR show:
- Property address, postcode
- Inspection date, next inspection date
- Inspector name, registration number
- Overall assessment (dropdown)
- Observations table with C1/C2/C3/FI badges

Review Notes:
- Textarea for reviewer notes

Action Buttons:
- "Approve" (green) - saves corrections, sets status APPROVED
- "Reject" (red) - sets status REJECTED, requires note

3. API ROUTE - POST /api/certificates/[id]/approve

Request body: { approved: boolean, corrections: object, notes: string }

On Approve:
- If corrections provided, update Extraction.extractedData
- Update Certificate status to APPROVED
- Set reviewedById, reviewedAt
- Denormalize dates and certificateNumber to Certificate
- Create AuditEvent: CERTIFICATE_APPROVED
- Create RemedialActions if needed:
  * For EICR with C1/C2/FI observations
  * For Gas with AT_RISK or IMMEDIATELY_DANGEROUS outcome
- Trigger compliance recalculation for the property

On Reject:
- Update status to REJECTED
- Set reviewedById, reviewedAt, reviewNotes
- Create AuditEvent: CERTIFICATE_REJECTED

4. PENDING REVIEWS LIST
On dashboard, show card with count of NEEDS_REVIEW certificates
Link to /certificates?status=NEEDS_REVIEW
```

---

## Phase 6: Compliance Engine

```
Implement the compliance rules engine and status calculation.

COMPLIANCE RULES in /lib/compliance/rules.ts:

Define rules for each certificate type:
{
  certificateType: 'GAS_SAFETY',
  validityMonths: 12,
  warningDays: 30,
  requiredFor: (property) => property.hasGas,
  isCompliant: (cert) => cert.outcome === 'SATISFACTORY',
  needsRemediation: (cert) => ['AT_RISK', 'IMMEDIATELY_DANGEROUS'].includes(cert.outcome)
}

{
  certificateType: 'EICR',
  validityMonths: 60,
  warningDays: 90,
  requiredFor: () => true,
  isCompliant: (cert) => cert.overallAssessment === 'SATISFACTORY',
  needsRemediation: (cert) => cert.c1Count > 0 || cert.c2Count > 0
}

{
  certificateType: 'EPC',
  validityMonths: 120,
  warningDays: 180,
  requiredFor: () => true,
  isCompliant: (cert) => ['A','B','C','D','E'].includes(cert.rating)
}

STATUS CALCULATOR in /lib/compliance/calculator.ts:

calculatePropertyCompliance(propertyId):
1. Get property with block
2. Get applicable rules for this property
3. Get latest APPROVED certificate for each required type
4. For each rule:
   - No certificate → UNKNOWN
   - Expired → OVERDUE (return immediately, worst case)
   - Outcome failed → NON_COMPLIANT
   - Has open remedial actions → ACTION_REQUIRED
   - Expiring within warningDays → EXPIRING_SOON
   - Otherwise → COMPLIANT
5. Return worst status found

calculateBlockCompliance(blockId):
- Get worst status from all properties in block
- Also check block-level certificates (Fire Risk Assessment)

calculateSchemeCompliance(schemeId):
- Get worst status from all blocks

RECALCULATION API - POST /api/compliance/recalculate:
- Accepts: { propertyId } or { blockId } or { schemeId } or { all: true }
- Recalculates and updates complianceStatus on records
- Use after certificate approval

COMPLIANCE DASHBOARD - /compliance:
- Summary cards: Total properties, Compliant %, Expiring count, Overdue count
- Chart: Compliance by certificate type (bar chart)
- Table: Non-compliant properties with links
- Filter by scheme/block

Add recalculation trigger after certificate approval in the approve API.
```

---

## Phase 7: Background Worker & Dashboard

```
Add background job processing and complete the dashboard.

BACKGROUND WORKER in /workers/process-certificate.ts:

Simple polling worker:
1. Query Job table for PENDING jobs ordered by priority, createdAt
2. Set status to RUNNING
3. Process based on job.type:
   - PROCESS_CERTIFICATE: call processCertificate(payload.certificateId)
   - RECALCULATE_COMPLIANCE: call calculatePropertyCompliance(payload.propertyId)
4. Set status to COMPLETED or FAILED
5. If failed and attempts < 3, set back to PENDING with delay
6. Loop with 5 second sleep between polls

Add script to package.json: "worker": "tsx workers/process-certificate.ts"

DASHBOARD PAGE - /(dashboard)/page.tsx:

Stats Row (4 cards):
1. Total Properties - count with Home icon
2. Compliant - count and percentage, green, CheckCircle icon
3. Expiring Soon - count, yellow, Clock icon  
4. Overdue - count, red, XCircle icon

Alert Banner (if overdue > 0):
- Red background
- "X properties have overdue compliance certificates - immediate action required"

Compliance by Type Chart:
- Bar chart using recharts
- X axis: certificate types (Gas, EICR, EPC)
- Y axis: percentage compliant
- Color coded bars

Pending Reviews Card:
- List certificates with NEEDS_REVIEW status
- Show: filename, property, uploaded date
- Link to review page
- "View All" link to filtered list

Recent Activity Card:
- Last 10 audit events
- Show: action, entity, user, time ago
- Icon for each action type

Open Actions Card (if any):
- Count of open remedial actions by severity
- IMMEDIATE: red badge
- URGENT: orange badge
- Link to /actions page

ACTIONS PAGE - /actions:
- Table of all remedial actions
- Columns: Property, Certificate, Issue, Severity, Status, Due Date
- Filter by status, severity
- Click to view certificate
- Mark as completed action
```

---

## Phase 8: Polish & Production Ready

```
Final polish and production readiness.

ERROR HANDLING:
- Add try-catch to all API routes
- Return proper HTTP status codes
- Show toast notifications for errors in UI
- Add error boundary component

LOADING STATES:
- Add loading skeletons to all data-fetching pages
- Show spinner during form submissions
- Disable buttons during async operations

AUDIT LOGGING:
- Log all create, update, delete operations
- Log login/logout events
- Include IP address and user agent where available

NOTIFICATIONS:
- Create /api/cron/check-expiring endpoint
- Find certificates expiring in next 30 days
- Log or send notification (placeholder for email)
- Set up as daily cron job

SEARCH:
- Add global search in header
- Search properties by address, postcode
- Search certificates by filename, certificate number

EXPORT:
- Add "Export CSV" button to property list
- Add "Export CSV" button to certificate list
- Include compliance status in export

MOBILE RESPONSIVE:
- Ensure sidebar collapses on mobile
- Stack form fields on small screens
- Make tables horizontally scrollable

ENV VALIDATION:
- Check all required env vars on startup
- Throw clear error if missing

SECURITY:
- Verify organisation membership on all API routes
- Sanitize file uploads (check MIME type)
- Rate limit API routes

FINAL TESTING:
- Test complete flow: upload → extract → review → approve
- Verify compliance status updates correctly
- Check audit trail is complete
```

---

## Follow-up Prompts

### Add Gas Safe API Validation

```
Add real-time Gas Safe Register validation for engineer numbers.

Create /lib/api/gas-safe.ts:

validateGasSafeEngineer(registrationNumber: string):
- Make API call to Gas Safe Register (or mock for now)
- Validate the 7-digit number format
- Return: { valid: boolean, name?: string, employer?: string, expiryDate?: Date }

Add validation check during certificate extraction:
- If Gas Safety certificate, validate the engineer's Gas Safe number
- Add validation result to extraction metadata
- Show warning in review UI if invalid

For now, create a mock that validates format only. Add real API integration later.
```

### Add Email Notifications

```
Add email notifications for compliance events.

Install: resend (or nodemailer)

Create /lib/email.ts:
- sendEmail(to, subject, html)

Create email templates:
1. Certificate needs review - sent to compliance officers
2. Certificate approved - sent to uploader
3. Certificate expiring soon - sent to property manager
4. Overdue alert - sent to admin

Trigger emails:
- After extraction completes with NEEDS_REVIEW status
- After approval
- From daily cron job for expiring/overdue

Add email preferences to Organisation settings.
```

### Add Bulk Upload

```
Add bulk certificate upload for multiple files.

Modify /certificates/upload page:
- Allow multiple file selection
- Show list of selected files with property selector for each
- "Upload All" button

Create /api/certificates/bulk endpoint:
- Accept array of { file, propertyId }
- Upload all files
- Create Certificate records
- Create Jobs for each
- Return array of certificate IDs

Show progress indicator during bulk upload.
Add "Bulk Upload" tab on upload page.
```

---

## Troubleshooting Prompts

### Fix Date Parsing Issues

```
Fix date parsing in the certificate extraction.

Issues to address:
1. UK date format (DD/MM/YYYY) being parsed as US format
2. Dates with various separators (/, -, .)
3. Written dates ("1st January 2024")

Update the extraction prompts to always return YYYY-MM-DD format.

Add date parsing utility in /lib/utils.ts:
- parseUKDate(dateString) - handles multiple formats
- Returns Date object or null

Update extraction validation to use this parser.
Show original date string in review UI alongside parsed date.
```

### Fix File Upload Size Limit

```
Fix the file upload size limit for large PDFs.

Update next.config.js to increase body size limit:
- Set bodySizeLimit to '10mb' for API routes

If using Supabase Storage:
- Check bucket file size limit
- Update if needed

Add client-side file size validation:
- Show error before upload if file > 10MB
- Suggest compressing the PDF

Add file compression option:
- If PDF > 5MB, offer to compress before upload
- Use pdf-lib to reduce image quality
```

### Fix Slow Extraction

```
Optimize the certificate extraction speed.

Current issues:
- Large PDFs take too long
- Multiple API calls for multi-page documents

Optimizations:
1. Only process first 3 pages for classification
2. Cache extracted text to avoid re-processing
3. Use streaming for large files
4. Add timeout handling (30 second max)

Add progress indicator:
- Show "Analyzing document..." during classification
- Show "Extracting data..." during extraction
- Show "Validating..." during schema check

Add extraction status to Certificate model:
- extractionProgress: number (0-100)
- Update during processing
```

---

© 2025 LASHAN Digital
