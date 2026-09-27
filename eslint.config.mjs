import pluginJs from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginSecurity from 'eslint-plugin-security';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
    /* A standalone `ignores` entry is a GLOBAL ignore. Listing them next to
       `files` only filters that one config block, which is a common flat-config
       mistake. */
    { ignores: ['node_modules/**', 'build/**', 'dist/**', 'coverage/**', 'logs/**'] },

    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,

    {
        files: ['**/*.{js,mjs,cjs,ts}'],

        /* This is a Node server: `window` and `document` do not exist here, but
           `process` and `Buffer` do. */
        languageOptions: { globals: globals.node },

        plugins: { security: eslintPluginSecurity, 'simple-import-sort': simpleImportSort },

        rules: {
            /* Use the logger, never console: console output is unstructured,
               unlevelled and invisible to log shippers. */
            'no-console': 'error',
            'no-duplicate-imports': 'error',
            'require-atomic-updates': 'error',
            eqeqeq: ['error', 'smart'],

            /* Deterministic import order keeps diffs small and reviews honest. */
            'simple-import-sort/exports': 'error',
            'simple-import-sort/imports': ['error', { groups: [['^node:'], ['^express$', '^@?\\w'], ['^@'], ['^\\.']] }],

            /* `_unused` is the documented way to say "required by the signature,
               intentionally unused" - common in Express middleware. */
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

            /* Exported functions declare their return type. Inference is fine
               inside a module; across a module boundary an explicit type is the
               contract, and stops an accidental change from silently rippling
               out to every caller. Function expressions passed to an already
               typed parameter (controllers wrapped in asyncCatch) are exempt. */
            '@typescript-eslint/explicit-module-boundary-types': 'error',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-empty-object-type': 'off',
        },
    },

    /* Standalone CLI scripts have no logger and exist to talk to whoever ran
       them, so console output is the point rather than a mistake. */
    {
        files: ['scripts/**/*.{js,mjs,cjs}'],
        rules: { 'no-console': 'off' },
    },

    /* Must stay last: turns off every stylistic rule Prettier already owns. */
    eslintConfigPrettier,
];
