#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/lib/common.sh"

CHECK_ONLY="false"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --check) CHECK_ONLY="true"; shift ;;
    *) denia_fail "未知参数：$1" ;;
  esac
done

require_macos
require_payload
require_dream_skin_engine

if [ "$CHECK_ONLY" = "true" ]; then
  /usr/bin/printf '检查通过：安装包完整，Codex Dream Skin 已就绪。\n'
  exit 0
fi

[ "$INSTALL_STATE_ROOT" = "$SIDECAR_STATE_ROOT" ] \
  || denia_fail "安装状态目录必须与动态效果目录一致。"

/usr/bin/printf '\n达妮娅 · 旧日斑斓 %s\n\n' "$THEME_VERSION"

CURRENT_THEME_ID="$(active_theme_id)"
TRANSACTION_ACTIVE_THEME_ID="$CURRENT_THEME_ID"
PREVIOUS_THEME_ID="$CURRENT_THEME_ID"
if [ "$CURRENT_THEME_ID" = "$THEME_ID" ]; then
  PREVIOUS_THEME_ID="$(receipt_previous_theme_id)"
fi
if ! theme_id_is_safe "$PREVIOUS_THEME_ID"; then PREVIOUS_THEME_ID=""; fi
if ! theme_id_is_safe "$TRANSACTION_ACTIVE_THEME_ID"; then TRANSACTION_ACTIVE_THEME_ID=""; fi

/bin/mkdir -p "$DREAM_SAVED_THEME_ROOT"
/bin/chmod 700 "$DREAM_STATE_ROOT" "$DREAM_SAVED_THEME_ROOT" 2>/dev/null || true

THEME_STAGE="$(/usr/bin/mktemp -d "$DREAM_STATE_ROOT/.denia-old-days-theme.XXXXXX")"
UNINSTALL_STAGE="$(/usr/bin/mktemp -d "$DREAM_STATE_ROOT/.denia-old-days-uninstall.XXXXXX")"
THEME_BACKUP=""
SIDECAR_BACKUP=""
SIDECAR_FAILED=""
SIDECAR_WAS_RUNNING="false"
SIDECAR_STOPPED="false"
SIDECAR_RUNTIME_START_ATTEMPTED="false"
BASE_SWITCH_ATTEMPTED="false"
THEME_REPLACED="false"
SIDECAR_TRANSACTION_STARTED="false"
INSTALL_COMMITTED="false"

rollback_theme_files() {
  local failed_theme="$DREAM_STATE_ROOT/.denia-old-days-theme-failed.$$"
  if [ -e "$DREAM_SAVED_THEME_DIR" ] && ! /bin/mv "$DREAM_SAVED_THEME_DIR" "$failed_theme"; then
    denia_warn "未能保留失败安装的主题副本：$DREAM_SAVED_THEME_DIR"
    return 1
  fi
  if [ -n "$THEME_BACKUP" ] && [ -e "$THEME_BACKUP" ]; then
    if ! /bin/mv "$THEME_BACKUP" "$DREAM_SAVED_THEME_DIR"; then
      denia_warn "未能恢复安装前的主题库；恢复材料保留在：$THEME_BACKUP"
      return 1
    fi
  fi
  if [ -e "$failed_theme" ] && ! /bin/rm -rf "$failed_theme"; then
    denia_warn "失败安装的主题副本未能清理，保留在：$failed_theme"
    return 1
  fi
}

restore_transaction_active_theme() {
  local active_theme_id="${1:-}"
  if theme_id_is_safe "$active_theme_id" \
    && [ -f "$DREAM_SAVED_THEME_ROOT/$active_theme_id/theme.json" ]; then
    "$DREAM_SWITCH_SCRIPT" --id "$active_theme_id"
    return
  fi
  "$DREAM_PAUSE_SCRIPT"
}

