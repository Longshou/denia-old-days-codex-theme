#!/bin/bash

set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"

/bin/bash "$SCRIPT_DIR/installer/install-macos.sh"
STATUS=$?

if [ "${1:-}" != "--no-pause" ]; then
  /usr/bin/printf '\n按回车键关闭这个窗口。'
  IFS= read -r _
fi
exit "$STATUS"
