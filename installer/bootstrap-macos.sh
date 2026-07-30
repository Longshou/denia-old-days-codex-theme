#!/bin/bash

set -euo pipefail

RELEASE_URL="${DENIA_RELEASE_URL:-https://github.com/Longshou/denia-old-days-codex-theme/releases/latest/download/denia-old-days-macos.zip}"
TEMPORARY="$(/usr/bin/mktemp -d "${TMPDIR:-/private/tmp}/denia-old-days-download.XXXXXX")"
cleanup() {
  /bin/rm -rf "$TEMPORARY"
}
trap cleanup EXIT

/usr/bin/printf '正在下载达妮娅 · 旧日斑斓安装包…\n'
/usr/bin/curl -fL --retry 2 --connect-timeout 15 "$RELEASE_URL" -o "$TEMPORARY/denia-old-days-macos.zip"
/usr/bin/ditto -x -k "$TEMPORARY/denia-old-days-macos.zip" "$TEMPORARY/unpacked"

INSTALL_COMMAND="$TEMPORARY/unpacked/Denia Old Days/Install Denia Old Days.command"
[ -f "$INSTALL_COMMAND" ] || {
  /usr/bin/printf '下载的 ZIP 缺少安装入口，请到 GitHub Releases 重新下载。\n' >&2
  exit 2
}

/bin/bash "$INSTALL_COMMAND" --no-pause
