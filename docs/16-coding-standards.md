# 16 · Coding Standards

## TypeScript

`strict: true` is the floor, not the ceiling. Every extra flag below has caught
a real bug:

| Flag                                    | Catches                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `noUncheckedIndexedAccess`              | `arr[i]` and `obj[key]` are `T \| undefined` — indexing can always miss           |
| `exactOptionalPropertyTypes`            | Assigning `undefined` to an optional property; "present but undefined" ≠ "absent" |
| `noImplicitReturns`                     | A code path that falls off the end of a value-returning function                  |
| `noUnusedLocals` / `noUnusedParameters` | Half-finished edits (`_`-prefixed params are exempt)                              |
| `allowUnreachableCode: false`           | Code after a `return`/`throw`/`process.exit`                                      |
| `noImplicitOverride`                    | A method that thinks it overrides but does not                                    |
| `noFallthroughCasesInSwitch`            | A missing `break`                                                                 |
| `isolatedModules`                       | Type-only exports that vanish at runtime — required by esbuild, which `tsx` uses  |

Two of these change how you write ordinary code:

```ts
// noUncheckedIndexedAccess: the lookup may miss, so say what happens when it does
const match = UPLOAD_ERRORS[err.code] ?? DEFAULT_UPLOAD_ERROR;

// exactOptionalPropertyTypes: assign only when there is a value
if (err instanceof Error && err.stack) unexpected.stack = err.stack;
```

### Explicit return types on exported functions

Enforced by `@typescript-eslint/explicit-module-boundary-types`:

```ts
export const getLocalIp = (): string | undefined => { … };
export const metrics = async (_req: Request, res: Response): Promise<void> => { … };
```

Inference is fine inside a module. Across a module boundary the return type is
the **contract** — writing it down means an accidental change breaks here,
where you made it, rather than rippling silently out to every caller. Function
expressions passed to an already-typed parameter (controllers wrapped in
`asyncCatch`) are exempt, since the type is already declared.

### `any` is a hole in the type system

```ts
const data: any = await fetchSomething();
data.user.naem.toUpperCase(); // compiles. crashes at runtime.
```

`any` disables checking for everything it touches, and it spreads. Use `unknown`
when a type is genuinely unknown — it forces you to narrow before use:

```ts
const data: unknown = await fetchSomething();
const parsed = userSchema.parse(data); // now it is typed, and verified
```

ESLint flags `any` as a warning here rather than an error, so an unavoidable
case does not block a commit — but each one should be justified, not habitual.

### Derive types, never duplicate them

```ts
export const sendEmailSchema = z.object({ body: z.object({ to: z.string().email() }) });
export type sendEmailType = z.infer<typeof sendEmailSchema>; // ✅ one source of truth
```

A hand-written `interface SendEmailBody` beside a schema is two declarations
that drift apart. Same idea with `typeof`, `keyof`, `ReturnType<>`:

```ts
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
```

### Prefer `type` unions over loose primitives

```ts
function setLevel(level: string); // ❌ 'inof' compiles
function setLevel(level: 'error' | 'warn' | 'info' | 'debug'); // ✅
```

### `as const` for lookup objects

```ts
export const STATUS_CODES = { NOT_FOUND: 404, … } as const;
```

Without it, `STATUS_CODES.NOT_FOUND` widens to `number` and the literal
information — the useful part — is lost.

---

## Naming

| Thing                      | Convention                    | Example                               |
| -------------------------- | ----------------------------- | ------------------------------------- |
| Files                      | lowercase, dots for category  | `rate-limiter.ts`, `example.route.ts` |
| Classes                    | PascalCase                    | `ApiError`                            |
| Functions / variables      | camelCase                     | `customSuccessResponse`               |
| Constants                  | SCREAMING_SNAKE_CASE          | `MAX_REQUESTS_PER_WINDOW`             |
| Booleans                   | `is`/`has`/`should` prefix    | `isOperational`, `isConfigured`       |
| Unused-but-required params | `_` prefix                    | `(_req, res, next)`                   |
| Zod schemas                | `<name>Schema` / `<name>Type` | `sendEmailSchema`                     |

Names should say **what** and **why**, not **how**:

```ts
const d = 900000; // ❌
const WINDOW_IN_MILI_SECONDS = 15 * 60 * 1000; // ✅ units, and the arithmetic left visible
```

Leaving `15 * 60 * 1000` unreduced is deliberate — it reads as "fifteen minutes".

---

## Imports

ESLint (`simple-import-sort`) enforces four groups, blank-line separated:

```ts
import crypto from 'crypto'; // 1. node builtins

import { Request } from 'express'; // 2. packages (express first)
import { z } from 'zod';

import { env } from '@/config/env'; // 3. internal, via the @/ alias
import { ApiError } from '@/error/ApiError';

import { helper } from './helper'; // 4. relative
```

