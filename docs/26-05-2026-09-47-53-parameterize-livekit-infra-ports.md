- From: planner (sub-agent loaded with the planner role skill)
- To: Root Agent
- Title: Plan Response — Parameterize LiveKit infra ports via shared env vars
- Description: Introduce `${VAR:-default}` host-port parameterization across the livekit-infra Docker Compose stack and propagate matching defaults into the LiveKit/Nginx templates, entrypoints, and the two app `.env.example` files, keeping host port == container-internal port while preserving every bind-address prefix, comment, and current default value.

---

## Approach Summary

- Parameterize all host-side port mappings in `docker-compose.yml` using `${VAR:-default}` so current values remain the defaults and nothing changes behaviorally unless an operator overrides a var. Because `envsubst` has no `:-` default syntax, the LiveKit config template gets parameterized placeholders while the actual defaults live in `livekit-entrypoint.sh` (mirroring the existing pattern), guaranteeing host port == container-internal port via a single shared env var.
- Nginx container-internal `listen 80/443` directives stay fixed; only the compose host mapping is parameterized with `NGINX_HTTP_PORT`/`NGINX_HTTPS_PORT`. The prod Nginx LiveKit upstream (`host-gateway:7880`) is made to track `LIVEKIT_PORT` via `envsubst`, with a matching default exported in `nginx-entrypoint.sh`.
- The two app `.env.example` files keep `ws://localhost:7880` but gain a comment noting the port must match `LIVEKIT_PORT` in the infra `.env`.
- New vars are non-sensitive port numbers; the secret-scanner is run against the diff to confirm clean. Testing Workflow is Skip-Testing, so verification is a single manual `docker compose config` resolution check.

## Functional Requirements

- All host-side port mappings in `docker-compose.yml` use `${VAR:-default}` with the current literal value as the default, preserving every `0.0.0.0:` / `127.0.0.1:` bind-address prefix and inline comment exactly.
- LiveKit host port and container-internal port are driven by one shared `LIVEKIT_PORT` var: parameterized in `livekit.template.yaml` and defaulted in `livekit-entrypoint.sh`; same model for RTC TCP port (`LIVEKIT_RTC_TCP_PORT`) and the UDP range (`LIVEKIT_RTC_UDP_PORT_START`/`LIVEKIT_RTC_UDP_PORT_END`).
- `redis-livekit-dev` host mapping reuses the existing `REDIS_LIVEKIT_PORT` (default 6379) on both host and container sides — no new var.
- Nginx host mapping uses `${NGINX_HTTP_PORT:-80}` / `${NGINX_HTTPS_PORT:-443}`; container-internal `listen 80;` / `listen 443;` remain unchanged.
- Prod Nginx `livekit_backend` upstream (`host-gateway:7880`) tracks `LIVEKIT_PORT` via `envsubst`, with a default exported in `nginx-entrypoint.sh` and `LIVEKIT_PORT` added to the explicit `envsubst` variable allowlist.
- `livekit-client/.env.example` and `livekit-server/.env.example` keep `ws://localhost:7880` and gain a comment noting the port must match `LIVEKIT_PORT` in `apps/livekit-infra/.env`.
- `apps/livekit-infra/.env.example` documents every new var with dev/prod guidance, matching the file's existing comment style.

## Non-Functional Requirements

- Backward compatibility: with no `.env` overrides, `docker compose config` resolves to exactly the current literal values for all profiles (`dev` and `prod`).
- Security: no secrets introduced — all new vars are port numbers; secret-scanner must exit 0 on the diff.
- Maintainability: follow the file's existing conventions (bind prefixes, comment blocks, the documented "defaults live in entrypoint because envsubst lacks `:-`" pattern). Keep host port == container-internal port via shared vars to avoid drift (DRY, KISS).
- The `envsubst` variable allowlist in `nginx-entrypoint.sh` must stay explicit to avoid corrupting Nginx-native `$variable` references.

## Files in Scope

- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-infra/docker-compose.yml` (modify)
- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-infra/livekit.template.yaml` (modify)
- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-infra/livekit-entrypoint.sh` (modify)
- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-infra/nginx.template.conf` (modify)
- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-infra/nginx-entrypoint.sh` (modify)
- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-infra/.env.example` (modify)
- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-client/.env.example` (modify)
- `/Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-server/.env.example` (modify)

## Risks & Assumptions

- Assumption: the new env var names are `LIVEKIT_PORT` (HTTP/WS, default 7880), `LIVEKIT_RTC_TCP_PORT` (default 7881), `LIVEKIT_RTC_UDP_PORT_START` (default 50000), `LIVEKIT_RTC_UDP_PORT_END` (default 50100), `NGINX_HTTP_PORT` (default 80), `NGINX_HTTPS_PORT` (default 443). These follow the existing `REDIS_APP_PORT` / `REDIS_LIVEKIT_PORT` naming. The developer must use exactly these names across all files for the shared-var contract to hold.
- Assumption: `livekit.template.yaml` currently hardcodes `port: 7880`, `rtc.tcp_port: 7881`, `port_range_start: 50000`, `port_range_end: 50100`; these become `${LIVEKIT_PORT}`, `${LIVEKIT_RTC_TCP_PORT}`, `${LIVEKIT_RTC_UDP_PORT_START}`, `${LIVEKIT_RTC_UDP_PORT_END}` with defaults exported in `livekit-entrypoint.sh`.
- Risk (out of scope but noted per decision 2): the Nginx `livekit_turn_backend` upstream points at `host-gateway:5349`, which corresponds to `turn.tls_port: 5349` in `livekit.template.yaml`. Only `LIVEKIT_PORT` tracking was requested, so the TURN port is left untouched. If the TURN port is ever parameterized later, both the upstream and the template's `tls_port` would need the same shared-var treatment. Flagged for awareness only — no change in this plan.
- Risk: the prod `livekit` service uses `network_mode: host`, so it has no compose `ports:` block — its port is controlled solely by the LiveKit config (`LIVEKIT_PORT`). The Nginx upstream must therefore read the same `LIVEKIT_PORT` to stay aligned; this is exactly why the upstream is parameterized.
- Risk: `envsubst` in `livekit-entrypoint.sh` currently runs without an explicit variable allowlist (unlike nginx). Adding numeric port vars is safe because the LiveKit YAML template has no conflicting literal `$variable` tokens, but the developer should confirm no new unintended substitution occurs.
- Assumption: keeping `ws://localhost:7880` literal in the app `.env.example` files (rather than parameterizing) is intentional per decision 1 — these are template files consumed by app build tooling, not by `envsubst`.

## Open Questions / Blockers

- None. All four prior open questions resolved by user decisions and incorporated above.

## Status

- [x] Ready to execute
- [ ] Blocked — requires user input on: —

## Task List

