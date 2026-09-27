# CLAUDE.md

Context for AI coding assistants working in this repository. Human documentation
lives in [`docs/`](docs/README.md) — this file is the condensed map.

---

## What this is

A production-shaped **Express 4 + TypeScript** template for JSON APIs. Not a
framework: no DI container, no code generation, no magic. Every piece is plain
Express you can read and change.

**Ships with:** request correlation, structured logging, Prometheus metrics,
validated configuration, i18n (en/ne), rate limiting + throttling, API-key auth,
zod validation, a uniform error contract, an interactive API reference at `/docs`
generated from those schemas, SendGrid email with local Handlebars templates,
hardened file uploads, Docker (multi-stage, non-root), PM2, CI.

**Deliberately absent:** user authentication/authorization, any database, a test
suite, background jobs. See [`docs/17-extending.md`](docs/17-extending.md) for
where each belongs.

---

## Commands

**Package manager: npm.** `package-lock.json` is committed; CI and Docker run
`npm ci`. Never add a dependency with another package manager — the lockfile
would drift and `npm ci` fails on drift.

```bash
npm run setup       # first run: .env.local with a generated API_KEY
npm run dev         # tsx watch, hot restart
npm run build       # tsc && resolve-tspaths   ← BOTH halves are required
npm run rebuild     # clean + build, after deleting or renaming source files
npm start           # production, from the repo root
npm run check       # typecheck + lint + format:check — what CI runs
npm run fix         # eslint --fix && prettier --write
npm run docker:up   # API + Prometheus + Grafana
```

Before declaring work done: **`npm run check && npm run build`**.

---

## Architecture in one paragraph

`src/app.ts` is an **ordered middleware pipeline**, and its order is the
architecture. A request passes through: identity (`rid`, `clientIp`, useragent) →
i18n (`req.t`) → observability (morgan, prometheus) → security (helmet, cors,
rate limit) → parsing (json 16kb, urlencoded, cookies) → compression/static →
routes (`/metrics`, `/`, `/api/v0`) → `routeNotFoundHandler` → `apiErrorHandler`.
`src/server.ts` awaits startup dependencies, listens, and handles graceful
shutdown. Full detail: [`docs/02-architecture.md`](docs/02-architecture.md).

---

## Invariants — do not break these

1. **`src/config/env.ts` is the only module that reads `process.env`**, and
   every variable goes through its `read()` helper so a blank value counts as
   unset rather than as an invalid empty string. The single exception is
   `src/logger/winston.logger.ts` (circular import; documented in the file).
   Everything else imports the typed `env`.
2. **Every async handler and async middleware is wrapped in `asyncCatch`.**
   Without it a rejection hangs the request silently.
3. **Every failure is an `ApiError`** with a status, a stable `E0xx` code, and
   all three translated strings (`message`, `details`, `suggestion`).
4. **Every success goes through `customSuccessResponse`.** Never `res.json()`
   directly in a controller.
5. **No user-facing string is hard-coded.** Use `req.t(key, { ns })`, and add the
   key to **every** locale file.
6. **Observability middleware stays before the security middleware** in
   `app.ts`, so rejected traffic still appears in logs and metrics.
7. **`apiErrorHandler` keeps all four parameters** — Express identifies error
   handlers by arity — **and stays registered last**.
8. **`locales/` and `templates/` live outside `src/`** and resolve from
   `process.cwd()`; `tsc` only emits `.js`, so assets inside `src/` vanish from
   the build.
9. **The API reference is generated, never hand-written.** `src/openapi/` reads
   the schemas in `src/schema/`; adding an endpoint means one `registerEndpoint`
   block, not a second copy of the contract. The whole feature is removable —
   see `src/openapi/README.md`.
10. **Metric labels stay bounded.** Route patterns, never raw paths; never user
    ids, emails or request ids.
11. **Any "disable security" flag is gated on `NODE_ENV === 'development'`.**

---

## Where code goes

| Adding                           | Files                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Endpoint                         | `schema/<f>.schema.ts` → `service/<f>.service.ts` → `controller/<f>.ts` → `router/<f>.route.ts` → mount in `router/index.ts` |
| Cross-cutting behaviour          | `middleware/` + one line in `src/app.ts` (mind the order)                                                                    |
| Third-party integration          | Its own folder, modelled on `email/`                                                                                         |
| An endpoint in the API reference | One `registerEndpoint({...})` block in `src/openapi/document.ts`                                                             |
| Pure helper                      | `utils/` — must not import from `controller/` or `router/`                                                                   |
| Env variable                     | `schema/env.schema.ts` → `config/env.ts` → `.env.example` (all three)                                                        |
| Error type                       | `constant/error.codes.ts` + `constant/status.codes.ts` + locale triples                                                      |

`service/` does not exist yet — create it with the first real feature.
Dependencies point downward: controllers may call services; services never
import controllers.

---

## Patterns to copy

