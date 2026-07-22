#!/bin/bash

set -euo pipefail
PACKAGE_ROOT="$(cd "$(dirname "$0")" && pwd -P)"
NODE="$(command -v node || true)"
[ -n "$NODE" ] || { /usr/bin/printf '%s\n' 'Node is required to validate the package.' >&2; exit 2; }

"$NODE" "$PACKAGE_ROOT/tests/validate.mjs" "$PACKAGE_ROOT"
for script in "$PACKAGE_ROOT"/scripts/*.sh; do
  /bin/bash -n "$script"
done
"$NODE" --check "$PACKAGE_ROOT/runtime/loader.mjs"
"$NODE" --check "$PACKAGE_ROOT/src/denia-old-days-extension.js"

VERSION="$($NODE -p "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).version" "$PACKAGE_ROOT/extension.json")"
OUT_DIR="$PACKAGE_ROOT/release"
OUT="$OUT_DIR/denia-old-days-v${VERSION}.zip"
STAGE="$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/denia-old-days-package.XXXXXX")"
STAGED_PACKAGE="$STAGE/$(/usr/bin/basename "$PACKAGE_ROOT")"
cleanup() {
  /bin/rm -rf "$STAGE"
}
trap cleanup EXIT

/bin/mkdir -p "$STAGED_PACKAGE"
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
  /usr/bin/ditto "$PACKAGE_ROOT/$item" "$STAGED_PACKAGE/$item"
done

/bin/mkdir -p "$OUT_DIR"
/bin/rm -f "$OUT"
/usr/bin/ditto -c -k --norsrc --noextattr --keepParent "$STAGED_PACKAGE" "$OUT"
/usr/bin/printf 'Created %s\n' "$OUT"
