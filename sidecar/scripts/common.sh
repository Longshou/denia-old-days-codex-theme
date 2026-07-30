#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
EXTENSION_ID="denia-old-days"
EXTENSION_VERSION="0.1.0"
STATE_ROOT="${DENIA_OLD_DAYS_DS_STATE_ROOT:-$HOME/Library/Application Support/CodexDreamSkinExtensions/$EXTENSION_ID}"
INSTALL_DIR="$STATE_ROOT/package"
PID_FILE="$STATE_ROOT/loader.pid"
RUNTIME_STATE="$STATE_ROOT/runtime.json"
LOG_FILE="$STATE_ROOT/loader.log"
DREAM_STATE="${DENIA_DREAM_SKIN_STATE_ROOT:-$HOME/Library/Application Support/CodexDreamSkinStudio}/state.json"
LAUNCH_LABEL="com.codexdreamskinextensions.denia-old-days"
LAUNCH_DOMAIN="gui/$(/usr/bin/id -u)"
LAUNCH_PLIST="$HOME/Library/LaunchAgents/${LAUNCH_LABEL}.plist"

fail() {
  /usr/bin/printf 'denia-old-days: %s\n' "$*" >&2
  exit 2
}

json_string_field() {
  local file="$1"
  local key="$2"
  /usr/bin/sed -nE "s/^[[:space:]]*\"${key}\":[[:space:]]*\"([^\"]*)\".*/\\1/p" "$file" | /usr/bin/head -n 1
}

json_number_field() {
  local file="$1"
  local key="$2"
  /usr/bin/sed -nE "s/^[[:space:]]*\"${key}\":[[:space:]]*([0-9]+).*/\\1/p" "$file" | /usr/bin/head -n 1
}

resolve_port() {
  local port="9341"
  if [ -f "$DREAM_STATE" ]; then
    local saved
    saved="$(json_number_field "$DREAM_STATE" port || true)"
    [ -z "$saved" ] || port="$saved"
  fi
  /usr/bin/printf '%s\n' "$port"
}

resolve_node() {
  local candidate=""
  if [ -f "$DREAM_STATE" ]; then
    candidate="$(json_string_field "$DREAM_STATE" nodePath || true)"
  fi
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    /usr/bin/printf '%s\n' "$candidate"
    return
  fi
  candidate="$(command -v node || true)"
  [ -n "$candidate" ] && [ -x "$candidate" ] || fail "No Node runtime is available. Apply Dream Skin Studio first."
  /usr/bin/printf '%s\n' "$candidate"
}

cdp_ready() {
  local port="$1"
  /usr/bin/curl -fsS --max-time 3 "http://127.0.0.1:${port}/json/version" >/dev/null 2>&1
}

read_loader_pid() {
  [ -f "$PID_FILE" ] || return 1
  local pid
  pid="$(/bin/cat "$PID_FILE" 2>/dev/null || true)"
  case "$pid" in
    ''|*[!0-9]*) return 1 ;;
  esac
  /usr/bin/printf '%s\n' "$pid"
}

is_loader_pid() {
  local pid="$1"
  /bin/kill -0 "$pid" 2>/dev/null || return 1
  local command_line
  command_line="$(/bin/ps -p "$pid" -o command= 2>/dev/null || true)"
  case "$command_line" in
    *"$INSTALL_DIR/runtime/loader.mjs"*"--watch"*) return 0 ;;
    *) return 1 ;;
  esac
}

launch_job_loaded() {
  /bin/launchctl print "$LAUNCH_DOMAIN/$LAUNCH_LABEL" >/dev/null 2>&1
}

launch_job_running() {
  /bin/launchctl print "$LAUNCH_DOMAIN/$LAUNCH_LABEL" 2>/dev/null | /usr/bin/grep -q 'state = running'
}

ensure_state_root() {
  /bin/mkdir -p "$STATE_ROOT"
  /bin/chmod 700 "$STATE_ROOT"
}
