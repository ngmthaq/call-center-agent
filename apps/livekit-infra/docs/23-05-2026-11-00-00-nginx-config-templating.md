# Plan: Nginx Config Templating

- **Date**: 2026-05-23
- **Author**: Planner sub-agent
- **Status**: Ready for implementation

---

## Objective

Replace the static `nginx/nginx.conf` (which contains hardcoded domain names) with a runtime-rendered template. A custom `Dockerfile.nginx` builds on `nginx:1.27-alpine`, bakes in the template and an entrypoint script that runs `envsubst` at container startup to produce `/etc/nginx/nginx.conf` with the correct domain values from the `.env` file.

---

## Scope

- **In scope**: All files under `apps/livekit-infra/`; `apps/livekit-infra/README.md`
- **Out of scope**: Any file outside `apps/livekit-infra/`; root `README.md`
- **Testing workflow**: Skip-Testing — no test tasks

---

## Background

The prior refactor (`23-05-2026-10-00-00-livekit-infra-template-env-consolidation.md`) introduced:
- A unified `.env` / `.env.example` with `LIVEKIT_DOMAIN` and `LIVEKIT_TURN_DOMAIN` keys
- `Dockerfile.livekit`, `Dockerfile.redis-livekit`, and matching entrypoint scripts
- A single `docker-compose.yml` with `prod` / `dev` profiles

The nginx service was left using `image: nginx:1.27-alpine` with `./nginx/nginx.conf` mounted read-only. The `nginx/nginx.conf` file still contains hardcoded `livekit.YOURDOMAIN.COM` and `livekit-turn.YOURDOMAIN.COM` in the SNI map block.

This plan closes that gap by applying the same template-plus-Dockerfile pattern to Nginx.

---

## Critical Constraint — envsubst and Nginx Variables

Nginx config files use `$variable` syntax throughout (e.g. `$ssl_preread_server_name`, `$remote_addr`, `$host`, `$request_uri`, `$upstream_backend`, `$time_local`, `$protocol`, `$status`, `$bytes_sent`, `$bytes_received`, `$session_time`, `$upstream_addr`, `$remote_user`, `$request`, `$body_bytes_sent`, `$http_referer`, `$http_user_agent`).

Running plain `envsubst < template > output` would corrupt all of those Nginx variables by treating them as shell variables to substitute.

The entrypoint script MUST pass an explicit variable list to `envsubst`:

```sh
envsubst '${LIVEKIT_DOMAIN} ${LIVEKIT_TURN_DOMAIN}' < /nginx.template.conf > /etc/nginx/nginx.conf
```

This instructs `envsubst` to substitute **only** `${LIVEKIT_DOMAIN}` and `${LIVEKIT_TURN_DOMAIN}` and leave all other `$...` patterns untouched.

---

## Tasks

### Task 1 — Create `apps/livekit-infra/nginx.template.conf`

**User amendment**: Place the template at the livekit-infra root (not inside `nginx/`). The entire `nginx/` directory is removed in Task 2.

**Purpose**: A copy of the current `nginx/nginx.conf` with `${LIVEKIT_DOMAIN}` and `${LIVEKIT_TURN_DOMAIN}` substituted into the SNI map block. Everything else remains exactly as-is. Committed to the repo.

**Only two lines change** relative to the current `nginx/nginx.conf`:

| Line (original)                                 | Line (template)                                         |
| ----------------------------------------------- | ------------------------------------------------------- |
| `livekit.YOURDOMAIN.COM      livekit_backend;`  | `${LIVEKIT_DOMAIN}      livekit_backend;`               |
| `livekit-turn.YOURDOMAIN.COM livekit_turn_backend;` | `${LIVEKIT_TURN_DOMAIN} livekit_turn_backend;`      |

**File content:**

