import { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import { ERROR_CODES } from '@/constant/error.codes';
import { STATUS_CODES } from '@/constant/status.codes';
import { ApiError } from '@/error/ApiError';

/** The request parts a schema is allowed to describe. */
const REQUEST_PARTS = ['body', 'query', 'params', 'headers'] as const;
type RequestPart = (typeof REQUEST_PARTS)[number];

/**
 * Validates a request against a Zod schema before the controller runs.
 *
 * Validate at the edge, once. Everything past this middleware can trust its
 * input, which is what lets controllers stay free of defensive `if (!x) return`
 * noise. Zod also *coerces* here (`?loop=5` becomes the number 5), so the types
 * a controller sees match the types its schema declares.
 *
 * A schema only declares the parts it cares about:
 *
 * ```ts
 * const schema = z.object({ body: z.object({ email: z.string().email() }) });
 * router.post('/signup', validateSchema(schema), signup);
 * ```
 *
 * @see docs/06-validation.md
 */
export default function validateSchema(schema: z.AnyZodObject): RequestHandler<{}, {}, {}, {}> {
    return function (req: Request<{}, {}, {}, {}>, _res: Response, next: NextFunction): void {
        const result = schema.safeParse({
            body: req.body,
            query: req.query,
            params: req.params,
            headers: req.headers,
        });

        if (!result.success) {
            return next(
                new ApiError(
                    STATUS_CODES.BAD_REQUEST,
                    ERROR_CODES.VALIDATION_ERROR,
                    req.t('schema_validation_error', { ns: 'error' }),
                    result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
                    req.t('validation_error_suggestion', { ns: 'error' }),
                ),
            );
        }

        /**
         * Only overwrite the parts the schema actually declared.
         *
         * Zod strips unknown keys, so assigning the whole parsed object back
         * would set `req.headers = undefined` for a body-only schema and break
         * every middleware that runs later.
         */
        const parsed = result.data as Partial<Record<RequestPart, unknown>>;

        for (const part of REQUEST_PARTS) {
            if (parsed[part] !== undefined) Object.assign(req, { [part]: parsed[part] });
        }

        return next();
    };
}
