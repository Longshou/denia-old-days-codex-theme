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
BACKUP=""
RECEIPT_BACKUP=""
RECEIPT_WAS_PRESENT="false"
OLD_WAS_RUNNING="false"
OLD_STOPPED="false"
SWAP_STARTED="false"
RUNTIME_START_ATTEMPTED="false"
INSTALL_COMMITTED="false"

finish_install() {
  local status="$1"
  local failed_package="$STATE_ROOT/.package-failed-$$"
  trap - EXIT
  if [ "$INSTALL_COMMITTED" = "true" ]; then
    [ -z "${STAGE:-}" ] || /bin/rm -rf "$STAGE"
    exit "$status"
  fi
  set +e
  local rollback_ready="true"
  if [ "$SWAP_STARTED" = "true" ]; then
    if [ "$RUNTIME_START_ATTEMPTED" = "true" ]; then
      if [ ! -x "$INSTALL_DIR/scripts/stop.sh" ] \
        || ! "$INSTALL_DIR/scripts/stop.sh" >/dev/null 2>&1; then
        rollback_ready="false"
      fi
    fi
    if [ "$rollback_ready" = "true" ] && [ -e "$INSTALL_DIR" ]; then
      /bin/mv "$INSTALL_DIR" "$failed_package" || rollback_ready="false"
    fi
    if [ "$rollback_ready" = "true" ] && [ -n "$BACKUP" ] && [ -e "$BACKUP" ]; then
      /bin/mv "$BACKUP" "$INSTALL_DIR" || rollback_ready="false"
    fi
    if [ "$rollback_ready" = "true" ]; then
      if [ "$RECEIPT_WAS_PRESENT" = "true" ]; then
        if [ -n "$RECEIPT_BACKUP" ] && [ -f "$RECEIPT_BACKUP" ]; then
          /bin/mv "$RECEIPT_BACKUP" "$STATE_ROOT/receipt.json" || rollback_ready="false"
        fi
      else
        /bin/rm -f "$STATE_ROOT/receipt.json" || rollback_ready="false"
      fi
    fi
  fi
  if [ "$rollback_ready" = "true" ] && [ "$OLD_STOPPED" = "true" ] \
    && [ "$OLD_WAS_RUNNING" = "true" ] && [ -x "$INSTALL_DIR/scripts/start.sh" ]; then
    "$INSTALL_DIR/scripts/start.sh" >/dev/null 2>&1 || rollback_ready="false"
  fi
  if [ "$rollback_ready" = "true" ]; then
    [ ! -e "$failed_package" ] || /bin/rm -rf "$failed_package"
  else
    /usr/bin/printf 'Rollback incomplete; recovery files retained in %s (previous package: %s; failed package: %s).\n' \
      "$STATE_ROOT" "${BACKUP:-none}" "$failed_package" >&2
    if [ -n "$RECEIPT_BACKUP" ] && [ -f "$RECEIPT_BACKUP" ]; then
      /usr/bin/printf 'Previous receipt retained at %s\n' "$RECEIPT_BACKUP" >&2
    fi
  fi
  [ -z "${STAGE:-}" ] || /bin/rm -rf "$STAGE"
  set -e
  exit "$status"
}
trap 'finish_install "$?"' EXIT
for item in \
  extension.json \
  layout-contract.json \
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

if [ -e "$INSTALL_DIR" ]; then
  [ -d "$INSTALL_DIR" ] && [ ! -L "$INSTALL_DIR" ] \
    || fail "Refusing to replace an unsafe extension package path: $INSTALL_DIR"
fi
if [ -x "$INSTALL_DIR/scripts/stop.sh" ]; then
  if [ -x "$INSTALL_DIR/scripts/status.sh" ] \
    && "$INSTALL_DIR/scripts/status.sh" 2>/dev/null | /usr/bin/grep -q '^running=true$'; then
    OLD_WAS_RUNNING="true"
  fi
  "$INSTALL_DIR/scripts/stop.sh" \
    || fail "The previous extension could not be stopped; its package was retained."
  OLD_STOPPED="true"
fi
if [ -d "$INSTALL_DIR" ]; then
  BACKUP="$STATE_ROOT/.package-previous-$$"
  /bin/mv "$INSTALL_DIR" "$BACKUP"
fi
SWAP_STARTED="true"
if [ -f "$STATE_ROOT/receipt.json" ]; then
  RECEIPT_WAS_PRESENT="true"
  RECEIPT_BACKUP="$STATE_ROOT/.receipt-previous-$$"
  /bin/mv "$STATE_ROOT/receipt.json" "$RECEIPT_BACKUP"
fi
/bin/mv "$STAGE" "$INSTALL_DIR"
STAGE=""
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
  RUNTIME_START_ATTEMPTED="true"
  if ! "$INSTALL_DIR/scripts/start.sh"; then
    /usr/bin/printf '%s\n' 'Extension files are installed but the runtime is not active.' >&2
    exit 1
  fi
fi

INSTALL_COMMITTED="true"
trap - EXIT
[ -z "$BACKUP" ] || /bin/rm -rf "$BACKUP" \
  || /usr/bin/printf 'Warning: old package backup was not removed: %s\n' "$BACKUP" >&2
[ -z "$RECEIPT_BACKUP" ] || /bin/rm -f "$RECEIPT_BACKUP" \
  || /usr/bin/printf 'Warning: old receipt backup was not removed: %s\n' "$RECEIPT_BACKUP" >&2
