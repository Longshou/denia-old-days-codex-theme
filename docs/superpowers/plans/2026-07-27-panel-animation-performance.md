# Native Panel Animation Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the theme from amplifying native sidebar and bottom-panel animation stalls.

**Architecture:** First make composer discovery semantic so terminal textareas can never receive composer decoration. Re-measure the live animation, then—when the documented threshold is met—coalesce MutationObserver work during native style animations while keeping native toggle state synchronized immediately and semantic mutations immediate outside animation.

**Tech Stack:** Browser runtime JavaScript, MutationObserver, Node.js VM validation harness, CDP performance probe

## Global Constraints

- Preserve unrelated uncommitted work.
- Do not change native panel dimensions, native animation timing, terminal initialization, task content width, or composer dimensions.
- Do not suppress childList, class, ARIA, data, or disabled semantic updates.
- Do not add per-frame JavaScript measurement.
- Keep the existing sidebar-collapse alignment and pinned-summary centering behavior.

---

### Task 1: Restrict composer discovery to real composer surfaces

**Files:**
- Modify: `sidecar/tests/validate.mjs`
- Modify: `sidecar/src/denia-old-days-extension.js:557-561`

**Interfaces:**
- Produces: `findComposer(): HTMLElement | null`
- Preserves: `.composer-surface-chrome` primary host and `form` fallback

- [ ] **Step 1: Add the failing terminal collision test**

Add `assertComposerIsolation(payload)` to the runtime suite. Build a task fixture containing:

```js
const composer = harness.document.createElement("div");
composer.classList.add("composer-surface-chrome");
const editor = harness.document.createElement("div");
editor.setAttribute("contenteditable", "true");
composer.append(editor);

const terminalScreen = harness.document.createElement("div");
terminalScreen.classList.add("xterm-screen");
const terminal = harness.document.createElement("div");
terminal.classList.add("xterm");
const terminalTextarea = harness.document.createElement("textarea");
terminal.append(terminalTextarea);
terminalScreen.append(terminal);
```

Place the terminal subtree before the composer in document order. After runtime installation, assert:

```js
composer.classList.contains("denia-old-days-ds-composer")
!terminal.classList.contains("denia-old-days-ds-composer")
!terminalScreen.classList.contains("denia-old-days-ds-composer")
```

Add a second fixture with a plain `form > textarea` and assert the form still receives the composer class.

- [ ] **Step 2: Run the validator and confirm RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit nonzero because the terminal textarea is selected first and its ancestor receives the composer class.

- [ ] **Step 3: Implement semantic composer discovery**

Use this selection contract:

```js
function findComposer() {
  const nativeComposer = [...document.querySelectorAll(".composer-surface-chrome")]
    .find(layoutVisible);
  if (nativeComposer) return nativeComposer;
  const input = [...document.querySelectorAll('textarea, [contenteditable="true"]')]
    .find((candidate) =>
      !candidate.closest('.xterm, [id^="terminal-panel-"], [role="tabpanel"], dialog, [role="dialog"], aside, nav')
      && Boolean(candidate.closest("form")));
  return input?.closest("form") || null;
}
```

- [ ] **Step 4: Run focused and full validation**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
npm run check
```

Expected: both commands exit zero.

- [ ] **Step 5: Package, install, and re-measure**

Run:

```bash
bash sidecar/package.sh
bash sidecar/scripts/install.sh
node /Users/bytedance/Documents/Codex/2026-07-27/new-chat/work/panel-animation-performance-probe.mjs
```

Confirm the terminal subtree has no composer class. Record refresh counts and style ratios for all four panel directions.

---

### Task 2: Debounce style-only observer batches

**Entry gate:** Execute this task when Task 1 measurements show any direction still exceeds 5 full refreshes per 900 milliseconds and style accounts for more than 50% of class/style mutations.

**Files:**
- Modify: `sidecar/tests/validate.mjs:1510-1530`
- Modify: `sidecar/tests/validate.mjs:1535-1970`
- Modify: `sidecar/tests/validate.mjs:2900-3005`
- Modify: `sidecar/src/denia-old-days-extension.js:70-95`
- Modify: `sidecar/src/denia-old-days-extension.js:1117-1124`
- Modify: `sidecar/src/denia-old-days-extension.js:1160-1268`

**Interfaces:**
- Produces: `scheduleStyleRefresh(): void`
- Produces: `cancelStyleRefresh(): void`
- Produces: `mutationIsNativeWorkSurfaceToggleState(record): boolean`
- State: `styleRefreshTimer: number`

- [ ] **Step 1: Make harness timers deterministic**

Replace direct sandbox `setTimeout` and `clearTimeout` with a map-backed fake timer implementation. Expose:

```js
flushTimers() {
  const pending = [...timers.entries()];
  timers.clear();
  for (const [, callback] of pending) callback();
  return pending.length;
}
```

Existing tests must continue to pass without flushing unrelated timers.

- [ ] **Step 2: Add failing style debounce assertions**

In `assertObserverStability(payload)`:

```js
harness.clearMutationRecords();
main.style.setProperty("height", "100px");
assert(harness.flushMutations() === 1);
assert(harness.flushAnimationFrames() === 0);
assert(harness.flushTimers() === 1);
assert(harness.flushAnimationFrames() === 1);
```

Repeat two style mutations before `flushTimers()` and assert only one timer exists. Then add a class mutation while the timer is pending and assert it remains part of the single trailing refresh. Add a separate class mutation without an active timer and assert it refreshes on the next animation frame.

- [ ] **Step 3: Add failing immediate work-surface assertions**

Update `assertNativeWorkSurfaceLifecycle(payload)` so summary and bottom toggle `aria-pressed` mutations:

```js
harness.flushMutations() === 1
harness.flushAnimationFrames() === 0
```

The corresponding dataset markers must already contain their new values.

- [ ] **Step 4: Run the validator and confirm RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit nonzero because style-only mutations still schedule an immediate frame and work-surface toggles still schedule full refreshes.

- [ ] **Step 5: Implement the trailing style refresh**

Add `styleRefreshTimer: 0` to state and implement:

```js
function cancelStyleRefresh() {
  if (!state.styleRefreshTimer) return;
  clearTimeout(state.styleRefreshTimer);
  state.styleRefreshTimer = 0;
}

