# Plan: LiveKit Infra Template & Env Consolidation

- **Date**: 2026-05-23
- **Author**: Planner sub-agent
- **Status**: Ready for implementation

---

## Objective

Refactor `apps/livekit-infra/` to:

1. Consolidate environment files into a single `.env` (dev prefilled, gitignored) and `.env.example` (documented template).
2. Replace static LiveKit and Redis config files with template files rendered at runtime via `envsubst` inside custom Dockerfiles.
3. Update both `docker-compose.yml` (prod) and `docker-compose.development.yml` (dev) to use the new build-based approach.
4. Update `apps/livekit-infra/README.md` accordingly. Root `README.md` requires no changes.

---

## Scope

- **In scope**: All files under `apps/livekit-infra/`; `apps/livekit-infra/README.md`
- **Out of scope**: Root `README.md` (contains only `# CALL CENTER AGENT`, no livekit references); any file outside `apps/livekit-infra/`
- **Testing workflow**: `Skip-Testing` — no test tasks

---

## Tasks

### Task 1 — Delete obsolete files

**Files to delete (3 files + 1 conf):**

| File | Reason |
|------|--------|
| `apps/livekit-infra/livekit.yaml` | Replaced by `livekit.template.yaml` |
| `apps/livekit-infra/livekit.development.yaml` | Values folded into `.env` + template |
| `apps/livekit-infra/.env.development` | Replaced by unified `.env` |
| `apps/livekit-infra/redis-livekit.conf` | Replaced by `redis-livekit.template.conf` |

**Actions**: `git rm` each file. The `.gitignore` already ignores `.env` so no gitignore change is needed.

---

### Task 2 — Create `apps/livekit-infra/.env`

**Purpose**: Active working copy for local development (gitignored). Contains dev values prefilled and commented-out prod guidance.

**Variable list (keys + intended values — no secrets written):**

```dotenv
# ==============================================================================
# LiveKit Infra — Local environment file
# This file is gitignored. Copy from .env.example and fill in your values.
# Dev values are prefilled below. For production, uncomment and override.
# ==============================================================================

# ------------------------------------------------------------------------------
# LiveKit API credentials
# Dev: safe placeholder values. Prod: generate real key/secret.
# ------------------------------------------------------------------------------
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret

# ------------------------------------------------------------------------------
# LiveKit domain names (used by Nginx, TURN, and webhook URL)
# Dev: not needed (no TLS/TURN). Prod: set to your real domains.
# ------------------------------------------------------------------------------
LIVEKIT_DOMAIN=livekit.YOURDOMAIN.COM
LIVEKIT_TURN_DOMAIN=livekit-turn.YOURDOMAIN.COM

# ------------------------------------------------------------------------------
# LiveKit RTC settings
# Dev: external IP disabled, loopback candidate enabled (for local browser testing)
# Prod: external IP enabled, loopback candidate disabled
# ------------------------------------------------------------------------------
LIVEKIT_USE_EXTERNAL_IP=false
LIVEKIT_ENABLE_LOOPBACK_CANDIDATE=true

# ------------------------------------------------------------------------------
# LiveKit TURN settings
# Dev: TURN disabled. Prod: TURN enabled.
# ------------------------------------------------------------------------------
LIVEKIT_TURN_ENABLED=false
LIVEKIT_TURN_CERT_FILE=
LIVEKIT_TURN_KEY_FILE=

# ------------------------------------------------------------------------------
# LiveKit Redis address (as seen by the livekit container)
# Dev: service name on bridge network. Prod: loopback (host network).
# ------------------------------------------------------------------------------
LIVEKIT_REDIS_ADDRESS=redis-livekit:6379

# ------------------------------------------------------------------------------
# LiveKit webhook URL
# Dev: host.docker.internal resolves to the host machine from inside Docker.
# Prod: public HTTPS URL of your call-center-agent API.
# ------------------------------------------------------------------------------
LIVEKIT_WEBHOOK_URL=http://host.docker.internal:3000/webhook

# ------------------------------------------------------------------------------
# Redis — LiveKit dedicated instance bind address and port
# Dev: 0.0.0.0 (bridge network, all interfaces). Prod: 127.0.0.1 (loopback only).
# ------------------------------------------------------------------------------
REDIS_LIVEKIT_BIND=0.0.0.0
REDIS_LIVEKIT_PORT=6379

# ------------------------------------------------------------------------------
# PostgreSQL application database
# Dev: safe local values. Prod: set strong credentials.
# ------------------------------------------------------------------------------
POSTGRES_DB=callcenter_dev
POSTGRES_USER=callcenter
POSTGRES_PASSWORD=callcenter_dev_password

# ------------------------------------------------------------------------------
# Certbot TLS certificate email (prod only — not used in dev)
# ------------------------------------------------------------------------------
CERTBOT_EMAIL=

# ------------------------------------------------------------------------------
# Redis — Application cache/queue (exposed on host port 6380)
# ------------------------------------------------------------------------------
REDIS_APP_PORT=6380
```

