# Coding Conventions

## Project Structure (Tree)

```
call-center-agent/               ← pnpm workspace root
├── apps/
│   ├── livekit-agent/           ← Voice AI agent (TypeScript + Vite + Node.js)
│   │   └── src/
│   │       ├── agents/          ← Agent class, instructions, provider factory
│   │       ├── tools/           ← LLM tool definitions (one file per tool)
│   │       ├── types/           ← Global type declarations (*.d.ts)
│   │       └── main.ts
│   ├── livekit-server/          ← Express.js API server (TypeScript + tsc)
│   │   └── src/
│   │       ├── config/          ← Environment loading (env.ts)
│   │       ├── controllers/     ← Request handlers (class-based)
│   │       ├── middlewares/     ← Express middleware (error-handler, not-found)
│   │       ├── routes/          ← Router definitions
│   │       ├── services/        ← Business logic (class-based)
│   │       ├── types/           ← Global type declarations (*.d.ts)
│   │       ├── utils/           ← Pure utility functions
│   │       ├── validators/      ← Zod request body schemas
│   │       ├── app.ts
│   │       └── server.ts
│   ├── livekit-client/          ← React 18 + Vite frontend (TypeScript)
│   │   └── src/
│   │       ├── components/
│   │       │   ├── atoms/       ← Smallest UI primitives
│   │       │   ├── molecules/   ← Composed atoms
│   │       │   ├── pages/       ← Full page components
│   │       │   ├── providers/   ← React context providers
│   │       │   └── templates/   ← Layout skeletons
│   │       ├── configs/         ← App-level config (API endpoints, axios instance, query client)
│   │       ├── hooks/
│   │       │   ├── common/      ← General-purpose custom hooks
│   │       │   ├── forms/       ← Form-related hooks
│   │       │   ├── mutations/   ← TanStack Query mutation hooks
│   │       │   ├── queries/     ← TanStack Query query hooks
│   │       │   └── stores/      ← Jotai atom/state hooks
│   │       ├── routes/          ← TanStack Router file-based routes
│   │       └── theme/           ← MUI theme
│   └── livekit-infra/           ← Docker Compose infra (dev + prod profiles)
├── docs/                        ← Agent-generated plan files
├── scripts/                     ← Workspace-level shell scripts
├── .prettierrc                  ← Shared Prettier config
├── package.json                 ← Workspace root (pnpm scripts)
└── pnpm-workspace.yaml
```

---

## Formatting (Prettier)

- **Single quotes** (`singleQuote: true`)
- **Semicolons** (`semi: true`)
- **2-space indent** (`tabWidth: 2`)
- **100-char print width** (`printWidth: 100`)
- **Trailing commas everywhere** (`trailingComma: "all"`)
- **Import order**: third-party modules first, then local imports — no blank line between groups (via `@trivago/prettier-plugin-sort-imports`)

---

## TypeScript