function scheduleStyleRefresh() {
  cancelStyleRefresh();
  state.styleRefreshTimer = setTimeout(() => {
    state.styleRefreshTimer = 0;
    scheduleRefresh();
  }, 80);
}
```

Make direct semantic `scheduleRefresh()` cancel a pending style timer before scheduling its animation frame. Observer semantic work that arrives during a native style animation must use the trailing scheduler instead. Cleanup must call `cancelStyleRefresh()`.

- [ ] **Step 6: Classify observer batches**

After filtering theme and terminal churn:

```js
const toggleRecords = relevantRecords.filter(mutationIsNativeWorkSurfaceToggleState);
if (toggleRecords.length) {
  if (toggleRecords.some(mutationIsNativeSidebarToggleState)) {
    syncNativeRightSidebar(state.homeActive);
  }
  syncNativeWorkSurfaces();
}
const refreshRecords = relevantRecords.filter((record) =>
  !mutationIsNativeWorkSurfaceToggleState(record));
const hasSemanticRefresh = refreshRecords.some((record) =>
  record.type !== "attributes" || record.attributeName !== "style");
if (hasSemanticRefresh) {
  if (toggleRecords.length || state.styleRefreshTimer) scheduleStyleRefresh();
  else scheduleRefresh();
} else if (refreshRecords.length) {
  scheduleStyleRefresh();
}
```

Match work-surface toggles using the existing sidebar, summary, and bottom-panel label patterns. Expand terminal churn filtering to `.xterm` and `[id^="terminal-panel-"]`.
Ignore only the exact empty, hidden editor color probe that Codex mounts under `body` while resolving
`var(--color-token-editor-background)`; keep ordinary body child-list records semantic.

- [ ] **Step 7: Run focused and full validation**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
npm run check
```

Expected: both commands exit zero.

---

### Task 3: Install and compare performance

**Files:**
- Verify: `sidecar/src/denia-old-days-extension.js`
- Verify: `sidecar/tests/validate.mjs`
- Verify: `work/panel-animation-performance-probe.mjs`

- [ ] **Step 1: Build and install**

Run:

```bash
bash sidecar/package.sh
bash sidecar/scripts/install.sh
bash sidecar/scripts/verify.sh
```

Expected: package, install, and live verification all exit zero.

- [ ] **Step 2: Collect three themed runs**

Run the panel performance probe three times. For each of sidebar open, sidebar close, bottom open, and bottom close, record:

- complete refresh count;
- frame gaps over 20, 32, and 50 milliseconds;
- long tasks over 50 milliseconds;
- final state and restoration state.

- [ ] **Step 3: Collect a native baseline**

Run one probe with `DENIA_PROBE_DISABLE_RUNTIME=1`, then immediately reinstall the theme. Compare the themed median with the native result.

- [ ] **Step 4: Verify acceptance**

Confirm:

- no terminal node receives composer decoration;
- each direction performs at most 5 complete refreshes per 900 milliseconds;
- theme adds no more than one 50 millisecond long task over native;
- final sidebar, bottom-panel, and summary states restore correctly;
- sidebar collapse coordinates retain the previous smooth curve;
- pinned summary still uses symmetric native margins while open.

- [ ] **Step 5: Run final full validation**

Run:

```bash
git diff --check
npm run check
bash sidecar/scripts/verify.sh
```

Expected: all commands exit zero and live verification reports `"pass": true`.
