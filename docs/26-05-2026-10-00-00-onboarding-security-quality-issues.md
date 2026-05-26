# Onboarding Audit — Security & Code Quality Issues

Discovered during initial onboarding scan on 2026-05-26. All items are open and pending fix.

---

## Security Issues

### [SEC-001] Open CORS Policy — HIGH

**File:** `apps/livekit-server/src/app.ts:11`
**CWE:** CWE-942

`app.use(cors())` with no config allows all origins to call the token endpoint. Any website
can make cross-origin requests to `POST /livekit/token` and receive valid LiveKit room tokens.

**Fix:**

```ts
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [] }));
```

Add `ALLOWED_ORIGINS=https://your-frontend.com` to `.env.local` and `.env.example`.

---

### [SEC-002] Unauthenticated Token Endpoint — HIGH

**File:** `apps/livekit-server/src/routes/livekit.route.ts:9`
**CWE:** CWE-306

`POST /livekit/token` has no authentication middleware. Any caller — authenticated or not —
receives a signed LiveKit token and can join any room as an arbitrary participant.

**Fix:**

```ts
// Add an auth middleware before the validator
router.post(
  '/token',
  requireAuth,
  validateGetLiveKitToken,
  responseHandler(liveKitController.getToken),
);
```

Implement `requireAuth` as an API key check, JWT validation, or session middleware depending
on your chosen auth strategy.

---

### [SEC-003] Unvalidated `roomConfig` Passthrough — MEDIUM

**File:** `apps/livekit-server/src/validators/get-livekit-token.validator.ts:15`
**CWE:** CWE-915

`roomConfig` is typed as `z.any()` and passed directly into `new RoomConfiguration(body.roomConfig)`.
A caller can supply arbitrary room configuration fields — potentially overriding agent dispatch,
codecs, permissions, or max participants.

**Fix:**

```ts
// Replace z.any() with an explicit schema covering only the fields you intend to allow
roomConfig: z
  .object({
    maxParticipants: z.number().optional(),
    emptyTimeout: z.number().optional(),
    // add other permitted fields here
  })
  .optional(),
```

---

### [SEC-004] No Rate Limiting on Token or Webhook Endpoints — MEDIUM

**File:** `apps/livekit-server/src/app.ts` (global)
**CWE:** CWE-770

No rate-limiting middleware is applied to any route. Attackers can hammer `POST /livekit/token`
to farm tokens or flood `POST /webhook` to exhaust server resources.

**Fix:**

```ts
import rateLimit from 'express-rate-limit';

const tokenLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true });
router.post('/token', tokenLimiter, validateGetLiveKitToken, responseHandler(...));
```

Install: `pnpm --filter livekit-server add express-rate-limit`

---

### [SEC-005] Tool Registry Typed as `Record<string, any>` — LOW

**File:** `apps/livekit-agent/src/tools/index.ts:5`
**CWE:** CWE-20

The tool registry uses `Record<string, any>`, bypassing TypeScript's type safety. A future tool
added without a Zod schema would receive unvalidated LLM output as arguments at runtime.

**Fix:**

```ts
import type { llm } from '@livekit/agents';

export const tools: Record<string, ReturnType<typeof llm.tool>> = { getWeather };
```

---

### [SEC-006] `console.log` in Agent Tool — INFO

**File:** `apps/livekit-agent/src/tools/getWeather.ts:12`

User location queries are logged to unstructured stdout via `console.log`.

**Fix:** Replace with a structured logger or remove the log if the tool is a placeholder.

---

### [SEC-007] Stack Traces Returned in Non-Production Responses — INFO

**File:** `apps/livekit-server/src/middlewares/error-handler.middleware.ts:15`

Stack traces are included in JSON error responses when `NODE_ENV !== 'production'`.
This is acceptable in development but requires `NODE_ENV=production` to be explicitly set in
all deployment environments (Docker, CI/CD).

**Fix:** Verify `NODE_ENV=production` is set in all production deployment configs.

---

