# Persistent Task Artwork Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the task artwork mounted and state-aware while native summary, bottom-panel, and right-sidebar surfaces cover only their overlapping regions.

**Architecture:** Mount the existing fixed chrome inside the current isolated task `main` and paint it at `z-index: -1`, above the task background and below every native task surface. Keep panel markers independent from artwork state, and redefine `data-denia-work-surface-state` as horizontal right-side occupancy so a bottom panel does not move task content.

**Tech Stack:** JavaScript IIFE runtime, CSS stacking contexts, Node.js VM/static validation, local CDP verification, Bash packaging scripts.

## Global Constraints

- Do not add observers, animation-frame loops, panel geometry reads, `clip-path`, image loads, filters, blur, or animation.
- Keep the existing artwork assets, state priority, family mapping, opacity, transition, mask, rail width, and `pointer-events: none`.
- Keep home artwork behavior and the existing `max-width: 919px` task-artwork fallback.
- Keep the existing `prefers-reduced-motion` and `prefers-reduced-transparency` behavior and validation.
- Keep native summary, bottom-panel, sidebar, composer, and thread dimensions and interactions unchanged.
- A fixed task state must retain the same artwork generation and object URL through every panel toggle.
- Summary, bottom-panel, and sidebar open/close directions must each stay at or below 5 full refreshes per 900 milliseconds.
- The theme may not add more than one 50-millisecond long task over the native baseline.
- Do not restart Codex; install and reload only through the existing Sidecar scripts and active CDP endpoint.

---

## File Structure

- `sidecar/src/denia-old-days-extension.js`: owns chrome placement, task artwork lifecycle, and native panel state aggregation.
- `sidecar/src/denia-old-days-extension.css`: defines the task artwork stacking level and responsive visibility.
- `sidecar/tests/validate.mjs`: holds static CSS contracts, VM runtime lifecycle tests, loader verification fixtures, and cleanup checks.
- `sidecar/runtime/loader.mjs`: verifies the installed theme against the live Codex DOM.
- `docs/current-theme-design.md`: records the current task-background and native-panel behavior.
- `sidecar/README.md`: documents the delivered Sidecar behavior.

### Task 1: Separate bottom-panel state from horizontal work-surface state

**Files:**

- Modify: `sidecar/tests/validate.mjs:1697-1751`
- Modify: `sidecar/src/denia-old-days-extension.js:597-618`

**Interfaces:**

- Consumes: `syncNativeWorkSurfaces()`, `data-denia-summary-state`, `data-denia-bottom-panel-state`, `data-denia-work-surface-state`.
- Produces: `data-denia-work-surface-state="open"` only for an open summary or an obscuring right sidebar; bottom-panel state remains independently available.

- [ ] **Step 1: Change the work-surface lifecycle test to require bottom-panel persistence**

Capture the existing sidebar toggle as:

```js
  const sidebarToggle = appendToggle("显示/隐藏侧边栏", false);
```

Then replace the assertions in `assertNativeWorkSurfaceLifecycle()` with the following state sequence. Keep the existing mixed toggle/remount trailing-refresh assertions after this block.

