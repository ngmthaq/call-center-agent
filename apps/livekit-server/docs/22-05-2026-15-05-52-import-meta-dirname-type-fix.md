- From: debugger
- To: Root Agent
- Title: Plan Response — Fix `Property 'dirname' does not exist on type 'ImportMeta'` in both apps' `eslint.config.ts`
- Description: Add a triple-slash `/// <reference types="node" />` directive at the top of each `eslint.config.ts` so the IDE's free-floating TypeScript service loads `@types/node`, which carries the `ImportMeta.dirname` augmentation — preserving runtime behaviour and keeping the change strictly local to the two config files.

---

## Approach Summary

- **Root cause (not the symptom):** `import.meta.dirname` is a Node ≥ 20.11 / 22 runtime property whose **type** is declared in `@types/node@22.19.19` at `module.d.ts:633` via `declare module "module" { ... global { interface ImportMeta { dirname: string; ... } } }`. The augmentation is reachable only when something in the program causes `@types/node` to be loaded. Both `eslint.config.ts` files import only `@eslint/js`, `eslint/config`, `globals`, and `typescript-eslint` — none of which pull in `@types/node` — and **neither file is covered by its app's `tsconfig.json`** (both tsconfigs set `include: ["./src/**/*"]`, while `eslint.config.ts` lives at the package root). Therefore the editor's TypeScript service treats `eslint.config.ts` as a free-floating ("inferred") project: it loads the default lib (`lib.es2020.full.d.ts`), which declares `interface ImportMeta { url: string }` only — no `dirname`. Result: `Property 'dirname' does not exist on type 'ImportMeta'`. The `tsc --noEmit` typecheck script never trips this because the file is excluded from the project; the error comes purely from the IDE service.
- **Why the previous eslint fix did not foresee this:** The previous plan (`docs/22-05-2026-14-53-29-eslint-tsconfig-rootdir-fix.md`) correctly added `tsconfigRootDir: import.meta.dirname` to suppress the typescript-eslint parser error, and the runtime is fine (Node 22 supports it). The plan didn't extend the tsconfig include / set `types: ["node"]` because the file isn't typechecked by `tsc`. The remaining gap is the IDE-only type error.
- **Fix strategy (minimal, sibling-consistent):** Add one line — `/// <reference types="node" />` — as the first line of each `eslint.config.ts`. This triple-slash directive instructs the TypeScript service (both `tsc` and editor LSP) to load `@types/node` for *this file specifically*, which pulls in the `ImportMeta` augmentation and resolves `import.meta.dirname` to `string`. No tsconfig change, no new dependency (both apps already pin `@types/node@^22.19.17`), no eslint-config restructuring, no behaviour change.
- **Why not the alternatives (briefly — see Risks for full discussion):**
  - **Alt A: set `"types": ["node"]` in tsconfig** — would force-load `@types/node` globals, but the file is still outside `include`, so the editor's inferred-project would *still* not pick this up unless we also add `eslint.config.ts` to `include`. That's two changes vs. one.
  - **Alt B: add `eslint.config.ts` to `include`** — pulls the config into the build program; `tsc --noEmit` would then typecheck it, but `tsc -p tsconfig.json` (the `build` script) would *emit* `eslint.config.js` into `dist/` (since `rootDir: "./src"` would then mismatch). Risk of build regression. Reject.
  - **Alt C: swap to `fileURLToPath(import.meta.url) → path.dirname(...)`** — works but requires two extra imports, doubles the LOC, and is precisely the pre-Node-20.11 pattern that `import.meta.dirname` was designed to replace. Loses the simplification gain of the previous fix.
  - **Alt D: add a separate `tsconfig.eslint.json` covering `eslint.config.ts` with `types: ["node"]`** — over-engineered for one line of types; introduces a sibling-divergence opportunity. Reject under the "minimal & local" constraint.
- **Verification (manual — `Skip-Testing`):** From the repo root, run `pnpm livekit-server typecheck`, `pnpm livekit-agent typecheck`, `pnpm livekit-server lint`, and `pnpm livekit-agent lint`. All four must exit 0. Re-open both `eslint.config.ts` files in the editor and confirm no red squiggle on `import.meta.dirname`; hover should show type `string`.

