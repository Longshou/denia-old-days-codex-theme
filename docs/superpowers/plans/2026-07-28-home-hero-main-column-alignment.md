# Home Hero Main-Column Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 放大桌面首页横幅，并把首页宽幅底图从整窗坐标系移到主栏坐标系。

**Architecture:** 只增加首页宽幅模式 CSS 覆盖，并调整已有桌面横幅尺寸。测试继续使用 `sidecar/tests/validate.mjs` 的 CSS 语法扫描器锁定选择器、属性和值，不修改运行时 JavaScript、素材或任务页规则。

**Tech Stack:** 原生 CSS、Node.js ESM、现有 `sidecar/tests/validate.mjs` 测试框架、Kaboo 本地构建与 Sidecar 实机验证。

## Global Constraints

- 只修改 `sidecar/src/denia-old-days-extension.css`、`sidecar/tests/validate.mjs`、本计划文档。
- 不修改 `sidecar/src/denia-old-days-extension.js` 和 `sidecar/runtime/loader.mjs`。
- 不修改 `art/`、`theme/`、`sidecar/assets/`、清单或脚本。
- 不修改任务页背景、状态美术栏、状态映射、遮罩和过渡。
- 不修改原生标题区、输入框、项目选择器、侧栏和滚动容器的几何尺寸。
- 桌面横幅最大宽度为 `1160px`。
- `>= 1200px` 且高度 `<= 919px` 时，横幅内边距为 `26px 36px`，栏间距为 `36px`，照片最大宽度为 `500px`。
- `920px-1199px` 与 `< 920px` 的现有响应式规则保持不变。
- 首页宽幅底图只绘制在 `main.main-surface.dream-skin-home-shell`，`body` 只保留基底色。

---

### Task 1: 锁定首页背景和横幅尺寸契约

**Files:**
- Modify: `sidecar/tests/validate.mjs:286-340`
- Modify: `sidecar/tests/validate.mjs:796-847`

**Interfaces:**
- Consumes: `parseCssRules`、`assertCssDeclarations` 和现有 `stylesheetRules`。
- Produces: `homeBackgroundPaintRootSelector`、`homeBackgroundBodySelector`、`homeBackgroundMainSelector` 三个测试常量，以及新的桌面横幅尺寸断言。

- [ ] **Step 1: 增加首页背景坐标系失败断言**

在 `const stylesheetRules = parseCssRules(cssSyntax);` 后加入：

```js
const homeBackgroundPaintRootSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-home[data-dream-art-wide="true"]:has(main.main-surface.dream-skin-home-shell)';
const homeBackgroundBodySelector = `${homeBackgroundPaintRootSelector} body`;
const homeBackgroundMainSelector =
  `${homeBackgroundPaintRootSelector} main.main-surface.dream-skin-home-shell`;

assertCssDeclarations(stylesheetRules, homeBackgroundBodySelector, {
  "background-color": "#F7EEE9 !important",
  "background-image": "none !important",
});
assertCssDeclarations(stylesheetRules, homeBackgroundMainSelector, {
  "background-color": "#F7EEE9 !important",
  "background-image": "linear-gradient(90deg, var(--ds-immersive-edge), var(--ds-immersive-mid) 64%, var(--ds-immersive-far)), var(--dream-skin-art) !important",
  "background-attachment": "scroll !important",
  "background-position": "center, var(--ds-art-position) !important",
  "background-repeat": "no-repeat !important",
  "background-size": "cover !important",
});
```

- [ ] **Step 2: 更新桌面横幅失败断言**

把基础横幅断言中的宽度改为：

```js
width: "min(1160px, calc(100% - 32px))",
```

把 `shortDesktopMedia` 下的横幅和照片断言改为：

```js
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-hero", {
  "grid-template-columns": "minmax(350px, .88fr) minmax(460px, 1.12fr)",
  "column-gap": "36px",
  width: "min(1160px, calc(100% - 32px))",
  "min-height": "0",
  margin: "12px auto",
  padding: "26px 36px",
}, shortDesktopMedia);
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-hero h1", {
  margin: "12px 0 10px",
  "font-size": "clamp(34px, 3.6vw, 48px)",
}, shortDesktopMedia);
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo", {
  display: "block",
  width: "min(100%, 500px)",
  "aspect-ratio": "16 / 9.2",
  padding: "10px 10px 42px",
}, shortDesktopMedia);
```

- [ ] **Step 3: 运行测试并确认按预期失败**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL，首个错误包含：

```text
stylesheet must contain exactly one html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-home[data-dream-art-wide="true"]:has(main.main-surface.dream-skin-home-shell) body rule at the top level
```

