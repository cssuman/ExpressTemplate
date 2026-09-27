# 03 · Project Structure

## The map

```
ExpressTemplate/
├── src/                      Application code (the only thing tsc compiles)
│   ├── server.ts             Entry point: boot, listen, graceful shutdown
│   ├── app.ts                The middleware pipeline — read this first
│   │
│   ├── config/env.ts         The ONLY module that reads process.env
│   ├── schema/               Zod contracts: env + per-endpoint input
│   ├── constant/             Status codes, error codes
│   │
│   ├── router/               Path → middleware → controller
│   ├── controller/           One function per endpoint
│   ├── middleware/           Cross-cutting request concerns
│   │
│   ├── error/                ApiError, response format, asyncCatch
│   ├── logger/               Winston (app logs) + Morgan (request logs)
│   ├── metrics/              Prometheus instrumentation
│   │
│   ├── email/sendgrid.ts     SendGrid + Handlebars integration
│   ├── utils/                Small, dependency-free helpers
│   └── types/                Global type declarations
│
├── locales/{en,ne}/          Translations: translation · auth · error
├── templates/email/          Handlebars email templates
├── public/                   Statically served files
├── docs/                     You are here
│
├── .env.example              Every variable, documented
├── tsconfig.json             Strict mode, ES2022, @/ alias
├── eslint.config.mjs         Flat config
├── dockerfile                Multi-stage, non-root
├── docker-compose.yml        API + Prometheus + Grafana
├── ecosystem.config.js       PM2 cluster configuration
└── CLAUDE.md                 Repo context for AI assistants
```

## Why `locales/` and `templates/` live outside `src/`

`tsc` compiles `src/` into `build/` and **only emits `.js` files**. A `.json`
translation or `.html` template sitting next to your TypeScript would silently
disappear from the production build — the classic "works in dev, 500s in prod"
failure.

Both are therefore resolved from the **working directory** at runtime:

```ts
loadPath: './locales/{{lng}}/{{ns}}.json'; // src/middleware/i18Next.ts
const TEMPLATE_DIR = path.resolve(process.cwd(), 'templates/email'); // src/email/sendgrid.ts
```

⚠️ This means the server must be started **from the repository root**. `cd build
&& node server.js` will not find them.

## File-by-file

### Entry points

| File            | Responsibility                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server.ts` | Awaits startup dependencies, calls `listen`, wires SIGTERM/SIGINT, `unhandledRejection`, `uncaughtException`. Add DB connections here |
| `src/app.ts`    | Builds the Express app. Import order in this file _is_ execution order                                                                |

Keeping them separate is what makes the app testable: a test can `import app`
and drive it with supertest without ever binding a port.

### Configuration

| File                       | Responsibility                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `src/config/env.ts`        | Loads `.env*`, validates against the schema, exits on failure, exports a typed `env` |
| `src/schema/env.schema.ts` | The contract: which variables exist, their types, defaults, and coercions            |

> **Rule:** no other file may read `process.env`. The single exception is
> `src/logger/winston.logger.ts`, which would otherwise be a circular import —
> see the comment at the top of that file.

### Request handling

| File                          | Responsibility                                              |
| ----------------------------- | ----------------------------------------------------------- |
| `src/router/index.ts`         | Mounts feature routers under `/api/v0`                      |
| `src/router/root.route.ts`    | `/` — name, version, environment                            |
| `src/router/health.route.ts`  | `/api/v0/health` — liveness for load balancers              |
| `src/router/example.route.ts` | Worked examples of every feature                            |
| `src/controller/*.ts`         | One exported function per endpoint, wrapped in `asyncCatch` |

### Middleware

| File                   | Applied                | Purpose                                             |
| ---------------------- | ---------------------- | --------------------------------------------------- |
| `apiErrorHandler.ts`   | globally, last         | Normalises any error into the API error envelope    |
| `route.not.found.ts`   | globally, after routes | Turns unmatched requests into a 404 `ApiError`      |
| `i18Next.ts`           | globally               | Language detection, exports `i18nReady` for startup |
| `rate-limiter.ts`      | globally               | 100 requests / 15 min per IP                        |
| `schema.validation.ts` | per route              | Zod validation + coercion                           |
| `verifyApiKey.ts`      | per route              | Constant-time `x-api-key` check                     |
| `slow-down.ts`         | per route              | Progressive delay instead of rejection              |
| `multer.ts`            | per route              | Upload handling with type/size/count limits         |

### Cross-cutting

| File                             | Responsibility                                     |
| -------------------------------- | -------------------------------------------------- |
| `error/ApiError.ts`              | The only error class this app throws intentionally |
| `error/apiErrorFormat.ts`        | Builds the error response body                     |
| `error/asyncCatch.ts`            | Forwards async rejections to Express               |
| `logger/winston.logger.ts`       | Application logs: levels, JSON files, rotation     |
| `logger/morgan.logger.ts`        | HTTP access logs, piped into Winston               |
| `metrics/prometheus.ts`          | Request duration/count histograms + `/metrics`     |
| `constant/status.codes.ts`       | HTTP statuses as named constants                   |
| `constant/error.codes.ts`        | Stable `E0xx` codes for clients                    |
| `utils/customSuccessResponse.ts` | The success envelope                               |
| `utils/quicker.ts`               | System/application health snapshot                 |
| `utils/getLocalIp.ts`            | LAN address for the startup banner                 |

## The `@/` path alias

```ts
import { env } from '@/config/env'; // ✅
import { env } from '../../config/env'; // ❌
```

`@/` maps to `src/` (`tsconfig.json` → `paths`). It survives file moves, keeps
imports greppable, and makes the import block readable. ESLint enforces the
grouping order (node builtins → packages → `@/` → relative) via
`simple-import-sort`.

The build compensates for TypeScript not rewriting aliases — see
[01-getting-started.md](01-getting-started.md#why-build-is-two-commands).

## Naming conventions

| Thing                 | Convention                                              | Example                               |
| --------------------- | ------------------------------------------------------- | ------------------------------------- |
| Files                 | lowercase, dots for category                            | `rate-limiter.ts`, `example.route.ts` |
| Classes               | PascalCase                                              | `ApiError`                            |
| Functions / variables | camelCase                                               | `customSuccessResponse`               |
| Constants             | SCREAMING_SNAKE_CASE                                    | `MAX_REQUESTS_PER_WINDOW`             |
| Zod schemas           | `<name>Schema` + inferred `<name>Type`                  | `sendEmailSchema`                     |
| Translation keys      | snake_case, `_message`/`_details`/`_suggestion` triples | `file_too_large_message`              |

💡 File naming is not perfectly uniform across the repo (`route.not.found.ts`
vs `rate-limiter.ts`). If you unify it, do it in one commit — a half-renamed
tree is worse than a consistent-but-imperfect one.

## Where new code goes

| You are adding…                        | Put it in…                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| An endpoint                            | `router/<feature>.route.ts` + `controller/<feature>.ts` + `schema/<feature>.schema.ts` |
| Logic used by more than one controller | `service/<feature>.service.ts` (create the folder)                                     |
| Something every request needs          | `middleware/` + one line in `src/app.ts`                                               |
| A third-party integration              | its own folder, like `email/`                                                          |
| A pure helper                          | `utils/` — no imports from `controller/` or `router/`                                  |
| A new config value                     | `schema/env.schema.ts` → `config/env.ts` → `.env.example`                              |

Full worked example: [17-extending.md](17-extending.md).
