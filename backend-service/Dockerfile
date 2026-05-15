# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the NestJS backend.
#
#   builder    — full dev deps + `prisma generate` + `nest build`.
#   deps-prod  — clean prod-only `node_modules` (no devDependencies, no build
#                tooling). Kept separate so the runner stage never sees the
#                builder's bloated tree.
#   runner     — tini PID 1, non-root `node` user, copies only what runtime
#                actually needs (compiled `dist/`, prod modules, prisma assets).
#
# Pinned base image: `node:22-alpine` (latest 22.x LTS on Alpine). Alpine
# keeps the image small AND ships a non-root `node` user (uid 1000) out of
# the box. `:latest` is intentionally forbidden — see README versions table.

ARG NODE_IMAGE=node:22-alpine

# ---------------------------------------------------------------------------
# Stage 1 — builder
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder

# openssl is required by `prisma generate` to fingerprint the engine; libc6-
# compat smooths over glibc-only binaries some node-gyp builds expect.
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy only the manifests first so dependency installs cache on lockfile
# changes alone (source edits don't bust this layer).
COPY package.json yarn.lock ./
COPY prisma ./prisma

# `--frozen-lockfile` aborts if `yarn.lock` would drift — required for
# reproducible builds.
RUN yarn install --frozen-lockfile

# Generate the Prisma client into `node_modules/@prisma/client`. Doing this
# now (before copying source) keeps the layer cached across source edits.
RUN yarn prisma generate

# Bring the rest of the source in and build.
COPY . .
RUN yarn build

# ---------------------------------------------------------------------------
# Stage 2 — deps-prod
# ---------------------------------------------------------------------------
# A clean install of production dependencies only. Used by the runner stage
# so that devDependencies (jest, ts-node, eslint, ...) never reach the image.
FROM ${NODE_IMAGE} AS deps-prod

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json yarn.lock ./
COPY prisma ./prisma

RUN yarn install --production --frozen-lockfile \
    && yarn prisma generate \
    && yarn cache clean

# ---------------------------------------------------------------------------
# Stage 3 — development
# ---------------------------------------------------------------------------
# Live-reload dev image. Branches off `builder`, so it reuses the full dev
# dependency tree (jest, ts-node, @nestjs/cli, ...) and the already-generated
# Prisma client — no extra install. NOT on the production path: the prod
# build passes no `--target`, so `runner` (the final stage) is still what
# `docker compose -f docker-compose.yml build` resolves to. Runs as root
# (builder never drops privileges) so the source bind-mount can write
# compiled `dist/` and Nest's watch cache back to the host without chown
# friction — a deliberate dev-only trade-off; prod `runner` stays non-root.
FROM builder AS development

# `builder` has openssl/libc6-compat but NOT tini. Add tini so this stage
# can share the exact same entrypoint as `runner` (tini PID 1 reaps zombies
# and forwards SIGTERM cleanly on `docker compose down`).
RUN apk add --no-cache tini

ENV NODE_ENV=development
WORKDIR /app

ENTRYPOINT ["/sbin/tini", "--", "/app/scripts/entrypoint.sh"]
CMD ["yarn", "start:dev"]

# ---------------------------------------------------------------------------
# Stage 4 — runner
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner

# tini is PID 1 so the process tree reaps zombies and forwards SIGTERM to the
# Node process cleanly during `docker compose down`. openssl/libc6-compat are
# kept for runtime Prisma engine startup.
RUN apk add --no-cache tini openssl libc6-compat

ENV NODE_ENV=production
WORKDIR /app

# Copy production-only modules (with Prisma client generated) from deps-prod.
COPY --from=deps-prod /app/node_modules ./node_modules

# Compiled application bundle.
COPY --from=builder /app/dist ./dist

# Prisma schema + migrations are read at runtime by `prisma migrate deploy`
# in entrypoint.sh, so they must live in the runtime image.
COPY --from=builder /app/prisma ./prisma

# package.json is required by `node` (resolves `"type"`, `"main"`, etc.) and
# by `npx prisma` in the entrypoint.
COPY --from=builder /app/package.json ./package.json

# Entrypoint script — copied last so changes to it don't bust earlier layers.
COPY scripts/entrypoint.sh /app/scripts/entrypoint.sh

# `node` is the pre-existing non-root user (uid 1000) in the official Node
# Alpine image. Ownership flip lets the app write to /app/uploads when the
# host hasn't pre-chowned the named volume.
RUN chmod +x /app/scripts/entrypoint.sh \
    && mkdir -p /app/uploads \
    && chown -R node:node /app

USER node

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "/app/scripts/entrypoint.sh"]
CMD ["node", "dist/main"]
