# 达妮娅泡泡拍立得 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将达妮娅主题首页改为 P2 经典泡泡拍立得，强化双形态状态配色，并生成一组可复现的主题能力截图。

**Architecture:** 保留现有三套包内官方美术和 Sidecar 生命周期。设计源继续由 `art/source`、CSS 和 Sharp 确定性渲染组成；运行时只增加主题拥有的泡泡装饰节点，并通过已有 `data-denia-form-state` 切换亮态与暗态。Kaboo 继续钉定主题提交，另用实际 Registry 能力映射生成一张本地展示图。

**Tech Stack:** SVG、CSS、JavaScript、Node.js、Sharp、Vitest、Vite Node、Kaboo Codex Theme Builder

## Global Constraints

- 不改变原生按钮的语义、事件绑定、项目选择、输入、附件、发送、工具记录或助手回复行为。
- 不增加远程图片请求，只使用当前已确认来源的三套包内美术。
- 不新增未经确认的角色设定、剧情名词或翻译。
- 首页、`staged`、`complete` 使用明快亮态；`working`、`approval`、`error` 才递进引入暗态。
- 暗色人物美术只能位于阅读列外侧，不能覆盖正文、代码、Diff 或输入控件。
- 小于 920px 时隐藏人物相片和任务画轨，并保持单列布局无横向溢出。
- 所有动效遵守 `prefers-reduced-motion`，透明效果遵守 `prefers-reduced-transparency`。
- 生成 P2 首页宽屏、首页紧凑、working、approval、error、complete 和 Registry 能力展示图。
- 静态设计预览必须明确标注为预览，不得冒充实际运行截图。
- 不安装 Dream Skin Studio，不上传远程仓库，不发布 Registry。

---

## File Structure

### 主题源码仓库

- Modify: `art/source/background.svg`
  - 只负责书页背景、泡泡场和装订结构，不再包含星形、皇冠状或花形贴纸。
- Modify: `art/source/task-preview.svg`
  - 继续作为 working 状态的任务页基础构图。
- Modify: `scripts/render-assets.mjs`
  - 负责 P2 拍立得、首页宽屏和紧凑预览、四种任务状态预览的确定性渲染。
- Modify: `scripts/check-source.mjs`
  - 负责源结构、禁用装饰、P2 标记、展示图存在性和图片尺寸检查。
- Modify: `sidecar/src/denia-old-days-extension.js`
  - 只创建主题拥有的泡泡、拍立得和状态标识节点，不改变原生行为。
- Modify: `sidecar/src/denia-old-days-extension.css`
  - 负责 P2 相纸材质、泡泡、亮暗状态色与响应式布局。
- Modify: `sidecar/extension.json`
  - 将星形品牌标识改为不含字符的泡泡视觉标识。
- Modify: `theme/theme.json`
  - 同步角色化的珊瑚粉、深靛紫和泡泡品牌标识。
- Modify: `sidecar/tests/validate.mjs`
  - 覆盖泡泡节点所有权、P2 样式、状态递进、响应式和清理。
- Modify: `canon/sources.md`
  - 更新全部生成图尺寸、渲染参数和 SHA-256。

### Kaboo 仓库

- Create: `frontend/scripts/render-denia-registry-showcase.ts`
  - 从真实 `presentCodexThemeCapability` 映射和打包后的 manifest 生成 Registry 能力展示图。
- Create: `frontend/scripts/render-denia-registry-showcase.test.ts`
  - 验证 15 项能力都来自实际映射，输出 PNG 非空且尺寸正确。
- Modify: `scripts/codex-theme/build-specs/denia-old-days/0.1.0.json`
  - 钉定新主题提交并更新忽略产物哈希。

### 本地交付目录

- Refresh: `outputs/denia-old-days-local-release/denia-old-days/0.1.0/`
- Create: `outputs/denia-old-days-showcase/`
  - 收集 7 张展示图和 `README.md`，明确区分设计预览与实际运行截图。

---

### Task 1: 建立首页 P2 与泡泡源契约

**Files:**
- Modify: `scripts/check-source.mjs`
- Modify: `art/source/background.svg`
- Modify: `scripts/render-assets.mjs`
- Test: `scripts/check-source.mjs`

**Interfaces:**
- Consumes: 当前三个官方源文件和 `KABOO_SHARP_ENTRY`。
- Produces:
  - `renderHomePreview({ compact: boolean }): Promise<Buffer>`
  - `homeLayoutOverlay({ width: number, height: number, compact: boolean }): Buffer`
  - `bubbleTransitionOverlay({ width: number, height: number, compact: boolean }): Buffer`
  - `evidence/home.png`
  - `evidence/home-compact.png`

