# ==============================================================================
# Multi-stage build.
#
# Stage 1 needs TypeScript, ESLint and every other devDependency to compile.
# Stage 2 needs none of them - it copies the compiled output into a clean image.
# The result is a smaller image with a much smaller vulnerability surface.
#
# See docs/15-deployment.md
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: build
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copied before the source so Docker can reuse the cached install layer on any
# change that does not touch these files.
#
# `scripts/` is copied too because npm runs the `prepare` lifecycle script during
# install, and this project's prepare lives there. Without it the install fails
# with "Cannot find module" before a single dependency is linked.
COPY package*.json ./
COPY scripts ./scripts

# `npm ci` installs exactly what package-lock.json pins and fails if the lockfile
# and package.json disagree - which is what makes a build reproducible.
# `npm install` would silently resolve new versions at build time.
RUN npm ci

COPY . .

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# Pinned to match the pm2 devDependency: `latest` would let two builds of the
# same commit ship different majors, in an image whose comments above argue for
# reproducibility.
RUN npm install --global pm2@7.0.4

COPY package*.json ./
COPY scripts ./scripts

# prepare runs here too; it detects the missing husky devDependency and skips.
RUN npm ci --omit=dev && npm cache clean --force

# Compiled JavaScript only - no TypeScript source in the production image.
COPY --from=builder /app/build ./build

# Runtime assets resolved from the working directory, not from build/.
COPY locales ./locales
COPY templates ./templates
COPY public ./public
COPY ecosystem.config.js ./

# The node user ships with the official image. Running as root means a container
# escape starts with root on the host.
RUN mkdir -p logs && chown -R node:node /app
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/api/v0/health" > /dev/null || exit 1

CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
