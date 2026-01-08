import { Router } from 'express';

import {
    exampleLocalization,
    exampleMetrics,
    exampleVerifyApiKey,
    fileUploadExample,
    sendEmailExample,
    slowDownExample,
} from '@/controllers/example.controller';
import upload from '@/middlewares/multer.middleware';
import validateSchema from '@/middlewares/schema-validation.middleware';
import { slowDownApi } from '@/middlewares/slow-down.middleware';
import { verifyApiKey } from '@/middlewares/verify-apiKey.middleware';
import { metricsSchema, sendEmailSchema } from '@/schemas/example.schema';

const exampleRouter = Router();

exampleRouter.post('/send-email', validateSchema(sendEmailSchema), sendEmailExample);
exampleRouter.post('/file-upload', upload.single('example_file'), fileUploadExample);

exampleRouter.get('/slow-down', slowDownApi, slowDownExample);
exampleRouter.get('/api-key', verifyApiKey, exampleVerifyApiKey);
exampleRouter.get('/localization', exampleLocalization);

exampleRouter.get('/metrics', validateSchema(metricsSchema), exampleMetrics);

export { exampleRouter };
