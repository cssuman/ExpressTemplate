import { slowDown } from 'express-slow-down';

/**
 * Throttling, not blocking.
 *
 * Where the rate limiter answers "no", this middleware answers "yes, slowly".
 * That is the friendlier response for endpoints where a burst is usually
 * impatience rather than abuse (search-as-you-type, polling), because legitimate
 * clients still succeed while automated hammering becomes uneconomical.
 *
 * With the values below:
 * - requests 1-3 are not delayed
 * - request 4 waits 400ms, request 5 waits 500ms, and so on
 * - the counter resets 15 minutes after the window starts
 *
 * @see https://www.npmjs.com/package/express-slow-down
 */
export const WINDOW_IN_MILI_SECONDS = 15 * 60 * 1000;
export const DELAY_AFTER_REQUEST_COUNT = 3;
export const DELAY_AFTER_REQUEST_COUNT_EXCIDED_IN_MS = 100;

export const slowDownApi = slowDown({
    windowMs: WINDOW_IN_MILI_SECONDS,
    delayAfter: DELAY_AFTER_REQUEST_COUNT,
    delayMs: (hits) => hits * DELAY_AFTER_REQUEST_COUNT_EXCIDED_IN_MS,

    // Acknowledges the v2 delayMs signature; without it the library logs a
    // migration warning on every boot.
    validate: { delayMs: false },
});