---

### Task 3 — Create `apps/livekit-infra/.env.example`

**Purpose**: Committed template with no real values. Documents every variable with comments, format hints, and dev/prod context.

**Structure** (keys and comments only — same variable names as `.env`, all values blank or documented with format examples):

```dotenv
# ==============================================================================
# LiveKit Infra — Environment variable template
# Copy this file to .env and fill in your values.
# This file is committed to the repository — do NOT put real secrets here.
# ==============================================================================

# ------------------------------------------------------------------------------
# LiveKit API credentials
# Generate with: lk generate-api-key (or via LiveKit dashboard for LiveKit Cloud)
# Dev example:   LIVEKIT_API_KEY=devkey
# Prod example:  LIVEKIT_API_KEY=APIxxxxxxxxxxxxxxxxxxx
# ------------------------------------------------------------------------------
LIVEKIT_API_KEY=

# Dev example:  LIVEKIT_API_SECRET=devsecret
# Prod example: LIVEKIT_API_SECRET=<64-char random string>
LIVEKIT_API_SECRET=

# ------------------------------------------------------------------------------
# LiveKit domain names
# Create A records: livekit.YOURDOMAIN.COM and livekit-turn.YOURDOMAIN.COM → server IP
# Dev example:  LIVEKIT_DOMAIN=livekit.YOURDOMAIN.COM  (not used in dev mode)
# Prod example: LIVEKIT_DOMAIN=livekit.acme.com
# ------------------------------------------------------------------------------
LIVEKIT_DOMAIN=
LIVEKIT_TURN_DOMAIN=

# ------------------------------------------------------------------------------
# LiveKit RTC — external IP detection and loopback candidate
# Dev:  LIVEKIT_USE_EXTERNAL_IP=false  /  LIVEKIT_ENABLE_LOOPBACK_CANDIDATE=true
# Prod: LIVEKIT_USE_EXTERNAL_IP=true   /  LIVEKIT_ENABLE_LOOPBACK_CANDIDATE=false
# ------------------------------------------------------------------------------
LIVEKIT_USE_EXTERNAL_IP=
LIVEKIT_ENABLE_LOOPBACK_CANDIDATE=

# ------------------------------------------------------------------------------
# LiveKit TURN server settings
# Dev:  LIVEKIT_TURN_ENABLED=false  (no TURN needed locally)
# Prod: LIVEKIT_TURN_ENABLED=true
# ------------------------------------------------------------------------------
LIVEKIT_TURN_ENABLED=

# TURN TLS certificate paths (inside the livekit container)
# Leave empty for dev. Prod example:
#   LIVEKIT_TURN_CERT_FILE=/etc/letsencrypt/live/livekit-turn.YOURDOMAIN.COM/fullchain.pem
#   LIVEKIT_TURN_KEY_FILE=/etc/letsencrypt/live/livekit-turn.YOURDOMAIN.COM/privkey.pem
LIVEKIT_TURN_CERT_FILE=
LIVEKIT_TURN_KEY_FILE=

# ------------------------------------------------------------------------------
# LiveKit Redis address (as seen inside the livekit container)
# Dev:  redis-livekit:6379  (bridge network — use Docker service name)
# Prod: 127.0.0.1:6379      (host network — loopback)
# ------------------------------------------------------------------------------
LIVEKIT_REDIS_ADDRESS=

# ------------------------------------------------------------------------------
# LiveKit webhook URL (called by LiveKit server on room events)
# Dev:  http://host.docker.internal:3000/webhook
# Prod: https://livekit.YOURDOMAIN.COM/webhook  (or your API server URL)
# ------------------------------------------------------------------------------
LIVEKIT_WEBHOOK_URL=

# ------------------------------------------------------------------------------
# Redis — LiveKit dedicated instance
# REDIS_LIVEKIT_BIND: interface to bind to
#   Dev:  0.0.0.0   (bridge network, accessible within Docker network)
#   Prod: 127.0.0.1 (host network, loopback only — do not expose publicly)
# REDIS_LIVEKIT_PORT: internal Redis port (almost always 6379)
#   Dev/Prod: 6379
# ------------------------------------------------------------------------------
REDIS_LIVEKIT_BIND=
REDIS_LIVEKIT_PORT=

# ------------------------------------------------------------------------------
# PostgreSQL application database
# Dev example:  POSTGRES_DB=callcenter_dev
# Prod example: POSTGRES_DB=callcenter_prod
# ------------------------------------------------------------------------------
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=

# ------------------------------------------------------------------------------
# Certbot — email used for TLS certificate registration (prod only)
# Example: CERTBOT_EMAIL=admin@YOURDOMAIN.COM
# ------------------------------------------------------------------------------
CERTBOT_EMAIL=

# ------------------------------------------------------------------------------
# Redis — Application cache/queue host port
# Default: 6380 (avoids conflict with redis-livekit on 6379)
# ------------------------------------------------------------------------------
REDIS_APP_PORT=6380
```

