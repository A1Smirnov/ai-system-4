#!/usr/bin/env bash
set -euo pipefail
AI_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
started_at="$(date +%s)"
journal_pid=''
# Limit output to startup milestones and problems from these two services.
important='(?i)(startup phase|manual.mode preflight|\bstart(?:ing|ed)\b|ready|listening|warning|\bwarn\b|\berror\b|failed|failure|timed? out|timeout|denied|unavailable|shutdown|stopping|stopped|collector:security-ubuntu)'
journal_args=(--user -u ai-system-gateway.service -u ai-system-dashboard.service
  --since "@$started_at" --no-pager --output short-iso --grep "$important")

stop_journal() {
  if [[ -n "$journal_pid" ]]; then
    kill "$journal_pid" 2>/dev/null || true
    wait "$journal_pid" 2>/dev/null || true
    journal_pid=''
  fi
}
trap stop_journal EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

printf '=== Starting AI-System ===\n'
printf 'Checking Gateway and dashboard. Important startup messages appear below.\n\n'
if command -v journalctl >/dev/null; then
  journalctl "${journal_args[@]}" --lines=0 --follow &
  journal_pid=$!
else
  printf 'journalctl is unavailable; only startup milestones and the final result will be shown.\n'
fi

if "$AI_ROOT/scripts/ai-system.sh" start --notify; then
  result=0
else
  result=$?
fi
stop_journal

if [[ "$result" -eq 0 ]]; then
  printf '\nReady. Gateway and dashboard started and passed readiness checks.\n'
  printf 'OpenClaw:   http://127.0.0.1:18789/\n'
  printf 'Headhunter: http://127.0.0.1:18795/\n'
  printf 'Closing this window does not stop the services.\n'
else
  printf '\nStartup failed (exit code %s).\n' "$result"
  systemctl --user status ai-system-gateway.service ai-system-dashboard.service \
    --no-pager --lines=0 || true
  if command -v journalctl >/dev/null; then
    printf '\nRecent important messages from this startup attempt:\n'
    journalctl "${journal_args[@]}" --lines=60 || true
  fi
fi

if [[ -t 0 ]]; then
  printf '\n'
  IFS= read -r -p 'Press Enter to close this window… ' _reply || true
fi
exit "$result"
