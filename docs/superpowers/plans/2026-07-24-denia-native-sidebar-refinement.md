# Denia Native Sidebar Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Codex's native right sidebar visually cohesive with the Denia diary theme while guaranteeing that character artwork never reduces native tool readability.

**Architecture:** Add a geometry-backed native sidebar detector that returns `open`, `closed`, or `unknown`, then attach removable paint-only classes to the confirmed native panel and its wide functional rows. Keep state artwork in the theme-owned chrome, but hide it whenever the native right sidebar is open or detection is uncertain. Extend static, VM, cleanup, and live verification so native geometry and interaction remain unchanged.

**Tech Stack:** Plain JavaScript runtime injection, plain CSS, Node.js VM harness, CDP live verification, Kaboo local package scripts.

## Global Constraints

- Do not modify native `main`, split panes, sidebar, composer, approval card, or input geometry.
- Do not actively open or close the native sidebar and do not call its toggle `.click()`.
- Do not clone, wrap, reparent, prepend, or append into the native right sidebar.
- Native panel and row classes may change paint properties only: `background`, `background-color`, `background-image`, `border-color`, `border-radius`, `box-shadow`, `color`, and `outline-color`.
- Do not apply sidebar CSS directly to generic `aside`, `nav`, `button`, or broad `div` selectors.
- A detected `unknown` state must touch no native sidebar node and must hide task character artwork.
- Home with an open right sidebar must use a warm-paper surface and no character artwork.
- Task with an open right sidebar must use an opaque functional surface and no full character artwork.
- Task with a closed right sidebar keeps the existing staged, working, approval, error, and complete artwork mappings unchanged.
- Widths below `920px` always hide task character artwork.
- Preserve all files under `art/`, `canon/`, `evidence/`, and all generated image resources.
- Do not upload, push, create a PR, publish to Registry, or restart Codex.

---

### Task 1: Detect and classify the native right sidebar

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.js`
- Modify: `sidecar/tests/validate.mjs`

**Interfaces:**
- Produces: `detectNativeRightSidebar(): { state, confidence, anchorKind, panel, panelRect, toggle }`
- Produces: `syncNativeRightSidebar(home: boolean): void`
- Produces root markers: `data-denia-sidebar-state`, `data-denia-sidebar-confidence`
- Produces public diagnostic: `state.sidebar` with scalar values only
- Produces removable classes: `denia-old-days-ds-native-right-sidebar`, `denia-old-days-ds-native-sidebar-group`, `denia-old-days-ds-native-sidebar-row`
- Current live anchor observed on Codex 2026-07-24: a visible toggle labelled `显示/隐藏侧边栏` and a right-docked `ASIDE` at `{ x: 1178, y: 46, width: 334, height: 813 }`. Treat these as evidence, not fixed selectors or dimensions.

- [ ] **Step 1: Extend the VM harness with configurable geometry and hit testing**

In `createRuntimeHarness()`, make each fake element retain a configurable rectangle:

```js
class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.rect = { x: 0, y: 0, width: 120, height: 36 };
  }

  setRect(rect) {
    this.rect = { ...this.rect, ...rect };
    return this;
  }

  getBoundingClientRect() {
    const { x, y, width, height } = this.rect;
    return {
      x,
      y,
      width,
      height,
      right: x + width,
      bottom: y + height,
      top: y,
      left: x,
    };
  }
}
```

Expose a controlled hit target and viewport:

```js
let pointTarget = null;
document.elementFromPoint = () => pointTarget;
sandbox.innerWidth = 1512;
sandbox.innerHeight = 859;
sandbox.visualViewport = { width: 1512, height: 859, addEventListener() {}, removeEventListener() {} };
```

Return harness helpers that set `pointTarget` and the viewport without changing production code.

- [ ] **Step 2: Write failing sidebar lifecycle cases**

Add `assertNativeRightSidebarLifecycle(payload)` and invoke it before existing art lifecycle tests. Build a task `main`, a visible sidebar toggle, and a right-docked `aside`.

The first RED assertions must cover:

```js
assert(state.sidebar.state === "open", "a visible right-docked native aside must be detected as open");
assert(state.sidebar.confidence === "high", "geometry plus right-edge hit testing must be high confidence");
assert(aside.classList.contains("denia-old-days-ds-native-right-sidebar"), "only the confirmed aside must receive the skin class");
assert(root.dataset.deniaSidebarState === "open", "the root must expose the open sidebar state");
```

Add independent cases for:

```js
assert(closedState === "closed", "a visible sidebar toggle with no right-docked panel must resolve closed");
assert(conflictingState === "unknown", "aria-expanded=true with an invisible panel must resolve unknown");
assert(!leftAside.classList.contains("denia-old-days-ds-native-right-sidebar"), "left navigation must never be skinned as the right sidebar");
assert(!dialog.classList.contains("denia-old-days-ds-native-right-sidebar"), "dialogs and menus must never be classified as the right sidebar");
```

Record native `main`, panel, toggle, composer, and approval rectangles and relevant attributes before `state.refresh()`, then assert they are unchanged afterward.

- [ ] **Step 3: Run the focused validator and confirm RED**

Run:

```bash
DENIA_SKIP_LOADER_NEGATIVE_TESTS=1 \
DENIA_SKIP_RUNTIME_VM_TESTS=1 \
DENIA_SKIP_INSTALL_SCRIPT_TESTS=1 \
node sidecar/tests/validate.mjs sidecar
```

Expected: failure from the first new native-sidebar assertion because `state.sidebar` and the skin classes do not exist.

- [ ] **Step 4: Implement tri-state detection**

Add closure-owned references instead of storing native nodes on the public state:

```js
let nativeSidebarPanel = null;
const nativeSidebarGroups = new Set();
const nativeSidebarRows = new Set();
```

Add the three new class names to `removableClasses`.

Implement these helpers:

```js
function normalizedNodeLabel(node) {
  return (node?.getAttribute?.("aria-label")
    || node?.getAttribute?.("title")
    || node?.textContent
    || "")
    .replace(/\s+/gu, " ")
    .trim();
}

