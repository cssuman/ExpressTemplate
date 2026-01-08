import { Router } from 'express';

import { exampleRouter } from '@/routers/example.route';
import { healthRouter } from '@/routers/health.route';

const router = Router();

router.use('/health', healthRouter);
router.use('/example', exampleRouter);

export default router;
