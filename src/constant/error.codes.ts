/**
 * Stable, machine-readable error codes.
 *
 * HTTP status codes are too coarse for clients: a 400 could be a bad email, a
 * file that is too large, or malformed JSON. These codes never change meaning,
 * so a client can branch on `error.code` safely while `message` stays free to
 * be reworded or translated.
 */
export const ERROR_CODES = {
    TOO_MANY_REQUESTS: 'E000',
    GENERAL_ERROR: 'E001',
    INVALID_JSON_CONFIG: 'E002',
    ROUTE_NOT_FOUND: 'E003',
    UNAUTHORIZED: 'E004',
    NOT_FOUND: 'E005',
    VALIDATION_ERROR: 'E006',
    PAYLOAD_TOO_LARGE: 'E007',
    UNSUPPORTED_MEDIA_TYPE: 'E008',
    SERVICE_UNAVAILABLE: 'E009',
    FORBIDDEN: 'E010',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
