# LiveKit Self-Hosted Infrastructure

This directory contains the complete Docker Compose stack for a self-hosted LiveKit deployment with Nginx as the reverse proxy. It replaces the default Caddy setup with an Nginx SNI-passthrough configuration that is compatible with LiveKit's built-in TURN TLS.

---

## Prerequisites

| Requirement                            | Notes                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| Linux VM (Ubuntu 22.04+ or Debian 12+) | `network_mode: host` is Linux-only — not supported on Docker Desktop for Mac/Windows |
| Root / sudo access                     | Required to install Docker, run Certbot, and manage systemd                          |
| Docker Engine 24+                      | Install via https://docs.docker.com/engine/install/                                  |
| Docker Compose v2+ (plugin)            | Included with Docker Engine 24+ as `docker compose`                                 |
| Certbot                                | Install via `snap install --classic certbot` or `apt install certbot`                |
| 2 domains pointing to the server       | See DNS Records section below                                                        |

---

## DNS Records

Create the following A records with your DNS provider before deploying. Both must resolve to the same server IP.

| Subdomain                     | Type | Value         | Purpose                      |
| ----------------------------- | ---- | ------------- | ---------------------------- |
| `livekit.YOURDOMAIN.COM`      | A    | `<server-ip>` | LiveKit WebSocket / HTTP     |
| `livekit-turn.YOURDOMAIN.COM` | A    | `<server-ip>` | LiveKit TURN TLS (port 5349) |

---

## Firewall Ports

Open the following ports in your server's firewall / security group:

| Protocol | Port(s)     | Direction | Purpose                                              |
| -------- | ----------- | --------- | ---------------------------------------------------- |
| TCP      | 80          | Inbound   | Certbot HTTP-01 ACME challenge + HTTP→HTTPS redirect |
| TCP      | 443         | Inbound   | Nginx SNI passthrough (routes to LiveKit and TURN)   |
| TCP      | 5349        | Inbound   | TURN TLS (ICE fallback — LiveKit handles TLS)        |
| TCP      | 7881        | Inbound   | WebRTC TCP fallback                                  |
| UDP      | 3478        | Inbound   | STUN / TURN UDP                                      |
| UDP      | 50000-60000 | Inbound   | WebRTC media streams                                 |

---

## Service Inventory

| Service            | Image                                          | Network Mode | Exposed Port(s)                               | Purpose                                                     |
| ------------------ | ---------------------------------------------- | ------------ | --------------------------------------------- | ----------------------------------------------------------- |
| `nginx`            | `Dockerfile.nginx (nginx:1.27-alpine)`          | bridge       | `0.0.0.0:80`, `0.0.0.0:443`                   | SNI passthrough reverse proxy; ACME HTTP-01; HTTPS redirect |
| `livekit`          | `Dockerfile.livekit (livekit/livekit-server:v1.8)` | host     | 7880 (HTTP/WS), 7881 (TCP), 50000-60000 (UDP) | LiveKit media server (prod)                                 |
| `redis-livekit`    | `Dockerfile.redis-livekit (redis:7-alpine)`    | host         | 127.0.0.1:6379                                | Redis for LiveKit internal pub/sub — loopback only (prod)   |
| `livekit-dev`      | `Dockerfile.livekit (livekit/livekit-server:v1.8)` | bridge   | 7880, 7881                                    | LiveKit media server (dev)                                  |
| `redis-livekit-dev`| `Dockerfile.redis-livekit (redis:7-alpine)`    | bridge       | 6379                                          | Redis for LiveKit internal pub/sub (dev)                    |
| `postgres`         | `postgres:16-alpine`                           | bridge       | `127.0.0.1:5432`                              | PostgreSQL database for the call-center-agent application   |
| `redis-app`        | `redis:7-alpine`                               | bridge       | `127.0.0.1:6380`                              | Redis cache/queue for the call-center-agent application     |

---

## Setup Steps

### 1. Copy the repository to the server

