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

if [ "$RUNNING" = "true" ] && cdp_ready "$PORT"; then
  NODE="$(resolve_node)"
  "$NODE" "$INSTALL_DIR/runtime/loader.mjs" --health --extension-dir "$INSTALL_DIR" --port "$PORT" >/dev/null \
    && /usr/bin/printf 'verified=true\n' \
    || /usr/bin/printf 'verified=false\n'
else
  /usr/bin/printf 'verified=false\n'
fi