---

### Task 4 — Create `apps/livekit-infra/livekit.template.yaml`

**Purpose**: Static YAML structure with `${VAR}` placeholders for all environment-dependent values. Committed to the repo.

**Key design notes:**
- All placeholders use simple `${VAR}` — no `${VAR:-default}` syntax (envsubst does not support defaults).
- Defaults are handled in `livekit-entrypoint.sh` before `envsubst` is called.
- The `cert_file` / `key_file` lines under `turn:` are always present; when empty strings are passed they become empty YAML values, which LiveKit treats as "not set".

**File content:**

```yaml
# LiveKit Server Configuration
# This file is a template. Do NOT edit directly.
# Variable substitution is performed by livekit-entrypoint.sh at container startup.

port: 7880

rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: ${LIVEKIT_USE_EXTERNAL_IP}
  enable_loopback_candidate: ${LIVEKIT_ENABLE_LOOPBACK_CANDIDATE}

redis:
  address: ${LIVEKIT_REDIS_ADDRESS}

turn:
  enabled: ${LIVEKIT_TURN_ENABLED}
  domain: ${LIVEKIT_TURN_DOMAIN}
  tls_port: 5349
  udp_port: 3478
  external_tls: true
  cert_file: ${LIVEKIT_TURN_CERT_FILE}
  key_file: ${LIVEKIT_TURN_KEY_FILE}

keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}

webhook:
  api_key: ${LIVEKIT_API_KEY}
  urls:
    - ${LIVEKIT_WEBHOOK_URL}
```

---

### Task 5 — Create `apps/livekit-infra/livekit-entrypoint.sh`

**Purpose**: Container entrypoint that exports defaults for any unset variables, runs `envsubst`, then `exec`s `livekit-server`. The `"$@"` passthrough allows `--dev` and other flags from `docker compose command:`.

**File content:**

```sh
#!/bin/sh
set -e

# Export defaults for variables that may be unset.
# envsubst does not support ${VAR:-default} syntax — defaults must be set here.
export LIVEKIT_USE_EXTERNAL_IP="${LIVEKIT_USE_EXTERNAL_IP:-false}"
export LIVEKIT_ENABLE_LOOPBACK_CANDIDATE="${LIVEKIT_ENABLE_LOOPBACK_CANDIDATE:-true}"
export LIVEKIT_TURN_ENABLED="${LIVEKIT_TURN_ENABLED:-false}"
export LIVEKIT_TURN_DOMAIN="${LIVEKIT_TURN_DOMAIN:-}"
export LIVEKIT_TURN_CERT_FILE="${LIVEKIT_TURN_CERT_FILE:-}"
export LIVEKIT_TURN_KEY_FILE="${LIVEKIT_TURN_KEY_FILE:-}"
export LIVEKIT_REDIS_ADDRESS="${LIVEKIT_REDIS_ADDRESS:-redis-livekit:6379}"
export LIVEKIT_WEBHOOK_URL="${LIVEKIT_WEBHOOK_URL:-http://host.docker.internal:3000/webhook}"
export LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-devkey}"
export LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-devsecret}"

envsubst < /livekit.template.yaml > /livekit.yaml

exec livekit-server --config /livekit.yaml "$@"
```

**Permissions**: Must be `chmod +x` — handle in Dockerfile via `RUN chmod +x`.

---

