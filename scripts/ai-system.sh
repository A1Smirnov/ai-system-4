#!/usr/bin/env bash
set -euo pipefail
action="${1:-status}"
notify="${2:-}"
message() {
  printf '%s\n' "$1"
  if [[ "$notify" == '--notify' ]] && command -v notify-send >/dev/null; then
    notify-send 'AI-System' "$1" || true
  fi
}
case "$action" in
  start)
    message 'Starting AI-System; waiting for Gateway and dashboard readiness.'
    if ! systemctl --user start ai-system.target; then
      message 'AI-System startup failed. Run scripts/ai-system.sh status and inspect the service journal.'
      exit 1
    fi
    systemctl --user is-active --quiet ai-system-gateway.service
    systemctl --user is-active --quiet ai-system-dashboard.service
    message 'AI-System ready. OpenClaw: http://127.0.0.1:18789/ | Headhunter: http://127.0.0.1:18795/'
    ;;
  stop)
    message 'Stopping AI-System. Gateway will drain active work before exiting.'
    if ! systemctl --user stop ai-system.target ai-system-dashboard.service ai-system-gateway.service; then
      message 'AI-System stop failed; inspect status before starting another instance.'
      exit 1
    fi
    for unit in ai-system-gateway.service ai-system-dashboard.service; do
      if systemctl --user is-active --quiet "$unit"; then
        message "$unit is still active; stop is not confirmed."
        exit 1
      fi
    done
    message 'AI-System stopped.'
    ;;
  status)
    systemctl --user status ai-system.target ai-system-gateway.service ai-system-dashboard.service --no-pager --lines=0
    ;;
  *) printf 'Usage: %s {start|stop|status} [--notify]\n' "$0" >&2; exit 2 ;;
esac
