import app from '@/app';
import { env } from '@/config/env';
import logger from '@/logger/winston.logger';
import { i18nReady } from '@/middleware/i18Next';
import { getLocalIp } from '@/utils/getLocalIp';

/** How long in-flight requests get to finish before the process is killed. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

const startServer = async () => {
    /**
     * Hi Folks! 👋
     * Put anything that must be ready BEFORE the first request here -
     * database connections, cache clients, queue consumers - and only call
     * `app.listen` once they resolve. A server that accepts traffic before its
     * dependencies are up returns 500s instead of waiting.
     *
     * Translations are the existing example: without this await, the first few
     * requests could be answered with raw translation keys.
     */
    await i18nReady;

    const server = app.listen(env.app.PORT, () => {
        logger.info(
            `\nServer is running on ${env.app.NODE_ENV} mode\n- Local   http://localhost:${env.app.PORT}\n- Network http://${getLocalIp()}:${env.app.PORT}`,
        );
    });

    /**
     * Must be longer than the idle timeout of any load balancer in front of the
     * server (AWS ALB defaults to 60s). If Node closes a connection the LB still
     * considers open, clients see sporadic 502s.
     */
    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 66_000;

    /**
     * Listen errors are fatal: the port is unusable, so there is nothing to
     * recover to. A lookup keeps the two known causes readable and lets anything
     * unrecognised propagate with its original stack intact.
     */
    server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.syscall !== 'listen') throw error;

        const fatalMessages: Record<string, string | undefined> = {
            EACCES: `Port ${env.app.PORT} requires elevated privileges`,
            EADDRINUSE: `Port ${env.app.PORT} is already in use`,
        };

        const message = error.code ? fatalMessages[error.code] : undefined;
        if (!message) throw error;

        logger.error(message);
        process.exit(1);
    });

    let isShuttingDown = false;

    /**
     * Graceful shutdown.
     *
     * `server.close()` stops accepting new connections and waits for in-flight
     * requests to finish. The timer is the important half: without it a single
     * hung request keeps the process alive until the orchestrator SIGKILLs it,
     * and every other in-flight request dies with it.
     */
    const onShutdown = (signal: string) => () => {
        if (isShuttingDown) return;
        isShuttingDown = true;

        logger.info(`${signal} received, shutting down gracefully`);

        const forceExit = setTimeout(() => {
            logger.error('Could not close connections in time, forcing shutdown');
            process.exit(1);
        }, SHUTDOWN_TIMEOUT_MS);

        // Do not keep the event loop alive just for this timer.
        forceExit.unref();

        server.close(() => {
            logger.info('Server is shut down');
            process.exit(0);
        });
    };

    process.on('SIGINT', onShutdown('SIGINT'));
    process.on('SIGTERM', onShutdown('SIGTERM'));

    /**
     * A rejected promise nobody awaited, or a throw outside any request, leaves
     * the process in an unknown state. Log it, then let the process manager
     * restart a clean one - that is what PM2, Docker and Kubernetes are for.
     */
    process.on('unhandledRejection', (reason: unknown) => {
        logger.error('Unhandled promise rejection', { reason });
        onShutdown('unhandledRejection')();
    });

    process.on('uncaughtException', (error: Error) => {
        logger.error('Uncaught exception', { message: error.message, stack: error.stack });
        onShutdown('uncaughtException')();
    });
};

startServer().catch((error) => {
    logger.error('Error initializing app', { message: (error as Error).message, stack: (error as Error).stack });
    process.exit(1);
});
