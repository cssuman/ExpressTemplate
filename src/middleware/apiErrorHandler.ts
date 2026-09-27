import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { v4 as uuid } from 'uuid';
import { ZodError } from 'zod';

import { ERROR_CODES } from '@/constant/error.codes';
import { STATUS_CODES } from '@/constant/status.codes';
import { ApiError } from '@/error/ApiError';
import { apiErrorFormat } from '@/error/apiErrorFormat';
import logger from '@/logger/winston.logger';
import type { ErrorMessageKey } from '@/types/i18n';

/** Body-parser attaches a `type` field to the errors it throws. */
type BodyParserError = Error & { type?: string; status?: number };

interface UploadErrorMapping {
    status: number;
    code: string;
    /** The message / details / suggestion triple, in that order. */
    keys: readonly [ErrorMessageKey, ErrorMessageKey, ErrorMessageKey];
}

/**
 * Multer reports every upload failure as a MulterError with a `code`. Mapping
 * them to explicit translation keys keeps the response in the caller's language
 * instead of leaking the library's English-only message.
 *
 * The map is typed as possibly-missing on purpose: multer can add codes we have
 * not seen, and `noUncheckedIndexedAccess` makes that possibility explicit at
 * the call site instead of at runtime.
 */
const UPLOAD_ERRORS: Record<string, UploadErrorMapping | undefined> = {
    LIMIT_FILE_SIZE: {
        status: STATUS_CODES.PAYLOAD_TOO_LARGE,
        code: ERROR_CODES.PAYLOAD_TOO_LARGE,
        keys: ['file_too_large_message', 'file_too_large_details', 'file_too_large_suggestion'],
    },
    LIMIT_FILE_COUNT: {
        status: STATUS_CODES.BAD_REQUEST,
        code: ERROR_CODES.VALIDATION_ERROR,
        keys: ['too_many_files_message', 'too_many_files_details', 'too_many_files_suggestion'],
    },
    LIMIT_UNEXPECTED_FILE: {
        status: STATUS_CODES.BAD_REQUEST,
        code: ERROR_CODES.VALIDATION_ERROR,
        keys: ['unexpected_file_field_message', 'unexpected_file_field_details', 'unexpected_file_field_suggestion'],
    },
};

/** Used for any multer code not listed above. */
const DEFAULT_UPLOAD_ERROR: UploadErrorMapping = {
    status: STATUS_CODES.BAD_REQUEST,
    code: ERROR_CODES.VALIDATION_ERROR,
    keys: ['upload_failed_message', 'upload_failed_details', 'upload_failed_suggestion'],
};

/**
 * Converts anything that reached the error pipeline into an ApiError.
 *
 * Third-party middleware throws its own error shapes (multer, body-parser,
 * zod). Normalising them in one place means clients always receive the same
 * envelope, and no library ever leaks its internal message format to the API.
 */
const normalize = (err: unknown, t: Request['t']): ApiError => {
    if (err instanceof ApiError) return err;

    if (err instanceof MulterError) {
        const match = UPLOAD_ERRORS[err.code] ?? DEFAULT_UPLOAD_ERROR;

        return new ApiError(
            match.status,
            match.code,
            t(match.keys[0], { ns: 'error' }),
            t(match.keys[1], { ns: 'error' }),
            t(match.keys[2], { ns: 'error' }),
        );
    }

    if (err instanceof ZodError) {
        return new ApiError(
            STATUS_CODES.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR,
            t('schema_validation_error', { ns: 'error' }),
            err.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
            t('validation_error_suggestion', { ns: 'error' }),
        );
    }

    const bodyParserError = err as BodyParserError;

    if (bodyParserError?.type === 'entity.parse.failed') {
        return new ApiError(
            STATUS_CODES.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR,
            t('malformed_json_message', { ns: 'error' }),
            t('malformed_json_details', { ns: 'error' }),
            t('malformed_json_suggestion', { ns: 'error' }),
        );
    }

    if (bodyParserError?.type === 'entity.too.large') {
        return new ApiError(
            STATUS_CODES.PAYLOAD_TOO_LARGE,
            ERROR_CODES.PAYLOAD_TOO_LARGE,
            t('payload_too_large_message', { ns: 'error' }),
            t('payload_too_large_details', { ns: 'error' }),
            t('payload_too_large_suggestion', { ns: 'error' }),
        );
    }

    /**
     * Anything left is an unexpected failure - a bug, not a handled case.
     * The client gets a generic message (never an internal one), the log keeps
     * the original.
     */
    const unexpected = new ApiError(
        STATUS_CODES.GENERAL_ERROR,
        ERROR_CODES.GENERAL_ERROR,
        t('general_error_message', { ns: 'error' }),
        t('general_error_details', { ns: 'error' }),
        t('general_error_suggestion', { ns: 'error' }),
        false,
    );

    if (err instanceof Error && err.stack) unexpected.stack = err.stack;

    return unexpected;
};

/**
 * The application's last line of defence. Registered after every route, so any
 * error passed to `next(err)` - or thrown inside `asyncCatch` - ends up here.
 *
 * Express identifies an error handler by its FOUR arguments. Removing `next`
 * silently turns this into a normal middleware that never runs.
 *
 * @see docs/07-error-handling.md
 */
export function apiErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
    const error = normalize(err, req.t);
    const errorId = uuid();

    const logPayload = {
        errorId,
        requestId: req.rid,
        code: error.errorCode,
        statusCode: error.statusCode,
        method: req.method,
        url: req.originalUrl,
        ip: req.clientIp,
        stack: error.stack,
    };

    // 5xx means "we broke"; 4xx means "the caller sent something wrong".
    // Alerting on warn-level noise is how on-call rotations burn out.
    if (error.statusCode >= STATUS_CODES.GENERAL_ERROR) logger.error(error.message, logPayload);
    else logger.warn(error.message, logPayload);

    /**
     * If the response already started streaming, the status line and headers
     * are gone. Express' default handler is the only thing that can close the
     * connection correctly at this point.
     */
    if (res.headersSent) return next(err);

    res.status(error.statusCode).json(apiErrorFormat(req, error, errorId));
}
