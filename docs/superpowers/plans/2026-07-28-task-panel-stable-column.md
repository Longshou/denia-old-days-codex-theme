# Task Panel Stable Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the task main column at one horizontal position while the bottom terminal, pinned summary, or right sidebar opens and closes.

**Architecture:** Replace the two panel-state-dependent alignment selectors with one task-route selector that always uses the existing stable full-content-width snapshot. Apply the existing native motion override at task-route scope and remove the sidebar close compensation animation. Runtime state detection and layout measurement remain unchanged.

**Tech Stack:** CSS, Node.js ESM validation harness

## Global Constraints

- Bottom terminal may change task-area height but must not change the main column's horizontal position.
- Do not change main-column width, composer size, panel size, artwork behavior, or native panel interaction.
- Do not add DOM queries, geometry measurements, observers, event listeners, timers, animation-frame callbacks, or per-frame compensation.
- Preserve all unrelated work.

---

### Task 1: Use one stable task-column layout

**Files:**
- Modify: `sidecar/tests/validate.mjs:747-790`
- Modify: `sidecar/src/denia-old-days-extension.css:377-407`

**Interfaces:**
- Consumes: Existing root custom properties `--denia-thread-content-width`, `--thread-content-max-width`, and `--denia-state-rail-width`.
- Produces: One task-route alignment rule and one task-route native-motion override with no panel-state dependency.

- [ ] **Step 1: Write the failing CSS contract**

Replace the three state-dependent selector constants and their transition assertions in `sidecar/tests/validate.mjs` with:

```js
const taskContentAlignmentSelector = 'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task main .thread-scroll-container [class*="mx-auto"][class*="thread-content-max-width"]';
const taskContentMotionSelector = 'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task main .thread-scroll-container > [class*="min-h-full"][class*="shrink-0"]';
const taskContentAlignmentRule = findCssRule(stylesheetRules, taskContentAlignmentSelector);
assert(
  taskContentAlignmentRule?.selectors.length === 1,
  "task content alignment must use one route-stable selector",
);
for (const rule of stylesheetRules) {
  if (!rule.selectors.some((selector) => selector.includes(".denia-old-days-ds-task"))) continue;
  for (const property of rule.declarations.keys()) {
    if (rule.selectors.includes(taskContentAlignmentSelector)
      && ["margin-inline-start", "margin-inline-end"].includes(property)) continue;
    assert(!taskLayoutProperties.test(property), `task stylesheet must not override native layout property ${property}`);
  }
}
assertCssDeclarations(stylesheetRules, taskContentAlignmentSelector, {
  "margin-inline-start": "max(16px, calc((var(--denia-thread-content-width, 100cqw) - var(--thread-content-max-width) - var(--denia-state-rail-width)) / 2)) !important",
  "margin-inline-end": "auto !important",
});
assertCssDeclarations(stylesheetRules, taskContentMotionSelector, {
  transform: "none !important",
  transition: "none !important",
});
assert(
  !styles.includes("denia-old-days-sidebar-close-align"),
  "task layout must not retain sidebar close compensation animation",
);
```

- [ ] **Step 2: Run the validator and confirm RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit nonzero with `missing CSS rule for ...denia-old-days-ds-task main .thread-scroll-container...` because production CSS still requires closed panel states.

- [ ] **Step 3: Apply the minimal CSS change**

Replace the state-dependent alignment, motion, and sidebar-close animation blocks in `sidecar/src/denia-old-days-extension.css` with:

```css
html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task
  main .thread-scroll-container [class*="mx-auto"][class*="thread-content-max-width"] {
  margin-inline-start: max(16px, calc((var(--denia-thread-content-width, 100cqw) - var(--thread-content-max-width) - var(--denia-state-rail-width)) / 2)) !important;
  margin-inline-end: auto !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task
  main .thread-scroll-container > [class*="min-h-full"][class*="shrink-0"] {
  transform: none !important;
  transition: none !important;
}
```

Delete the selector containing `data-denia-sidebar-state="unknown"` and the complete `@keyframes denia-old-days-sidebar-close-align` block.

- [ ] **Step 4: Run the validator and confirm GREEN**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit zero with `Validated denia-old-days sidecar source package.`

- [ ] **Step 5: Verify the full project and performance boundary**

Run:

```bash
npm run check
git diff --check
git diff -- sidecar/src/denia-old-days-extension.js
```

Expected:

- `npm run check` exits zero.
- `git diff --check` exits zero.
- Runtime JavaScript diff is empty, proving the change adds no runtime work.

- [ ] **Step 6: Package and install the validated sidecar**

Run:

```bash
bash sidecar/package.sh
bash sidecar/scripts/install.sh
bash sidecar/scripts/verify.sh
```

Expected: packaging, installation, and installed-sidecar verification all exit zero.

- [ ] **Step 7: Review and commit**

Run:

```bash
git diff -- sidecar/src/denia-old-days-extension.css sidecar/tests/validate.mjs
git status --short
git add sidecar/src/denia-old-days-extension.css sidecar/tests/validate.mjs
git commit -m "fix: keep task column stable under panels"
```

Expected: the focused CSS and test changes are committed without generated release artifacts.
