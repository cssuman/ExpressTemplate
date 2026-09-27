import dotenvFlow from 'dotenv-flow';
import fs from 'fs';
import path from 'path';
import winston from 'winston';

/**
 * NOTE: this module deliberately reads `process.env` directly instead of
 * importing `@/config/env`.
 *
 * `@/config/env` imports this logger (to report invalid configuration), so
 * importing it back here would create a circular dependency. The logger is the
 * one module allowed to touch process.env.
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

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isDevelopment = NODE_ENV === 'development';

const LOG_DIR = path.resolve(process.cwd(), 'logs');

/** Winston's File transport does not create missing directories. */
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

/**
 * Custom severity levels. Lower number = higher severity.
 * A transport with `level: 'info'` records info, warn and error - but not http
 * or debug.
 */
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

winston.addColors({
    error: 'red',
    warn: 'yellow',
    info: 'blue',
    http: 'magenta',
    debug: 'white',
});

/**
 * Files are written as JSON so log shippers (Loki, CloudWatch, Datadog) can
 * index fields instead of regex-parsing a string. `errors({ stack: true })`
 * keeps stack traces when an Error object is logged.
 */
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
);

/**
 * Size-based rotation keeps disks from filling up on a long-running box.
 * `tailable: true` keeps the newest entries in error.log / info.log.
 */
const rotation = { maxsize: 10 * 1024 * 1024, maxFiles: 5, tailable: true };

/**
 * PM2 cluster mode runs one process per core, and rotation renames files.
 * Workers sharing a single error.log would rename each other's files out from
 * under themselves and lose lines, so each worker gets its own set.
 *
 * PM2 sets NODE_APP_INSTANCE; outside PM2 there is a single process and no
 * suffix. In containers, prefer stdout only and let the platform handle
 * retention - see docs/08-logging.md.
 */
const instance = process.env.NODE_APP_INSTANCE;
const logFile = (name: string) => path.join(LOG_DIR, instance ? `${name}-${instance}.log` : `${name}.log`);

/**
 * NOTE: no `exceptionHandlers`, `rejectionHandlers` or `exitOnError` here, on
 * purpose.
 *
 * Winston's exception handlers replace Node's default behaviour. Pointed at a
 * file, with `exitOnError: false`, a throw during module load - before
 * server.ts can install its own handlers - printed NOTHING to stdout and exited
 * 0. Kubernetes reads that as a successful run, and in a container the log file
 * dies with it, so the operator gets no signal at all.
 *
 * Leaving them off restores the correct default: the stack goes to stderr and
 * the process exits non-zero. Failures after startup are handled by
 * server.ts, which logs through this logger and then shuts down gracefully.
 */
const logger = winston.createLogger({
    levels,
    level: isDevelopment ? 'debug' : 'info',
    format: fileFormat,
    transports: [
        new winston.transports.File({ filename: logFile('error'), level: 'error', ...rotation }),
        new winston.transports.File({ filename: logFile('info'), level: 'info', ...rotation }),
    ],
});

/**
 * Human-readable, coloured output for local development only. In production the
 * process manager captures stdout, so structured JSON is added there instead.
 */
logger.add(
    new winston.transports.Console({
        format: isDevelopment
            ? winston.format.combine(
                  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                  winston.format.errors({ stack: true }),
                  winston.format.colorize({ all: false, message: true, level: true }),
                  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
              )
            : fileFormat,
    }),
);

export default logger;