finish_install() {
  local status="$1"
  trap - EXIT
  if [ "$INSTALL_COMMITTED" = "true" ]; then
    [ -z "$THEME_STAGE" ] || /bin/rm -rf "$THEME_STAGE"
    [ -z "$UNINSTALL_STAGE" ] || /bin/rm -rf "$UNINSTALL_STAGE"
    exit "$status"
  fi

  set +e
  SIDECAR_ROLLED_BACK="true"
  SIDECAR_REPLACEMENT_ISOLATED="true"
  SIDECAR_RESTART_NEEDED="false"
  if [ "$SIDECAR_TRANSACTION_STARTED" = "true" ] && [ -e "$SIDECAR_STATE_ROOT" ]; then
    if [ "$SIDECAR_RUNTIME_START_ATTEMPTED" = "true" ]; then
      if [ -x "$SIDECAR_STATE_ROOT/package/scripts/stop.sh" ]; then
        if ! "$SIDECAR_STATE_ROOT/package/scripts/stop.sh" >/dev/null 2>&1; then
          denia_warn "未能停止失败安装的动态效果；已保留当前副本：$SIDECAR_STATE_ROOT；安装前副本：${SIDECAR_BACKUP:-无}"
          SIDECAR_ROLLED_BACK="false"
          SIDECAR_REPLACEMENT_ISOLATED="false"
        fi
      else
        denia_warn "失败安装的动态效果缺少停止脚本；已保留当前副本：$SIDECAR_STATE_ROOT；安装前副本：${SIDECAR_BACKUP:-无}"
        SIDECAR_ROLLED_BACK="false"
        SIDECAR_REPLACEMENT_ISOLATED="false"
      fi
    fi
    if [ "$SIDECAR_REPLACEMENT_ISOLATED" = "true" ]; then
      SIDECAR_FAILED="$DREAM_STATE_ROOT/.denia-old-days-sidecar-failed.$$"
      if ! /bin/mv "$SIDECAR_STATE_ROOT" "$SIDECAR_FAILED"; then
        denia_warn "未能隔离失败安装的动态效果；已保留当前副本：$SIDECAR_STATE_ROOT；安装前副本：${SIDECAR_BACKUP:-无}"
        SIDECAR_ROLLED_BACK="false"
        SIDECAR_REPLACEMENT_ISOLATED="false"
      fi
    fi
  fi
  if [ "$SIDECAR_REPLACEMENT_ISOLATED" = "true" ] \
    && [ "$SIDECAR_TRANSACTION_STARTED" = "true" ] \
    && [ -n "$SIDECAR_BACKUP" ] && [ -e "$SIDECAR_BACKUP" ]; then
    if /bin/mv "$SIDECAR_BACKUP" "$SIDECAR_STATE_ROOT"; then
      if [ "$SIDECAR_WAS_RUNNING" = "true" ] && [ -x "$SIDECAR_STATE_ROOT/package/scripts/start.sh" ]; then
        SIDECAR_RESTART_NEEDED="true"
      fi
    else
      denia_warn "未能恢复安装前的动态效果；恢复材料保留在：$SIDECAR_BACKUP；失败安装副本：${SIDECAR_FAILED:-无}"
      SIDECAR_ROLLED_BACK="false"
    fi
  elif [ "$SIDECAR_TRANSACTION_STARTED" != "true" ] \
    && [ "$SIDECAR_STOPPED" = "true" ] \
    && [ "$SIDECAR_WAS_RUNNING" = "true" ] \
    && [ -x "$SIDECAR_STATE_ROOT/package/scripts/start.sh" ]; then
    SIDECAR_RESTART_NEEDED="true"
  fi
  THEME_ROLLED_BACK="true"
  if [ "$THEME_REPLACED" = "true" ] && ! rollback_theme_files; then
    THEME_ROLLED_BACK="false"
  fi
  if [ "$BASE_SWITCH_ATTEMPTED" = "true" ]; then
    if [ "$THEME_ROLLED_BACK" = "true" ]; then
      if ! restore_transaction_active_theme "$TRANSACTION_ACTIVE_THEME_ID"; then
        denia_warn "基础主题恢复没有完成；恢复材料已保留。"
      fi
    else
      denia_warn "主题库恢复没有完成；未重新应用基础主题，以免覆盖恢复材料。"
    fi
  fi
  if [ "$SIDECAR_RESTART_NEEDED" = "true" ] \
    && ! "$SIDECAR_STATE_ROOT/package/scripts/start.sh" >/dev/null 2>&1; then
    denia_warn "安装前的动态效果未能重新启动；失败安装副本保留在：${SIDECAR_FAILED:-无}"
    SIDECAR_ROLLED_BACK="false"
  fi
  if [ -n "$SIDECAR_FAILED" ] && [ "$SIDECAR_ROLLED_BACK" = "true" ]; then
    /bin/rm -rf "$SIDECAR_FAILED" || denia_warn "失败安装的动态效果副本未能清理：$SIDECAR_FAILED"
  elif [ -n "$SIDECAR_FAILED" ]; then
    denia_warn "失败安装的动态效果副本保留在：$SIDECAR_FAILED"
  fi
  [ -z "$THEME_STAGE" ] || /bin/rm -rf "$THEME_STAGE"
  [ -z "$UNINSTALL_STAGE" ] || /bin/rm -rf "$UNINSTALL_STAGE"
  set -e
  exit "$status"
}
trap 'finish_install "$?"' EXIT

/usr/bin/ditto "$PACKAGE_ROOT/theme/theme.json" "$THEME_STAGE/theme.json"
/usr/bin/ditto "$PACKAGE_ROOT/theme/background.jpg" "$THEME_STAGE/background.jpg"
/bin/chmod 600 "$THEME_STAGE/theme.json" "$THEME_STAGE/background.jpg"

