import type auth from '../../locales/en/auth.json';
import type error from '../../locales/en/error.json';
import type translation from '../../locales/en/translation.json';

import 'i18next';

declare module 'i18next' {
    interface CustomTypeOptions {
        resources: {
            translation: typeof translation;
            auth: typeof auth;
            error: typeof error;
        };
    }
}

/**
 * Every key available in the `error` namespace.
 *
 * Exported so that code which picks a translation key dynamically (the error
 * handler, for example) still gets compile-time checking instead of falling
 * back to `string`.
 */
export type ErrorMessageKey = keyof typeof error;
