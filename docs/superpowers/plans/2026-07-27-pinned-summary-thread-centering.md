# Pinned Summary Thread Centering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the task thread centered in the native remaining workspace when the pinned summary is open.

**Architecture:** Retain the existing CSS-only artwork-rail offset while the rail is visible. Gate that override with the runtime's existing `data-denia-work-surface-state="closed"` marker so an open summary falls back to Codex's native `mx-auto` layout.

**Tech Stack:** CSS, Node.js ESM validation harness

## Global Constraints

- Do not change thread width, summary width, composer size, or task artwork behavior.
- Do not add DOM measurement or runtime margin calculations.
- Preserve all unrelated uncommitted work.

---

### Task 1: Gate the artwork-rail alignment by native work-surface state

**Files:**
- Modify: `sidecar/tests/validate.mjs:518-531`
- Modify: `sidecar/src/denia-old-days-extension.css:273-277`

**Interfaces:**
- Consumes: The runtime-owned root marker `data-denia-work-surface-state`, whose values are `open` and `closed`.
- Produces: A CSS selector that reserves the artwork rail only for `data-denia-work-surface-state="closed"`.

- [ ] **Step 1: Write the failing selector test**

Change the expected selector in `sidecar/tests/validate.mjs` to:

```js
const taskContentAlignmentSelector = 'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-sidebar-state="closed"][data-denia-work-surface-state="closed"] main .thread-scroll-container [class*="mx-auto"][class*="thread-content-max-width"]';
```

Keep the existing declaration assertions:

```js
assertCssDeclarations(stylesheetRules, taskContentAlignmentSelector, {
  "margin-inline-start": "max(16px, calc((100% - var(--thread-content-max-width) - var(--denia-state-rail-width)) / 2)) !important",
  "margin-inline-end": "auto !important",
});
```

- [ ] **Step 2: Run the focused validator and confirm RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit nonzero because the existing task selector still overrides `margin-inline-start` without the closed work-surface condition.

- [ ] **Step 3: Apply the minimal CSS fix**

Change the selector in `sidecar/src/denia-old-days-extension.css` to:

```css
html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-sidebar-state="closed"][data-denia-work-surface-state="closed"]
  main .thread-scroll-container [class*="mx-auto"][class*="thread-content-max-width"] {
  margin-inline-start: max(16px, calc((100% - var(--thread-content-max-width) - var(--denia-state-rail-width)) / 2)) !important;
  margin-inline-end: auto !important;
}
```

- [ ] **Step 4: Run the focused validator and confirm GREEN**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit zero with `Validated denia-old-days sidecar source package.`

- [ ] **Step 5: Run full source and package validation**

Run:

```bash
npm run check
bash sidecar/package.sh
```

Expected: both commands exit zero; the package command creates `sidecar/release/denia-old-days-v0.1.0.zip`.

- [ ] **Step 6: Install the validated package and verify the live task route**

Run the repository's existing local install/start flow, then open and close the pinned summary twice on a task route. Confirm:

- Closed summary: thread keeps the artwork-rail offset.
- Open summary: thread uses native centering between the left navigation and summary panel.
- Closing the summary restores the artwork-rail offset.
- No horizontal overflow appears.

- [ ] **Step 7: Commit the focused fix**

```bash
git add sidecar/tests/validate.mjs sidecar/src/denia-old-days-extension.css
git commit -m "fix: center task thread with pinned summary"
```
