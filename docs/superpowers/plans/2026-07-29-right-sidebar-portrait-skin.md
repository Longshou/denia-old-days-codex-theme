# Right Sidebar Portrait Skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用指定人物素材为 Codex 原生右侧栏增加明暗双主题皮肤，并保持原生布局、交互和资源清理契约不变。

**Architecture:** 将资料库 PNG 按原始字节提升为受校验的官方构建输入，确定性生成 `640×1600` WebP。Sidecar loader 将新资源编码进安装载荷，runtime 创建专用对象 URL 和 CSS 变量，右侧栏通过模式遮罩叠加图片；测试分别约束素材、资源生命周期、paint-only CSS 和降级行为。

**Tech Stack:** Node.js 20+、Sharp 0.34.5、原生 CSS、Sidecar CDP loader、Node `vm` 测试、Bash 生命周期脚本。

## Global Constraints

- 目标只包含 `.denia-old-days-ds-native-right-sidebar`，左侧导航不使用人物图。
- 明色和深色模式共用 `denia-dark-form-smile-closeup.png`。
- 人物图固定在右侧栏底部，优先保留眼睛、笑容和蓝色手套。
- 不增加 DOM、伪元素、布局属性、动画、滤镜、外发光或运行时网络请求。
- 不修改右侧栏宽度、高度、滚动、焦点顺序、按钮、快捷键和原生状态。
- 普通分组和列表行使用半透明功能表面，语义状态保持高可读性。
- `prefers-reduced-transparency: reduce` 回退到现有纯色表面。
- 运行时 WebP 固定为 `640×1600`，文件小于 `1 MiB`。
- 专用变量为 `--denia-old-days-art-right-sidebar`。
- 所有实现提交直接落在当前 `main`，不创建额外分支。

---

### Task 1: 提升素材并生成右侧栏 WebP

**Files:**
- Create: `art/source/official/denia-dark-form-smile-closeup.png`
- Modify: `scripts/release-inputs.mjs`
- Modify: `scripts/render-assets.mjs`
- Modify: `scripts/check-source.mjs`
- Generate: `sidecar/assets/denia-right-sidebar.webp`

**Interfaces:**
- Consumes: 资料库 PNG，SHA-256 为 `1dcbfa127968c2386ad77da325f850ad4985bccc95959d915652df36dcba2296`
- Produces: `sidecar/assets/denia-right-sidebar.webp`，WebP `640×1600`，小于 `1 MiB`

- [ ] **Step 1: 写入失败的素材契约**

在 `scripts/check-source.mjs` 的 `officialSources` 中增加：

```js
["art/source/official/denia-dark-form-smile-closeup.png", "1dcbfa127968c2386ad77da325f850ad4985bccc95959d915652df36dcba2296"],
```

在 `generatedFiles` 中增加：

```js
"sidecar/assets/denia-right-sidebar.webp",
```

在深色首页尺寸检查后增加：

```js
const rightSidebarArtwork = path.join(root, "sidecar/assets/denia-right-sidebar.webp");
const rightSidebarMetadata = await sharp(rightSidebarArtwork).metadata();
if (
  rightSidebarMetadata.format !== "webp"
  || rightSidebarMetadata.width !== 640
  || rightSidebarMetadata.height !== 1600
) {
  throw new Error(
    `right sidebar artwork must be a 640x1600 WebP: ${rightSidebarMetadata.width}x${rightSidebarMetadata.height}`,
  );
}
```

- [ ] **Step 2: 运行检查并确认失败**

Run:

```bash
node scripts/check-source.mjs
```

Expected: FAIL with `ENOENT` for `art/source/official/denia-dark-form-smile-closeup.png`.

- [ ] **Step 3: 提升原始素材**

Run:

```bash
cp art/reference/visual-library/production-ready/denia-dark-form-smile-closeup.png art/source/official/denia-dark-form-smile-closeup.png
shasum -a 256 art/source/official/denia-dark-form-smile-closeup.png
```

Expected:

```text
1dcbfa127968c2386ad77da325f850ad4985bccc95959d915652df36dcba2296
```

- [ ] **Step 4: 声明构建输入**

在 `scripts/release-inputs.mjs` 的 `RENDERER_SOURCE_INPUTS` 中增加：

```js
"art/source/official/denia-dark-form-smile-closeup.png",
```

- [ ] **Step 5: 增加确定性渲染**

在 `scripts/render-assets.mjs` 的首页运行时资源之后增加：

```js
await sharp(source("official/denia-dark-form-smile-closeup.png"))
  .resize(640, 1600, { fit: "cover", position: "east" })
  .webp({ quality: 86, smartSubsample: true })
  .toFile(output("sidecar/assets/denia-right-sidebar.webp"));
```

- [ ] **Step 6: 生成并验证资源**

Run:

```bash
node scripts/render-assets.mjs
node scripts/check-source.mjs
sips -g pixelWidth -g pixelHeight -g format sidecar/assets/denia-right-sidebar.webp
ls -lh sidecar/assets/denia-right-sidebar.webp
```

Expected:

```text
source structure ok
pixelWidth: 640
pixelHeight: 1600
format: webp
```

文件大小必须小于 `1 MiB`。

- [ ] **Step 7: 提交素材管线**

```bash
git add art/source/official/denia-dark-form-smile-closeup.png scripts/release-inputs.mjs scripts/render-assets.mjs scripts/check-source.mjs
git commit -m "feat: build right sidebar portrait artwork"
```

---

### Task 2: 接入 Sidecar 资源生命周期

**Files:**
- Modify: `sidecar/extension.json`
- Modify: `sidecar/runtime/loader.mjs`
- Modify: `sidecar/src/denia-old-days-extension.js`
- Modify: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: `manifest.assets.rightSidebarArtwork`
- Produces: `artUrls.rightSidebar` 和根变量 `--denia-old-days-art-right-sidebar`

- [ ] **Step 1: 扩展失败的 manifest 和模板测试**

在 `sidecar/tests/validate.mjs` 的 `expectedAssets` 中增加：

```js
rightSidebarArtwork: "assets/denia-right-sidebar.webp",
```

在 `runtimeTokens` 中增加：

```js
"__DENIA_OLD_DAYS_EXTENSION_RIGHT_SIDEBAR_ART_JSON__",
```

将 `assertRuntimeArtworkLifecycle` 的资源定义改为：

```js
const propertyNames = [
  "bright",
  "dark",
  "right-sidebar",
  "task-warm",
  "task-approval",
  "task-error",
  "task-complete",
].map((name) => `--denia-old-days-art-${name}`);
const artworkKeys = "bright,dark,rightSidebar,taskWarm,taskApproval,taskError,taskComplete";
```

并将该函数中的数量契约从 6、12 改为 7、14，冻结对象键比较统一使用 `artworkKeys`，撤销 URL 期望覆盖 `blob:denia-1` 到 `blob:denia-14`。

在 loader 断言中增加：

```js
assert(
  loader.includes("--denia-old-days-art-right-sidebar"),
  "live verification must read right sidebar artwork variable",
);
```

- [ ] **Step 2: 运行 Sidecar 测试并确认失败**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL with `unexpected rightSidebarArtwork`.

- [ ] **Step 3: 增加 manifest 资源键**

在 `sidecar/extension.json` 的 `assets` 中增加：

```json
"rightSidebarArtwork": "assets/denia-right-sidebar.webp"
```

- [ ] **Step 4: 扩展 loader**

在 `sidecar/runtime/loader.mjs` 中增加：

```js
const rightSidebarPath = path.resolve(extensionDir, manifest.assets.rightSidebarArtwork);
```

将 `rightSidebarRealPath` 和 `rightSidebar` 加入现有的 `Promise.all` 解析和读取数组。

扩展模板映射：

```js
rightSidebar: "__DENIA_OLD_DAYS_EXTENSION_RIGHT_SIDEBAR_ART_JSON__",
```

扩展哨兵映射：