```ts
// Controller
export const createThing = asyncCatch(async (req: Request<{}, {}, createThingType['body'], {}>, res: Response) => {
    const thing = await thingService.create(req.body); // input is already validated
    customSuccessResponse(res, 201, req.t('thing_created'), thing);
});

// Failure
throw new ApiError(
    STATUS_CODES.NOT_FOUND,
    ERROR_CODES.NOT_FOUND,
    req.t('thing_not_found_message', { ns: 'error' }),
    req.t('thing_not_found_details', { ns: 'error' }),
    req.t('thing_not_found_suggestion', { ns: 'error' }),
);

// Route: cheapest rejection first
router.post('/', verifyApiKey, validateSchema(createThingSchema), createThing);

// Schema is the single source of truth for types
export const createThingSchema = z.object({ body: z.object({ name: z.string().min(1) }) });
export type createThingType = z.infer<typeof createThingSchema>;
```

---

## Conventions

- **Imports**: `@/` alias for everything in `src/`; groups ordered node builtins
  → packages → `@/` → relative (enforced by `simple-import-sort`).
- **Files**: lowercase with dots (`rate-limiter.ts`, `example.route.ts`).
- **Constants**: `SCREAMING_SNAKE_CASE`, units in the name
  (`WINDOW_IN_MILI_SECONDS`), arithmetic left unreduced (`15 * 60 * 1000`).
- **Translation keys**: `snake_case`; errors come as
  `_message` / `_details` / `_suggestion` triples.
- **Types**: derive with `z.infer` / `typeof` / `keyof`; never hand-write a type
  a schema already describes. `unknown`, not `any`. **Exported functions declare
  their return type** (enforced by `explicit-module-boundary-types`).
- **tsconfig is strict beyond `strict`**: `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitReturns`, `noUnusedLocals/Parameters`,
  `allowUnreachableCode: false`, `isolatedModules`. So: guard every index
  lookup, and assign an optional property only when there is a value to assign.
- **Comments**: explain _why_, not _what_. The existing code comments are the
  house style — match their density and tone.
- **Formatting**: Prettier owns it (4 spaces, single quotes, 150 cols). Never
  reformat unrelated lines.
- **`console.log` is an ESLint error.** Use the logger.

---

## Traps specific to this codebase

- `npm run build` is `tsc && resolve-tspaths`. Running `tsc` alone produces a
  build that crashes on `require("@/…")`.
- The server must start from the repository root (`locales/`, `templates/`,
  `public/` are cwd-relative).
- Zod **strips** undeclared keys, so in `validateSchema` only the parts the
  schema declared may be copied back — assigning `parsed.headers` blindly sets
  `req.headers = undefined`.
- Express 4 does not catch async throws — hence `asyncCatch` everywhere.
- The rate-limit store is in-process: with PM2 cluster mode or multiple
  containers the effective limit is N×. Use Redis before scaling.
- `TRUST_PROXY=true` lets clients spoof `X-Forwarded-For` and bypass rate
  limiting. Set the exact number of proxy hops instead.
- `req.baseUrl` is reset by the time `res.on('finish')` fires on an error
  response — `metrics/prometheus.ts` captures the route pattern at match time
  for exactly this reason. Do not "simplify" it back.
- i18n interpolation has `escapeValue: false` on purpose (JSON API, not HTML).

---

## Before finishing a change

- [ ] `npm run typecheck && npm run lint` pass
- [ ] New input validated with a zod schema
- [ ] New strings added to **all** locale files (`en` and `ne`)
- [ ] New env vars in the schema, `config/env.ts` **and** `.env.example`
- [ ] Async handlers wrapped in `asyncCatch`
- [ ] Errors are `ApiError`, logged exactly once (by the handler), with nothing
      internal leaked to the client
- [ ] Relevant `docs/` page updated when behaviour or conventions change
- [ ] `Changes.md` updated for anything user-visible

---

## Documentation index

| Topic                            | File                                                                     |
| -------------------------------- | ------------------------------------------------------------------------ |
| Setup and scripts                | [docs/01-getting-started.md](docs/01-getting-started.md)                 |
| Pipeline, layers, contracts      | [docs/02-architecture.md](docs/02-architecture.md)                       |
| Every file explained             | [docs/03-project-structure.md](docs/03-project-structure.md)             |
| Env vars and validation          | [docs/04-configuration.md](docs/04-configuration.md)                     |
| Routes and controllers           | [docs/05-routing-and-controllers.md](docs/05-routing-and-controllers.md) |
| Zod validation                   | [docs/06-validation.md](docs/06-validation.md)                           |
| Error contract                   | [docs/07-error-handling.md](docs/07-error-handling.md)                   |
| Logging                          | [docs/08-logging.md](docs/08-logging.md)                                 |
| Security                         | [docs/09-security.md](docs/09-security.md)                               |
| Performance                      | [docs/10-performance.md](docs/10-performance.md)                         |
| Metrics and health               | [docs/11-observability.md](docs/11-observability.md)                     |
| i18n                             | [docs/12-internationalization.md](docs/12-internationalization.md)       |
| Email                            | [docs/13-email.md](docs/13-email.md)                                     |
| Uploads                          | [docs/14-file-uploads.md](docs/14-file-uploads.md)                       |
| Docker, PM2, deploys             | [docs/15-deployment.md](docs/15-deployment.md)                           |
| Style guide                      | [docs/16-coding-standards.md](docs/16-coding-standards.md)               |
| Adding features, DB, auth, tests | [docs/17-extending.md](docs/17-extending.md)                             |
| Common problems                  | [docs/18-troubleshooting.md](docs/18-troubleshooting.md)                 |
