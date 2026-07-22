#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common.sh"

PORT="$(resolve_port)"
NODE="$(resolve_node)"

if launch_job_loaded; then
  /bin/launchctl bootout "$LAUNCH_DOMAIN/$LAUNCH_LABEL" >/dev/null
fi
for _ in 1 2 3 4 5 6 7 8 9 10; do
  launch_job_loaded || break
  /bin/sleep 0.2
done
/bin/rm -f "$LAUNCH_PLIST"

if cdp_ready "$PORT" && [ -f "$INSTALL_DIR/runtime/loader.mjs" ]; then
  "$NODE" "$INSTALL_DIR/runtime/loader.mjs" --remove-once --extension-dir "$INSTALL_DIR" --port "$PORT" >/dev/null || true
fi
/bin/rm -f "$PID_FILE" "$RUNTIME_STATE"
/usr/bin/printf '%s\n' 'Denia Old Days extension LaunchAgent is stopped and its renderer nodes were removed.'
