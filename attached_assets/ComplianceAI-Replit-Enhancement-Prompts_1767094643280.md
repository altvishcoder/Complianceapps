# ComplianceAI Enhancement Prompts
## Replit Agent Instruction Sets

These prompts are designed for sequential execution with Replit Agent to enhance ComplianceAI's production readiness.

---

## Prompt 1: Add Tiered Document Intelligence (P1)
**Effort:** 1 week | **Impact:** Cost + speed for standard certificates

```
Add Azure Document Intelligence as the primary extraction service, AWS Textract as standard OCR fallback, and Claude Vision for complex documents.

## Requirements

### 1. Install Dependencies
- @azure/ai-form-recognizer (latest v5.x)
- @aws-sdk/client-textract

### 2. Create Azure Document Intelligence Service

Create `server/services/extraction/azure-document-intelligence.ts`:

- Initialize DocumentAnalysisClient with endpoint and API key from environment variables:
  - AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
  - AZURE_DOCUMENT_INTELLIGENCE_KEY

- Create function `analyzeDocument(buffer: Buffer, mimeType: string)` that:
  - Uses the prebuilt-document model for general extraction
  - Extracts key-value pairs, tables, and text
  - Returns structured data matching our certificate schema

- Create function `analyzeWithCustomModel(buffer: Buffer, modelId: string)` for future custom models

- Add proper error handling with fallback flag

- Return confidence scores for each extracted field

### 3. Create AWS Textract Service

Create `server/services/extraction/aws-textract.ts`:

- Initialize TextractClient with credentials from environment variables:
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - AWS_REGION

- Create function `extractText(buffer: Buffer)` that:
  - Uses DetectDocumentText for basic OCR
  - Returns raw text blocks with bounding boxes

- Create function `analyzeDocument(buffer: Buffer)` that:
  - Uses AnalyzeDocument with FeatureTypes: ['FORMS', 'TABLES']
  - Extracts key-value pairs and tables
  - Returns structured data

- Create function `extractFromS3(bucket: string, key: string)` for async processing of large documents

- Handle Textract's async API for documents > 1 page:
  - StartDocumentAnalysis → GetDocumentAnalysis polling

### 4. Create Tiered Extraction Pipeline

Create `server/services/extraction/extraction-pipeline.ts`:

- Implement 4-tier extraction strategy:
  ```
  Tier 1: Azure Document Intelligence (fast, structured - £1.50/1000 pages)
    ↓ If confidence < 0.8 or extraction fails
  Tier 2: AWS Textract (reliable OCR fallback - £1.50/1000 pages)
    ↓ If confidence < 0.7 or key fields missing
  Tier 3: Claude Vision API (complex/handwritten - £0.02/image)
    ↓ If all fail
  Tier 4: Return partial results with manual review flag
  ```

- Create main function `extractCertificateData(buffer: Buffer, filename: string, options?: ExtractionOptions)`:

```typescript
interface ExtractionOptions {
  preferredTier?: 'azure' | 'textract' | 'claude';
  skipTiers?: ('azure' | 'textract' | 'claude')[];
  forceManualReview?: boolean;
}

interface ExtractionResult {
  success: boolean;
  data: CertificateData | null;
  tier: 'azure' | 'textract' | 'claude' | 'manual';
  confidence: number;
  processingTimeMs: number;
  rawText?: string;
  warnings: string[];
}
```

- Logic flow:
  1. Try Azure Document Intelligence
  2. Calculate confidence based on required fields found
  3. If confidence >= 0.8, return result
  4. If Azure fails or low confidence, try Textract
  5. If Textract confidence >= 0.7, return result
  6. If still low confidence, try Claude Vision
  7. If all fail, flag for manual review

- Add field validation after each tier:
  - Required: complianceType, inspectionDate
  - Expected: expiryDate, outcome, engineerName, certificateNumber
  - Calculate confidence = (found required × 0.6) + (found expected × 0.4)

### 5. Update Existing Certificate Processing

Modify `server/services/certificate-processor.ts` (or equivalent):
- Replace direct Claude calls with the new extraction pipeline
- Maintain backward compatibility with existing response format
- Add extraction_tier field to track which service was used
- Store raw extracted text for debugging/reprocessing

### 6. Add Cost Tracking

Create `server/services/extraction/cost-tracker.ts`:

```typescript
interface ExtractionCost {
  tier: string;
  pages: number;
  costGBP: number;
}

const COST_PER_PAGE = {
  azure: 0.0015,    // £1.50/1000 pages
  textract: 0.0015, // £1.50/1000 pages
  claude: 0.02,     // £0.02/image (estimated)
};
```

- Track pages processed per tier per organisation
- Calculate estimated costs
- Store in database for billing/analytics
- Create monthly cost summary function

### 7. Environment Variables

Add to `.env.example`:
```
# Azure Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your-key

# AWS Textract
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=eu-west-2

