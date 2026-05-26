#!/bin/sh
set -e

# Export defaults for variables that may be unset.
# envsubst does not support ${VAR:-default} syntax — defaults must be set here.
export LIVEKIT_DOMAIN="${LIVEKIT_DOMAIN:-livekit.YOURDOMAIN.COM}"
export LIVEKIT_TURN_DOMAIN="${LIVEKIT_TURN_DOMAIN:-livekit-turn.YOURDOMAIN.COM}"
export LIVEKIT_PORT="${LIVEKIT_PORT:-7880}"

# CRITICAL: pass an explicit variable list to envsubst.
# Without this, envsubst would replace ALL $variable occurrences, corrupting
# the many Nginx-native $variable references in the config (e.g. $remote_addr,
# $ssl_preread_server_name, $upstream_backend, $host, $request_uri, etc.).
envsubst '${LIVEKIT_DOMAIN} ${LIVEKIT_TURN_DOMAIN} ${LIVEKIT_PORT}' \
  < /nginx.template.conf \
  > /etc/nginx/nginx.conf

exec nginx -g "daemon off;"
