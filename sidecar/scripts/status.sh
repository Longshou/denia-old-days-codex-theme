#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common.sh"

PORT="$(resolve_port)"
INSTALLED="false"
RUNNING="false"
[ -f "$INSTALL_DIR/extension.json" ] && INSTALLED="true"
if launch_job_running; then
  RUNNING="true"
  PID="$(json_number_field "$RUNTIME_STATE" pid 2>/dev/null || true)"
else
  PID=""
fi

/usr/bin/printf 'installed=%s\n' "$INSTALLED"
/usr/bin/printf 'running=%s\n' "$RUNNING"
/usr/bin/printf 'pid=%s\n' "$PID"
/usr/bin/printf 'port=%s\n' "$PORT"
/usr/bin/printf 'package=%s\n' "$INSTALL_DIR"
/usr/bin/printf 'launchAgent=%s\n' "$LAUNCH_LABEL"

RUNTIME_STATUS="stopped"
TARGET_COUNT="0"
CONNECTED="false"
if [ "$RUNNING" = "true" ] && [ -f "$RUNTIME_STATE" ]; then
  RUNTIME_STATUS="$(json_string_field "$RUNTIME_STATE" status || true)"
  TARGET_COUNT="$(json_number_field "$RUNTIME_STATE" targetCount || true)"
  [ -n "$TARGET_COUNT" ] || TARGET_COUNT="0"
  if [ "$RUNTIME_STATUS" = "running" ] && [ "$TARGET_COUNT" -gt 0 ]; then
    CONNECTED="true"
  fi
fi
/usr/bin/printf 'runtimeStatus=%s\n' "$RUNTIME_STATUS"
/usr/bin/printf 'connected=%s\n' "$CONNECTED"
/usr/bin/printf 'targets=%s\n' "$TARGET_COUNT"
/usr/bin/printf 'verified=%s\n' "$([ "$CONNECTED" = "true" ] && /usr/bin/printf unknown || /usr/bin/printf false)"