# Extraction Settings
EXTRACTION_CONFIDENCE_THRESHOLD_HIGH=0.8
EXTRACTION_CONFIDENCE_THRESHOLD_LOW=0.7
EXTRACTION_ENABLE_AZURE=true
EXTRACTION_ENABLE_TEXTRACT=true
EXTRACTION_ENABLE_CLAUDE=true
```

### 8. Add Health Checks

Add to health check endpoint:
- Azure Document Intelligence connectivity
- AWS Textract connectivity
- Report which services are enabled/available

### 9. Add Extraction Analytics Endpoint

Create `server/routes/admin/extraction-stats.ts`:

- GET /api/admin/extraction/stats
  - Returns: tier usage counts, average confidence, cost breakdown
  - Filter by date range, organisation, compliance type

## Testing

- Test with sample gas certificate (CP12) - should use Azure (Tier 1)
- Test with poor quality scan - should fallback to Textract (Tier 2)
- Test with handwritten notes - should fallback to Claude (Tier 3)
- Test with completely illegible document - should flag for manual review
- Verify cost tracking records are created
- Test with each tier disabled to verify fallback chain

## File Structure
```
server/services/extraction/
├── azure-document-intelligence.ts  (new)
├── aws-textract.ts                 (new)
├── extraction-pipeline.ts          (new)
├── cost-tracker.ts                 (new)
├── field-validator.ts              (new)
└── index.ts                        (barrel export)

server/services/
└── certificate-processor.ts        (modify)

server/routes/admin/
└── extraction-stats.ts             (new)
```
```

---

## Prompt 2: Add OpenAPI Documentation (P1)
**Effort:** 3 days | **Impact:** API consumers

```
Add OpenAPI/Swagger documentation for all API endpoints using zod-to-openapi, with an interactive documentation UI.

## Requirements

### 1. Install Dependencies
- @asteasolutions/zod-to-openapi
- swagger-ui-express
- @types/swagger-ui-express

### 2. Create OpenAPI Registry

Create `server/openapi/registry.ts`:

- Initialize OpenAPIRegistry from zod-to-openapi
- Create base OpenAPI document configuration:
  ```typescript
  {
    openapi: '3.1.0',
    info: {
      title: 'ComplianceAI API',
      version: '1.0.0',
      description: 'API for social housing compliance certificate management',
      contact: {
        name: 'LASHAN Digital',
        email: 'support@lashan.co.uk'
      }
    },
    servers: [
      { url: '/api/v1', description: 'API v1' }
    ],
    tags: [
      { name: 'Certificates', description: 'Certificate management' },
      { name: 'Properties', description: 'Property management' },
      { name: 'Compliance', description: 'Compliance status and reporting' },
      { name: 'Documents', description: 'Document upload and processing' },
      { name: 'Export', description: 'Data export endpoints' },
      { name: 'Auth', description: 'Authentication' }
    ]
  }
  ```

### 3. Create Schema Definitions

Create `server/openapi/schemas.ts`:

- Register all Zod schemas with OpenAPI metadata using .openapi() extension
- Include examples for each schema
- Example:
  ```typescript
  export const CertificateSchema = z.object({
    id: z.string().uuid(),
    propertyId: z.string().uuid(),
    complianceType: z.string(),
    certificateCode: z.string().optional(),
    inspectionDate: z.string().date(),
    expiryDate: z.string().date(),
    outcome: z.enum(['SATISFACTORY', 'UNSATISFACTORY', 'ADVISORY']),
    status: z.enum(['VALID', 'EXPIRED', 'EXPIRING'])
  }).openapi('Certificate', {
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      propertyId: '550e8400-e29b-41d4-a716-446655440001',
      complianceType: 'GAS',
      certificateCode: 'CP12',
      inspectionDate: '2024-01-15',
      expiryDate: '2025-01-15',
      outcome: 'SATISFACTORY',
      status: 'VALID'
    }
  });
  ```

### 4. Document All Endpoints

Create `server/openapi/paths/` directory with files for each resource:

- `certificates.ts` - All certificate endpoints
- `properties.ts` - All property endpoints  
- `compliance.ts` - Compliance status endpoints
- `documents.ts` - Document upload endpoints
- `export.ts` - Export endpoints
- `auth.ts` - Authentication endpoints

For each endpoint, register with:
- Method and path
- Request parameters (path, query, body)
- Response schemas for all status codes (200, 400, 401, 404, 500)
- Security requirements
- Tags

Example:
```typescript
registry.registerPath({
  method: 'get',
  path: '/certificates/{id}',
  tags: ['Certificates'],
  summary: 'Get certificate by ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().uuid()
    })
  },
  responses: {
    200: {
      description: 'Certificate found',
      content: {
        'application/json': {
          schema: CertificateSchema
        }
      }
    },
    404: {
      description: 'Certificate not found',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    }
  }
});
```

### 5. Generate OpenAPI Document

Create `server/openapi/generator.ts`:

- Function to generate complete OpenAPI document from registry
- Export as JSON for external tools
- Include security schemes (Bearer token)

### 6. Add Swagger UI Route

Modify `server/index.ts` or create `server/routes/docs.ts`:

```typescript
import swaggerUi from 'swagger-ui-express';
import { generateOpenAPIDocument } from './openapi/generator';

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(generateOpenAPIDocument()));
app.get('/api/docs.json', (req, res) => {
  res.json(generateOpenAPIDocument());
});
```

### 7. Add API Versioning

Create `server/middleware/api-version.ts`:
- Add version header to all responses
- Support Accept-Version header for future versioning

### 8. Update Existing Routes

For each existing route file:
- Ensure request/response uses registered Zod schemas
- This ensures documentation stays in sync with implementation

## File Structure
```
server/openapi/
├── registry.ts
├── schemas.ts
├── generator.ts
└── paths/
    ├── certificates.ts
    ├── properties.ts
    ├── compliance.ts
    ├── documents.ts
    ├── export.ts
    └── auth.ts