```bash
scp -r infra/ user@<server-ip>:/opt/livekit-setup/
ssh user@<server-ip>
cd /opt/livekit-setup/
```

### 2. Configure environment variables

```bash
cp .env.example .env
nano .env   # Fill in all values: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_DOMAIN, LIVEKIT_TURN_DOMAIN, LIVEKIT_USE_EXTERNAL_IP, LIVEKIT_ENABLE_LOOPBACK_CANDIDATE, LIVEKIT_TURN_ENABLED, LIVEKIT_TURN_CERT_FILE, LIVEKIT_TURN_KEY_FILE, LIVEKIT_REDIS_ADDRESS, LIVEKIT_WEBHOOK_URL, REDIS_LIVEKIT_BIND, REDIS_LIVEKIT_PORT, POSTGRES_*, CERTBOT_EMAIL, REDIS_APP_PORT
```

> **Note:** Environment variables are substituted automatically at container startup via `envsubst`. The `livekit-entrypoint.sh` script renders `livekit.template.yaml` into `livekit.yaml` inside the container before the server starts — no manual YAML editing is required.

### 3. Obtain TLS certificates

Start Nginx first so port 80 is reachable for the ACME HTTP-01 challenge:

```bash
docker compose --profile prod up -d nginx
```

Then run Certbot:

```bash
certbot certonly \
  --webroot \
  --webroot-path ./certbot/www \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --non-interactive \
  -d livekit.YOURDOMAIN.COM \
  -d livekit-turn.YOURDOMAIN.COM
```

Set up weekly auto-renewal with Nginx reload:

```bash
echo '0 3 * * 1 certbot renew --deploy-hook "docker compose -f /opt/livekit/docker-compose.yml exec nginx nginx -s reload" >> /var/log/certbot-renew.log 2>&1' \
  | sudo tee /etc/cron.d/certbot-livekit
```

### 4. Start the full stack

```bash
docker compose --profile prod up -d
```

To start automatically on boot, create a systemd unit:

```bash
sudo tee /etc/systemd/system/livekit-docker.service << 'EOF'
[Unit]
Description=LiveKit Self-Hosted Docker Compose Stack
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/livekit
ExecStart=/usr/bin/docker compose --profile prod -f /opt/livekit/docker-compose.yml up
ExecStop=/usr/bin/docker compose --profile prod -f /opt/livekit/docker-compose.yml down
Restart=on-failure
RestartSec=10s

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now livekit-docker
```

### 5. Verify the deployment

```bash
# Check all services are running
docker compose -f /opt/livekit/docker-compose.yml --profile prod ps

# View logs for a specific service
docker compose -f /opt/livekit/docker-compose.yml --profile prod logs -f livekit

# Test LiveKit health endpoint
curl https://livekit.YOURDOMAIN.COM/
```

---

## Upgrade Instructions

To rebuild with the latest base images and restart the stack:

```bash
cd /opt/livekit

# Rebuild images pulling latest base layers
docker compose build --pull

# Restart with the new images (zero-downtime rolling is not guaranteed)
docker compose --profile prod up -d --remove-orphans
```

If using the systemd unit:

```bash
sudo systemctl restart livekit-docker
```

---

## Application Connection Details

Services available to the host application (call-center-agent):

| Service     | Address                        | Notes                                                                    |
| ----------- | ------------------------------ | ------------------------------------------------------------------------ |
| PostgreSQL  | `127.0.0.1:5432`               | Bridge network; bound to loopback on host                                |
| Redis (app) | `127.0.0.1:6380`               | Bridge network; bound to loopback on host; separate from LiveKit's Redis |
| LiveKit SDK | `wss://livekit.YOURDOMAIN.COM` | Use `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` from `.env`                 |

---

## TURN TLS Certificate Configuration

The `livekit` service mounts `/etc/letsencrypt` into the container (read-only). To enable TURN TLS, set the following variables in `.env`:

