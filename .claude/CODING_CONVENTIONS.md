# Coding Conventions

## Project Structure

```
call-center-agent/
├── apps/
│   ├── livekit-agent/
│   │   └── src/
│   │       ├── agents/         Agent class, provider factory, instructions
│   │       ├── tools/          LLM tool definitions (zod-validated)
│   │       └── types/          TypeScript declaration files
│   ├── livekit-client/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── atoms/      Smallest UI units (badge, dot, icon)
│   │       │   ├── molecules/  Composed units (card, panel, control bar)
│   │       │   ├── pages/      Full-page components + co-located hooks
│   │       │   ├── providers/  React context providers
│   │       │   └── templates/  Layout wrappers
│   │       ├── configs/        Axios instance, API endpoints, query client
│   │       ├── hooks/
│   │       │   ├── common/     General-purpose hooks
│   │       │   ├── forms/      Form state hooks
│   │       │   ├── mutations/  TanStack Query mutations
│   │       │   ├── queries/    TanStack Query queries
│   │       │   └── stores/     Jotai atom-based stores
│   │       ├── routes/         TanStack Router route files
│   │       └── theme/          MUI theme config
│   ├── livekit-server/
│   │   └── src/
│   │       ├── config/         Env loading (zod-validated)
│   │       ├── controllers/    Express route handlers (class-based)
│   │       ├── middlewares/    Error handler, not-found
│   │       ├── routes/         Express routers
│   │       ├── services/       Business logic (class-based)
│   │       ├── types/          TypeScript declaration files (.d.ts)
│   │       ├── utils/          Pure helpers (logger, response, livekit utils)
│   │       └── validators/     Zod request body schemas
│   └── livekit-infra/          Docker Compose + Nginx + Redis config/templates
├── docs/                       Agent-generated plans and decision docs
└── scripts/                    Shell utility scripts
```

---

## Naming Conventions

| Target                     | Convention                                   | Example                                                 |
| -------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| Files (server/agent)       | `kebab-case` + type suffix                   | `livekit-token.utils.ts`, `error-handler.middleware.ts` |
| Component folders (client) | `PascalCase`                                 | `AgentStatusBadge/`, `CallControlBar/`                  |
| Variables & functions      | `camelCase`                                  | `getToken`, `roomName`                                  |
| Classes                    | `PascalCase`                                 | `LiveKitService`, `LLMAgent`                            |
| Enums                      | `PascalCase` name, `SCREAMING_SNAKE` members | `ProviderType.INFERENCE`                                |
| Types / Interfaces         | `PascalCase`                                 | `GetLiveKitTokenBody`                                   |
| React hooks                | `use` prefix, file named `use*.ts`           | `useAgentCallState.ts`                                  |
| Constants                  | `SCREAMING_SNAKE_CASE`                       | `STATE_CONFIG`, `BASE_URL`                              |

---

## Component File Layout (Atomic Design — client)

Every component lives in its own `PascalCase` folder:

```
ComponentName/
├── index.tsx      Component logic and JSX
├── styled.ts      @emotion/styled wrappers (no inline styles)
├── types.ts       Prop interfaces and local types
└── configs.ts     Static constants / config maps (when needed)
```

Atomic layers (in order of composition):
`atoms/` → `molecules/` → `pages/` → `providers/` → `templates/`

---

## Barrel Exports

Every feature directory exposes an `index.ts` barrel. Import from the barrel, not from sub-files:

```ts
// correct
import { AgentStatusBadge } from '@/components/atoms';

// avoid
import { AgentStatusBadge } from '@/components/atoms/AgentStatusBadge/index';
```

---

## Server Layer Pattern

```
controllers/   Class-based. One public method per endpoint, async RequestHandler.
               Instantiates its own service via private readonly field.
services/      Class-based. Contains all business logic.
               Instantiates utils via private readonly fields.
routes/        Express Router only — no logic. Wires controller methods.
middlewares/   Global error handler and not-found handler.
validators/    Zod schemas for request body validation.
utils/         Pure, stateless helper functions.
config/        Single loadConfig() that validates env with Zod and returns typed config.
types/         TypeScript ambient declaration files (.d.ts).
```

---

## TypeScript Rules (all apps)

- `strict: true` — no implicit `any`, strict null checks
- `exactOptionalPropertyTypes: true` — optional props cannot be `undefined` unless declared
- `noUncheckedIndexedAccess: true` — array/object index access returns `T | undefined`
- `noImplicitReturns: true` — all code paths must return
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- Target: `ES2022`, `moduleResolution: bundler`

---

## Formatting (Prettier — root config)

- Single quotes
- Trailing commas everywhere (`"all"`)
- Semicolons: **on**
- Tab width: **2**
- Print width: **100**
- Import order: third-party modules first, then local (`./`) — auto-sorted by `@trivago/prettier-plugin-sort-imports`

---

## State Management (client)

| Concern               | Tool                            | Location                             |
| --------------------- | ------------------------------- | ------------------------------------ |
| Server/async state    | TanStack Query                  | `hooks/queries/`, `hooks/mutations/` |
| Global UI state       | Jotai atoms                     | `hooks/stores/`                      |
| Form state            | Custom hooks                    | `hooks/forms/`                       |
| Component-local state | React `useState` / `useReducer` | inline in component                  |

---

## Data Fetching (client)

- Axios instance defined once in `configs/axiosInstance.ts`. Never create ad-hoc axios instances.
- All API endpoint strings live in `configs/apiEndpoints.ts`.
- Base URL sourced from `VITE_API_BASE_URL` env var — throws at startup if missing.

---

## Agent Provider Pattern

LLM / STT / TTS providers are registered in typed registry maps in `agents/provider.ts`.
Select a provider via the `ProviderType` enum and `providerFactory.llm/stt/tts()`.
Never instantiate provider classes directly outside of the registry.

---

## Logging (server)

Use the Pino logger from `utils/logger.utils.ts`. Do not use `console.log` in server code.

---

## Validation

- Server: Zod schemas in `validators/`. Validate at the route/middleware level before controllers.
- Agent tools: Zod schemas inline in tool definitions.
- Client env vars: validated at module load time in `configs/` files (throw on missing).

---

## Error Handling

- Server: centralized error handler middleware (`middlewares/error-handler.middleware.ts`).
  Use `http-errors` to create typed HTTP errors inside controllers/services.
- Client: TanStack Query handles async error state. Surface errors via query/mutation `error` fields.
- Never swallow errors silently.

---

## Docs & Planning

Agent-generated plan files, decision records, and scaffolding docs go in `docs/` at the repo root.
File name format: `DD-MM-YYYY-HH-MM-SS-short-description.md`
