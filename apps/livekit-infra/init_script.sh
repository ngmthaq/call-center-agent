#!/usr/bin/env bash
# =============================================================================
# init_script.sh — LiveKit Self-Hosted Bootstrap Script
#
# Usage:
#   1. Copy all infra/ files to the target Linux server.
#   2. Fill in the .env file (copy from .env.example and set real values).
#   3. Replace all YOURDOMAIN.COM placeholders in this script, livekit.yaml,
#      ingress.yaml, and nginx/nginx.conf with your actual domain names.
#   4. Run: sudo ./init_script.sh
#
# Tested on: Ubuntu 22.04 LTS / Debian 12
# Requires: root or sudo
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — replace these placeholder values with your actual domains
# ---------------------------------------------------------------------------
LIVEKIT_DOMAIN="livekit.YOURDOMAIN.COM"
LIVEKIT_TURN_DOMAIN="livekit-turn.YOURDOMAIN.COM"
LIVEKIT_WHIP_DOMAIN="livekit-whip.YOURDOMAIN.COM"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"            # Loaded from .env if set

INSTALL_DIR="/opt/livekit"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${INSTALL_DIR}/docker-compose.yml"

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { echo "[ERROR] $*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "This script must be run as root. Use: sudo ./init_script.sh"
  fi
}

# ---------------------------------------------------------------------------
# Step 1 — Install Docker and Docker Compose (Ubuntu/Debian)
# ---------------------------------------------------------------------------
install_docker() {
  if command -v docker &>/dev/null; then
    log "Docker already installed: $(docker --version)"
    return
  fi

  log "Installing Docker..."
  apt-get update -qq
  apt-get install -y -qq \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

  # Add Docker's official GPG key
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  # Add Docker apt repository
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -y -qq \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

  log "Docker installed: $(docker --version)"
  log "Docker Compose installed: $(docker compose version)"
}

install_certbot() {
  if command -v certbot &>/dev/null; then
    log "Certbot already installed: $(certbot --version)"
    return
  fi

  log "Installing Certbot..."
  apt-get install -y -qq snapd || true
  snap install --classic certbot 2>/dev/null || apt-get install -y -qq certbot
  log "Certbot installed: $(certbot --version)"
}

# ---------------------------------------------------------------------------
# Step 2 — Copy all files to /opt/livekit
# ---------------------------------------------------------------------------
setup_install_dir() {
  log "Creating installation directory: ${INSTALL_DIR}"
  mkdir -p "${INSTALL_DIR}"

  log "Copying files from ${SCRIPT_DIR} to ${INSTALL_DIR}..."
  rsync -a --exclude='.git' "${SCRIPT_DIR}/" "${INSTALL_DIR}/"

  # Ensure certbot webroot directory exists (Nginx mounts this for ACME challenge)
  mkdir -p "${INSTALL_DIR}/certbot/www/.well-known/acme-challenge"

  log "Files copied to ${INSTALL_DIR}"
}

# ---------------------------------------------------------------------------
# Step 3 — Start Nginx first so port 80 is available for ACME HTTP-01
# ---------------------------------------------------------------------------
start_nginx() {
  log "Starting Nginx container (needed for ACME HTTP-01 challenge)..."
  cd "${INSTALL_DIR}"
  docker compose up -d nginx
  log "Nginx started. Waiting 5 seconds for it to bind port 80..."
  sleep 5
}

# ---------------------------------------------------------------------------
# Step 4 — Obtain TLS certificates via Certbot HTTP-01 webroot challenge
# ---------------------------------------------------------------------------
obtain_certificates() {
  if [[ -z "${CERTBOT_EMAIL}" ]]; then
    die "CERTBOT_EMAIL is not set. Set it in your .env file or export it before running."
  fi

  log "Obtaining TLS certificates for all 3 domains..."

  certbot certonly \
    --webroot \
    --webroot-path "${INSTALL_DIR}/certbot/www" \
    --email "${CERTBOT_EMAIL}" \
    --agree-tos \
    --non-interactive \
    --expand \
    -d "${LIVEKIT_DOMAIN}" \
    -d "${LIVEKIT_TURN_DOMAIN}" \
    -d "${LIVEKIT_WHIP_DOMAIN}"

  log "Certificates obtained successfully."
}

# ---------------------------------------------------------------------------
# Step 5 — Add weekly cron job for certificate renewal + Nginx reload
# ---------------------------------------------------------------------------
setup_cron() {
  local CRON_JOB='0 3 * * 1 certbot renew --deploy-hook "docker compose -f /opt/livekit/docker-compose.yml exec nginx nginx -s reload" >> /var/log/certbot-renew.log 2>&1'
  local CRON_FILE="/etc/cron.d/certbot-livekit"

  log "Installing weekly certbot renewal cron job..."

  if grep -qF "certbot-renew.log" "${CRON_FILE}" 2>/dev/null; then
    log "Cron job already exists in ${CRON_FILE}, skipping."
    return
  fi

  cat > "${CRON_FILE}" << EOF
# Renew Let's Encrypt certificates every Monday at 03:00 and reload Nginx
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

${CRON_JOB}
EOF

  chmod 644 "${CRON_FILE}"
  log "Cron job written to ${CRON_FILE}"
}

# ---------------------------------------------------------------------------
# Step 6 — Write systemd unit file for the full Docker Compose stack
# ---------------------------------------------------------------------------
setup_systemd() {
  local UNIT_FILE="/etc/systemd/system/livekit-docker.service"

  log "Writing systemd unit: ${UNIT_FILE}"

  cat > "${UNIT_FILE}" << EOF
[Unit]
Description=LiveKit Self-Hosted Docker Compose Stack
Documentation=https://docs.livekit.io/home/self-hosting/
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose -f ${COMPOSE_FILE} up
ExecStop=/usr/bin/docker compose -f ${COMPOSE_FILE} down
Restart=on-failure
RestartSec=10s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

  log "Systemd unit written to ${UNIT_FILE}"
}

# ---------------------------------------------------------------------------
# Step 7 — Enable and start the systemd service
# ---------------------------------------------------------------------------
start_service() {
  log "Reloading systemd daemon..."
  systemctl daemon-reload

  log "Enabling livekit-docker service to start on boot..."
  systemctl enable livekit-docker

  log "Starting livekit-docker service..."
  systemctl start livekit-docker

  log "Service status:"
  systemctl status livekit-docker --no-pager || true
}

# ---------------------------------------------------------------------------
# Main entrypoint
# ---------------------------------------------------------------------------
main() {
  require_root

  log "=== LiveKit Self-Hosted Bootstrap ==="
  log "Install directory : ${INSTALL_DIR}"
  log "LiveKit domain    : ${LIVEKIT_DOMAIN}"
  log "TURN domain       : ${LIVEKIT_TURN_DOMAIN}"
  log "WHIP domain       : ${LIVEKIT_WHIP_DOMAIN}"
  echo

  # Load .env if present (to pick up CERTBOT_EMAIL etc.)
  if [[ -f "${SCRIPT_DIR}/.env" ]]; then
    log "Loading environment from ${SCRIPT_DIR}/.env"
    set -o allexport
    # shellcheck disable=SC1090
    source "${SCRIPT_DIR}/.env"
    set +o allexport
  fi

  install_docker
  install_certbot
  setup_install_dir
  start_nginx
  obtain_certificates
  setup_cron
  setup_systemd
  start_service

  log "=== Bootstrap complete ==="
  log "PostgreSQL : 127.0.0.1:5432"
  log "Redis App  : 127.0.0.1:6380"
  log "LiveKit    : wss://${LIVEKIT_DOMAIN}"
}

main "$@"