- [ ] **Step 1: 写入会失败的源契约**

在 `scripts/check-source.mjs` 中读取背景与渲染脚本，并加入明确断言：

```js
const backgroundSource = fs.readFileSync(path.join(root, "art/source/background.svg"), "utf8");
const rendererSource = fs.readFileSync(path.join(root, "scripts/render-assets.mjs"), "utf8");

if (!backgroundSource.includes('id="denia-bubble-field"')) {
  throw new Error("background must define the Denia bubble field");
}
for (const retired of ["denia-star", "denia-crown-sticker", "denia-flower-sticker"]) {
  if (backgroundSource.includes(`id="${retired}"`)) {
    throw new Error(`background must retire ${retired}`);
  }
}
for (const retiredFragment of [
  "M147 138l15 25",
  'translate(1575 170) rotate(8)',
  'translate(269 820)',
]) {
  if (backgroundSource.includes(retiredFragment)) {
    throw new Error(`background still contains retired decoration: ${retiredFragment}`);
  }
}
for (const marker of ["renderHomePreview", "P2_POLAROID", "evidence/home-compact.png"]) {
  if (!rendererSource.includes(marker)) throw new Error(`renderer missing ${marker}`);
}
```

将 `evidence/home-compact.png` 加入 `generatedFiles`，用 PNG 文件头直接检查尺寸，避免给源检查增加依赖：

```js
const expectedDimensions = new Map([
  ["evidence/home.png", [1600, 1000]],
  ["evidence/home-compact.png", [1200, 800]],
]);
for (const [relative, [expectedWidth, expectedHeight]] of expectedDimensions) {
  const bytes = fs.readFileSync(path.join(root, relative));
  if (bytes.toString("ascii", 1, 4) !== "PNG") throw new Error(`not a PNG: ${relative}`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`unexpected dimensions for ${relative}: ${width}x${height}`);
  }
}
```

- [ ] **Step 2: 运行源检查并确认正确失败**

Run:

```bash
node scripts/check-source.mjs
```

Expected: FAIL，首个错误为 `background must define the Denia bubble field`。

- [ ] **Step 3: 把背景装饰替换为泡泡场**

在 `art/source/background.svg` 中保留书页、装订和低对比纸纹，删除星形、皇冠状与花形节点。新增：

```svg
<g id="denia-bubble-field" opacity=".62" fill="none" stroke="#86d5df">
  <g transform="translate(1710 245)">
    <circle r="72" fill="url(#bubble)" stroke-width="2"/>
    <circle cx="-78" cy="92" r="28" fill="url(#bubble)"/>
  </g>
  <g transform="translate(140 720)">
    <circle r="48" fill="url(#bubble)" stroke-width="2"/>
    <circle cx="62" cy="-48" r="20" fill="url(#bubble)"/>
  </g>
</g>
```

把泡泡径向渐变调为水青主体、珊瑚粉暗面与白色高光，不能使用外发光。

- [ ] **Step 4: 提取 P2 首页渲染函数**

在 `scripts/render-assets.mjs` 中定义：