function measuredRect(node) {
  if (!(node instanceof HTMLElement)) return null;
  const rect = node.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom,
  };
}

function isExcludedSidebarCandidate(node) {
  return !node
    || node === document.body
    || node === root
    || ownedNodes.has(node)
    || node.closest?.("#denia-old-days-ds-chrome")
    || node.matches?.('main, [role="main"], dialog, [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"]');
}
```

Implement `rightDockedPanel(node, mainRect)` with the exact spec thresholds:

```js
function rightDockedPanel(node, mainRect) {
  if (isExcludedSidebarCandidate(node) || !visible(node)) return false;
  const rect = measuredRect(node);
  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const rightEdgePass = Math.abs(rect.right - viewportWidth) <= 12;
  const heightPass = rect.height >= Math.max(240, viewportHeight * 0.35);
  const sidePass = !mainRect || rect.left >= mainRect.right - 12;
  return rightEdgePass && heightPass && sidePass;
}
```

Find the visible toggle by accessible label:

```js
const toggle = [...document.querySelectorAll("button")].find((button) =>
  visible(button) && /(?:显示\/隐藏侧边栏|show\/hide sidebar|toggle sidebar)/iu.test(normalizedNodeLabel(button))
) || null;
```

Resolve `[aria-controls]` first. Otherwise sample three right-edge points and walk each hit ancestor until the first `aside` or `[role="complementary"]` that passes `rightDockedPanel()`. Accept a non-semantic ancestor only when it passes geometry, is hit at two points, and contains at least two visible interactive controls.

Return:

```js
{
  state: "open" | "closed" | "unknown",
  confidence: "high" | "none",
  anchorKind: "aria-controls" | "right-edge-hit" | "none",
  panel,
  panelRect,
  toggle,
}
```

Use these rules:

```js
// visible controlled/right-edge panel => open/high
// toggle aria-expanded=false and controlled panel invisible => closed/high
// visible toggle, no right-docked candidate, aria-expanded is not true => closed/high
// aria-expanded=true but panel invisible, conflicting candidates, or no toggle/evidence => unknown/none
```

- [ ] **Step 5: Implement class application and cleanup**

`syncNativeRightSidebar(home)` must first remove old panel/group/row classes, then detect again. For `open/high`, touch only the chosen panel and classify wide visible rows:

```js
const rowCandidates = [...panel.querySelectorAll('button, a, [role="button"]')].filter((node) => {
  if (!visible(node) || ownedNodes.has(node)) return false;
  const rect = measuredRect(node);
  return rect.width >= Math.min(160, panelRect.width * 0.55)
    && rect.height >= 20
    && rect.height <= 64
    && rect.y >= panelRect.y + 44;
});
```

Touch a group only when it is the smallest common visible ancestor of at least two row candidates, is contained by the chosen panel, and is not a tabpanel, webview, dialog, menu, or theme-owned node.

Update root data and public scalar diagnostics:

```js
state.sidebar = {
  state: result.state,
  confidence: result.confidence,
  anchorKind: result.anchorKind,
  panelVisible: result.state === "open",
  skinApplied: result.state === "open" && Boolean(result.panel),
  groupCount: nativeSidebarGroups.size,
  rowCount: nativeSidebarRows.size,
};
root.dataset.deniaSidebarState = result.state;
root.dataset.deniaSidebarConfidence = result.confidence;
```

Call `syncNativeRightSidebar(home)` inside `refresh()` after the home/task route class is set and before `syncStateArt()`.

Extend MutationObserver attributes and add resize listeners:

```js
attributeFilter: [
  "aria-busy",
  "aria-controls",
  "aria-expanded",
  "aria-hidden",
  "hidden",
  "data-state",
  "data-status",
  "style",
  "class",
]
```

Use the existing `on()` lifecycle for `window.resize` and `visualViewport.resize`.

Cleanup must remove the three classes, both sidebar datasets, and reset closure-owned sets/references.

- [ ] **Step 6: Run focused GREEN and full Sidecar validation**

Run:

```bash
DENIA_SKIP_LOADER_NEGATIVE_TESTS=1 \
DENIA_SKIP_RUNTIME_VM_TESTS=1 \
DENIA_SKIP_INSTALL_SCRIPT_TESTS=1 \
node sidecar/tests/validate.mjs sidecar
```

Expected: exit 0.

Then run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: `Validated 达妮娅 · 旧日斑斓 extension 0.1.0`.

- [ ] **Step 7: Commit**

```bash
git add sidecar/src/denia-old-days-extension.js sidecar/tests/validate.mjs
git commit -m "feat: detect native right sidebar"
```

---

### Task 2: Apply readable warm-paper sidebar surfaces and verify them

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.css`
- Modify: `sidecar/runtime/loader.mjs`
- Modify: `sidecar/tests/validate.mjs`
- Modify: `docs/current-theme-design.md`

