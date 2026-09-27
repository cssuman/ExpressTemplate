import { Response } from 'express';

export const customSuccessResponse = (res: Response, status: number, message: string, data?: unknown): Response => {
    const response = {
        success: true,
        status,
        message,
        data,
    };

    return res.status(status).json(response);
};
