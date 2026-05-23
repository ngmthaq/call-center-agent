# Plan — POST /webhook with LiveKit room_finished room cleanup

Approved: 2026-05-23

---

- From: planner
- To: Root Agent
- Title: Plan Response — POST /webhook with LiveKit room_finished room cleanup
- Description: Add a `POST /webhook` endpoint to `apps/livekit-server` that verifies the LiveKit webhook signature using `WebhookReceiver`, and calls `livekitRoomUtil.deleteRoom(name)` when a `room_finished` event is received, ignoring all other events.

---

## Approach Summary

Mount the webhook router in `app.ts` **before** `express.json()` so the raw string body is still available when the route handler runs. The webhook route registers `express.text({ type: '*/*' })` as its first middleware — this captures and populates `req.body` as a raw string before Express's global JSON parser has any chance to consume it. One new `app.use('/webhook', webhookRouter)` line inserted before `app.use(express.json())`, and no changes to the existing JSON-parsed routes.

`WebhookService.receive(rawBody, authHeader)` instantiates a `WebhookReceiver(apiKey, apiSecret)` once in the constructor. On a `room_finished` event it calls `livekitRoomUtil.deleteRoom(roomName)` and returns `void`. On any other event it returns immediately. The service never logs the auth header value or any secret-derived data.

`WebhookController` follows the same arrow-method pattern as `RoomController`. A new `webhook.route.ts` registers `POST /` with `express.text({ type: '*/*' })` then `responseHandler(webhookController.receive)`. A new entry in `app.ts` mounts this router before `express.json()`. `routes/index.ts` is **not** changed.

---

## Functional Requirements

1. `POST /webhook` accepts requests with any `Content-Type`.
2. Raw string body is available to the handler (not parsed by `express.json()`).
3. The `Authorization` header is passed verbatim to `WebhookReceiver.receive`.
4. Signature verification performed via `WebhookReceiver` — invalid signatures throw and are caught by `errorHandler`.
5. On `room_finished` event: `livekitRoomUtil.deleteRoom(webhookEvent.room.name)` is called.
6. On all other event types: handler returns immediately with no side-effects (HTTP 200).
7. No secrets, auth header values, or room tokens are logged at any log level.
8. `WebhookReceiver` is constructed once per service instance (constructor, not per-call).

---

## Non-Functional Requirements

- `verbatimModuleSyntax` compliant: `import type` for all type-only imports.
- Class + singleton export pattern: `WebhookService` + `webhookService`, `WebhookController` + `webhookController`.
- Arrow methods on controller.
- `kebab-case` filenames: `webhook.service.ts`, `webhook.controller.ts`, `webhook.route.ts`.
- No new npm packages — `WebhookReceiver` is already in `livekit-server-sdk`.
- Error propagation: exceptions from `WebhookReceiver.receive` propagate via `next()` to `errorHandler`.
- `express.text({ type: '*/*' })` used (not `express.raw`) — keeps `req.body` as `string`.

---

## Files in Scope

| File                                    | Action                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/app.ts`                            | Edit — mount `webhookRouter` BEFORE `express.json()`                                    |
| `src/services/webhook.service.ts`       | Create — `WebhookService` + `webhookService` singleton                                  |
| `src/controllers/webhook.controller.ts` | Create — `WebhookController` + `webhookController` singleton                            |
| `src/routes/webhook.route.ts`           | Create — `express.text({ type: '*/*' })` + `responseHandler(webhookController.receive)` |

`src/routes/index.ts` is NOT modified.

---

## Risks & Assumptions

- R1: `webhookEvent.room` may be `undefined` on some events — guard with `webhookEvent.room?.name` before calling `deleteRoom`.
- R2: LiveKit may send `room_finished` after room already deleted — swallow not-found errors silently.
- A1: `config.livekit.apiKey` and `config.livekit.apiSecret` available from `src/config/env.ts`.
- A2: `WebhookReceiver` constructor: `new WebhookReceiver(apiKey, apiSecret)`.
- A3: Testing workflow is `Skip-Testing`.

---

## Task List

| #   | Status | Task                                                                                                                                                                       | Responsible Role | Dependencies | Skills                                     |
| --- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------ | ------------------------------------------ |
| 1   | DONE   | Create `src/services/webhook.service.ts` — `WebhookReceiver` in constructor, `receive(rawBody, authHeader)` handles `room_finished` → `deleteRoom`, silent-catch not-found | developer        | —            | clean-code, livekit-agents, secret-scanner |
| 2   | DONE   | Create `src/controllers/webhook.controller.ts` — `receive: RequestHandler` reads `req.body as string` + `req.headers.authorization`                                        | developer        | 1            | clean-code                                 |
| 3   | DONE   | Create `src/routes/webhook.route.ts` — `express.text({ type: '*/*' })` then `responseHandler(webhookController.receive)`                                                   | developer        | 2            | clean-code                                 |
| 4   | DONE   | Edit `src/app.ts` — add `app.use('/webhook', webhookRouter)` immediately before `app.use(express.json())`                                                                  | developer        | 3            | clean-code                                 |
| 5   | DONE   | Run typecheck + lint, fix any errors                                                                                                                                       | developer        | 4            | clean-code                                 |
| 6   | DONE   | Final readback — no secrets logged, 4 files changed, `express.json()` still after webhook mount                                                                            | developer        | 5            | secret-scanner, clean-code                 |