```js
  vm.runInContext(payload, harness.context, { timeout: 1000 });
  const state = harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const chrome = harness.document.getElementById("denia-old-days-ds-chrome");
  const rail = harness.document.getElementById("denia-old-days-ds-state-art");
  const initialArtGeneration = state.artGeneration;
  const initialCreatedNodes = state.metrics.createdNodes;

  assert(harness.root.dataset.deniaSummaryState === "open", "pressed summary toggle must expose an open summary state");
  assert(harness.root.dataset.deniaBottomPanelState === "closed", "unpressed bottom toggle must expose a closed bottom panel state");
  assert(harness.root.dataset.deniaWorkSurfaceState === "open", "open summary must expose horizontal work-surface occupancy");

  harness.clearMutationRecords();
  summaryToggle.setAttribute("aria-pressed", "false");
  assert(harness.flushMutations() === 1, "summary aria-pressed mutation must reach the observer");
  assert(harness.root.dataset.deniaSummaryState === "closed", "summary toggle state must synchronize before the next animation frame");
  assert(harness.root.dataset.deniaWorkSurfaceState === "closed", "closing the final right-side surface must restore task alignment");
  assert(harness.flushAnimationFrames() === 0, "summary toggle state must not schedule a full refresh");

  harness.clearMutationRecords();
  bottomToggle.setAttribute("aria-pressed", "true");
  assert(harness.flushMutations() === 1, "bottom panel aria-pressed mutation must reach the observer");
  assert(harness.root.dataset.deniaBottomPanelState === "open", "pressed bottom toggle must expose an open bottom panel state");
  assert(harness.root.dataset.deniaWorkSurfaceState === "closed", "bottom panel must not claim horizontal task space");
  assert(harness.flushAnimationFrames() === 0, "bottom panel toggle state must not schedule a full refresh");

  harness.clearMutationRecords();
  summaryToggle.setAttribute("aria-pressed", "true");
  assert(harness.flushMutations() === 1, "summary may open while the bottom panel remains open");
  assert(harness.root.dataset.deniaWorkSurfaceState === "open", "summary must claim horizontal task space while bottom panel stays open");

  harness.clearMutationRecords();
  summaryToggle.setAttribute("aria-pressed", "false");
  assert(harness.flushMutations() === 1, "summary may close while the bottom panel remains open");
  assert(harness.root.dataset.deniaBottomPanelState === "open", "summary close must preserve the bottom marker");
  assert(harness.root.dataset.deniaWorkSurfaceState === "closed", "bottom-only state must restore task alignment");

  harness.clearMutationRecords();
  sidebarToggle.setAttribute("aria-pressed", "true");
  assert(harness.flushMutations() === 1, "sidebar may open while the bottom panel remains open");
  assert(harness.root.dataset.deniaBottomPanelState === "open", "sidebar open must preserve the bottom marker");
  assert(harness.root.dataset.deniaWorkSurfaceState === "open", "obscuring sidebar must claim horizontal task space");

  harness.clearMutationRecords();
  sidebarToggle.setAttribute("aria-pressed", "false");
  assert(harness.flushMutations() === 1, "sidebar may close while the bottom panel remains open");
  assert(harness.root.dataset.deniaWorkSurfaceState === "closed", "bottom-only state must return after sidebar close");
  assert(state.artGeneration === initialArtGeneration, "panel toggles must not advance artwork generation");
  assert(state.metrics.createdNodes === initialCreatedNodes, "panel toggles must not create artwork nodes");
  assert(harness.document.getElementById("denia-old-days-ds-chrome") === chrome, "panel toggles must retain the same chrome node");
  assert(harness.document.getElementById("denia-old-days-ds-state-art") === rail, "panel toggles must retain the same artwork rail");
```

- [ ] **Step 2: Run the validator and confirm the new bottom-panel assertion fails**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL with `bottom panel must not claim horizontal task space`.

- [ ] **Step 3: Remove the bottom panel from the aggregate condition**

Change `syncNativeWorkSurfaces()` to:

```js
    const workSurface = summary === "open"
      || sidebarObscures
      ? "open"
      : "closed";
```

Keep `bottomPanel` in `state.workSurfaces` and keep `data-denia-bottom-panel-state`.

- [ ] **Step 4: Run the validator and confirm the lifecycle passes**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: PASS with `Validated 达妮娅 · 旧日斑斓 extension 0.1.0`.

- [ ] **Step 5: Commit the independent state-semantic fix**

```bash
git add sidecar/src/denia-old-days-extension.js sidecar/tests/validate.mjs
git commit -m "fix: keep bottom panel out of horizontal work state"
```

### Task 2: Mount the artwork chrome in the task background stack

**Files:**

