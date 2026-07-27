#!/bin/bash

set -euo pipefail

fail() {
  /usr/bin/printf 'Denia themed Codex: %s\n' "$*" >&2
  exit 1
}

STATE_ROOT="${HOME:?HOME is required}/Library/Application Support/CodexDreamSkinStudio"
RUNTIME_ROOT="$HOME/Library/Application Support/Kaboo/CodexDreamSkinRuntime/1.2.0-kaboo.5"
THEME_DIR="$STATE_ROOT/theme"
EXTENSION_ROOT="$HOME/Library/Application Support/CodexDreamSkinExtensions/denia-old-days/package"
INJECTOR="$RUNTIME_ROOT/studio/scripts/injector.mjs"
INJECTOR_LOG="$STATE_ROOT/injector.log"
INJECTOR_ERROR_LOG="$STATE_ROOT/injector-error.log"
INJECTOR_LABEL="com.denia-old-days.dream-skin-injector"
INJECTOR_TARGET="gui/$(/usr/bin/id -u)/$INJECTOR_LABEL"
APP_LOG="$STATE_ROOT/codex-launch.log"
APP_ERROR_LOG="$STATE_ROOT/codex-launch-error.log"
WORKER_LOG="$STATE_ROOT/start-themed-codex.log"
WORKER_LABEL="com.denia-old-days.start-themed-codex"
WORKER_TARGET="gui/$(/usr/bin/id -u)/$WORKER_LABEL"
PORT=9341
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd -P)/$(basename "$0")"

CODEX_BUNDLE=""
for candidate in \
  "/Applications/ChatGPT.app" \
  "$HOME/Applications/ChatGPT.app" \
  "/Applications/Codex.app" \
  "$HOME/Applications/Codex.app"
do
  [ -f "$candidate/Contents/Info.plist" ] || continue
  identifier="$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$candidate/Contents/Info.plist" 2>/dev/null || true)"
  if [ "$identifier" = "com.openai.codex" ]; then
    CODEX_BUNDLE="$candidate"
    break
  fi
done
[ -n "$CODEX_BUNDLE" ] || fail "official Codex/ChatGPT app was not found"

CODEX_EXECUTABLE="$(/usr/bin/plutil -extract CFBundleExecutable raw -o - "$CODEX_BUNDLE/Contents/Info.plist")"
CODEX_EXE="$CODEX_BUNDLE/Contents/MacOS/$CODEX_EXECUTABLE"
CODEX_NODE="$CODEX_BUNDLE/Contents/Resources/cua_node/bin/node"
SIDECAR_PATH="${CODEX_NODE%/*}:/usr/bin:/bin:/usr/sbin:/sbin"

validate_installation() {
  [ -x "$CODEX_EXE" ] || fail "Codex executable is missing: $CODEX_EXE"
  [ -x "$CODEX_NODE" ] || fail "Codex Node.js runtime is missing: $CODEX_NODE"
  [ -f "$INJECTOR" ] || fail "Kaboo Dream Skin injector is missing: $INJECTOR"
  [ -f "$THEME_DIR/theme.json" ] || fail "active Dream Skin theme is missing"
  [ "$(/usr/bin/plutil -extract id raw -o - "$THEME_DIR/theme.json" 2>/dev/null || true)" = "denia-old-days" ] \
    || fail "the active Dream Skin theme is not denia-old-days"
  [ -x "$EXTENSION_ROOT/scripts/start.sh" ] || fail "theme Sidecar start script is missing"
  [ -x "$EXTENSION_ROOT/scripts/stop.sh" ] || fail "theme Sidecar stop script is missing"
  [ -x "$EXTENSION_ROOT/scripts/verify.sh" ] || fail "theme Sidecar verify script is missing"
  "$CODEX_NODE" "$INJECTOR" --check-payload --theme-dir "$THEME_DIR" >/dev/null
}

codex_is_running() {
  /bin/ps -axo command= | /usr/bin/awk -v executable="$CODEX_EXE" '
    $0 == executable || index($0, executable " ") == 1 { found = 1 }
    END { exit found ? 0 : 1 }
  '
}

injector_is_running() {
  /bin/ps -axo command= | /usr/bin/awk -v injector="$INJECTOR" -v port="$PORT" -v theme="$THEME_DIR" '
    index($0, injector) &&
      index($0, "--watch") &&
      index($0, "--port " port) &&
      index($0, "--theme-dir " theme) { found = 1 }
    END { exit found ? 0 : 1 }
  '
}

