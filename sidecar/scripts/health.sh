#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common.sh"

[ "$#" -eq 0 ] || fail "health.sh does not accept arguments"
[ -d "$INSTALL_DIR" ] || fail "Extension is not installed at $INSTALL_DIR"

PORT="$(resolve_port)"
cdp_ready "$PORT" || fail "Dream Skin CDP endpoint is not active on 127.0.0.1:${PORT}"
NODE="$(resolve_node)"
"$NODE" "$INSTALL_DIR/runtime/loader.mjs" \
  --health \
  --extension-dir "$INSTALL_DIR" \
  --port "$PORT"
