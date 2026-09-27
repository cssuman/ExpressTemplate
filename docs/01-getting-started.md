# 01 · Getting Started

## Prerequisites

| Tool    | Version  | Why                                            |
| ------- | -------- | ---------------------------------------------- |
| Node.js | ≥ 18.18  | The code targets ES2022; 22 LTS is recommended |
| npm     | ≥ 9      | Ships with Node                                |
| Docker  | optional | Only needed for the Prometheus + Grafana stack |

You do **not** need TypeScript installed globally — it is a dependency of this
project, and `npx`/`npm run` use the local copy. A globally installed compiler
on a different version is a common source of "works on my machine".

## Install

```bash
git clone git@github.com:suman7802/ExpressTemplate.git
cd ExpressTemplate
npm install
```

## Configure

```bash
npm run setup
```

That copies `.env.example` to `.env.local` and generates a real `API_KEY` for
you (32 random bytes). It never overwrites an existing file, so it is safe to
re-run.

The three values that matter:

```ini
NODE_ENV=development
CLIENT_URL=http://localhost:3000        # your frontend's origin, for CORS
API_KEY=<generated for you>
```

Everything else has a working default. The server **validates this file at boot
and refuses to start if anything is missing or malformed** — see
[04-configuration.md](04-configuration.md) for why that is a feature.

> 💡 `.env.local` is gitignored. Never commit real credentials; `.env.example`
> is the only env file that belongs in version control.

## Run

```bash
npm run dev
```

```
Server is running on development mode
- Local   http://localhost:8080
- Network http://192.168.1.64:8080
```

`npm run dev` uses [`tsx`](https://tsx.is) to run TypeScript directly and
restart on save — no build step, no `ts-node` configuration.

### Verify it works

```bash
curl http://localhost:8080/
curl http://localhost:8080/api/v0/health
```

```json
{
    "success": true,
    "status": 200,
    "message": "Welcome to the API",
    "data": { "appName": "express-template", "appVersion": "1.5.0", "appEnverionment": "development" }
}
```

## The scripts

| Command                             | What it does                                      | When you use it                               |
| ----------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| `npm run setup`                     | Creates `.env.local` with a generated `API_KEY`   | First run, and for new clones                 |
| `npm run dev`                       | Watch mode with hot restart                       | Daily development                             |
| `npm run dev:debug`                 | Same, with the Node inspector on `:9229`          | Attaching a debugger or taking heap snapshots |
| `npm run build`                     | `tsc` → `build/`, then rewrite `@/` aliases       | Before deploying                              |
| `npm run rebuild`                   | `clean` then `build`                              | After deleting or renaming source files       |
| `npm start`                         | Runs the compiled build in production mode        | On a server                                   |
| `npm run clean`                     | Deletes `build/` (and its incremental cache)      | Stale output, or before a fresh build         |
| `npm run typecheck`                 | Types only, no output                             | Fast feedback                                 |
| `npm run lint` / `lint:fix`         | ESLint                                            | Before committing                             |
| `npm run format` / `format:check`   | Prettier                                          | Writing / verifying formatting                |
| `npm run fix`                       | `lint:fix` + `format`                             | Cleaning up a messy diff                      |
| **`npm run check`**                 | **typecheck + lint + format:check**               | **Before every PR — what CI runs**            |
| `npm run pm2:dev` / `pm2:prod`      | Build, then start under PM2 cluster mode          | Bare-metal / VM deploys                       |
| `npm run pm2:stop` / `pm2:logs`     | Stop the cluster / tail its logs                  | Operating a PM2 deploy                        |
| `npm run docker:up` / `docker:down` | Start / stop the API + Prometheus + Grafana stack | Local monitoring                              |
| `npm run docker:logs`               | Follow the API container's logs                   | Debugging the stack                           |

`npm run check` is the one to remember: it is exactly what CI enforces, so a
green run locally means a green pipeline.

### Why `build` is two commands

```json
"build": "tsc && resolve-tspaths"
```

TypeScript understands the `@/config/env` alias, but it does **not** rewrite
those paths when it emits JavaScript — the compiled output would still say
`require("@/config/env")`, which Node cannot resolve. `resolve-tspaths`
post-processes `build/` and turns each alias into a real relative path.

⚠️ Forgetting the second half is a classic "builds fine, crashes on start" bug.

## Explore the API

With the server running, open **<http://localhost:8080/docs>**.

That is an interactive reference with a working "Try it" console — every
endpoint, its request and response shapes, and the error codes it can return.
It is generated from the same Zod schemas that validate requests, so it cannot
drift from the implementation. The raw specification is at
`/docs/openapi.json`; import it into Postman, Insomnia or a client generator.

To send authenticated requests from that page, paste your `API_KEY` into the
auth panel.

> The reference is on by default in development and **off in production** — it
> advertises every route you have. Set `ENABLE_API_DOCS=true` to publish it
> deliberately. Details and removal steps: [`src/openapi/README.md`](../src/openapi/README.md)

## Explore the example endpoints with curl

Each one exists to demonstrate a specific piece of the template:

```bash
# Uniform success envelope
curl http://localhost:8080/api/v0/example/localization

# The same message in Nepali - i18n via query string
curl "http://localhost:8080/api/v0/example/localization?lng=ne"

# API key auth (401 without the header)
curl -H "x-api-key: $API_KEY" http://localhost:8080/api/v0/example/api-key

# Progressive throttling - watch requests 4+ get slower
for i in $(seq 1 6); do curl -s -o /dev/null -w "%{time_total}s\n" \
  http://localhost:8080/api/v0/example/slow-down; done

# Validation failure - one consistent error shape
curl -X POST -H 'Content-Type: application/json' -d '{"to":"not-an-email"}' \
  http://localhost:8080/api/v0/example/send-email

# Upload limits: type and size are enforced
curl -F "example_file=@./public/favicon.ico" \
  http://localhost:8080/api/v0/example/file-upload
```

There is also a
[Postman collection](https://documenter.getpostman.com/view/27265804/2sAYkBsM99).

## Run the monitoring stack

```bash
npm run setup -- .env.production   # generates an API_KEY; review the rest
npm run docker:up
```

| Service    | URL                   | Credentials   |
| ---------- | --------------------- | ------------- |
| API        | http://localhost:8080 | —             |
| Prometheus | http://localhost:9090 | —             |
| Grafana    | http://localhost:3001 | admin / admin |

See [11-observability.md](11-observability.md) for what to do with them.

## Next

- Understand the request pipeline → [02-architecture.md](02-architecture.md)
- Build your first endpoint → [17-extending.md](17-extending.md)
- Something broken? → [18-troubleshooting.md](18-troubleshooting.md)
