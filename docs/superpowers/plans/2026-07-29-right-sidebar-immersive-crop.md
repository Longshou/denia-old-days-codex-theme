# Right Sidebar Immersive Crop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为右侧栏增加轻量极光毛玻璃拖拽遮罩，并让稳定宽幅背景使用沉浸裁切铺满面板。

**Architecture:** 保留现有四层视觉结构和指针拖拽状态，只修改 CSS。拖拽时用现有 scrim 的伪元素绘制光晕与流光，稳定宽幅状态改用单层 `cover` 主场景。

**Tech Stack:** 原生 CSS、Node.js CSS 契约测试、Sidecar CDP 热安装。

## Global Constraints

- 不增加 DOM 节点、JavaScript 状态或第三方依赖。
- 动效只修改 `transform` 与 `opacity`。
- 宽幅背景允许裁切，不能出现上下留边。
- 窄栏竖图和宽高比阈值保持不变。
- 保留减少动态效果与减少透明度降级。

---

### Task 1: 实现沉浸裁切与拖拽玻璃

**Files:**
- Modify: `sidecar/tests/validate.mjs:1170-1260`
- Modify: `sidecar/src/denia-old-days-extension.css:699-778`
- Modify: `sidecar/src/denia-old-days-extension.css:1697-1744`

**Interfaces:**
- Consumes: `data-denia-sidebar-artwork`、`data-denia-sidebar-resizing`、现有 portrait、wide ambient、wide scene、scrim 图层。
- Produces: `denia-sidebar-glow-drift`、`denia-sidebar-glass-sweep` 动画和无留边宽幅背景。

- [ ] **Step 1: 写入失败的 CSS 契约测试**

在 `sidecar/tests/validate.mjs` 中：

```js
assertCssDeclarations(stylesheetRules, nativeSidebarWideSceneSelector, {
  "background-position": "51% center",
  "background-size": "cover",
});

assert(
  !stylesheetRules.some((rule) =>
    rule.selectors.includes(nativeSidebarWideAmbientChoiceSelector)
      && Number.parseFloat(rule.declarations.get("opacity")) > 0),
  "settled wide artwork must not expose the blurred ambient layer",
);

const nativeSidebarResizePortraitSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"][data-denia-sidebar-artwork="portrait"] .denia-old-days-ds-native-sidebar-art-portrait';
const nativeSidebarResizeWideSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"][data-denia-sidebar-artwork="wide"] .denia-old-days-ds-native-sidebar-art-wide-scene';
const nativeSidebarResizeGlowSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"] .denia-old-days-ds-native-sidebar-art-scrim::before';
const nativeSidebarResizeSweepSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"] .denia-old-days-ds-native-sidebar-art-scrim::after';

assertCssDeclarations(stylesheetRules, nativeSidebarResizePortraitSelector, {
  opacity: ".12",
  transform: "scale(1.08)",
});
assertCssDeclarations(stylesheetRules, nativeSidebarResizeWideSelector, {
  opacity: ".12",
  transform: "scale(1.08)",
});
assertCssDeclarations(stylesheetRules, nativeSidebarResizeGlowSelector, {
  animation: "denia-sidebar-glow-drift 2.4s ease-in-out infinite alternate",
});
assertCssDeclarations(stylesheetRules, nativeSidebarResizeSweepSelector, {
  animation: "denia-sidebar-glass-sweep 1.8s ease-in-out infinite",
});

for (const animationName of [
  "denia-sidebar-glow-drift",
  "denia-sidebar-glass-sweep",
]) {
  const keyframeRules = stylesheetRules.filter((rule) =>
    rule.atRules.some((atRule) => atRule === `@keyframes ${animationName}`));
  assert(keyframeRules.length > 0, `${animationName} must define keyframes`);
  for (const rule of keyframeRules) {
    assert(
      [...rule.declarations.keys()].every((property) =>
        property === "transform" || property === "opacity"),
      `${animationName} may animate only transform and opacity`,
    );
  }
}
```