```js
const P2_POLAROID = Object.freeze({
  paper: "#fffdf5",
  paperShadow: "#335965",
  innerEdge: "#292743",
  coral: "#f29aab",
  cyan: "#86d5df",
});

async function renderHomePreview({ compact }) {
  const size = compact ? { width: 1200, height: 800 } : { width: 1600, height: 1000 };
  const photoSpec = compact
    ? { width: 286, height: 430, file: "official/denia-portrait.png", fit: "contain", side: 11, bottom: 42 }
    : { width: 610, height: 343, file: "official/old-days-bright-102s.jpg", fit: "cover", side: 13, bottom: 57 };
  const frameWidth = photoSpec.width + photoSpec.side * 2;
  const frameHeight = photoSpec.height + photoSpec.side + photoSpec.bottom;
  const photo = await sharp(source(photoSpec.file))
    .resize(photoSpec.width, photoSpec.height, {
      fit: photoSpec.fit,
      position: "centre",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const paper = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${frameWidth}" height="${frameHeight}">
      <defs>
        <pattern id="grain" width="13" height="13" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="4" r=".7" fill="${P2_POLAROID.coral}" opacity=".06"/>
          <circle cx="10" cy="9" r=".65" fill="${P2_POLAROID.innerEdge}" opacity=".045"/>
        </pattern>
      </defs>
      <rect x=".5" y=".5" width="${frameWidth - 1}" height="${frameHeight - 1}" rx="5"
        fill="${P2_POLAROID.paper}" stroke="#d8d2c4"/>
      <rect x="1" y="1" width="${frameWidth - 2}" height="${frameHeight - 2}" rx="4" fill="url(#grain)"/>
      <rect x="${photoSpec.side - 1}" y="${photoSpec.side - 1}"
        width="${photoSpec.width + 2}" height="${photoSpec.height + 2}"
        fill="none" stroke="${P2_POLAROID.innerEdge}" stroke-opacity=".14"/>
    </svg>`);
  const polaroid = await sharp(paper)
    .composite([{ input: photo, left: photoSpec.side, top: photoSpec.side }])
    .rotate(-1.3, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const background = await sharp(source("background.svg"))
    .resize(size.width, size.height, { fit: "cover" })
    .png()
    .toBuffer();
  const position = compact ? { left: 820, top: 138 } : { left: 820, top: 210 };
  return sharp(background)
    .composite([
      { input: homeLayoutOverlay({ ...size, compact }), left: 0, top: 0 },
      { input: polaroid, ...position },
      { input: bubbleTransitionOverlay({ ...size, compact }), left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
```

`homeLayoutOverlay()` 复用当前首页文字、四张动作卡和输入区构图，按 `compact` 缩放但不改文案。`bubbleTransitionOverlay()` 只画三枚带白色高光、水青主体和珊瑚暗面的圆形，并使用固定坐标避开人物面部和左侧操作区。

- [ ] **Step 5: 生成首页宽屏与紧凑预览**

Run:

```bash
KABOO_SHARP_ENTRY=/Users/bytedance/ByteDance/workspace/kaboo/.worktrees/denia-old-days/frontend/node_modules/sharp/lib/index.js node scripts/render-assets.mjs
```

Expected: 输出包含 `rendered`，`evidence/home.png` 为 1600×1000，`evidence/home-compact.png` 为 1200×800。

- [ ] **Step 6: 运行源检查并确认转绿**

Run:

```bash
node scripts/check-source.mjs
```

Expected: PASS，输出 `source structure ok`。

- [ ] **Step 7: 目检两张首页图**

Run:

```bash
open evidence/home.png
open evidence/home-compact.png
```

Expected: 宽屏为官方正脸 P2 拍立得；紧凑图为透明立绘窄版拍立得；两张图都没有星形、皇冠状或花形贴纸。

- [ ] **Step 8: 提交**

```bash
git add art/source/background.svg scripts/render-assets.mjs scripts/check-source.mjs
git commit -m "feat: render Denia bubble polaroid previews"
```

---

### Task 2: 把运行时首页改为 P2 泡泡拍立得

**Files:**
- Modify: `sidecar/tests/validate.mjs`
- Modify: `sidecar/src/denia-old-days-extension.js`
- Modify: `sidecar/src/denia-old-days-extension.css`
- Modify: `sidecar/extension.json`
- Modify: `theme/theme.json`
- Test: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: `--denia-old-days-art-bright`、`--denia-old-days-art-portrait` 与现有 `ensureHomeHero()`。
- Produces: `.denia-old-days-ds-memory-bubbles`、`.denia-old-days-ds-state-bubble` 与 P2 `.denia-old-days-ds-photo`。

- [ ] **Step 1: 写入会失败的运行时结构和 CSS 断言**

在 `sidecar/tests/validate.mjs` 中替换旧的泡泡禁用断言，要求泡泡只存在于首页 hero：

```js
assert(runtime.includes("denia-old-days-ds-memory-bubbles"), "home hero must own its memory bubbles");
assert(runtime.includes("denia-old-days-ds-state-bubble"), "chrome must use a bubble state mark");
assert(!runtime.includes("denia-old-days-ds-star"), "runtime must retire the star state mark");
assert(!runtime.includes("denia-old-days-ds-tape"), "P2 polaroid must not use generic tape");
```

为 CSS 增加：

```js
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo", {
  padding: "13px 13px 57px",
  "border-radius": "5px",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo::after", {
  "pointer-events": "none",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-memory-bubbles", {
  "pointer-events": "none",
});
```

在运行时 harness 中确认 hero 创建 3 个泡泡子节点，cleanup 后全部移除。

- [ ] **Step 2: 运行 Sidecar 验证并确认正确失败**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL，错误为 `home hero must own its memory bubbles`。

- [ ] **Step 3: 修改运行时拥有节点**

把 `ensureChrome()` 中的星形替换为：

```js
chrome.innerHTML = '<span class="denia-old-days-ds-state-bubble" aria-hidden="true"></span>';
```

把 `ensureHomeHero()` 的相片节点改为：

```js
photo.innerHTML = '<span class="denia-old-days-ds-photo-front"></span>';
const bubbles = document.createElement("span");
bubbles.className = "denia-old-days-ds-memory-bubbles";
bubbles.setAttribute("aria-hidden", "true");
bubbles.innerHTML = "<i></i><i></i><i></i>";
hero.append(copy, photo, bubbles);
```

sidebar 品牌标识保留 `.denia-old-days-ds-brand-mark` 容器，但不再插入星形字符。`sidecar/extension.json` 与 `theme/theme.json` 的品牌标识改为空字符串，视觉由 CSS 泡泡高光生成。

- [ ] **Step 4: 实现 P2 相纸与泡泡 CSS**

将 `.denia-old-days-ds-photo` 改为暖白颗粒相纸：

```css
.denia-old-days-ds-photo {
  padding: 13px 13px 57px;
  border: 1px solid rgba(216, 210, 196, .94);
  border-radius: 5px;
  background:
    radial-gradient(circle at 22% 20%, rgba(103, 89, 170, .04) 0 1px, transparent 1.5px) 0 0 / 9px 9px,
    radial-gradient(circle at 70% 76%, rgba(242, 154, 171, .05) 0 1px, transparent 1.5px) 0 0 / 13px 13px,
    linear-gradient(145deg, #fffdf5, #f8f6ec);
  box-shadow: 0 3px 0 rgba(255,255,255,.95) inset, 0 21px 38px rgba(51,89,101,.2);
}

.denia-old-days-ds-photo::after {
  content: "";
  position: absolute;
  inset: 7px 7px 51px;
  border: 1px solid rgba(41, 39, 67, .14);
  pointer-events: none;
}
```

`.denia-old-days-ds-memory-bubbles` 只放置三枚静止泡泡。每枚泡泡使用白色内高光、水青透明主体和珊瑚暗面，不得添加无限动画。

- [ ] **Step 5: 更新紧凑和窄屏规则**

在 `@media (max-width: 1199px), (max-height: 759px)` 中使用 11px 上左右边、42px 下边，并保持 portrait 包内美术。`@media (max-width: 919px)` 中同时隐藏 `.denia-old-days-ds-photo` 和 `.denia-old-days-ds-memory-bubbles`。

- [ ] **Step 6: 运行 Sidecar 验证并确认转绿**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: PASS，输出 `Validated 达妮娅 · 旧日斑斓 extension 0.1.0`。

- [ ] **Step 7: 运行语法检查**

```bash
node --check sidecar/src/denia-old-days-extension.js
node --check sidecar/runtime/loader.mjs
```

Expected: 两条命令退出码均为 0。

- [ ] **Step 8: 提交**

```bash
git add sidecar/tests/validate.mjs sidecar/src/denia-old-days-extension.js sidecar/src/denia-old-days-extension.css sidecar/extension.json theme/theme.json
git commit -m "feat: apply Denia bubble polaroid runtime"
```

---

### Task 3: 收紧双形态状态色

**Files:**
- Modify: `sidecar/tests/validate.mjs`
- Modify: `sidecar/src/denia-old-days-extension.css`
- Modify: `art/source/task-preview.svg`
- Test: `sidecar/tests/validate.mjs`
- Test: `scripts/check-source.mjs`

**Interfaces:**
- Consumes: `data-denia-form-state` 的 `staged|working|approval|error|complete`。
- Produces: 亮态水青/珊瑚/暖金和暗态靛紫/紫粉/洋红的确定性状态映射。

- [ ] **Step 1: 写入会失败的状态色断言**

在 validator 中要求：

```js
assertCssDeclarations(stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-form-state="working"] .denia-old-days-ds-chrome::after',
  { opacity: ".12", transform: "none" });
assertCssDeclarations(stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-form-state="approval"] .denia-old-days-ds-chrome::after',
  { opacity: ".18", transform: "none" });
assertCssDeclarations(stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-form-state="error"] .denia-old-days-ds-chrome::after',
  { opacity: ".28", transform: "none" });
