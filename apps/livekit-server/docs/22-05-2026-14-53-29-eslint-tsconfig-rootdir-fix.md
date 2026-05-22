- From: debugger
- To: Root Agent
- Title: Plan Response — Fix typescript-eslint "multiple candidate TSConfigRootDirs" parser error in both apps
- Description: Explicitly set `tsconfigRootDir` (and pin `project`/`projectService`) in each app's `eslint.config.ts` so typescript-eslint stops walking up the filesystem and unambiguously binds each app to its own `tsconfig.json`.

---

## Approach Summary

- **Root cause (not just the symptom):** Both `apps/livekit-server/eslint.config.ts` and `apps/livekit-agent/eslint.config.ts` enable `tseslint.configs.recommended` without passing any `parserOptions`. In typescript-eslint v8, the default parser tries to auto-discover a TSConfig root by walking *upward* from each file until it finds a `tsconfig.json`. Because the user runs eslint from the **repo root** (e.g. `pnpm livekit-server lint` resolves cwd to the package, but file globs and the parser's discovery walk consider sibling workspace paths once eslint's flat-config evaluator inspects `import.meta.url`/`process.cwd()` and the parser tries to anchor a root for typed linting), the walk discovers *two* sibling roots that are equally valid candidates: `apps/livekit-server/tsconfig.json` and `apps/livekit-agent/tsconfig.json`. There is no root `tsconfig.json` to disambiguate, and neither flat config sets `languageOptions.parserOptions.tsconfigRootDir`, so the parser refuses to guess and emits the `multiple candidate TSConfigRootDirs` parsing error. The error is symmetric — it will also fire from the agent app once the parser revisits — so both configs must be patched, not just the new one.
- **Fix strategy:** In each app's `eslint.config.ts`, scope a TypeScript-only block that sets `languageOptions.parserOptions.tsconfigRootDir = import.meta.dirname` and `parserOptions.project = './tsconfig.json'` (or `projectService: true`, see Risks). This pins the parser deterministically to the *current* app directory and stops the upward walk, exactly as the linked typescript-eslint guidance (https://tseslint.com/parser-tsconfigrootdir) prescribes. The change is local, minimal, and preserves both apps' existing behaviour.
- **Why `import.meta.dirname` and not a hardcoded path:** The configs are ESM (`"type": "module"` in both `package.json`s), so `import.meta.dirname` (Node ≥ 22, which the `engines.node` field already mandates) resolves to the absolute directory of the config file itself. This is portable across machines, CI, and any cwd the user runs eslint from. Hardcoded relative paths like `__dirname` (CJS-only) or `'.'` would re-introduce the cwd ambiguity that caused the bug.
- **Verification (manual — tests skipped per Skip-Testing rule):** From the repo root, run `pnpm livekit-server lint` and `pnpm livekit-agent lint`. Both must exit 0 with no parser errors. Also run `pnpm livekit-server lint:fix` and `pnpm livekit-agent lint:fix` to confirm typed rules still load. Confirm via `eslint --print-config apps/livekit-server/src/server.ts` that the resolved config shows `parserOptions.tsconfigRootDir` pointing to `apps/livekit-server` and not `apps/livekit-agent`.

## Functional Requirements

- `pnpm livekit-server lint` exits 0 with no `Parsing error: No tsconfigRootDir was set` and no `multiple candidate TSConfigRootDirs` messages.
- `pnpm livekit-agent lint` continues to exit 0 with no parser errors (regression guard for the previously-working app).
- `eslint --print-config <any .ts file in apps/livekit-server/src>` shows `languageOptions.parserOptions.tsconfigRootDir` ending in `/apps/livekit-server`.
- `eslint --print-config <any .ts file in apps/livekit-agent/src>` shows `languageOptions.parserOptions.tsconfigRootDir` ending in `/apps/livekit-agent`.
- Each app's parser resolves its own `tsconfig.json` (the one in the same directory), not the sibling's.
- No change to the `lint` / `lint:fix` script strings in either `package.json` is required to make the fix work (and none is planned).

## Non-Functional Requirements

- **Minimal & local:** Only the two `eslint.config.ts` files are touched. No new files, no new dependencies, no `tsconfig` restructuring, no root config introduced.
- **Convention parity:** The fix is applied identically in both apps so the configs remain mirror images (matches the sibling-app convention rule).
- **Forward-compatible:** Using `import.meta.dirname` aligns with ESM-first typescript-eslint v8 guidance and Node ≥ 22 (already pinned via `engines`).
- **Clean-code (Separation of Concerns):** The TypeScript-specific `parserOptions` block is scoped via a `files: ['**/*.{ts,mts,cts}']` matcher so the JS-only rules block stays untouched.
- **Verification (since tests are skipped):** Manual commands documented above must be run by the user/developer after the fix lands. Capture exit codes and `--print-config` output in the PR description or commit body as the regression evidence.
- **DRY caveat:** The same parserOptions block is duplicated across both apps. This is acceptable because the project explicitly avoids a root eslint config (sibling-app convention); extracting a shared file would exceed the user's "minimal & local" constraint. Documented under Risks.