start_injector() {
  if injector_is_running; then
    return 0
  fi
  /bin/launchctl remove "$INJECTOR_LABEL" >/dev/null 2>&1 || true
  if ! /bin/launchctl submit \
    -l "$INJECTOR_LABEL" \
    -o "$INJECTOR_LOG" \
    -e "$INJECTOR_ERROR_LOG" \
    -- "$CODEX_NODE" "$INJECTOR" \
      --watch \
      --port "$PORT" \
      --theme-dir "$THEME_DIR"; then
    fail "the Dream Skin injector job could not be submitted"
  fi
  if ! /bin/launchctl kickstart "$INJECTOR_TARGET"; then
    /bin/launchctl remove "$INJECTOR_LABEL" >/dev/null 2>&1 || true
    fail "the Dream Skin injector job could not be started"
  fi
}

wait_for_codex_to_stop() {
  local deadline=$((SECONDS + 20))
  while codex_is_running && [ "$SECONDS" -lt "$deadline" ]; do
    /bin/sleep 0.2
  done
  codex_is_running && fail "Codex did not quit within 20 seconds"
  return 0
}

wait_for_cdp() {
  local deadline=$((SECONDS + 45))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if /usr/bin/curl --noproxy '*' --silent --fail --max-time 1 \
      "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
      return 0
    fi
    /bin/sleep 0.3
  done
  fail "Codex did not expose the Dream Skin endpoint on port $PORT"
}

validate_installation
if [ "${1:-}" = "--check" ]; then
  [ "$#" -eq 1 ] || fail "--check does not accept additional arguments"
  /usr/bin/printf '%s\n' "Denia themed Codex launcher is ready."
  exit 0
fi
if [ "${1:-}" != "--worker" ]; then
  [ "$#" -eq 0 ] || fail "usage: $0 [--check]"
  /bin/mkdir -p "$STATE_ROOT"
  : >"$WORKER_LOG"
  /bin/launchctl remove "$WORKER_LABEL" >/dev/null 2>&1 || true
  /bin/launchctl submit \
    -l "$WORKER_LABEL" \
    -o "$WORKER_LOG" \
    -e "$WORKER_LOG" \
    -- /bin/bash "$SCRIPT_PATH" --worker
  if ! /bin/launchctl kickstart "$WORKER_TARGET"; then
    /bin/launchctl remove "$WORKER_LABEL" >/dev/null 2>&1 || true
    fail "the background startup worker could not be started"
  fi
  /usr/bin/printf 'The themed Codex startup is running. Log: %s\n' "$WORKER_LOG"
  exit 0
fi
shift
[ "$#" -eq 0 ] || fail "--worker does not accept additional arguments"

/bin/mkdir -p "$STATE_ROOT"
/usr/bin/printf '%s\n' "Stopping the previous theme process…"
"$EXTENSION_ROOT/scripts/stop.sh" >/dev/null 2>&1 || true
/usr/bin/printf '%s\n' "Restarting Codex with the Dream Skin debug endpoint…"
/usr/bin/osascript -e 'tell application id "com.openai.codex" to quit' >/dev/null 2>&1 || true
wait_for_codex_to_stop

if /usr/sbin/lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | /usr/bin/grep -q .; then
  fail "port $PORT is already occupied"
fi

/usr/bin/printf '%s\n' "Launching the Codex process…"
: >"$APP_LOG"
: >"$APP_ERROR_LOG"
/usr/bin/open -n \
  --stdout "$APP_LOG" \
  --stderr "$APP_ERROR_LOG" \
  "$CODEX_BUNDLE" \
  --args \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port="$PORT"
wait_for_cdp

/usr/bin/printf '%s\n' "Applying the Denia base skin…"
APPLY_OUTPUT="$(/usr/bin/mktemp "${TMPDIR:-/tmp}/denia-base-apply.XXXXXX")"
cleanup_apply_output() {
  /bin/rm -f "$APPLY_OUTPUT"
}
trap cleanup_apply_output EXIT

if "$CODEX_NODE" "$INJECTOR" \
  --once \
  --port "$PORT" \
  --theme-dir "$THEME_DIR" \
  --timeout-ms 5000 \
  >"$APPLY_OUTPUT" 2>>"$INJECTOR_ERROR_LOG"; then
  base_applied=true
else
  base_applied=false
fi
if [ "$base_applied" != "true" ] && ! /usr/bin/grep -q '"installed": true' "$APPLY_OUTPUT"; then
  /bin/cat "$APPLY_OUTPUT" >&2
  fail "the Dream Skin base payload could not be applied; see $INJECTOR_ERROR_LOG"
fi

start_injector

/usr/bin/printf '%s\n' "Starting the Denia theme extension…"
PATH="$SIDECAR_PATH" "$EXTENSION_ROOT/scripts/start.sh"
PATH="$SIDECAR_PATH" "$EXTENSION_ROOT/scripts/verify.sh" --home
/usr/bin/osascript -e 'tell application id "com.openai.codex" to activate' >/dev/null 2>&1 || true
/usr/bin/printf '%s\n' "Denia themed Codex is active."
