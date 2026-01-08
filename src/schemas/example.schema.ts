import { z } from 'zod';

export const sendEmailSchema = z.object({
    body: z.object({
        to: z.string({ required_error: 'to (receiver) is required' }).email(),
        dynamicTemplateData: z.record(z.any()),
    }),
});

export type sendEmailType = z.infer<typeof sendEmailSchema>;

export const metricsSchema = z.object({
    query: z.object({
        loop: z.coerce.number().int().nonnegative().max(60).default(0),
    }),
});

export type metricsType = z.infer<typeof metricsSchema>;
