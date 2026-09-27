import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import ruid from 'express-ruid';
import useragent from 'express-useragent';
import helmet from 'helmet';
import path from 'path';
import requestIp from 'request-ip';

import { env } from '@/config/env';
import morganMiddleware from '@/logger/morgan.logger';
import { metrics, prometheus } from '@/metrics/prometheus';
import { apiErrorHandler } from '@/middleware/apiErrorHandler';
import i18nMiddleware from '@/middleware/i18Next';
import { rateLimiter } from '@/middleware/rate-limiter';
import { routeNotFoundHandler } from '@/middleware/route.not.found';
import { verifyApiKey } from '@/middleware/verifyApiKey';
import openApiRouter from '@/openapi';
import router from '@/router/index';
import { rootRouter } from '@/router/root.route';

/**
 * Middleware order is the architecture of an Express app: every `app.use` runs
 * in registration order, and the first one to send a response ends the request.
 * The grouping below is deliberate - read docs/02-architecture.md before
 * reordering anything.
 */
const app: Express = express();

/**
 * PROXY AWARENESS
 * Must be set before any middleware reads `req.ip`. Without it, a server behind
 * a load balancer sees the proxy's address for every client: rate limiting
 * becomes global and logs become useless.
 */
app.set('trust proxy', env.app.TRUST_PROXY);

// Helmet also removes this, but being explicit costs nothing.
app.disable('x-powered-by');

/**
 * 1. REQUEST IDENTITY
 * Runs first so that everything downstream - logs, metrics, errors - can refer
 * to the same request id, client IP and user agent.
 */
/**
 * express-ruid reuses an inbound `request-id` header when present, which lets a
 * client pick the id that ends up in the logs and in every error body - two
 * requests can share an id, and the value is attacker-controlled text flowing
 * into log records.
 *
 * Dropping the inbound header first makes every id server-generated. If you
 * terminate at a trusted proxy that already assigns request ids, remove this
 * and let the upstream value through deliberately.
 */
app.use((req, _res, next) => {
    delete req.headers['request-id'];
    next();
});

app.use(ruid({ setHeader: true })); // req.rid + Request-Id response header
app.use(requestIp.mw()); // req.clientIp, honouring forwarded headers
app.use(useragent.express()); // req.useragent

/**
 * 2. LOCALIZATION
 * Provides `req.t`. Must precede any middleware that produces a user-facing
 * message - the rate limiter and error handler both translate.
 */
app.use(i18nMiddleware);

/**
 * 3. OBSERVABILITY
 * Deliberately placed BEFORE the security layer: a request rejected by the rate
 * limiter is exactly the kind of traffic you need in your logs and metrics.
 */
app.use(morganMiddleware);
app.use(prometheus);

/**
 * 4. SECURITY
 * Reject unwanted traffic as early and as cheaply as possible - before parsing
 * bodies or touching business logic.
 */
app.use(helmet()); // Security headers (CSP, HSTS, nosniff, frameguard, ...)
app.use(
    cors({
        origin: env.app.CLIENT_URL, // Explicit allow-list from CLIENT_URL
        credentials: true, // Required for cookie-based sessions
    }),
);
app.use(rateLimiter);

/**
 * 5. BODY PARSING
 * The 16kb ceiling is a security control, not a formality: it caps how much
 * memory an anonymous request can make the server allocate. Routes that accept
 * files use multer instead, which streams and enforces its own limits.
 */
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(cookieParser());

/**
 * 6. RESPONSE OPTIMISATION
 */
app.use(compression()); // gzip/deflate responses above ~1kb
app.use(express.static(path.resolve(process.cwd(), 'public')));

/**
 * 7. ROUTES
 * `/api/v0` is the versioned surface: breaking changes ship as `/api/v1`
 * alongside it, so existing clients keep working.
 */
const metricsGuard = env.app.PROTECT_METRICS ? verifyApiKey : (_req: Request, _res: Response, next: NextFunction) => next();

app.get('/metrics', metricsGuard, metrics);

// Interactive API reference. Self-contained in src/openapi - that folder's
// README explains how to remove the feature entirely.
if (env.app.ENABLE_API_DOCS) app.use('/docs', openApiRouter);

app.use('/', rootRouter);
app.use('/api/v0', router);

/**
 * 8. ERROR HANDLING
 * Last, always. Anything that reaches here matched no route (404) or failed
 * (everything else).
 */
app.use(routeNotFoundHandler);
app.use(apiErrorHandler);

export default app;