## Code Quality Issues

### [CQ-001] DIP Violation — Inline Dependency Instantiation — MEDIUM

**Files:** `apps/livekit-server/src/controllers/*.ts`, `apps/livekit-server/src/services/*.ts`

Controllers and services instantiate their dependencies with `new` directly in field initializers.
This hard-wires each class to its concrete implementation, making isolated unit testing impossible
without module-level mocking.

```ts
// Current — tight coupling
export class LiveKitController {
  private readonly liveKitService = new LiveKitService();
}

// Better — constructor injection
export class LiveKitController {
  constructor(private readonly liveKitService: LiveKitService) {}
}
// Compose at app startup:
// new LiveKitController(new LiveKitService())
```

---

### [CQ-002] KISS Violation — Fragile Singleton Guard in `loadConfig` — LOW

**File:** `apps/livekit-server/src/config/env.ts:30`

The singleton guard uses `Object.keys(config).length === 0` on a value typed as `Readonly<Config>`.
This is fragile — it works only because the empty object has no keys.

```ts
// Current
let config = {} as Readonly<Config>;
if (Object.keys(config).length === 0) { ... }

// Simpler and explicit
let config: Readonly<Config> | null = null;
if (!config) { ... }
```

---

### [CQ-003] KISS Violation — Unused Provider Registry Entries — LOW

**File:** `apps/livekit-agent/src/agents/provider.ts`

`LLM_REGISTRY`, `STT_REGISTRY`, and `TTS_REGISTRY` enumerate 14 provider types, but only
`ProviderType.MISTRAL` is used in `agents/index.ts`. The 13 unused entries are dead code added
for hypothetical future use.

**Fix:** Remove unused registry entries. Re-add when a second provider is actually adopted.

---

### [CQ-004] SoC — HomePage Contains Inline Layout Structure — INFO

**File:** `apps/livekit-client/src/components/pages/HomePage/styled.ts`

`styled.ts` defines full page-level layout wrappers (`PageRoot`, `PageHeader`, `PageMain`,
`PageFooter`). These act as an unnamed template. Per Atomic Design, shared layout structure
belongs in `templates/` so it can be reused across pages. The `templates/` folder exists but
is currently empty.

**Fix:** When a second page is added, extract the layout wrappers into a `templates/MainLayout`
(or equivalent) component.

---

### [CQ-005] SoC — Webhook Returns `data: null` Instead of 204 — INFO

**File:** `apps/livekit-server/src/controllers/webhook.controller.ts`

The webhook controller returns `undefined`, so `responseHandler` wraps it as
`{ status: 200, data: null, timestamp: "..." }`. This is inconsistent with the token endpoint
which calls `res.status(201).send(response)` directly. Webhook responses are ignored by LiveKit,
but the intent is unclear.

**Fix:** Mount the webhook route outside of `responseHandler` and return 204 explicitly:

```ts
res.sendStatus(204);
```

---

### [CQ-006] Atomic Design — `useAgentCallState` Co-located in `pages/` — INFO

**File:** `apps/livekit-client/src/components/pages/HomePage/useAgentCallState.ts`

`useAgentCallState` is co-located inside the `HomePage` folder. This is acceptable per Atomic
Design (pages connect to state/data) and is a common React pattern. No action needed unless this
hook is reused by a second page — in that case, move it to `hooks/common/`.

---

## Priority Order for Fixes

| Priority | ID                               | Effort                     |
| -------- | -------------------------------- | -------------------------- |
| 1        | SEC-001 + SEC-002                | Low–Medium                 |
| 2        | SEC-004                          | Low                        |
| 3        | SEC-003                          | Low                        |
| 4        | CQ-001                           | Medium                     |
| 5        | CQ-002                           | Low                        |
| 6        | CQ-003                           | Low                        |
| 7        | SEC-005                          | Low                        |
| 8        | CQ-004                           | Low (defer until 2nd page) |
| 9        | SEC-006, SEC-007, CQ-005, CQ-006 | Low                        |