## Functional Requirements

- `apps/livekit-server/eslint.config.ts` compiles cleanly under both the IDE TypeScript service and `tsc --noEmit` (if added to a program); `import.meta.dirname` resolves to type `string`.
- `apps/livekit-agent/eslint.config.ts` compiles cleanly the same way.
- `pnpm livekit-server typecheck` exits 0 (unchanged — file remains outside `include`, so this is a no-op for `tsc`, but is the documented verification step in the constraints).
- `pnpm livekit-agent typecheck` exits 0.
- `pnpm livekit-server lint` exits 0 with no parser errors (regression guard for the previous fix).
- `pnpm livekit-agent lint` exits 0 with no parser errors (regression guard).
- Editor TypeScript service reports no error on `tsconfigRootDir: import.meta.dirname` in either file.
- Runtime behaviour of both eslint configs is unchanged; `import.meta.dirname` continues to resolve at runtime to the absolute directory of each config file (Node ≥ 22, already pinned by both `engines.node`).

## Non-Functional Requirements

- **Minimal & local:** Only the first line of each of the two `eslint.config.ts` files is added (one triple-slash directive). No new files, no tsconfig edits, no dependency additions, no script changes.
- **Sibling-app convention:** The same directive is added identically to both apps; the two `eslint.config.ts` files remain mirror images. The two `tsconfig.json` files remain byte-identical (already are, per Read above).
- **Clean-code (KISS):** One line, idiomatic TypeScript, well-known pattern. No abstraction premature, no shared base config introduced.
- **Forward-compatible:** `@types/node@22.x` is already pinned in both apps' `devDependencies`. Both apps' `engines.node` is `>=22.0.0`, where `import.meta.dirname` is a stable runtime feature.
- **Documentation:** Add a brief inline comment after the directive in each file explaining *why* the reference is needed, so a future edit does not strip it (mirrors the pattern from the previous eslint fix's `tsconfigRootDir` comment).

## Files in Scope

Modified:

- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/eslint.config.ts`
- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-agent/eslint.config.ts`

Created / Deleted:

- None.

Out of scope (explicitly not touched):

- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/tsconfig.json`
- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-agent/tsconfig.json`
- Both apps' `package.json` files.
- Any root-level config.

## Risks & Assumptions

- **Assumption — error source is the IDE TypeScript service, not the `typecheck` script.** Verified by inspection: both apps' `tsconfig.json` set `include: ["./src/**/*"]`, and `eslint.config.ts` lives at the package root (outside `src/`). `pnpm <app> typecheck` is `tsc --noEmit`, which uses the project's `tsconfig.json` and therefore never sees `eslint.config.ts`. The error the user observes must therefore come from an editor TS service running a free-floating program on the file. If the user is in fact seeing this from a different command (e.g. a hidden CI step that includes the file), please specify — the fix below (triple-slash) still resolves it, but a different alternative may become preferable.
- **Risk — both files must be patched.** Patching only `apps/livekit-server/eslint.config.ts` would leave the agent app's identical error unresolved. Both edits ship together (one task per app).
- **Risk — `@types/node` version drift.** Both apps currently pin `@types/node: "^22.19.17"`. The installed resolved version is `22.19.19`, which contains `ImportMeta.dirname` (verified at `node_modules/@types/node/module.d.ts:633`). If `@types/node` is ever downgraded below v20.11.0 (when the augmentation was introduced), the directive will resolve to a Node type set without `dirname` and the error will return. Mitigation: the inline comment notes the version requirement.
- **Risk — directive ordering.** `/// <reference ... />` must appear before any non-trivia tokens (including `import` statements). The plan places it as line 1. Any future contributor who moves it below the imports will silently re-break typing.
- **Alternative considered — `"types": ["node"]` in tsconfig (Alt A):** Rejected. Doesn't help the IDE inferred-project since the file is still outside `include`. Would also be invasive (changes tsconfig, which affects all `src/` files' type resolution by force-restricting `types` — currently undeclared, which means TS auto-includes everything in `node_modules/@types`).
- **Alternative considered — add `eslint.config.ts` to `include` (Alt B):** Rejected. Pulling the config into the build program risks `tsc -p tsconfig.json` (the `build` script in `apps/livekit-server/package.json`) emitting `eslint.config.js` into `dist/` and/or tripping the `rootDir: "./src"` constraint. Not minimal.
- **Alternative considered — switch to `fileURLToPath(import.meta.url)` + `path.dirname(...)` (Alt C):** Rejected. Three additional lines (two imports + a helper call), reverts the simplification the previous fix introduced, and does not actually fix the type-system layout problem — it merely sidesteps the missing `ImportMeta` augmentation by using `import.meta.url` (which *is* in the default `lib.es2020.full.d.ts` `ImportMeta`). Acceptable as a fallback if the user rejects the triple-slash approach.
- **Alternative considered — separate `tsconfig.eslint.json` (Alt D):** Rejected as over-engineered for a single config file.
- **Constraint trade-off — `Skip-Testing`.** The debugger skill mandates a regression test. The project's Testing Workflow is `Skip-Testing` and the delegation explicitly waives it. Verification is therefore manual via the four commands listed in `Functional Requirements`. Risk: a future contributor could remove the directive without an automated guard. Mitigation: inline comment in each file explaining the directive's purpose.
- **Vite caveat (agent app only):** `apps/livekit-agent/` also has `vite.config.ts` at the package root, which likely uses `defineConfig` and possibly `import.meta.dirname` indirectly. It is **not** in scope for this fix (no error reported on it), but if the user later sees the same error there, the identical one-line fix applies. Surfaced for awareness, not action.
- **Backward-compat risk — none.** The directive is a compile-time TypeScript hint; it produces no JS output and changes no rule severity.