- Modify: `sidecar/tests/validate.mjs:465-480`
- Modify: `sidecar/tests/validate.mjs:695-702`
- Modify: `sidecar/tests/validate.mjs:3489-3571`
- Modify: `sidecar/src/denia-old-days-extension.js:14-24`
- Modify: `sidecar/src/denia-old-days-extension.js:814-825`
- Modify: `sidecar/src/denia-old-days-extension.js:1603-1648`
- Modify: `sidecar/src/denia-old-days-extension.css:144-151`
- Modify: `sidecar/src/denia-old-days-extension.css:778-782`

**Interfaces:**

- Consumes: `findMain()`, `ownedNodes`, `ensureStateArt()`, `cleanup()`.
- Produces: one reusable `#denia-old-days-ds-chrome` whose parent is the current semantic task `main` and whose stacking level is `-1`.

- [ ] **Step 1: Add a runtime chrome-host lifecycle test**

Invoke `assertTaskChromeHostLifecycle(runtimePayload)` beside `assertStateArtRailLifecycle(runtimePayload)`, then add:

```js
function assertTaskChromeHostLifecycle(payload) {
  const harness = createRuntimeHarness((index) => `blob:chrome-host-${index + 1}`);
  const firstMain = harness.document.createElement("main");
  firstMain.setAttribute("role", "main");
  harness.document.body.append(firstMain);
  const summaryToggle = harness.document.createElement("button");
  summaryToggle.setAttribute("aria-label", "切换置顶摘要");
  summaryToggle.setAttribute("aria-pressed", "true");
  summaryToggle.setRect({ x: 1400, y: 8, width: 28, height: 28 });
  harness.document.body.append(summaryToggle);
  vm.runInContext(payload, harness.context, { timeout: 1000 });

  const state = harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const chrome = harness.document.getElementById("denia-old-days-ds-chrome");
  const rail = harness.document.getElementById("denia-old-days-ds-state-art");
  const activeFamily = rail.querySelector(".denia-old-days-ds-state-art-layer.is-active")?.dataset.deniaArtFamily;
  const createdNodes = state.metrics.createdNodes;

  assert(chrome?.parentElement === firstMain, "task chrome must mount inside the current main");
  state.refresh();
  assert(harness.document.getElementById("denia-old-days-ds-chrome") === chrome, "repeat refresh must reuse task chrome");
  assert(state.metrics.createdNodes === createdNodes, "repeat refresh must not create task chrome nodes");

  firstMain.remove();
  const replacementMain = harness.document.createElement("main");
  replacementMain.setAttribute("role", "main");
  harness.document.body.append(replacementMain);
  state.refresh();

  assert(chrome.parentElement === replacementMain, "replacement main must adopt the existing task chrome");
  assert(harness.document.getElementById("denia-old-days-ds-chrome") === chrome, "main replacement must retain chrome identity");
  assert(state.metrics.createdNodes === createdNodes, "main replacement must not create another chrome");
  assert(
    rail.querySelector(".denia-old-days-ds-state-art-layer.is-active")?.dataset.deniaArtFamily === activeFamily,
    "main replacement must preserve the active artwork family",
  );

  const approval = harness.document.createElement("div");
  approval.setAttribute("data-state", "approval");
  replacementMain.append(approval);
  state.refresh();
  const approvalLayer = rail.querySelector(".denia-old-days-ds-state-art-layer.is-active");
  assert(
    approvalLayer?.dataset.deniaArtFamily === "taskApproval",
    "task state must update artwork while summary covers the rail",
  );

  approval.remove();
  const error = harness.document.createElement("div");
  error.setAttribute("data-state", "error");
  replacementMain.append(error);
  state.refresh();
  assert(
    rail.querySelector(".denia-old-days-ds-state-art-layer.is-active")?.dataset.deniaArtFamily === "taskError",
    "covered artwork must continue updating into the error family",
  );

  error.remove();
  const assistant = harness.document.createElement("article");
  assistant.setAttribute("data-content-search-unit-key", "task:assistant");
  replacementMain.append(assistant);
  state.refresh();
  const coveredLayer = rail.querySelector(".denia-old-days-ds-state-art-layer.is-active");
  assert(
    coveredLayer?.dataset.deniaArtFamily === "taskComplete",
    "covered artwork must continue updating into the complete family",
  );
  const coveredGeneration = state.artGeneration;
  harness.clearMutationRecords();
  summaryToggle.setAttribute("aria-pressed", "false");
  assert(harness.flushMutations() === 1, "summary close must synchronize after covered artwork changes");
  assert(
    rail.querySelector(".denia-old-days-ds-state-art-layer.is-active") === coveredLayer,
    "summary close must reveal the current artwork layer",
  );
  assert(state.artGeneration === coveredGeneration, "summary close must not recreate the current artwork");

  state.cleanup();
  assert(!chrome.isConnected, "cleanup must remove chrome nested in task main");
}
```