```nginx
# Nginx Configuration for LiveKit Self-Hosted Stack
#
# Architecture:
#   - stream{} block on port 443: SNI-based TCP passthrough (ngx_stream_ssl_preread_module)
#     * livekit.YOURDOMAIN.COM      -> host-gateway:7880  (LiveKit HTTP/WS, plain TCP)
#     * livekit-turn.YOURDOMAIN.COM -> host-gateway:5349  (LiveKit TURN TLS, raw passthrough)
#   - http{} block on port 80:
#     * /.well-known/acme-challenge/ served from /var/www/certbot (Certbot HTTP-01)
#     * All other requests: 301 redirect to HTTPS
#
# IMPORTANT: Nginx does NOT terminate TLS here. All TLS is handled by upstream services.
# The stream block reads the SNI field (ssl_preread) and routes the raw connection.
#
# This file is a template. Do NOT edit directly.
# Variable substitution is performed by nginx-entrypoint.sh at container startup.
# Only ${LIVEKIT_DOMAIN} and ${LIVEKIT_TURN_DOMAIN} are substituted — all other
# $variable references are Nginx variables and are left untouched.

worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

# Load the stream module (included in nginx:alpine)
load_module modules/ngx_stream_module.so;

events {
  worker_connections 1024;
}

# ---------------------------------------------------------------------------
# Stream block — SNI-based TCP passthrough on port 443
# ---------------------------------------------------------------------------
stream {
  # Log format for stream connections
  log_format stream_log '$remote_addr [$time_local] '
                        '$protocol $status $bytes_sent $bytes_received '
                        '$session_time "$upstream_addr"';

  access_log /var/log/nginx/stream_access.log stream_log;

  # Upstream: LiveKit server (WebSocket + HTTP, TLS terminated by LiveKit)
  upstream livekit_backend {
    server host-gateway:7880;
  }

  # Upstream: LiveKit built-in TURN server (raw TLS passthrough — LiveKit owns the cert)
  upstream livekit_turn_backend {
    server host-gateway:5349;
  }

  # Map SNI hostname to the correct upstream name
  map $ssl_preread_server_name $upstream_backend {
    ${LIVEKIT_DOMAIN}      livekit_backend;
    ${LIVEKIT_TURN_DOMAIN} livekit_turn_backend;
    # Default: drop unknown SNI names to livekit backend (or define a 'default_backend')
    default                livekit_backend;
  }

  server {
    listen 443;

    # Read the SNI field without terminating TLS — raw bytes are forwarded as-is
    ssl_preread on;

    # Forward the raw TCP connection to the mapped upstream
    proxy_pass $upstream_backend;

    # Pass the real client IP to upstream where supported
    proxy_protocol off;

    # Connection timeout settings
    proxy_connect_timeout 10s;
    proxy_timeout 600s;
  }
}

# ---------------------------------------------------------------------------
# HTTP block — port 80 only (ACME challenge + HTTPS redirect)
# ---------------------------------------------------------------------------
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;

  log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                  '$status $body_bytes_sent "$http_referer" '
                  '"$http_user_agent"';

  access_log /var/log/nginx/access.log main;

  sendfile on;
  keepalive_timeout 65;

  server {
    listen 80;
    server_name _;

    # Certbot HTTP-01 challenge — files written by certbot --webroot to /var/www/certbot
    location /.well-known/acme-challenge/ {
      root /var/www/certbot;
    }

    # Redirect all other HTTP traffic to HTTPS
    location / {
      return 301 https://$host$request_uri;
    }
  }
}
```

---

### Task 2 — Delete the `apps/livekit-infra/nginx/` directory entirely

**Reason**: Contents moved to `nginx.template.conf` at the livekit-infra root. The whole directory is removed.

**Action**: `git rm -r apps/livekit-infra/nginx/` (removes `nginx.conf` and `nginx/.gitkeep`)

---

### Task 3 — Create `apps/livekit-infra/nginx-entrypoint.sh`

**Purpose**: Container entrypoint that exports defaults for `LIVEKIT_DOMAIN` and `LIVEKIT_TURN_DOMAIN`, runs `envsubst` with an explicit variable list (to protect Nginx `$variable` syntax), then `exec`s `nginx`.

**File content:**

