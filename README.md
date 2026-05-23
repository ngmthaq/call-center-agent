# Call Center Agent

An AI-powered call center voice agent built on [LiveKit](https://livekit.io). The monorepo contains the voice agent, API server, and self-hosted infrastructure.

## Monorepo Structure

```
call-center-agent/
├── apps/
│   ├── livekit-agent/    # LiveKit voice AI agent (TypeScript)
│   ├── livekit-server/   # Express.js API server (TypeScript)
│   ├── livekit-infra/    # Self-hosted Docker Compose stack
│   └── livekit-client/   # Web client (in progress)
├── package.json          # Root workspace — shared scripts & tooling
└── pnpm-workspace.yaml
```

## Prerequisites

| Requirement    | Version |
| -------------- | ------- |
| Node.js        | >= 22   |
| pnpm           | >= 10   |
| Docker Engine  | >= 24   |
| Docker Compose | v2+     |

## Installation

```bash
pnpm install
```

## Apps

### livekit-agent

LiveKit voice AI agent. Connects to the LiveKit server, processes audio, and responds using configurable STT/LLM/TTS plugins.

| Script                | Command                         |
| --------------------- | ------------------------------- |
| `pnpm dev`            | Build and run agent in dev mode |
| `pnpm start`          | Run compiled agent              |
| `pnpm build`          | Compile to `dist/`              |
| `pnpm download-files` | Download required model files   |
| `pnpm test`           | Run tests                       |

Run from the repo root:

```bash
pnpm livekit-agent dev
```

See [`apps/livekit-agent/README.md`](apps/livekit-agent/README.md) for setup and environment variables.

---

### livekit-server

Express.js + TypeScript API server. Exposes HTTP endpoints for room management, token generation, and LiveKit webhooks.

| Script           | Command                            |
| ---------------- | ---------------------------------- |
| `pnpm dev`       | Run with `tsx watch` (auto-reload) |
| `pnpm start`     | Run compiled server                |
| `pnpm build`     | Compile TypeScript to `dist/`      |
| `pnpm typecheck` | Type-check without emitting        |

Run from the repo root:

```bash
pnpm livekit-server dev
```

See [`apps/livekit-server/README.md`](apps/livekit-server/README.md) for setup and environment variables.

---

### livekit-infra

Self-hosted LiveKit Docker Compose stack with Nginx SNI passthrough, Redis, and PostgreSQL. Uses a single `docker-compose.yml` with `dev` and `prod` profiles.

| Script           | Command                             |
| ---------------- | ----------------------------------- |
| `pnpm dev`       | Start dev stack (`--profile dev`)   |
| `pnpm dev:down`  | Stop dev stack                      |
| `pnpm prod`      | Start prod stack (`--profile prod`) |
| `pnpm prod:down` | Stop prod stack                     |
| `pnpm build`     | Build all custom Docker images      |

Run from the repo root:

```bash
pnpm livekit-infra dev       # development
pnpm livekit-infra prod      # production
```

See [`apps/livekit-infra/README.md`](apps/livekit-infra/README.md) for full setup, environment variables, and production deployment.

---

## Development Workflow

1. Start the infrastructure:

   ```bash
   pnpm livekit-infra dev
   ```

2. Copy and fill environment files for each app:

   ```bash
   cp apps/livekit-server/.env.example apps/livekit-server/.env
   cp apps/livekit-agent/.env.example  apps/livekit-agent/.env
   cp apps/livekit-infra/.env.example  apps/livekit-infra/.env
   ```

3. Start the API server:

   ```bash
   pnpm livekit-server dev
   ```

4. Start the voice agent:

   ```bash
   pnpm livekit-agent dev
   ```

## Code Quality

```bash
pnpm format        # Format all files with Prettier
```

Each app also exposes `lint`, `lint:fix`, `format`, and `typecheck` scripts runnable via the root filter:

```bash
pnpm livekit-server lint
pnpm livekit-agent typecheck
```
