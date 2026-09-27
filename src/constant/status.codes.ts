/**
 * HTTP status codes used by this application.
 *
 * Named constants instead of magic numbers: `STATUS_CODES.UNAUTHORIZED` is
 * greppable and self-documenting where `401` is neither.
 */
export const STATUS_CODES = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    ROUTE_NOT_FOUND: 404,
    PAYLOAD_TOO_LARGE: 413,
    UNSUPPORTED_MEDIA_TYPE: 415,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    GENERAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,

    /** @deprecated use BAD_REQUEST - kept so existing forks keep compiling. */
    INVALID_JSON_CONFIG: 400,
} as const;
