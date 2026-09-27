import { Request } from 'express';
import multer, { FileFilterCallback, Multer } from 'multer';

import { ERROR_CODES } from '@/constant/error.codes';
import { STATUS_CODES } from '@/constant/status.codes';
import { ApiError } from '@/error/ApiError';

/**
 * File uploads are the most common way a web server is turned into free
 * storage, a malware host, or an out-of-memory crash. Three limits defend
 * against that, and all three are on by default here:
 *
 * 1. MIME allow-list  - reject anything not explicitly permitted
 * 2. file size limit   - reject before the whole body is buffered
 * 3. file count limit  - reject "upload 10,000 tiny files" requests
 *
 * @see docs/14-file-uploads.md
 */
export interface UploadConfig {
    /** Allowed MIME types, e.g. `['image/png', 'application/pdf']`. */
    allowedTypes?: string[];
    /** Maximum size per file in bytes. Default 5 MB. */
    maxFileSize?: number;
    /** Maximum number of files per request. Default 5. */
    maxFiles?: number;
}

const DEFAULT_ALLOWED_TYPES: string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;
const DEFAULT_MAX_FILES = 5;

/**
 * Creates a multer instance backed by memory storage.
 *
 * Memory storage keeps the file in a Buffer (`file.buffer`), which is ideal for
 * "validate, then forward to S3/Firebase" flows. For large files prefer
 * `multer.diskStorage` or a streaming upload - a 100 MB file in memory times
 * ten concurrent requests is a gigabyte of heap.
 *
 * @example
 * const upload = createUploadMiddleware({ allowedTypes: ['image/png'], maxFiles: 3 });
 * router.post('/avatars', upload.array('images', 3), handler);
 */
export const createUploadMiddleware = (config: UploadConfig = {}): Multer => {
    const { allowedTypes = DEFAULT_ALLOWED_TYPES, maxFileSize = DEFAULT_MAX_FILE_SIZE, maxFiles = DEFAULT_MAX_FILES } = config;

    const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
        if (file.mimetype && allowedTypes.includes(file.mimetype)) return cb(null, true);

        /**
         * `mimetype` is supplied by the client and can be forged. This check
         * stops honest mistakes and casual abuse; for untrusted input also
         * verify the file's magic bytes after upload.
         */
        cb(
            new ApiError(
                STATUS_CODES.UNSUPPORTED_MEDIA_TYPE,
                ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
                req.t('unsupported_file_type_message', { ns: 'error' }),
                req.t('unsupported_file_type_details', { ns: 'error', type: file.mimetype || 'unknown' }),
                req.t('unsupported_file_type_suggestion', { ns: 'error', types: allowedTypes.join(', ') }),
            ),
        );
    };

    return multer({
        fileFilter,
        storage: multer.memoryStorage(),
        limits: { fileSize: maxFileSize, files: maxFiles },
    });
};

/**
 * Ready-to-use instance with the safe defaults above.
 * Call `createUploadMiddleware()` directly when a route needs different limits.
 */
const upload = createUploadMiddleware();

export default upload;
