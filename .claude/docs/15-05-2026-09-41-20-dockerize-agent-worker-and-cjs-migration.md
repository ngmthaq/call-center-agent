- From: planner
- To: Root Agent
- Title: Plan Response — Dockerize agent-worker + migrate to CommonJS
- Description: Migrate `agent-worker` from ESM/NodeNext to CommonJS (dropping `.js` suffixes from relative TS imports) and add a three-stage Alpine Dockerfile + per-service compose stack mirroring `backend-service` conventions, adjusted for a no-port, no-database long-running LiveKit worker.

---

## Approach Summary
- Phase 1 (CJS migration) lands first because the Dockerfile's `CMD ["node", "dist/main.js", "start"]` requires the compiled output shape to be stable. Switch `package.json` `"type": "module"` to `"commonjs"`, change `tsconfig.json` `module/moduleResolution` to `CommonJS/Node`, drop the `.js` suffixes from the 6 relative imports, replace the lone `import.meta.url` use in `src/main.ts` with `__dirname`/`path.resolve`, and reconfigure `jest.config.cjs` from the `default-esm` preset to the standard CJS `ts-jest` preset so the existing `.js` mapper can go away.
- Phase 2 (Dockerization) ports `backend-service/Dockerfile`, `.dockerignore`, `docker-compose.yml`, and `scripts/entrypoint.sh` into `agent-worker/`, stripping Prisma/openssl/libc6-compat/EXPOSE/uploads and rewriting compose to a single `agent-worker` service with no published ports, no depends-on, no healthcheck (LiveKit worker has no HTTP surface — documented in compose comment), env_file `.env`, and `json-file` logging with 10m x 5 rotation. A minimal `scripts/bootstrap.sh` is intentionally NOT shipped (no secrets to randomize — operators paste real LiveKit credentials), keeping scope tight.
- Dev tooling stays on `tsx` (no extra dep) because under CJS `tsx` still works and switching to `ts-node` would add a runtime devDependency for zero gain.
- Tests preserve their AAA structure; only the dynamic `await import('./agent.js')` lines lose `.js` and the smoke spec still asserts shape only — no real worker boot.

## Functional Requirements
- `yarn build` produces `dist/main.js` runnable as `node dist/main.js start` with zero runtime errors before any LiveKit connection attempt (validated by exit-on-config-missing path).
- `yarn lint` (`eslint "src/**/*.ts"`) passes with zero errors after the migration.
- `yarn test` (`jest`) passes all existing specs in `src/agent.spec.ts` and `src/config.spec.ts` with no `.js` suffixes in spec imports.
- `yarn dev` (`node --import tsx --watch src/main.ts dev`) still boots the worker in dev mode under CJS.
- No relative import in `agent-worker/src/**/*.ts` ends with `.js` after migration (greppable invariant: `grep -rn "from '\\./[a-z].*\\.js'" agent-worker/src` returns empty).
- `docker compose build` (run inside `agent-worker/`) succeeds and produces an image whose final stage size is dominated by `dist/`, prod `node_modules`, and `package.json` only — no source TS, no devDependencies.
- `docker compose up` (with a populated `agent-worker/.env`) starts the worker; container reports `starting agent worker with explicit dispatch` via Pino JSON to stdout; SIGTERM from `docker compose down` triggers the registered shutdown handler within a few seconds (tini reaps the Node child).
- Compose stack runs on the worker's own network — touches NEITHER `backend-service/docker-compose.yml` NOR `livekit-server/`.
- `.env.example` remains the source of truth for required keys (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `AGENT_NAME`, `LOG_LEVEL`), with a top-of-file comment stating that `agent-worker/.env` is mode-600 and never committed.

