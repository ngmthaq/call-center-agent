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