**Interfaces:**
- Consumes root markers and native classes produced by Task 1.
- Preserves the existing `stateArtSpecs` family and opacity mapping.
- Produces live verification object `sidebar`.
- Produces no new native DOM and no new image asset.

- [ ] **Step 1: Write failing paint-only and art-safety assertions**

Replace the old assertion that task `main` must have `z-index: 3` with:

```js
for (const selector of ['.denia-old-days-ds-task [role="main"]', ".denia-old-days-ds-task main"]) {
  const rule = stylesheetRules.find((candidate) => candidate.selectors.includes(selector));
  assert(!rule?.declarations.has("z-index"), `task main must not create a theme stacking context: ${selector}`);
}
```

Add a paint-only whitelist:

```js
const sidebarPaintProperties = new Set([
  "background",
  "background-color",
  "background-image",
  "border-color",
  "border-radius",
  "box-shadow",
  "color",
  "outline-color",
  "transition",
  "transition-duration",
]);
```

For every selector containing one of the three native sidebar classes, fail if a declaration is outside that set.

Add required CSS behavior:

```js
assertCssDeclarations(stylesheetRules, '.denia-old-days-ds-extension:not([data-denia-sidebar-state="closed"]) .denia-old-days-ds-state-art', {
  opacity: "0",
  visibility: "hidden",
});
```

Assert panel alpha `.97` or greater, group alpha `.98` or greater, no artwork variable occurs inside native sidebar class rules, and reduced transparency uses an opaque surface.

- [ ] **Step 2: Run focused validator and confirm RED**

Run:

```bash
DENIA_SKIP_LOADER_NEGATIVE_TESTS=1 \
DENIA_SKIP_RUNTIME_VM_TESTS=1 \
DENIA_SKIP_INSTALL_SCRIPT_TESTS=1 \
node sidecar/tests/validate.mjs sidecar
```

Expected: failure because the native sidebar paint rules and art-safety selector do not exist.

- [ ] **Step 3: Implement the warm-paper visual system**

Remove:

```css
.denia-old-days-ds-task [role="main"],
.denia-old-days-ds-task main {
  position: relative;
  z-index: 3;
}
```

Keep native layout untouched and add paint-only rules:

