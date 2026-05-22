#!/usr/bin/env bash

current_dir=$(pwd)
echo "Current directory: $current_dir"

cd $current_dir/apps/livekit-agent && cp .env.example .env.local
echo "Copied .env.example to .env.local in apps/livekit-agent"

cd $current_dir/apps/livekit-client && cp .env.example .env.local
echo "Copied .env.example to .env.local in apps/livekit-client"

cd $current_dir/apps/livekit-server && cp .env.example .env.local
echo "Copied .env.example to .env.local in apps/livekit-server"

cd $current_dir/apps/livekit-infra && cp .env.example .env
echo "Copied .env.example to .env in apps/livekit-infra"