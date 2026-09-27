## 1.6.0 - 2026-09-26

1. #### Added an interactive API reference at `/docs`
    - Browsable reference with a try-it console, plus the OpenAPI 3.0 document at
      `/docs/openapi.json` for Postman, Insomnia or client generators
    - Generated from the existing Zod schemas, so the docs cannot drift from the
      validation - adding an endpoint is one `registerEndpoint` block
    - Self-contained in `src/openapi/` behind one guarded line in `app.ts` and the
      `ENABLE_API_DOCS` flag; `src/openapi/README.md` documents removal in four steps
    - On by default in development, off in production (it advertises every route)
    - The renderer is loaded as a pinned CDN script rather than an npm package: the
      Scalar Express wrapper is ESM-only and cannot be required from this CommonJS
      build on Node 18 or 20. The CSP relaxation it needs applies to `/docs` only

2. #### Added full developer documentation
    - New `docs/` folder: 18 guides covering architecture, configuration, validation,
      error handling, logging, security, performance, observability, i18n, email,
      uploads, deployment, coding standards, extending the template and troubleshooting
    - Added `docs/diagrams/architecture.drawio.xml` (deployment topology)
    - Added `CLAUDE.md` — condensed repo context and invariants for AI assistants

3. #### Security fixes
    - `verifyApiKey`: the development bypass is now gated on `NODE_ENV` as well as the
      flag. Previously `DISABLE_VALIDATE_API_KEY_ON_DEVELOPMENT=true` disabled auth in
      any environment
    - `verifyApiKey`: constant-time comparison (`crypto.timingSafeEqual`) instead of `!==`
    - Added `TRUST_PROXY` so `req.ip` is correct behind a load balancer - rate limiting
      and IP logging were both broken behind a proxy
    - Added `PROTECT_METRICS` to require an API key on `/metrics`
    - Upload limits (MIME allow-list, size, count) now apply to the shipped upload route
    - `sendEmail` refuses template paths that escape the template directory
    - `.dockerignore` now excludes `.env*`, so secrets cannot be baked into an image

4. #### Correctness fixes
    - `validateSchema` no longer sets `req.query`/`req.headers` to `undefined` when a
      schema declares only `body`
    - `apiErrorHandler` no longer calls `next()` after responding, guards `headersSent`,
      and normalises multer/zod/body-parser errors into the standard envelope
    - Email templates moved to `templates/email/` - inside `src/` they were dropped by
      `tsc` and missing from production builds
    - Prometheus route labels no longer split one endpoint across two series on error
      responses, and unmatched routes collapse into `unmatched` (cardinality DoS)
    - `morgan.logger.ts` is now actually used by `app.ts` (it was dead code)
    - Observability middleware moved before the security layer, so rate-limited requests
      appear in logs and metrics
    - Graceful shutdown now has a forced-exit timeout; `keepAliveTimeout` set for
      load balancers; `unhandledRejection`/`uncaughtException` handled
    - `i18nReady` is awaited before the server listens
    - i18n interpolation no longer HTML-escapes values in JSON responses

5. #### Configuration
    - Removed the unused, but mandatory, Firebase and Twilio variables
    - SendGrid is now optional: the server boots without it and returns 503 if used
    - Defaults for `PORT`, `LOG_LEVEL`, and the feature flags; `API_KEY` minimum length
    - `CLIENT_URL` accepts a comma-separated list of origins

6. #### Fixed and extended the npm scripts
    - `lint-staged` was configured and invoked by the pre-commit hook but was never
      installed - every commit failed. Added it, and fixed its glob
      (`src/**/*{.js,ts}` matched files ending in "ts", not `.ts` files)
    - `pm2:dev` / `pm2:prod` failed with "pm2: command not found" - pm2 was not a
      dependency. Added it, and both scripts now build before starting
    - `clean` (`tsc --build --clean`) exited successfully while leaving `build/`
      in place. It now removes the directory and the incremental cache
    - Added `rebuild`, `dev:debug`, `check` (typecheck + lint + format:check),
      `pm2:stop`, `pm2:logs`, `docker:up`, `docker:down`, `docker:logs`
    - `docker:up` now explains that `.env.production` is missing instead of starting
      containers that crash-loop; compose marks the env file optional
    - Added `npm run setup`: creates `.env.local` (or any target) from `.env.example`
      with a freshly generated `API_KEY`, and never overwrites an existing file
    - A variable set to blank (`SEND_GRID_API_KEY=`) is now treated as unset rather
      than as an invalid empty string - blank optional values were blocking startup
    - Silenced dotenv-flow's "no .env* files" warning: it fired twice on every boot,
      and is a normal state in production where variables are injected

7. #### Tooling
    - `tsconfig`: ES2022 target, source maps, incremental builds, and a strict set
      beyond `strict` - `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
      `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`,
      `allowUnreachableCode: false`, `isolatedModules`
    - Fixed every error those flags surfaced, and added explicit return types to all
      exported functions (`explicit-module-boundary-types` now enforces it)
    - ESLint: Node globals (was browser), correct global ignores, unused-vars enabled
    - Winston: JSON file output, size-based rotation, exception/rejection transports
    - Dockerfile: multi-stage, non-root, healthcheck, production-only dependencies
    - `docker-compose`: env_file, healthcheck, named volumes, Grafana moved to 3001
    - Standardised on npm: `package-lock.json` is now committed, CI and the Dockerfile
      use strict `npm ci`, and other package managers' lock files are gitignored
    - Added `engines` (node >= 18.18, npm >= 9)
    - Added GitHub Actions CI (lint, typecheck, build on Node 18/22 + Docker build)
    - Removed dead code: `response.codes.ts`, `sendgrid.schema.ts`, `muter.middleware.ts`
    - Removed unused devDependencies; moved build-only packages out of `dependencies`

## 1.5.0 - 2025-10-10

1. #### Updated build script
    - Changed `"build": "tsc --build && tsc-alias"` to `"build": "tsc && resolve-tspaths"`

2. #### Updated email sending logic
    - Switched from using template IDs to Handlebars local templates
    - Removed template IDs from environment files

3. #### Lint-staged optimization
    - Improved lint-staged commands for faster and more efficient pre-commit checks
    - Reduced unnecessary file scanning and formatting overhead

4. #### Updated translations
    - Updated `locales/en/translation.json`

5. #### Minor configuration updates
    - Tweaked project configs for better performance and maintainability
    - Updated some internal settings and environment defaults

## 1.4.0 - 2025-07-16

    > Added multer config
    > fix some minor bugs

## 1.3.0 - 2025-05-26

    > Updated import paths to use `@` alias for cleaner imports.

## 1.2.0 - 2025-04-09

1. #### Added metrics by Containerization
    > created `docker-compose` to run the project with Grafana and Prometheus for monitoring.

## 1.0.2 - 2025-03-17

1. #### Added metrics clnfiguration
    - Added `prom-client` to collect metrics
    - Added `/metrics` endpoint to expose metrics

2. #### Added `validateSchema` middleware
    - Added `validateSchema` middleware to validate request payload

3. #### Added `example metrics` route to test metrics

4. #### Fixed casing inconsist in `locales` folder

## 1.0.1 - 2025-03-15

1. #### Added Nodemailer to send emails

2. #### Added Postman documentation

    > [PostMan Documentation](https://documenter.getpostman.com/view/27265804/2sAYkBsM99)

3. #### Added examples API's
    - Send email
    - Slow Down
    - Api Key
    - Localization
    - File upload

## 1.0.0 - 2025-03-06

- Initial release
