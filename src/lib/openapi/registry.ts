/**
 * Central OpenAPI 3.1 spec registry for the public REST API.
 *
 * Usage from `/api/docs/route.ts`:
 *   import { buildOpenApiSpec } from '@/lib/openapi/registry';
 *   const spec = buildOpenApiSpec();
 *
 * Registration happens lazily on first call to buildOpenApiSpec() to avoid
 * running at module-load time (which breaks Next.js static page data collection).
 */

import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Extend zod with .openapi() method so schemas can be self-describing.
extendZodWithOpenApi(z);

let cachedSpec: ReturnType<OpenApiGeneratorV31['generateDocument']> | null = null;

function buildRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();

  // ---------------------------------------------------------------------------
  // Security scheme
  // ---------------------------------------------------------------------------
  registry.registerComponent('securitySchemes', 'ApiKey', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'tpa_live_*',
    description:
      'API key issued from Settings → API Keys. Send as `Authorization: Bearer tpa_live_...`.',
  });

  // ---------------------------------------------------------------------------
  // Shared schemas
  // ---------------------------------------------------------------------------
  const ErrorResponseSchema = registry.register(
    'ErrorResponse',
    z.object({
      error: z.string().openapi({ example: 'Invalid credentials' }),
      details: z.array(z.any()).optional(),
    })
  );

  const PaginationSchema = registry.register(
    'Pagination',
    z.object({
      page: z.number().int().openapi({ example: 1 }),
      limit: z.number().int().openapi({ example: 50 }),
      total: z.number().int().openapi({ example: 237 }),
      totalPages: z.number().int().openapi({ example: 5 }),
      hasMore: z.boolean().openapi({ example: true }),
    })
  );

  const PersonSchema = registry.register(
    'Person',
    z.object({
      id: z.string().uuid(),
      firstName: z.string(),
      lastName: z.string(),
      email: z.string().email(),
      phone: z.string(),
      dob: z.string().openapi({ example: '01/15/1985', description: 'MM/DD/YYYY' }),
      createdAt: z.string().datetime(),
    })
  );

  const OrderStatusSchema = z.enum([
    'new',
    'needs_site',
    'scheduled',
    'in_progress',
    'results_uploaded',
    'pending_review',
    'complete',
    'cancelled',
  ]);

  const OrderSchema = registry.register(
    'Order',
    z.object({
      id: z.string().uuid(),
      orderNumber: z.string().openapi({ example: 'ORD-1712345678-A3F9K' }),
      status: OrderStatusSchema,
      serviceType: z.string().openapi({ example: 'pre_employment' }),
      testType: z.string().openapi({ example: 'drug_screen' }),
      isDOT: z.boolean(),
      priority: z.string().openapi({ example: 'standard' }),
      jobsiteLocation: z.string(),
      scheduledFor: z.string().datetime().nullable(),
      completedAt: z.string().datetime().nullable(),
      createdAt: z.string().datetime(),
      personId: z.string().uuid(),
      clientOrgId: z.string().uuid().nullable(),
    })
  );

  const CreateOrderRequestSchema = registry.register(
    'CreateOrderRequest',
    z.object({
      personId: z.string().uuid().optional(),
      person: z
        .object({
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          email: z.string().email(),
          phone: z.string().min(1),
          dob: z.string(),
          ssnLast4: z.string().length(4),
        })
        .optional(),
      serviceType: z.string().openapi({ example: 'pre_employment' }),
      testType: z.string().openapi({ example: 'drug_screen' }),
      isDOT: z.boolean().default(false),
      priority: z.enum(['standard', 'urgent']).default('standard'),
      jobsiteLocation: z.string().min(1),
      scheduledFor: z.string().datetime().optional(),
      clientOrgId: z.string().uuid().optional(),
      notes: z.string().optional(),
    })
  );

  // ---------------------------------------------------------------------------
  // Paths — Orders
  // ---------------------------------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/orders',
    summary: 'List orders',
    description: "Returns orders for the API key's TPA tenant, newest first. Supports pagination and filters.",
    tags: ['Orders'],
    security: [{ ApiKey: [] }],
    request: {
      query: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
        status: OrderStatusSchema.optional(),
        personId: z.string().uuid().optional(),
        search: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Paginated list of orders',
        content: {
          'application/json': {
            schema: z.object({
              orders: z.array(OrderSchema),
              pagination: PaginationSchema,
            }),
          },
        },
      },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
      403: { description: 'Forbidden — missing orders:read scope', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/orders',
    summary: 'Create order',
    description: 'Creates a new drug test order. Requires the `orders:write` scope.',
    tags: ['Orders'],
    security: [{ ApiKey: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: CreateOrderRequestSchema },
        },
      },
    },
    responses: {
      201: {
        description: 'Order created',
        content: {
          'application/json': { schema: z.object({ order: OrderSchema }) },
        },
      },
      400: { description: 'Invalid request', content: { 'application/json': { schema: ErrorResponseSchema } } },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
      403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/orders/{id}',
    summary: 'Get order',
    tags: ['Orders'],
    security: [{ ApiKey: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: 'The order',
        content: { 'application/json': { schema: z.object({ order: OrderSchema }) } },
      },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  });

  // ---------------------------------------------------------------------------
  // Paths — Persons
  // ---------------------------------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/candidates',
    summary: 'List persons',
    description: 'Returns persons (drug test candidates / drivers / patients). Scope: `persons:read`.',
    tags: ['Persons'],
    security: [{ ApiKey: [] }],
    request: {
      query: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
        search: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Paginated list of persons',
        content: {
          'application/json': {
            schema: z.object({
              persons: z.array(PersonSchema),
              pagination: PaginationSchema,
            }),
          },
        },
      },
    },
  });

  // ---------------------------------------------------------------------------
  // Paths — Injury Care
  // ---------------------------------------------------------------------------

  const InjurySeveritySchema = z.enum([
    'first_aid',
    'medical',
    'lost_time',
    'restricted_duty',
    'fatality',
  ]);

  const InjuryStatusSchema = z.enum([
    'open',
    'in_treatment',
    'rtw_eval_pending',
    'rtw_full_duty',
    'rtw_restricted',
    'closed',
    'litigation',
  ]);

  const IncidentSchema = registry.register(
    'Incident',
    z.object({
      id: z.string().uuid(),
      incidentNumber: z.string().openapi({ example: 'INC-2026-00001' }),
      incidentDate: z.string().datetime(),
      location: z.string(),
      injuryType: z.string().openapi({ example: 'sprain' }),
      description: z.string(),
      severity: InjurySeveritySchema,
      status: InjuryStatusSchema,
      oshaRecordable: z.boolean(),
      lostDaysCount: z.number().int(),
      restrictedDaysCount: z.number().int(),
      personId: z.string().uuid(),
      clientOrgId: z.string().uuid().nullable(),
      createdAt: z.string().datetime(),
    }),
  );

  const CreateIncidentRequestSchema = registry.register(
    'CreateIncidentRequest',
    z.object({
      personId: z.string().uuid().optional(),
      person: z
        .object({
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          email: z.string().email().optional(),
          phone: z.string().optional(),
        })
        .optional(),
      clientOrgId: z.string().uuid().optional(),
      incidentDate: z.string().datetime(),
      location: z.string().min(1),
      jobAtIncident: z.string().optional(),
      bodyPartsAffected: z.array(z.string()).default([]),
      injuryType: z.string(),
      description: z.string(),
      severity: InjurySeveritySchema,
      oshaRecordable: z.boolean().optional(),
      workersCompClaimNumber: z.string().optional(),
      workersCompCarrier: z.string().optional(),
      notes: z.string().optional(),
    }),
  );

  registry.registerPath({
    method: 'get',
    path: '/api/injury/incidents',
    summary: 'List workplace injury incidents',
    description:
      "Returns workplace injury incidents for the API key's TPA tenant. Supports filters by status, severity, oshaRecordable, clientOrgId, personId.",
    tags: ['Injury Care'],
    security: [{ ApiKey: [] }],
    request: {
      query: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
        status: InjuryStatusSchema.optional(),
        severity: InjurySeveritySchema.optional(),
        oshaRecordable: z.enum(['true', 'false']).optional(),
        clientOrgId: z.string().uuid().optional(),
        personId: z.string().uuid().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Paginated list of incidents',
        content: {
          'application/json': {
            schema: z.object({
              incidents: z.array(IncidentSchema),
              pagination: PaginationSchema,
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/injury/incidents',
    summary: 'Report a workplace incident',
    description: 'Creates a new injury incident. Generates an incident number (INC-YYYY-NNNNN) and auto-derives OSHA recordability from severity unless overridden.',
    tags: ['Injury Care'],
    security: [{ ApiKey: [] }],
    request: {
      body: { content: { 'application/json': { schema: CreateIncidentRequestSchema } } },
    },
    responses: {
      201: {
        description: 'Incident recorded',
        content: { 'application/json': { schema: z.object({ incident: IncidentSchema }) } },
      },
      400: { description: 'Invalid request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/injury/incidents/{id}',
    summary: 'Get incident (with treatments, RTW evals, and documents)',
    tags: ['Injury Care'],
    security: [{ ApiKey: [] }],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        description: 'Incident detail',
        content: { 'application/json': { schema: z.object({ incident: IncidentSchema }) } },
      },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/injury/incidents/{id}/treatments',
    summary: 'Log a medical treatment for an incident',
    tags: ['Injury Care'],
    security: [{ ApiKey: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              treatmentDate: z.string().datetime(),
              providerType: z.enum([
                'er',
                'urgent_care',
                'primary_care',
                'specialist',
                'physical_therapy',
                'occupational_medicine',
                'diagnostic',
                'pharmacy',
              ]),
              providerName: z.string().optional(),
              diagnosis: z.string().optional(),
              workRestrictions: z.string().optional(),
              nextVisitOn: z.string().datetime().optional(),
            }),
          },
        },
      },
    },
    responses: { 201: { description: 'Treatment recorded' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/injury/incidents/{id}/rtw-evals',
    summary: 'Record a return-to-work evaluation',
    tags: ['Injury Care'],
    security: [{ ApiKey: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              evaluationDate: z.string().datetime(),
              status: z.enum(['full_duty', 'restricted_duty', 'unable_to_work']),
              evaluatorName: z.string().optional(),
              releasedToWorkOn: z.string().datetime().optional(),
              restrictions: z.array(z.string()).optional(),
              followUpRequired: z.boolean().optional(),
              followUpDate: z.string().datetime().optional(),
            }),
          },
        },
      },
    },
    responses: { 201: { description: 'RTW evaluation recorded' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/injury/rtw-evals/{id}/sign-off',
    summary: 'Sign off on a return-to-work evaluation',
    description: 'Requires the `sign_off_rtw` permission. Once signed off, the evaluation becomes immutable.',
    tags: ['Injury Care'],
    security: [{ ApiKey: [] }],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 200: { description: 'Signed off' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/injury/osha-300',
    summary: 'Download the OSHA Form 300 log PDF',
    description: 'Generates an OSHA 300 Log of Work-Related Injuries and Illnesses for the given calendar year. Filters to `osha_recordable = true` cases in that year.',
    tags: ['Injury Care'],
    security: [{ ApiKey: [] }],
    request: {
      query: z.object({
        year: z.coerce.number().int().min(2000).max(2100),
        clientOrgId: z.string().uuid().optional(),
      }),
    },
    responses: {
      200: {
        description: 'PDF file',
        content: { 'application/pdf': { schema: z.any() } },
      },
    },
  });

  // ---------------------------------------------------------------------------
  // Webhooks
  // ---------------------------------------------------------------------------
  registry.registerWebhook({
    method: 'post',
    path: 'https://your-endpoint.example.com',
    summary: 'Outbound webhook delivery',
    description: `Webhook events are POSTed to your configured URL with these headers:
- \`X-Webhook-Event\`: the event name (e.g. \`order.created\`)
- \`X-Webhook-Signature\`: HMAC-SHA256 of the raw body, prefixed with \`sha256=\`
- \`X-Webhook-Delivery\`: unique delivery ID
- \`X-Webhook-Timestamp\`: Unix millisecond timestamp

Verify the signature using your subscription's secret. Return a 2xx status to ack.
Non-2xx responses are retried with exponential backoff (1m → 5m → 30m → 2h → 8h, max 5 attempts).`,
    tags: ['Webhooks'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              event: z.string().openapi({ example: 'order.created' }),
              timestamp: z.number(),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: 'Acknowledged' },
    },
  });

  return registry;
}

export function buildOpenApiSpec() {
  if (cachedSpec) return cachedSpec;

  const registry = buildRegistry();
  const generator = new OpenApiGeneratorV31(registry.definitions);
  cachedSpec = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'TPAEngineX API',
      description: `Public REST API for TPAEngineX integrations.

## Authentication

Create an API key in the web app under **Settings → API Keys**.
Send the key as a Bearer token:

\`\`\`
Authorization: Bearer tpa_live_...
\`\`\`

## Scopes

Keys have granular scopes like \`orders:read\`, \`orders:write\`, \`dqf:read\`.
Assign the minimum scopes required for your integration.

## Rate limits

The API currently has no hard rate limit, but we monitor usage and may
throttle abusive traffic. IP allowlists can be configured per API key.

## Webhooks

Subscribe to events under **Settings → Webhooks**. Payloads are signed
with HMAC-SHA256 — verify the \`X-Webhook-Signature\` header against your
subscription's secret before processing.`,
      contact: { name: 'TPAEngineX Support' },
    },
    servers: [
      { url: 'https://your-tpa.tpaplatform.com', description: 'Your tenant subdomain' },
      { url: 'http://localhost:3000', description: 'Local development' },
    ],
    security: [{ ApiKey: [] }],
    tags: [
      { name: 'Orders', description: 'Drug test orders lifecycle' },
      { name: 'Persons', description: 'Person records (candidates, drivers, patients)' },
      { name: 'Injury Care', description: 'Workplace injury incidents, treatments, RTW evals, OSHA 300 log' },
      { name: 'Webhooks', description: 'Outbound webhook event schemas' },
    ],
  });

  return cachedSpec;
}
