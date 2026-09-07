#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common.sh"

[ "$#" -eq 0 ] || fail "start.sh does not accept arguments"
[ -d "$INSTALL_DIR" ] || fail "Extension is not installed at $INSTALL_DIR"
ensure_state_root
PORT="$(resolve_port)"
NODE="$(resolve_node)"

if launch_job_running; then
  /usr/bin/printf 'Denia Old Days extension LaunchAgent is already running (port=%s).\n' "$PORT"
  exit 0
fi

/bin/mkdir -p "$HOME/Library/LaunchAgents"
"$NODE" -e '
  const fs = require("fs");
  const [out, label, node, loader, extensionDir, port, state, log, home] = process.argv.slice(1);
  const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const argumentsList = [node, loader, "--watch", "--extension-dir", extensionDir, "--port", port, "--state", state];
  const argsXml = argumentsList.map((item) => `<string>${esc(item)}</string>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${esc(label)}</string>
<key>ProgramArguments</key><array>${argsXml}</array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>2</integer>
<key>ProcessType</key><string>Background</string>
<key>EnvironmentVariables</key><dict><key>HOME</key><string>${esc(home)}</string></dict>
<key>StandardOutPath</key><string>${esc(log)}</string>
<key>StandardErrorPath</key><string>${esc(log)}</string>
</dict></plist>\n`;
  fs.writeFileSync(out, xml, { mode: 0o600 });
' "$LAUNCH_PLIST" "$LAUNCH_LABEL" "$NODE" "$INSTALL_DIR/runtime/loader.mjs" "$INSTALL_DIR" "$PORT" "$RUNTIME_STATE" "$LOG_FILE" "$HOME"
/bin/chmod 600 "$LAUNCH_PLIST"

if launch_job_loaded; then
  /bin/launchctl bootout "$LAUNCH_DOMAIN/$LAUNCH_LABEL" >/dev/null 2>&1 || true
fi
for _ in 1 2 3 4 5; do
  launch_job_loaded || break
  /bin/sleep 0.2
done
/bin/launchctl enable "$LAUNCH_DOMAIN/$LAUNCH_LABEL" >/dev/null 2>&1 || true
if ! /bin/launchctl bootstrap "$LAUNCH_DOMAIN" "$LAUNCH_PLIST" >/dev/null 2>&1; then
  /bin/sleep 0.7
  if launch_job_loaded; then
    /bin/launchctl bootout "$LAUNCH_DOMAIN/$LAUNCH_LABEL" >/dev/null 2>&1 || true
    /bin/sleep 0.4
  fi
  /bin/launchctl bootstrap "$LAUNCH_DOMAIN" "$LAUNCH_PLIST" \
    || fail "Could not bootstrap the Denia Old Days extension LaunchAgent"
fi
/bin/launchctl kickstart -k "$LAUNCH_DOMAIN/$LAUNCH_LABEL" >/dev/null 2>&1 \
  || fail "Could not kickstart the Denia Old Days extension LaunchAgent"

for _ in 1 2 3 4 5 6 7 8; do
  if launch_job_running && [ -f "$RUNTIME_STATE" ]; then
    PID="$(json_number_field "$RUNTIME_STATE" pid || true)"
    RUNTIME_STATUS="$(json_string_field "$RUNTIME_STATE" status || true)"
    if [ -n "$PID" ] && is_loader_pid "$PID"; then
      case "$RUNTIME_STATUS" in
        running)
          /usr/bin/printf 'Denia Old Days extension is connected (pid=%s, port=%s).\n' "$PID" "$PORT"
          exit 0
          ;;
        waiting|degraded)
          /usr/bin/printf 'Denia Old Days extension is waiting for Codex (pid=%s, port=%s). Apply the theme from Codex Dream Skin to connect.\n' "$PID" "$PORT"
          exit 0
          ;;
      esac
    fi
  fi
  /bin/sleep 0.5
done

/usr/bin/tail -n 30 "$LOG_FILE" >&2 2>/dev/null || true
fail "Extension loader did not become ready"