## Files in Scope

Modified:

- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/eslint.config.ts`
- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-agent/eslint.config.ts`

Created / Deleted:

- None.

## Risks & Assumptions

- **Constraint trade-off surfaced:** Project Testing Workflow is `Skip-Testing` and the user explicitly opted out of tests for `apps/livekit-server`. The debugger skill mandates a regression test — the project rule overrides. Verification is therefore manual via the eslint commands listed in `Non-Functional Requirements`. Risk: a future config change could silently re-introduce the bug without an automated guard. Mitigation: the developer task includes adding a brief inline comment in each `eslint.config.ts` explaining *why* `tsconfigRootDir` is set, so future edits do not strip it.
- **Assumption — `project: './tsconfig.json'` vs `projectService: true`:** The current configs use `tseslint.configs.recommended` (non-type-checked rules). Strictly speaking, only `tsconfigRootDir` is required to suppress the parser error. However, the typescript-eslint guidance recommends pairing `tsconfigRootDir` with `project` (or `projectService`) to make the binding fully explicit and future-proof if type-checked rules are added later. The plan sets both: `tsconfigRootDir: import.meta.dirname` and `project: './tsconfig.json'`. If the user prefers the more modern `projectService: true` (auto-discovery scoped under `tsconfigRootDir`), swap it in — both work; `project` is chosen for explicitness.
- **Assumption — `import.meta.dirname` is available:** Both apps' `engines.node` is `>=22.0.0`. `import.meta.dirname` shipped in Node 20.11 / 21.2, so this is safe.
- **Risk — TypeScript-only scoping:** The new `parserOptions` block must apply *only* to `.ts/.mts/.cts` files. Applying it to `.js` files would cause typescript-eslint to attempt to parse JS against a tsconfig that excludes them. The plan adds an explicit `files: ['**/*.{ts,mts,cts}']` matcher on the new block.
- **Risk — both apps must be patched together:** Patching only the new `apps/livekit-server` would not fix the symmetric failure when running `pnpm livekit-agent lint` (the parser walks up from agent files and still sees two candidates). Both tasks must ship in the same change.
- **Backward-compat risk — low:** Existing `tseslint.configs.recommended` rules continue to run unchanged. The only behavioural delta is that the parser now knows where to look — no rule severity or rule set is altered.
- **Out of scope:** Introducing a root `tsconfig.json`, restructuring to a shared `eslint.config.base.ts`, or pinning `tsconfigRootDir` in unrelated places — explicitly forbidden by the constraints. Not planned.

## Open Questions / Blockers

- None. The root cause is unambiguous, the fix is documented by typescript-eslint upstream, and all required project context (engines, ESM, sibling tsconfig layout, Skip-Testing override) was supplied in the delegation.

## Status

- [x] Ready to execute
- [ ] Blocked — requires user input on: n/a

## Task List

| # | Status | Task | Responsible Role | Dependencies | Skills |
| --- | --- | --- | --- | --- | --- |
| 1 | TODO | Edit `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/eslint.config.ts` to add a TypeScript-scoped block immediately before `tseslint.configs.recommended` that sets `files: ['**/*.{ts,mts,cts}']` and `languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname, project: './tsconfig.json' } }`. Add an inline comment above the block: `// Pin tsconfigRootDir so typescript-eslint does not walk up and discover sibling app tsconfigs (see https://tseslint.com/parser-tsconfigrootdir).` Leave the existing JS-recommended block and `tseslint.configs.recommended` reference unchanged. | developer | none | `clean-code` |
| 2 | TODO | Edit `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-agent/eslint.config.ts` with the identical TypeScript-scoped block from task 1 (same `files`, same `parserOptions`, same comment). Both configs must end up as mirror images to preserve sibling-app convention parity and prevent the symmetric failure when linting the agent app. | developer | none | `clean-code` |
| 3 | TODO | Manual verification (developer runs, captures output in PR/commit body): (a) `pnpm livekit-server lint` exits 0 with no parser errors; (b) `pnpm livekit-agent lint` exits 0 with no parser errors; (c) `pnpm --filter livekit-server exec eslint --print-config src/server.ts | grep -A2 tsconfigRootDir` shows the server's own directory; (d) `pnpm --filter livekit-agent exec eslint --print-config src/<any .ts> | grep -A2 tsconfigRootDir` shows the agent's own directory. No unit test added — `Skip-Testing` per project rule. | developer | 1, 2 | `clean-code` |

> **Note:** No tester task. The mandatory regression test from the debugger skill is consciously waived because the project's Testing Workflow is `Skip-Testing` (recorded in `.claude/PROJECT_OVERVIEW.md`) and the delegation explicitly instructed the debugger to substitute a documented manual eslint command run. The trade-off is surfaced under `Risks & Assumptions`. All file paths are absolute.
