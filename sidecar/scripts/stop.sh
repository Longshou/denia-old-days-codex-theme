#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common.sh"

[ "$#" -eq 0 ] || fail "stop.sh does not accept arguments"
PORT="$(resolve_port)"

if launch_job_loaded; then
  /bin/launchctl bootout "$LAUNCH_DOMAIN/$LAUNCH_LABEL" >/dev/null 2>&1 || true
fi
for _ in 1 2 3 4 5 6 7 8 9 10; do
  launch_job_loaded || break
  /bin/sleep 0.2
done
launch_job_loaded && fail "The extension LaunchAgent is still loaded; its package and state were retained."
/bin/rm -f "$LAUNCH_PLIST"

if cdp_ready "$PORT" && [ -f "$INSTALL_DIR/runtime/loader.mjs" ]; then
  if NODE="$(resolve_node 2>/dev/null)"; then
    "$NODE" "$INSTALL_DIR/runtime/loader.mjs" --remove-once --extension-dir "$INSTALL_DIR" --port "$PORT" >/dev/null \
      || /usr/bin/printf '%s\n' 'The background process stopped; renderer cleanup could not be confirmed.' >&2
  else
    /usr/bin/printf '%s\n' 'The background process stopped; restart Codex to remove the remaining renderer decoration.' >&2
  fi
fi
/bin/rm -f "$PID_FILE" "$RUNTIME_STATE"
/usr/bin/printf '%s\n' 'Denia Old Days extension LaunchAgent is stopped.'