- **Strict mode** enabled in all apps, plus: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`
- **`verbatimModuleSyntax`** is on — always use `import type { ... }` for type-only imports
- **`allowJs: false`** — TypeScript only across all apps
- **ES2022** target + `moduleResolution: "bundler"`
- **No `any`** types — typescript-eslint recommended rules enforce this

---

## Naming Conventions

| Target                    | Convention                 | Example                                        |
| ------------------------- | -------------------------- | ---------------------------------------------- |
| Variables, functions      | `camelCase`                | `roomName`, `getToken()`                       |
| Classes, React components | `PascalCase`               | `LiveKitService`, `AgentStatusBadge`           |
| Constants / config maps   | `UPPER_SNAKE_CASE`         | `STATE_CONFIG`                                 |
| Type / interface names    | `PascalCase` + role suffix | `AgentStatusBadgeProps`, `GetLiveKitTokenBody` |
| MUI styled components     | `StyledXxx` prefix         | `StyledChip`, `StyledBox`                      |
| Agent tool files          | `camelCase` filename       | `getWeather.ts`                                |

---

## File Naming by App

### `livekit-server`

`kebab-case.role.ts` pattern — role is mandatory:

| Role       | Pattern              | Example                                                  |
| ---------- | -------------------- | -------------------------------------------------------- |
| Controller | `name.controller.ts` | `livekit.controller.ts`                                  |
| Service    | `name.service.ts`    | `livekit.service.ts`                                     |
| Route      | `name.route.ts`      | `livekit.route.ts`                                       |
| Validator  | `name.validator.ts`  | `get-livekit-token.validator.ts`                         |
| Middleware | `name.middleware.ts` | `error-handler.middleware.ts`, `not-found.middleware.ts` |
| Utility    | `name.utils.ts`      | `livekit-token.utils.ts`, `response-handler.utils.ts`    |

### `livekit-client`

- Component folders: **`PascalCase/`** with fixed internal files:
  - `index.tsx` — the component itself
  - `styled.ts` — MUI `styled()` definitions
  - `types.ts` — prop type / interface definitions
  - `configs.ts` — constants, config maps (when needed)
- Barrel file: `index.ts` at each directory for re-exports

### `livekit-agent`

- `camelCase` or `PascalCase` filename depending on what is exported (class → PascalCase, function/object → camelCase)

---

## Import Style

- **`livekit-client`**: absolute imports via the `@/*` alias (maps to `src/*`). Use for all imports within the app.
- **`livekit-server` / `livekit-agent`**: relative imports only.
- **Barrel exports**: every directory exposes an `index.ts` re-exporting its public API.
- **Type-only imports**: always `import type { Foo }` when only importing a type (enforced by `verbatimModuleSyntax`).

---

## Server Patterns (`livekit-server`)

### Class-Based Controllers and Services

- One class per file; instantiated directly in the route file (no DI framework).
- Dependencies injected as `private readonly` class properties.

```ts
// controller
export class LiveKitController {
  private readonly liveKitService = new LiveKitService();
  public readonly getToken: RequestHandler = async (req, res) => { ... };
}

// route
const controller = new LiveKitController();
router.post('/token', controller.getToken);
```

### Request Validation (Zod)

- All request body schemas live in `validators/` as Zod schemas.
- Controllers cast `req.body` to the validated type; Zod parse is done in middleware or service.

### Response Handling

- JSON responses are standardized through `utils/response-handler.ts`.
- API responses are converted from camelCase to snake_case via `humps.decamelizeKeys` before sending.

### Error Handling

- All unhandled errors propagate via `next(err)` to the centralized `middlewares/error-handler.ts`.
- 404s are caught by `middlewares/not-found.ts`.

### Environment Config

- All env vars are loaded once in `config/env.ts` via `loadConfig()` (using dotenv).
- Never access `process.env` directly outside of `config/env.ts`.

---

## Client Patterns (`livekit-client`)

### Atomic Design

Strictly follow atoms → molecules → pages hierarchy:

- **Atom**: smallest, no composition of other custom components (e.g., `AgentStatusBadge`)
- **Molecule**: composed of atoms (e.g., `AgentInfoCard`, `AgentVisualizerPanel`)
- **Page**: full view composed of molecules and atoms (e.g., `HomePage`)
- **Provider**: React context wrappers (e.g., `LiveKitSessionProvider`)
- **Template**: layout-only skeletons (rare)

### Component File Layout

Each component directory contains:

```
ComponentName/
  index.tsx      ← component logic and JSX
  styled.ts      ← MUI styled() definitions only
  types.ts       ← Props and related types
  configs.ts     ← constants, config maps (optional)
  use*.ts        ← co-located custom hooks (optional, pages only)
```

Page components may include co-located `use*.ts` hook files (e.g., `useAgentCallState.ts`) when the hook is tightly coupled to that page and not shared elsewhere.

### Styling

- Use MUI `styled()` API exclusively — no inline styles or CSS files.
- Styled components named `StyledXxx` (e.g., `StyledChip`).
- Theme customization in `src/theme/index.ts`.

### State Management

- **Server state**: TanStack Query (`useQuery`, `useMutation`) for all API-fetched data — hooks in `src/hooks/queries/` and `src/hooks/mutations/`.
- **Global client state**: Jotai atom/state hooks defined in `src/hooks/stores/`.
- **Local state**: React `useState`/`useReducer` for component-scoped state.
- **Custom hooks**: general-purpose hooks in `src/hooks/common/`; form-related hooks in `src/hooks/forms/`.

### Routing

- TanStack Router with file-based routes under `src/routes/`.
- `routeTree.gen.ts` is auto-generated — do not edit manually.

### HTTP Client

- Use the shared `axiosInstance` from `src/configs/axiosInstance.ts` for all API calls.
- API base URLs defined in `src/configs/apiEndpoints.ts`.
- TanStack Query client configured in `src/configs/queryClient.ts`.

---

## Agent Patterns (`livekit-agent`)

### Agent Class

- Main agent extends `voice.Agent` from `@livekit/agents`.
- Constructor configures `instructions`, `llm`, `stt`, `tts`, and `tools`.
- Use `ProviderType` enum + `providerFactory` to swap STT/TTS/LLM providers without changing the agent class.

### Tools

- One file per tool under `src/tools/`.
- File name matches the tool function name in `camelCase`.
- All tools collected in `src/tools/index.ts` and passed to the agent constructor.

### Build

- Built with Vite (output to `dist/`); entry point is `dist/main.js`.
- Dev mode: `pnpm dev` rebuilds and runs `node dist/main.js dev`.

---

## General Rules

- **Validation**: validate all external input (API request bodies) at the boundary using Zod.
- **Logging**: use `morgan` for HTTP logging in the server; no custom log calls unless debugging.
- **Secrets**: never commit `.env.local` or real credentials. Use `.env.example` as a template.
- **No `any`**: avoid TypeScript `any`. Use `unknown` + type narrowing where the type is genuinely unknown.
- **No barrel abuse**: barrel `index.ts` files re-export only what is meant to be public API for that layer.
- **No JS files**: all source files must be `.ts` or `.tsx`; `allowJs` is disabled in all apps.
- **Doc files**: agent-generated plan/decision files go in `docs/` at the workspace root, named with a timestamp prefix (`YYYY-MM-DD-HH-MM-SS-description.md`).
