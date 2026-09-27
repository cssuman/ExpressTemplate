import type { NextFunction, Request, Response } from 'express';

import { ERROR_CODES } from '@/constant/error.codes';
import { STATUS_CODES } from '@/constant/status.codes';
import { ApiError } from '@/error/ApiError';

/**
 * Catch-all for requests that matched no route.
 *
 * Registered after every router but before the error handler: Express runs
 * middleware in registration order, so anything reaching this point is a 404 by
 * definition.
 *
 * It calls `next(error)` rather than throwing, so the behaviour is identical in
 * sync and async code paths (Express 4 only catches synchronous throws).
 */
export const routeNotFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
    const t = req.t;

    // No logging here: apiErrorHandler logs every error once, with the request
    // id, IP and method attached. Logging in both places doubles the noise.
    next(
        new ApiError(
            STATUS_CODES.ROUTE_NOT_FOUND,
            ERROR_CODES.ROUTE_NOT_FOUND,
            t('route_not_found_message', { ns: 'error' }),
            t('route_not_found_details', { ns: 'error' }),
            t('route_not_found_suggestion', { ns: 'error' }),
        ),
    );
};
