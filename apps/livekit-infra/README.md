# LiveKit Self-Hosted Infrastructure

This directory contains the complete Docker Compose stack for a self-hosted LiveKit deployment with Nginx as the reverse proxy. It replaces the default Caddy setup with an Nginx SNI-passthrough configuration that is compatible with LiveKit's built-in TURN TLS.

---

## Prerequisites

| Requirement                            | Notes                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| Linux VM (Ubuntu 22.04+ or Debian 12+) | `network_mode: host` is Linux-only — not supported on Docker Desktop for Mac/Windows |
| Root / sudo access                     | Required to run `init_script.sh`                                                     |
| Docker Engine 24+                      | Installed automatically by `init_script.sh` if missing                               |
| Docker Compose v2+ (plugin)            | Installed automatically by `init_script.sh` if missing                               |
| Certbot                                | Installed automatically by `init_script.sh` if missing                               |
| 3 domains pointing to the server       | See DNS Records section below                                                        |

---

## DNS Records

Create the following A records with your DNS provider before running `init_script.sh`. All three must resolve to the same server IP.

| Subdomain                     | Type | Value         | Purpose                          |
| ----------------------------- | ---- | ------------- | -------------------------------- |
| `livekit.YOURDOMAIN.COM`      | A    | `<server-ip>` | LiveKit WebSocket / HTTP         |
| `livekit-turn.YOURDOMAIN.COM` | A    | `<server-ip>` | LiveKit TURN TLS (port 5349)     |
| `livekit-whip.YOURDOMAIN.COM` | A    | `<server-ip>` | LiveKit Ingress WHIP (port 8080) |

---

## Firewall Ports

Open the following ports in your server's firewall / security group:

| Protocol | Port(s)     | Direction | Purpose                                               |
| -------- | ----------- | --------- | ----------------------------------------------------- |
| TCP      | 80          | Inbound   | Certbot HTTP-01 ACME challenge + HTTP→HTTPS redirect  |
| TCP      | 443         | Inbound   | Nginx SNI passthrough (routes to LiveKit, TURN, WHIP) |
| TCP      | 1935        | Inbound   | RTMP ingest (OBS and compatible streaming software)   |
| TCP      | 5349        | Inbound   | TURN TLS (ICE fallback — LiveKit handles TLS)         |
| TCP      | 7881        | Inbound   | WebRTC TCP fallback                                   |
| UDP      | 3478        | Inbound   | STUN / TURN UDP                                       |
| UDP      | 50000-60000 | Inbound   | WebRTC media streams                                  |

---

## Service Inventory

| Service         | Image                         | Network Mode | Exposed Port(s)                               | Purpose                                                     |
| --------------- | ----------------------------- | ------------ | --------------------------------------------- | ----------------------------------------------------------- |
| `nginx`         | `nginx:1.27-alpine`           | bridge       | `0.0.0.0:80`, `0.0.0.0:443`                   | SNI passthrough reverse proxy; ACME HTTP-01; HTTPS redirect |
| `livekit`       | `livekit/livekit-server:v1.8` | host         | 7880 (HTTP/WS), 7881 (TCP), 50000-60000 (UDP) | LiveKit media server                                        |
| `redis-livekit` | `redis:7-alpine`              | host         | 127.0.0.1:6379                                | Redis for LiveKit internal pub/sub — loopback only          |
| `ingress`       | `livekit/ingress:v1.4`        | host         | 1935 (RTMP), 8080 (WHIP), 9090 (relay)        | LiveKit Ingress for RTMP and WHIP ingest                    |
| `postgres`      | `postgres:16-alpine`          | bridge       | `127.0.0.1:5432`                              | PostgreSQL database for the call-center-agent application   |
| `redis-app`     | `redis:7-alpine`              | bridge       | `127.0.0.1:6380`                              | Redis cache/queue for the call-center-agent application     |

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
nano .env   # Fill in all values: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, domains, POSTGRES_*, CERTBOT_EMAIL
```

> **Important — livekit.yaml keys section:** The Go YAML parser used by LiveKit does **not** expand `${VAR}` shell-style placeholders. You must manually edit the `keys:` section in `livekit.yaml` and replace `replace_this_key` and `replace_this_secret` with your actual LiveKit API key and secret. The `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` values in `.env` are used by the CLI and ingress service, but **not** automatically read by `livekit.yaml`.

### 3. Update domain placeholders

Replace every occurrence of `YOURDOMAIN.COM` in these files with your actual domain:

- `init_script.sh` — `LIVEKIT_DOMAIN`, `LIVEKIT_TURN_DOMAIN`, `LIVEKIT_WHIP_DOMAIN` variables
- `livekit.yaml` — `turn.domain`, `ingress.rtmp_base_url`, `ingress.whip_base_url`, and the `keys:` placeholder values
- `ingress.yaml` — `ws_url`
- `nginx/nginx.conf` — the three entries in the `map` block

### 4. Run the bootstrap script

```bash
chmod +x init_script.sh
sudo ./init_script.sh
```

The script will:

1. Install Docker + Docker Compose (if not already present)
2. Install Certbot (if not already present)
3. Copy all files to `/opt/livekit/`
4. Start the Nginx container so port 80 is available
5. Obtain TLS certificates for all 3 domains via Certbot HTTP-01
6. Add a weekly cron job to renew certificates and reload Nginx
7. Write a systemd unit (`livekit-docker.service`) and start the full stack

### 5. Verify the deployment

```bash
# Check all services are running
docker compose -f /opt/livekit/docker-compose.yml ps

