import { IncomingMessage } from 'http';
import morgan from 'morgan';

import { env } from '@/config/env';
import logger from '@/logger/winston.logger';

/**
 * Morgan writes one line per HTTP request. Instead of letting it print to
 * stdout on its own, we pipe it into Winston's `http` level so that every log
 * line in the application - request logs included - goes through one pipeline,
 * one format and one set of transports.
 *
 * @see docs/08-logging.md
 */
const stream = {
    write: (message: string) => logger.http(message.trim()),
};

/**
 * Health checks and metrics scrapes hit the server every few seconds. Logging
 * them buries real traffic and inflates log storage cost for zero benefit.
 */
const NOISY_ROUTES = ['/metrics', '/api/v0/health'];

const skip = (req: IncomingMessage & { originalUrl?: string }) => {
    // Exact match: a prefix match would also silence /metricsXYZ, hiding
    // exactly the traffic an abuser would send.
    const [path] = (req.originalUrl ?? req.url ?? '').split('?');
    return NOISY_ROUTES.includes(path ?? '');
};

/**
 * The format string comes from LOG_LEVEL (`dev`, `combined`, `tiny`, ...).
 * Use `combined` in production - it includes referrer and user-agent, which you
 * will want the first time you investigate an incident.
 */
const morganMiddleware = morgan(env.app.LOG_LEVEL as string, { stream, skip });

export default morganMiddleware;
