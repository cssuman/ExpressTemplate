# ExpressTemplate Documentation

This folder explains **how this server works and why it is built the way it is**.

Most Express tutorials show you _what_ to type. These docs focus on the _why_,
because that is what you need when the template stops matching your problem and
you have to change it.

Every page follows the same shape:

1. **What it is** — the mechanism in plain language
2. **Why it is here** — the problem it solves, and what breaks without it
3. **How to use it** — real code from this repository
4. **Common mistakes** — what goes wrong in production

---

## Reading paths

**New to Node/Express, or new to this repo** — read in order:

| #   | Document                                                 | What you will learn                                         |
| --- | -------------------------------------------------------- | ----------------------------------------------------------- |
| 01  | [Getting started](01-getting-started.md)                 | Install, configure and run the server                       |
| 02  | [Architecture](02-architecture.md)                       | How a request travels through the app                       |
| 03  | [Project structure](03-project-structure.md)             | What every folder and file is for                           |
| 05  | [Routing and controllers](05-routing-and-controllers.md) | Where your code goes                                        |
| 06  | [Validation](06-validation.md)                           | Trusting your inputs                                        |
| 07  | [Error handling](07-error-handling.md)                   | One error shape for the whole API                           |
| 17  | [Extending the template](17-extending.md)                | Building your first feature                                 |
| —   | [Interactive API reference](../src/openapi/README.md)    | The `/docs` page: how it is generated, and how to remove it |

**Shipping to production** — read these before you deploy:

| #   | Document                             | What you will learn                             |
| --- | ------------------------------------ | ----------------------------------------------- |
| 04  | [Configuration](04-configuration.md) | Environment variables, validated at boot        |
| 09  | [Security](09-security.md)           | Every defence in the template, and the gaps     |
| 10  | [Performance](10-performance.md)     | The event loop, clustering, what actually costs |
| 11  | [Observability](11-observability.md) | Metrics, health checks, Grafana                 |
| 15  | [Deployment](15-deployment.md)       | Docker, PM2, reverse proxies, zero-downtime     |

**Working on a specific feature:**

| #   | Document                                           |
| --- | -------------------------------------------------- |
| 08  | [Logging](08-logging.md)                           |
| 12  | [Internationalization](12-internationalization.md) |
| 13  | [Email](13-email.md)                               |
| 14  | [File uploads](14-file-uploads.md)                 |
| 16  | [Coding standards](16-coding-standards.md)         |
| 18  | [Troubleshooting](18-troubleshooting.md)           |

**Using an AI coding assistant?** Point it at [`../CLAUDE.md`](../CLAUDE.md) in the
repository root. It is a condensed map of this codebase — conventions,
invariants and the rules that keep generated code consistent with the rest.

---

## What this template is (and is not)

**It is** a production-shaped starting point for a JSON API: request
correlation, structured logging, validated configuration, i18n, rate limiting,
metrics, a uniform error contract, an interactive API reference at `/docs`,
Docker and PM2 — wired together and working.

**It is not** a framework. There is no magic, no dependency injection container,
no code generation. Everything is plain Express and plain TypeScript, so you can
read and change any part of it.

**Not included yet** (deliberately — see [17-extending.md](17-extending.md) for
where each belongs):

- Authentication and authorization (only a shared API key exists)
- A database layer
- An automated test suite
- Background jobs and queues

## Conventions used in these docs

- File paths are relative to the repository root: `src/app.ts`
- ⚠️ marks something that will bite you in production
- 💡 marks a decision you may reasonably want to make differently
