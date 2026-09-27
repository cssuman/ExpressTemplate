import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';

import logger from '@/logger/winston.logger';

/**
 * Internationalisation.
 *
 * Every user-facing string in this application comes from `locales/`, reached
 * through `req.t`. Nothing hard-codes English. That is what lets the same error
 * be returned in Nepali to one client and English to another - and it keeps
 * copy changes out of the source code.
 *
 * Namespaces split the catalogue by concern (`translation`, `auth`, `error`) so
 * a file stays readable as the application grows:
 *
 *   req.t('welcome')                              -> translation namespace
 *   req.t('route_not_found_message', { ns: 'error' })
 *
 * @see docs/12-internationalization.md
 */
export const i18nReady = i18next
    .use(Backend) // Reads JSON from disk
    .use(middleware.LanguageDetector) // Picks a language per request
    .init({
        fallbackLng: 'en', // Used when nothing matches
        preload: ['en', 'ne'], // Loaded at startup, not on first request
        ns: ['translation', 'auth', 'error'],
        defaultNS: 'translation',

        backend: {
            // Resolved from the working directory, so `locales/` stays outside
            // `src/` and survives the TypeScript build untouched.
            loadPath: './locales/{{lng}}/{{ns}}.json',
        },

        detection: {
            // First match wins: an explicit ?lng=ne beats the browser's header.
            order: ['querystring', 'header'],
            lookupQuerystring: 'lng',
            lookupHeader: 'accept-language',
        },

        interpolation: {
            /**
             * Off because this is a JSON API. HTML-escaping here would turn
             * `image/png` into `image&#x2F;png` in a JSON field for no benefit -
             * escaping belongs at the point where a value is rendered into
             * HTML, which is the client's job. Turn it back on if you ever
             * render these strings into a server-side template.
             */
            escapeValue: false,

            format: (value, format) => {
                if (format === 'uppercase') return String(value).toUpperCase();
                if (format === 'lowercase') return String(value).toLowerCase();
                return value;
            },

            defaultVariables: { appName: 'ExpressTemplate' },
            skipOnVariables: true,
        },
    })
    .then(() => {
        logger.info('i18next initialized');
    })
    .catch((error) => {
        logger.error('Error initializing i18next', { error });
        throw error;
    });

export default middleware.handle(i18next);