### Task 6 — Create `apps/livekit-infra/Dockerfile.livekit`

**Purpose**: Custom image that installs `gettext` (provides `envsubst`), copies the template and entrypoint, and sets the entrypoint.

**File content:**

```dockerfile
FROM livekit/livekit-server:v1.8

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy template and entrypoint
COPY livekit.template.yaml /livekit.template.yaml
COPY livekit-entrypoint.sh /livekit-entrypoint.sh
RUN chmod +x /livekit-entrypoint.sh

ENTRYPOINT ["/livekit-entrypoint.sh"]
```

**Note**: `livekit/livekit-server` is Alpine-based — `apk` is the correct package manager.

---

### Task 7 — Create `apps/livekit-infra/redis-livekit.template.conf`

**Purpose**: Redis config template with `${REDIS_LIVEKIT_BIND}` and `${REDIS_LIVEKIT_PORT}` placeholders. Committed to the repo.

**File content:**

```conf
# Redis configuration template for LiveKit dedicated instance
# Variable substitution is performed by redis-livekit-entrypoint.sh at container startup.

bind ${REDIS_LIVEKIT_BIND}
port ${REDIS_LIVEKIT_PORT}
protected-mode yes
tcp-keepalive 300
```

---

### Task 8 — Create `apps/livekit-infra/redis-livekit-entrypoint.sh`

**Purpose**: Container entrypoint that exports defaults, runs `envsubst`, then `exec`s `redis-server`.

**File content:**

```sh
#!/bin/sh
set -e

# Export defaults for variables that may be unset.
export REDIS_LIVEKIT_BIND="${REDIS_LIVEKIT_BIND:-0.0.0.0}"
export REDIS_LIVEKIT_PORT="${REDIS_LIVEKIT_PORT:-6379}"

envsubst < /redis-livekit.template.conf > /etc/redis/redis.conf

exec redis-server /etc/redis/redis.conf
```

**Permissions**: Must be `chmod +x` — handle in Dockerfile via `RUN chmod +x`.

---

### Task 9 — Create `apps/livekit-infra/Dockerfile.redis-livekit`

**Purpose**: Custom Redis image that installs `gettext`, copies the template and entrypoint, and sets the entrypoint.

**File content:**

```dockerfile
FROM redis:7-alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy template and entrypoint
COPY redis-livekit.template.conf /redis-livekit.template.conf
COPY redis-livekit-entrypoint.sh /redis-livekit-entrypoint.sh
RUN chmod +x /redis-livekit-entrypoint.sh

ENTRYPOINT ["/redis-livekit-entrypoint.sh"]
```

---

### Task 10 — Update `apps/livekit-infra/docker-compose.yml` (single file, profiles)

**Revised approach (user approval)**: Use a single `docker-compose.yml` with Docker Compose profiles instead of separate prod and dev files.

- `profiles: [prod]` — nginx, livekit (host network), redis-livekit (host network)
- `profiles: [dev]`  — livekit-dev (bridge, ports 7880/7881, `command: --dev`), redis-livekit-dev (bridge, port 6379)
- `profiles: [dev, prod]` — postgres, redis-app (shared)

**Usage:**
- Dev:  `docker compose --profile dev up -d`
- Prod: `docker compose --profile prod up -d`

**Note on service naming**: Docker Compose does not allow duplicate service names in a single file, so dev LiveKit variants are named `livekit-dev` and `redis-livekit-dev`. This is required because prod uses `network_mode: host` and dev uses bridge networking.

**Full resulting `docker-compose.yml`:**

