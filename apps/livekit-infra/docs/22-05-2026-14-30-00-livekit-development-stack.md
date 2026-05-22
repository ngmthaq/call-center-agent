# Plan: LiveKit Development Docker Compose Stack

**Date:** 22-05-2026 14:30:00
**Status:** Approved

---

## Summary

Create a cross-platform (macOS/Linux/Windows) development Docker Compose stack under `infra/` using bridge networking and LiveKit `--dev` mode. No TLS, no Nginx, no Certbot required.

---

## User Decisions

- **File naming:** `*.development.*` suffix (not `*.dev.*`)
- **Env file:** `.env.development` — real file, pre-filled with dev defaults, safe to commit to git (no real secrets)
- **Services:** livekit, ingress, postgres, redis (all bridge-networked)
- **Dev OS:** macOS, Linux, Windows (Docker Desktop compatible)

---

## Tasks

| # | Task | File(s) | Responsible Role | Acceptance Criteria |
|---|------|---------|-----------------|---------------------|
| 1 | Create `docker-compose.development.yml` (4 bridge-networked services) | `infra/docker-compose.development.yml` | developer | Valid Compose YAML; services: livekit, ingress, postgres, redis; all on livekit-dev-net bridge network; livekit uses --dev flag; no network_mode:host |
| 2 | Create `livekit.development.yaml` (no TURN, no TLS, Redis via service name) | `infra/livekit.development.yaml` | developer | Valid YAML; redis.address: redis:6379; turn.enabled: false; use_external_ip: false; enable_loopback_candidate: true; keys: devkey: devsecret |
| 3 | Create `ingress.development.yaml` (ws://livekit:7880, no TLS) | `infra/ingress.development.yaml` | developer | Valid YAML; redis.address: redis:6379; ws_url: ws://livekit:7880; no TLS references |
| 4 | Create `.env.development` (real file, pre-filled, commit-safe) | `infra/.env.development` | developer | All keys present and pre-filled with safe dev defaults; LIVEKIT_API_KEY=devkey, LIVEKIT_API_SECRET=devsecret; simple postgres creds; file contains only dev-appropriate values with no real secrets |
| 5 | Add "Development Stack" section to `infra/README.md` | `infra/README.md` | developer | Section covers quickstart command, service port table, SDK connection details |
