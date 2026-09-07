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
DREAM_ENGINE_AVAILABLE="false"
if [ -x "$DREAM_SWITCH_SCRIPT" ] && [ -x "$DREAM_PAUSE_SCRIPT" ]; then
  DREAM_ENGINE_AVAILABLE="true"
fi

if [ "$CHECK_ONLY" = "true" ]; then
  if [ "$DREAM_ENGINE_AVAILABLE" = "true" ]; then
    /usr/bin/printf '检查通过：卸载入口可用，Codex Dream Skin 会被保留。\n'
  else
    /usr/bin/printf '检查通过：上游引擎不可用，但仍可清理本主题文件。\n'
  fi
  exit 0
fi

/usr/bin/printf '\n卸载达妮娅 · 旧日斑斓\n\n'
PREVIOUS_THEME_ID="$(receipt_previous_theme_id)"
CURRENT_THEME_ID="$(active_theme_id)"

if [ "$CURRENT_THEME_ID" = "$THEME_ID" ]; then
  if [ "$DREAM_ENGINE_AVAILABLE" = "true" ]; then
    denia_info "恢复安装前的基础主题"
    if ! restore_previous_theme_or_pause "$PREVIOUS_THEME_ID"; then
      denia_fail "基础主题恢复失败；已保留动态效果、卸载器和主题库。请从 Codex Dream Skin 菜单选择其他主题后重试。"
    fi
  else
    denia_warn "Codex Dream Skin 引擎不可用，已跳过原主题恢复。"
    case "$DREAM_ACTIVE_THEME_DIR" in
      "$DREAM_STATE_ROOT/theme")
        if [ -d "$DREAM_ACTIVE_THEME_DIR" ] && [ ! -L "$DREAM_ACTIVE_THEME_DIR" ]; then
          denia_info "清理仍在生效的本主题副本"
          /usr/bin/find "$DREAM_ACTIVE_THEME_DIR" -mindepth 1 -delete
          /bin/rmdir "$DREAM_ACTIVE_THEME_DIR" 2>/dev/null || true
        fi
        ;;
      *) denia_fail "拒绝清理意外路径：$DREAM_ACTIVE_THEME_DIR" ;;
    esac
  fi
fi

if [ -x "$SIDECAR_STATE_ROOT/package/scripts/uninstall.sh" ]; then
  denia_info "移除动态效果"
  "$SIDECAR_STATE_ROOT/package/scripts/uninstall.sh"
else
  denia_info "动态效果未安装，跳过"
fi

case "$DREAM_SAVED_THEME_DIR" in
  "$DREAM_STATE_ROOT/themes/$THEME_ID")
    if [ -d "$DREAM_SAVED_THEME_DIR" ] && [ ! -L "$DREAM_SAVED_THEME_DIR" ]; then
      /usr/bin/find "$DREAM_SAVED_THEME_DIR" -mindepth 1 -delete
      /bin/rmdir "$DREAM_SAVED_THEME_DIR" 2>/dev/null || true
    fi
    ;;
  *) denia_fail "拒绝删除意外路径：$DREAM_SAVED_THEME_DIR" ;;
esac

if [ -f "$INSTALL_RECEIPT" ]; then /bin/rm -f "$INSTALL_RECEIPT"; fi
/bin/rmdir "$INSTALL_STATE_ROOT" 2>/dev/null || true

/usr/bin/printf '\n卸载完成。Codex Dream Skin 引擎和其他主题都已保留。\n'
