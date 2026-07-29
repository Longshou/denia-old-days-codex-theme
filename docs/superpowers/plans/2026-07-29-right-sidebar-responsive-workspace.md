# Right Sidebar Responsive Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **2026-07-29 暂停点：** 实机拖拽后取消逐像素交叉混图。当前实现改为拖拽期间显示主题遮罩，停止 `120ms` 后按面板宽高比选择竖图或宽图；本文后续涉及连续 `progress` 的步骤仅保留为实施历史。

**Goal:** 让原生右侧栏在用户拖拽宽度时由近景平滑过渡到指定宽幅舞台图，并修复快捷项首帧白闪、选项外框和输入焦点线。

**Architecture:** 新增一张预加载宽幅资源，并在已确认的右侧栏内挂载唯一的绝对定位自有视觉层。运行时使用 `ResizeObserver` 将面板实际宽度归一化为进度变量，CSS 只动画画面层的透明度和轻微位移；结构化列表识别负责首帧快捷项装饰，composer 使用容器内焦点环。

**Tech Stack:** Node.js 20+、Sharp 0.34.5、原生 CSS、Sidecar CDP loader、Node `vm` 测试、ResizeObserver。

## Global Constraints

- 宽幅素材固定使用 SHA-256 `d312c86f21610d7d6b50b8d8fa9b9685ef4baa11d34c0ca72fd71a712bfa42ed` 的用户指定图片。
- 紧凑阈值为 `440px`，工作区阈值为 `840px`。
- 只动画 `opacity` 和 `transform`，不动画原生布局属性。
- 不修改原生侧栏拖拽、滚动、快捷项顺序、焦点顺序和点击区域。
- 快捷项默认透明、无边框、无阴影。
- composer 内编辑器不绘制外 outline，焦点反馈转移到 composer 容器内部。
- 明色和深色模式都必须可读。
- 减少透明度时使用纯色，减少动态效果时立即切换。
- 所有实现直接提交到当前 `main`。

---

### Task 1: 增加宽幅素材与预加载生命周期

**Files:**
- Create: `art/source/official/denia-right-sidebar-wide.jpg`
- Generate: `sidecar/assets/denia-right-sidebar-wide.webp`
- Modify: `scripts/release-inputs.mjs`
- Modify: `scripts/render-assets.mjs`
- Modify: `scripts/check-source.mjs`
- Modify: `sidecar/extension.json`
- Modify: `sidecar/runtime/loader.mjs`
- Modify: `sidecar/src/denia-old-days-extension.js`
- Modify: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: `art/source/official/denia-right-sidebar-wide.jpg`
- Produces: `manifest.assets.rightSidebarWideArtwork`、`artUrls.rightSidebarWide`、`--denia-old-days-art-right-sidebar-wide`

- [ ] **Step 1: 写入失败的素材与生命周期测试**

在 `expectedAssets` 增加：

```js
rightSidebarWideArtwork: "assets/denia-right-sidebar-wide.webp",
```

在 `runtimeTokens` 增加：

```js
"__DENIA_OLD_DAYS_EXTENSION_RIGHT_SIDEBAR_WIDE_ART_JSON__",
```

将 artwork 数量契约从七张改为八张，并断言 `--denia-old-days-art-right-sidebar-wide` 在安装和 cleanup 中完整出现。

在 `scripts/check-source.mjs` 增加源哈希和输出尺寸断言：

```js
["art/source/official/denia-right-sidebar-wide.jpg", "d312c86f21610d7d6b50b8d8fa9b9685ef4baa11d34c0ca72fd71a712bfa42ed"],
```

```js
if (
  metadata.format !== "webp"
  || metadata.width !== 1840
  || metadata.height !== 1080
) {
  throw new Error("right sidebar wide artwork must be a 1840x1080 WebP");
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
node scripts/check-source.mjs
```

Expected: 分别因为 manifest 缺少 `rightSidebarWideArtwork` 和源文件不存在而失败。