```

## Verification
- Navigate to /api/docs to see Swagger UI
- Download /api/docs.json and validate with swagger-cli
- Test "Try it out" functionality for key endpoints
```

---

## Prompt 3: Add PostgreSQL Full-Text Search (P2)
**Effort:** 1 week | **Impact:** UX for large portfolios

```
Add PostgreSQL full-text search for fast searching across properties, certificates, and contractors without additional infrastructure.

## Requirements

### 1. No Additional Dependencies Required
PostgreSQL full-text search is built-in - no external search engine needed.

### 2. Create Search Configuration

Create migration `server/db/migrations/add-full-text-search.sql`:

```sql
-- Create text search configuration for UK English
CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS english_housing (COPY = english);

-- Add synonym dictionary for housing terms (optional enhancement)
-- CREATE TEXT SEARCH DICTIONARY housing_synonyms (
--   TEMPLATE = synonym,
--   SYNONYMS = housing_synonyms
-- );

-- Add tsvector columns to searchable tables
ALTER TABLE properties ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN indexes for fast full-text search
CREATE INDEX IF NOT EXISTS idx_properties_search ON properties USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_certificates_search ON certificates USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_contractors_search ON contractors USING GIN(search_vector);

-- Create combined index for filtering + search
CREATE INDEX IF NOT EXISTS idx_properties_org_search ON properties(organisation_id) INCLUDE (search_vector);
CREATE INDEX IF NOT EXISTS idx_certificates_org_search ON certificates(organisation_id) INCLUDE (search_vector);
```

### 3. Create Search Vector Update Functions

Add to migration:

```sql
-- Function to generate property search vector
CREATE OR REPLACE FUNCTION properties_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.address_line1, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.address_line2, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.postcode, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.uprn, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.city, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.property_type, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Function to generate certificate search vector
CREATE OR REPLACE FUNCTION certificates_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.certificate_number, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.contractor_name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.engineer_name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.engineer_registration, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.compliance_type, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.certificate_code, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Function to generate contractor search vector
CREATE OR REPLACE FUNCTION contractors_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.trading_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.registration_number, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.compliance_types, ' '), '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER properties_search_update
  BEFORE INSERT OR UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION properties_search_vector_update();

CREATE TRIGGER certificates_search_update
  BEFORE INSERT OR UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION certificates_search_vector_update();

CREATE TRIGGER contractors_search_update
  BEFORE INSERT OR UPDATE ON contractors
  FOR EACH ROW EXECUTE FUNCTION contractors_search_vector_update();
```

### 4. Populate Existing Records

Create script `server/scripts/populate-search-vectors.ts`:

```typescript
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function populateSearchVectors() {
  console.log('Populating search vectors for existing records...');
  
  // Update properties
  console.log('Updating properties...');
  await db.execute(sql`
    UPDATE properties SET 
      search_vector = 
        setweight(to_tsvector('english', COALESCE(address_line1, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(address_line2, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(postcode, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(uprn, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(city, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(property_type, '')), 'C')
    WHERE search_vector IS NULL
  `);
  
  // Update certificates
  console.log('Updating certificates...');
  await db.execute(sql`
    UPDATE certificates SET 
      search_vector = 
        setweight(to_tsvector('english', COALESCE(certificate_number, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(contractor_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(engineer_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(engineer_registration, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(compliance_type, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(certificate_code, '')), 'B')
    WHERE search_vector IS NULL
  `);
  
  // Update contractors
  console.log('Updating contractors...');
  await db.execute(sql`
    UPDATE contractors SET 
      search_vector = 
        setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(trading_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(registration_number, '')), 'A')
    WHERE search_vector IS NULL
  `);
  
  console.log('Search vectors populated successfully!');
}

populateSearchVectors().catch(console.error);
```

### 5. Create Search Service

Create `server/services/search/search-service.ts`:

```typescript
import { db } from '../../db';
import { sql } from 'drizzle-orm';

interface SearchOptions {
  query: string;
  organisationId: string;
  types?: ('properties' | 'certificates' | 'contractors')[];
  limit?: number;
  offset?: number;
  filters?: {
    complianceType?: string;
    status?: string;
    propertyType?: string;
  };
}

interface SearchResult {
  type: 'property' | 'certificate' | 'contractor';
  id: string;
  title: string;
  subtitle: string;
  rank: number;
  highlight?: string;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalCount: number;
  processingTimeMs: number;
}

