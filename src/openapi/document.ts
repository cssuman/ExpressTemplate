import { OpenApiGeneratorV3, OpenAPIRegistry, type RouteConfig, type ZodRequestBody } from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas30';

import { ERROR_CODES } from '@/constant/error.codes';
import { errorEnvelope, errorExample, successEnvelope } from '@/openapi/envelopes';
import { z } from '@/openapi/extend-zod';
import { metricsSchema, sendEmailSchema } from '@/schema/example.schema';

import packageJson from '../../package.json';

const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'ApiKeyAuth', {
    type: 'apiKey',
    in: 'header',
    name: 'x-api-key',
    description: 'Shared secret from the API_KEY environment variable. Authenticates a client application, not a user.',
});

/**
 * Pulls one request part out of a validation schema.
 *
 * The schemas in `src/schema/` are shaped `z.object({ body, query, params })`,
 * so the specification is generated from the exact same object that validates
 * the request at runtime. Change the schema and the docs change with it - there
 * is no second copy to forget.
 */
const part = (schema: z.AnyZodObject | undefined, key: 'body' | 'query' | 'params'): z.AnyZodObject | undefined => {
    const candidate = schema?.shape[key];
    return candidate instanceof z.ZodObject ? candidate : undefined;
};

/**
 * The catalogue of failures this API can return, with the wording the server
 * actually sends (see locales/en/error.json).
 *
 * Keyed by status so a route only has to say "I can also return a 401".
 */
const ERROR_CATALOGUE: Record<string, { code: string; message: string; details: string; suggestion: string }> = {
    '400': {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Schema validation error.',
        details: 'body.to: Invalid email',
        suggestion: 'Please correct the highlighted fields and try again.',
    },
    '401': {
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'API key not found',
        details: 'There is no API key associated with your request.',
        suggestion: 'Please check the API key and try again',
    },
    '404': {
        code: ERROR_CODES.ROUTE_NOT_FOUND,
        message: 'Route not found.',
        details: 'The route you are trying to access does not exist.',
        suggestion: 'Please check the URL and try again.',
    },
    '413': {
        code: ERROR_CODES.PAYLOAD_TOO_LARGE,
        message: 'File too large.',
        details: 'The uploaded file exceeds the maximum allowed file size.',
        suggestion: 'Please upload a smaller file and try again.',
    },
    '415': {
        code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
        message: 'Unsupported file type.',
        details: 'Files of type application/octet-stream are not accepted by this endpoint.',
        suggestion: 'Please upload one of the following types: image/jpeg, image/png, application/pdf.',
    },
    '429': {
        code: ERROR_CODES.TOO_MANY_REQUESTS,
        message: 'Too many requests. Please try again later.',
        details: 'You have exceeded the maximum number of requests allowed. Please try again later.',
        suggestion: 'Please try again later.',
    },
    '500': {
        code: ERROR_CODES.GENERAL_ERROR,
        message: 'An error occurred.',
        details: 'An error occurred. Please try again later.',
        suggestion: 'Please try again later.',
    },
    '503': {
        code: ERROR_CODES.SERVICE_UNAVAILABLE,
        message: 'Email service is not configured.',
        details: 'This server was started without SendGrid credentials.',
        suggestion: 'Please set SEND_GRID_API_KEY and SEND_GRID_FROM_EMAIL and restart the server.',
    },
};

/** What a route may say about one of its failure modes. */
interface ErrorOverride {
    description: string;
    message?: string;
    details?: string;
    suggestion?: string;
}

/** Every endpoint can be rate limited, and anything can break. */
const ALWAYS_POSSIBLE: Record<string, ErrorOverride> = {
    '429': { description: `Rate limit exceeded (${ERROR_CODES.TOO_MANY_REQUESTS}). 100 requests per 15 minutes per IP by default.` },
    '500': {
        description: `Unexpected failure (${ERROR_CODES.GENERAL_ERROR}). The response is deliberately generic; details are in the server logs under \`errorId\`.`,
    },
};