```yaml
# LiveKit Self-Hosted Stack
#
# Usage:
#   Development: docker compose --profile dev up -d
#   Production:  docker compose --profile prod up -d
#
# Profiles:
#   prod — nginx, livekit (host network), redis-livekit (host network), postgres, redis-app
#   dev  — livekit-dev (bridge), redis-livekit-dev (bridge), postgres, redis-app
#
# NOTE: network_mode: host (prod livekit / redis-livekit) is Linux-only.
#       Not supported on Docker Desktop for Mac/Windows — use --profile dev instead.

services:
  # ---------------------------------------------------------------------------
  # Nginx — SNI passthrough reverse proxy (prod only)
  # ---------------------------------------------------------------------------
  nginx:
    profiles: [prod]
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/www:/var/www/certbot:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    extra_hosts:
      - 'host-gateway:host-gateway'
    depends_on:
      - livekit

  # ---------------------------------------------------------------------------
  # LiveKit Server — production (host network)
  # ---------------------------------------------------------------------------
  livekit:
    profiles: [prod]
    build:
      context: .
      dockerfile: Dockerfile.livekit
    restart: unless-stopped
    network_mode: host
    env_file:
      - .env
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - redis-livekit

  # ---------------------------------------------------------------------------
  # Redis — LiveKit dedicated message bus, production (host network, loopback only)
  # ---------------------------------------------------------------------------
  redis-livekit:
    profiles: [prod]
    build:
      context: .
      dockerfile: Dockerfile.redis-livekit
    restart: unless-stopped
    network_mode: host
    env_file:
      - .env

  # ---------------------------------------------------------------------------
  # LiveKit Server — development (bridge network, cross-platform)
  # ---------------------------------------------------------------------------
  livekit-dev:
    profiles: [dev]
    build:
      context: .
      dockerfile: Dockerfile.livekit
    restart: unless-stopped
    ports:
      - '0.0.0.0:7880:7880'
      - '0.0.0.0:7881:7881'
    env_file:
      - .env
    command: --dev
    depends_on:
      - redis-livekit-dev

  # ---------------------------------------------------------------------------
  # Redis — LiveKit dedicated message bus, development (bridge network)
  # ---------------------------------------------------------------------------
  redis-livekit-dev:
    profiles: [dev]
    build:
      context: .
      dockerfile: Dockerfile.redis-livekit
    restart: unless-stopped
    ports:
      - '0.0.0.0:6379:6379'
    env_file:
      - .env

  # ---------------------------------------------------------------------------
  # PostgreSQL — Application database (shared, bridge network)
  # ---------------------------------------------------------------------------
  postgres:
    profiles: [dev, prod]
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - '127.0.0.1:5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

  # ---------------------------------------------------------------------------
  # Redis App — Application cache / queue (shared, bridge network)
  # ---------------------------------------------------------------------------
  redis-app:
    profiles: [dev, prod]
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - '127.0.0.1:${REDIS_APP_PORT:-6380}:6379'

volumes:
  postgres_data:
```

---

### Task 11 — Delete `apps/livekit-infra/docker-compose.development.yml`

**Reason**: User approved revised plan to use a single `docker-compose.yml` with Docker Compose profiles. The dev stack is now included as `livekit-dev` and `redis-livekit-dev` services (with `profiles: [dev]`) inside `docker-compose.yml`.

**Action**: `git rm apps/livekit-infra/docker-compose.development.yml`

---

### Task 12 — Update `apps/livekit-infra/.gitignore`

**Current content** (only `.env` and local variants are ignored). No change needed for new files — template files and Dockerfiles should be committed. Verify that `.env.development` is not explicitly listed; if it is, remove that entry since the file is now deleted.

**Action**: Read current `.gitignore` and confirm no cleanup is needed. If `.env.development` is listed explicitly, remove it.

> Current `.gitignore` content shows: `.env`, `.env.development.local`, `.env.test.local`, `.env.production.local`, `.env.local`, `.env.*.local` — `.env.development` is NOT explicitly listed, so no change required.

---

### Task 13 — Update `apps/livekit-infra/README.md`

**Sections to update:**

#### 13a. Service Inventory table
- Change `livekit` row: update `Image` column from `livekit/livekit-server:v1.8` to `Dockerfile.livekit (livekit/livekit-server:v1.8)`
- Change `redis-livekit` row: update `Image` column from `redis:7-alpine` to `Dockerfile.redis-livekit (redis:7-alpine)`

#### 13b. Setup Steps — Step 2 (Configure environment variables)
- Replace the important note about manually editing `livekit.yaml keys:` with a note that env vars are now substituted automatically at container startup via `envsubst`.
- Update the `nano .env` comment to reflect all new variables.

#### 13c. Setup Steps — Step 3 (Update domain placeholders)
- Remove the bullet for `livekit.yaml` (deleted).
- Keep only `init_script.sh` and `nginx/nginx.conf`.
- Add note that `LIVEKIT_DOMAIN`, `LIVEKIT_TURN_DOMAIN`, and `LIVEKIT_WEBHOOK_URL` are set in `.env`.

#### 13d. Upgrade Instructions
- Change `docker compose pull` to `docker compose build --pull` since services now use custom builds.

#### 13e. TURN TLS Certificate Configuration section
- Remove the manual YAML edit instructions.
- Replace with: "Set `LIVEKIT_TURN_CERT_FILE` and `LIVEKIT_TURN_KEY_FILE` in `.env` to the certificate paths. The entrypoint script substitutes these into `livekit.template.yaml` at startup."

