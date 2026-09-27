import { Request } from 'express';

/**
 * Shape exposed by express-rate-limit on `req.rateLimit`.
 * Useful for endpoints that want to report their own quota back to the client.
 */
export interface RateLimitInfo {
    current: number;
    limit: number;
    remaining: number;
    resetTime: Date;
}

export interface RequestWithRateLimit extends Request {
    rateLimit?: RateLimitInfo;
}

/**
 * Properties attached to `req` by middleware.
 *
 * Declaring them here is what makes `req.rid` and `req.apiKey` type-safe at
 * every call site instead of requiring a cast.
 */
declare module 'express' {
    export interface Request {
        /** Correlation id set by express-ruid; also returned as Request-Id. */
        rid?: string;
        /** Set by the verifyApiKey middleware once a key has been accepted. */
        apiKey?: string;
    }
}
