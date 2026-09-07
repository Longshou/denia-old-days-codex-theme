#!/bin/bash

INSTALLER_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
INSTALLER_DIR="$(cd "$INSTALLER_LIB_DIR/.." && pwd -P)"
PACKAGE_ROOT="$(cd "$INSTALLER_DIR/.." && pwd -P)"

THEME_ID="denia-old-days"
THEME_VERSION="0.1.2"
UPSTREAM_RELEASE_URL="https://github.com/Fei-Away/Codex-Dream-Skin/releases/latest"
DREAM_ENGINE_ROOT="${DENIA_DREAM_SKIN_ENGINE_ROOT:-$HOME/.codex/codex-dream-skin-studio}"
DREAM_STATE_ROOT="${DENIA_DREAM_SKIN_STATE_ROOT:-$HOME/Library/Application Support/CodexDreamSkinStudio}"
DREAM_SWITCH_SCRIPT="$DREAM_ENGINE_ROOT/scripts/switch-theme-macos.sh"
DREAM_PAUSE_SCRIPT="$DREAM_ENGINE_ROOT/scripts/pause-dream-skin-macos.sh"
DREAM_SAVED_THEME_ROOT="$DREAM_STATE_ROOT/themes"
DREAM_SAVED_THEME_DIR="$DREAM_SAVED_THEME_ROOT/$THEME_ID"
DREAM_ACTIVE_THEME_DIR="$DREAM_STATE_ROOT/theme"
SIDECAR_STATE_ROOT="${DENIA_OLD_DAYS_DS_STATE_ROOT:-$HOME/Library/Application Support/CodexDreamSkinExtensions/$THEME_ID}"
INSTALL_STATE_ROOT="${DENIA_OLD_DAYS_INSTALL_STATE_ROOT:-$SIDECAR_STATE_ROOT}"
INSTALL_RECEIPT="$INSTALL_STATE_ROOT/installer-receipt.json"
SIDECAR_PACKAGE_SOURCE="${DENIA_SIDECAR_PACKAGE_SOURCE:-$PACKAGE_ROOT/sidecar}"

denia_fail() {
  /usr/bin/printf '操作未完成：%s\n' "$*" >&2
  exit 2
}

denia_info() {
  /usr/bin/printf '• %s\n' "$*"
}

denia_warn() {
  /usr/bin/printf '提示：%s\n' "$*" >&2
}

json_string_field() {
  local file="$1"
  local key="$2"
  local value=""
  value="$(/usr/bin/plutil -extract "$key" raw -o - "$file" 2>/dev/null || true)"
  if [ -n "$value" ]; then
    /usr/bin/printf '%s\n' "$value"
    return
  fi
  /usr/bin/sed -nE "s/^[[:space:]]*\"${key}\":[[:space:]]*\"([^\"]*)\".*/\\1/p" "$file" \
    | /usr/bin/head -n 1
}

theme_id_is_safe() {
  case "${1:-}" in
    ''|.*|*[!A-Za-z0-9._-]*) return 1 ;;
    *) [ "${#1}" -le 80 ] ;;
  esac
}

require_macos() {
  if [ "${DENIA_ALLOW_NON_MACOS:-0}" = "1" ]; then return 0; fi
  [ "$(/usr/bin/uname -s)" = "Darwin" ] || denia_fail "这个安装包只支持 macOS。"
}

require_payload() {
  for relative in \
    "theme/theme.json" \
    "theme/background.jpg" \
    "sidecar/extension.json" \
    "sidecar/runtime/loader.mjs" \
    "sidecar/scripts/install.sh" \
    "sidecar/scripts/start.sh" \
    "sidecar/scripts/health.sh" \
    "sidecar/scripts/uninstall.sh"; do
    [ -s "$PACKAGE_ROOT/$relative" ] || denia_fail "安装包不完整，缺少 $relative。请重新下载 ZIP。"
  done
}