```js
rightSidebar: "@@DENIA_RUNTIME_RIGHT_SIDEBAR_ART_7F3A@@",
```

扩展 staging：

```js
.replace(templatePlaceholders.rightSidebar, templateSentinels.rightSidebar)
```

扩展载荷：

```js
[templateSentinels.rightSidebar, JSON.stringify(imageDataUrl(rightSidebarPath, rightSidebar))],
```

实时验证读取：

```js
const rightSidebarRuntimeArt = getComputedStyle(root)
  .getPropertyValue('--denia-old-days-art-right-sidebar')
  .trim();
```

结果和基础验收增加：

```js
rightSidebarArtPresent: Boolean(rightSidebarRuntimeArt),
```

```js
&& result.rightSidebarArtPresent
```

- [ ] **Step 5: 扩展 runtime**

在 `sidecar/src/denia-old-days-extension.js` 增加模板常量：

```js
const rightSidebarArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_RIGHT_SIDEBAR_ART_JSON__;
```

扩展 `artUrls`：

```js
rightSidebar: dataUrlToObjectUrl(rightSidebarArtDataUrl),
```

设置根变量：

```js
root.style.setProperty(
  "--denia-old-days-art-right-sidebar",
  `url("${artUrls.rightSidebar}")`,
);
```

将 cleanup 名称数组改为：

```js
for (const name of [
  "bright",
  "dark",
  "right-sidebar",
  "task-warm",
  "task-approval",
  "task-error",
  "task-complete",
]) {
  root.style.removeProperty(`--denia-old-days-art-${name}`);
}
```

- [ ] **Step 6: 运行生命周期测试**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: PASS with `Validated 达妮娅 · 旧日斑斓 extension 0.1.0`.

- [ ] **Step 7: 提交资源生命周期**

```bash
git add sidecar/extension.json sidecar/runtime/loader.mjs sidecar/src/denia-old-days-extension.js sidecar/tests/validate.mjs
git commit -m "feat: preload right sidebar portrait"
```

---

### Task 3: 绘制双主题右侧栏

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.css`
- Modify: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: `--denia-old-days-art-right-sidebar`
- Produces: 明暗双主题遮罩、半透明内容表面、纯色透明度回退

- [ ] **Step 1: 写入失败的 CSS 契约**

在 `sidebarPaintProperties` 中增加：

```js
"background-position",
"background-repeat",
"background-size",
```

将原来的全侧栏人物变量禁用断言拆成：

```js
const rightSidebarArtworkProperty = "--denia-old-days-art-right-sidebar";
const forbiddenRightSidebarArtworkProperties = [
  "--denia-old-days-art-bright",
  "--denia-old-days-art-dark",
  "--denia-old-days-art-task-warm",
  "--denia-old-days-art-task-approval",
  "--denia-old-days-art-task-error",
  "--denia-old-days-art-task-complete",
];

