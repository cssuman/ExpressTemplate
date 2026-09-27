import { z } from 'zod';

/**
 * Schemas are the contract for an endpoint AND the source of its types.
 * `z.infer` means the controller's types can never drift from what is actually
 * validated at runtime - change the schema and the compiler finds every caller.
 *
 * @see docs/06-validation.md
 */
export const sendEmailSchema = z.object({
    body: z.object({
        to: z.string({ required_error: 'to (receiver) is required' }).email(),
        dynamicTemplateData: z.object({
            name: z.string().min(1),
            role: z.string().min(1),
        }),
    }),
});

export type sendEmailType = z.infer<typeof sendEmailSchema>;

export const metricsSchema = z.object({
    query: z.object({
        // Query strings are always strings; `coerce` turns "5" into 5 so the
        // controller receives the number its type promises.
        loop: z.coerce.number().int().nonnegative().max(60).default(0),
    }),
});

export type metricsType = z.infer<typeof metricsSchema>;