- [ ] **Step 2: Run the validator and confirm the host assertion fails**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL with `task chrome must mount inside the current main`.

- [ ] **Step 3: Keep a stable chrome reference and reparent it to the semantic main**

Add this closure variable beside the native panel references:

```js
  let taskChrome = null;
```

Replace `ensureChrome()` with:

```js
  function ensureChrome() {
    const host = findMain() || document.body;
    let chrome = taskChrome || document.getElementById("denia-old-days-ds-chrome");
    if (!chrome) {
      chrome = own(document.createElement("div"));
      chrome.id = "denia-old-days-ds-chrome";
      chrome.className = "denia-old-days-ds-chrome";
      chrome.setAttribute("aria-hidden", "true");
    }
    taskChrome = chrome;
    if (chrome.parentElement !== host) host.append(chrome);
    ensureStateArt(chrome);
    return chrome;
  }
```

After the owned-node cleanup loop, release the reference:

```js
    taskChrome = null;
```

This reference allows a disconnected chrome from a replaced `main` to move into the new `main` without recreating its state-art layers.

- [ ] **Step 4: Run the validator and confirm the host lifecycle passes**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: PASS with the existing foreground CSS contract still unchanged.

- [ ] **Step 5: Replace the foreground/hide CSS assertions with the background-layer contract**

Change the chrome assertion and remove the two assertions that require panel-state hiding:

```js
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-chrome", {
  "z-index": "-1",
});
for (const forbiddenSelector of [
  '.denia-old-days-ds-extension:not([data-denia-sidebar-state="closed"]) .denia-old-days-ds-state-art',
  '.denia-old-days-ds-extension[data-denia-work-surface-state="open"] .denia-old-days-ds-state-art',
]) {
  const rule = stylesheetRules.find((candidate) => candidate.selectors.includes(forbiddenSelector));
  assert(
    !rule?.declarations.has("opacity") && !rule?.declarations.has("visibility"),
    `panel state must not hide the persistent task artwork: ${forbiddenSelector}`,
  );
}
```

Keep the existing home `display: none`, compact media query, `prefers-reduced-motion`,
`prefers-reduced-transparency`, rail geometry, image family, opacity, mask, and transition assertions.

- [ ] **Step 6: Run the validator and confirm the background-layer assertion fails**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL because chrome still has `z-index: 2`.

- [ ] **Step 7: Move chrome behind native task contents and delete state-based hiding**

Change:

```css
.denia-old-days-ds-chrome {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  contain: strict;
}
```

Delete:

```css
.denia-old-days-ds-extension:not([data-denia-sidebar-state="closed"]) .denia-old-days-ds-state-art,
.denia-old-days-ds-extension[data-denia-work-surface-state="open"] .denia-old-days-ds-state-art {
  opacity: 0;
  visibility: hidden;
}
```

