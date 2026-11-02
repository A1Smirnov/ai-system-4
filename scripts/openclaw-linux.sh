#!/usr/bin/env bash
set -euo pipefail
AI_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export OPENCLAW_HOME="$AI_ROOT"
export OPENCLAW_STATE_DIR="$AI_ROOT/state"
export OPENCLAW_CONFIG_PATH="$AI_ROOT/state/openclaw.json"
# Interactive commands must not inherit the Codex host service identity.
unset INVOCATION_ID SYSTEMD_EXEC_PID JOURNAL_STREAM NOTIFY_SOCKET
export XDG_CACHE_HOME="$AI_ROOT/state/cache-linux"
export npm_config_cache="$XDG_CACHE_HOME/npm"
mkdir -p -- "$XDG_CACHE_HOME"
chmod 700 -- "$XDG_CACHE_HOME"
exec node "$AI_ROOT/app/node_modules/openclaw/openclaw.mjs" "$@"
