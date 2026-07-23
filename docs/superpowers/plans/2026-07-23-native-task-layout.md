# Native Task Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留达妮娅首页演出，同时让任务页完全服从 Codex 原生布局。

**Architecture:** Sidecar 继续通过固定装饰层显示状态人物图，但不再给原生主内容或输入框预留空间。运行时只在首页创建侧栏品牌卡，任务页仅添加不影响几何尺寸的视觉类。

**Tech Stack:** 原生 JavaScript、CSS、Node.js Sidecar 校验器。

## Global Constraints

- 不修改 Codex.app、app.asar、签名或账户配置。
- 不改变任务页原生容器的宽度、边距、内边距、Grid 或 Flex 布局。
- 保留首页拍立得和手账卡片。
- 不启动或重启 Codex，除非用户明确要求。

---

### Task 1: 锁定非侵入式任务布局

**Files:**
- Modify: `sidecar/tests/validate.mjs`
- Modify: `sidecar/src/denia-old-days-extension.css`
- Modify: `sidecar/src/denia-old-days-extension.js`

**Interfaces:**
- Consumes: `refresh()` 的首页/任务页判定和现有固定状态人物层。
- Produces: 任务页零布局覆盖、首页限定的侧栏品牌卡。

- [x] **Step 1: 写入失败校验**

在 `sidecar/tests/validate.mjs` 中断言活动 CSS 不包含任务页 `main` 的 `padding-inline-end`，也不包含任务页输入框的 `max-width` 或 `margin-inline-end`；运行时必须先判定 `home`，再只在首页调用 `ensureSidebarBrand()`。

- [x] **Step 2: 确认校验失败**

Run: `node sidecar/tests/validate.mjs sidecar`

Expected: FAIL，指出任务页仍覆盖原生布局或侧栏品牌卡仍在任务页创建。

- [x] **Step 3: 实施最小修复**

删除两个桌面断点中的任务页 `main` 留白和输入框尺寸覆盖，并删除窄屏重置规则。把 `ensureSidebarBrand()` 移到 `if (home)` 分支；进入任务页时删除已有品牌卡。保留固定状态人物层和输入框的纯视觉样式。

- [x] **Step 4: 验证**

Run: `node sidecar/tests/validate.mjs sidecar`

Expected: PASS，且首页与状态人物层相关断言继续通过。