offer_upstream_download() {
  denia_warn "请先安装并打开一次 Codex Dream Skin：$UPSTREAM_RELEASE_URL"
  if [ "${DENIA_NO_OPEN:-0}" != "1" ] && [ "$(/usr/bin/uname -s)" = "Darwin" ]; then
    /usr/bin/open "$UPSTREAM_RELEASE_URL" >/dev/null 2>&1 || true
  fi
}

version_at_least() {
  local actual="$1"
  local minimum="$2"
  [[ "$actual" =~ ^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$ ]] || return 1
  [[ "$minimum" =~ ^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$ ]] || return 1
  local actual_parts minimum_parts index actual_part minimum_part
  IFS=. read -r -a actual_parts <<< "$actual"
  IFS=. read -r -a minimum_parts <<< "$minimum"
  for index in 0 1 2; do
    actual_part=$((10#${actual_parts[$index]}))
    minimum_part=$((10#${minimum_parts[$index]}))
    [ "$actual_part" -le "$minimum_part" ] || return 0
    [ "$actual_part" -ge "$minimum_part" ] || return 1
  done
}

require_dream_skin_engine() {
  if [ ! -x "$DREAM_SWITCH_SCRIPT" ]; then
    offer_upstream_download
    denia_fail "没有找到 Codex Dream Skin 引擎：$DREAM_SWITCH_SCRIPT"
  fi
  [ -x "$DREAM_PAUSE_SCRIPT" ] \
    || denia_fail "Codex Dream Skin 安装不完整，缺少暂停脚本。请重新安装上游最新版。"
  local engine_version=""
  local minimum_version
  minimum_version="$(json_string_field "$PACKAGE_ROOT/sidecar/extension.json" protocol.minimumDreamSkinVersion)"
  if [ -f "$DREAM_ENGINE_ROOT/VERSION" ]; then
    engine_version="$(/usr/bin/tr -d '[:space:]' < "$DREAM_ENGINE_ROOT/VERSION")"
    engine_version="${engine_version#v}"
  elif [ -f "$DREAM_ENGINE_ROOT/package.json" ]; then
    engine_version="$(json_string_field "$DREAM_ENGINE_ROOT/package.json" version)"
  fi
  version_at_least "$engine_version" "$minimum_version" \
    || denia_fail "需要 Codex Dream Skin ${minimum_version} 或更新版本，当前版本为 ${engine_version:-未知}。请先更新：$UPSTREAM_RELEASE_URL"
}

active_theme_id() {
  [ -f "$DREAM_ACTIVE_THEME_DIR/theme.json" ] || return 0
  json_string_field "$DREAM_ACTIVE_THEME_DIR/theme.json" id || true
}

receipt_previous_theme_id() {
  [ -f "$INSTALL_RECEIPT" ] || return 0
  json_string_field "$INSTALL_RECEIPT" previousThemeId || true
}

remember_install() {
  local previous_theme_id="${1:-}"
  local temporary="$INSTALL_STATE_ROOT/.installer-receipt.$$"
  /bin/mkdir -p "$INSTALL_STATE_ROOT"
  /bin/chmod 700 "$INSTALL_STATE_ROOT"
  /usr/bin/printf '%s\n' \
    '{' \
    '  "schemaVersion": 1,' \
    "  \"packageId\": \"$THEME_ID\"," \
    "  \"packageVersion\": \"$THEME_VERSION\"," \
    "  \"installedAt\": \"$(/bin/date -u '+%Y-%m-%dT%H:%M:%SZ')\"," \
    "  \"previousThemeId\": \"$previous_theme_id\"" \
    '}' > "$temporary"
  /bin/chmod 600 "$temporary"
  /bin/mv -f "$temporary" "$INSTALL_RECEIPT"
}

restore_previous_theme_or_pause() {
  local previous_theme_id="${1:-}"
  if theme_id_is_safe "$previous_theme_id" \
    && [ "$previous_theme_id" != "$THEME_ID" ] \
    && [ -f "$DREAM_SAVED_THEME_ROOT/$previous_theme_id/theme.json" ]; then
    "$DREAM_SWITCH_SCRIPT" --id "$previous_theme_id"
    return
  fi
  "$DREAM_PAUSE_SCRIPT"
}
