# 18 · Troubleshooting

## Startup

### `Invalid environment configuration`

```
error: Invalid environment configuration:
  - app.CLIENT_URL: CLIENT_URL must contain valid URLs
  - app.API_KEY: API_KEY must be at least 16 characters
```

Working as designed — the server refuses to start misconfigured. Every problem
is listed at once.

- No `.env.local`? Run `npm run setup` — it creates one with a generated `API_KEY`
- A variable set to nothing (`API_KEY=`) counts as unset, not as an empty value
- `CLIENT_URL` needs a scheme: `http://localhost:3000`, not `localhost:3000`

### `Port 8080 is already in use`

```bash
lsof -i :8080          # find it
kill -9 <PID>          # or set PORT=8081 in .env.local
```

### `Cannot find module '@/config/env'`

The `@/` alias was not rewritten in the build output.

```bash
npm run build          # must be: tsc && resolve-tspaths
```

Running `tsc` alone leaves `require("@/config/env")` in `build/`, which Node
cannot resolve.

### Server starts, then exits immediately

Check `logs/exceptions.log` and `logs/rejections.log`. Something threw during
startup — commonly a missing dependency the app now awaits before listening.

---

## Requests

### Every route returns 404

The router is not mounted. Check `src/router/index.ts`:

```ts
router.use('/products', productRouter);
```

And remember the full path is every mount point concatenated:
`/api/v0` + `/products` + `/`.

### `req.body` is `undefined`

Three usual causes:

1. Missing `Content-Type: application/json` on the request
2. A `GET` request — bodies are not parsed for GET
3. Custom middleware registered **before** `express.json()` in `src/app.ts`

### `req.query.something` is a string, not a number

Query strings are always strings. Use `z.coerce` in the schema
([06-validation.md](06-validation.md)):

```ts
query: z.object({ page: z.coerce.number().int().positive().default(1) });
```

### The request hangs forever, nothing in the logs

A missing `asyncCatch`:

```ts
router.get('/x', async (req, res) => { … });                 // ❌ hangs on rejection
router.get('/x', asyncCatch(async (req, res) => { … }));      // ✅
```

### `ERR_HTTP_HEADERS_SENT`

Something responded twice.

```ts
if (!user) res.status(404).json(…);   // ❌ no return — execution continues
res.json(user);
```

Use `return` after responding, or throw an `ApiError` instead of responding by
hand.

### CORS error in the browser

```
Access to fetch at 'http://localhost:8080/…' has been blocked by CORS policy
```

- Is the frontend's exact origin in `CLIENT_URL`? Scheme, host **and** port must
  match — `http://localhost:3000` ≠ `http://127.0.0.1:3000`
- Multiple origins are comma-separated
- Restart after changing `.env.local`
- CORS is a browser mechanism; if `curl` works and the browser does not, it is
  CORS

### 429 Too Many Requests while developing

```ini
DISABLE_RATE_LIMITER=true
```

Development only. Never in production.

### 401 on a route with `verifyApiKey`

- Header name is `x-api-key`
- The value must match `API_KEY` exactly — watch for trailing whitespace in
  `.env.local`
- `DISABLE_VALIDATE_API_KEY_ON_DEVELOPMENT` only works when
  `NODE_ENV=development` (deliberately)

---

## Behaviour

### Translations come back as raw keys

`route_not_found_message` instead of the sentence means the lookup failed.

- Missing `{ ns: 'error' }` — the key is in `error.json`, not `translation.json`
- The key does not exist in that language's file
- Started from the wrong directory: `loadPath: './locales/…'` is resolved from
  the working directory

### Wrong language returned

Precedence is `?lng=ne` → `Accept-Language` → `en`. A query parameter always
wins. Test explicitly:

```bash
curl "http://localhost:8080/api/v0/example/localization?lng=ne"
```

### Emails fail with 503 · E009

`SEND_GRID_API_KEY` / `SEND_GRID_FROM_EMAIL` are unset. That is the designed
response for an unconfigured optional integration —
[13-email.md](13-email.md).

### Email template not found in production

Templates live in `templates/email/` (outside `src/`) because `tsc` only emits
`.js`. Make sure:

- The directory ships with your deployment (the Dockerfile copies it)
- The process starts from the repository root

### Uploads rejected with 415

The MIME type is not in the route's allow-list. Check
`createUploadMiddleware({ allowedTypes: […] })` — and note that `curl` sends
`application/octet-stream` unless you specify the type:

```bash
curl -F "example_file=@photo.png;type=image/png" …
```