/**
 * Builds one error response, with an example that matches THIS endpoint and
 * THIS status - the right path, method, status code and wording.
 */
const buildErrorResponse = (statusCode: string, override: ErrorOverride, path: string, method: string) => {
    const base = ERROR_CATALOGUE[statusCode] ?? ERROR_CATALOGUE['500'];

    return {
        description: override.description,
        content: {
            'application/json': {
                schema: errorEnvelope,
                example: errorExample({
                    statusCode: Number(statusCode),
                    code: base?.code ?? ERROR_CODES.GENERAL_ERROR,
                    message: override.message ?? base?.message ?? '',
                    details: override.details ?? base?.details ?? '',
                    suggestion: override.suggestion ?? base?.suggestion ?? '',
                    url: path,
                    method,
                }),
            },
        },
    };
};

interface EndpointConfig {
    method: RouteConfig['method'];
    path: string;
    tags: string[];
    summary: string;
    description: string;
    /** A validation schema from `src/schema/` - body, query and params are read from it. */
    schema?: z.AnyZodObject;
    /** Overrides `schema` for non-JSON bodies such as file uploads. */
    body?: ZodRequestBody;
    secure?: boolean;
    response: { description: string; schema: z.ZodTypeAny; example?: Record<string, unknown> };
    /** Extra failure modes beyond 429/500, keyed by status code. */
    errors?: Record<string, ErrorOverride>;
}

const registerEndpoint = ({ method, path, tags, summary, description, schema, body, secure, response, errors }: EndpointConfig): void => {
    const jsonBody = part(schema, 'body');

    registry.registerPath({
        method,
        path,
        tags,
        summary,
        description,
        ...(secure ? { security: [{ ApiKeyAuth: [] }] } : {}),
        request: {
            ...(body ? { body } : {}),
            ...(!body && jsonBody ? { body: { required: true, content: { 'application/json': { schema: jsonBody } } } } : {}),
            ...(part(schema, 'query') ? { query: part(schema, 'query') } : {}),
            ...(part(schema, 'params') ? { params: part(schema, 'params') } : {}),
        },
        responses: {
            '200': {
                description: response.description,
                content: {
                    'application/json': { schema: response.schema, ...(response.example ? { example: response.example } : {}) },
                },
            },
            ...Object.fromEntries(
                Object.entries({ ...ALWAYS_POSSIBLE, ...errors }).map(([status, override]) => [
                    status,
                    buildErrorResponse(status, override, path, method),
                ]),
            ),
        },
    });
};

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                   */
/* -------------------------------------------------------------------------- */

registerEndpoint({
    method: 'get',
    path: '/',
    tags: ['Root'],
    summary: 'Service identity',
    description: 'Name, version and environment of the running service. Useful as a first connectivity check.',
    response: {
        description: 'Service details',
        schema: successEnvelope(z.object({ appName: z.string(), appVersion: z.string(), appEnverionment: z.string() }), 'Welcome to the API'),
        example: {
            success: true,
            status: 200,
            message: 'Welcome to the API',
            data: { appName: 'express-template', appVersion: '1.6.0', appEnverionment: 'development' },
        },
    },
});

registerEndpoint({
    method: 'get',
    path: '/api/v0/health',
    tags: ['Observability'],
    summary: 'Liveness check',
    description:
        'Process and system health. Exempt from rate limiting so load balancers can poll it freely. This is a LIVENESS check - it deliberately touches no dependency.',
    response: {
        description: 'The service is alive',
        schema: successEnvelope(
            z.object({
                application: z.object({
                    environment: z.string(),
                    uptime: z.string().openapi({ example: '3600.00 Second' }),
                    memoryUsage: z.object({ heapTotal: z.string(), heapUsed: z.string() }),
                }),
                system: z.object({ cpuUsage: z.array(z.number()), totalMemory: z.string(), freeMemory: z.string() }),
                timestamp: z.number(),
            }),
            'API is healthy',
        ),
        example: {
            success: true,
            status: 200,
            message: 'API is healthy',
            data: {
                application: { environment: 'production', uptime: '3601.45 Second', memoryUsage: { heapTotal: '57.78 MB', heapUsed: '33.60 MB' } },
                system: { cpuUsage: [2.33, 4.58, 4.46], totalMemory: '8192.00 MB', freeMemory: '72.45 MB' },
                timestamp: 1790433828871,
            },
        },
    },
});

