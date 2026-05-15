#!/usr/bin/env sh
#
# entrypoint.sh — minimal launcher. agent-worker has no DB/migrations, so this
# only execs the CMD. `exec` so tini forwards SIGTERM/SIGINT to Node directly
# for clean LiveKit worker drain on `docker compose down`.

set -eu

exec "$@"
