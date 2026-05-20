# LiveKit Server

## Overview

Self-contained, production-ready Docker Compose stack for [LiveKit](https://livekit.io) with a password-protected Redis backend, built-in TURN/TLS support, and a bootstrap script that generates strong random secrets into a gitignored `.env`. The stack ships with safe defaults and clear hooks for the operator to enable TURN/TLS and front the WebSocket port with a reverse proxy.

## Prerequisites

- Docker Engine `>= 24` with the Compose v2 plugin (`docker compose`, not the legacy `docker-compose`).
- `openssl` available on the host (used by `scripts/bootstrap.sh`).
- Linux or macOS host. Windows is out of scope.

## Quickstart

```bash
cd livekit-server
bash scripts/bootstrap.sh
docker compose up -d
```

That's it for a development-mode stack on plain HTTP. Production deployments must additionally complete the **TLS in production** section below and review the **Security hardening checklist**.

## Commands

| Action                | Command                                                       |
| --------------------- | ------------------------------------------------------------- |
| Start (detached)      | `docker compose up -d`                                        |
| Stop                  | `docker compose down`                                         |
| Logs (live)           | `docker compose logs -f`                                      |
| Logs (livekit only)   | `docker compose logs -f livekit`                              |
| Restart               | `docker compose restart`                                      |
| Status                | `docker compose ps`                                           |
| Regenerate secrets    | `bash scripts/bootstrap.sh --force && docker compose up -d --force-recreate livekit` |
| Validate compose file | `docker compose config`                                       |

`bootstrap.sh --force` writes a timestamped backup (`.env.bak.<ts>`) of the previous file before rotating, so credential rotations are recoverable for at least one cycle.

> Any change to `.env` requires `docker compose up -d --force-recreate livekit` to take effect. `docker compose restart` keeps the old environment (the container's env block is fixed at create time, not at start time), so the server will continue running with the previous `LIVEKIT_KEYS` / `REDIS_PASSWORD` values.

## Ports

| Port      | Proto    | Service / Purpose                                    | Public firewall      |
| --------- | -------- | ---------------------------------------------------- | -------------------- |
| 7880      | TCP      | LiveKit WebSocket signalling (HTTP/WS)               | Yes (via TLS proxy)  |
| 7881      | TCP      | LiveKit RTC TCP fallback                             | Yes                  |
| 7882      | UDP      | LiveKit RTC UDP media                                | Yes                  |
| 3478      | UDP+TCP  | Built-in TURN (requires uncommenting TURN block)     | Yes (when enabled)   |
| 5349      | TCP      | Built-in TURN TLS (requires real certs)              | Yes (when enabled)   |
| 6379      | TCP      | Redis — internal compose network only                | **No**               |

Public firewall rules should allow only the ports actually in use. Redis must never be reachable from outside the host.

## TLS in production

WebSocket signalling (`7880`) should not be served on plain HTTP in production. Terminate TLS at a reverse proxy on the host and forward to LiveKit. A minimal Caddy configuration for `Caddyfile`:

```caddyfile
livekit.example.com {
  reverse_proxy localhost:7880
}
```

Caddy will obtain and renew a Let's Encrypt certificate automatically as long as `livekit.example.com` resolves to this host and ports 80/443 are open.

To enable the built-in TURN/TLS listener:

1. Obtain `tls.crt` and `tls.key` for the domain configured in `LIVEKIT_TURN_DOMAIN` (the same domain you point clients at). Caddy can issue these on the host; copy the certificate chain into `./certs/tls.crt` and the private key into `./certs/tls.key` with mode 600.
2. Edit `livekit.yaml` and uncomment the `turn:` block at the bottom.
3. Open UDP+TCP `3478` and TCP `5349` in your cloud firewall.
4. `docker compose up -d` to apply.

The `turn:` block ships commented-out so a fresh checkout does not crash-loop while `./certs/` is empty.

## Troubleshooting — agent-worker logs `Unexpected server response: 401`

Symptom: the sibling `agent-worker` (or any other LiveKit client signing JWTs with `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`) repeatedly fails the WebSocket upgrade with `Unexpected server response: 401`, even though the API key and secret are identical across all `.env` files.

Root cause: the LiveKit server does NOT perform `${VAR}` substitution inside `livekit.yaml`. If credentials are written into the YAML body as `${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}`, the server stores those placeholders as literal strings in its `Keys` map and rejects every real-secret-signed JWT with 401. (See `cmd/server/main.go::getConfigString` in the upstream `livekit/livekit` repo — `os.ExpandEnv` is only applied to `KeyFile`, never to the YAML body.)

Fix mechanism: the API key/secret pair is delivered through the `LIVEKIT_KEYS` env var that the server's `--keys` CLI flag consumes. In this stack, `docker-compose.yml` sets:

```yaml
environment:
  LIVEKIT_KEYS: "${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}"
```

The `${VAR}` interpolation here is performed by **Docker Compose at parse time** (Compose loads `.env` from the project directory automatically), not by the LiveKit server. The substituted string `"<key>: <secret>"` is then injected into the container's environment, parsed by the server, and used to populate the `Keys` map.

To apply or re-apply after a `.env` change:

```bash
docker compose up -d --force-recreate livekit
```

`docker compose restart` is NOT sufficient — restart preserves the existing container's environment.

## Troubleshooting — Production-readiness WARN: UDP receive buffer too small

Symptom: shortly after `docker compose up -d`, `docker compose logs livekit` contains a WARN line such as:

```text
UDP receive buffer is too small for a production set-up
```

Root cause: at startup LiveKit reads the kernel-global UDP receive-buffer ceiling `net.core.rmem_max` and compares it against its 5 MB production threshold (`rtcconfig/rtc_unix.go:31` upstream); on most Linux distributions and on Docker Desktop's LinuxKit VM the default ceiling sits well below 5 MB (commonly `425984`), so the WARN fires.

> **Do not** add `sysctls: net.core.rmem_max` (or `net.core.wmem_max`) to `docker-compose.yml`. runc's libcontainer namespaced-sysctl allowlist only permits `kernel.{shm,msg,sem}*`, `fs.mqueue.*`, and a curated `net.ipv4.*` / `net.ipv6.*` subset; `net.core.*` is a kernel-global sysctl and is rejected at container init, causing `runc create` to abort with the literal error `open sysctl net.core.rmem_max file: reopen fd 8: permission denied`. The container will not start. Tune the host kernel instead — see below.

Linux production fix (run on the host, not inside the container):

```bash
echo 'net.core.rmem_max=5000000' | sudo tee /etc/sysctl.d/99-livekit.conf
echo 'net.core.wmem_max=5000000' | sudo tee -a /etc/sysctl.d/99-livekit.conf
sudo sysctl --system
```

After the host is tuned, recreate the container (`docker compose up -d --force-recreate livekit`) so it inherits the raised ceiling from the host network namespace.

Linux-only alternative: switching the service to `network_mode: host` also lets LiveKit see the host's tuned ceiling directly — see the note next to `udp_port` in `livekit.yaml` (lines 17–20). This is an orthogonal performance choice; tuning the host sysctl above is sufficient on its own.

Docker Desktop on macOS caveat: the WARN is **cosmetic in development** — at small participant counts there is no measurable media-quality impact. Running `sudo sysctl -w net.core.rmem_max=...` on the macOS host is *ineffective* because the container runs against Docker Desktop's LinuxKit VM kernel, not Darwin; the Darwin sysctl namespace is unrelated. If you do need to raise the LinuxKit VM ceiling, the only supported path is Docker Desktop → Settings → Resources (non-declarative; intentionally not codified in this repo).

Verification (after Linux host tuning + container recreate):

```bash
docker compose exec livekit sysctl net.core.rmem_max
```

Expected output is `5000000` on a tuned Linux host. On macOS Docker Desktop, or any untuned host, the original low value (commonly `425984`) is the expected output and the WARN line will remain in `docker compose logs livekit`.

## Security hardening checklist

- [ ] `.env` exists with mode `600` and is **never** committed (covered by `.gitignore`).
- [ ] Secrets rotated via `bash scripts/bootstrap.sh --force` on a regular cadence and after any suspected compromise.
- [ ] Cloud firewall restricts inbound traffic to only the ports listed above; Redis port `6379` is closed externally.
- [ ] WebSocket `7880` is fronted by a TLS-terminating reverse proxy (Caddy/Nginx) for any deployment that accepts traffic from the open internet.
- [ ] TURN/TLS certificates in `./certs/` are world-unreadable (mode `600`) and renewed before expiry.
- [ ] `docker compose logs` is collected by host logging (journald, CloudWatch, etc.) so failures are observable.
- [ ] If extending the LiveKit image, run as a non-root user in the Dockerfile.
- [ ] No `:latest` image tags — both `livekit/livekit-server` and `redis` are pinned (see below).

## Versions / Assumptions

- LiveKit server image: `livekit/livekit-server:v1.7.2` (pinned; bump deliberately).
- Redis image: `redis:7-alpine` (pinned major; alpine for small footprint).
- `openssl` is provided by the host running `scripts/bootstrap.sh`.
- The host runs Docker Engine `>= 24` with the Compose v2 plugin.
- TLS certificates for the built-in TURN listener are provisioned out-of-band (Caddy/Let's Encrypt, ACM, etc.) and dropped into `./certs/` by the operator.
- LiveKit health probe uses the bash built-in `/dev/tcp` (the official image ships bash). If you switch to an image variant without bash, change the healthcheck in `docker-compose.yml` to `nc -z localhost 7880`.