- [ ] **Step 3: 提升素材并实现构建**

将素材库文件按原字节复制到官方构建输入，并增加：

```js
await sharp(source("official/denia-right-sidebar-wide.jpg"))
  .resize(1840, 1080, { fit: "cover", position: "centre" })
  .webp({ quality: 84, smartSubsample: true })
  .toFile(output("sidecar/assets/denia-right-sidebar-wide.webp"));
```

- [ ] **Step 4: 扩展 manifest、loader 和 runtime**

模板常量：

```js
const rightSidebarWideArtDataUrl =
  __DENIA_OLD_DAYS_EXTENSION_RIGHT_SIDEBAR_WIDE_ART_JSON__;
```

对象 URL：

```js
rightSidebarWide: dataUrlToObjectUrl(rightSidebarWideArtDataUrl),
```

根变量：

```js
root.style.setProperty(
  "--denia-old-days-art-right-sidebar-wide",
  `url("${artUrls.rightSidebarWide}")`,
);
```

- [ ] **Step 5: 生成并验证**

Run:

```bash
node scripts/render-assets.mjs
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
```

Expected: 三个命令通过，宽幅 WebP 小于 `1 MiB`。

---

### Task 2: 增加宽度状态和可清理视觉层

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.js`
- Modify: `sidecar/tests/validate.mjs`

**Interfaces:**
- Produces: `sidebarLayoutForWidth(width)`、`--denia-sidebar-wide-progress`、`data-denia-sidebar-layout`、`.denia-old-days-ds-native-sidebar-art`

- [ ] **Step 1: 写入失败的宽度和生命周期测试**

覆盖：

```js
assert(sidebarLayoutForWidth(320).layout === "compact");
assert(sidebarLayoutForWidth(560).layout === "transition");
assert(sidebarLayoutForWidth(840).layout === "workspace");
assert(sidebarLayoutForWidth(1240).progress === 1);
```

在运行时 harness 中触发 ResizeObserver，并断言：

```js
assert(panel.style.getPropertyValue("--denia-sidebar-wide-progress") === ".3");
assert(root.dataset.deniaSidebarLayout === "transition");
assert(state.sidebarResizeObserver.disconnectCount === 1);
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: 因缺少宽度状态和视觉层而失败。

- [ ] **Step 3: 实现纯函数和视觉层**

```js
function sidebarLayoutForWidth(width) {
  const progress = Math.min(1, Math.max(0, (width - 440) / 400));
  return {
    layout: width <= 440 ? "compact" : width >= 840 ? "workspace" : "transition",
    progress,
  };
}
```

视觉层只创建一次：

```js
const art = own(document.createElement("div"));
art.className = "denia-old-days-ds-native-sidebar-art";
art.setAttribute("aria-hidden", "true");
for (const name of ["portrait", "wide-ambient", "wide-scene", "scrim"]) {
  const layer = own(document.createElement("span"));
  layer.className = `denia-old-days-ds-native-sidebar-art-${name}`;
  art.append(layer);
}
panel.prepend(art);
```

- [ ] **Step 4: 实现 ResizeObserver 生命周期**

- 新面板出现时观察该面板。
- 面板替换时断开旧 observer 并观察新面板。
- 回调调用 `scheduleRefresh(DIRTY.SIDEBAR | DIRTY.LAYOUT | DIRTY.WORK_SURFACES)`。
- cleanup 时断开 observer。
- 零宽阶段不覆盖最后可信的面板宽度快照。

- [ ] **Step 5: 运行测试**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: PASS。

---

### Task 3: 修复首帧快捷项和输入焦点

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.js`
- Modify: `sidecar/src/denia-old-days-extension.css`
- Modify: `sidecar/tests/validate.mjs`

**Interfaces:**
- Produces: 零宽结构化快捷项识别、无框选项样式、composer 内部焦点环

- [ ] **Step 1: 写入失败的零宽挂载测试**

创建 `aside[data-app-shell-focus-area="right-panel"]`，宽度为零，并在其中放入：

```text
ul
└── li
    └── button