| #   | Status | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Responsible Role | Dependencies | Skills           |
| --- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------ | ---------------- |
| 1   | DONE   | In `docker-compose.yml`, parameterize the `livekit-dev` host port mappings: `0.0.0.0:${LIVEKIT_PORT:-7880}:${LIVEKIT_PORT:-7880}`, `0.0.0.0:${LIVEKIT_RTC_TCP_PORT:-7881}:${LIVEKIT_RTC_TCP_PORT:-7881}`, and `0.0.0.0:${LIVEKIT_RTC_UDP_PORT_START:-50000}-${LIVEKIT_RTC_UDP_PORT_END:-50100}:.../udp`. Preserve the `0.0.0.0:` prefixes and the existing UDP inline comment exactly.                                                                                                                     | developer        | none         | `clean-code`     |
| 2   | DONE   | In `docker-compose.yml`, parameterize the `redis-livekit-dev` host mapping to `0.0.0.0:${REDIS_LIVEKIT_PORT:-6379}:${REDIS_LIVEKIT_PORT:-6379}`, reusing the existing var on both host and container sides. Preserve the `0.0.0.0:` prefix.                                                                                                                                                                                                                                                                | developer        | none         | `clean-code`     |
| 3   | DONE   | In `docker-compose.yml`, parameterize the `nginx` host mappings only: `${NGINX_HTTP_PORT:-80}:80` and `${NGINX_HTTPS_PORT:-443}:443`. Do NOT touch container-internal listen ports.                                                                                                                                                                                                                                                                                                                        | developer        | none         | `clean-code`     |
| 4   | DONE   | In `livekit.template.yaml`, replace literals with placeholders: `port: ${LIVEKIT_PORT}`, `rtc.tcp_port: ${LIVEKIT_RTC_TCP_PORT}`, `port_range_start: ${LIVEKIT_RTC_UDP_PORT_START}`, `port_range_end: ${LIVEKIT_RTC_UDP_PORT_END}`. Leave `turn.tls_port: 5349` and `udp_port: 3478` unchanged.                                                                                                                                                                                                            | developer        | none         | `clean-code`     |
| 5   | DONE   | In `livekit-entrypoint.sh`, export defaults for the new vars (`LIVEKIT_PORT:-7880`, `LIVEKIT_RTC_TCP_PORT:-7881`, `LIVEKIT_RTC_UDP_PORT_START:-50000`, `LIVEKIT_RTC_UDP_PORT_END:-50100`) alongside the existing exports, keeping the existing comment about envsubst lacking `:-`.                                                                                                                                                                                                                        | developer        | task 4       | `clean-code`     |
| 6   | DONE   | In `nginx.template.conf`, change the `livekit_backend` upstream to `server host-gateway:${LIVEKIT_PORT};`. Leave `livekit_turn_backend` (`host-gateway:5349`), all Nginx-native `$variables`, and `listen 80/443` unchanged.                                                                                                                                                                                                                                                                               | developer        | none         | `clean-code`     |
| 7   | DONE   | In `nginx-entrypoint.sh`, export `LIVEKIT_PORT="${LIVEKIT_PORT:-7880}"` and add `${LIVEKIT_PORT}` to the explicit `envsubst` variable allowlist (so it becomes `'${LIVEKIT_DOMAIN} ${LIVEKIT_TURN_DOMAIN} ${LIVEKIT_PORT}'`), preserving the existing critical-comment block.                                                                                                                                                                                                                              | developer        | task 6       | `clean-code`     |
| 8   | DONE   | In `apps/livekit-infra/.env.example`, add documented entries for `LIVEKIT_PORT`, `LIVEKIT_RTC_TCP_PORT`, `LIVEKIT_RTC_UDP_PORT_START`, `LIVEKIT_RTC_UDP_PORT_END`, `NGINX_HTTP_PORT`, `NGINX_HTTPS_PORT` with dev/prod default guidance, matching the file's existing comment-block style. Confirm `REDIS_LIVEKIT_PORT` documentation still reflects host+container reuse.                                                                                                                                 | developer        | none         | `clean-code`     |
| 9   | DONE   | In `livekit-client/.env.example` and `livekit-server/.env.example`, keep `VITE_LIVEKIT_URL` / `LIVEKIT_URL` as `ws://localhost:7880` and add a comment noting the port must match `LIVEKIT_PORT` in `apps/livekit-infra/.env`.                                                                                                                                                                                                                                                                             | developer        | none         | `clean-code`     |
| 10  | DONE   | Run secret-scanner against the diff (`git diff \| .claude/skills/secret-scanner/scripts/scan-secrets.sh --diff`); confirm exit code 0 (all new vars are non-sensitive port numbers).                                                                                                                                                                                                                                                                                                                       | developer        | tasks 1–9    | `secret-scanner` |
| 11  | DONE   | Manual verification (Skip-Testing): from `apps/livekit-infra`, run `docker compose --profile dev config` and `docker compose --profile prod config` with no `.env` overrides and confirm all parameterized ports resolve to current defaults (7880, 7881, 50000-50100, 6379, 80, 443). Then run an entrypoint dry-render check (e.g. `LIVEKIT_PORT=8080 envsubst < livekit.template.yaml` and the nginx envsubst allowlist) to confirm shared-var override propagates to both host and container/upstream. | developer        | task 10      | none             |

> Notes for Root Agent:
>
> - Testing Workflow is `Skip-Testing` (per PROJECT_OVERVIEW.md), so no `tester` sub-agent is routed. Task 11 is a manual `docker compose config` resolution check performed by the developer, not an automated test task.
> - Tasks 1–9 are independent edits and may be delegated in parallel; task 5 depends on 4 and task 7 depends on 6 only for naming consistency. Tasks 10 and 11 are sequential gates after all edits land.
> - Decision 2 note honored: the `host-gateway:5349` TURN upstream is intentionally left out of scope; only `LIVEKIT_PORT` tracking was requested. Flagged in Risks for future awareness.

### Critical Files for Implementation

- /Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-infra/docker-compose.yml
- /Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-infra/livekit.template.yaml
- /Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-infra/livekit-entrypoint.sh
- /Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-infra/nginx.template.conf
- /Users/nmthang6/Documents/Workspace/agent-assistant/apps/livekit-infra/nginx-entrypoint.sh
