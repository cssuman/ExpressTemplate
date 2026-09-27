/**
 * PM2 process definition.
 *
 * Node runs JavaScript on a single thread, so one process uses one CPU core.
 * Cluster mode forks the app once per core and load-balances between the
 * workers, which is how a single box uses all of its hardware.
 *
 * Inside a container, set PM2_INSTANCES=1: `max` reads the HOST's core count,
 * not the container's CPU limit, and over-forking makes latency worse.
 *
 * See docs/10-performance.md and docs/15-deployment.md
 */
module.exports = {
    apps: [
        {
            name: 'expressTemplate',
            script: './build/server.js',

            instances: process.env.PM2_INSTANCES || 'max',
            exec_mode: 'cluster',

            // Restart if a worker's heap runs away, and stop restart loops from
            // hiding a crash on boot.
            max_memory_restart: '512M',
            min_uptime: '10s',
            max_restarts: 10,

            // Give in-flight requests time to finish (matches SHUTDOWN_TIMEOUT_MS).
            kill_timeout: 10000,

            /**
             * PORT is deliberately absent. PM2 merges these blocks OVER
             * process.env, so setting it here would silently override the
             * PORT from .env or the container environment - the app would bind
             * 8080 while the Docker healthcheck probed the configured port, and
             * the container would never become healthy.
             */
            env: {
                NODE_ENV: 'development',
            },
            env_production: {
                NODE_ENV: 'production',
            },
        },
    ],
};
