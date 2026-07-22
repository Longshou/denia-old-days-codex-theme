#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common.sh"

START_EXTENSION="true"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --no-start) START_EXTENSION="false"; shift ;;
    *) fail "Unknown install argument: $1" ;;
  esac
done

NODE="$(resolve_node)"
"$NODE" "$PACKAGE_ROOT/tests/validate.mjs" "$PACKAGE_ROOT"
ensure_state_root

STAGE="$STATE_ROOT/.package-stage-$$"
/bin/mkdir -p "$STAGE"
cleanup_stage() {
  [ -z "${STAGE:-}" ] || /bin/rm -rf "$STAGE"
}
trap cleanup_stage EXIT
for item in \
  extension.json \
  assets \
  src \
  runtime \
  scripts \
  tests \
  package.sh \
  README.md \
  NOTICE.md \
  LICENSE; do
  /usr/bin/ditto "$PACKAGE_ROOT/$item" "$STAGE/$item"
done

"$NODE" "$STAGE/tests/validate.mjs" "$STAGE"

if [ -x "$INSTALL_DIR/scripts/stop.sh" ]; then
  "$INSTALL_DIR/scripts/stop.sh" >/dev/null 2>&1 || true
fi
if [ -d "$INSTALL_DIR" ]; then
  BACKUP="$STATE_ROOT/package-previous-$(/bin/date '+%Y%m%d-%H%M%S')"
  /bin/mv "$INSTALL_DIR" "$BACKUP"
fi
/bin/mv "$STAGE" "$INSTALL_DIR"
STAGE=""
trap - EXIT
/bin/chmod 700 "$INSTALL_DIR/scripts/"*.sh "$INSTALL_DIR/package.sh"

"$NODE" -e '
  const fs = require("fs");
  const path = require("path");
  const out = process.argv[1];
  const receipt = { schemaVersion: 1, id: "denia-old-days", version: process.argv[3], installedAt: new Date().toISOString(), packageDir: process.argv[2] };
  fs.writeFileSync(out, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
' "$STATE_ROOT/receipt.json" "$INSTALL_DIR" "$EXTENSION_VERSION"

/usr/bin/printf 'Installed Denia Old Days at %s\n' "$INSTALL_DIR"

if [ "$START_EXTENSION" = "true" ]; then
  if ! "$INSTALL_DIR/scripts/start.sh"; then
    /usr/bin/printf '%s\n' 'Extension files are installed but the runtime is not active.' >&2
    exit 1
  fi
fi
