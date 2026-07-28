# Home Hero Balanced Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把首页横幅标题从失衡的 9＋2 断行改为接近等长的 6＋5 两行。

**Architecture:** 只在现有 `.denia-old-days-ds-hero h1` 基础规则上把标题宽度约束为 `6.2em`，并使用普通换行与中文严格换行属性。测试继续使用现有 CSS 语法扫描器锁定声明，不修改横幅网格、运行时、文案、素材或任务页。

**Tech Stack:** 原生 CSS、Node.js ESM、现有 `sidecar/tests/validate.mjs`、Kaboo 本地构建与 Sidecar 实机验证。

## Global Constraints

- 只修改 `sidecar/src/denia-old-days-extension.css`、`sidecar/tests/validate.mjs` 和本计划文档。
- `.denia-old-days-ds-hero h1` 使用 `max-width: 6.2em`、`text-wrap: wrap` 和 `line-break: strict`。
- 不修改标题文案、字号、字重、行高、字距或边距。
- 不修改横幅网格、尺寸、内边距、图片、泡泡、背景或动画。
- 不修改 JavaScript、运行时、素材、清单和脚本。
- 不修改原生输入区、项目选择器、侧栏或任务页。

---

### Task 1: 平衡首页横幅标题并完成回归

**Files:**
- Modify: `sidecar/tests/validate.mjs:315-335`
- Modify: `sidecar/src/denia-old-days-extension.css:434-443`
- Verify: `sidecar/src/denia-old-days-extension.css`
- Verify: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: `parseCssRules`、`assertCssDeclarations` 和已有 `.denia-old-days-ds-hero h1`。
- Produces: 标题断行 CSS 契约，以及当前桌面窗口下 6＋5 的两行标题。

- [ ] **Step 1: 写入失败断言**

在基础 `.denia-old-days-ds-hero h1` 断言中加入：

```js
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-hero h1", {
  "max-width": "6.2em",
  margin: "20px 0 14px",
  "font-size": "clamp(34px, 4vw, 54px)",
  "font-weight": "750",
  "line-height": "1.12",
  "letter-spacing": "-0.035em",
  "text-wrap": "wrap",
  "line-break": "strict",
});
```

- [ ] **Step 2: 运行测试并确认按预期失败**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL，错误指出 `.denia-old-days-ds-hero h1` 缺少 `text-wrap` 或 `line-break`。

- [ ] **Step 3: 写入最小 CSS 实现**

把基础标题规则改为：

```css
.denia-old-days-ds-hero h1 {
  max-width: 6.2em;
  margin: 20px 0 14px;
  color: var(--denia-ink);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
  font-size: clamp(34px, 4vw, 54px);
  font-weight: 750;
  line-height: 1.12;
  letter-spacing: -0.035em;
  text-wrap: wrap;
  line-break: strict;
}
```

- [ ] **Step 4: 运行测试并确认通过**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: PASS，输出包含：

```text
Validated 达妮娅 · 旧日斑斓 extension 0.1.0
```

- [ ] **Step 5: 检查变更边界**

Run:

```bash
git diff -- sidecar/src/denia-old-days-extension.js sidecar/runtime/loader.mjs art theme sidecar/assets sidecar/extension.json sidecar/scripts
git diff --check
git diff --stat
```

Expected:

- 禁改路径无输出。
- `git diff --check` 无输出。
- 代码差异只包含 CSS、测试和本计划。

- [ ] **Step 6: 运行完整检查和构建**

Run:

```bash
npm run check
npm run build:kaboo
```

Expected: 两条命令均退出 `0`，Kaboo 本地包生成成功。

- [ ] **Step 7: 安装并验证首页**

Run:

```bash
bash sidecar/scripts/install.sh
bash sidecar/scripts/verify.sh --home --screenshot /tmp/denia-home-balanced-title.png
```

Expected:

- `home: true`
- `pass: true`
- `overflowX: false`
- 横幅尺寸仍约 `1160×341px`
- 原生输入框尺寸保持不变

通过 CDP 对标题逐字符读取行框，确认字符数为 `[6, 5]`。

- [ ] **Step 8: 验证任务页和最终边界**

打开现有任务页后运行：

```bash
bash sidecar/scripts/verify.sh --screenshot /tmp/denia-task-after-balanced-title.png
git status --short --branch
git diff 392dd67 --name-only
git diff 392dd67 -- sidecar/src/denia-old-days-extension.js sidecar/runtime/loader.mjs art theme sidecar/assets sidecar/extension.json sidecar/scripts
```

Expected:

- `taskMode: true`
- `taskPass: true`
- `composerViewportPass: true`
- 禁改路径差异为空

- [ ] **Step 9: 提交实现**

```bash
git add sidecar/src/denia-old-days-extension.css sidecar/tests/validate.mjs docs/superpowers/plans/2026-07-28-home-hero-balanced-title.md
git commit -m "fix: balance home hero title"
```