```dotenv
LIVEKIT_TURN_ENABLED=true
LIVEKIT_TURN_CERT_FILE=/etc/letsencrypt/live/livekit-turn.YOURDOMAIN.COM/fullchain.pem
LIVEKIT_TURN_KEY_FILE=/etc/letsencrypt/live/livekit-turn.YOURDOMAIN.COM/privkey.pem
```

The `livekit-entrypoint.sh` script substitutes these values into `livekit.template.yaml` at container startup. These paths are available inside the container because the livekit service volume mounts `/etc/letsencrypt:/etc/letsencrypt:ro`.

---

## Certificate Renewal

Certbot renewal is handled by the weekly cron job installed in Step 3 (`/etc/cron.d/certbot-livekit`). After renewal, Nginx is reloaded automatically:

```
0 3 * * 1 certbot renew --deploy-hook "docker compose -f /opt/livekit/docker-compose.yml exec nginx nginx -s reload"
```

To test renewal manually:

```bash
certbot renew --dry-run
```

---

## Troubleshooting

| Problem                    | Likely Cause                                | Fix                                                                                       |
| -------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Port 80/443 not reachable  | Firewall rule missing                       | Open TCP 80 and 443 in your security group                                                |
| Certbot HTTP-01 fails      | DNS not propagated yet or Nginx not started | Verify DNS resolves; ensure Nginx container is running                                    |
| WebRTC media does not flow | UDP ports 50000-60000 blocked               | Open UDP range in firewall                                                                |
| `network_mode: host` error | Running on Docker Desktop                   | Deploy on a Linux host                                                                    |
| LiveKit can't reach Redis  | redis-livekit not started or wrong address  | Ensure `redis-livekit` is running; `LIVEKIT_REDIS_ADDRESS` in `.env` must be `127.0.0.1:6379` for prod |

---

## Development Stack

A simplified, cross-platform development stack is included in `docker-compose.yml` under the `dev` profile. It uses bridge networking (no `network_mode: host`) so it works on macOS, Linux, and Windows with Docker Desktop or Docker Engine. No TLS, no Nginx, and no Certbot are required.

### Prerequisites

| Requirement        | Notes                                                         |
| ------------------ | ------------------------------------------------------------- |
| Any OS             | macOS, Linux, or Windows with Docker Desktop or Docker Engine |
| Docker Engine 24+  | Docker Desktop includes this on macOS and Windows             |
| Docker Compose v2+ | Included with Docker Desktop; install as plugin on Linux      |

### Quickstart

```bash
# From the apps/livekit-infra/ directory
docker compose --profile dev up -d
```

To stop and remove containers (data volume is preserved):

```bash
docker compose --profile dev down
```

To stop and also remove the dev database volume:

```bash
docker compose --profile dev down -v
```

### Service Port Reference

| Service    | Host Address          | Purpose                                   |
| ---------- | --------------------- | ----------------------------------------- |
| LiveKit    | `ws://localhost:7880` | WebSocket / HTTP endpoint for SDK clients |
| PostgreSQL | `localhost:5432`      | Application database                      |
| Redis      | `localhost:6379`      | LiveKit message bus                       |

### SDK Connection Details

Use the following values when connecting via the LiveKit SDK or CLI tools:

```
LiveKit URL:    ws://localhost:7880
API Key:        devkey
API Secret:     devsecret
```

These values match the `keys:` section rendered from `livekit.template.yaml` using the dev values in `.env`.

### UDP Media Ports Note

The LiveKit server is configured with a UDP media port range of `50000–60000`. Set `LIVEKIT_ENABLE_LOOPBACK_CANDIDATE=true` in `.env` (dev default) so browsers and SDK clients running **on the same machine** as Docker will connect successfully without any extra firewall configuration.

If you need to connect to the dev stack from a **remote device** (e.g., a phone on the same LAN, or a remote developer machine), open UDP ports `50000–60000` in your host firewall and ensure `LIVEKIT_USE_EXTERNAL_IP=false` is set in `.env` (dev default). You may also need to configure `rtc.node_ip` in `livekit.template.yaml` to your machine's LAN IP for remote-device connectivity.