### Task 2: 实现限定范围内的 CSS 修复

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.css:85-119`
- Modify: `sidecar/src/denia-old-days-extension.css:385-401`
- Modify: `sidecar/src/denia-old-days-extension.css:884-923`
- Test: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: Dream Skin 提供的 `--dream-skin-art`、`--ds-art-position`、`--ds-immersive-edge`、`--ds-immersive-mid`、`--ds-immersive-far`。
- Produces: 只在首页宽幅模式生效的背景覆盖，以及 `1160px` 桌面横幅和 `500px` 低高度照片。

- [ ] **Step 1: 把首页宽幅底图移到主栏**

在任务页背景规则之前加入：

```css
html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-home[data-dream-art-wide="true"]:has(main.main-surface.dream-skin-home-shell) body {
  background-color: #F7EEE9 !important;
  background-image: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-home[data-dream-art-wide="true"]:has(main.main-surface.dream-skin-home-shell) main.main-surface.dream-skin-home-shell {
  background-color: #F7EEE9 !important;
  background-image:
    linear-gradient(90deg, var(--ds-immersive-edge), var(--ds-immersive-mid) 64%, var(--ds-immersive-far)),
    var(--dream-skin-art) !important;
  background-attachment: scroll !important;
  background-position: center, var(--ds-art-position) !important;
  background-repeat: no-repeat !important;
  background-size: cover !important;
}
```

- [ ] **Step 2: 放大基础桌面横幅**

把 `.denia-old-days-ds-hero` 的宽度改为：

```css
width: min(1160px, calc(100% - 32px));
```

- [ ] **Step 3: 放大低高度桌面横幅和照片**

把 `@media (min-width: 1200px) and (max-height: 919px)` 内的对应声明改为：

```css
.denia-old-days-ds-hero {
  grid-template-columns: minmax(350px, .88fr) minmax(460px, 1.12fr);
  column-gap: 36px;
  width: min(1160px, calc(100% - 32px));
  min-height: 0;
  margin: 12px auto;
  padding: 26px 36px;
}

.denia-old-days-ds-hero h1 {
  margin: 12px 0 10px;
  font-size: clamp(34px, 3.6vw, 48px);
}

.denia-old-days-ds-photo {
  display: block;
  width: min(100%, 500px);
  aspect-ratio: 16 / 9.2;
  padding: 10px 10px 42px;
}
```

照片内框、伪元素和泡泡声明保持原值。

- [ ] **Step 4: 运行测试并确认通过**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: PASS，输出：

```text
Validated denia-old-days@0.1.0
```

- [ ] **Step 5: 检查变更边界**

Run:

```bash
git diff -- sidecar/src/denia-old-days-extension.js sidecar/runtime/loader.mjs art theme sidecar/assets sidecar/extension.json sidecar/scripts
```

Expected: 无输出。

Run:

```bash
git diff --check
git diff --stat
```

Expected: `git diff --check` 无输出；统计只包含 CSS、测试和本计划文档。

- [ ] **Step 6: 提交实现**

```bash
git add sidecar/src/denia-old-days-extension.css sidecar/tests/validate.mjs docs/superpowers/plans/2026-07-28-home-hero-main-column-alignment.md
git commit -m "fix: enlarge and align home hero"
```

### Task 3: 构建与实机回归

**Files:**
- Verify: `sidecar/src/denia-old-days-extension.css`
- Verify: `sidecar/tests/validate.mjs`
- Evidence: `/tmp/denia-home-hero-aligned.png`
- Evidence: `/tmp/denia-task-after-home-layout.png`

**Interfaces:**
- Consumes: Task 2 提交的 CSS 和测试。
- Produces: 首页、任务页、构建和变更边界的验证结果。

- [ ] **Step 1: 运行完整静态检查**

Run:

```bash
npm run check
```

Expected: PASS，源码检查与 Sidecar 校验均退出 `0`。

- [ ] **Step 2: 构建 Kaboo 本地包**

Run:

```bash
npm run build:kaboo
```

Expected: PASS，并生成 `sidecar/release/kaboo-local/denia-old-days/0.1.0/catalog-version.json`。

- [ ] **Step 3: 安装并启动当前 Sidecar**

Run:

```bash
bash sidecar/scripts/install.sh
```

Expected: 当前 Sidecar 包通过安装前后两次校验，LaunchAgent 启动成功。

- [ ] **Step 4: 验证首页并截图**

Run:

```bash
bash sidecar/scripts/verify.sh --home --screenshot /tmp/denia-home-hero-aligned.png
```

Expected:

- `home: true`
- `pass: true`
- `overflowX: false`
- 横幅宽度约 `1160px`
- 横幅高度约 `340px`
- 原生输入框宽度仍约 `1148px`

- [ ] **Step 5: 验证任务页未受影响**

从侧栏打开现有任务后运行：

```bash
bash sidecar/scripts/verify.sh --screenshot /tmp/denia-task-after-home-layout.png
```

Expected:

- `home: false`
- `taskMode: true`
- `taskPass: true`
- `composerViewportPass: true`
- 状态美术栏仍使用预期图片族

- [ ] **Step 6: 复核最终提交范围**

Run:

```bash
git status --short --branch
git diff dcaae63 --name-only
git diff dcaae63 -- sidecar/src/denia-old-days-extension.js sidecar/runtime/loader.mjs art theme sidecar/assets sidecar/extension.json sidecar/scripts
```

Expected:

- 工作区干净。
- 相对设计提交只包含 CSS、测试和计划文档。
- 禁止修改路径的差异为空。
