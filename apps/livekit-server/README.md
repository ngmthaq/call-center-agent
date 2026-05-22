# livekit-server

A layered Express.js + TypeScript (ESM) service that exposes HTTP endpoints supporting the LiveKit voice agent.

> **First-run note:** Run `pnpm install` from the repo root before `pnpm livekit-server dev`. Dependencies declared in this package's `package.json` are not installed until then.

## Scripts

| Script              | Purpose                                                   |
| ------------------- | --------------------------------------------------------- |
| `pnpm build`        | Compile TypeScript to `dist/` via `tsc -p tsconfig.json`. |
| `pnpm clean`        | Remove the `dist/` build output.                          |
| `pnpm typecheck`    | Type-check without emitting (`tsc --noEmit`).             |
| `pnpm lint`         | Run ESLint over `**/*.{ts,js}`.                           |
| `pnpm lint:fix`     | Run ESLint and apply auto-fixes.                          |
| `pnpm format`       | Format `**/*.{ts,js,json,md}` with Prettier.              |
| `pnpm format:check` | Verify formatting without writing.                        |
| `pnpm dev`          | Run `src/server.ts` with `tsx watch` (auto-reload).       |
| `pnpm start`        | Run the compiled entrypoint `node dist/server.js`.        |

Run any script from this package via the repo-root filter:

```bash
pnpm livekit-server <script>
# e.g.
pnpm livekit-server dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values locally. Only keys are listed below — never commit values.

| Key        | Purpose                                                | Default       |
| ---------- | ------------------------------------------------------ | ------------- |
| `PORT`     | TCP port the HTTP server binds to.                     | `3000`        |
| `NODE_ENV` | Runtime mode; toggles stack traces in error responses. | `development` |

`src/config/env.ts` is the only file that reads `process.env`. Add new keys there.

## Architecture

Requests flow through a layered MVC pipeline:

```
routes  →  controllers  →  services
                ↑
        middlewares (cors, helmet, morgan, json, urlencoded,
                     notFoundHandler, errorHandler)
```

- **Routes** map paths to controllers — no logic.
- **Controllers** translate HTTP input/output to/from services — no business logic.
- **Services** hold pure business logic — no Express imports, easy to test in isolation.
- **Middlewares** isolate cross-cutting concerns. The global `errorHandler` normalizes errors through `http-errors`, responds with `{ status, message }`, and includes `stack` only when `NODE_ENV !== 'production'`.
