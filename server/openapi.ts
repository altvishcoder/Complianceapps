import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

registry.registerComponent('securitySchemes', 'sessionAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'connect.sid',
});

const ErrorResponse = z.object({
  message: z.string(),
  errors: z.array(z.object({
    field: z.string().optional(),
    message: z.string(),
  })).optional(),
}).openapi('Error');

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  summary: 'User login',
  tags: ['Authentication'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            username: z.string().min(1),
            password: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string(),
            username: z.string(),
            email: z.string(),
            name: z.string(),
            role: z.string(),
          }),
        },
      },
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: ErrorResponse,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/logout',
  summary: 'User logout',
  tags: ['Authentication'],
  security: [{ sessionAuth: [] }],
  responses: {
    200: {
      description: 'Logout successful',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  summary: 'Get current user session',
  tags: ['Authentication'],
  security: [{ sessionAuth: [] }],
  responses: {
    200: {
      description: 'Current user details',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string(),
            username: z.string(),
            email: z.string(),
            name: z.string(),
            role: z.string(),
          }),
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponse,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/properties',
  summary: 'List all properties',
  tags: ['Properties'],
  security: [{ sessionAuth: [] }],
  parameters: [
    {
      name: 'blockId',
      in: 'query',
      required: false,
      schema: { type: 'string' },
    },
    {
      name: 'search',
      in: 'query',
      required: false,
      schema: { type: 'string' },
    },
  ],
  responses: {
    200: {
      description: 'List of properties',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            uprn: z.string(),
            addressLine1: z.string(),
            city: z.string(),
            postcode: z.string(),
            propertyType: z.string(),
            complianceStatus: z.string(),
          })),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/properties',
  summary: 'Create a new property',
  tags: ['Properties'],
  security: [{ sessionAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            blockId: z.string(),
            uprn: z.string(),
            addressLine1: z.string(),
            addressLine2: z.string().optional(),
            city: z.string(),
            postcode: z.string(),
            propertyType: z.enum(['HOUSE', 'FLAT', 'BUNGALOW', 'MAISONETTE', 'BEDSIT', 'STUDIO']),
            tenure: z.enum(['SOCIAL_RENT', 'AFFORDABLE_RENT', 'SHARED_OWNERSHIP', 'LEASEHOLD', 'TEMPORARY']),
            bedrooms: z.number().optional(),
            hasGas: z.boolean().optional(),
          }),
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
            id: z.string(),
            uprn: z.string(),
            addressLine1: z.string(),
          }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: ErrorResponse,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/certificates',
  summary: 'List all certificates',
  tags: ['Certificates'],
  security: [{ sessionAuth: [] }],
  parameters: [
    {
      name: 'propertyId',
      in: 'query',
      required: false,
      schema: { type: 'string' },
    },
    {
      name: 'type',
      in: 'query',
      required: false,
      schema: { type: 'string' },
    },
    {
      name: 'status',
      in: 'query',
      required: false,
      schema: { type: 'string' },
    },
  ],
  responses: {
    200: {
      description: 'List of certificates',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            propertyId: z.string(),
            type: z.string(),
            status: z.string(),
            expiryDate: z.string().nullable(),
          })),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/certificates',
  summary: 'Create a new certificate',
  tags: ['Certificates'],
  security: [{ sessionAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            propertyId: z.string(),
            type: z.enum(['GAS_SAFETY', 'EICR', 'EPC', 'FIRE_RISK_ASSESSMENT', 'LEGIONELLA_ASSESSMENT', 'ASBESTOS_SURVEY', 'LIFT_LOLER', 'OTHER']),
            issueDate: z.string().optional(),
            expiryDate: z.string().optional(),
            engineerName: z.string().optional(),
            engineerRegistration: z.string().optional(),
          }),
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
            id: z.string(),
            propertyId: z.string(),
            type: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/schemes',
  summary: 'List all schemes',
  tags: ['Schemes'],
  security: [{ sessionAuth: [] }],
  responses: {
    200: {
      description: 'List of schemes',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            name: z.string(),
            reference: z.string(),
            complianceStatus: z.string(),
          })),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/blocks',
  summary: 'List all blocks',
  tags: ['Blocks'],
  security: [{ sessionAuth: [] }],
  parameters: [
    {
      name: 'schemeId',
      in: 'query',
      required: false,
      schema: { type: 'string' },
    },
  ],
  responses: {
    200: {
      description: 'List of blocks',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            schemeId: z.string(),
            name: z.string(),
            reference: z.string(),
          })),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/remedial-actions',
  summary: 'List all remedial actions',
  tags: ['Remedial Actions'],
  security: [{ sessionAuth: [] }],
  parameters: [
    {
      name: 'status',
      in: 'query',
      required: false,
      schema: { type: 'string' },
    },
    {
      name: 'severity',
      in: 'query',
      required: false,
      schema: { type: 'string' },
    },
  ],
  responses: {
    200: {
      description: 'List of remedial actions',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            certificateId: z.string(),
            description: z.string(),
            severity: z.string(),
            status: z.string(),
          })),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/ingestion/submit',
  summary: 'Submit certificate via external API',
  description: 'External ingestion endpoint for machine-to-machine certificate submission',
  tags: ['External Ingestion'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.any().describe('Certificate PDF file'),
            propertyRef: z.string().describe('Property reference (UPRN)'),
            certificateType: z.string().describe('Type of certificate'),
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
            submissionId: z.string(),
            status: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    401: {
      description: 'Invalid or missing API key',
      content: {
        'application/json': {
          schema: ErrorResponse,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/dashboard/stats',
  summary: 'Get dashboard statistics',
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
            expiringCertificates: z.number(),
            pendingActions: z.number(),
            complianceRate: z.number(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/users',
  summary: 'List all users (admin only)',
  tags: ['Admin'],
  security: [{ sessionAuth: [] }],
  responses: {
    200: {
      description: 'List of users',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            username: z.string(),
            email: z.string(),
            name: z.string(),
            role: z.string(),
          })),
        },
      },
    },
    403: {
      description: 'Forbidden - Admin access required',
      content: {
        'application/json': {
          schema: ErrorResponse,
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
      description: 'API documentation for ComplianceAI - UK Social Housing Compliance Management Platform',
      contact: {
        name: 'Lashan Digital',
        email: 'support@lashandigital.com',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current environment',
      },
    ],
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Properties', description: 'Property management endpoints' },
      { name: 'Certificates', description: 'Compliance certificate endpoints' },
      { name: 'Schemes', description: 'Scheme management endpoints' },
      { name: 'Blocks', description: 'Block management endpoints' },
      { name: 'Remedial Actions', description: 'Remedial action tracking endpoints' },
      { name: 'Dashboard', description: 'Dashboard and statistics endpoints' },
      { name: 'External Ingestion', description: 'External API for certificate submission' },
      { name: 'Admin', description: 'Administrative endpoints' },
    ],
  });
}
