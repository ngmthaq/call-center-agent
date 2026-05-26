# Plan — Fix 4 Open Code-Quality Items

## Approach

Add `pino` to the server, create a singleton logger utility, fix the dead async try/catch in `WebhookController`, replace all `console.*` calls with structured logging, replace the three switch-based provider factories with OCP-compliant registry maps, and extract the three `useMemo` agent-state derivations into a hook at `HomePage/hooks/useAgentCallState.ts`.

## Functional Requirements

- `WebhookController.receive` must correctly propagate async errors to `next()` via `responseHandler`
- No `console.log` / `console.error` remaining in `livekit-server` source
- Adding a new LiveKit provider only requires adding one entry per applicable registry map — not editing `switch` statements
- `HomePage` renders using `useAgentCallState()` hook; derived state logic lives outside the component

## Non-Functional Requirements

- All TypeScript strict rules continue to pass (`verbatimModuleSyntax`, `noUncheckedIndexedAccess`, etc.)
- No new public API surface — changes are internal refactors only
- Pino v9 is ESM-compatible with the server's `"type": "module"` setup

## Files in Scope

| File                                                                           | Change                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------- |
| `apps/livekit-server/package.json`                                             | Add `pino` to dependencies                        |
| `apps/livekit-server/src/utils/logger.ts`                                      | Create — singleton pino logger                    |
| `apps/livekit-server/src/controllers/webhook.controller.ts`                    | Make `receive` async, remove dead try/catch       |
| `apps/livekit-server/src/services/webhook.service.ts`                          | Replace `console.log` with `logger.info`          |
| `apps/livekit-server/src/server.ts`                                            | Replace `console.log` in listen callback          |
| `apps/livekit-agent/src/agents/provider.ts`                                    | Replace 3 switch factories with registry maps     |
| `apps/livekit-client/src/components/pages/HomePage/hooks/useAgentCallState.ts` | Create — new `hooks/` subfolder + hook            |
| `apps/livekit-client/src/components/pages/HomePage/index.tsx`                  | Consume hook, remove inline `useMemo` derivations |

## Task List

| #   | Task                                                                                                                                                       | Role      | Depends On |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- | ---- |
| 1   | Add `pino` to `apps/livekit-server/package.json` + run `pnpm install --filter livekit-server`                                                              | developer | —          | DONE |
| 2   | Create `apps/livekit-server/src/utils/logger.ts` — singleton pino instance, level from `config.nodeEnv`                                                    | developer | 1          | DONE |
| 3   | Update `webhook.service.ts` — replace `console.log` with `logger.info({ event, room }, msg)`                                                               | developer | 2          | DONE |
| 4   | Update `webhook.controller.ts` — make `receive` async, remove dead try/catch entirely                                                                      | developer | 2          | DONE |
| 5   | Update `server.ts` — replace `console.log` in listen callback with `logger.info({ port }, msg)`                                                            | developer | 2          | DONE |
| 6   | Refactor `provider.ts` — replace `llmFactory`, `sttFactory`, `ttsFactory` switches with `LLM_REGISTRY`, `STT_REGISTRY`, `TTS_REGISTRY` partial record maps | developer | —          | DONE |
| 7   | Create `HomePage/hooks/useAgentCallState.ts` — hook returning `agent`, `connectionState`, `isPending`, `hasFailure`, `isFinishedClean`                     | developer | —          | DONE |
| 8   | Update `HomePage/index.tsx` — consume `useAgentCallState`, remove `useConnectionState` + `useMemo` blocks + `ConnectionState` import                       | developer | 7          | DONE |

## Risks & Assumptions

- `pino` v9 ships its own types — no `@types/pino` needed
- `pino` v9 is ESM-compatible with the server's `"type": "module"` setup
- `Partial<Record<ProviderType, ...>>` + `noUncheckedIndexedAccess` requires a `=== undefined` guard before calling each factory
- `useAgent()` and `useConnectionState()` move fully into the hook; `HomePage` destructures `{ agent, connectionState, isPending, hasFailure, isFinishedClean }`
- No barrel `index.ts` needed for `hooks/` — internal implementation detail of `HomePage`
