- From: planner
- To: Root Agent
- Title: Plan Response — Express.js + TypeScript scaffold at apps/livekit-server
- Description: Scaffold a layered MVC Express + TypeScript service in the empty `apps/livekit-server/` pnpm workspace package using sibling-app conventions (ESM, strict tsc, prettier/eslint) without running any installs.

---

## Approach Summary

- Populate the empty `apps/livekit-server/` package with a layered MVC Express + TypeScript codebase. The package will be a private ESM module (`"type": "module"`) to match `apps/livekit-agent`, with a self-contained `tsconfig.json` (sibling does not extend a root), prettier/eslint configs cloned from the sibling, and scripts mirrored where applicable (`build`, `clean`, `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `dev`, `start`).
- The HTTP server is split into `src/app.ts` (Express app factory — middleware + routes wiring, exported for testability) and `src/server.ts` (entrypoint that reads `PORT` and calls `app.listen`). Cross-cutting concerns (`cors`, `helmet`, `morgan`, JSON body parsing, 404 catcher via `http-errors`, global error handler) live in `src/middlewares/`. A single `/health` route is wired via `src/routes/` → `src/controllers/` → `src/services/` to demonstrate the full layered flow without inventing extra features.
- Build uses `tsc` to emit ESM to `dist/`; dev uses `tsx watch src/server.ts`. No installs are performed — `package.json` only declares dependencies in the manifest so the user can install later.
- Final tree of `apps/livekit-server/`:

```
apps/livekit-server/
├── .env.example
├── .gitignore
├── .nvmrc
├── .prettierignore
├── .prettierrc
├── README.md
├── eslint.config.ts
├── package.json
├── tsconfig.json
└── src/
    ├── app.ts
    ├── server.ts
    ├── config/
    │   └── env.ts
    ├── controllers/
    │   └── health.controller.ts
    ├── middlewares/
    │   ├── error-handler.ts
    │   └── not-found.ts
    ├── routes/
    │   ├── index.ts
    │   └── health.route.ts
    ├── services/
    │   └── health.service.ts
    └── utils/
        └── async-handler.ts
```

## Functional Requirements

- `apps/livekit-server/package.json` declares package name `livekit-server`, `"private": true`, `"version": "1.0.0"`, `"type": "module"`, `engines.node >=22.0.0`, `engines.pnpm >=10.0.0`, and lists `express`, `cors`, `helmet`, `morgan`, `dotenv`, `http-errors` under `dependencies` plus `typescript`, `tsx`, `@types/node`, `@types/express`, `@types/cors`, `@types/morgan`, `@types/http-errors` under `devDependencies` (no install command is run).
- Scripts present in `package.json`: `build` (`tsc -p tsconfig.json`), `clean` (`rm -rf dist`), `typecheck` (`tsc --noEmit`), `lint` / `lint:fix` (eslint matching sibling globs), `format` / `format:check` (prettier matching sibling globs), `dev` (`tsx watch src/server.ts`), `start` (`node dist/server.js`).
- `src/app.ts` exports a `createApp()` factory that registers, in order: `helmet()`, `cors()`, `morgan('dev')`, `express.json()`, `express.urlencoded({ extended: true })`, mounted router from `src/routes/index.ts`, the not-found middleware, then the global error handler.
- `src/server.ts` loads env via `dotenv/config`, calls `createApp()`, and listens on `config.port` (default `3000`), logging the bound port via `console.log` (no logging framework added).
- `GET /health` returns HTTP 200 with JSON body `{ "status": "ok" }`, served through `routes → controllers → services` layers.
- Global error handler middleware accepts `(err, req, res, next)`, normalizes via `http-errors`, responds with `{ status, message }` and the correct status code, and never leaks stack traces unless `NODE_ENV !== 'production'`.
- Not-found middleware throws `createHttpError(404)` so unmatched paths flow into the global error handler.
- `src/config/env.ts` reads `process.env.PORT` (parsed to number, default `3000`) and `process.env.NODE_ENV` (default `'development'`), exporting a typed `config` object — and reads keys only, never embedded secret defaults.
- `.env.example` lists only keys (no values): `PORT=`, `NODE_ENV=`.
- `.gitignore` ignores `node_modules/`, `dist/`, `.env`, `.env.*.local`, `*.tsbuildinfo`, `.DS_Store` (mirroring relevant entries from sibling).
- `README.md` documents folder structure, available scripts, the `PORT` / `NODE_ENV` env keys, and that the user must run `pnpm install` from the repo root before `pnpm livekit-server dev`.
- `tsconfig.json` is self-contained (sibling does not extend a root) and uses the same strict options as the sibling, with `rootDir: ./src`, `outDir: ./dist`, ESM module/target, and excludes for `dist`/`node_modules`.

## Non-Functional Requirements

- Code matches sibling prettier rules (single quotes, semicolons, 2-space indent, `printWidth: 100`, trailing comma `all`) and passes eslint flat config without warnings.
- Strict TypeScript: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns` — same surface as sibling tsconfig.
- Separation of Concerns: routes only wire paths to controllers; controllers only translate HTTP ↔ service calls; services hold pure business logic; middlewares isolate cross-cutting concerns.
- KISS / DRY: no premature abstractions — a single `asyncHandler` util wraps async controllers to forward rejections to `next()`, used by every async controller to avoid duplicated `try/catch` blocks.
- Security baseline: `helmet` for default headers, `cors` enabled with defaults, error handler suppresses stack traces in production.
- No secret values are read or written; `.env.example` contains keys only.
- No tests, no test runner config, no test files (per user opt-out).

## Files in Scope

Created (all under `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/`):

- `package.json`
- `tsconfig.json`
- `eslint.config.ts`
- `.prettierrc`
- `.prettierignore`
- `.gitignore`
- `.nvmrc` (copy `22.18.0` from sibling)
- `.env.example`
- `README.md`
- `src/server.ts`
- `src/app.ts`
- `src/config/env.ts`
- `src/routes/index.ts`
- `src/routes/health.route.ts`
- `src/controllers/health.controller.ts`
- `src/services/health.service.ts`
- `src/middlewares/error-handler.ts`
- `src/middlewares/not-found.ts`
- `src/utils/async-handler.ts`

Deleted:

- `apps/livekit-server/.gitkeep` (no longer needed once the folder is populated)

Modified:

- None outside `apps/livekit-server/`. Root `package.json` already exposes a `livekit-server` filter script — no change required.

## Risks & Assumptions

- **Assumption:** ESM (`"type": "module"`) is correct because sibling `apps/livekit-agent` uses ESM; this requires `.js` extensions on relative imports in source — the plan accounts for that.
- **Assumption:** `tsx` is acceptable as the dev runner (user listed "`ts-node-dev` or `tsx`"). `tsx` is chosen because it has better ESM support than `ts-node-dev`.
- **Assumption:** Plain `tsc` (not vite) is the right builder for a Node Express service even though sibling uses `vite build`. Vite is configured for the agent's bundling needs; a server app does not benefit from it and `tsc` produces cleaner ESM `dist/` output executable directly with `node dist/server.js`.
- **Assumption:** `tsconfig.json` should be self-contained — sibling does not extend a root config and no root tsconfig exists.
- **Assumption:** Adding eslint + prettier configs is in scope because they are part of sibling-app conventions, not new features. If the user considers them out of scope, the planner should be re-spawned.
- **Risk:** Since no install task runs, `pnpm-lock.yaml` will not reflect the new package's deps until the user runs install — `pnpm livekit-server dev` will fail until then. Documented in `README.md`.
- **Risk:** `eslint.config.ts` requires `jiti` to load at runtime; sibling already lists it. The plan declares `jiti` in devDependencies for parity so lint works post-install.

## Open Questions / Blockers

- None. All choices were pre-resolved by the Root Agent.

## Status

- [x] Ready to execute
- [ ] Blocked — requires user input on: n/a

## Task List

| #   | Status | Task                                                                                                                                                                                                                                                                                                                                               | Responsible Role | Dependencies | Skills       |
| --- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------ | ------------ |
| 1   | TODO   | Delete `apps/livekit-server/.gitkeep` so the directory can hold real files cleanly.                                                                                                                                                                                                                                                                | developer        | none         | `clean-code` |
| 2   | TODO   | Create `apps/livekit-server/package.json` with name `livekit-server`, private, version `1.0.0`, `"type": "module"`, sibling-aligned `engines`, scripts (`build`, `clean`, `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `dev`, `start`), and the agreed `dependencies` / `devDependencies` lists. **Do not run any install command.** | developer        | 1            | `clean-code` |
| 3   | TODO   | Create `apps/livekit-server/tsconfig.json` mirroring sibling strict options (`target` ES2022, `module` ES2022, `moduleResolution` bundler, all strict flags, `rootDir: ./src`, `outDir: ./dist`, excludes `dist`/`node_modules`). Self-contained — do not extend any root config.                                                                  | developer        | 1            | `clean-code` |
| 4   | TODO   | Create `apps/livekit-server/.prettierrc` and `.prettierignore` as exact copies of the sibling files at `apps/livekit-agent/.prettierrc` and `apps/livekit-agent/.prettierignore`.                                                                                                                                                                  | developer        | 1            | `clean-code` |
| 5   | TODO   | Create `apps/livekit-server/eslint.config.ts` cloned from sibling `apps/livekit-agent/eslint.config.ts` (flat config with `@eslint/js` + `typescript-eslint` + `globals.node`).                                                                                                                                                                    | developer        | 1            | `clean-code` |
| 6   | TODO   | Create `apps/livekit-server/.gitignore` covering `node_modules/`, `dist/`, `.env`, `.env.*.local`, `*.tsbuildinfo`, `.DS_Store`, and Claude/editor entries consistent with sibling.                                                                                                                                                                | developer        | 1            | `clean-code` |
| 7   | TODO   | Create `apps/livekit-server/.nvmrc` containing `22.18.0` to match sibling.                                                                                                                                                                                                                                                                         | developer        | 1            | `clean-code` |
| 8   | TODO   | Create `apps/livekit-server/.env.example` with only the keys `PORT=` and `NODE_ENV=` (no values, no secrets).                                                                                                                                                                                                                                      | developer        | 1            | `clean-code` |
| 9   | TODO   | Create `apps/livekit-server/src/config/env.ts` exporting a typed `config` object that reads `PORT` (default `3000`, parsed `Number`) and `NODE_ENV` (default `'development'`) from `process.env`. Read keys only.                                                                                                                                  | developer        | 2, 3         | `clean-code` |
| 10  | TODO   | Create `apps/livekit-server/src/utils/async-handler.ts` exporting `asyncHandler(fn)` that returns an Express handler forwarding rejected promises to `next`.                                                                                                                                                                                       | developer        | 2, 3         | `clean-code` |
| 11  | TODO   | Create `apps/livekit-server/src/services/health.service.ts` exporting `getHealthStatus()` returning `{ status: 'ok' as const }`. Pure function, no Express imports.                                                                                                                                                                                | developer        | 2, 3         | `clean-code` |
| 12  | TODO   | Create `apps/livekit-server/src/controllers/health.controller.ts` exporting `healthController(req, res)` that calls the service and responds `res.status(200).json(...)`.                                                                                                                                                                          | developer        | 11           | `clean-code` |
| 13  | TODO   | Create `apps/livekit-server/src/routes/health.route.ts` defining an `express.Router()` with `GET /` → `healthController`, default-exported.                                                                                                                                                                                                        | developer        | 12           | `clean-code` |
| 14  | TODO   | Create `apps/livekit-server/src/routes/index.ts` that mounts the health router at `/health` on a top-level `express.Router()` and exports it as default.                                                                                                                                                                                           | developer        | 13           | `clean-code` |
| 15  | TODO   | Create `apps/livekit-server/src/middlewares/not-found.ts` exporting `notFoundHandler(req, res, next)` that calls `next(createHttpError(404, 'Not Found'))`.                                                                                                                                                                                        | developer        | 2, 3         | `clean-code` |
| 16  | TODO   | Create `apps/livekit-server/src/middlewares/error-handler.ts` exporting `errorHandler(err, req, res, next)` that normalizes via `http-errors`, responds with `{ status, message }`, includes `stack` only when `config.nodeEnv !== 'production'`.                                                                                                  | developer        | 9, 10        | `clean-code` |
| 17  | TODO   | Create `apps/livekit-server/src/app.ts` exporting `createApp()` that builds an `express()` instance, wires middleware in order (`helmet`, `cors`, `morgan('dev')`, `express.json`, `express.urlencoded`), mounts the root router, then registers `notFoundHandler` and `errorHandler`.                                                             | developer        | 14, 15, 16   | `clean-code` |
| 18  | TODO   | Create `apps/livekit-server/src/server.ts` that imports `dotenv/config`, calls `createApp()`, listens on `config.port`, logs the bound port. This is the binary entrypoint referenced by `dev` / `start`.                                                                                                                                          | developer        | 9, 17        | `clean-code` |
| 19  | TODO   | Create `apps/livekit-server/README.md` documenting: folder structure tree, available scripts (`build`/`clean`/`typecheck`/`lint`/`lint:fix`/`format`/`format:check`/`dev`/`start`), required env keys (`PORT`, `NODE_ENV`), and explicit note that user must run `pnpm install` from repo root before first run.                                   | developer        | 2, 8, 18     | `clean-code` |

> **Note:** No tester tasks — user opted out of tests. No install task — user will run `pnpm install` later. All file paths in the Task List resolve under `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/`.