/bin/mkdir -p "$UNINSTALL_STAGE/installer/lib"
/usr/bin/ditto "$PACKAGE_ROOT/Uninstall Denia Old Days.command" "$UNINSTALL_STAGE/Uninstall Denia Old Days.command"
/usr/bin/ditto "$PACKAGE_ROOT/installer/uninstall-macos.sh" "$UNINSTALL_STAGE/installer/uninstall-macos.sh"
/usr/bin/ditto "$PACKAGE_ROOT/installer/lib/common.sh" "$UNINSTALL_STAGE/installer/lib/common.sh"
/bin/chmod 700 \
  "$UNINSTALL_STAGE/Uninstall Denia Old Days.command" \
  "$UNINSTALL_STAGE/installer/uninstall-macos.sh" \
  "$UNINSTALL_STAGE/installer/lib/common.sh"

if [ -e "$DREAM_SAVED_THEME_DIR" ]; then
  [ ! -L "$DREAM_SAVED_THEME_DIR" ] || denia_fail "已保存主题路径是符号链接，出于安全考虑停止安装。"
  THEME_BACKUP="$DREAM_STATE_ROOT/.denia-old-days-theme-previous.$$"
  /bin/mv "$DREAM_SAVED_THEME_DIR" "$THEME_BACKUP"
fi
/bin/mv "$THEME_STAGE" "$DREAM_SAVED_THEME_DIR"
THEME_STAGE=""
THEME_REPLACED="true"

if [ -e "$SIDECAR_STATE_ROOT" ]; then
  [ -d "$SIDECAR_STATE_ROOT" ] && [ ! -L "$SIDECAR_STATE_ROOT" ] \
    || denia_fail "动态效果状态路径不是安全目录。"
  if [ -x "$SIDECAR_STATE_ROOT/package/scripts/status.sh" ] \
    && "$SIDECAR_STATE_ROOT/package/scripts/status.sh" 2>/dev/null | /usr/bin/grep -q '^running=true$'; then
    SIDECAR_WAS_RUNNING="true"
  fi
  if [ -x "$SIDECAR_STATE_ROOT/package/scripts/stop.sh" ]; then
    "$SIDECAR_STATE_ROOT/package/scripts/stop.sh"
    SIDECAR_STOPPED="true"
  fi
  SIDECAR_BACKUP="$DREAM_STATE_ROOT/.denia-old-days-sidecar-previous.$$"
  /bin/mv "$SIDECAR_STATE_ROOT" "$SIDECAR_BACKUP"
  SIDECAR_TRANSACTION_STARTED="true"
else
  SIDECAR_TRANSACTION_STARTED="true"
fi

/bin/mkdir -p "$SIDECAR_STATE_ROOT"
/bin/chmod 700 "$SIDECAR_STATE_ROOT"
/bin/mv "$UNINSTALL_STAGE" "$SIDECAR_STATE_ROOT/uninstall"
UNINSTALL_STAGE=""

denia_info "应用基础主题"
BASE_SWITCH_ATTEMPTED="true"
"$DREAM_SWITCH_SCRIPT" --id "$THEME_ID"

denia_info "安装完整动态效果"
"$SIDECAR_PACKAGE_SOURCE/scripts/install.sh" --no-start
SIDECAR_RUNTIME_START_ATTEMPTED="true"
"$SIDECAR_STATE_ROOT/package/scripts/start.sh"

HEALTHY="false"
for _ in 1 2 3 4 5 6; do
  if "$SIDECAR_STATE_ROOT/package/scripts/health.sh" >/dev/null 2>&1; then
    HEALTHY="true"
    break
  fi
  /bin/sleep 0.5
done

if [ "${DENIA_INSTALLER_TEST_FAIL_AFTER_SIDECAR:-0}" = "1" ] \
  && [ "${DENIA_ALLOW_NON_MACOS:-0}" = "1" ]; then
  denia_fail "测试故障注入。"
fi

remember_install "$PREVIOUS_THEME_ID"

INSTALL_COMMITTED="true"
trap - EXIT
if [ -n "$SIDECAR_BACKUP" ] && [ -e "$SIDECAR_BACKUP" ]; then
  /bin/rm -rf "$SIDECAR_BACKUP" || denia_warn "旧动态效果备份未能自动清理：$SIDECAR_BACKUP"
fi
if [ -n "$THEME_BACKUP" ] && [ -e "$THEME_BACKUP" ]; then
  /bin/rm -rf "$THEME_BACKUP" || denia_warn "旧主题备份未能自动清理：$THEME_BACKUP"
fi

/usr/bin/printf '\n安装完成。现在打开 Codex 就能看到完整效果。\n'
if [ "$HEALTHY" = "true" ]; then
  /usr/bin/printf '当前页面健康检查：通过。\n'
else
  denia_warn "当前页暂时无法确认，但安装已完成；这不会触发切页探针，也不会阻止使用。"
  denia_warn "打开 Codex 后可运行：\"$SIDECAR_STATE_ROOT/package/scripts/health.sh\""
fi
