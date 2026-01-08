import { Request, Response } from 'express';

import asyncCatch from '@/errors/asyncCatch.error';
import { customSuccessResponse } from '@/utils/custom-success-response.util';
import quicker from '@/utils/quicker.util';

export const getHealth = asyncCatch(async (req: Request, res: Response) => {
    customSuccessResponse(res, 200, req.t('good_api_health_check'), {
        application: quicker.getApplicationHealth(),
        system: quicker.getSystemHealth(),
        timestamp: Date.now(),
    });
});