registerEndpoint({
    method: 'get',
    path: '/api/v0/example/localization',
    tags: ['Examples'],
    summary: 'Internationalisation',
    description: 'Returns a translated message. Add `?lng=ne` for Nepali, or send an `Accept-Language` header. The query parameter wins.',
    schema: z.object({ query: z.object({ lng: z.enum(['en', 'ne']).optional().openapi({ example: 'ne' }) }) }),
    response: {
        description: 'Translated message',
        schema: successEnvelope(z.object({ localization: z.string(), details: z.string() }), 'Localization test'),
        example: {
            success: true,
            status: 200,
            message: 'Localization test',
            data: { localization: 'Localization test', details: 'You can see the translation of this text in different languages' },
        },
    },
});

registerEndpoint({
    method: 'get',
    path: '/api/v0/example/api-key',
    tags: ['Examples'],
    summary: 'API key authentication',
    description:
        'Protected by the `verifyApiKey` middleware, which compares the key in constant time. Send `x-api-key` with the value of API_KEY from your .env file.',
    secure: true,
    response: {
        description: 'The key was accepted',
        schema: successEnvelope(z.object({ apiKey: z.string(), apiKeyStatus: z.string() }), 'API key verified'),
        example: {
            success: true,
            status: 200,
            message: 'API key verified',
            data: { apiKey: '277c9447...8cedd', apiKeyStatus: 'API key verified' },
        },
    },
    errors: { '401': { description: `Missing or incorrect key (${ERROR_CODES.UNAUTHORIZED}).` } },
});

registerEndpoint({
    method: 'get',
    path: '/api/v0/example/slow-down',
    tags: ['Examples'],
    summary: 'Progressive throttling',
    description:
        'Requests 1-3 are immediate; every request after that is delayed by an extra 100ms. Call it repeatedly and watch the response time climb - throttling rather than rejecting.',
    response: {
        description: 'Throttling state for your IP',
        schema: successEnvelope(
            z.object({ requestCount: z.number(), expectedDelay: z.string(), timeBeforeReset: z.string(), delayStatus: z.string() }),
            'API slow down test',
        ),
        example: {
            success: true,
            status: 200,
            message: 'API slow down test',
            data: { requestCount: 6, expectedDelay: '600ms', timeBeforeReset: '870 seconds', delayStatus: 'Request is being slowed down' },
        },
    },
});

registerEndpoint({
    method: 'post',
    path: '/api/v0/example/send-email',
    tags: ['Examples'],
    summary: 'Send a templated email',
    description:
        'Renders a local Handlebars template and sends it through SendGrid. Returns 503 if SendGrid is not configured - an optional integration fails at call time, not at boot.',
    schema: sendEmailSchema,
    response: {
        description: 'Provider accepted the message',
        schema: successEnvelope(z.object({}).passthrough(), 'Email sent'),
        example: {
            success: true,
            status: 200,
            message: 'Email sent',
            data: { statusCode: 202, headers: { 'x-message-id': 'kZk5Xn0nQWqZ6y5pQ1rUEw' } },
        },
    },
    errors: {
        '400': { description: `Validation failed (${ERROR_CODES.VALIDATION_ERROR}). Every failing field is listed in \`details\`.` },
        '503': { description: `SendGrid is not configured (${ERROR_CODES.SERVICE_UNAVAILABLE}).` },
    },
});

