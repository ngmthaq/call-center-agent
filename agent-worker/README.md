# agent-worker

Standalone Node + TypeScript worker built on [`@livekit/agents`](https://docs.livekit.io/agents) v1.x. It registers an entrypoint under an explicit `agentName` so the sibling `backend-service` is the only place that decides when this worker joins a room (via `AgentDispatchClient.createDispatch`).

This scaffold is intentionally provider-agnostic. No STT / TTS / LLM provider is wired here; the entrypoint is a no-op that logs participant join and leave events and exits cleanly when the job ends.

## Layout

```
agent-worker/
  src/
    config.ts   # loads + validates process.env
    logger.ts   # Pino logger factory
    agent.ts    # defineAgent({ entry })  -- default export
    main.ts     # cli.runApp(new ServerOptions({ agent: <agent.ts>, agentName, ... }))
  package.json
  tsconfig.json
  jest.config.cjs
  eslint.config.mjs
  .prettierrc
  .env.example
  .gitignore
```

## Required environment variables

| Key                  | Required | Description                                                                 |
| -------------------- | -------- | --------------------------------------------------------------------------- |
| `LIVEKIT_URL`        | yes      | WebSocket URL of the LiveKit server (e.g. `ws://localhost:7880` for local). |
| `LIVEKIT_API_KEY`    | yes      | LiveKit API key.                                                            |
| `LIVEKIT_API_SECRET` | yes      | LiveKit API secret. Never commit.                                           |
| `AGENT_NAME`         | yes      | Dispatch name. Setting it enables explicit dispatch.                        |
| `LOG_LEVEL`          | no       | Pino log level. Defaults to `info`.                                         |

Copy `.env.example` to `.env` and fill in real values (do not commit `.env`).

## Local development against `../livekit-server`

1. Start the sibling LiveKit dev server (see `../livekit-server/README.md`). It listens on `ws://localhost:7880` by default.
2. From this directory:
   ```bash
   npm install
   cp .env.example .env
   # edit .env: LIVEKIT_URL=ws://localhost:7880, set API key/secret to your local dev creds,
   # AGENT_NAME=voice-agent (or whichever name backend-service is configured to dispatch).
   npm run dev
   ```
3. The worker connects to the LiveKit server, registers under `AGENT_NAME`, and waits for explicit dispatch.

## How backend-service dispatches this worker

Backend-service holds the LiveKit API credentials and is the control plane for telephony, web, and supervisor flows. It calls `AgentDispatchClient.createDispatch(roomName, agentName, { metadata })` from its global `LiveKitDispatchService`. The value passed for `agentName` must match the `AGENT_NAME` env var that this worker is started with — otherwise no dispatch is delivered.

Because `agentName` is non-empty, automatic dispatch is disabled (see the [LiveKit agent-dispatch docs](https://docs.livekit.io/agents/server/agent-dispatch/#explicit)). The worker will only ever be assigned to rooms that backend-service explicitly dispatches it to.

## Production

```bash
npm run build
npm run start
```

`npm run start` runs the compiled `dist/main.js` in `start` (production) mode of the `@livekit/agents` CLI. Set `LIVEKIT_LOG_LEVEL` or the `LOG_LEVEL` env var to tune verbosity.

## Docker

A standalone single-service compose stack (independent of the `backend-service`
and `livekit-server` stacks). Run everything from `agent-worker/`:

```bash
cp .env.example .env   # then fill in real LIVEKIT_* values
docker compose build
docker compose up
```

A populated `.env` is required first — `docker compose up` will start the
worker with empty credentials and it will fail to register otherwise.

`docker compose down` sends SIGTERM, which tini (PID 1) forwards to Node for a
clean LiveKit worker drain.

There are deliberately **no published ports and no healthcheck**. The worker
opens an OUTBOUND WebSocket to `LIVEKIT_URL` and never listens on a host port,
so there is nothing to publish or probe; worker liveness is tracked
server-side by LiveKit over the agents protocol.

`host.docker.internal` caveat: when pointing at a host-side LiveKit dev server,
`LIVEKIT_URL=ws://localhost:7880` will NOT resolve from inside the container
(`localhost` is the container itself). Use
`LIVEKIT_URL=ws://host.docker.internal:7880` (macOS/Windows) or attach the
worker to the `livekit-server` compose network instead.

## Notes

- This package is a standalone Node application at the workspace root. It is not part of a monorepo (no workspaces).
- Module system: CommonJS (`"type": "commonjs"`, `tsconfig` `module: Node16` / `moduleResolution: Node16`). `@livekit/agents` v1.x is consumed via CJS interop; path resolution uses `__dirname`/`path.resolve` rather than `import.meta.url`/`fileURLToPath`.
- Engines: Node `>=20`.
