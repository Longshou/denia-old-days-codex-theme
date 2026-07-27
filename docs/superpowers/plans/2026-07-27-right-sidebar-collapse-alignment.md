# Right Sidebar Collapse Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the task thread from overshooting right and snapping back when the native right sidebar closes.

**Architecture:** Expose the already-detected native sidebar toggle state as a root dataset marker. Preserve a stable full-thread content width while the native sidebar shrinks, then use that same width for the transition and final closed margin. Because native `auto` margins cannot interpolate into a length, preserve the last trusted native sidebar width and animate a compensating `translate` from the old visual position to the final one.

**Tech Stack:** Browser runtime JavaScript, CSS container query units, Node.js ESM validation harness, CDP live probe

## Global Constraints

- Preserve all unrelated uncommitted work.
- Do not alter native sidebar width or timing.
- Do not change task thread width, composer size, pinned-summary behavior, or artwork rail behavior.
- Do not introduce per-frame DOM measurement or JavaScript-computed margins.
- Keep the opening path on Codex's native animation.

---

### Task 1: Specify the closing transition with failing tests

**Files:**
- Modify: `sidecar/tests/validate.mjs:518-540`
- Modify: `sidecar/tests/validate.mjs:1040-1185`
- Modify: `sidecar/tests/validate.mjs:2530-2560`

**Interfaces:**
- Consumes: `nativeToggleState(toggle)` and the existing `state.sidebar` diagnostics.
- Produces: Test expectations for `data-denia-sidebar-toggle-state` and the closing-only CSS rule.

- [ ] **Step 1: Add runtime transition assertions**

Assert that an open sidebar exposes `toggleState: "open"` in diagnostics and
`data-denia-sidebar-toggle-state="open"` on the root.

Before hiding the controlled panel, change only `aria-expanded` to `false`, refresh, and assert:

```js
state.sidebar.state === "unknown"
state.sidebar.toggleState === "closed"
root.dataset.deniaSidebarToggleState === "closed"
```

Then hide the panel, refresh again, and retain the existing final `closed` assertion.

- [ ] **Step 2: Add CSS contract assertions**

Add an exact closing selector:

```js
const taskSidebarClosingAlignmentSelector = 'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-sidebar-state="unknown"][data-denia-sidebar-toggle-state="closed"][data-denia-summary-state="closed"][data-denia-bottom-panel-state="closed"] main .thread-scroll-container [class*="mx-auto"][class*="thread-content-max-width"]';
```

Require the closing and final closed rules to use:

```css
margin-inline-start: max(16px, calc((var(--denia-thread-content-width, 100cqw) - var(--thread-content-max-width) - var(--denia-state-rail-width)) / 2)) !important;
margin-inline-end: auto !important;
```

Require only the closing rule to include:

```css
transition: none !important;
animation: denia-old-days-sidebar-close-align 160ms cubic-bezier(.22, 1, .36, 1) both;
```

Require the animation to start from the native/artwork rail width delta and end at zero:

```css
from {
  translate: calc((var(--denia-state-rail-width) - var(--denia-native-sidebar-width, var(--denia-state-rail-width))) / 2) 0;
}
to {
  translate: 0 0;
}
```

- [ ] **Step 3: Add cleanup assertions**

Assert both runtime cleanup and loader fallback cleanup remove
`data-denia-sidebar-toggle-state`, `--denia-native-sidebar-width`, and
`--denia-thread-content-width`.

- [ ] **Step 4: Run the validator and confirm RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit nonzero because production code does not yet expose the toggle marker or define the closing rule.

---

### Task 2: Expose and clean up native toggle state

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.js:445-490`
- Modify: `sidecar/src/denia-old-days-extension.js:1175-1185`
- Modify: `sidecar/runtime/loader.mjs:180-190`

**Interfaces:**
- Produces: `state.sidebar.toggleState`
- Produces: `html[data-denia-sidebar-toggle-state="open|closed|unknown"]`

- [ ] **Step 1: Synchronize the state**

In `syncNativeRightSidebar`, derive `toggleState` from `result.toggle`, store it in the public scalar diagnostics object, and set the root dataset marker in the same refresh. When geometry confirms an open panel, retain its width as `--denia-native-sidebar-width`. On every normal state refresh, snapshot the stable full-thread content width as `--denia-thread-content-width`.

Synchronize a sidebar toggle attribute mutation directly inside the MutationObserver callback, before the next animation frame. Other mutations keep the existing scheduled refresh path.

- [ ] **Step 2: Clean up the state**

Delete `root.dataset.deniaSidebarToggleState` and remove both width snapshots from normal runtime cleanup and loader fallback cleanup.

- [ ] **Step 3: Run the focused validator**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: runtime and cleanup assertions pass; CSS assertions remain red until Task 3.

---

### Task 3: Apply the closing alignment before geometry settles

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.css:273-282`

- [ ] **Step 1: Stabilize the final closed target**

Change the existing final closed formula from `100%` to
`var(--denia-thread-content-width, 100cqw)`.

- [ ] **Step 2: Add the closing-only transition rule**

Add the exact `unknown + closed toggle + closed summary + closed bottom panel` selector. Give it the same stable-width target margins and the 160 millisecond compensating translate animation.

- [ ] **Step 3: Run the validator and confirm GREEN**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit zero with `Validated denia-old-days sidecar source package.`

---

### Task 4: Package, install, and verify the real animation

**Files:**
- Verify: `sidecar/src/denia-old-days-extension.js`
- Verify: `sidecar/src/denia-old-days-extension.css`
- Verify: `sidecar/runtime/loader.mjs`
- Verify: `sidecar/tests/validate.mjs`

- [ ] **Step 1: Run full source validation**

Run:

```bash
npm run check
```

Expected: all checks exit zero.

- [ ] **Step 2: Build and install the sidecar**

Run:

```bash
bash sidecar/package.sh
bash sidecar/scripts/install.sh
```

Expected: packaging and installation both complete without errors.

- [ ] **Step 3: Run the CDP collapse probe**

Run the existing `work/right-sidebar-collapse-probe.mjs` against the live Codex window and inspect its samples.

Confirm:

- The closing path starts reacting when the toggle becomes `closed`.
- Main-content `x` does not travel materially beyond its final closed target and snap back.
- The final `closed` position remains stable.
- Reopening the sidebar still reaches the previous stable open position through the native animation.

- [ ] **Step 4: Review the focused diff**

Check that only the toggle marker lifecycle, the two alignment rules, and their tests changed for this fix. Run a final validator after review.
