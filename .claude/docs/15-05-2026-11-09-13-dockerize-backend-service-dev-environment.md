# Plan — Containerized dev environment for backend-service

- From: planner
- To: Root Agent
- Title: Plan Response — Containerized dev environment for backend-service
- Description: Add a `development` Dockerfile stage and a `docker-compose.override.yml` so backend-service runs NestJS in `--watch` mode with a live-reload bind-mount, leaving the production multi-stage path and the redis/mariadb services untouched.

> **Approved by user on 2026-05-15.** Resolved open questions (see below): (1) dev command = `yarn start:dev` (watch only, no debug port); (2) compiled `dist/` is written back to host (NOT volume-masked); (3) dev `backend` healthcheck is disabled in the override.

---

## Approach Summary

- Append a new stage `development` to `backend-service/Dockerfile` that branches off the existing `builder` stage (full dev deps + generated Prisma client already present), keeps `node:20-alpine`, reuses the existing `entrypoint.sh`, and sets `CMD ["yarn", "start:dev"]`. The stage MUST be positioned so that `runner` remains the final stage in the file, so the prod path (`docker compose -f docker-compose.yml build`, no `target`) keeps resolving to `runner`.
- Add `backend-service/docker-compose.override.yml` (auto-merged only when no `-f` is passed) that overrides *only* the `backend` service: `build.target: development`, a source bind-mount with an anonymous volume masking `/app/node_modules`, `NODE_ENV=development`, and a disabled healthcheck. `redis`/`mariadb` are not mentioned, so they are inherited verbatim.
- Production path (`docker compose -f docker-compose.yml ...`) stays byte-for-byte unchanged.

## Functional Requirements

- `docker compose build` (override auto-merged) produces an image running `yarn start:dev` (`nest start --watch`).
- Editing a `.ts` file under `backend-service/src/` on the host triggers an in-container Nest recompile + restart without rebuilding the image.
- `redis` and `mariadb` services start unchanged and `backend` still waits for them healthy.
- Prisma migrations still run on container start (entrypoint unchanged) before Nest boots.
- Production path `docker compose -f docker-compose.yml build`/`up` continue to build/run the `runner` stage with `NODE_ENV=production` and `node dist/main`, zero behavioural change.
- No changes to `redis`, `mariadb`, named volumes, `entrypoint.sh`, `.dockerignore` prod semantics, or the `builder`/`deps-prod`/`runner` stages.

## Non-Functional Requirements

- Least privilege / no scope creep: changes confined to `backend-service/Dockerfile` (additive stage only) and a new `backend-service/docker-compose.override.yml`.
- Maintainability: dev stage reuses cached `builder` layers (DRY); override file documents *why* each override exists (KISS, comments matching existing file style).
- Reproducibility: dev image still pins `node:20-alpine` via the global `ARG NODE_IMAGE`.
- Security: no secret values read or hardcoded; dev still loads `.env` via `env_file`.

## Files in Scope

- `backend-service/Dockerfile` — MODIFIED: append a `development` stage only (no edits to existing stages).
- `backend-service/docker-compose.override.yml` — CREATED: overrides only the `backend` service for dev.
- Read-only reference, NOT modified: `backend-service/docker-compose.yml`, `entrypoint.sh`, `.dockerignore`, `package.json`, `nest-cli.json`, `tsconfig.json`, `prisma/`.

## Risks & Assumptions

- **Stage ordering / default-target risk (critical):** base `docker-compose.yml` sets no `target`, so the Dockerfile's last stage must remain `runner`. The `development` stage must be defined *before* `runner` (branching `FROM builder`). Verify `docker compose -f docker-compose.yml build` still yields the runner image after the change.
- **node_modules bind-mount masking:** bind-mounting the host tree into `/app` shadows the image's `/app/node_modules`. Mitigation: anonymous volume on `/app/node_modules` so the image-built Linux modules + generated Prisma client survive.
- **Prisma native engine:** Prisma v7 + `@prisma/adapter-mariadb` generates an Alpine/musl engine in `builder`; anonymous-volume mount preserves it. Deleting that volume requires regenerating `@prisma/client` in-container (documented caveat).
- **Host `dist/` write-back (user-approved):** `nest start --watch` writes compiled JS to `/app/dist`, which with the source bind-mount writes back to host `backend-service/dist/` (already gitignored). Accepted by user.
- **Healthcheck (user-approved):** dev override disables the `backend` healthcheck (cold first compile can exceed 30s `start_period`). Does not affect prod compose.
- **Non-root vs root in dev:** `development` branches from `builder` (root, no chown) for friction-free bind-mount writes; deliberate dev-only trade-off. Prod `runner` stays non-root.
- **Yarn-based:** dev CMD uses `yarn start:dev` for consistency. `entrypoint.sh` uses `npx --no-install prisma` — unaffected.
- Assumption: Docker Compose v2 (auto-merges `docker-compose.override.yml` only when `-f` omitted).

