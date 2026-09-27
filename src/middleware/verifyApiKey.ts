import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

import { env } from '@/config/env';
import { ERROR_CODES } from '@/constant/error.codes';
import { STATUS_CODES } from '@/constant/status.codes';
import { ApiError } from '@/error/ApiError';
import asyncCatch from '@/error/asyncCatch';

/**
 * Compares two secrets in constant time.
 *
 * `a !== b` returns as soon as it finds a differing byte, so the time it takes
 * leaks how many leading characters were correct. Over enough requests that is
 * enough to reconstruct a key one byte at a time.
 *
 * @see docs/09-security.md#timing-attacks
 */
const safeCompare = (provided: string, expected: string): boolean => {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    // timingSafeEqual throws on length mismatch, which would leak the length.
    if (providedBuffer.length !== expectedBuffer.length) {
        crypto.timingSafeEqual(expectedBuffer, expectedBuffer);
        return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

/**
 * Guards a route with a shared secret sent in the `x-api-key` header.
 *
 * A shared API key authenticates a *client application*, not a *user*. It is
 * the right tool for server-to-server calls and internal endpoints; it is not a
 * substitute for per-user authentication.
 */
export const verifyApiKey = asyncCatch(async (req: Request, _res: Response, next: NextFunction) => {
    const t = req.t;

    /**
     * The escape hatch is gated on NODE_ENV as well as the flag, so setting
     * DISABLE_VALIDATE_API_KEY_ON_DEVELOPMENT=true in a production .env can
     * never silently disable authentication.
     */
    if (env.app.NODE_ENV === 'development' && env.app.DISABLE_VALIDATE_API_KEY_ON_DEVELOPMENT) return next();

    // A repeated header arrives as an array; only a single string is valid.
    const header = req.headers['x-api-key'];
    const apiKey = typeof header === 'string' ? header : undefined;

    if (!apiKey) {
        throw new ApiError(
            STATUS_CODES.UNAUTHORIZED,
            ERROR_CODES.UNAUTHORIZED,
            t('api_key_not_found_message', { ns: 'error' }),
            t('api_key_not_found_details', { ns: 'error' }),
            t('api_key_not_found_suggestion', { ns: 'error' }),
        );
    }

    if (!safeCompare(apiKey, env.app.API_KEY)) {
        throw new ApiError(
            STATUS_CODES.UNAUTHORIZED,
            ERROR_CODES.UNAUTHORIZED,
            t('api_key_not_matched_message', { ns: 'error' }),
            t('api_key_not_matched_details', { ns: 'error' }),
            t('api_key_not_matched_suggestion', { ns: 'error' }),
        );
    }

    req.apiKey = apiKey;

    next();
});
