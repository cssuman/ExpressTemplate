import { Router } from 'express';

import { root } from '@/controllers/root.controller';

const rootRouter = Router();

rootRouter.get('/', root);

export { rootRouter };