registerEndpoint({
    method: 'post',
    path: '/api/v0/example/file-upload',
    tags: ['Examples'],
    summary: 'Upload a file',
    description:
        'Accepts one JPEG, PNG or PDF up to 2MB. Type, size and count are all enforced by multer before the handler runs. Note that the declared MIME type is client-supplied and forgeable - verify magic bytes for untrusted input.',
    body: {
        required: true,
        content: {
            'multipart/form-data': {
                schema: z.object({
                    example_file: z.string().openapi({ type: 'string', format: 'binary', description: 'JPEG, PNG or PDF, max 2MB' }),
                }),
            },
        },
    },
    response: {
        description: 'File accepted',
        schema: successEnvelope(z.object({ file: z.string(), fileSize: z.string(), message: z.string() }), 'File upload'),
        example: {
            success: true,
            status: 200,
            message: 'File upload',
            data: { file: 'invoice.pdf', fileSize: '0.42 MB', message: 'File uploaded successfully' },
        },
    },
    errors: {
        '413': { description: `File exceeds the size limit (${ERROR_CODES.PAYLOAD_TOO_LARGE}).` },
        '415': { description: `File type not allowed (${ERROR_CODES.UNSUPPORTED_MEDIA_TYPE}).` },
    },
});

registerEndpoint({
    method: 'get',
    path: '/api/v0/example/metrics',
    tags: ['Examples'],
    summary: 'Generate measurable latency',
    description:
        'Sleeps for `loop` seconds so you can watch the latency histogram move in Grafana. Capped at 60 by the schema - an unbounded numeric input is a free denial-of-service.',
    schema: metricsSchema,
    response: {
        description: 'Timing summary',
        schema: successEnvelope(z.object({ message: z.string(), details: z.string() }), 'Metrics API'),
        example: {
            success: true,
            status: 200,
            message: 'Metrics API',
            data: { message: 'You can view the API metrics', details: 'Metrics API: 3 seconds (Loop 3)' },
        },
    },
    errors: {
        '400': {
            description: `\`loop\` was not an integer between 0 and 60 (${ERROR_CODES.VALIDATION_ERROR}).`,
            details: 'query.loop: Number must be less than or equal to 60',
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/metrics',
    tags: ['Observability'],
    summary: 'Prometheus metrics',
    description:
        'Prometheus exposition format, not JSON. Exposes route names, traffic shape and process internals - set PROTECT_METRICS=true, or keep the port private.',
    responses: {
        '200': {
            description: 'Metrics in Prometheus text format',
            content: { 'text/plain': { schema: z.string().openapi({ example: '# HELP http_requests_total Total number of HTTP requests' }) } },
        },
    },
});

/* -------------------------------------------------------------------------- */

let cached: OpenAPIObject | undefined;

/** Builds the specification once and reuses it - the schemas never change at runtime. */
export const getOpenApiDocument = (): OpenAPIObject => {
    if (cached) return cached;

    cached = new OpenApiGeneratorV3(registry.definitions).generateDocument({
        openapi: '3.0.3',
        info: {
            title: `${packageJson.name} API`,
            version: packageJson.version,
            description: [
                'Interactive reference for the ExpressTemplate example API.',
                '',
                'Every endpoint returns one of two shapes: a success envelope or an error envelope.',
                'Error responses carry a stable `code` (E0xx) to branch on, plus `message`, `details`',
                'and `suggestion` - and an `errorId` that also appears in the server logs.',
                '',
                'This page is generated from the same Zod schemas that validate requests at runtime,',
                'so it cannot drift from the implementation.',
            ].join('\n'),
        },
        // Relative, so "Try it" targets whatever host is serving this page.
        servers: [{ url: '/', description: 'This server' }],
        tags: [
            { name: 'Root', description: 'Service identity' },
            { name: 'Examples', description: 'One endpoint per feature of the template' },
            { name: 'Observability', description: 'Health and metrics' },
        ],
    });

    return cached;
};
