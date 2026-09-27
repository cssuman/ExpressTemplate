import { Router } from 'express';

import { exampleLocalization, exampleMetrics, exampleVerifyApiKey, fileUploadExample, sendEmailExample, slowDownExample } from '@/controller/example';
import { createUploadMiddleware } from '@/middleware/multer';
import validateSchema from '@/middleware/schema.validation';
import { slowDownApi } from '@/middleware/slow-down';
import { verifyApiKey } from '@/middleware/verifyApiKey';
import { metricsSchema, sendEmailSchema } from '@/schema/example.schema';

/**
 * Routers stay thin: path, middleware chain, controller. No logic lives here,
 * which makes the security posture of every endpoint readable at a glance.
 *
 * Middleware runs left to right, so cheap rejections (validation, auth) come
 * before expensive work.
 */
const exampleRouter = Router();

/** Per-route limits: this endpoint accepts one small image or PDF. */
const uploadExampleFile = createUploadMiddleware({
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxFileSize: 2 * 1024 * 1024,
    maxFiles: 1,
});

exampleRouter.post('/send-email', validateSchema(sendEmailSchema), sendEmailExample);
exampleRouter.post('/file-upload', uploadExampleFile.single('example_file'), fileUploadExample);

exampleRouter.get('/slow-down', slowDownApi, slowDownExample);
exampleRouter.get('/api-key', verifyApiKey, exampleVerifyApiKey);
exampleRouter.get('/localization', exampleLocalization);

exampleRouter.get('/metrics', validateSchema(metricsSchema), exampleMetrics);

export { exampleRouter };