```sh
#!/bin/sh
set -e

# Export defaults for variables that may be unset.
# envsubst does not support ${VAR:-default} syntax — defaults must be set here.
export LIVEKIT_DOMAIN="${LIVEKIT_DOMAIN:-livekit.YOURDOMAIN.COM}"
export LIVEKIT_TURN_DOMAIN="${LIVEKIT_TURN_DOMAIN:-livekit-turn.YOURDOMAIN.COM}"

# CRITICAL: pass an explicit variable list to envsubst.
# Without this, envsubst would replace ALL $variable occurrences, corrupting
# the many Nginx-native $variable references in the config (e.g. $remote_addr,
# $ssl_preread_server_name, $upstream_backend, $host, $request_uri, etc.).
envsubst '${LIVEKIT_DOMAIN} ${LIVEKIT_TURN_DOMAIN}' \
  < /nginx.template.conf \
  > /etc/nginx/nginx.conf

exec nginx -g "daemon off;"
```

**Permissions**: Must be `chmod +x` — handled in `Dockerfile.nginx` via `RUN chmod +x`.

---

### Task 4 — Create `apps/livekit-infra/Dockerfile.nginx`

**Purpose**: Custom image that installs `gettext` (provides `envsubst`), copies the template and entrypoint into the image, sets execute permissions, and sets the custom entrypoint.

**File content:**

```dockerfile
FROM nginx:1.27-alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy template and entrypoint
COPY nginx.template.conf /nginx.template.conf
COPY nginx-entrypoint.sh /nginx-entrypoint.sh
RUN chmod +x /nginx-entrypoint.sh

ENTRYPOINT ["/nginx-entrypoint.sh"]
```

**Notes:**
- `nginx:1.27-alpine` is Alpine-based — `apk` is the correct package manager.
- The template is copied to `/nginx.template.conf` (root of the image). The entrypoint writes the rendered config to `/etc/nginx/nginx.conf`, which is the standard Nginx config path inside the container.
- The `ENTRYPOINT` directive replaces the default nginx entrypoint. The `exec nginx -g "daemon off;"` in the entrypoint script keeps the nginx process as PID 1 for correct signal handling.

---

### Task 5 — Update `apps/livekit-infra/docker-compose.yml` nginx service

**Scope**: Only the `nginx` service block changes. All other services remain exactly as-is.

**Changes:**
1. Replace `image: nginx:1.27-alpine` with a `build:` block pointing to `Dockerfile.nginx`
2. Add `env_file: [.env]` so Docker Compose injects `LIVEKIT_DOMAIN` and `LIVEKIT_TURN_DOMAIN` into the container at startup
3. Remove the `./nginx/nginx.conf:/etc/nginx/nginx.conf:ro` volume mount — the template is baked into the image; the entrypoint generates the config at runtime
4. Keep all other fields: `profiles`, `restart`, `ports`, `volumes` (certbot and letsencrypt mounts), `extra_hosts`, `depends_on`

**Resulting nginx service block:**

```yaml
  # ---------------------------------------------------------------------------
  # Nginx — SNI passthrough reverse proxy (prod only)
  # ---------------------------------------------------------------------------
  nginx:
    profiles: [prod]
    build:
      context: .
      dockerfile: Dockerfile.nginx
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./certbot/www:/var/www/certbot:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    extra_hosts:
      - 'host-gateway:host-gateway'
    depends_on:
      - livekit
```

---

### Task 6 — Update `apps/livekit-infra/README.md`

**Scope**: Targeted edits only. No restructuring.

#### 6a. Service Inventory table — nginx row

Update the `Image` column for the `nginx` row from `nginx:1.27-alpine` to `Dockerfile.nginx (nginx:1.27-alpine)`.

| Service | Image (before) | Image (after) |
|---------|---------------|--------------|
| `nginx` | `nginx:1.27-alpine` | `Dockerfile.nginx (nginx:1.27-alpine)` |

#### 6b. Setup Steps — Step 3 (Update domain placeholders)

Remove the bullet for `nginx/nginx.conf` from the list of files requiring manual domain substitution. The SNI map is now driven by `LIVEKIT_DOMAIN` and `LIVEKIT_TURN_DOMAIN` in `.env`.

