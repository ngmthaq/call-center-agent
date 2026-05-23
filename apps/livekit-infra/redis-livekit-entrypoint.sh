#!/bin/sh
set -e

# Export defaults for variables that may be unset.
export REDIS_LIVEKIT_BIND="${REDIS_LIVEKIT_BIND:-0.0.0.0}"
export REDIS_LIVEKIT_PORT="${REDIS_LIVEKIT_PORT:-6379}"
export REDIS_LIVEKIT_PROTECTED_MODE="${REDIS_LIVEKIT_PROTECTED_MODE:-yes}"

envsubst < /redis-livekit.template.conf > /etc/redis/redis.conf

exec redis-server /etc/redis/redis.conf