## Open Questions / Blockers

- **None blocking.** Root cause is unambiguous, fix is documented by TypeScript upstream, and all required project context was supplied in the delegation or verified during planning.

## Status

- [x] Ready to execute
- [ ] Blocked — requires user input on: n/a

## Task List

| # | Status | Task | Responsible Role | Dependencies | Skills |
| --- | --- | --- | --- | --- | --- |
| 1 | TODO | Edit `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/eslint.config.ts` to insert two new lines at the very top of the file (before any existing `import` statements): line 1 = `/// <reference types="node" />` and line 2 = `// Pulls in @types/node so ImportMeta.dirname (Node >=20.11) is typed. Required because this file lives outside tsconfig's "include" and is type-checked by the IDE service as an inferred project.` Preserve every existing line below unchanged (including the existing `// Pin tsconfigRootDir ...` comment block from the previous fix). | developer | none | `clean-code` |
| 2 | TODO | Edit `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-agent/eslint.config.ts` with the **identical** two-line prepend from task 1 (same directive, same comment text). Both configs must remain mirror images per sibling-app convention so the same fix continues to apply if either file is later regenerated. | developer | none | `clean-code` |
| 3 | TODO | Manual verification (developer runs, captures output in PR/commit body — no automated test added per `Skip-Testing` project rule): (a) `pnpm livekit-server typecheck` exits 0; (b) `pnpm livekit-agent typecheck` exits 0; (c) `pnpm livekit-server lint` exits 0 with no parser errors (regression guard for previous eslint fix); (d) `pnpm livekit-agent lint` exits 0 with no parser errors; (e) re-open both `eslint.config.ts` files in the editor and confirm no red squiggle on `import.meta.dirname` and hover shows type `string`. Do **not** run `pnpm install` (per constraint). | developer | 1, 2 | `clean-code` |

> **Note:** No tester task. The debugger skill's mandatory regression-test rule is consciously waived because the project's Testing Workflow is `Skip-Testing` and the delegation explicitly substitutes manual `typecheck` + `lint` runs as verification. The trade-off is surfaced under `Risks & Assumptions`.
