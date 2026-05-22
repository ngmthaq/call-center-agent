# Plan: LiveKit Self-Hosted Docker Compose with Nginx

**Date:** 22-05-2026 14:00:00
**Status:** Approved

---

## Summary

Set up a complete self-hosted LiveKit infrastructure under `infra/` using Docker Compose, replacing the default Caddy reverse proxy with Nginx, and expanding the stack to include: Nginx, LiveKit server, LiveKit-dedicated Redis, LiveKit Ingress, PostgreSQL (app database), and a separate app Redis (for call-center-agent caching).

---

## User Decisions

- **Deployment:** Internet-facing (Certbot HTTP-01 challenge)
- **Domains:** Placeholder values (`livekit.YOURDOMAIN.COM`, etc.)
- **TLS:** Certbot integrated in `init_script.sh` with weekly cron renewal
- **TURN TLS:** Nginx passthrough to LiveKit's built-in TURN on port 5349
- **Ingress:** Full stack (nginx, livekit, redis-livekit, ingress, postgres, redis-app)
- **App services:** Just infra — no livekit-agent or livekit-server containers
- **redis-app host port:** 6380 (to avoid conflict with redis-livekit on 6379)
- **PostgreSQL version:** postgres:16-alpine

---

## Tasks

| # | Task | File(s) | Responsible Role | Acceptance Criteria |
|---|------|---------|-----------------|---------------------|
| 1 | Create `infra/` directory scaffold | `infra/`, `infra/nginx/`, `infra/certbot/www/` | developer | Directory tree exists with all subdirectories |
| 2 | Create `.env.example` with all key names (no values) | `infra/.env.example` | developer | All keys present: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_DOMAIN, LIVEKIT_TURN_DOMAIN, LIVEKIT_WHIP_DOMAIN, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, CERTBOT_EMAIL, REDIS_APP_PORT; no secret values |
| 3 | Create `livekit.yaml` (LiveKit server config) | `infra/livekit.yaml` | developer | Valid YAML; redis.address: 127.0.0.1:6379; placeholder domains/secrets |
| 4 | Create `redis-livekit.conf` (Redis bound to 127.0.0.1:6379) | `infra/redis-livekit.conf` | developer | bind 127.0.0.1, port 6379, protected-mode yes |
| 5 | Create `ingress.yaml` (RTMP/WHIP config) | `infra/ingress.yaml` | developer | Valid YAML; redis.address: 127.0.0.1:6379; ws_url: wss://livekit.YOURDOMAIN.COM; rtmp_port: 1935; whip_port: 8080; placeholder secrets |
| 6 | Create `nginx/nginx.conf` (SNI passthrough on 443, ACME on 80) | `infra/nginx/nginx.conf` | developer | stream{} SNI block on 443 with passthrough for TURN; http{} port 80 ACME + HTTPS redirect; nginx -t passes |
| 7 | Create `docker-compose.yml` (6 services) | `infra/docker-compose.yml` | developer | Exactly: nginx, livekit, redis-livekit, ingress, postgres:16-alpine, redis-app; livekit/redis-livekit/ingress use network_mode:host; redis-app on 127.0.0.1:6380:6379; postgres on 127.0.0.1:5432:5432 with named volume; nginx extra_hosts host-gateway |
| 8 | Create `init_script.sh` (Docker, Certbot HTTP-01, cron, systemd) | `infra/init_script.sh` | developer | Executable; installs Docker; runs certbot certonly --webroot; adds weekly cron for certbot renew + nginx reload; writes systemd unit; enables service |
| 9 | Create `README.md` (DNS, firewall ports, setup steps) | `infra/README.md` | developer | Covers: firewall ports (80, 443, 1935, 3478/UDP, 5349/TCP, 7881/TCP, 50000-60000/UDP); DNS records; service inventory; step-by-step setup |

---

## Risks & Assumptions

- **Port collision:** redis-livekit (host network, 6379) vs redis-app (bridge, exposed as 6380)
- **Host networking is Linux-only:** network_mode:host not supported on Docker Desktop
- **Nginx stream module required:** official nginx:alpine includes ngx_stream_module
- **Nginx bridges to host services:** must use extra_hosts: host-gateway for upstream addresses
- **Certbot HTTP-01:** port 80 must be reachable; Nginx must start before certbot runs
- **TLS cert paths:** /etc/letsencrypt/ must be mounted into Nginx container
- **TURN passthrough:** Nginx passes raw TLS to LiveKit's built-in TURN (not terminated at Nginx)
- **PostgreSQL on bridge network:** reachable at 127.0.0.1:5432 from host