## Non-Functional Requirements
- Multi-stage build: `builder` (full deps + `yarn build`) → `deps-prod` (`yarn install --production --frozen-lockfile && yarn cache clean`) → `runner` (production runtime only, copies `dist/` and prod `node_modules`).
- Base image pinned via `ARG NODE_IMAGE=node:20-alpine`; no `:latest`.
- `runner` stage installs only `tini`; omits `openssl` and `libc6-compat` (no Prisma engine, no node-gyp native binaries — `@livekit/rtc-node` ships prebuilt binaries, validate before adding `libc6-compat` back).
- `tini` is PID 1 (`ENTRYPOINT ["/sbin/tini", "--", "/app/scripts/entrypoint.sh"]`); container runs as non-root `node` user (uid 1000) after `chown -R node:node /app`.
- `entrypoint.sh` is minimal: `set -eu`, a single `exec "$@"` so the Node process inherits PID after tini.
- Compose stack: `restart: unless-stopped`, `env_file: .env`, JSON-file logging with `max-size: 10m`, `max-file: 5`, no `ports:`, no `depends_on:`, no `healthcheck:` (LiveKit worker exposes no HTTP/TCP probe; LiveKit Cloud tracks worker health server-side via the agents protocol — document this in a compose comment so operators don't mistake the omission for negligence).
- `.dockerignore` mirrors backend-service minus Prisma/uploads entries and minus the `test/` line (specs live under `src/**/*.spec.ts`); add `src/**/*.spec.ts` to the build context exclusion so spec files never enter the image.
- No new runtime dependencies added (no `dotenv` — `loadConfig` reads `process.env` directly, and compose `env_file:` injects vars before Node starts).
- `clean-code`, `secret-scanner`, and `aaa-testing` skill principles applied: no hardcoded secrets in Dockerfile/compose/.env.example, single-responsibility scripts, Arrange-Act-Assert preserved in specs.

## Files in Scope
- MODIFY: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/package.json` — change `"type"` from `"module"` to `"commonjs"`; keep scripts unchanged; no new deps.
- MODIFY: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/tsconfig.json` — `module: "CommonJS"`, `moduleResolution: "Node"`, drop ESM-only fields if needed; keep `target: ES2022`, `strict`, `isolatedModules`.
- MODIFY: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/jest.config.cjs` — switch from `ts-jest/presets/default-esm` to `ts-jest` default CJS preset; drop `extensionsToTreatAsEsm`, `useESM`, the `.js` `moduleNameMapper`, and the inline `module: ESNext` override; align `tsconfig` override to `module: CommonJS`.
- MODIFY: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/src/main.ts` — remove `.js` from `./config.js` and `./logger.js`; replace `new URL('./agent.js', import.meta.url)` + `fileURLToPath` with `path.resolve(__dirname, 'agent.js')` (or `require.resolve('./agent')`); drop the `node:url` import; update the `ServerOptions.agent` value accordingly.
- MODIFY: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/src/agent.ts` — strip `.js` from `./config.js` and `./logger.js`.
- MODIFY: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/src/logger.ts` — strip `.js` from the `./config.js` type-only import.
- MODIFY: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/src/config.spec.ts` — strip `.js` from the `./config.js` import.
- MODIFY: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/src/agent.spec.ts` — replace `await import('./agent.js')` with `await import('./agent')` in all four call sites; AAA blocks unchanged.
- MODIFY: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/.env.example` — append a header comment matching `backend-service` ("DO NOT commit a real .env file"); keys themselves unchanged.
- MODIFY: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/.gitignore` — no change required (it already excludes `.env`, `.env.*` with `!.env.example`).
- CREATE: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/Dockerfile` — three-stage build per the Constraints section above; no Prisma; no EXPOSE; CMD `["node", "dist/main.js", "start"]`.
- CREATE: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/.dockerignore` — port from backend-service; drop Prisma + uploads entries; add `src/**/*.spec.ts`.
- CREATE: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/docker-compose.yml` — single `agent-worker` service; `env_file: .env`; no ports, no depends_on, no healthcheck; json-file logging 10m x 5; comment explaining why no healthcheck.
- CREATE: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/scripts/entrypoint.sh` — POSIX sh, `set -eu`, single `exec "$@"`, executable bit set inside Dockerfile via `chmod +x`.
- MODIFY: `/Users/nmthang6/Documents/Workspace/agent-assistant/agent-worker/README.md` — add a "Docker" section documenting `docker compose up`, the `.env` workflow, and the deliberate omission of healthcheck/ports; update the "Module system: ESM" note to "CommonJS".
- DELETE: none.

## Risks & Assumptions
- Assumption: `@livekit/agents` v1.4.2 functions correctly under CommonJS. The package itself is ESM-published; under CJS it must be loaded via dynamic `import()` or be dual-published. Risk: if `@livekit/agents` is ESM-only, the CJS-compiled `main.ts`'s top-level `import { ServerOptions, cli } from '@livekit/agents'` will fail at runtime with `ERR_REQUIRE_ESM`. Mitigation in the migration task: verify `node_modules/@livekit/agents/package.json` `exports`/`main` fields BEFORE flipping `tsconfig.module`; if it is ESM-only, escalate as a blocker (cannot complete CJS migration without dynamic `import()` or a downgrade).
- Assumption: `@livekit/rtc-node` ships musl-compatible prebuilt binaries (it advertises Linux/musl support); if not, `runner` stage will need `libc6-compat` added back.
- Risk: removing the healthcheck means compose-level liveness signals don't exist; mitigated by Pino structured logs + LiveKit Cloud worker-health tracking.
- Risk: `process.env.AGENT_NAME` in `agent.ts:7` is captured at module load time. Inside Docker, `env_file:` is applied before the container's CMD runs, so this still works — confirmed safe.
- Risk: the LiveKit worker connects outbound to `LIVEKIT_URL` (`ws://` or `wss://`); when running compose locally and pointing at the sibling `livekit-server` compose stack, `ws://localhost:7880` will NOT resolve from inside the container — operators must use `host.docker.internal` (macOS/Windows) or attach to the livekit-server network. Document this in the new README "Docker" section so it's not a silent failure.
- Risk: switching from ESM/NodeNext to CommonJS subtly changes `noUnusedLocals` behavior for type-only imports — the `import type { LogLevel } from './config'` in `logger.ts` must remain type-only to avoid CJS runtime side effects; verify post-migration.

## Open Questions / Blockers
- None. The user has explicitly confirmed the CJS direction in the prompt; all Dockerfile choices are derivable from `backend-service` conventions plus the documented constraints (no DB, no HTTP port, no Prisma).
- Soft note (does NOT block the plan): the developer executing Task 1 must spot-check `@livekit/agents`'s package.json `exports`/`type` field before proceeding; if it is ESM-only, the developer should pause and surface that finding to the Root Agent rather than silently introduce a dynamic-import workaround.

## Status
- [x] Ready to execute
- [x] Executed — Phase 1 complete & verified green; Phase 2 files complete; Task 15 build-only verified green (`docker compose up` with real creds deferred — see note below)
- [ ] Blocked — requires user input on: ...

> **Reconciliation note (2026-05-15, post-interruption review):** Execution was interrupted at the final step. Root Agent reassessed actual file state vs. the plan and re-ran verification. Two reconciliations, both approved by the user:
> 1. **Task 3 deviation ACCEPTED.** `tsconfig.json` was set to `module: Node16` / `moduleResolution: Node16` instead of the planned `CommonJS` / `Node`. With `package.json` `"type": "commonjs"`, Node16 compiles as CJS and all gates pass (lint clean, build → `dist/main.js`, 31/31 tests pass, zero residual `.js` relative imports). Node16 is the modern TS recommendation and is documented honestly in `README.md`. Kept as an intentional improvement over the literal plan; no code change made.
> 2. **Task 15 scoped to build-only.** `docker compose build` verified GREEN by tester sub-agent (exit 0, 3 stages resolve, final image shape correct: `dist/` + prod `node_modules` present, no `src/`, devDependencies stripped; `tini`→`entrypoint.sh` ENTRYPOINT, `node` user, correct CMD). The `docker compose up` runtime smoke (Pino "starting agent worker..." log + SIGTERM drain) is **deferred** — it requires a populated `agent-worker/.env` with real `LIVEKIT_*` credentials, which the operator must supply.

## Task List
| # | Status | Task | Responsible Role | Dependencies | Skills |
|---|--------|------|------------------|--------------|--------|
| 1 | DONE | Verify `node_modules/@livekit/agents/package.json` exports field permits CJS `require`; if ESM-only, stop and surface to Root Agent before proceeding. | developer | none | clean-code |
| 2 | DONE | Flip `agent-worker/package.json` `"type": "module"` to `"commonjs"`; do not change scripts or dependencies. | developer | task 1 | clean-code |
| 3 | DONE (deviation accepted) | Update `agent-worker/tsconfig.json` module resolution. Implemented as `module: Node16` / `moduleResolution: Node16` (not the planned `CommonJS`/`Node`); functionally equivalent under `"type":"commonjs"`, all gates green. User-approved. | developer | task 2 | clean-code |
| 4 | DONE | Rewrite `agent-worker/src/main.ts`: drop `.js` from `./config` and `./logger` imports; replace `new URL('./agent.js', import.meta.url)` + `fileURLToPath` with `path.resolve(__dirname, 'agent.js')`; remove `node:url` import. | developer | task 3 | clean-code |
| 5 | DONE | Strip `.js` from relative imports in `agent-worker/src/agent.ts` (lines 4-5) and `agent-worker/src/logger.ts` (line 3). | developer | task 3 | clean-code |
| 6 | DONE | Strip `.js` from `agent-worker/src/config.spec.ts` line 1 and all four `await import('./agent.js')` sites in `agent-worker/src/agent.spec.ts`; preserve every Arrange-Act-Assert block. | tester | task 5 | aaa-testing |
| 7 | DONE | Rewrite `agent-worker/jest.config.cjs` to standard `ts-jest` CJS preset: remove `default-esm`, `extensionsToTreatAsEsm`, `useESM`, the `.js` `moduleNameMapper`, and the inline ESM override; set `tsconfig` override to `module: CommonJS`. | tester | task 6 | aaa-testing |
| 8 | DONE | Run `yarn lint`, `yarn build`, and `yarn test` locally; confirm clean exits and a runnable `dist/main.js`. Treat any failure as a Phase-1 blocker. | tester | task 7 | aaa-testing, clean-code |
| 9 | DONE | Create `agent-worker/Dockerfile` (three stages: builder, deps-prod, runner) modeled on `backend-service/Dockerfile`; pin `node:20-alpine`; drop Prisma + `openssl` + `libc6-compat`; install only `tini` in runner; CMD `["node", "dist/main.js", "start"]`; non-root `node` user; no EXPOSE. | developer | task 8 | clean-code, secret-scanner |
| 10 | DONE | Create `agent-worker/.dockerignore` mirroring `backend-service/.dockerignore` minus Prisma + uploads lines; add `src/**/*.spec.ts`. | developer | task 9 | clean-code |
| 11 | DONE | Create `agent-worker/scripts/entrypoint.sh` (POSIX sh, `set -eu`, single `exec "$@"`); ensure Dockerfile chmods +x. | developer | task 9 | clean-code |
| 12 | DONE | Create `agent-worker/docker-compose.yml` with one `agent-worker` service: `env_file: .env`, `restart: unless-stopped`, json-file logging (`max-size: 10m`, `max-file: 5`), NO ports, NO depends_on, NO healthcheck (with inline comment explaining why a LiveKit worker has no HTTP probe). | developer | task 11 | clean-code, secret-scanner |
| 13 | DONE | Update `agent-worker/.env.example` header comment to match backend-service style (template-only, never commit real `.env`); confirm via `secret-scanner` that no real values landed. | developer | task 12 | secret-scanner |
| 14 | DONE | Update `agent-worker/README.md`: change "Module system: ESM" to "CommonJS"; add a "Docker" section covering `docker compose build/up/down`, the deliberate absence of port mapping and healthcheck, and the `host.docker.internal` caveat for connecting to a host-side `ws://localhost:7880` LiveKit server. | developer | task 13 | clean-code |
| 15 | DONE (build-only; `up` deferred) | `docker compose build` verified GREEN (exit 0, image shape correct). `docker compose up` runtime smoke deferred — requires operator-supplied real `LIVEKIT_*` creds in `agent-worker/.env`. | tester | task 14 | aaa-testing |