assertCssDeclarations(stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-form-state="complete"] .denia-old-days-ds-chrome::after',
  { opacity: "0" });
```

再断言 approval 的状态泡泡使用 `--denia-violet`，error 使用 `--denia-fracture`，complete 的 final card 使用暖金与珊瑚，不包含暗色背景。

- [ ] **Step 2: 运行 validator 并确认旧星形选择器导致失败**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL，错误指向 `.denia-old-days-ds-state-bubble` 状态色缺失。

- [ ] **Step 3: 实现状态色映射**

保持页面级浅色主题锁定，只修改画轨和状态泡泡：

```css
.denia-old-days-ds-extension[data-denia-form-state="working"] .denia-old-days-ds-state-bubble {
  border-color: var(--denia-crystal);
  background: rgba(41, 39, 67, .22);
}

.denia-old-days-ds-extension[data-denia-form-state="approval"] .denia-old-days-ds-state-bubble {
  border-color: var(--denia-violet);
  background: rgba(103, 89, 170, .3);
}

.denia-old-days-ds-extension[data-denia-form-state="error"] .denia-old-days-ds-state-bubble {
  border-color: var(--denia-fracture);
  background: rgba(228, 90, 168, .34);
}
```

将 final card 顶部显影从通用黄色改为暖金、水青和珊瑚的单次渐变。`art/source/task-preview.svg` 的 working 预览同步使用珊瑚状态点和深靛紫细边，但不加入完成态文案。

- [ ] **Step 4: 运行主题验证**

```bash
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
```

Expected: 两条命令均通过。

- [ ] **Step 5: 提交**

```bash
git add sidecar/tests/validate.mjs sidecar/src/denia-old-days-extension.css art/source/task-preview.svg
git commit -m "fix: separate Denia bright and dark states"
```

---

### Task 4: 生成四种任务状态展示图

**Files:**
- Modify: `scripts/check-source.mjs`
- Modify: `scripts/render-assets.mjs`
- Modify: `canon/sources.md`
- Test: `scripts/check-source.mjs`

**Interfaces:**
- Consumes: `renderTaskState({ state, railOpacity, accent, complete }): Promise<Buffer>`。
- Produces: `evidence/task.png`、`evidence/task-approval.png`、`evidence/task-error.png`、`evidence/task-complete.png`。

- [ ] **Step 1: 写入会失败的展示图契约**

在 `generatedFiles` 中增加：

```js
"evidence/task-approval.png",
"evidence/task-error.png",
"evidence/task-complete.png",
```

在 renderer 源检查中要求：

```js
for (const state of ["working", "approval", "error", "complete"]) {
  if (!rendererSource.includes(`state: "${state}"`)) {
    throw new Error(`renderer missing ${state} showcase`);
  }
}
```

- [ ] **Step 2: 运行源检查并确认缺图失败**

Run:

```bash
node scripts/check-source.mjs
```

Expected: FAIL，错误为缺少 `evidence/task-approval.png`。

- [ ] **Step 3: 实现参数化任务状态渲染**

在 `scripts/render-assets.mjs` 中定义：

```js
const taskStates = [
  { state: "working", railOpacity: 0.12, accent: "#86d5df", title: "当前页 · 处理中", status: "幻灭之形 · 观察中" },
  { state: "approval", railOpacity: 0.18, accent: "#6759aa", title: "等待确认", status: "幻灭之形 · 审阅中" },
  { state: "error", railOpacity: 0.28, accent: "#e45aa8", title: "需要修正", status: "幻灭之形 · 异常记录" },
  { state: "complete", railOpacity: 0, accent: "#f0d47a", title: "完成显影", status: "布景之形 · 已归档" },
];
```

`renderTaskState()` 必须：

1. 从 `task-preview.svg` 读取基础构图。
2. 替换观察记录、状态标题和状态文案。
3. 用 `railOpacity` 合成包内暗态横幅。
4. complete 将观察标签改为 `观察记录 · COMPLETE`，隐藏画轨并把下方内容卡改为暖色 final card。
5. 输出 1600×1000 PNG，不能从网络读取资源。

- [ ] **Step 4: 渲染并验证四张任务图**

```bash
KABOO_SHARP_ENTRY=/Users/bytedance/ByteDance/workspace/kaboo/.worktrees/denia-old-days/frontend/node_modules/sharp/lib/index.js node scripts/render-assets.mjs
node scripts/check-source.mjs
```

Expected: 四张任务 PNG 均为 1600×1000，source check 通过。

- [ ] **Step 5: 逐张目检**

```bash
open evidence/task.png
open evidence/task-approval.png
open evidence/task-error.png
open evidence/task-complete.png
```

Expected:

- working 画轨透明度最低。
- approval 使用紫粉提示。
- error 使用洋红警示但正文仍为浅色。
- complete 不显示暗色画轨，并突出暖色最新回复。

- [ ] **Step 6: 更新来源和产物哈希**

Run:

```bash
shasum -a 256 theme/background.jpg sidecar/assets/*.webp evidence/*.png
```

把实际 SHA-256、尺寸和渲染参数写入 `canon/sources.md`，不得手填未运行得到的哈希。

- [ ] **Step 7: 提交**

```bash
git add scripts/render-assets.mjs scripts/check-source.mjs canon/sources.md
git commit -m "feat: add Denia state showcase previews"
```

---

### Task 5: 从实际 Registry 映射生成能力展示图

**Files:**
- Create: `frontend/scripts/render-denia-registry-showcase.ts`
- Create: `frontend/scripts/render-denia-registry-showcase.test.ts`
- Test: `frontend/scripts/render-denia-registry-showcase.test.ts`

**Interfaces:**
- Consumes: `presentCodexThemeCapability(code, "zh-CN", "denia-old-days")` 和 manifest 的 `capabilities: string[]`。
- Produces: `renderDeniaRegistryShowcase(manifestPath: string, outputPath: string): Promise<void>`。

- [ ] **Step 1: 写失败测试**

测试创建含 15 个 capability code 的临时 manifest，执行真实函数并检查 SVG 文本和 PNG：

```ts
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { buildDeniaRegistryShowcaseSvg } from "./render-denia-registry-showcase";

const deniaCapabilities = [
  "base.wallpaper",
  "sidebar.brand-overlay",
  "sidebar.visual-states",
  "home.brand-status",
  "home.hero-copy",
  "home.suggestion-cards",
  "home.project-selector",
  "composer.skin",
  "task.diary-cards",
  "task.dual-form-states",
  "runtime.multi-art-preload",
  "task.state-art-rail",
  "runtime.target-events",
  "runtime.route-observer",
  "runtime.cleanup",
];

const expectedZhTitles = [
  "手账纸面工作台",
  "DENIA CODEX 侧栏品牌",
  "侧栏状态可视化",
  "布景之形状态标识",
  "《旧日斑斓》首页",
  "四张真实动作手账卡",
  "手账式项目入口",
  "信纸输入区",
  "观察记录与完成显影",
  "布景之形 / 幻灭之形",
  "三套本地美术预载",
  "任务状态画轨",
  "页面切换实时同步",
  "路由与 DOM 自动恢复",
  "停止、卸载与完整清理",
];

it("renders all Denia capability titles from the production mapping", async () => {
  const svg = buildDeniaRegistryShowcaseSvg(deniaCapabilities);
  for (const title of expectedZhTitles) expect(svg).toContain(title);
  expect(svg).not.toContain("Dual Form States");
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const metadata = await sharp(png).metadata();
  expect([metadata.width, metadata.height]).toEqual([1600, 1000]);
});
```

- [ ] **Step 2: 运行测试并确认模块缺失**

Run:

```bash
npm run test:unit -- --run scripts/render-denia-registry-showcase.test.ts
```

Expected: FAIL，错误为无法解析 `render-denia-registry-showcase`。

- [ ] **Step 3: 实现真实映射渲染**

脚本从 `../src/lib/codexThemePresentation` 导入生产映射函数。SVG 标题使用 `达妮娅 · 旧日斑斓`，按 5×3 网格显示 15 项中文能力标题，并标注 `本地 Registry 能力预览`。不得在脚本中复制能力标题。

公开：

```ts
export function buildDeniaRegistryShowcaseSvg(capabilities: string[]): string;
export async function renderDeniaRegistryShowcase(
  manifestPath: string,
  outputPath: string,
): Promise<void>;
```

命令行参数固定为：

```bash
vite-node scripts/render-denia-registry-showcase.ts --manifest /abs/manifest.json --output /abs/registry-capabilities.png
```

- [ ] **Step 4: 运行单测和现有 Registry 页面测试**

```bash
npm run test:unit -- --run scripts/render-denia-registry-showcase.test.ts src/pages/RegistryPackageDetailPage.test.tsx
```

Expected: 新测试通过，页面测试 7/7 通过。

- [ ] **Step 5: 运行格式、Lint 和类型检查**

```bash
npx prettier --write scripts/render-denia-registry-showcase.ts scripts/render-denia-registry-showcase.test.ts
npx eslint scripts/render-denia-registry-showcase.ts scripts/render-denia-registry-showcase.test.ts
npm run typecheck
```

Expected: 全部退出码为 0。

- [ ] **Step 6: 提交**

```bash
git add frontend/scripts/render-denia-registry-showcase.ts frontend/scripts/render-denia-registry-showcase.test.ts
git commit -m "feat(registry): render Denia capability showcase"
```

---

### Task 6: 钉定新主题提交并重建本地发布包

**Files:**
- Modify: `scripts/codex-theme/build-specs/denia-old-days/0.1.0.json`
- Test: `scripts/codex-theme/build-packages.test.mjs`

**Interfaces:**
- Consumes: 干净的主题工作树 HEAD 和实际忽略产物 SHA-256。
- Produces: 确定性 `denia-old-days@0.1.0` 本地发布目录。

- [ ] **Step 1: 记录主题提交和实际哈希**

在主题工作树运行：

```bash
git status --short
git rev-parse HEAD
shasum -a 256 theme/background.jpg sidecar/assets/denia-old-days-bright.webp sidecar/assets/denia-old-days-dark.webp sidecar/assets/denia-old-days-portrait.webp evidence/home.png evidence/task.png
```

Expected: `git status --short` 无输出；后续命令给出实际提交和六个哈希。

- [ ] **Step 2: 更新 build spec**

把 `source.revision` 与 notice 中的 reviewed revision 改为实际主题 HEAD。把六个 `expectedSha256` 值改为 Step 1 的实际输出，不得估算。

- [ ] **Step 3: 运行打包器测试**

```bash
node --test scripts/codex-theme/build-packages.test.mjs
```

Expected: 20/20 通过。

- [ ] **Step 4: 在两个全新临时目录构建**

```bash
denia_build_a="$(mktemp -d /private/tmp/denia-p2-a.XXXXXX)"
denia_build_b="$(mktemp -d /private/tmp/denia-p2-b.XXXXXX)"
node scripts/codex-theme/build-packages.mjs \
  --source-root /Users/bytedance/ByteDance/workspace/denia-old-days-codex-theme/.worktrees/official-art-revision \
  --output "$denia_build_a" \
  --release denia-old-days@0.1.0
node scripts/codex-theme/build-packages.mjs \
  --source-root /Users/bytedance/ByteDance/workspace/denia-old-days-codex-theme/.worktrees/official-art-revision \
  --output "$denia_build_b" \
  --release denia-old-days@0.1.0
diff -rq \
  "$denia_build_a/denia-old-days/0.1.0" \
  "$denia_build_b/denia-old-days/0.1.0"
```

Expected: 两次输出的 `artifactSha256`、`artifactBytes`、`archiveFiles` 和 `expandedBytes` 完全一致。

- [ ] **Step 5: 刷新稳定发布目录**

```bash
node scripts/codex-theme/build-packages.mjs \
  --source-root /Users/bytedance/ByteDance/workspace/denia-old-days-codex-theme/.worktrees/official-art-revision \
  --output /Users/bytedance/Documents/Codex/2026-07-22/sou/outputs/denia-old-days-local-release \
  --release denia-old-days@0.1.0
```

Expected: 生成 `bundle.zip`、`catalog-version.json`、`manifest.json`、`preview-home.webp`、`preview-task.webp`。

- [ ] **Step 6: 提交 build spec**

```bash
git add scripts/codex-theme/build-specs/denia-old-days/0.1.0.json
git commit -m "build: repin Denia bubble polaroid release"
```

---

### Task 7: 汇总 7 张截图并完成最终验证

**Files:**
- Create: `/Users/bytedance/Documents/Codex/2026-07-22/sou/outputs/denia-old-days-showcase/README.md`
- Copy: 主题 `evidence` 中的 6 张设计预览
- Generate: `registry-capabilities.png`

**Interfaces:**
- Consumes: Task 4 的 6 张主题图、Task 5 的展示脚本、Task 6 的最终 manifest。
- Produces: 用户可直接查看的 7 张能力截图与边界说明。

- [ ] **Step 1: 创建精确交付目录**

先确认目标不存在或只包含本任务先前生成的文件，然后创建：

```text
/Users/bytedance/Documents/Codex/2026-07-22/sou/outputs/denia-old-days-showcase/
  01-home-wide.png
  02-home-compact.png
  03-task-working.png
  04-task-approval.png
  05-task-error.png
  06-task-complete.png
  07-registry-capabilities.png
  README.md
```

- [ ] **Step 2: 复制六张主题预览**

从主题工作树复制：

```text
evidence/home.png -> 01-home-wide.png
evidence/home-compact.png -> 02-home-compact.png
evidence/task.png -> 03-task-working.png
evidence/task-approval.png -> 04-task-approval.png
evidence/task-error.png -> 05-task-error.png
evidence/task-complete.png -> 06-task-complete.png
```

- [ ] **Step 3: 生成 Registry 能力图**

在 Kaboo `frontend` 目录运行：

```bash
node_modules/.bin/vite-node scripts/render-denia-registry-showcase.ts \
  --manifest /Users/bytedance/Documents/Codex/2026-07-22/sou/outputs/denia-old-days-local-release/denia-old-days/0.1.0/manifest.json \
  --output /Users/bytedance/Documents/Codex/2026-07-22/sou/outputs/denia-old-days-showcase/07-registry-capabilities.png
```

Expected: 1600×1000 PNG，含 15 个实际中文能力标题。

- [ ] **Step 4: 写交付说明**

`README.md` 必须明确：

```markdown
# 达妮娅 · 旧日斑斓主题能力预览

这 7 张图片是由包内美术、主题渲染器和 Kaboo 的实际能力映射生成的可复现设计预览。
它们用于审阅视觉与能力覆盖，不冒充 Codex Desktop 实际运行截图。

当前实机采集边界：
`~/.codex/codex-dream-skin-studio/scripts/switch-theme-macos.sh` 不存在，
因此本轮没有安装主题，也没有伪造实机验证结果。
```

- [ ] **Step 5: 执行主题最终验证**

在主题工作树运行：

```bash
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
node --check sidecar/runtime/loader.mjs
node --check sidecar/src/denia-old-days-extension.js
bash -n sidecar/package.sh sidecar/scripts/common.sh sidecar/scripts/install.sh sidecar/scripts/start.sh sidecar/scripts/status.sh sidecar/scripts/stop.sh sidecar/scripts/uninstall.sh sidecar/scripts/verify.sh
git diff --check
git status --short
```

Expected: 所有检查通过，Git 状态无输出。

- [ ] **Step 6: 执行 Kaboo 最终验证**

在 Kaboo 工作树运行：

```bash
node --test scripts/codex-theme/build-packages.test.mjs
```

在 `frontend` 运行：

```bash
npx prettier --check src/lib/codexThemePresentation.ts src/pages/RegistryPackageDetailPage.test.tsx scripts/render-denia-registry-showcase.ts scripts/render-denia-registry-showcase.test.ts
npx eslint src/lib/codexThemePresentation.ts src/pages/RegistryPackageDetailPage.test.tsx scripts/render-denia-registry-showcase.ts scripts/render-denia-registry-showcase.test.ts
npm run typecheck
npm run test:unit -- --run src/pages/RegistryPackageDetailPage.test.tsx scripts/render-denia-registry-showcase.test.ts
```

Expected: build tests 20/20，Registry 页面 7/7，新展示图测试通过，格式、Lint、类型均通过。

- [ ] **Step 7: 校验发布包和截图**

在稳定发布目录运行：

```bash
unzip -t bundle.zip
shasum -a 256 bundle.zip
jq -r .artifactSha256 catalog-version.json
```

Expected: ZIP 无错误，实际 SHA-256 与 catalog 完全一致。

检查截图：

```bash
shasum -a 256 /Users/bytedance/Documents/Codex/2026-07-22/sou/outputs/denia-old-days-showcase/*.png
```

Expected: 7 个非空 SHA-256。

- [ ] **Step 8: 向用户展示**

最终回复直接嵌入或链接 7 张绝对路径图片，说明：

- P2 拍立得和泡泡装饰已经进入宽屏与紧凑设计预览。
- working、approval、error、complete 的双形态色彩按状态递进。
- Registry 能力图来自生产映射的 15 项中文标题。
- 本轮没有安装、上传或发布。
- Dream Skin Studio 控制脚本仍是实际运行截图的前置条件。

---

## Self-Review Checklist

- [x] 设计规格第 2 节的 5 个目标都有对应任务。
- [x] 第 3 节的 6 个非目标都进入 Global Constraints。
- [x] 第 4 节的泡泡和 P2 规则由 Task 1、Task 2 覆盖。
- [x] 第 5、6 节的双形态和工作界面由 Task 3、Task 4 覆盖。
- [x] 第 7、8 节的响应式和可访问性由 Task 2、Task 7 验证。
- [x] 第 9 节资源边界由 Task 1、Task 6 验证。
- [x] 第 10 节 7 张截图由 Task 4、Task 5、Task 7 覆盖。
- [x] 第 11、12 节全部测试与验收标准在 Task 6、Task 7 中有命令或目检步骤。
- [x] 无未定内容、空实现或未定义接口。
