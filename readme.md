# Express Template

A production-shaped Express + TypeScript starting point: request correlation,
structured logging, validated configuration, i18n, rate limiting, Prometheus
metrics, a uniform error contract, Docker and PM2 — wired together and working.

> 📚 **[Full documentation → `docs/`](docs/README.md)** — architecture, security,
> performance, deployment and a guide to extending the template.
> Using an AI assistant? Point it at [`CLAUDE.md`](CLAUDE.md).

## Getting started

**Prerequisites** — [Node.js](https://nodejs.org/) ≥ 18.18 and
[Git](https://git-scm.com/). TypeScript is a project dependency; you do not need
it globally. The project uses **npm** — `package-lock.json` is committed and CI
installs with `npm ci`.

```bash
git clone git@github.com:suman7802/ExpressTemplate.git
cd ExpressTemplate
npm install

npm run setup                  # creates .env.local with a generated API_KEY
npm run dev
```

Open http://localhost:8080 — you should get the welcome envelope, and
**<http://localhost:8080/docs>** for the interactive API reference.

The server **validates its configuration at boot and refuses to start if
anything is missing**, and tells you exactly what. That is a feature; see
[docs/04-configuration.md](docs/04-configuration.md).

For production: `npm run build` then `npm start`.

Detailed walkthrough: [docs/01-getting-started.md](docs/01-getting-started.md)

## Scripts

| Command             | Purpose                                                         |
| ------------------- | --------------------------------------------------------------- |
| `npm run setup`     | Create `.env.local` with a generated `API_KEY`                  |
| `npm run dev`       | Watch mode with hot restart (`dev:debug` for the inspector)     |
| `npm run build`     | `tsc` + rewrite `@/` path aliases (`rebuild` for a clean build) |
| `npm start`         | Run the compiled build in production mode                       |
| `npm run check`     | typecheck + lint + format:check — what CI runs                  |
| `npm run fix`       | ESLint `--fix` + Prettier                                       |
| `npm run pm2:prod`  | Build, then start under PM2 cluster mode                        |
| `npm run docker:up` | Start the API + Prometheus + Grafana stack                      |

Full list: [docs/01-getting-started.md](docs/01-getting-started.md#the-scripts)

## Documentation

> [Postman Collection](https://documenter.getpostman.com/view/27265804/2sAYkBsM99)

The `docs/` folder explains how the server works and **why** it is built this
way — aimed at engineers who want more than a list of npm packages:

|                                                   |                                                    |
| ------------------------------------------------- | -------------------------------------------------- |
| [Architecture](docs/02-architecture.md)           | The middleware pipeline, layers, request lifecycle |
| [Project structure](docs/03-project-structure.md) | What every file is for                             |
| [Configuration](docs/04-configuration.md)         | Env vars, validated and typed at boot              |
| [Validation](docs/06-validation.md)               | Zod at the edge, types inferred from schemas       |
| [Error handling](docs/07-error-handling.md)       | One error contract for the whole API               |
| [Security](docs/09-security.md)                   | Every defence, every gap, a production checklist   |
| [Performance](docs/10-performance.md)             | The event loop, clustering, measuring              |
| [Observability](docs/11-observability.md)         | Metrics, health checks, Grafana                    |
| [Deployment](docs/15-deployment.md)               | Docker, PM2, reverse proxies, zero-downtime        |
| [Extending](docs/17-extending.md)                 | Adding features, a database, auth, tests           |
| [Troubleshooting](docs/18-troubleshooting.md)     | Symptoms → causes → fixes                          |

## Docker compose

Runs the API alongside Prometheus and Grafana:

```bash
npm run setup -- .env.production   # generates an API_KEY; review the rest
npm run docker:up
```

| Service    | URL                                   |
| ---------- | ------------------------------------- |
| API        | http://localhost:8080                 |
| Prometheus | http://localhost:9090                 |
| Grafana    | http://localhost:3001 (admin / admin) |

## Features

**Request handling** — versioned routing · zod validation with inferred types ·
uniform success and error envelopes · async error propagation · request ids
echoed as `X-Request-Id`

**API reference** — interactive `/docs` page with a try-it console, generated
from the same zod schemas that validate requests · OpenAPI 3.0 spec at
`/docs/openapi.json` · one env flag, one folder, trivially removable

**Security** — helmet · CORS allow-list · rate limiting · progressive throttling ·
constant-time API key checks · body size limits · upload type/size/count limits ·
proxy-aware client IPs · no stack traces in production

**Observability** — Winston (JSON, levelled, rotated) · Morgan piped into Winston ·
Prometheus histograms and counters with bounded labels · health endpoint ·
containerised Grafana

**Operations** — boot-time config validation · graceful shutdown with a forced
timeout · PM2 cluster mode · multi-stage non-root Docker image · GitHub Actions CI

**Content** — i18n (English + Nepali, typed keys) · SendGrid email with local
Handlebars templates

## Roadmap

- Automated tests (Vitest + supertest — see [docs/17](docs/17-extending.md#adding-tests))
- Authentication and authorization
- Database layer
- Grafana Loki for logs
- Redis-backed rate limiting for multi-process deployments

## Contributing

Contributors are welcome.

1. Fork the repository
2. `git checkout -b feature/new-feature`
3. Make your changes — `npm run typecheck && npm run lint` must pass
4. `git commit -m "feat: add new feature"`
5. `git push origin feature/new-feature`
6. Open a Pull Request

Please read [docs/16-coding-standards.md](docs/16-coding-standards.md) first.

- Found a bug or want a feature? [Open an issue](https://github.com/suman7802/ExpressTemplate/issues/new/choose)
- Need help? [Start a discussion](https://github.com/suman7802/ExpressTemplate/discussions/new/choose)

## Contact

- **Email:** [cs.sumansrm@gmail.com](mailto:cs.sumansrm@gmail.com)
- **Website:** [sumansharma.name.np](https://sumansharma.name.np)
- **LinkedIn:** [cssuman](https://www.linkedin.com/in/cssuman/)

## License

Licensed under the MIT License. See [LICENSE](LICENSE).
