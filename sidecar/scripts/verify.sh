#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common.sh"

SCREENSHOT=""
OPEN_HOME="false"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --screenshot)
      [ -n "${2:-}" ] || fail "--screenshot requires a path"
      SCREENSHOT="$2"
      shift 2
      ;;
    --home) OPEN_HOME="true"; shift ;;
    *) fail "Unknown verify argument: $1" ;;
  esac
done

PORT="$(resolve_port)"
NODE="$(resolve_node)"
ARGS=(--verify --extension-dir "$INSTALL_DIR" --port "$PORT")
[ "$OPEN_HOME" != "true" ] || ARGS+=(--open-home)
[ -z "$SCREENSHOT" ] || ARGS+=(--screenshot "$SCREENSHOT")
"$NODE" "$INSTALL_DIR/runtime/loader.mjs" "${ARGS[@]}"