```

在同一次 mutation flush 后断言按钮已获得 `denia-old-days-ds-native-sidebar-row`，且未等待 animation frame。

- [ ] **Step 2: 写入失败的 CSS 契约**

断言：

```css
.denia-old-days-ds-native-sidebar-row {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none;
}

.denia-old-days-ds-composer :is(textarea, [contenteditable="true"]):focus-visible {
  outline: none !important;
  outline-offset: 0 !important;
}
```

并断言 composer `:has(...:focus-visible)` 使用内部 `inset` 焦点环。

- [ ] **Step 3: 运行测试并确认失败**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: 因零宽快捷项未装饰和 composer 仍使用外 outline 而失败。

- [ ] **Step 4: 实现结构优先识别**

- 优先收集 `ul/ol` 直接 `li` 内的交互元素。
- 不要求非零尺寸。
- 排除自有节点、弹窗、菜单、提示和嵌入视图。
- 对其余结构继续使用现有几何回退。

- [ ] **Step 5: 实现无框选项和内部焦点环**

- 默认快捷项透明、无边框、无阴影。
- hover 和 focus 只增加低强度底色。
- ProseMirror 和 textarea 取消外 outline。
- composer 壳层通过 `:has` 绘制内部焦点环。
- 工作区状态使用更高不透明度的 composer 表面。

- [ ] **Step 6: 运行测试**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: PASS。

---

### Task 4: 绘制双画幅、更新文档并运行验收

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.css`
- Modify: `canon/sources.md`
- Modify: `docs/current-theme-design.md`
- Modify: `sidecar/NOTICE.md`
- Modify: `scripts/build-local-kaboo-release.mjs`
- Modify: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: `--denia-sidebar-wide-progress` 和两张右侧栏资源
- Produces: 明暗双主题交叉淡入、来源记录、可安装发布包和视觉证据

- [ ] **Step 1: 写入失败的视觉层 CSS 契约**

断言视觉层：

- 绝对定位、铺满面板、不可交互。
- portrait opacity 为 `calc(1 - var(--denia-sidebar-wide-progress))`。
- wide ambient 和 scene opacity 使用进度变量。
- scene 使用 `contain`，ambient 使用 `cover`。
- 动画只包含 `opacity` 和 `transform`。

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: 因视觉层样式不存在而失败。

- [ ] **Step 3: 实现明暗视觉层**

- 明色使用冷白蓝灰遮罩。
- 深色使用海军蓝靛蓝遮罩。
- `prefers-reduced-transparency` 隐藏视觉层并使用纯色。
- `prefers-reduced-motion` 将 transition duration 降为 `0.01ms`。

- [ ] **Step 4: 更新来源和当前设计**

记录：

- 宽幅源文件路径、`1840×1080`、源哈希。
- 输出 WebP 尺寸、哈希和构建参数。
- 紧凑、过渡、工作区三状态。
- 首帧快捷项和 composer 焦点修复。

- [ ] **Step 5: 完整自动化验证**

Run:

```bash
npm run check
npm run build:kaboo
git diff --check
```

Expected: 全部通过。

- [ ] **Step 6: 热安装并视觉验收**

Run:

```bash
sidecar/scripts/install.sh
sidecar/scripts/status.sh
sidecar/scripts/verify.sh
```

在浅色和深色模式检查 `320px`、约 `560px`、约 `760px` 和完全展开状态，确认画面过渡、快捷项首帧和 composer 焦点均正确。

- [ ] **Step 7: 提交最终改动**

```bash
git add art/source/official/denia-right-sidebar-wide.jpg \
  sidecar/assets/denia-right-sidebar-wide.webp \
  scripts sidecar canon docs
git commit -m "feat: adapt right sidebar across widths"
```