for (const rule of stylesheetRules) {
  const selectors = rule.selectors.filter((selector) =>
    nativeSidebarClasses.some((className) => selector.includes(className)));
  if (!selectors.length) continue;
  for (const property of rule.declarations.keys()) {
    assert(sidebarPaintProperties.has(property), `native sidebar selector must stay paint-only: ${property}`);
  }
  for (const [property, value] of rule.declarations) {
    if (!value.includes("--denia-old-days-art-")) continue;
    assert(
      selectors.every((selector) => selector.includes(".denia-old-days-ds-native-right-sidebar")),
      `only the native right sidebar may use character artwork: ${property}`,
    );
    assert(
      value.includes(rightSidebarArtworkProperty),
      `native right sidebar must use its dedicated artwork: ${property}`,
    );
    for (const forbidden of forbiddenRightSidebarArtworkProperties) {
      assert(!value.includes(forbidden), `native right sidebar must not use ${forbidden}`);
    }
  }
}
```

增加明暗规则断言：

```js
const lightRightSidebarRule = findCssRule(
  stylesheetRules,
  ".denia-old-days-ds-extension .denia-old-days-ds-native-right-sidebar",
);
const darkRightSidebarRule = findCssRule(
  stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-theme="dark"] .denia-old-days-ds-native-right-sidebar',
);
for (const rule of [lightRightSidebarRule, darkRightSidebarRule]) {
  assert(
    rule.declarations.get("background-image")?.includes(rightSidebarArtworkProperty),
    "both themes must paint the dedicated right sidebar artwork",
  );
  assert(
    rule.declarations.get("background-position") === "center bottom, center bottom",
    "right sidebar artwork must stay bottom anchored",
  );
  assert(
    rule.declarations.get("background-size") === "cover, cover",
    "right sidebar artwork must cover the panel",
  );
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL with `both themes must paint the dedicated right sidebar artwork`.

- [ ] **Step 3: 绘制明色右侧栏**

将明色右侧栏面板改为：

```css
.denia-old-days-ds-extension .denia-old-days-ds-native-right-sidebar {
  color: var(--denia-ink);
  background-color: rgba(255, 252, 249, .992) !important;
  background-image:
    linear-gradient(
      180deg,
      rgba(255, 252, 249, .98) 0%,
      rgba(255, 252, 249, .94) 25%,
      rgba(246, 251, 253, .76) 56%,
      rgba(225, 239, 247, .62) 100%
    ),
    var(--denia-old-days-art-right-sidebar);
  background-position: center bottom, center bottom;
  background-repeat: no-repeat, no-repeat;
  background-size: cover, cover;
  border-color: rgba(111, 184, 231, .32) !important;
  box-shadow:
    inset 3px 0 rgba(111, 184, 231, .34),
    inset 2px 0 rgba(255, 255, 255, .84),
    inset 12px 0 28px rgba(111, 184, 231, .06),
    -16px 0 40px rgba(38, 53, 72, .09);
  transition: background-color 220ms cubic-bezier(.22, 1, .36, 1), box-shadow 220ms cubic-bezier(.22, 1, .36, 1);
}
```

将明色内容表面调整为：

```css
.denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-group {
  background: rgba(255, 254, 252, .9) !important;
}

.denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-row {
  background: rgba(255, 254, 252, .84);
}
```

首页右侧栏的 `background-image` 保持相同人物变量，只提高顶部暖白遮罩，不移除图片。

- [ ] **Step 4: 绘制深色右侧栏**

将深色右侧栏面板改为：

```css
.denia-old-days-ds-extension[data-denia-theme="dark"] .denia-old-days-ds-native-right-sidebar {
  color: var(--denia-dark-text);
  background-color: rgba(26, 28, 58, .99) !important;
  background-image:
    linear-gradient(
      180deg,
      rgba(18, 20, 47, .98) 0%,
      rgba(20, 23, 52, .94) 25%,
      rgba(20, 24, 55, .78) 56%,
      rgba(12, 15, 37, .68) 100%
    ),
    var(--denia-old-days-art-right-sidebar);
  background-position: center bottom, center bottom;
  background-repeat: no-repeat, no-repeat;
  background-size: cover, cover;
  border-color: var(--denia-dark-divider) !important;
  box-shadow:
    inset 3px 0 rgba(141, 197, 234, .28),
    inset 2px 0 rgba(243, 239, 246, .04),
    -16px 0 40px rgba(8, 10, 32, .26);
}
```

将深色内容表面调整为：

```css
.denia-old-days-ds-extension[data-denia-theme="dark"] .denia-old-days-ds-native-sidebar-group {
  background: rgba(32, 35, 72, .9) !important;
}

.denia-old-days-ds-extension[data-denia-theme="dark"] .denia-old-days-ds-native-sidebar-row {
  background: rgba(26, 28, 58, .84);
}
```

深色首页右侧栏继续使用人物变量，只提高顶部海军蓝遮罩。

- [ ] **Step 5: 保留透明度回退**

确认现有两个 `@media (prefers-reduced-transparency: reduce)` 规则分别将明色右侧栏恢复为 `#fffdf9`，将深色右侧栏恢复为 `var(--denia-dark-surface)`，并在测试中断言回退规则的 `background` 不包含人物变量。

- [ ] **Step 6: 运行 CSS 和完整测试**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
npm test --if-present
npm run check
```

Expected: Sidecar validation and `source structure ok` pass.

- [ ] **Step 7: 提交双主题绘制**

```bash
git add sidecar/src/denia-old-days-extension.css sidecar/tests/validate.mjs
git commit -m "feat: skin native right sidebar"
```

---

### Task 4: 更新来源说明、构建发布包并热安装

**Files:**
- Modify: `canon/sources.md`
- Modify: `docs/current-theme-design.md`
- Modify: `sidecar/NOTICE.md`
- Modify: `scripts/build-local-kaboo-release.mjs`
- Generate: `sidecar/release/kaboo-local/denia-old-days/0.1.0/*`

**Interfaces:**
- Consumes: 已通过测试的 Sidecar 和右侧栏 WebP
- Produces: 可安装 Kaboo 本地包、运行中的已验证 Sidecar、明暗模式视觉证据

- [ ] **Step 1: 更新来源和当前设计**

在 `canon/sources.md` 的官方源文件表增加 `Right sidebar` 行，记录：

```text
art/source/official/denia-dark-form-smile-closeup.png
1080×1920
1dcbfa127968c2386ad77da325f850ad4985bccc95959d915652df36dcba2296
```

在生成输出表增加 `sidecar/assets/denia-right-sidebar.webp`，记录实际构建哈希和 `640×1600` 偏右裁切。

在 `docs/current-theme-design.md` 的原生右侧栏章节写明：

- 明暗模式共用笑容近景。
- 顶部强遮罩、底部弱遮罩。
- 分组和行使用半透明功能表面。
- 透明度偏好回退到纯色。
- 左侧导航和任务人物栏不变。

- [ ] **Step 2: 更新包内来源告知**

在 `sidecar/NOTICE.md` 和 `scripts/build-local-kaboo-release.mjs` 的 `artworkNotice` 中增加右侧栏来源、原始尺寸、源哈希和运行时文件名。

将本地包摘要补充为原生右侧栏双主题人物皮肤，不改变 `recommendedNativeAppearance: "light"`。

- [ ] **Step 3: 运行完整检查**

Run:

```bash
npm run check
git diff --check
```

Expected:

```text
source structure ok
Validated 达妮娅 · 旧日斑斓 extension 0.1.0
```

- [ ] **Step 4: 构建本地 Kaboo 包**

Run:

```bash
npm run build:kaboo
```

Expected: 输出 `sidecar/release/kaboo-local/denia-old-days/0.1.0/catalog-version.json`，包内校验通过。

- [ ] **Step 5: 提交文档和发布描述**

```bash
git add canon/sources.md docs/current-theme-design.md sidecar/NOTICE.md scripts/build-local-kaboo-release.mjs
git commit -m "docs: record right sidebar portrait skin"
```

- [ ] **Step 6: 热安装并验证**

Run:

```bash
sidecar/scripts/install.sh
sidecar/scripts/status.sh
sidecar/scripts/verify.sh
```

Expected:

```text
installed=true
running=true
verified=true
```

- [ ] **Step 7: 做明暗模式视觉复核**

通过本地 CDP 临时打开右侧栏并分别检查 `data-denia-theme="light"` 和 `data-denia-theme="dark"`：

- 右侧栏计算样式包含 `--denia-old-days-art-right-sidebar` 对应对象 URL。
- 人物图固定在底部，眼睛、笑容和蓝色手套可辨认。
- 标题、列表、按钮和图标保持清晰。
- 明色模式没有脏灰蒙层。
- 深色模式没有过亮蓝光或粉色外发光。
- 复核结束后恢复原主题和右侧栏开关状态。

- [ ] **Step 8: 最终仓库检查**

Run:

```bash
git status --short
git log -5 --oneline
```

Expected: 工作区干净，最近提交依次包含素材管线、资源预加载、右侧栏绘制和文档更新。
