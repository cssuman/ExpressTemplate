import { z } from '@/openapi/extend-zod';

/**
 * The two response shapes every endpoint in this API uses.
 *
 * Describing them here means the published specification documents the actual
 * contract from docs/07-error-handling.md, rather than leaving each endpoint to
 * describe its own wrapper.
 */

/** Wraps any payload in the standard success envelope. */
export const successEnvelope = <T extends z.ZodTypeAny>(
    data: T,
    message: string,
): z.ZodObject<{ success: z.ZodLiteral<true>; status: z.ZodNumber; message: z.ZodString; data: T }> =>
    z.object({
        success: z.literal(true),
        status: z.number().openapi({ example: 200 }),
        message: z.string().openapi({ example: message }),
        data,
    });

export const errorEnvelope = z
    .object({
        success: z.literal(false),
        status: z.literal('error'),
        statusCode: z.number().openapi({ description: 'Mirrors the HTTP status.' }),
        error: z.object({
            errorId: z.string().uuid().openapi({ description: 'Unique per failure. Quote it in a bug report - it is in the server logs too.' }),
            requestId: z.string().optional().openapi({ description: 'Correlation id, also returned as the Request-Id header.' }),
            name: z.string().openapi({ example: 'ApiError' }),
            code: z.string().openapi({ description: 'Stable machine-readable code (E0xx). Branch on this, not on the message.' }),
            message: z.string().openapi({ description: 'What went wrong, in the caller language.' }),
            details: z.string().openapi({ description: 'Why it went wrong.' }),
            suggestion: z.string().openapi({ description: 'What the caller should do next.' }),
            ip: z.string().nullish().openapi({ description: 'Client IP as resolved through TRUST_PROXY.' }),
            url: z.string().openapi({ description: 'The path that failed.' }),
            method: z.string().openapi({ description: 'The HTTP method used.' }),
            timestamp: z.string().datetime(),
            stack: z.string().optional().openapi({ description: 'Development only. Omitted in production.' }),
        }),
    })
    .openapi('ErrorResponse');

/** The values that differ between one error response and the next. */
export interface ErrorExample {
    statusCode: number;
    code: string;
    message: string;
    details: string;
    suggestion: string;
    url: string;
    method: string;
}

/**
 * Builds a realistic error body for one specific response.
 *
 * The schema is shared by every error in the API, so without a per-response
 * example a reader looking at a 429 would be shown whatever single example the
 * schema carried - which is how this page once illustrated a rate limit with a
 * validation failure. `stack` is omitted because production never returns it.
 */
export const errorExample = ({ statusCode, code, message, details, suggestion, url, method }: ErrorExample): Record<string, unknown> => ({
    success: false,
    status: 'error',
    statusCode,
    error: {
        errorId: '9f1c2b7e-3a4d-4c19-8f2a-6b0d5e7c1a33',
        requestId: 'api-01/9f1c2b7e0000000000000042',
        name: 'ApiError',
        code,
        message,
        details,
        suggestion,
        ip: '203.0.113.42',
        url,
        method: method.toUpperCase(),
        timestamp: '2026-01-15T09:30:00.000Z',
    },
});