## Open Questions / Blockers — RESOLVED

1. Default dev command → **`yarn start:dev`** (watch only; no `start:debug`, no 9229 port).
2. Host `dist/` write-back → **allowed** (do NOT mask `/app/dist` with a volume).
3. Dev `backend` healthcheck → **disabled** in the override.

## Status

- [x] Ready to execute (unblocked; user-approved 2026-05-15)

## Task List

| #   | Status | Task | Responsible Role | Dependencies | Skills |
| --- | ------ | ---- | ---------------- | ------------ | ------ |
| 1   | DONE | Resolve the 3 open questions with the user. | (Root/user) | none | — |
| 2   | DONE | In `backend-service/Dockerfile`, append a `development` stage (`FROM builder AS development`) positioned so `runner` remains the final stage; `ENV NODE_ENV=development`, keep `ENTRYPOINT` to `tini -- /app/scripts/entrypoint.sh`, `CMD ["yarn","start:dev"]`; house-style header comment. Do not modify `builder`/`deps-prod`/`runner`. | developer | task 1 | clean-code |
| 3   | DONE | Create `backend-service/docker-compose.override.yml` overriding ONLY `backend`: `build.target: development`; bind-mount `.:/app` + anonymous volume `/app/node_modules` (do NOT mask `/app/dist`); `environment: NODE_ENV=development`; keep `env_file`/`depends_on`/`backend-uploads` inherited; disable healthcheck; no debug port. Do NOT declare `redis`/`mariadb`. Comment in existing file style. | developer | task 1, 2 | clean-code |
| 4   | DONE | Verify prod path unaffected: `docker compose -f docker-compose.yml config` confirmed no override leakage (build done in cycle 6). | developer | task 2, 3 | testing-workflow |
| 5   | DEFERRED | Verify dev path runtime (`docker compose up` + live-reload). **User-deferred 2026-05-15** to the real environment: this sandbox's TLS interception blocks bcrypt's prebuilt-binary download so no image build completes here (environmental, not a code defect). Artifacts statically + config verified. | tester | task 4, 6 | testing-workflow |
| 6   | DONE | **SCOPE EXPANSION (user-approved 2026-05-15):** Pre-existing defect — `builder` stage fails `yarn install` because `@prisma/streams-local@0.1.2` requires Node >=22 but base is `node:20-alpine`, blocking all image builds (dev + prod). Bump `ARG NODE_IMAGE` in `backend-service/Dockerfile` from `node:20-alpine` to `node:22-alpine` (affects all stages). Update the Dockerfile header comment that references "node:20-alpine". backend-service ONLY (agent-worker out of scope). | developer | task 2, 3 | clean-code |

## Outstanding / Follow-ups

- **Runtime verification deferred to the user's real environment (task 5).** This sandbox's TLS interception blocks bcrypt's prebuilt-binary download, so no image build completes here — environmental, not a code defect. To verify on a real machine:
  - Dev: `cd backend-service && docker compose up --build`, then edit a file under `src/` and confirm the in-container watcher recompiles/restarts with no image rebuild.
  - Prod path unchanged: `docker compose -f docker-compose.yml up --build` (still builds the `runner` stage, `NODE_ENV=production`, `node dist/main`).
- **Reviewer non-blocking recommendations (README dev section):**
  - Note that the override's `command` and the Dockerfile `development` stage `CMD` are intentionally duplicated for readability — both must stay in sync if the dev command changes.
  - Add a caveat that deleting the anonymous `/app/node_modules` volume (`docker compose down -v`) requires re-running `yarn prisma generate` in-container, since the Alpine/Prisma engine lives in that volume.
- **Contingency (declined extra scope):** if a restricted network also blocks bcrypt's prebuilt download in the real environment, add `python3 make g++` to the `builder`/`deps-prod` `apk add` lines so the native module can source-compile. Not implemented — user chose accept-as-is.

### Critical Files for Implementation
- /Users/nmthang6/Documents/Workspace/agent-assistant/backend-service/Dockerfile
- /Users/nmthang6/Documents/Workspace/agent-assistant/backend-service/docker-compose.override.yml (to be created)
- /Users/nmthang6/Documents/Workspace/agent-assistant/backend-service/docker-compose.yml (read-only reference)
- /Users/nmthang6/Documents/Workspace/agent-assistant/backend-service/scripts/entrypoint.sh (read-only reference)
- /Users/nmthang6/Documents/Workspace/agent-assistant/backend-service/package.json (read-only reference)