**Before:**
```
Replace every occurrence of `YOURDOMAIN.COM` in these files with your actual domain:

- `init_script.sh` — `LIVEKIT_DOMAIN`, `LIVEKIT_TURN_DOMAIN` variables
- `nginx/nginx.conf` — the two entries in the `map` block

`LIVEKIT_DOMAIN`, `LIVEKIT_TURN_DOMAIN`, and `LIVEKIT_WEBHOOK_URL` are set in `.env` and substituted into the LiveKit config automatically at startup.
```

**After:**
```
Replace every occurrence of `YOURDOMAIN.COM` in this file with your actual domain:

- `init_script.sh` — `LIVEKIT_DOMAIN`, `LIVEKIT_TURN_DOMAIN` variables

`LIVEKIT_DOMAIN`, `LIVEKIT_TURN_DOMAIN`, and `LIVEKIT_WEBHOOK_URL` are set in `.env` and substituted automatically at container startup — no manual config file edits are required.
```

---

## Execution Order

Tasks must be executed in this order to avoid broken intermediate states:

```
1 → Create nginx/nginx.template.conf
2 → Delete nginx/nginx.conf
3 → Create nginx-entrypoint.sh
4 → Create Dockerfile.nginx
5 → Update docker-compose.yml (nginx service block only)
6 → Update README.md
```

Task 1 must come before Task 2 to ensure the template content is correct before the original is removed. Tasks 3 and 4 can be done in any order relative to each other. Task 5 must come after Task 4 (so the Dockerfile it references exists). Task 6 is independent and can be done last.

---

## File Change Summary

| Action    | File                                          |
| --------- | --------------------------------------------- |
| CREATE    | `apps/livekit-infra/nginx.template.conf`        |
| DELETE    | `apps/livekit-infra/nginx/` (entire directory)  |
| CREATE    | `apps/livekit-infra/nginx-entrypoint.sh`       |
| CREATE    | `apps/livekit-infra/Dockerfile.nginx`          |
| MODIFY    | `apps/livekit-infra/docker-compose.yml`        |
| MODIFY    | `apps/livekit-infra/README.md`                 |
| NO CHANGE | `apps/livekit-infra/.env`                      |
| NO CHANGE | `apps/livekit-infra/.env.example`              |
| NO CHANGE | `apps/livekit-infra/.gitignore`                |
| NO CHANGE | `apps/livekit-infra/init_script.sh`            |

---

## Key Constraints & Decisions

- **envsubst explicit variable list**: `envsubst '${LIVEKIT_DOMAIN} ${LIVEKIT_TURN_DOMAIN}'` — without the explicit list, all Nginx `$variable` references in the config would be corrupted. This is the most important implementation detail.
- **Defaults in entrypoint, not template**: `${VAR:-default}` syntax is not supported by `envsubst`. Defaults are set via `export VAR="${VAR:-default}"` in `nginx-entrypoint.sh` before `envsubst` is called.
- **`exec nginx -g "daemon off;"`**: Using `exec` replaces the shell process with nginx so nginx runs as PID 1 and receives Docker stop/restart signals correctly.
- **Template baked into image**: `nginx/nginx.template.conf` is copied into the image at build time (`COPY` in Dockerfile). There is no volume mount for the template — the rendered `/etc/nginx/nginx.conf` is generated fresh at each container startup from the baked-in template.
- **certbot and letsencrypt mounts retained**: `./certbot/www:/var/www/certbot:ro` and `/etc/letsencrypt:/etc/letsencrypt:ro` volume mounts are preserved unchanged — these are needed for ACME HTTP-01 challenge and certificate access.
- **Only two substitution targets**: `LIVEKIT_DOMAIN` and `LIVEKIT_TURN_DOMAIN` are the only variables that need substitution. All other nginx config content is static.
- **`nginx:1.27-alpine` base image**: Alpine-based — `apk add --no-cache gettext` is the correct install command.
- **`init_script.sh` still needs manual domain update**: The `init_script.sh` script contains hardcoded `YOURDOMAIN.COM` references that are not in scope for this plan. Step 3 of the README setup retains that instruction.
