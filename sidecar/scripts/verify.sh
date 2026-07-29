#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common.sh"

[ "$#" -eq 0 ] || fail "verify.sh does not accept arguments"

PORT="$(resolve_port)"
NODE="$(resolve_node)"
ARGS=(--verify --extension-dir "$INSTALL_DIR" --port "$PORT")
"$NODE" "$INSTALL_DIR/runtime/loader.mjs" "${ARGS[@]}"