#### 13f. Troubleshooting table
- Update `redis-livekit not started or wrong address` row: change `livekit.yaml must use 127.0.0.1:6379` to `LIVEKIT_REDIS_ADDRESS in .env must be 127.0.0.1:6379 for prod`.

#### 13g. Development Stack — Quickstart section
- Remove `--env-file .env.development` from the `docker compose` command.
- Update to: `docker compose -f docker-compose.development.yml up -d`

#### 13h. Development Stack — SDK Connection Details section
- Remove reference to `livekit.development.yaml` and `infra/.env.development`.
- Replace with: "These values match the `keys:` section rendered from `livekit.template.yaml` using the dev values in `.env`."

#### 13i. Development Stack — UDP Media Ports Note section
- Remove reference to `livekit.development.yaml`.
- Replace with: "Set `LIVEKIT_ENABLE_LOOPBACK_CANDIDATE=true` in `.env` (dev default)."
- Update the remote device note: replace `use_external_ip: false` in `livekit.development.yaml` with `LIVEKIT_USE_EXTERNAL_IP=false` in `.env`.

---

## Execution Order

Tasks must be executed in this order to avoid broken intermediate states:

```
1  → Delete obsolete files (livekit.yaml, livekit.development.yaml, .env.development, redis-livekit.conf)
2  → Create .env (dev prefilled)
3  → Create .env.example (documented template)
4  → Create livekit.template.yaml
5  → Create livekit-entrypoint.sh
6  → Create Dockerfile.livekit
7  → Create redis-livekit.template.conf
8  → Create redis-livekit-entrypoint.sh
9  → Create Dockerfile.redis-livekit
10 → Update docker-compose.yml (prod)
11 → Update docker-compose.development.yml (dev)
12 → Verify .gitignore (no change required)
13 → Update README.md
```

---

## File Change Summary

| Action | File |
|--------|------|
| DELETE | `apps/livekit-infra/livekit.yaml` |
| DELETE | `apps/livekit-infra/livekit.development.yaml` |
| DELETE | `apps/livekit-infra/.env.development` |
| DELETE | `apps/livekit-infra/redis-livekit.conf` |
| CREATE | `apps/livekit-infra/.env` |
| CREATE | `apps/livekit-infra/.env.example` |
| CREATE | `apps/livekit-infra/livekit.template.yaml` |
| CREATE | `apps/livekit-infra/livekit-entrypoint.sh` |
| CREATE | `apps/livekit-infra/Dockerfile.livekit` |
| CREATE | `apps/livekit-infra/redis-livekit.template.conf` |
| CREATE | `apps/livekit-infra/redis-livekit-entrypoint.sh` |
| CREATE | `apps/livekit-infra/Dockerfile.redis-livekit` |
| MODIFY | `apps/livekit-infra/docker-compose.yml` |
| DELETE | `apps/livekit-infra/docker-compose.development.yml` |
| MODIFY | `apps/livekit-infra/README.md` |
| NO CHANGE | `apps/livekit-infra/.gitignore` |
| NO CHANGE | `README.md` (root) |

---

## Key Constraints & Decisions

- **envsubst limitation**: `${VAR:-default}` is not supported. All defaults are set in the entrypoint scripts using shell syntax before `envsubst` is called.
- **`"$@"` passthrough**: Both entrypoint scripts use `exec ... "$@"` so `docker compose command:` flags (`--dev`) are passed through correctly.
- **`livekit/livekit-server` base image**: Alpine-based — use `apk add --no-cache gettext`.
- **`redis:7-alpine` base image**: Alpine-based — use `apk add --no-cache gettext`.
- **TURN cert/key as empty strings**: When `LIVEKIT_TURN_CERT_FILE=` and `LIVEKIT_TURN_KEY_FILE=` are empty, the rendered YAML will have `cert_file: ` and `key_file: ` (empty values), which LiveKit interprets as not configured. This is correct behavior for dev.
- **No prod `command:` override**: The prod `docker-compose.yml` livekit service should have no `command:` key (entrypoint starts the server without `--dev`).
- **Dev `command: --dev`**: The dev compose file passes `--dev` through the entrypoint's `"$@"`.
- **`.env` is gitignored**: Confirmed by current `.gitignore`. The new `.env` file (with dev prefilled values) will not be committed.