- [ ] **Step 8: Run the focused validator and syntax checks**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
node --check sidecar/src/denia-old-days-extension.js
```

Expected: both commands exit 0; the validator prints the standard success summary.

- [ ] **Step 9: Commit the background-stack implementation**

```bash
git add sidecar/src/denia-old-days-extension.css sidecar/src/denia-old-days-extension.js sidecar/tests/validate.mjs
git commit -m "fix: keep task artwork in the native background stack"
```

### Task 3: Update live verification and prove panel-state artwork persistence

**Files:**

- Modify: `sidecar/tests/validate.mjs:2464-2925`
- Modify: `sidecar/runtime/loader.mjs:230-312`
- Modify: `sidecar/runtime/loader.mjs:449-534`
- Modify: `docs/current-theme-design.md:49-65`
- Modify: `sidecar/README.md:17-27`

**Interfaces:**

- Consumes: live `chrome`, `nativeMain`, `stateArtRail`, native sidebar geometry, expected art family and URL.
- Produces: live verification that requires task chrome to be hosted by `main`, requires visible state artwork on wide task views even with a sidebar, and still requires hidden task artwork on home and compact views.

- [ ] **Step 1: Reverse the live task fixtures from “hidden on sidebar” to “persistent behind sidebar”**

Add `chromeHostedByMain = true` to the `runCase()` options. After creating `body` and `main`, set:

```js
    chrome.parentElement = chromeHostedByMain ? main : body;
```

Replace the open/unknown sidebar artwork cases with:

```js
  assert(
    runCase({ formState: "working", sidebarState: "open" }).taskPass === true,
    "live task verification must accept persistent artwork behind a valid open sidebar",
  );
  assert(
    runCase({ formState: "working", sidebarState: "open", railDisplay: "none" }).taskPass === false,
    "live task verification must reject hidden task artwork while the sidebar is open",
  );
  assert(
    runCase({ formState: "working", sidebarState: "unknown" }).taskPass === true,
    "live task verification must retain task artwork during uncertain sidebar transitions",
  );
  assert(
    runCase({ formState: "working", sidebarState: "unknown", railDisplay: "none" }).taskPass === false,
    "live task verification must reject hidden artwork during uncertain sidebar transitions",
  );
```

Keep invalid sidebar confidence, duplicate panel, off-edge panel, short panel, overlap, hit-target, stale group/row, and home-hidden cases. Add:

```js
  assert(
    runCase({ formState: "working", chromeHostedByMain: false }).taskPass === false,
    "live task verification must reject task chrome outside the native main",
  );
```

- [ ] **Step 2: Run the validator and confirm the loader contract is still old**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL with `live task verification must accept persistent artwork behind a valid open sidebar`.

- [ ] **Step 3: Add chrome hosting and persistent-art fields to the live verifier**

After resolving `nativeMain`, compute:

```js
  const chromeHostedByMain = Boolean(!home && chrome?.parentElement === nativeMain);
```

Add to the non-home `task` result:

```js
      chromeHostedByMain,
```

Change:

```js
    homeNoCharacterPass: !home || !sidebarArtVisible,
```

Change the rail rule:

```js
  const railMustBeHidden = innerWidth <= 919;
```

Remove `&& !result.sidebar.artVisible` from the open-sidebar branch. Change the unknown branch to:

```js
      : noSidebarSkin && result.sidebar.homeNoCharacterPass && (home || railMatchesState));
```

Require the chrome host in `taskPass`:

```js
  const taskPass = home || (result.taskMode && validTaskState
    && result.task?.stateArtPresent === true
    && result.task?.chromeHostedByMain === true
    && railMatchesState && sidebarPass && observationsPass && finalCardPass);
```

- [ ] **Step 4: Run the validator and full project check**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
npm run check
```

Expected: both commands exit 0 with no warnings or failures.

- [ ] **Step 5: Update current documentation**

In `docs/current-theme-design.md`, replace the right-sidebar visibility bullets with:

```markdown
- 首页侧栏不显示任务人物；任务页人物栏保持在 `main` 背景层，原生摘要、底栏和右侧栏自然覆盖相交区域。
- 组件关闭后直接露出当前任务状态对应的图片，不重新挂载或回退图片状态。
- 检测不确定时不触碰原生侧栏；人物栏继续留在原生内容之下。
- 宽度小于 `920px` 时隐藏人物栏，优先保证工作区。
```

In `sidecar/README.md`, replace the final task-art paragraph with:

```markdown
任务页使用不参与布局的固定右侧双层美术栏。跨图状态通过 `opacity`、`transform` 和 `filter`
交叉过渡；同图状态只改变强度，不重复闪烁。美术栏挂在任务 `main` 的背景层，置顶摘要、底部面板
和右侧栏只覆盖各自相交区域。面板打开期间任务状态仍更新，关闭后直接显示当前状态。主题不修改
工作区、分栏或输入框几何尺寸；窄于 `920px` 时隐藏，并支持“减少动态效果”和“减少透明度”系统偏好。
```

- [ ] **Step 6: Build, install without restarting Codex, and run live verification**

Run each command separately:

```bash
npm run build:kaboo
```

```bash
bash sidecar/package.sh
```

```bash
bash sidecar/scripts/install.sh --no-start
```

```bash
bash sidecar/scripts/start.sh
```

```bash
bash sidecar/scripts/verify.sh
```

Expected:

- Kaboo build and Sidecar ZIP creation exit 0.
- Install reports the package path.
- Start reports an active LaunchAgent on port `9341`.
- Verify returns a JSON result with `"pass": true`, `"taskPass": true`, and `"chromeHostedByMain": true`.

- [ ] **Step 7: Run three live panel cycles and capture refresh/frame/long-task budgets**

Run this read/write-to-UI-only CDP probe. It opens and closes each panel, records 900 milliseconds per direction, and restores all toggles to closed.