```css
.denia-old-days-ds-native-right-sidebar {
  color: var(--denia-ink);
  background:
    radial-gradient(circle at 88% 8%, rgba(242, 154, 171, .12), transparent 24%),
    radial-gradient(circle at 12% 22%, rgba(143, 210, 221, .12), transparent 28%),
    repeating-linear-gradient(0deg, transparent 0 31px, rgba(111, 184, 231, .045) 31px 32px),
    rgba(255, 251, 247, .98) !important;
  border-color: rgba(111, 184, 231, .22) !important;
  box-shadow:
    inset 1px 0 rgba(111, 184, 231, .32),
    inset 12px 0 28px rgba(111, 184, 231, .045),
    -12px 0 34px rgba(38, 53, 72, .055);
  transition: background-color 220ms cubic-bezier(.22, 1, .36, 1), box-shadow 220ms cubic-bezier(.22, 1, .36, 1);
}

.denia-old-days-ds-native-sidebar-group {
  color: var(--denia-ink);
  background: rgba(255, 253, 250, .985) !important;
  border-color: rgba(111, 184, 231, .18) !important;
  border-radius: 16px;
  box-shadow:
    inset 0 1px rgba(255, 255, 255, .8),
    0 10px 28px rgba(38, 53, 72, .065);
}

.denia-old-days-ds-native-sidebar-row {
  color: var(--denia-ink) !important;
  background: rgba(255, 253, 250, .94);
  border-color: transparent;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px rgba(111, 184, 231, .08);
}
```

Add route/state accents without selectors targeting generic native tags:

```css
.denia-old-days-ds-home .denia-old-days-ds-native-right-sidebar {
  background-image:
    radial-gradient(circle at 86% 8%, rgba(242, 154, 171, .16), transparent 25%),
    radial-gradient(circle at 16% 14%, rgba(143, 210, 221, .16), transparent 26%),
    repeating-linear-gradient(0deg, transparent 0 31px, rgba(111, 184, 231, .05) 31px 32px);
}

.denia-old-days-ds-extension[data-denia-form-state="working"] .denia-old-days-ds-native-right-sidebar {
  border-color: rgba(111, 184, 231, .34) !important;
  box-shadow: inset 2px 0 rgba(111, 184, 231, .42), -12px 0 34px rgba(38, 53, 72, .055);
}

.denia-old-days-ds-extension[data-denia-form-state="approval"] .denia-old-days-ds-native-right-sidebar {
  border-color: rgba(117, 86, 217, .3) !important;
  box-shadow: inset 2px 0 rgba(117, 86, 217, .34), -12px 0 34px rgba(38, 53, 72, .065);
}

.denia-old-days-ds-extension[data-denia-form-state="error"] .denia-old-days-ds-native-right-sidebar {
  border-color: rgba(228, 90, 168, .32) !important;
  box-shadow: inset 2px 0 rgba(228, 90, 168, .36), -12px 0 34px rgba(38, 53, 72, .07);
}

.denia-old-days-ds-extension[data-denia-form-state="complete"] .denia-old-days-ds-native-right-sidebar {
  border-color: rgba(247, 216, 138, .4) !important;
  box-shadow: inset 2px 0 rgba(247, 216, 138, .52), -12px 0 34px rgba(38, 53, 72, .055);
}
```

Add art safety:

```css
.denia-old-days-ds-extension:not([data-denia-sidebar-state="closed"]) .denia-old-days-ds-state-art {
  opacity: 0;
  visibility: hidden;
}
```

The existing `<920px` hide rule remains authoritative.

Under reduced transparency, use:

```css
.denia-old-days-ds-native-right-sidebar,
.denia-old-days-ds-native-sidebar-group,
.denia-old-days-ds-native-sidebar-row {
  background: #fffdf9 !important;
}
```

- [ ] **Step 4: Extend fallback cleanup and live verification**

In `cleanupExpression`, remove the three new classes and delete:

```js
delete root.dataset.deniaSidebarState;
delete root.dataset.deniaSidebarConfidence;
```

In `verifyExpression`, compute:

```js
const nativeSidebar = document.querySelector(".denia-old-days-ds-native-right-sidebar");
const nativeSidebarGroups = [...document.querySelectorAll(".denia-old-days-ds-native-sidebar-group")];
const nativeSidebarRows = [...document.querySelectorAll(".denia-old-days-ds-native-sidebar-row")];
const sidebarState = root.dataset.deniaSidebarState || "unknown";
const sidebarOpen = sidebarState === "open";
const sidebarArtVisible = box(stateArtRail)?.visible === true;
const sidebar = {
  state: sidebarState,
  confidence: root.dataset.deniaSidebarConfidence || "none",
  panelVisible: box(nativeSidebar)?.visible === true,
  skinApplied: Boolean(nativeSidebar),
  groupCount: nativeSidebarGroups.length,
  rowCount: nativeSidebarRows.length,
  artVisible: sidebarArtVisible,
  homeNoCharacterPass: !home || !sidebarOpen || !sidebarArtVisible,
  taskReadabilityPass: home || !sidebarOpen || Boolean(nativeSidebar),
};
```

Add this object to the result and include route-specific sidebar predicates in `pass`.

