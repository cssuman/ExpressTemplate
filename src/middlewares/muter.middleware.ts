import { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';

/**
 * Configuration options for the upload middleware.
 */
interface UploadConfig {
    /**
     * List of allowed MIME types.
     * Example: ['image/png', 'application/pdf']
     * If omitted, defaults to a safe set of image and document types.
     */
    allowedTypes?: string[];

    /**
     * Maximum allowed file size in bytes.
     * Defaults to 5MB (5 * 1024 * 1024).
     */
    maxFileSize?: number;

    /**
     * Maximum number of files allowed per upload.
     * Defaults to 5.
     */
    maxFiles?: number;
}

/**
 * Default allowed MIME types including common image and document types.
 */
const DEFAULT_ALLOWED_TYPES: string[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/gif', 'image/svg+xml'];

/**
 * Creates a configured multer middleware for handling file uploads with memory storage.
 *
 * @param config - Upload configuration including allowed MIME types, file size limit, and max number of files.
 * @returns Configured multer middleware instance.
 *
 * @example
 * ```ts
 * // Create an upload middleware that accepts only JPEG and PNG images
 * const upload = createUploadMiddleware({
 *   allowedTypes: ['image/jpeg', 'image/png'],
 *   maxFileSize: 2 * 1024 * 1024, // 2MB
 *   maxFiles: 3,
 * });
 *
 * // Use it in a route
 * router.post('/upload', upload.array('images', 3), handlerFunction);
 * ```
 */
const createUploadMiddleware = (config: UploadConfig) => {
    const {
        allowedTypes = DEFAULT_ALLOWED_TYPES,
        maxFileSize = 5 * 1024 * 1024, // Default to 5MB
        maxFiles = 5, // Default to 5 files
    } = config;

    /**
     * Multer file filter to validate MIME types.
     *
     * @param _req - The Express request object.
     * @param file - The uploaded file object.
     * @param cb - Callback to signal acceptance or rejection of the file.
     */
    const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
        if (!file.mimetype) {
            return cb(new Error('File type is missing') as unknown as null, false);
        }

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}`) as unknown as null, false);
        }
    };

    return multer({
        fileFilter,
        storage: multer.memoryStorage(),
        limits: {
            files: maxFiles,
            fileSize: maxFileSize,
        },
    });
};

export default createUploadMiddleware;