# View logs for a specific service
docker compose -f /opt/livekit/docker-compose.yml logs -f livekit

# Test LiveKit health endpoint
curl https://livekit.YOURDOMAIN.COM/
```

---

## Upgrade Instructions

To pull the latest images and restart the stack:

```bash
cd /opt/livekit

# Pull latest images for all services
docker compose pull

# Restart with the new images (zero-downtime rolling is not guaranteed)
docker compose up -d --remove-orphans

# Alternatively, restart the systemd service
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

The `livekit` service mounts `/etc/letsencrypt` into the container (read-only). To enable TURN TLS, uncomment and set the following paths in the `turn:` section of `livekit.yaml`:

```yaml
turn:
  cert_file: /etc/letsencrypt/live/livekit-turn.YOURDOMAIN.COM/fullchain.pem
  key_file: /etc/letsencrypt/live/livekit-turn.YOURDOMAIN.COM/privkey.pem
```

These paths are available inside the container because the livekit service volume mounts `/etc/letsencrypt:/etc/letsencrypt:ro`.

---

## Certificate Renewal

Certbot renewal is handled by a weekly cron job written to `/etc/cron.d/certbot-livekit`. After renewal, Nginx is reloaded automatically:

```
0 3 * * 1 certbot renew --deploy-hook "docker compose -f /opt/livekit/docker-compose.yml exec nginx nginx -s reload"
```

To test renewal manually:

```bash
certbot renew --dry-run
```

---

## Troubleshooting

| Problem                    | Likely Cause                                | Fix                                                                         |
| -------------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| Port 80/443 not reachable  | Firewall rule missing                       | Open TCP 80 and 443 in your security group                                  |
| Certbot HTTP-01 fails      | DNS not propagated yet or Nginx not started | Verify DNS resolves; ensure Nginx container is running                      |
| WebRTC media does not flow | UDP ports 50000-60000 blocked               | Open UDP range in firewall                                                  |
| `network_mode: host` error | Running on Docker Desktop                   | Deploy on a Linux host                                                      |
| LiveKit can't reach Redis  | redis-livekit not started or wrong address  | Ensure `redis-livekit` is running; `livekit.yaml` must use `127.0.0.1:6379` |

---

## Development Stack

A simplified, cross-platform development stack is provided for local development. It uses bridge networking (no `network_mode: host`) so it works on macOS, Linux, and Windows with Docker Desktop or Docker Engine. No TLS, no Nginx, and no Certbot are required.

### Prerequisites

| Requirement        | Notes                                                         |
| ------------------ | ------------------------------------------------------------- |
| Any OS             | macOS, Linux, or Windows with Docker Desktop or Docker Engine |
| Docker Engine 24+  | Docker Desktop includes this on macOS and Windows             |
| Docker Compose v2+ | Included with Docker Desktop; install as plugin on Linux      |

### Quickstart

```bash
# From the infra/ directory
docker compose -f docker-compose.development.yml --env-file .env.development up -d
```

To stop and remove containers (data volume is preserved):

```bash
docker compose -f docker-compose.development.yml down
```

To stop and also remove the dev database volume:

```bash
docker compose -f docker-compose.development.yml down -v
```

### Service Port Reference

| Service    | Host Address            | Purpose                                    |
| ---------- | ----------------------- | ------------------------------------------ |
| LiveKit    | `ws://localhost:7880`   | WebSocket / HTTP endpoint for SDK clients  |
| Ingress    | `rtmp://localhost:1935` | RTMP ingest (OBS, ffmpeg, streaming tools) |
| Ingress    | `http://localhost:8080` | WHIP (WebRTC HTTP Ingest Protocol)         |
| PostgreSQL | `localhost:5432`        | Application database                       |
| Redis      | `localhost:6379`        | LiveKit message bus                        |

### SDK Connection Details

Use the following values when connecting via the LiveKit SDK or CLI tools:

```
LiveKit URL:    ws://localhost:7880
API Key:        devkey
API Secret:     devsecret
```

These values match the `keys:` section in `livekit.development.yaml` and the `infra/.env.development` file.

### UDP Media Ports Note

The LiveKit server is configured with a UDP media port range of `50000–60000`. Loopback candidates are enabled (`enable_loopback_candidate: true`), so browsers and SDK clients running **on the same machine** as Docker will connect successfully without any extra firewall configuration.

If you need to connect to the dev stack from a **remote device** (e.g., a phone on the same LAN, or a remote developer machine), open UDP ports `50000–60000` in your host firewall and ensure `use_external_ip: false` is set in `livekit.development.yaml` (it is by default). You may also need to configure `rtc.node_ip` in `livekit.development.yaml` to your machine's LAN IP for remote-device connectivity.
