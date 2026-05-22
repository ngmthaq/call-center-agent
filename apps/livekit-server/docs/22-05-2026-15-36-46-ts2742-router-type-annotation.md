- From: debugger (sub-agent loaded with party-mode debugger skill)
- To: Root Agent
- Title: Plan Response — Fix TS2742 by adding explicit `Router` annotations to Express routers
- Description: Add an explicit `Router` type annotation to every `const router = ...Router()` declaration in `apps/livekit-server/src/routes/` so declaration emit no longer references the pnpm-flattened `@types/express-serve-static-core` path.

---

## Approach Summary

TypeScript's TS2742 fires when `declaration: true` is on and `tsc` tries to emit a `.d.ts` for a value whose inferred type lives in a transitive package that cannot be reached via the public module graph. `express.Router()` returns `Router<...>` from `@types/express-serve-static-core` — a transitive type of `@types/express` — and pnpm's `.pnpm/@types+express-serve-static-core@5.1.1/...` path is not portable. The fix is mechanical and minimal: annotate each `router` with the `Router` type imported from `'express'` (which re-exports it from the deep package via a stable name), turning the inferred-type reference into an explicit, nameable one. We touch only the two router files that actually trigger the error and preserve each file's existing import style.

## Functional Requirements

- `pnpm --filter livekit-server build` completes with zero TypeScript errors (TS2742 in particular is gone).
- Both router files still default-export the same `router` instance with the same routes and behavior — no functional change.
- Each `const router = ...Router()` has an explicit `: Router` annotation, and `Router` is imported as a type from `'express'` in the same file.

## Non-Functional Requirements

- Match each file's existing import style. Do not refactor unrelated imports.
- Do not rename `router` or change route handlers, paths, or export shape.
- Keep imports consistent with project conventions (`@trivago/prettier-plugin-sort-imports` and ESLint flat config are configured — the dev/reviewer should run `lint`/`format` if the edits perturb import ordering, but the change is intentionally minimal).
- `verbatimModuleSyntax: true` is set in tsconfig — `Router` used purely as a type must be imported via `import type` (or inline `import { type Router }`) to satisfy this rule.

## Files in Scope

- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/src/routes/health.route.ts` (modify)
- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/src/routes/index.ts` (modify)

No new files. No deletions. No other source files in the repo declare a router instance.

### Exact edits (for the developer)

**`apps/livekit-server/src/routes/health.route.ts`** — current import style is `import * as express from 'express';`. Add a type-only `Router` import and annotate:
```ts
import * as express from 'express';
import type { Router } from 'express';
import { healthController } from '../controllers/health.controller.js';

const router: Router = express.Router();

router.get('/', healthController);

export default router;
```

**`apps/livekit-server/src/routes/index.ts`** — current import style is `import { Router } from 'express';` (value import). Keep the import as-is; `Router` is used as both a value (`Router()`) and a type (`: Router`), so a single named import is sufficient and compatible with `verbatimModuleSyntax`:
```ts
import { Router } from 'express';
import healthRouter from './health.route.js';

const router: Router = Router();

router.use('/health', healthRouter);

export default router;
```

Note for the developer: in `health.route.ts`, `Router` is used only as a type, so under `verbatimModuleSyntax: true` it must be `import type { Router }` (or `import { type Router }`). In `index.ts`, `Router` is also called as a value, so a plain named import is correct.

## Risks & Assumptions

- **Skip-Testing project setting:** per `.claude/PROJECT_OVERVIEW.md`, Testing Workflow = `Skip-Testing`. This explicitly waives the debugger skill's "regression test mandatory" rule for this plan — no tester task is included. Verification is a clean `tsc` compile, performed by the reviewer.
- **Verification command (for reviewer):** `pnpm --filter livekit-server build` (i.e., `tsc -p tsconfig.json` in `apps/livekit-server`). This is the authoritative check because TS2742 is a declaration-emit diagnostic and `declaration: true` is set in `apps/livekit-server/tsconfig.json`. `pnpm --filter livekit-server typecheck` (`tsc --noEmit`) is a useful secondary check but may not surface every emit-only diagnostic — prefer `build`.
- **Enumeration is exhaustive:** `grep -rn "Router()" apps` returned exactly two matches (both listed above). No other workspace app (`livekit-agent`, `livekit-client`) uses Express or `Router`. If new router files are added later, they will need the same annotation.
- **Import-ordering risk:** `@trivago/prettier-plugin-sort-imports` may reorder the new `import type { Router }` line in `health.route.ts`. If the developer's editor or pre-commit hook runs Prettier, the final order may differ from the snippet above — that's expected and acceptable.
- **`verbatimModuleSyntax: true`:** noted above; if the developer writes `import { Router } from 'express'` in `health.route.ts` without using it as a value, TS will error. The snippet uses `import type` to avoid this.
- **No behavior change:** route paths, middleware chain in `app.ts`, and default-export shape are untouched. `app.use(router)` in `app.ts` continues to receive a `Router` — annotation is structurally identical to the inferred type, just nameable.
- **Confirmed no broader root cause:** every `from 'express'` import in the server was checked; no other call site reintroduces an unnameable inferred type (controllers, middlewares, and `async-handler` use `RequestHandler` / `Request` / `Response` / `NextFunction` / `ErrorRequestHandler` directly, all of which are already nameable). The only other inferred-type risk would be a factory returning a `Router` without annotation, and there is no such factory in the codebase today.

## Open Questions / Blockers

- None. The enumeration is exhaustive, the root cause is confirmed (declaration emit + pnpm-flattened types), and the fix is mechanical.

## Status

- [x] Ready to execute
- [ ] Blocked — requires user input on: n/a

## Task List

| #   | Status | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Responsible Role | Dependencies | Skills       |
| --- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------ | ------------ |
| 1   | DONE   | Edit `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/src/routes/health.route.ts`: add `import type { Router } from 'express';` after the existing `import * as express from 'express';` line, and change `const router = express.Router();` to `const router: Router = express.Router();`. Do not touch any other line. Preserve `import * as express from 'express';` exactly (do not switch to default import) to match the file's existing style.                                                          | developer        | none         | `clean-code` |
| 2   | DONE   | Edit `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/src/routes/index.ts`: keep the existing `import { Router } from 'express';` line as-is (it is both a value and a type import — no `import type` needed), and change `const router = Router();` to `const router: Router = Router();`. Do not touch any other line.                                                                                                                                                                                       | developer        | none         | `clean-code` |
| 3   | DONE   | Reviewer verification (no code change): from the repo root, run `pnpm --filter livekit-server build` and confirm it exits 0 with no TS2742 diagnostic and no new errors. Secondary sanity check: `pnpm --filter livekit-server typecheck`. If either fails, loop back to the debugger with the new error output. Note: per `.claude/PROJECT_OVERVIEW.md` Testing Workflow = `Skip-Testing`, so no regression test is added — a clean `tsc` build is the acceptance criterion.                                                            | reviewer         | tasks 1, 2   | `clean-code` |

> Tasks 1 and 2 are independent and may be performed in either order or as a single combined edit pass. Task 3 must follow both.

### Critical Files for Implementation

- /Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/src/routes/health.route.ts
- /Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/src/routes/index.ts
- /Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/tsconfig.json
- /Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/package.json