Extend `assertLiveTaskVerification()` with open, closed, and unknown cases. Open and unknown must reject visible state artwork. Closed task must still require the expected art family.

- [ ] **Step 5: Update the consolidated design boundary**

Add a “原生右侧栏” section to `docs/current-theme-design.md` with these exact rules:

```markdown
## 原生右侧栏

- 首页和任务页共用几何识别，但使用不同视觉强度。
- 高置信打开时，侧栏使用暖纸、青灰分界和高不透明功能表面。
- 首页侧栏不显示人物；任务侧栏用状态色表达情绪，不让人物穿过原生内容。
- 右侧栏关闭时，任务状态人物栏恢复。
- 检测不确定或宽度小于 920px 时隐藏人物并不触碰原生侧栏。
- 不修改侧栏宽度、滚动、分栏、按钮、快捷键、审批卡或输入框几何。
```

- [ ] **Step 6: Run GREEN, full validation, and source check**

Run:

```bash
DENIA_SKIP_LOADER_NEGATIVE_TESTS=1 \
DENIA_SKIP_RUNTIME_VM_TESTS=1 \
DENIA_SKIP_INSTALL_SCRIPT_TESTS=1 \
node sidecar/tests/validate.mjs sidecar
```

Expected: exit 0.

Run:

```bash
node sidecar/tests/validate.mjs sidecar
node scripts/check-source.mjs
git diff --check
```

Expected: Sidecar validation message, `source structure ok`, and no diff errors.

- [ ] **Step 7: Commit**

```bash
git add \
  sidecar/src/denia-old-days-extension.css \
  sidecar/runtime/loader.mjs \
  sidecar/tests/validate.mjs \
  docs/current-theme-design.md
git commit -m "feat: refine native sidebar surfaces"
```

---

### Task 3: Controller integration — fast-forward, build, and perform one live update

**Files:**
- Generated only: `sidecar/assets/`
- Generated only: `theme/background.jpg`
- Generated only: `sidecar/release/kaboo-local/`

**Interfaces:**
- Consumes the reviewed runtime, CSS, loader, and validator from Tasks 1-2.
- Produces the existing local launcher path without changing its CLI contract.
- Runs only after both task reviews and the whole-branch final review are clean.
- Runs from `/Users/bytedance/workspace/denia-old-days-codex-theme` after locally fast-forwarding `main` to the reviewed feature branch.

- [ ] **Step 0: Fast-forward the original main checkout**

Confirm the feature branch has no uncommitted changes and the original main checkout has no user changes. Then fast-forward locally:

```bash
git -C /Users/bytedance/workspace/denia-old-days-codex-theme merge --ff-only codex/sidebar-refinement
```

Do not push, publish, create a PR, restart Codex, or remove the Codex-managed worktree.

- [ ] **Step 1: Regenerate and validate assets**

Run from `/Users/bytedance/workspace/denia-old-days-codex-theme`:

```bash
KABOO_SHARP_ENTRY=/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/lib/index.js \
node scripts/render-assets.mjs
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
```

Expected: `rendered 15 Denia assets`, `source structure ok`, and Sidecar validation success.

- [ ] **Step 2: Rebuild the Kaboo local package**

Run:

```bash
KABOO_SHARP_ENTRY=/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/lib/index.js \
node scripts/build-local-kaboo-release.mjs
```

Expected: release JSON for `denia-old-days@0.1.0`, a non-empty `bundle.zip`, and the launcher at `sidecar/release/kaboo-local/start-local-test.command`.

- [ ] **Step 3: Install the catalog exactly once**

Read status first:

```bash
KABOO_AUTO_UPDATE=0 /Users/bytedance/.local/share/kaboo/bin/kaboo-cli \
  codex-theme status denia-old-days
```

Install exactly once:

```bash
KABOO_AUTO_UPDATE=0 /Users/bytedance/.local/share/kaboo/bin/kaboo-cli \
  codex-theme install-local \
  /Users/bytedance/workspace/denia-old-days-codex-theme/sidecar/release/kaboo-local/denia-old-days/0.1.0/catalog-version.json
```

If the install result ends in `(active)`, do not run a separate activate command. Do not run the launcher while Codex is open and do not restart Codex.

- [ ] **Step 4: Verify the live result once**

Use the install result's structured verify payload. Require:

```text
pass=true
sidebar.state=open|closed|unknown
sidebar.homeNoCharacterPass=true
sidebar.taskReadabilityPass=true
overflowX=false
```

If the currently visible route has the right sidebar open, also require `sidebar.skinApplied=true` and `sidebar.artVisible=false`.