### Uploads rejected with 413

The file exceeds `maxFileSize` (2 MB on the example route). Raise the limit
deliberately, or use direct-to-cloud uploads
([14-file-uploads.md](14-file-uploads.md)).

---

## Production

### Rate limiting seems broken / every client shares a limit

`TRUST_PROXY` is wrong. Behind a load balancer `req.ip` is the balancer's
address unless you set it. Check what the server sees:

```bash
curl https://api.example.com/api/v0/example/api-key   # `ip` appears in error responses
```

Set the **number of proxies you actually have** — not `true`. See
[09-security.md](09-security.md#trust-proxy).

### Rate limits are ~N× higher than configured

The in-memory store is per process. With PM2 cluster mode or N containers, each
keeps its own counter. Use a shared Redis store.

### Sporadic 502s behind a load balancer

`keepAliveTimeout` is shorter than the balancer's idle timeout, so Node closes
connections the balancer still considers open.

```ts
server.keepAliveTimeout = 65_000; // must exceed the balancer's (ALB: 60s)
server.headersTimeout = 66_000;
```

### Container restarts in a loop

```bash
docker compose logs server
```

Usually a failed env validation (missing `.env.production`) or a failing
health check. Note the app **exits deliberately** on invalid configuration.

### Memory grows until the process is killed

1. Confirm with `nodejs_heap_size_used_bytes` — a steady climb, not a sawtooth
2. Take two heap snapshots minutes apart under load (`node --inspect`) and
   compare retained objects
3. Usual suspects: an unbounded in-process cache or `Map`, listeners added per
   request and never removed, large buffers held by closures, memory-storage
   uploads under concurrency

`max_memory_restart: '512M'` in PM2 is a seatbelt, not a fix.

### Latency spiked, CPU is pinned

Something is blocking the event loop. Check
`nodejs_eventloop_lag_seconds`; sustained values above ~100 ms mean synchronous
work on the request path. See [10-performance.md](10-performance.md).

### Logs filled the disk

Rotation is configured (10 MB × 5 files per stream), but `logs/` still grows if
something logs per request at `debug`. In containers, log to stdout and let the
platform handle retention.

---

## Prometheus / Grafana

### Prometheus shows the target as DOWN

- Is the app healthy? `curl http://localhost:8080/metrics`
- In Compose, the target is the **service name**: `server:8080`, not `localhost`
- With `PROTECT_METRICS=true`, the scraper must send `x-api-key` — see the
  commented `http_headers` block in `prometheus.yml`

### Grafana has no data

Data source URL must be `http://prometheus:9090` (the compose service name), not
`localhost`.

### One endpoint appears as two series

Fixed in `src/metrics/prometheus.ts` — route patterns are captured when the
route matches, not after the error stack unwinds. If you see it again, you are
probably labelling with `req.path`, which is also a cardinality risk
([11-observability.md](11-observability.md#cardinality-the-one-way-to-break-prometheus)).

---

## Tooling

### ESLint reports no errors but also checks nothing

Flat config: a global ignore must be its **own** entry.

```js
export default [
    { ignores: ['build/**'] }, // ✅ global
    { files: ['**/*.ts'], ignores: ['build/**'] }, // ❌ only filters this block
];
```

### Pre-commit hook does not run

```bash
npm run prepare     # reinstall husky hooks
```

Hooks live in `.git/hooks`, which is not cloned.

If that command appears to do nothing, it skipped deliberately. `prepare` runs
on every install — including inside a Docker image, where husky is not present
and there is no repository — so it is a no-op when any of these hold:

| Condition                    | Why it skips                        |
| ---------------------------- | ----------------------------------- |
| `HUSKY=0`                    | The documented opt-out              |
| `CI=true`                    | Nothing commits from a CI runner    |
| `node_modules/husky` missing | A production install (`--omit=dev`) |
| No `.git` directory          | Nothing to attach hooks to          |

Check with `HUSKY= CI= npm run prepare` if you expected hooks and got none.

### Prettier and ESLint disagree

They should not — `eslint-config-prettier` is last in the config and disables
every conflicting rule. If you added a plugin after it, move it before.

---

## Still stuck

1. `logs/error.log` — with the `errorId` from the client response
2. `logs/exceptions.log`, `logs/rejections.log` — crashes
3. Search by `requestId` to see everything about one request
4. `NODE_ENV=development` locally to get stack traces in the response
5. [Open an issue](https://github.com/suman7802/ExpressTemplate/issues/new/choose)
   with the error id, the endpoint, and what you expected
