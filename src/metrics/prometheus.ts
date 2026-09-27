import { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

/**
 * Prometheus instrumentation.
 *
 * Collects the RED signals - Rate, Errors, Duration - for every HTTP request,
 * plus Node.js process metrics (event loop lag, heap, GC, handles) which are
 * usually the first place a performance problem shows up.
 *
 * @see docs/11-observability.md
 */
client.collectDefaultMetrics({ register: client.register });

/**
 * Buckets decide which latency questions you can answer later. These cover
 * "fast API" territory; widen them if your p99 lives above 5 seconds.
 */
const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 0.7, 1, 2, 5],
});

const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
});

/**
 * Captures the matched ROUTE PATTERN (`/api/v0/example/:id`), never the raw URL.
 *
 * Every distinct label value creates a new time series. Using `req.path` would
 * make `/users/1` and `/users/2` separate series - and a scanner hitting random
 * URLs could exhaust the server's memory.
 *
 * Why the property descriptor: Express assigns `req.route` the moment a layer
 * matches, which is the only moment `req.baseUrl` holds the router's mount path
 * too. By the time `finish` fires on an ERROR response, Express has unwound the
 * stack and reset `baseUrl` - so reading it there would report `/api-key` for a
 * 401 and `/api/v0/example/api-key` for a 200, splitting one endpoint across two
 * time series. Intercepting the assignment records the full pattern exactly once.
 */
const captureRoutePattern = (req: Request): (() => string) => {
    let matchedPattern: string | undefined;
    let routeValue: unknown = req.route;

    Object.defineProperty(req, 'route', {
        configurable: true,
        enumerable: true,
        get: () => routeValue,
        set: (value: unknown) => {
            routeValue = value;

            const routePath = (value as { path?: string } | undefined)?.path;
            if (!routePath) return;

            matchedPattern = `${req.baseUrl || ''}${routePath === '/' ? '' : routePath}` || '/';
        },
    });

    // Requests that match nothing collapse into one bucket, by design.
    return () => matchedPattern ?? 'unmatched';
};

export const prometheus = (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();
    const routeLabel = captureRoutePattern(req);

    /**
     * `finish` fires when the response has been handed to the OS. `close` also
     * fires if the client disconnects early, so recording on `finish` measures
     * work the server actually completed.
     */
    res.on('finish', () => {
        const durationInSeconds = Number(process.hrtime.bigint() - start) / 1e9;
        const labels = { method: req.method, route: routeLabel(), status_code: String(res.statusCode) };

        httpRequestDuration.observe(labels, durationInSeconds);
        httpRequestsTotal.inc(labels);
    });

    next();
};

/**
 * Scrape endpoint. Exposes internals (routes, versions, traffic shape), so keep
 * it on a private network or set PROTECT_METRICS=true.
 */
export const metrics = async (_req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Type', client.register.contentType);
    res.send(await client.register.metrics());
};
