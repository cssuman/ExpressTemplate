import { z } from 'zod';

/**
 * Values that are treated as `true` when read from an environment variable.
 * Everything else (including an unset variable) is treated as `false`.
 */
const TRUTHY_VALUES: string[] = ['true', 't', '1', 'yes', 'y'];

/**
 * Environment variables are ALWAYS strings (or undefined). These helpers turn
 * them into real types once, at boot, so the rest of the codebase never has to
 * think about string coercion again.
 */
/**
 * Like `booleanFromString`, but keeps "unset" distinguishable from "false" so a
 * default can depend on another variable (see ENABLE_API_DOCS below).
 */
const optionalBooleanFromString = () =>
    z
        .string()
        .optional()
        .transform((value) => (value === undefined ? undefined : TRUTHY_VALUES.includes(value.trim().toLowerCase())));

const booleanFromString = (defaultValue: boolean) =>
    z
        .string()
        .optional()
        .transform((value) => (value === undefined ? defaultValue : TRUTHY_VALUES.includes(value.trim().toLowerCase())));

/**
 * Accepts one or more comma-separated origins: `https://a.com,https://b.com`.
 * Each entry must be a valid URL, otherwise the process refuses to start.
 */
const originList = z
    .string()
    .min(1, 'CLIENT_URL is required')
    .transform((value) =>
        value
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean),
    )
    .pipe(z.array(z.string().url('CLIENT_URL must contain valid URLs')).min(1));

/**
 * Express `trust proxy` accepts several shapes; we mirror them here.
 *
 * - `false`            -> not behind a proxy (default, and the safe choice)
 * - `true`             -> trust every proxy (DANGEROUS: lets clients spoof IPs)
 * - `<number>`         -> trust N hops (what you usually want: `1` behind one LB)
 * - `loopback` / CIDRs -> trust specific addresses
 *
 * @see docs/09-security.md#trust-proxy
 */
const trustProxy = z
    .string()
    .optional()
    .transform((raw): boolean | number | string => {
        const value = raw?.trim();

        if (!value || value.toLowerCase() === 'false') return false;
        if (value.toLowerCase() === 'true') return true;
        if (/^\d+$/.test(value)) return Number(value);

        return value;
    });

export const envSchema = z.object({
    app: z
        .object({
            NODE_ENV: z.enum(['development', 'production', 'test']),

            PORT: z.string().optional().default('8080').transform(Number).pipe(z.number().int().positive().max(65535)),

            /**
             * Morgan log format.
             * @see https://github.com/expressjs/morgan#predefined-formats
             */
            LOG_LEVEL: z.enum(['dev', 'short', 'combined', 'common', 'tiny']).optional().default('dev'),

            CLIENT_URL: originList,

            /**
             * Shared secret for the `verifyApiKey` middleware. A short key is worse
             * than no key, so the minimum length is enforced at boot.
             */
            API_KEY: z.string().min(16, 'API_KEY must be at least 16 characters'),

            TRUST_PROXY: trustProxy,

            DISABLE_RATE_LIMITER: booleanFromString(false),

            /**
             * Only honoured when NODE_ENV === 'development'. See verifyApiKey.
             */
            DISABLE_VALIDATE_API_KEY_ON_DEVELOPMENT: booleanFromString(false),

            /**
             * When true, `GET /metrics` requires a valid `x-api-key` header.
             * Leave false only when the port is not reachable from the internet.
             */
            PROTECT_METRICS: booleanFromString(false),

            /**
             * Serves the interactive API reference at /docs.
             * Unset means "on unless this is production" - see the transform below.
             */
            ENABLE_API_DOCS: optionalBooleanFromString(),
        })
        .transform((app) => ({
            ...app,
            /**
             * Documentation is how someone evaluates the API, so it is on by
             * default while developing. In production it advertises every route you
             * have, so it is off unless explicitly switched on.
             */
            ENABLE_API_DOCS: app.ENABLE_API_DOCS ?? app.NODE_ENV !== 'production',
        })),

    /**
     * Optional integration. The server boots without it; `sendEmail` throws a
     * clear, actionable error if it is called while unconfigured.
     */
    sendgrid: z
        .object({
            SEND_GRID_API_KEY: z.string().min(1),
            SEND_GRID_FROM_EMAIL: z.string().email(),
        })
        .partial()
        .transform((value) => ({
            ...value,
            isConfigured: Boolean(value.SEND_GRID_API_KEY && value.SEND_GRID_FROM_EMAIL),
        })),
});

export type envType = z.TypeOf<typeof envSchema>;