export async function search(options: SearchOptions): Promise<SearchResponse> {
  const startTime = Date.now();
  const { query, organisationId, types = ['properties', 'certificates', 'contractors'], limit = 20, offset = 0 } = options;
  
  // Convert query to tsquery format
  // Handle partial matching with :* prefix search
  const searchTerms = query
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0)
    .map(term => `${term}:*`)
    .join(' & ');
  
  if (!searchTerms) {
    return { query, results: [], totalCount: 0, processingTimeMs: 0 };
  }
  
  const results: SearchResult[] = [];
  
  // Search properties
  if (types.includes('properties')) {
    const propertyResults = await db.execute(sql`
      SELECT 
        id,
        address_line1 || ', ' || postcode as title,
        property_type as subtitle,
        ts_rank(search_vector, to_tsquery('english', ${searchTerms})) as rank,
        ts_headline('english', address_line1 || ' ' || COALESCE(address_line2, '') || ' ' || postcode, 
          to_tsquery('english', ${searchTerms}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
        ) as highlight
      FROM properties
      WHERE organisation_id = ${organisationId}
        AND search_vector @@ to_tsquery('english', ${searchTerms})
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
    
    results.push(...propertyResults.rows.map(row => ({
      type: 'property' as const,
      id: row.id,
      title: row.title,
      subtitle: row.subtitle || 'Property',
      rank: parseFloat(row.rank),
      highlight: row.highlight
    })));
  }
  
  // Search certificates
  if (types.includes('certificates')) {
    const certificateResults = await db.execute(sql`
      SELECT 
        c.id,
        COALESCE(c.certificate_number, c.compliance_type) as title,
        c.contractor_name || ' - ' || c.compliance_type as subtitle,
        ts_rank(c.search_vector, to_tsquery('english', ${searchTerms})) as rank,
        ts_headline('english', 
          COALESCE(c.certificate_number, '') || ' ' || COALESCE(c.contractor_name, '') || ' ' || COALESCE(c.engineer_name, ''),
          to_tsquery('english', ${searchTerms}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
        ) as highlight
      FROM certificates c
      WHERE c.organisation_id = ${organisationId}
        AND c.search_vector @@ to_tsquery('english', ${searchTerms})
        ${options.filters?.complianceType ? sql`AND c.compliance_type = ${options.filters.complianceType}` : sql``}
        ${options.filters?.status ? sql`AND c.status = ${options.filters.status}` : sql``}
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
    
    results.push(...certificateResults.rows.map(row => ({
      type: 'certificate' as const,
      id: row.id,
      title: row.title,
      subtitle: row.subtitle || 'Certificate',
      rank: parseFloat(row.rank),
      highlight: row.highlight
    })));
  }
  
  // Search contractors
  if (types.includes('contractors')) {
    const contractorResults = await db.execute(sql`
      SELECT 
        id,
        name as title,
        registration_number as subtitle,
        ts_rank(search_vector, to_tsquery('english', ${searchTerms})) as rank,
        ts_headline('english', name || ' ' || COALESCE(trading_name, '') || ' ' || COALESCE(registration_number, ''),
          to_tsquery('english', ${searchTerms}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
        ) as highlight
      FROM contractors
      WHERE organisation_id = ${organisationId}
        AND search_vector @@ to_tsquery('english', ${searchTerms})
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
    
    results.push(...contractorResults.rows.map(row => ({
      type: 'contractor' as const,
      id: row.id,
      title: row.title,
      subtitle: row.subtitle || 'Contractor',
      rank: parseFloat(row.rank),
      highlight: row.highlight
    })));
  }
  
  // Sort all results by rank and apply limit
  results.sort((a, b) => b.rank - a.rank);
  const paginatedResults = results.slice(offset, offset + limit);
  
  return {
    query,
    results: paginatedResults,
    totalCount: results.length,
    processingTimeMs: Date.now() - startTime
  };
}

// Quick search for autocomplete (faster, fewer fields)
export async function quickSearch(query: string, organisationId: string, limit = 10): Promise<SearchResult[]> {
  const response = await search({
    query,
    organisationId,
    limit,
    types: ['properties', 'certificates']
  });
  return response.results;
}
```

### 6. Create Search API Endpoints

Create `server/routes/search.ts`:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { search, quickSearch } from '../services/search/search-service';
import { authenticate } from '../middleware/auth';

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  types: z.string().optional(), // comma-separated: properties,certificates,contractors
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  complianceType: z.string().optional(),
  status: z.string().optional(),
});

// Full search
router.get('/api/v1/search', authenticate, async (req, res) => {
  try {
    const params = searchQuerySchema.parse(req.query);
    
    const results = await search({
      query: params.q,
      organisationId: req.user.organisationId,
      types: params.types?.split(',') as any,
      limit: params.limit,
      offset: params.offset,
      filters: {
        complianceType: params.complianceType,
        status: params.status,
      }
    });
    
    res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid search parameters', details: error.errors });
    } else {
      throw error;
    }
  }
});

// Quick search for autocomplete
router.get('/api/v1/search/quick', authenticate, async (req, res) => {
  const query = req.query.q as string;
  
  if (!query || query.length < 2) {
    return res.json({ results: [] });
  }
  
  const results = await quickSearch(query, req.user.organisationId);
  res.json({ results });
});

// Search suggestions (based on popular/recent searches)
router.get('/api/v1/search/suggestions', authenticate, async (req, res) => {
  // Return recent searches or popular terms for this organisation
  // Implementation depends on whether you want to track search history
  res.json({ suggestions: [] });
});

export default router;
```

### 7. Add Search Component (Frontend)

Create `client/components/GlobalSearch.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router'; // or wouter
import { useQuery } from '@tanstack/react-query';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Building2, FileCheck, Users } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchResult {
  type: 'property' | 'certificate' | 'contractor';
  id: string;
  title: string;
  subtitle: string;
  highlight?: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();
  
  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);
  
  // Search query
  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return { results: [] };
      const res = await fetch(`/api/v1/search/quick?q=${encodeURIComponent(debouncedQuery)}`);
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });
  
  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false);
    setQuery('');
    
    switch (result.type) {
      case 'property':
        navigate({ to: '/properties/$propertyId', params: { propertyId: result.id } });
        break;
      case 'certificate':
        navigate({ to: '/certificates/$certificateId', params: { certificateId: result.id } });
        break;
      case 'contractor':
        navigate({ to: '/contractors/$contractorId', params: { contractorId: result.id } });
        break;
    }
  }, [navigate]);
  
  const getIcon = (type: string) => {
    switch (type) {
      case 'property': return <Building2 className="h-4 w-4" />;
      case 'certificate': return <FileCheck className="h-4 w-4" />;
      case 'contractor': return <Users className="h-4 w-4" />;
      default: return null;
    }
  };
  
  const results = data?.results || [];
  
  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) acc[result.type] = [];
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);
  
  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md hover:bg-accent"
      >
        <span>Search...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      
      {/* Search dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search properties, certificates, contractors..." 
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading && <CommandEmpty>Searching...</CommandEmpty>}
          {!isLoading && query.length >= 2 && results.length === 0 && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}
          {!isLoading && query.length < 2 && (
            <CommandEmpty>Type at least 2 characters to search...</CommandEmpty>
          )}
          
          {groupedResults.property?.length > 0 && (
            <CommandGroup heading="Properties">
              {groupedResults.property.map((result) => (
                <CommandItem
                  key={result.id}
                  value={result.id}
                  onSelect={() => handleSelect(result)}
                >
                  {getIcon(result.type)}
                  <div className="ml-2">
                    <div className="font-medium">{result.title}</div>
                    <div className="text-xs text-muted-foreground">{result.subtitle}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
          {groupedResults.certificate?.length > 0 && (
            <CommandGroup heading="Certificates">
              {groupedResults.certificate.map((result) => (
                <CommandItem
                  key={result.id}
                  value={result.id}
                  onSelect={() => handleSelect(result)}
                >
                  {getIcon(result.type)}
                  <div className="ml-2">
                    <div className="font-medium">{result.title}</div>
                    <div className="text-xs text-muted-foreground">{result.subtitle}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
          {groupedResults.contractor?.length > 0 && (
            <CommandGroup heading="Contractors">
              {groupedResults.contractor.map((result) => (
                <CommandItem
                  key={result.id}
                  value={result.id}
                  onSelect={() => handleSelect(result)}
                >
                  {getIcon(result.type)}
                  <div className="ml-2">
                    <div className="font-medium">{result.title}</div>
                    <div className="text-xs text-muted-foreground">{result.subtitle}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
```

### 8. Create useDebounce Hook

Create `client/hooks/useDebounce.ts`:

```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}
```

### 9. Add Search to App Layout

Update your main layout component to include GlobalSearch in the header/navbar.

## File Structure
```
server/
├── db/migrations/
│   └── add-full-text-search.sql    (new)
├── services/search/
│   └── search-service.ts           (new)
├── routes/
│   └── search.ts                   (new)
└── scripts/
    └── populate-search-vectors.ts  (new)

client/
├── components/
│   └── GlobalSearch.tsx            (new)
└── hooks/
    └── useDebounce.ts              (new)
```

## Testing
- Search for partial address (e.g., "main str") 
- Search for postcode
- Search for certificate number
- Search for contractor name
- Search for UPRN
- Verify multi-tenant isolation (org A can't see org B results)
- Test with special characters
- Test performance with 100k+ records

## Performance Notes
- GIN indexes make full-text search very fast (milliseconds even on large tables)
- The tsvector column is pre-computed, so searches don't re-parse text
- Triggers keep search vectors in sync automatically
- No additional infrastructure to maintain
- Scales well to millions of records
```

---

## Prompt 4: Upgrade Wouter to TanStack Router (P2)
**Effort:** 3 days | **Impact:** Developer experience

```
Replace Wouter with TanStack Router for type-safe routing with better code splitting and nested routes support.

## Requirements

### 1. Install Dependencies
- @tanstack/react-router
- @tanstack/router-devtools (dev only)
- @tanstack/router-vite-plugin

### 2. Configure Vite Plugin

Update `vite.config.ts`:
```typescript
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    TanStackRouterVite(),
    // ... other plugins
  ],
});
```

### 3. Create Route Tree

Create `client/routes/` directory with file-based routing:

```
client/routes/
├── __root.tsx           # Root layout with nav, sidebar
├── index.tsx            # Dashboard (/)
├── login.tsx            # Login page
├── properties/
│   ├── index.tsx        # Property list (/properties)
│   └── $propertyId.tsx  # Property detail (/properties/:id)
├── certificates/
│   ├── index.tsx        # Certificate list
│   ├── upload.tsx       # Upload page
│   └── $certificateId.tsx
├── compliance/
│   ├── index.tsx        # Compliance dashboard
│   └── $complianceType.tsx
├── reports/
│   └── index.tsx
├── settings/
│   └── index.tsx
└── export/
    └── index.tsx
```

### 4. Create Root Route

Create `client/routes/__root.tsx`:
```typescript
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { AppLayout } from '../components/layout/AppLayout';

export const Route = createRootRoute({
  component: () => (
    <AppLayout>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </AppLayout>
  ),
});
```

### 5. Create Route Components

For each route file, follow this pattern:

```typescript
// client/routes/properties/$propertyId.tsx
import { createFileRoute } from '@tanstack/react-router';
import { PropertyDetail } from '../../components/properties/PropertyDetail';

export const Route = createFileRoute('/properties/$propertyId')({
  // Type-safe params
  parseParams: (params) => ({
    propertyId: params.propertyId,
  }),
  
  // Optional: load data before render
  loader: async ({ params }) => {
    return queryClient.ensureQueryData(propertyQueryOptions(params.propertyId));
  },
  
  // Optional: pending UI while loading
  pendingComponent: () => <PropertyDetailSkeleton />,
  
  // Optional: error boundary
  errorComponent: ({ error }) => <PropertyError error={error} />,
  
  component: PropertyDetailRoute,
});

function PropertyDetailRoute() {
  const { propertyId } = Route.useParams();
  return <PropertyDetail propertyId={propertyId} />;
}
```

### 6. Create Router Instance

Create `client/router.tsx`:
```typescript
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen'; // Auto-generated

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent', // Preload on hover
  context: {
    queryClient: undefined!, // Will be set in App
  },
});

// Type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

### 7. Update App Entry Point

Update `client/App.tsx`:
```typescript
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import { queryClient } from './lib/query-client';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ queryClient }} />
    </QueryClientProvider>
  );
}
```

### 8. Update Navigation Components

Replace Wouter's `<Link>` and `useLocation`:

```typescript
// Before (Wouter)
import { Link, useLocation } from 'wouter';
<Link href="/properties">Properties</Link>

// After (TanStack Router)  
import { Link, useLocation } from '@tanstack/react-router';
<Link to="/properties">Properties</Link>
```

Update all components using:
- `<Link>` - change `href` to `to`
- `useLocation()` - API is similar
- `useRoute()` - replace with `useParams()` or `useSearch()`
- `useNavigate()` - replace with `useNavigate()`

### 9. Add Search Params (Type-Safe Query Strings)

For routes with filters (e.g., certificate list):

```typescript
// client/routes/certificates/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const certificateSearchSchema = z.object({
  status: z.enum(['all', 'valid', 'expired', 'expiring']).optional(),
  complianceType: z.string().optional(),
  page: z.number().optional().default(1),
});

export const Route = createFileRoute('/certificates/')({
  validateSearch: certificateSearchSchema,
  component: CertificateListRoute,
});

function CertificateListRoute() {
  const { status, complianceType, page } = Route.useSearch();
  const navigate = Route.useNavigate();
  
  // Type-safe navigation with search params
  const setFilter = (newStatus: string) => {
    navigate({ search: { status: newStatus, page: 1 } });
  };
  
  return <CertificateList status={status} type={complianceType} page={page} />;
}
```

### 10. Add Auth Guards

Create `client/routes/_authenticated.tsx` for protected routes:
```typescript
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
});
```

Then nest protected routes under `_authenticated/`.

### 11. Add Breadcrumbs

Create `client/components/Breadcrumbs.tsx`:
```typescript
import { useMatches } from '@tanstack/react-router';

export function Breadcrumbs() {
  const matches = useMatches();
  
  return (
    <nav>
      {matches.map((match) => (
        <Link key={match.id} to={match.pathname}>
          {match.routeContext?.title || match.pathname}
        </Link>
      ))}
    </nav>
  );
}
```

### 12. Remove Wouter

After migration is complete:
- Uninstall: `npm uninstall wouter`
- Remove any remaining wouter imports

## Migration Checklist
- [ ] Install TanStack Router
- [ ] Configure Vite plugin  
- [ ] Create route tree files
- [ ] Update App.tsx
- [ ] Migrate all Link components
- [ ] Migrate all navigation hooks
- [ ] Add search param validation
- [ ] Add route guards
- [ ] Test all routes
- [ ] Remove Wouter

## Testing
- Navigate to all routes
- Test back/forward browser buttons
- Test search param persistence
- Test protected route redirects
- Verify code splitting in network tab
```

---

## Prompt 5: Add Full Observability Stack (P2)
**Effort:** 1 week | **Impact:** Operations

```
Enhance observability with structured logging, distributed tracing, metrics, and health checks.

## Requirements

### 1. Install Dependencies
- @sentry/node (may already have)
- prom-client (Prometheus metrics)
- cls-hooked or AsyncLocalStorage (request context)

### 2. Enhance Pino Logging

Update `server/lib/logger.ts`:

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
      service: 'complianceai',
      version: process.env.npm_package_version,
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'apiKey'],
    censor: '[REDACTED]',
  },
});

// Child logger with request context
export function createRequestLogger(requestId: string, organisationId?: string) {
  return logger.child({ requestId, organisationId });
}
```

### 3. Add Request Context Middleware

Create `server/middleware/request-context.ts`:

```typescript
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

interface RequestContext {
  requestId: string;
  organisationId?: string;
  userId?: string;
  startTime: number;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const context: RequestContext = {
    requestId: req.headers['x-request-id'] as string || randomUUID(),
    organisationId: req.user?.organisationId,
    userId: req.user?.id,
    startTime: Date.now(),
  };
  
  // Add to response headers
  res.setHeader('x-request-id', context.requestId);
  
  requestContext.run(context, () => next());
}

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}
```

### 4. Add Prometheus Metrics

Create `server/lib/metrics.ts`:

```typescript
import client from 'prom-client';

// Enable default metrics (memory, CPU, etc.)
client.collectDefaultMetrics({ prefix: 'complianceai_' });

// Custom metrics
export const httpRequestDuration = new client.Histogram({
  name: 'complianceai_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const httpRequestTotal = new client.Counter({
  name: 'complianceai_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const certificateProcessingDuration = new client.Histogram({
  name: 'complianceai_certificate_processing_seconds',
  help: 'Time to process a certificate',
  labelNames: ['compliance_type', 'extraction_tier'],
  buckets: [1, 5, 10, 30, 60, 120],
});

export const certificateProcessingTotal = new client.Counter({
  name: 'complianceai_certificates_processed_total',
  help: 'Total certificates processed',
  labelNames: ['compliance_type', 'extraction_tier', 'status'],
});

export const activeJobs = new client.Gauge({
  name: 'complianceai_active_jobs',
  help: 'Number of active background jobs',
  labelNames: ['job_type'],
});

export const complianceScore = new client.Gauge({
  name: 'complianceai_compliance_score',
  help: 'Current compliance score by organisation and type',
  labelNames: ['organisation_id', 'compliance_type'],
});

// Export metrics endpoint handler
export async function metricsHandler(req: Request, res: Response) {
  res.set('Content-Type', client.register.contentType);
  res.send(await client.register.metrics());
}
```

### 5. Add Metrics Middleware

Create `server/middleware/metrics.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestTotal } from '../lib/metrics';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const labels = {
      method: req.method,
      route: route,
      status_code: res.statusCode.toString(),
    };
    
    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
  });
  
  next();
}
```

### 6. Enhance Sentry Integration

Update `server/lib/sentry.ts`:

```typescript
import * as Sentry from '@sentry/node';
import { getRequestContext } from '../middleware/request-context';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.npm_package_version,
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Add request context to events
  beforeSend(event) {
    const context = getRequestContext();
    if (context) {
      event.tags = {
        ...event.tags,
        requestId: context.requestId,
        organisationId: context.organisationId,
      };
    }
    return event;
  },
  
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
    new Sentry.Integrations.Postgres(),
  ],
});

// Wrap async functions with Sentry
export function withSentry<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return Sentry.startSpan({ name, op: 'function' }, async (span) => {
    try {
      return await fn();
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  });
}
```

### 7. Create Health Check Endpoints

Create `server/routes/health.ts`:

```typescript
import { Router } from 'express';
import { db } from '../db';
import { metricsHandler } from '../lib/metrics';

const router = Router();

// Liveness probe - is the process running?
router.get('/health/live', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness probe - can we serve traffic?
router.get('/health/ready', async (req, res) => {
  const checks = {
    database: false,
    storage: false,
  };
  
  try {
    // Check database
    await db.execute('SELECT 1');
    checks.database = true;
  } catch (e) {
    // Database check failed
  }
  
  try {
    // Check storage (Replit Object Storage)
    // Add your storage health check here
    checks.storage = true;
  } catch (e) {
    // Storage check failed
  }
  
  const allHealthy = Object.values(checks).every(Boolean);
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// Detailed health with dependencies
router.get('/health/detailed', async (req, res) => {
  const checks = {
    database: { status: 'unknown', latencyMs: 0 },
    storage: { status: 'unknown', latencyMs: 0 },
    meilisearch: { status: 'unknown', latencyMs: 0 },
    documentIntelligence: { status: 'unknown', latencyMs: 0 },
  };
  
  // Database check with latency
  const dbStart = Date.now();
  try {
    await db.execute('SELECT 1');
    checks.database = { status: 'healthy', latencyMs: Date.now() - dbStart };
  } catch (e) {
    checks.database = { status: 'unhealthy', latencyMs: Date.now() - dbStart, error: e.message };
  }
  
  // Add other checks similarly...
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks,
  });
});

// Prometheus metrics endpoint
router.get('/metrics', metricsHandler);

export default router;
```

### 8. Add Structured Logging to Key Operations

Update certificate processing and other key services to log with context:

```typescript
import { logger } from '../lib/logger';
import { getRequestContext } from '../middleware/request-context';
import { certificateProcessingDuration, certificateProcessingTotal } from '../lib/metrics';

async function processCertificate(fileBuffer: Buffer, filename: string) {
  const ctx = getRequestContext();
  const log = logger.child({ 
    requestId: ctx?.requestId,
    organisationId: ctx?.organisationId,
    filename 
  });
  
  const startTime = Date.now();
  
  log.info('Starting certificate processing');
  
  try {
    const result = await extractCertificateData(fileBuffer, filename);
    
    const duration = (Date.now() - startTime) / 1000;
    
    log.info({ 
      complianceType: result.complianceType,
      extractionTier: result.extractionTier,
      confidence: result.confidence,
      durationSeconds: duration,
    }, 'Certificate processed successfully');
    
    // Record metrics
    certificateProcessingDuration.observe(
      { compliance_type: result.complianceType, extraction_tier: result.extractionTier },
      duration
    );
    certificateProcessingTotal.inc(
      { compliance_type: result.complianceType, extraction_tier: result.extractionTier, status: 'success' }
    );
    
    return result;
  } catch (error) {
    log.error({ error: error.message }, 'Certificate processing failed');
    
    certificateProcessingTotal.inc(
      { compliance_type: 'unknown', extraction_tier: 'unknown', status: 'error' }
    );
    
    throw error;
  }
}
```

### 9. Update Express App

Update `server/index.ts` to include all middleware:

```typescript
import * as Sentry from '@sentry/node';
import { requestContextMiddleware } from './middleware/request-context';
import { metricsMiddleware } from './middleware/metrics';
import healthRoutes from './routes/health';

// Sentry must be first
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// Then our middleware
app.use(requestContextMiddleware);
app.use(metricsMiddleware);

// Health routes (no auth required)
app.use('/', healthRoutes);

// ... other routes ...

// Sentry error handler last
app.use(Sentry.Handlers.errorHandler());
```

### 10. Create Grafana Dashboard Config (Optional)

Create `monitoring/grafana-dashboard.json` with panels for:
- Request rate and latency
- Error rate by endpoint
- Certificate processing times
- Active jobs
- Memory and CPU usage

## Environment Variables
```
LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn
SENTRY_ENVIRONMENT=production
```

## File Structure
```
server/
├── lib/
│   ├── logger.ts         (enhance)
│   ├── metrics.ts         (new)
│   └── sentry.ts          (enhance)
├── middleware/
│   ├── request-context.ts (new)
│   └── metrics.ts         (new)
└── routes/
    └── health.ts          (new)

monitoring/
└── grafana-dashboard.json (optional)
```

## Verification
- Check /health/live returns 200
- Check /health/ready returns 200 with all checks passing
- Check /metrics returns Prometheus format
- Verify logs include requestId
- Trigger an error and verify it appears in Sentry with context
```

---

## Execution Order

1. **OpenAPI Documentation** (P1) - Foundation for API consumers
2. **Tiered Document Intelligence** (P1) - Cost savings with Azure + Textract + Claude fallback
3. **Observability Stack** (P2) - Need visibility before other changes
4. **TanStack Router** (P2) - Developer experience improvement
5. **PostgreSQL Full-Text Search** (P2) - Enhanced search capability (no extra infrastructure)

Each prompt is self-contained and can be executed independently, though the suggested order minimizes dependencies.

---

## Summary

| Prompt | Action | Effort | Key Changes |
|--------|--------|--------|-------------|
| **1** | Tiered Document Intelligence | 1 week | Azure → Textract → Claude fallback chain, cost tracking |
| **2** | OpenAPI Documentation | 3 days | zod-to-openapi, Swagger UI at `/api/docs` |
| **3** | PostgreSQL Full-Text Search | 1 week | tsvector columns, GIN indexes, no external dependencies |
| **4** | TanStack Router | 3 days | Type-safe routing, search params, code splitting |
| **5** | Observability Stack | 1 week | Prometheus metrics, Pino logging, health endpoints |

### Benefits of Updated Approach

**Tiered Extraction (Prompt 1):**
- Azure Document Intelligence: Best for structured forms (fast, cheap)
- AWS Textract: Reliable OCR fallback, good AWS integration
- Claude Vision: Complex/handwritten documents only
- ~70% cost reduction on standard certificates

**PostgreSQL Full-Text Search (Prompt 3):**
- No additional infrastructure to deploy/maintain
- No sync issues (triggers keep vectors updated)
- Scales to millions of records with GIN indexes
- Built-in highlighting and ranking
- Zero additional cost