```bash
node --input-type=module <<'NODE'
const targets = await (await fetch("http://127.0.0.1:9341/json/list")).json();
const target = targets.find((item) => item.type === "page" && item.url === "app://-/index.html");
if (!target) throw new Error("Codex page target not found");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  message.error ? request.reject(message.error) : request.resolve(message.result);
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const response = await call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
};
const patterns = {
  summary: "(?:切换(?:置顶)?摘要|toggle (?:pinned )?summary)",
  bottom: "(?:切换底部面板显示|toggle bottom panel)",
  sidebar: "(?:显示/隐藏侧边栏|show/hide sidebar|toggle sidebar)",
};
const longTaskBudgets = {
  summary: { open: 1, close: 1 },
  bottom: { open: 4, close: 1 },
  sidebar: { open: 1, close: 1 },
};
const results = [];
for (let round = 1; round <= 3; round += 1) {
  for (const [kind, source] of Object.entries(patterns)) {
    for (const direction of ["open", "close"]) {
      const sample = await evaluate(`(async () => {
        const pattern = new RegExp(${JSON.stringify(source)}, "iu");
        const label = (node) => (
          node.getAttribute("aria-label")
          || node.getAttribute("title")
          || node.textContent
          || ""
        ).replace(/\\s+/gu, " ").trim();
        const toggle = [...document.querySelectorAll("button")]
          .filter((node) => {
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return pattern.test(label(node))
              && style.display !== "none"
              && style.visibility !== "hidden"
              && rect.width > 0
              && rect.height > 0;
          })
          .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
        if (!toggle) throw new Error("visible toggle not found");
        const state = window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
        const beforeRefreshes = state.metrics.refreshes;
        const beforeCreatedNodes = state.metrics.createdNodes;
        const beforeGeneration = state.artGeneration;
        const longTasks = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) longTasks.push(entry.duration);
        });
        observer.observe({ type: "longtask", buffered: false });
        let maxFrameGap = 0;
        let previousFrame = performance.now();
        let frameId = 0;
        const frame = (now) => {
          maxFrameGap = Math.max(maxFrameGap, now - previousFrame);
          previousFrame = now;
          frameId = requestAnimationFrame(frame);
        };
        frameId = requestAnimationFrame(frame);
        toggle.click();
        await new Promise((resolve) => setTimeout(resolve, 900));
        cancelAnimationFrame(frameId);
        observer.disconnect();
        const rail = document.getElementById("denia-old-days-ds-state-art");
        const chrome = document.getElementById("denia-old-days-ds-chrome");
        const main = document.querySelector('[role="main"]') || document.querySelector("main");
        const railStyle = getComputedStyle(rail);
        return {
          refreshes: state.metrics.refreshes - beforeRefreshes,
          createdNodes: state.metrics.createdNodes - beforeCreatedNodes,
          artGeneration: state.artGeneration - beforeGeneration,
          maxFrameGap,
          longTasks: longTasks.filter((duration) => duration >= 50),
          railVisible: railStyle.display !== "none"
            && railStyle.visibility !== "hidden"
            && Number(railStyle.opacity) > 0,
          chromeHostedByMain: chrome.parentElement === main,
          markers: {
            summary: document.documentElement.dataset.deniaSummaryState,
            bottom: document.documentElement.dataset.deniaBottomPanelState,
            sidebar: document.documentElement.dataset.deniaSidebarState,
          },
        };
      })()`);
      results.push({ round, kind, direction, ...sample });
    }
  }
}
console.log(JSON.stringify(results, null, 2));
const failures = results.filter((sample) => {
  const expectedMarker = sample.direction === "open" ? "open" : "closed";
  return sample.refreshes > 5
    || sample.createdNodes !== 0
    || sample.artGeneration !== 0
    || !sample.railVisible
    || !sample.chromeHostedByMain
    || sample.longTasks.length > longTaskBudgets[sample.kind][sample.direction]
    || sample.markers[sample.kind] !== expectedMarker;
});
if (failures.length) throw new Error(`panel probe failures: ${JSON.stringify(failures)}`);
socket.close();
NODE
```

Expected:

- 18 samples are printed.
- Every sample has `refreshes <= 5`, `createdNodes: 0`, `artGeneration: 0`, `railVisible: true`, and `chromeHostedByMain: true`.
- Long-task counts do not exceed the previously recorded native baseline by more than one.
- Final markers are `summary: "closed"`, `bottom: "closed"`, and `sidebar: "closed"`.

- [ ] **Step 8: Capture visual evidence for each native covering surface**

Open one component at a time, then run:

```bash
bash sidecar/scripts/verify.sh --screenshot evidence/task-artwork-summary-open.png
```

```bash
bash sidecar/scripts/verify.sh --screenshot evidence/task-artwork-bottom-open.png
```

```bash
bash sidecar/scripts/verify.sh --screenshot evidence/task-artwork-sidebar-open.png
```

For each image, confirm:

- the component surface is opaque and readable;
- artwork remains visible outside the component rectangle;
- only the overlapping artwork region is covered;
- composer and component controls remain clickable.

Close every component and run `bash sidecar/scripts/verify.sh` once more.

- [ ] **Step 9: Run final verification and inspect the diff**

Run:

```bash
npm run check
git diff --check
git status --short
git diff -- sidecar/src/denia-old-days-extension.js sidecar/src/denia-old-days-extension.css sidecar/tests/validate.mjs sidecar/runtime/loader.mjs docs/current-theme-design.md sidecar/README.md
```

Expected:

- All checks exit 0.
- Only the six planned source, validation, and documentation files are modified.
- Generated release artifacts and evidence do not appear as tracked changes.

- [ ] **Step 10: Commit live verification and documentation**

```bash
git add sidecar/runtime/loader.mjs sidecar/tests/validate.mjs docs/current-theme-design.md sidecar/README.md
git commit -m "test: verify persistent task artwork under panels"
```
