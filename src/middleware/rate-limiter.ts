import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import { env } from '@/config/env';
import { ERROR_CODES } from '@/constant/error.codes';
import { STATUS_CODES } from '@/constant/status.codes';
import { ApiError } from '@/error/ApiError';

/**
 * Global request cap, applied to every route.
 *
 * Rate limiting is the cheapest defence there is: it blunts credential
 * stuffing, scraping and accidental client retry storms before they reach any
 * business logic.
 *
 * IMPORTANT: the limiter keys on `req.ip`. Behind a load balancer every request
 * appears to come from the proxy unless TRUST_PROXY is configured, which turns
 * a per-client limit into a global one.
 *
 * @see docs/09-security.md#rate-limiting
 * @see https://express-rate-limit.mintlify.app/overview
 */
export const WINDOW_IN_MILI_SECONDS = 15 * 60 * 1000;
export const MAX_REQUESTS_PER_WINDOW = 100;

/**
 * Monitoring endpoints are polled constantly and must never be throttled.
 *
 * Matched EXACTLY. A prefix match here would exempt `/metricsXYZ` and
 * `/api/v0/healthzzz` too, handing any client an unlimited, unauthenticated
 * request channel - each one still running i18n, minting a UUID and writing a
 * log line.
 */
const EXEMPT_ROUTES = ['/metrics', '/api/v0/health'];

export const rateLimiter = rateLimit({
    windowMs: WINDOW_IN_MILI_SECONDS,
    limit: MAX_REQUESTS_PER_WINDOW,

    // Emit the standardised `RateLimit-*` headers, not the legacy `X-` ones.
    standardHeaders: true,
    legacyHeaders: false,

    skip: (req) => {
        if (EXEMPT_ROUTES.includes(req.path)) return true;

        return env.app.DISABLE_RATE_LIMITER;
    },

    /**
     * Routing the rejection through `next()` keeps rate-limit responses in the
     * same envelope as every other error in the application.
     */
    handler: (req: Request, _res: Response, next: NextFunction) => {
        next(
            new ApiError(
                STATUS_CODES.TOO_MANY_REQUESTS,
                ERROR_CODES.TOO_MANY_REQUESTS,
                req.t('too_many_requests_message', { ns: 'error' }),
                req.t('too_many_requests_details', { ns: 'error' }),
                req.t('too_many_requests_suggestion', { ns: 'error' }),
            ),
        );
    },
});