保留现有 `prefers-reduced-motion: reduce` 与 `prefers-reduced-transparency: reduce` 契约。

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: 因宽幅主场景仍为 `contain`，且拖拽伪元素动效不存在而失败。

- [ ] **Step 3: 实现最小 CSS**

将宽幅主场景改为：

```css
.denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-art-wide-scene {
  background-position: 51% center;
  background-size: cover;
}
```

删除稳定宽幅状态下 `.denia-old-days-ds-native-sidebar-art-wide-ambient` 的正透明度规则。拖拽状态增加低透明度背景：

```css
html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"][data-denia-sidebar-artwork="portrait"]
  .denia-old-days-ds-native-sidebar-art-portrait,
html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"][data-denia-sidebar-artwork="wide"]
  .denia-old-days-ds-native-sidebar-art-wide-scene {
  opacity: .12;
  filter: blur(18px) saturate(.76) brightness(.78);
  transform: scale(1.08);
}
```

scrim 使用现有节点和两个伪元素：

```css
.denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-art-scrim {
  overflow: hidden;
}

.denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-art-scrim::before,
.denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-art-scrim::after {
  content: "";
  position: absolute;
  pointer-events: none;
  opacity: 0;
}

html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"]
  .denia-old-days-ds-native-sidebar-art-scrim {
  backdrop-filter: blur(22px) saturate(140%);
  -webkit-backdrop-filter: blur(22px) saturate(140%);
  background:
    radial-gradient(circle at 18% 14%, rgba(132, 224, 235, .52), transparent 34%),
    radial-gradient(circle at 82% 74%, rgba(236, 143, 187, .38), transparent 38%),
    rgba(222, 232, 242, .74);
}

html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"]
  .denia-old-days-ds-native-sidebar-art-scrim::before {
  inset: -22%;
  background:
    radial-gradient(circle at 24% 24%, rgba(130, 221, 235, .62), transparent 34%),
    radial-gradient(circle at 76% 72%, rgba(239, 155, 193, .46), transparent 36%);
  opacity: .82;
  animation: denia-sidebar-glow-drift 2.4s ease-in-out infinite alternate;
}

html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"]
  .denia-old-days-ds-native-sidebar-art-scrim::after {
  top: -30%;
  bottom: -30%;
  left: -28%;
  width: 24%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .68), transparent);
  filter: blur(10px);
  opacity: .64;
  transform: translate3d(-160%, 0, 0) rotate(-9deg);
  animation: denia-sidebar-glass-sweep 1.8s ease-in-out infinite;
}

@keyframes denia-sidebar-glow-drift {
  from { transform: translate3d(-3%, -2%, 0) scale(1); opacity: .62; }
  to { transform: translate3d(5%, 4%, 0) scale(1.08); opacity: .9; }
}

@keyframes denia-sidebar-glass-sweep {
  0%, 18% { transform: translate3d(-160%, 0, 0) rotate(-9deg); opacity: 0; }
  42% { opacity: .64; }
  82%, 100% { transform: translate3d(620%, 0, 0) rotate(-9deg); opacity: 0; }
}
```

深色模式替换 scrim 和伪元素背景颜色，不改变动画参数。现有全局减少动态效果规则关闭动画，现有减少透明度规则隐藏整个视觉层。

- [ ] **Step 4: 运行测试并确认通过**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
npm run check
git diff --check
```

Expected: 全部通过。

- [ ] **Step 5: 热安装并实机验证**

Run:

```bash
sidecar/scripts/install.sh
sidecar/scripts/status.sh
sidecar/scripts/verify.sh
```

实机检查：

- `320px` 窄栏仍显示竖图。
- `840px` 宽栏铺满横幅，无上下留边。
- 拖住超过 `350ms` 时毛玻璃与流光持续显示。
- 松手后动效停止并显示正确背景。
- 明色和深色模式文字保持可读。

- [ ] **Step 6: 提交**

```bash
git add sidecar/src/denia-old-days-extension.css sidecar/tests/validate.mjs
git commit -m "feat: refine sidebar resize visuals"
```
