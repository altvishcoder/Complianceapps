import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Bearer token authentication for external API access. Obtain a token from your organisation administrator.',
});

registry.registerComponent('securitySchemes', 'sessionAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'connect.sid',
  description: 'Session-based authentication via HTTP-only cookie. Established after successful login.',
});

const ErrorResponse = z.object({
  error: z.string().describe('Human-readable error message'),
  message: z.string().optional().describe('Alternative error message field'),
  errors: z.array(z.object({
    field: z.string().optional().describe('Field that caused the validation error'),
    message: z.string().describe('Specific error message for this field'),
  })).optional().describe('Array of field-level validation errors'),
}).openapi('Error');

const PaginationParams = [
  {
    name: 'page',
    in: 'query' as const,
    required: false,
    schema: { type: 'integer' as const, default: 1, minimum: 1 },
    description: 'Page number for pagination (1-indexed)',
    example: 1,
  },
  {
    name: 'limit',
    in: 'query' as const,
    required: false,
    schema: { type: 'integer' as const, default: 50, minimum: 1, maximum: 100 },
    description: 'Number of items per page (max 100)',
    example: 50,
  },
];

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  summary: 'Authenticate user and create session',
  description: `
Authenticates a user with username and password credentials and establishes a session.

## Authentication Flow
1. Submit username and password
2. Server validates credentials against bcrypt-hashed passwords
3. On success, a session cookie is set (connect.sid)
4. Use the session cookie for subsequent authenticated requests

## Account Lockout Protection
- After 5 failed login attempts, the account is temporarily locked
- Lockout duration: 15 minutes
- Lockout is per-username to prevent brute force attacks

## Session Duration
- Sessions are valid for 7 days
- Sessions refresh automatically on activity
  `,
  tags: ['Authentication'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            username: z.string().min(1).describe('User account username'),
            password: z.string().min(1).describe('User account password'),
          }),
          example: {
            username: 'john.smith',
            password: 'SecureP@ssw0rd123',
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful - session cookie set',
      content: {
        'application/json': {
          schema: z.object({
            user: z.object({
              id: z.string().uuid().describe('Unique user identifier'),
              username: z.string().describe('User account username'),
              email: z.string().email().describe('User email address'),
              name: z.string().describe('User display name'),
              role: z.enum(['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'COMPLIANCE_MANAGER', 'ADMIN', 'MANAGER', 'OFFICER', 'VIEWER']).describe('User role in the system'),
              organisationId: z.string().describe('ID of the user organisation'),
            }),
          }),
          example: {
            user: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              username: 'john.smith',
              email: 'john.smith@housing.org.uk',
              name: 'John Smith',
              role: 'COMPLIANCE_MANAGER',
              organisationId: 'org-001',
            },
          },
        },
      },
    },
    401: {
      description: 'Invalid credentials - username or password incorrect',
      content: {
        'application/json': {
          schema: ErrorResponse,
          example: {
            error: 'Invalid username or password',
          },
        },
      },
    },
    429: {
      description: 'Account temporarily locked due to too many failed attempts',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            lockedUntil: z.number().describe('Minutes until account unlocks'),
          }),
          example: {
            error: 'Account temporarily locked due to too many failed attempts. Try again in 12 minute(s).',
            lockedUntil: 12,
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/logout',
  summary: 'End user session',
  description: `
Terminates the current user session and clears the session cookie.

## Logout Process
1. Server destroys the session
2. Session cookie is cleared
3. All subsequent requests will be unauthenticated

## Audit Logging
- Logout events are recorded for security auditing
- Includes timestamp, user ID, and IP address
  `,
  tags: ['Authentication'],
  security: [{ sessionAuth: [] }],
  responses: {
    200: {
      description: 'Logout successful - session destroyed',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
          example: {
            message: 'Logged out successfully',
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  summary: 'Get current authenticated user',
  description: `
Returns the details of the currently authenticated user based on their session.

## Use Cases
- Verify if a session is still valid
- Retrieve current user details after page refresh
- Check user role and permissions

## Response
Returns the user object without sensitive fields (password hash, etc.)
  `,
  tags: ['Authentication'],
  security: [{ sessionAuth: [] }],
  responses: {
    200: {
      description: 'Current user details',
      content: {
        'application/json': {
          schema: z.object({
            user: z.object({
              id: z.string().uuid(),
              username: z.string(),
              email: z.string().email(),
              name: z.string(),
              role: z.string(),
              organisationId: z.string(),
            }),
          }),
          example: {
            user: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              username: 'john.smith',
              email: 'john.smith@housing.org.uk',
              name: 'John Smith',
              role: 'COMPLIANCE_MANAGER',
              organisationId: 'org-001',
            },
          },
        },
      },
    },
    401: {
      description: 'Not authenticated - session invalid or expired',
      content: {
        'application/json': {
          schema: ErrorResponse,
          example: {
            error: 'Not authenticated',
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/change-password',
  summary: 'Change user password',
  description: `
Allows a user to change their password or an admin to reset another user's password.

## Password Requirements
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*)

## Admin Password Reset
- Admins can reset other users' passwords without providing the current password
- Set \`userId\` parameter to target a specific user
  `,
  tags: ['Authentication'],
  security: [{ sessionAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            currentPassword: z.string().optional().describe('Current password (required for self-change)'),
            newPassword: z.string().min(12).describe('New password meeting security requirements'),
            userId: z.string().optional().describe('Target user ID (admin only)'),
          }),
          example: {
            currentPassword: 'OldP@ssw0rd123',
            newPassword: 'NewSecureP@ss456!',
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Password changed successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          example: {
            success: true,
            message: 'Password changed successfully',
          },
        },
      },
    },
    400: {
      description: 'Password does not meet security requirements',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            requirements: z.array(z.string()),
          }),
          example: {
            error: 'Password does not meet security requirements',
            requirements: ['Must contain at least one special character'],
          },
        },
      },
    },
    401: {
      description: 'Current password is incorrect',
      content: {
        'application/json': {
          schema: ErrorResponse,
          example: {
            error: 'Current password is incorrect',
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/password-policy',
  summary: 'Get password policy requirements',
  description: 'Returns the current password policy requirements for display to users during password creation or change.',
  tags: ['Authentication'],
  responses: {
    200: {
      description: 'Password policy requirements',
      content: {
        'application/json': {
          schema: z.object({
            requirements: z.array(z.string()),
          }),
          example: {
            requirements: [
              'Minimum 12 characters',
              'At least one uppercase letter (A-Z)',
              'At least one lowercase letter (a-z)',
              'At least one number (0-9)',
              'At least one special character (!@#$%^&*)',
            ],
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/schemes',
  summary: 'List all schemes',
  description: `
Returns all schemes (housing developments/estates) in the organisation.

## Asset Hierarchy
Schemes are the top level of the UKHDS asset hierarchy:
\`\`\`
Organisation → Scheme → Block → Property → Unit → Component
\`\`\`

## Filtering
By default, returns schemes for the authenticated user's organisation.
  `,
  tags: ['Schemes'],
  security: [{ sessionAuth: [] }],
  parameters: [
    {
      name: 'search',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Search by scheme name or reference',
      example: 'Riverside',
    },
    ...PaginationParams,
  ],
  responses: {
    200: {
      description: 'List of schemes with compliance summary',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string().uuid(),
            name: z.string().describe('Scheme name'),
            reference: z.string().describe('Internal reference code'),
            description: z.string().nullable(),
            propertyCount: z.number().describe('Total properties in scheme'),
            complianceStatus: z.enum(['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT', 'UNKNOWN']),
            address: z.object({
              line1: z.string(),
              city: z.string(),
              postcode: z.string(),
            }).nullable(),
          })),
          example: [
            {
              id: '550e8400-e29b-41d4-a716-446655440001',
              name: 'Riverside Gardens',
              reference: 'RG-001',
              description: 'Mixed-tenure development with 120 units',
              propertyCount: 45,
              complianceStatus: 'COMPLIANT',
              address: {
                line1: 'Riverside Road',
                city: 'London',
                postcode: 'SE1 7AB',
              },
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440002',
              name: 'Oak Tree Estate',
              reference: 'OTE-002',
              description: 'Social housing estate',
              propertyCount: 78,
              complianceStatus: 'PARTIAL',
              address: {
                line1: 'Oak Tree Lane',
                city: 'Manchester',
                postcode: 'M1 4QD',
              },
            },
          ],
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/blocks',
  summary: 'List all blocks',
  description: `
Returns blocks (buildings within a scheme). Blocks can be filtered by scheme.

## Asset Hierarchy
\`\`\`
Organisation → Scheme → **Block** → Property → Unit → Component
\`\`\`

## Block Types
- TOWER - High-rise building (typically 10+ floors)
- LOW_RISE - Low-rise building (1-3 floors)
- MID_RISE - Mid-rise building (4-9 floors)
- HOUSE - Individual or terraced houses
- BUNGALOW - Single-storey dwellings
  `,
  tags: ['Blocks'],
  security: [{ sessionAuth: [] }],
  parameters: [
    {
      name: 'schemeId',
      in: 'query',
      required: false,
      schema: { type: 'string', format: 'uuid' },
      description: 'Filter blocks by scheme ID',
    },
    {
      name: 'search',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Search by block name or reference',
    },
    ...PaginationParams,
  ],
  responses: {
    200: {
      description: 'List of blocks with property counts',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string().uuid(),
            schemeId: z.string().uuid(),
            name: z.string(),
            reference: z.string(),
            blockType: z.string(),
            floors: z.number().nullable(),
            propertyCount: z.number(),
            complianceStatus: z.enum(['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT', 'UNKNOWN']),
          })),
          example: [
            {
              id: '550e8400-e29b-41d4-a716-446655440010',
              schemeId: '550e8400-e29b-41d4-a716-446655440001',
              name: 'Block A - River View',
              reference: 'RG-A',
              blockType: 'TOWER',
              floors: 12,
              propertyCount: 24,
              complianceStatus: 'COMPLIANT',
            },
          ],
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/properties',
  summary: 'List properties',
  description: `
Returns properties (dwellings) with filtering and search capabilities.

## Asset Hierarchy
\`\`\`
Organisation → Scheme → Block → **Property** → Unit → Component
\`\`\`

## Property Types
- HOUSE - Semi-detached or detached house
- FLAT - Standard flat/apartment
- BUNGALOW - Single-storey dwelling
- MAISONETTE - Multi-floor flat with own entrance
- BEDSIT - Single room accommodation
- STUDIO - Open-plan studio flat

## Tenure Types (UK Housing)
- SOCIAL_RENT - Council/HA social rent
- AFFORDABLE_RENT - Below market rent (up to 80%)
- SHARED_OWNERSHIP - Part-buy/part-rent
- LEASEHOLD - Leaseholder owns lease
- TEMPORARY - Temporary accommodation
  `,
  tags: ['Properties'],
  security: [{ sessionAuth: [] }],
  parameters: [
    {
      name: 'blockId',
      in: 'query',
      required: false,
      schema: { type: 'string', format: 'uuid' },
      description: 'Filter by block ID',
    },
    {
      name: 'schemeId',
      in: 'query',
      required: false,
      schema: { type: 'string', format: 'uuid' },
      description: 'Filter by scheme ID',
    },
    {
      name: 'search',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Search by address, UPRN, or tenant name',
      example: 'SE1 7AB',
    },
    {
      name: 'complianceStatus',
      in: 'query',
      required: false,
      schema: { type: 'string', enum: ['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT', 'UNKNOWN'] },
      description: 'Filter by compliance status',
    },
    {
      name: 'hasGas',
      in: 'query',
      required: false,
      schema: { type: 'boolean' },
      description: 'Filter properties with/without gas supply',
    },
    ...PaginationParams,
  ],
  responses: {
    200: {
      description: 'List of properties with compliance status',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string().uuid(),
            uprn: z.string().describe('Unique Property Reference Number'),
            addressLine1: z.string(),
            addressLine2: z.string().nullable(),
            city: z.string(),
            postcode: z.string(),
            propertyType: z.string(),
            tenure: z.string(),
            bedrooms: z.number().nullable(),
            hasGas: z.boolean(),
            complianceStatus: z.enum(['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT', 'UNKNOWN']),
            blockId: z.string().uuid(),
            blockName: z.string(),
            schemeName: z.string(),
          })),
          example: [
            {
              id: '550e8400-e29b-41d4-a716-446655440100',
              uprn: '100023456789',
              addressLine1: 'Flat 12, River View',
              addressLine2: 'Riverside Gardens',
              city: 'London',
              postcode: 'SE1 7AB',
              propertyType: 'FLAT',
              tenure: 'SOCIAL_RENT',
              bedrooms: 2,
              hasGas: true,
              complianceStatus: 'COMPLIANT',
              blockId: '550e8400-e29b-41d4-a716-446655440010',
              blockName: 'Block A - River View',
              schemeName: 'Riverside Gardens',
            },
          ],
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/properties',
  summary: 'Create a new property',
  description: `
Creates a new property within a block.

## Required Fields
- blockId: The block this property belongs to
- uprn: Unique Property Reference Number (UK standard)
- addressLine1, city, postcode: Full address
- propertyType: Type of dwelling
- tenure: Housing tenure type

## UPRN
The Unique Property Reference Number is a 12-digit identifier assigned to every addressable location in Great Britain. Obtain from Ordnance Survey or local authority data.
  `,
  tags: ['Properties'],
  security: [{ sessionAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            blockId: z.string().uuid().describe('Block ID this property belongs to'),
            uprn: z.string().min(1).max(12).describe('Unique Property Reference Number'),
            addressLine1: z.string().min(1).describe('First line of address'),
            addressLine2: z.string().optional().describe('Second line of address'),
            city: z.string().min(1).describe('City or town'),
            postcode: z.string().regex(/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i).describe('UK postcode'),
            propertyType: z.enum(['HOUSE', 'FLAT', 'BUNGALOW', 'MAISONETTE', 'BEDSIT', 'STUDIO']),
            tenure: z.enum(['SOCIAL_RENT', 'AFFORDABLE_RENT', 'SHARED_OWNERSHIP', 'LEASEHOLD', 'TEMPORARY']),
            bedrooms: z.number().min(0).max(10).optional().describe('Number of bedrooms'),
            hasGas: z.boolean().optional().describe('Whether property has gas supply'),
          }),
          example: {
            blockId: '550e8400-e29b-41d4-a716-446655440010',
            uprn: '100023456790',
            addressLine1: 'Flat 13, River View',
            addressLine2: 'Riverside Gardens',
            city: 'London',
            postcode: 'SE1 7AB',
            propertyType: 'FLAT',
            tenure: 'SOCIAL_RENT',
            bedrooms: 2,
            hasGas: true,
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Property created successfully',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string().uuid(),
            uprn: z.string(),
            addressLine1: z.string(),
            message: z.string(),
          }),
          example: {
            id: '550e8400-e29b-41d4-a716-446655440101',
            uprn: '100023456790',
            addressLine1: 'Flat 13, River View',
            message: 'Property created successfully',
          },
        },
      },
    },
    400: {
      description: 'Validation error - invalid data provided',
      content: {
        'application/json': {
          schema: ErrorResponse,
          example: {
            error: 'Validation error',
            errors: [
              { field: 'postcode', message: 'Invalid UK postcode format' },
            ],
          },
        },
      },
    },
    409: {
      description: 'Conflict - UPRN already exists',
      content: {
        'application/json': {
          schema: ErrorResponse,
          example: {
            error: 'A property with this UPRN already exists',
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/certificates',
  summary: 'List compliance certificates',
  description: `
Returns compliance certificates with filtering options.

## Certificate Types (UK Social Housing)
ComplianceAI supports 80+ certificate types across 16 compliance streams:

### Key Certificate Types
- **GAS_SAFETY** - Annual gas safety check (CP12)
- **EICR** - Electrical Installation Condition Report (5-year)
- **EPC** - Energy Performance Certificate (10-year)
- **FIRE_RISK_ASSESSMENT** - Fire Risk Assessment
- **LEGIONELLA_ASSESSMENT** - Legionella Risk Assessment
- **ASBESTOS_SURVEY** - Asbestos Management Survey
- **LIFT_LOLER** - LOLER lift inspection (6-monthly)

## Compliance Status
- **VALID** - Certificate is current and compliant
- **EXPIRING_SOON** - Expires within 30 days
- **EXPIRED** - Past expiry date
- **PENDING** - Awaiting processing
- **REJECTED** - Failed validation
  `,
  tags: ['Certificates'],
  security: [{ sessionAuth: [] }],
  parameters: [
    {
      name: 'propertyId',
      in: 'query',
      required: false,
      schema: { type: 'string', format: 'uuid' },
      description: 'Filter by property ID',
    },
    {
      name: 'type',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Filter by certificate type (e.g., GAS_SAFETY, EICR)',
      example: 'GAS_SAFETY',
    },
    {
      name: 'status',
      in: 'query',
      required: false,
      schema: { type: 'string', enum: ['VALID', 'EXPIRING_SOON', 'EXPIRED', 'PENDING', 'REJECTED'] },
      description: 'Filter by certificate status',
    },
    {
      name: 'expiringWithinDays',
      in: 'query',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 365 },
      description: 'Find certificates expiring within N days',
      example: 30,
    },
    ...PaginationParams,
  ],
  responses: {
    200: {
      description: 'List of certificates',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string().uuid(),
            propertyId: z.string().uuid(),
            propertyAddress: z.string(),
            type: z.string(),
            typeName: z.string().describe('Human-readable certificate type name'),
            status: z.string(),
            issueDate: z.string().datetime().nullable(),
            expiryDate: z.string().datetime().nullable(),
            engineerName: z.string().nullable(),
            engineerRegistration: z.string().nullable(),
            outcome: z.string().nullable().describe('Inspection outcome (PASS, FAIL, etc.)'),
            defectsCount: z.number().describe('Number of defects identified'),
          })),
          example: [
            {
              id: '550e8400-e29b-41d4-a716-446655440200',
              propertyId: '550e8400-e29b-41d4-a716-446655440100',
              propertyAddress: 'Flat 12, River View, SE1 7AB',
              type: 'GAS_SAFETY',
              typeName: 'Gas Safety Certificate (CP12)',
              status: 'VALID',
              issueDate: '2024-06-15T00:00:00Z',
              expiryDate: '2025-06-14T00:00:00Z',
              engineerName: 'James Wilson',
              engineerRegistration: 'GSR123456',
              outcome: 'PASS',
              defectsCount: 0,
            },
          ],
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/certificates',
  summary: 'Create a compliance certificate',
  description: `
Creates a new compliance certificate for a property.

## Certificate Creation Workflow
1. Certificate record is created with provided details
2. If a file is uploaded, AI extraction processes the document
3. Extracted data populates certificate fields
4. Compliance rules are evaluated
5. Remedial actions are auto-generated for any defects

## AI Document Extraction
For best results, upload clear scans of:
- Gas Safety Certificates (CP12)
- Electrical Installation Condition Reports
- Fire Risk Assessments
- Energy Performance Certificates

The AI will extract:
- Engineer/inspector details
- Inspection dates and outcomes
- Equipment/appliance information
- Defects and recommendations
  `,
  tags: ['Certificates'],
  security: [{ sessionAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            propertyId: z.string().uuid().describe('Property ID'),
            type: z.enum(['GAS_SAFETY', 'EICR', 'EPC', 'FIRE_RISK_ASSESSMENT', 'LEGIONELLA_ASSESSMENT', 'ASBESTOS_SURVEY', 'LIFT_LOLER', 'OTHER']).describe('Certificate type'),
            issueDate: z.string().datetime().optional().describe('Certificate issue date (ISO 8601)'),
            expiryDate: z.string().datetime().optional().describe('Certificate expiry date (ISO 8601)'),
            engineerName: z.string().optional().describe('Name of certifying engineer'),
            engineerRegistration: z.string().optional().describe('Engineer registration number (e.g., Gas Safe)'),
            outcome: z.enum(['PASS', 'SATISFACTORY', 'UNSATISFACTORY', 'FAIL', 'IMMEDIATE_DANGER']).optional(),
            notes: z.string().optional().describe('Additional notes'),
          }),
          example: {
            propertyId: '550e8400-e29b-41d4-a716-446655440100',
            type: 'GAS_SAFETY',
            issueDate: '2024-06-15T00:00:00Z',
            expiryDate: '2025-06-14T00:00:00Z',
            engineerName: 'James Wilson',
            engineerRegistration: 'GSR123456',
            outcome: 'PASS',
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Certificate created successfully',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string().uuid(),
            propertyId: z.string().uuid(),
            type: z.string(),
            status: z.string(),
            message: z.string(),
          }),
          example: {
            id: '550e8400-e29b-41d4-a716-446655440201',
            propertyId: '550e8400-e29b-41d4-a716-446655440100',
            type: 'GAS_SAFETY',
            status: 'VALID',
            message: 'Certificate created successfully',
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/remedial-actions',
  summary: 'List remedial actions',
  description: `
Returns remedial actions (work required following inspections).

## Remedial Action Workflow
1. **OPEN** - Action identified, awaiting scheduling
2. **IN_PROGRESS** - Work scheduled or underway
3. **COMPLETED** - Work finished, awaiting verification
4. **VERIFIED** - Completion verified, action closed
5. **CANCELLED** - Action cancelled (with reason)

## Severity Levels (UK Regulatory)
Based on UK housing safety regulations:
- **IMMEDIATE** - Immediate danger to life (24 hours)
- **URGENT** - Serious hazard requiring prompt action (7 days)
- **PRIORITY** - Significant defect (28 days)
- **ROUTINE** - Minor defect, next planned maintenance
- **ADVISORY** - Recommendation, no safety impact

## Cost Estimates
Actions include estimated cost ranges based on industry standard rates.
  `,
  tags: ['Remedial Actions'],
  security: [{ sessionAuth: [] }],
  parameters: [
    {
      name: 'status',
      in: 'query',
      required: false,
      schema: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED'] },
      description: 'Filter by action status',
    },
    {
      name: 'severity',
      in: 'query',
      required: false,
      schema: { type: 'string', enum: ['IMMEDIATE', 'URGENT', 'PRIORITY', 'ROUTINE', 'ADVISORY'] },
      description: 'Filter by severity level',
    },
    {
      name: 'certificateId',
      in: 'query',
      required: false,
      schema: { type: 'string', format: 'uuid' },
      description: 'Filter by source certificate',
    },
    {
      name: 'propertyId',
      in: 'query',
      required: false,
      schema: { type: 'string', format: 'uuid' },
      description: 'Filter by property',
    },
    {
      name: 'dueWithinDays',
      in: 'query',
      required: false,
      schema: { type: 'integer', minimum: 1 },
      description: 'Find actions due within N days',
      example: 7,
    },
    ...PaginationParams,
  ],
  responses: {
    200: {
      description: 'List of remedial actions',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string().uuid(),
            certificateId: z.string().uuid(),
            propertyId: z.string().uuid(),
            propertyAddress: z.string(),
            description: z.string(),
            severity: z.enum(['IMMEDIATE', 'URGENT', 'PRIORITY', 'ROUTINE', 'ADVISORY']),
            status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED']),
            dueDate: z.string().datetime().nullable(),
            costEstimateLow: z.number().nullable(),
            costEstimateHigh: z.number().nullable(),
            assignedTo: z.string().nullable(),
            legislationRef: z.string().nullable().describe('UK legislation reference'),
          })),
          example: [
            {
              id: '550e8400-e29b-41d4-a716-446655440300',
              certificateId: '550e8400-e29b-41d4-a716-446655440200',
              propertyId: '550e8400-e29b-41d4-a716-446655440100',
              propertyAddress: 'Flat 12, River View, SE1 7AB',
              description: 'Replace faulty CO detector in kitchen',
              severity: 'URGENT',
              status: 'OPEN',
              dueDate: '2024-07-22T00:00:00Z',
              costEstimateLow: 50,
              costEstimateHigh: 100,
              assignedTo: null,
              legislationRef: 'Gas Safety (Installation and Use) Regulations 1998',
            },
          ],
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/ingestion/submit',
  summary: 'Submit certificate via external API',
  description: `
External machine-to-machine endpoint for submitting compliance certificates.

## Authentication
This endpoint requires Bearer token authentication. Obtain an API key from your organisation administrator.

## Async Processing
Certificate submissions are processed asynchronously:
1. File is received and validated
2. Submission ID is returned immediately (HTTP 202)
3. AI extraction processes the document
4. Certificate record is created
5. Webhook notification sent (if configured)

## File Requirements
- Supported formats: PDF, JPEG, PNG
- Maximum file size: 10MB
- Recommended: Clear scans at 300 DPI
- One certificate per file

## Webhook Notifications
Configure a webhook URL to receive processing status updates:
\`\`\`json
{
  "event": "certificate.processed",
  "submissionId": "sub_abc123",
  "status": "SUCCESS",
  "certificateId": "550e8400-...",
  "extractedData": { ... }
}
\`\`\`
  `,
  tags: ['External Ingestion'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.any().describe('Certificate file (PDF, JPEG, or PNG, max 10MB)'),
            propertyRef: z.string().describe('Property reference (UPRN or internal reference)'),
            certificateType: z.string().describe('Certificate type code (e.g., GAS_SAFETY, EICR)'),
            callbackUrl: z.string().url().optional().describe('Webhook URL for processing notifications'),
          }),
        },
      },
    },
  },
  responses: {
    202: {
      description: 'Certificate submission accepted for processing',
      content: {
        'application/json': {
          schema: z.object({
            submissionId: z.string().describe('Unique submission ID for tracking'),
            status: z.literal('QUEUED'),
            message: z.string(),
            estimatedProcessingTime: z.string().describe('Estimated processing time'),
          }),
          example: {
            submissionId: 'sub_abc123def456',
            status: 'QUEUED',
            message: 'Certificate submission accepted for processing',
            estimatedProcessingTime: '30-60 seconds',
          },
        },
      },
    },
    400: {
      description: 'Invalid request - file or parameters invalid',
      content: {
        'application/json': {
          schema: ErrorResponse,
          example: {
            error: 'Invalid file type. Supported: PDF, JPEG, PNG',
          },
        },
      },
    },
    401: {
      description: 'Invalid or missing API key',
      content: {
        'application/json': {
          schema: ErrorResponse,
          example: {
            error: 'Invalid API key',
          },
        },
      },
    },
    404: {
      description: 'Property not found with given reference',
      content: {
        'application/json': {
          schema: ErrorResponse,
          example: {
            error: 'No property found with reference: 100023456999',
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/ingestion/status/{submissionId}',
  summary: 'Check ingestion submission status',
  description: 'Check the processing status of a certificate submission.',
  tags: ['External Ingestion'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      submissionId: z.string().describe('Submission ID returned from submit endpoint'),
    }),
  },
  responses: {
    200: {
      description: 'Submission status',
      content: {
        'application/json': {
          schema: z.object({
            submissionId: z.string(),
            status: z.enum(['QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED']),
            certificateId: z.string().uuid().nullable().describe('Created certificate ID (if successful)'),
            error: z.string().nullable().describe('Error message (if failed)'),
            createdAt: z.string().datetime(),
            completedAt: z.string().datetime().nullable(),
          }),
          example: {
            submissionId: 'sub_abc123def456',
            status: 'SUCCESS',
            certificateId: '550e8400-e29b-41d4-a716-446655440202',
            error: null,
            createdAt: '2024-06-15T10:30:00Z',
            completedAt: '2024-06-15T10:30:45Z',
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/dashboard/stats',
  summary: 'Get dashboard statistics',
  description: `
Returns summary statistics for the compliance dashboard.

## Statistics Included
- Total property and certificate counts
- Certificates expiring within 30/60/90 days
- Outstanding remedial actions by severity
- Compliance rate percentage
- Certificates processed this month
  `,
  tags: ['Dashboard'],
  security: [{ sessionAuth: [] }],
  responses: {
    200: {
      description: 'Dashboard statistics',
      content: {
        'application/json': {
          schema: z.object({
            totalProperties: z.number(),
            totalCertificates: z.number(),
            validCertificates: z.number(),
            expiringSoon: z.object({
              within30Days: z.number(),
              within60Days: z.number(),
              within90Days: z.number(),
            }),
            expiredCertificates: z.number(),
            pendingActions: z.object({
              immediate: z.number(),
              urgent: z.number(),
              priority: z.number(),
              routine: z.number(),
              total: z.number(),
            }),
            complianceRate: z.number().describe('Percentage of properties fully compliant'),
            certificatesThisMonth: z.number(),
          }),
          example: {
            totalProperties: 450,
            totalCertificates: 2340,
            validCertificates: 2180,
            expiringSoon: {
              within30Days: 45,
              within60Days: 92,
              within90Days: 156,
            },
            expiredCertificates: 23,
            pendingActions: {
              immediate: 2,
              urgent: 8,
              priority: 34,
              routine: 67,
              total: 111,
            },
            complianceRate: 94.5,
            certificatesThisMonth: 87,
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/health',
  summary: 'System health check',
  description: `
Returns the health status of all system components.

## Components Checked
- **Database** - PostgreSQL connection and query latency
- **Job Queue** - pg-boss queue status and job counts
- **Memory** - Node.js heap usage
- **Uptime** - Process uptime

## Health Status Values
- **healthy** - All systems operational
- **degraded** - Some components have warnings
- **unhealthy** - Critical component failure
  `,
  tags: ['System'],
  responses: {
    200: {
      description: 'System is healthy',
      content: {
        'application/json': {
          schema: z.object({
            status: z.enum(['healthy', 'degraded', 'unhealthy']),
            timestamp: z.string().datetime(),
            totalLatency: z.number().describe('Total health check duration (ms)'),
            checks: z.object({
              database: z.object({
                status: z.string(),
                latency: z.number().optional(),
              }),
              jobQueue: z.object({
                status: z.string(),
                details: z.any().optional(),
              }),
              memory: z.object({
                status: z.string(),
                details: z.object({
                  heapUsedMB: z.number(),
                  heapTotalMB: z.number(),
                  rssMB: z.number(),
                }),
              }),
              uptime: z.object({
                status: z.string(),
                details: z.object({
                  seconds: z.number(),
                }),
              }),
            }),
          }),
          example: {
            status: 'healthy',
            timestamp: '2024-06-15T10:30:00Z',
            totalLatency: 23,
            checks: {
              database: { status: 'healthy', latency: 5 },
              jobQueue: { status: 'healthy', details: { ingestion: 0, webhook: 0 } },
              memory: { status: 'healthy', details: { heapUsedMB: 128, heapTotalMB: 256, rssMB: 180 } },
              uptime: { status: 'healthy', details: { seconds: 86400 } },
            },
          },
        },
      },
    },
    503: {
      description: 'System is unhealthy',
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('unhealthy'),
            timestamp: z.string().datetime(),
            checks: z.any(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/users',
  summary: 'List all users',
  description: `
Returns all users in the organisation. Requires admin privileges.

## Required Role
- ADMIN or higher (SYSTEM_ADMIN, SUPER_ADMIN, LASHAN_SUPER_USER)

## User Roles (Hierarchy)
1. **LASHAN_SUPER_USER** - Platform super admin (Lashan Digital)
2. **SUPER_ADMIN** - Organisation super administrator
3. **SYSTEM_ADMIN** - System configuration access
4. **COMPLIANCE_MANAGER** - Full compliance management
5. **ADMIN** - Organisation admin
6. **MANAGER** - Team management
7. **OFFICER** - Standard compliance officer
8. **VIEWER** - Read-only access
  `,
  tags: ['Admin'],
  security: [{ sessionAuth: [] }],
  parameters: [
    {
      name: 'role',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Filter by user role',
    },
    {
      name: 'search',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Search by name, email, or username',
    },
    ...PaginationParams,
  ],
  responses: {
    200: {
      description: 'List of users',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string().uuid(),
            username: z.string(),
            email: z.string().email(),
            name: z.string(),
            role: z.string(),
            isActive: z.boolean(),
            lastLoginAt: z.string().datetime().nullable(),
            createdAt: z.string().datetime(),
          })),
          example: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              username: 'john.smith',
              email: 'john.smith@housing.org.uk',
              name: 'John Smith',
              role: 'COMPLIANCE_MANAGER',
              isActive: true,
              lastLoginAt: '2024-06-15T09:00:00Z',
              createdAt: '2024-01-15T00:00:00Z',
            },
          ],
        },
      },
    },
    403: {
      description: 'Forbidden - Admin access required',
      content: {
        'application/json': {
          schema: ErrorResponse,
          example: {
            error: 'Admin access required',
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/compliance-streams',
  summary: 'List compliance streams',
  description: `
Returns all compliance streams (categories of compliance).

## UK Social Housing Compliance Streams
ComplianceAI organises compliance into 16 streams:

1. **Gas & Heating** - Gas safety, boiler servicing
2. **Electrical** - EICR, PAT testing
3. **Energy** - EPC, SAP assessments
4. **Fire Safety** - FRA, fire equipment
5. **Asbestos** - Surveys, management plans
6. **Water Safety** - Legionella, water hygiene
7. **Lifting Equipment** - LOLER inspections
8. **Building Safety** - Structure, cladding (BSA 2022)
9. **External Areas** - Grounds, playgrounds
10. **Security** - Door entry, CCTV
11. **HRB-specific** - High-Rise Building requirements
12. **Housing Health** - HHSRS assessments
13. **Accessibility** - DDA compliance
14. **Pest Control** - Pest inspections
15. **Waste** - Bin stores, recycling
16. **Communal** - Communal area inspections
  `,
  tags: ['Configuration'],
  security: [{ sessionAuth: [] }],
  responses: {
    200: {
      description: 'List of compliance streams',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            code: z.string(),
            description: z.string().nullable(),
            displayOrder: z.number(),
            isSystem: z.boolean().describe('System streams cannot be deleted'),
            isEnabled: z.boolean(),
          })),
          example: [
            {
              id: '550e8400-e29b-41d4-a716-446655440400',
              name: 'Gas & Heating',
              code: 'GAS',
              description: 'Gas safety certificates, boiler servicing, CO detection',
              displayOrder: 1,
              isSystem: true,
              isEnabled: true,
            },
          ],
        },
      },
    },
  },
});

export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'ComplianceAI API',
      version: '1.0.0',
      description: `
# ComplianceAI API Documentation

ComplianceAI is a HACT/UKHDS-aligned compliance management platform for UK social housing organisations.

## Overview

This API provides programmatic access to manage:
- **Properties** - Dwellings, their attributes, and tenant information
- **Certificates** - Compliance certificates (gas safety, electrical, fire, etc.)
- **Remedial Actions** - Work required following inspections
- **Asset Hierarchy** - Schemes, blocks, and properties

## Authentication

### Session-Based (Web Application)
Use the \`/api/auth/login\` endpoint to obtain a session. The session cookie is automatically included in subsequent requests.

### Bearer Token (External API)
For machine-to-machine integrations, use Bearer token authentication:
\`\`\`
Authorization: Bearer your-api-key-here
\`\`\`

## UK Social Housing Context

ComplianceAI is designed specifically for UK social housing regulations including:
- Gas Safety (Installation and Use) Regulations 1998
- Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020
- Regulatory Reform (Fire Safety) Order 2005
- Control of Asbestos Regulations 2012
- Building Safety Act 2022

## Rate Limiting

API requests are rate-limited to protect system stability:
- **Authenticated users**: 1000 requests per hour
- **External API**: 100 requests per minute

## Support

For API support, contact: support@lashandigital.com
      `,
      contact: {
        name: 'Lashan Digital',
        email: 'support@lashandigital.com',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current environment',
      },
    ],
    tags: [
      { 
        name: 'Authentication', 
        description: 'User authentication and session management. Supports session-based auth for web applications and Bearer tokens for external integrations.',
      },
      { 
        name: 'Schemes', 
        description: 'Housing schemes/estates - the top level of the asset hierarchy. A scheme typically represents a housing development or estate.',
      },
      { 
        name: 'Blocks', 
        description: 'Buildings within a scheme. Blocks contain properties and may have their own compliance requirements (e.g., fire systems, lifts).',
      },
      { 
        name: 'Properties', 
        description: 'Individual dwellings with tenancy and compliance information. Properties are the primary entity for compliance tracking.',
      },
      { 
        name: 'Certificates', 
        description: 'Compliance certificates including gas safety (CP12), electrical (EICR), fire risk assessments, and more. Supports AI-powered document extraction.',
      },
      { 
        name: 'Remedial Actions', 
        description: 'Work items generated from inspections. Includes severity classification, due dates, and cost estimates based on UK regulatory requirements.',
      },
      { 
        name: 'Dashboard', 
        description: 'Summary statistics and compliance overview for the organisation.',
      },
      { 
        name: 'External Ingestion', 
        description: 'Machine-to-machine API for external systems to submit compliance certificates. Supports async processing with webhook notifications.',
      },
      { 
        name: 'Configuration', 
        description: 'System configuration including compliance streams, certificate types, and classification codes.',
      },
      { 
        name: 'System', 
        description: 'System health and status endpoints.',
      },
      { 
        name: 'Admin', 
        description: 'Administrative endpoints for user and organisation management. Requires elevated privileges.',
      },
    ],
  });
}
