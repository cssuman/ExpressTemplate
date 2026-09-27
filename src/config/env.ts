import dotenvFlow from 'dotenv-flow';

import logger from '@/logger/winston.logger';
import { envSchema } from '@/schema/env.schema';

/**
 * Loads .env, .env.local, .env.<NODE_ENV>, .env.<NODE_ENV>.local
 * (later files win). Nothing else in the codebase should read process.env.
 *
 * @see docs/04-configuration.md
 */
dotenvFlow.config({
    /**
     * No .env file is a normal, correct state in production, where variables
     * are injected by the platform. The library's warning would fire on every
     * boot - and `src/config/env.ts` reports anything actually missing with a
     * far more useful message.
     */
    silent: true,
});

/**
 * Reads one variable, treating blank as absent.
 *
 * `FOO=` in a .env file produces the empty string, not `undefined` - so an
 * optional variable left blank would otherwise be "present but invalid" and
 * fail validation. Trimming also removes the trailing whitespace that silently
 * breaks secret comparisons.
 */
const read = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed === '' ? undefined : trimmed;
};

const parsedEnv = envSchema.safeParse({
    app: {
        NODE_ENV: read(process.env.NODE_ENV),
        PORT: read(process.env.PORT),
        LOG_LEVEL: read(process.env.LOG_LEVEL),
        CLIENT_URL: read(process.env.CLIENT_URL),
        API_KEY: read(process.env.API_KEY),
        TRUST_PROXY: read(process.env.TRUST_PROXY),
        DISABLE_RATE_LIMITER: read(process.env.DISABLE_RATE_LIMITER),
        DISABLE_VALIDATE_API_KEY_ON_DEVELOPMENT: read(process.env.DISABLE_VALIDATE_API_KEY_ON_DEVELOPMENT),
        PROTECT_METRICS: read(process.env.PROTECT_METRICS),
        ENABLE_API_DOCS: read(process.env.ENABLE_API_DOCS),
    },

    sendgrid: {
        SEND_GRID_API_KEY: read(process.env.SEND_GRID_API_KEY),
        SEND_GRID_FROM_EMAIL: read(process.env.SEND_GRID_FROM_EMAIL),
    },
});

/**
 * Fail fast: a misconfigured server should never accept a single request.
 * Crashing at boot is far cheaper than discovering the problem in production
 * traffic, and process managers (PM2, Docker, Kubernetes) surface it loudly.
 */
if (!parsedEnv.success) {
    const issues = parsedEnv.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');

    logger.error(`Invalid environment configuration:\n${issues}\n\nCheck .env.example and your .env.local file.`);
    process.exit(1);
}

export const env = parsedEnv.data;
