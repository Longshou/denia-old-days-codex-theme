#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common.sh"

case "$STATE_ROOT" in
  *"/CodexDreamSkinExtensions/$EXTENSION_ID") ;;
  *) fail "Refusing to remove unexpected state directory: $STATE_ROOT" ;;
esac

"$INSTALL_DIR/scripts/stop.sh" \
  || fail "The extension could not be stopped; its package and uninstall entrypoint were retained."
launch_job_loaded && fail "The extension LaunchAgent is still loaded; no package files were removed."
/bin/rm -f "$LAUNCH_PLIST"
/usr/bin/find "$STATE_ROOT" -mindepth 1 -delete
/bin/rmdir "$STATE_ROOT" 2>/dev/null || true
/usr/bin/printf '%s\n' 'Uninstalled Denia Old Days. The base Dream Skin theme was left unchanged.'
