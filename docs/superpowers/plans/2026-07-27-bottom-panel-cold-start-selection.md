# Bottom Panel Cold-Start Selection Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the theme-side amplification of the native xterm cold-start stall.

**Architecture:** Remove the renderer-wide descendant `::selection` rule so xterm rows use native selection styling. Reject unrelated button labels before geometry reads in native toggle discovery, preserving all existing panel-state behavior while reducing synchronous layout work.

**Tech Stack:** CSS, browser runtime JavaScript, Node.js static/VM validation, CDP CPU and frame profiling

## Global Constraints

- Preserve unrelated uncommitted work in the current live theme checkout.
- Do not change native panel dimensions, animation timing, xterm initialization, or terminal rendering.
- Do not add a broad `:not()` descendant selector or runtime CSS toggle.
- Keep composer isolation, sidebar-collapse alignment, pinned-summary centering, and immediate work-surface markers.

---

### Task 1: Lock the performance constraints with failing validation

**Files:**
- Modify: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: parsed `stylesheetRules` and the runtime source string.
- Produces: validator failures for a renderer-wide selection rule and geometry-first native-toggle filtering.

- [x] **Step 1: Add the selection-scope assertion**

After `stylesheetRules` is parsed, add:

```js
assert(
  !stylesheetRules.some((rule) =>
    rule.selectors.includes(".denia-old-days-ds-extension ::selection")),
  "stylesheet must not apply selection styling to every renderer descendant",
);
```

- [x] **Step 2: Add the toggle-filter ordering assertion**

Near the runtime source invariants, add:

```js
assert(
  runtime.includes(".filter((button) => pattern.test(normalizedNodeLabel(button)) && visible(button))"),
  "native toggle discovery must reject unrelated labels before geometry reads",
);
```

- [x] **Step 3: Run the validator and verify RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit nonzero with
`native toggle discovery must reject unrelated labels before geometry reads`.
After temporarily isolating that assertion, the existing stylesheet must also fail with
`stylesheet must not apply selection styling to every renderer descendant`.

---

### Task 2: Remove the global selection rule and reorder toggle filtering

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.css:41-44`
- Modify: `sidecar/src/denia-old-days-extension.js:205-208`

**Interfaces:**
- Preserves: `findNativeToggle(pattern): HTMLButtonElement | null`.
- Changes: text selection uses Codex/system styling; unrelated buttons never reach `visible()`.

- [x] **Step 1: Delete the renderer-wide selection rule**

Remove:

```css
.denia-old-days-ds-extension ::selection {
  color: var(--denia-ink);
  background: rgba(242, 154, 171, 0.46);
}
```

- [x] **Step 2: Reject unrelated toggle labels first**

Replace the filter with:

```js
.filter((button) => pattern.test(normalizedNodeLabel(button)) && visible(button))
```

- [x] **Step 3: Run focused validation and verify GREEN**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit zero and report the validated extension.

- [x] **Step 4: Run the complete source check**

Run:

```bash
npm run check
git diff --check
```

Expected: both commands exit zero.

---

### Task 3: Install and verify cold-start behavior

**Files:**
- Verify: `sidecar/src/denia-old-days-extension.css`
- Verify: `sidecar/src/denia-old-days-extension.js`
- Verify: `work/bottom-panel-cpu-profile.mjs`

**Interfaces:**
- Consumes: the sidecar install and live verification scripts.
- Produces: the updated active Codex theme and three post-fix cold-start profiles.

- [x] **Step 1: Install the validated sidecar**

Run:

```bash
bash sidecar/scripts/install.sh
```

Expected: package installation and runtime startup exit zero.

- [x] **Step 2: Run live verification**

Run:

```bash
bash sidecar/scripts/verify.sh
```

Expected: exit zero with `"pass": true`.

- [x] **Step 3: Collect three cold-start profiles**

Run the following three times:

```bash
node /Users/bytedance/Documents/Codex/2026-07-27/new-chat/work/bottom-panel-cpu-profile.mjs
```

Record xterm `createRow -> _measure`, `RecalcStyleDuration`, the maximum frame gap, the first terminal-text frame, and long tasks.

- [x] **Step 4: Verify regression-sensitive behavior**

Run:

```bash
npm run check
bash sidecar/scripts/verify.sh
```

Confirm the validator still covers composer isolation, immediate panel markers, observer coalescing, sidebar alignment, and pinned-summary centering.