Always use `@/` for anything inside `src/` — it survives file moves and stays
greppable. Use `import type` for type-only imports so they are erased from the
output.

---

## Comments

Comment the **why**, not the what. The code already says what it does.

```ts
// ❌ Compare the API key
if (!safeCompare(apiKey, env.app.API_KEY)) …

// ✅
// Constant-time: `!==` returns early on the first differing byte, leaking how
// many leading characters were correct.
if (!safeCompare(apiKey, env.app.API_KEY)) …
```

Worth commenting: non-obvious decisions, workarounds (with a link), security
reasoning, gotchas that will bite the next reader. Not worth commenting:
restating a line, commented-out code (git remembers), changelogs in the file
header.

Use JSDoc on exported functions — it shows up on hover:

```ts
/**
 * Creates a multer instance backed by memory storage.
 *
 * @example
 * const upload = createUploadMiddleware({ allowedTypes: ['image/png'] });
 */
```

---

## Functions

- **One responsibility.** If you need "and" to describe it, split it.
- **Return early** instead of nesting:

```ts
if (!file) throw new ApiError(…);
if (!isAllowed(file)) throw new ApiError(…);
return process(file);
```

- **Keep them small enough to see at once** — roughly a screen.
- **Parameter objects past three arguments**, so call sites stay readable:

```ts
sendEmail(req, { to, subject, templatePath, dynamicData }); // ✅
```

`ApiError`'s five positional parameters are the exception, and a deliberate one:
they are always passed in the same order, and every call site looks identical.

---

## Error handling

- Throw `ApiError` for anything a client should see
- Never swallow: `catch {}` with no logging is always a bug
- Never leak internals: log the detail, return the generic message
- Wrap every async handler in `asyncCatch`

See [07-error-handling.md](07-error-handling.md).

---

## Async

```ts
const [a, b] = await Promise.all([getA(), getB()]); // independent → parallel
```

- No `*Sync` calls on the request path — they block the event loop
- Always `await` or `.catch()` a promise; a floating promise is an invisible
  failure
- No `async` on a function with no `await` in it

---

## Tooling

| Tool                | Config                     | Enforces                                                        |
| ------------------- | -------------------------- | --------------------------------------------------------------- |
| ESLint              | `eslint.config.mjs`        | Correctness, import order, `no-console`, security rules         |
| Prettier            | `.prettierrc`              | Formatting — 4 spaces, single quotes, 150 cols, trailing commas |
| husky + lint-staged | `.husky/pre-commit`        | Runs both on staged files before every commit                   |
| GitHub Actions      | `.github/workflows/ci.yml` | Lint, typecheck, build on Node 18 and 22                        |

```bash
npm run lint        # check
npm run fix         # lint --fix + prettier --write
npm run typecheck   # types only, fast
```

**Never argue about formatting.** Prettier owns it; `eslint-config-prettier`
turns off every ESLint rule that would disagree.

### Notable ESLint rules

```js
'no-console': 'error',            // use the logger — see docs/08
'no-duplicate-imports': 'error',
'require-atomic-updates': 'error', // catches a real class of async race
eqeqeq: ['error', 'smart'],
'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
```

`eslint-plugin-security` is enabled and catches some unsafe patterns statically
(unsafe regex, non-literal `fs` paths, `eval`-like calls).

---

## Git

```
feat: add user authentication
fix: constant-time API key comparison
docs: explain trust proxy
refactor: extract upload middleware
chore: bump dependencies
```

[Conventional Commits](https://www.conventionalcommits.org/): the prefix makes
history scannable and changelogs generatable.

- Branch per change: `feature/x`, `fix/y`
- One logical change per commit — a rename plus a behaviour change in one commit
  cannot be reviewed
- Never commit: `.env*`, `node_modules`, `build/`, `logs/`, `.DS_Store`

---

## Code review

Ask, in order:

1. **Correctness** — does it do what it claims? What about the empty case?
2. **Security** — is input validated? Anything leaked in an error or log?
3. **Errors** — is every failure handled and logged exactly once?
4. **Types** — any `any`? Any type duplicated instead of derived?
5. **Performance** — N+1? Blocking call? Unbounded input?
6. **Consistency** — does it look like the rest of the codebase?
7. **Docs** — does a new env var / endpoint / convention need a line here?

---

## Checklist before opening a PR

- [ ] `npm run lint` and `npm run typecheck` pass
- [ ] No `console.log`, no commented-out code, no `any` without a reason
- [ ] New input is validated with a schema
- [ ] New user-facing strings are in `locales/` (all languages)
- [ ] New env vars are in the schema, `config/env.ts` **and** `.env.example`
- [ ] Errors are `ApiError` with a status, a code, and all three messages
- [ ] Async handlers are wrapped in `asyncCatch`
- [ ] Docs updated if behaviour or conventions changed
