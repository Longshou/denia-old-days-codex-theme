# Denia Task Background Color Harmony Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the task page's green-yellow seam with a restrained Denia pearl-lilac palette without changing the visible area or rendering of the character artwork.

**Architecture:** Keep the task-only solid body and main-surface gradient architecture. Change only task background color variables, the state-art rail's flat background color, border color, and the color values inside its existing tint gradients. Preserve every character-art geometry, mask, opacity, filter, transform, transition, and state mapping declaration.

**Tech Stack:** CSS custom properties and gradients, Node.js static CSS validation, CDP-backed Sidecar live verification.

## Global Constraints

- Only concrete task pages receive the background; the home page must remain unchanged.
- Do not modify `sidecar/src/denia-old-days-extension.js`.
- Do not modify any artwork file or manifest artwork mapping.
- Preserve the rail's `width`, `inset`, `42px` mask, and border width.
- Preserve artwork `background-position`, `background-size`, opacity, filter, transform, and transition declarations exactly.
- Preserve all five state-to-art families and opacity values exactly.
- Preserve every existing tint gradient stop position and alpha; replace hue values only.
- Do not add nodes, images, textures, animation, or notebook elements.
- Keep the reading center low contrast and keep full-width radial anchors at or left of `66%`.
- Narrow-screen backgrounds remain lower intensity and reduced-transparency mode remains solid color.

---

### Task 1: Lock the palette and non-invasive artwork contract

**Files:**
- Modify: `sidecar/tests/validate.mjs:438-575`
- Test: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: `stylesheetRules`, `runtime`, `findCssRule`, `assertCssDeclarations`, and `canonicalCssValue`.
- Produces: static regression checks for the new palette and exact preservation of artwork rendering.

- [ ] **Step 1: Update the task background palette expectations**

Change the two base-color expectations to:

```js
assertCssDeclarations(stylesheetRules, taskBackgroundRootSelector, {
  "--denia-task-background-color-light": "#F2EFF4",
  "--denia-task-background-color-dark": "#12142F",
});
```

Replace the old task-palette list with:

```js
for (const requiredColor of [
  "#F2EFF4",
  "205, 158, 182",
  "83, 83, 139",
  "121, 126, 173",
  "96, 77, 112",
  "#12142F",
  "30, 35, 90",
  "48, 53, 111",
  "87, 95, 154",
  "118, 79, 126",
  "161, 107, 145",
  "190, 144, 172",
]) {
  assert(
    taskBackgroundValues.includes(requiredColor),
    `task background must retain the Denia palette color ${requiredColor}`,
  );
}
```

- [ ] **Step 2: Lock character-art rendering declarations**

Extend the existing rail and artwork assertions with:

```js
assertCssDeclarations(stylesheetRules, taskRailSelector, {
  position: "absolute",
  inset: "46px 0 0 auto",
  width: "var(--denia-state-rail-width)",
  overflow: "hidden",
  isolation: "isolate",
  "pointer-events": "none",
  "border-inline-start": "1px solid rgba(var(--denia-task-rail-indigo-rgb), .14)",
  background: "rgba(var(--denia-task-rail-surface-rgb), .3)",
  "mask-image": "linear-gradient(90deg, transparent 0, #000 42px)",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-state-art-layer", {
  "background-position": "center",
  "background-size": "cover",
  "background-repeat": "no-repeat",
  filter: "saturate(.92) contrast(.98)",
  transform: "translateX(12px) scale(.985)",
  transition: "opacity 300ms cubic-bezier(.22, 1, .36, 1), transform 360ms cubic-bezier(.22, 1, .36, 1), filter 360ms cubic-bezier(.22, 1, .36, 1)",
});
assertCssDeclarations(
  stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-form-state="working"] .denia-old-days-ds-state-art-layer[data-denia-art-family="taskWarm"].is-active',
  {
    filter: "saturate(1) contrast(1.1)",
    transform: "translateX(-3px) scale(1.015)",
  },
);
```

Lock the runtime state contract without changing the runtime:

```js
for (const token of [
  'staged: Object.freeze({ family: "taskWarm", opacity: ".11" })',
  'working: Object.freeze({ family: "taskWarm", opacity: ".20" })',
  'approval: Object.freeze({ family: "taskApproval", opacity: ".43" })',
  'error: Object.freeze({ family: "taskError", opacity: ".56" })',
  'complete: Object.freeze({ family: "taskComplete", opacity: ".28" })',
]) {
  assert(runtime.includes(token), `state artwork contract changed: ${token}`);
}
```

- [ ] **Step 3: Lock existing tint coverage geometry**

Add exact hue-variable backgrounds while retaining the existing stops:

```js
const tintBackgrounds = new Map([
  [".denia-old-days-ds-state-art-tint",
    "linear-gradient(90deg, rgba(var(--denia-task-background-rgb), .96) 0, rgba(var(--denia-task-rail-mid-rgb), .26) 26%, transparent 58%), linear-gradient(180deg, rgba(var(--denia-task-rail-indigo-rgb), .12), rgba(var(--denia-task-rail-rose-rgb), .08))"],
  ['.denia-old-days-ds-extension[data-denia-form-state="staged"] .denia-old-days-ds-state-art-tint',
    "linear-gradient(90deg, rgba(var(--denia-task-background-rgb), .98) 0, rgba(var(--denia-task-rail-mid-rgb), .34) 30%, transparent 62%), linear-gradient(180deg, rgba(var(--denia-task-rail-rose-rgb), .12), rgba(var(--denia-task-rail-indigo-rgb), .1))"],
  ['.denia-old-days-ds-extension[data-denia-form-state="working"] .denia-old-days-ds-state-art-tint',
    "linear-gradient(90deg, rgba(var(--denia-task-background-rgb), .96) 0, rgba(var(--denia-task-rail-mid-rgb), .28) 30%, transparent 64%), linear-gradient(180deg, rgba(var(--denia-task-rail-indigo-rgb), .16), rgba(var(--denia-task-rail-rose-rgb), .08))"],
  ['.denia-old-days-ds-extension[data-denia-form-state="approval"] .denia-old-days-ds-state-art-tint',
    "linear-gradient(90deg, rgba(var(--denia-task-background-rgb), .96) 0, rgba(var(--denia-task-rail-deep-rgb), .28) 35%, rgba(var(--denia-task-rail-deep-rgb), .08) 72%), linear-gradient(180deg, rgba(var(--denia-task-rail-plum-rgb), .16), rgba(var(--denia-task-rail-deep-rgb), .22))"],
  ['.denia-old-days-ds-extension[data-denia-form-state="error"] .denia-old-days-ds-state-art-tint',
    "linear-gradient(90deg, rgba(var(--denia-task-background-rgb), .95) 0, rgba(var(--denia-task-rail-deep-rgb), .34) 34%, rgba(var(--denia-task-rail-deep-rgb), .14) 74%), linear-gradient(180deg, rgba(228, 90, 168, .18), rgba(var(--denia-task-rail-deep-rgb), .28))"],
  ['.denia-old-days-ds-extension[data-denia-form-state="complete"] .denia-old-days-ds-state-art-tint',
    "radial-gradient(circle at 92% 92%, rgba(var(--denia-task-background-rgb), .3), transparent 32%), linear-gradient(90deg, rgba(var(--denia-task-background-rgb), .97) 0, rgba(var(--denia-task-rail-mid-rgb), .26) 30%, transparent 62%), linear-gradient(180deg, rgba(var(--denia-task-rail-rose-rgb), .14), rgba(var(--denia-task-rail-indigo-rgb), .08))"],
]);
for (const [selector, background] of tintBackgrounds) {
  assertCssDeclarations(stylesheetRules, selector, { background });
}
```

- [ ] **Step 4: Run the validator and verify RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL on `--denia-task-background-color-light: #F2EFF4`; all artwork-preservation assertions that describe current behavior remain green.

- [ ] **Step 5: Commit the failing contract**

```bash
git add sidecar/tests/validate.mjs
git commit -m "test: lock non-invasive task color harmony"
```

### Task 2: Replace background and tint hues only

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.css:1-37`
- Modify: `sidecar/src/denia-old-days-extension.css:65-72`
- Modify: `sidecar/src/denia-old-days-extension.css:109-232`
- Test: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: the existing task route class, `data-denia-theme="dark"`, state-art selectors, and unchanged runtime state mappings.
- Produces: light/dark task backgrounds and theme-aware rail tint color tokens.

- [ ] **Step 1: Replace light and dark task palette variables**

Use:

```css
  --denia-task-background-color-light: #F2EFF4;
  --denia-task-background-rgb-light: 242, 239, 244;
  --denia-task-background-image-light:
    radial-gradient(ellipse at 62% 10%, rgba(205, 158, 182, .18), rgba(205, 158, 182, .05) 24%, transparent 46%),
    radial-gradient(ellipse at 14% 90%, rgba(83, 83, 139, .13), transparent 42%),
    radial-gradient(circle at 64% 80%, rgba(121, 126, 173, .09), transparent 22%),
    radial-gradient(circle at 12% 12%, rgba(96, 77, 112, .045), transparent 18%),
    linear-gradient(135deg, rgba(255, 255, 255, .4), transparent 48%);
  --denia-task-background-image-light-compact:
    radial-gradient(ellipse at 72% 4%, rgba(205, 158, 182, .12), transparent 40%),
    radial-gradient(ellipse at 8% 100%, rgba(83, 83, 139, .08), transparent 38%),
    linear-gradient(135deg, rgba(255, 255, 255, .34), transparent 52%);
  --denia-task-background-color-dark: #12142F;
  --denia-task-background-rgb-dark: 18, 20, 47;
  --denia-task-background-image-dark:
    radial-gradient(ellipse at 62% 10%, rgba(161, 107, 145, .17), rgba(161, 107, 145, .05) 24%, transparent 46%),
    radial-gradient(ellipse at 14% 90%, rgba(48, 53, 111, .44), transparent 46%),
    radial-gradient(circle at 64% 80%, rgba(87, 95, 154, .18), transparent 24%),
    radial-gradient(circle at 12% 12%, rgba(118, 79, 126, .12), transparent 20%),
    radial-gradient(circle at 66% 88%, rgba(190, 144, 172, .08), transparent 6%),
    linear-gradient(145deg, rgba(30, 35, 90, .3), transparent 46%);
  --denia-task-background-image-dark-compact:
    radial-gradient(ellipse at 72% 4%, rgba(161, 107, 145, .11), transparent 40%),
    radial-gradient(ellipse at 8% 100%, rgba(48, 53, 111, .28), transparent 42%),
    linear-gradient(145deg, rgba(30, 35, 90, .26), transparent 50%);
```

- [ ] **Step 2: Add theme-aware rail hue tokens**

Add to the extension root:

```css
  --denia-task-rail-surface-rgb-light: 231, 226, 235;
  --denia-task-rail-mid-rgb-light: 222, 215, 230;
  --denia-task-rail-deep-rgb-light: 54, 49, 82;
  --denia-task-rail-rose-rgb-light: 205, 158, 182;
  --denia-task-rail-indigo-rgb-light: 121, 126, 173;
  --denia-task-rail-plum-rgb-light: 118, 79, 126;
  --denia-task-rail-surface-rgb-dark: 24, 24, 52;
  --denia-task-rail-mid-rgb-dark: 39, 35, 65;
  --denia-task-rail-deep-rgb-dark: 18, 20, 47;
  --denia-task-rail-rose-rgb-dark: 161, 107, 145;
  --denia-task-rail-indigo-rgb-dark: 87, 95, 154;
  --denia-task-rail-plum-rgb-dark: 118, 79, 126;
  --denia-task-background-rgb: var(--denia-task-background-rgb-light);
  --denia-task-rail-surface-rgb: var(--denia-task-rail-surface-rgb-light);
  --denia-task-rail-mid-rgb: var(--denia-task-rail-mid-rgb-light);
  --denia-task-rail-deep-rgb: var(--denia-task-rail-deep-rgb-light);
  --denia-task-rail-rose-rgb: var(--denia-task-rail-rose-rgb-light);
  --denia-task-rail-indigo-rgb: var(--denia-task-rail-indigo-rgb-light);
  --denia-task-rail-plum-rgb: var(--denia-task-rail-plum-rgb-light);
```

Add the dark active-token switches to the existing dark task selector:

```css
  --denia-task-background-rgb: var(--denia-task-background-rgb-dark);
  --denia-task-rail-surface-rgb: var(--denia-task-rail-surface-rgb-dark);
  --denia-task-rail-mid-rgb: var(--denia-task-rail-mid-rgb-dark);
  --denia-task-rail-deep-rgb: var(--denia-task-rail-deep-rgb-dark);
  --denia-task-rail-rose-rgb: var(--denia-task-rail-rose-rgb-dark);
  --denia-task-rail-indigo-rgb: var(--denia-task-rail-indigo-rgb-dark);
  --denia-task-rail-plum-rgb: var(--denia-task-rail-plum-rgb-dark);
```

- [ ] **Step 3: Replace only rail and tint color declarations**

Set the rail's existing border and background to:

```css
  border-inline-start: 1px solid rgba(var(--denia-task-rail-indigo-rgb), .14);
  background: rgba(var(--denia-task-rail-surface-rgb), .3);
```

Replace the six tint `background` declarations with the exact values from Task 1. Do not edit `.denia-old-days-ds-state-art-layer`, `.is-active`, `.is-leaving`, the `taskWarm` working override, or any runtime file.

- [ ] **Step 4: Run the focused validator and verify GREEN**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: PASS with `Sidecar validation passed.`

- [ ] **Step 5: Review the source diff for scope**

Run:

```bash
git diff --check
git diff -- sidecar/src/denia-old-days-extension.css sidecar/src/denia-old-days-extension.js
```

Expected: CSS diff contains only task background tokens and rail/tint color declarations; JavaScript diff is empty.

- [ ] **Step 6: Commit the implementation**

```bash
git add sidecar/src/denia-old-days-extension.css
git commit -m "fix: harmonize task background without covering art"
```

### Task 3: Install and verify visual and geometric invariants

**Files:**
- Modify: `docs/superpowers/plans/2026-07-28-task-background-color-harmony.md`
- Test: live Codex task page and full repository checks

**Interfaces:**
- Consumes: the completed CSS and unchanged runtime.
- Produces: light/dark evidence screenshots and a checked implementation plan.

- [ ] **Step 1: Run full source checks and install**

Run:

```bash
npm run check
bash sidecar/scripts/install.sh
```

Expected: source checks pass and the installed Sidecar matches the workspace source.

- [ ] **Step 2: Capture the light task page**

Run:

```bash
bash sidecar/scripts/verify.sh --screenshot /tmp/denia-color-harmony-light.png
```

Expected: `pass: true`, task rail `x`, `width`, and family are unchanged; the light screenshot has no green-yellow seam.

- [ ] **Step 3: Compare live artwork rendering with the locked contract**

Read computed styles through the active CDP target and assert:

```js
{
  railMask: "linear-gradient(90deg, rgba(0, 0, 0, 0) 0px, rgb(0, 0, 0) 42px)",
  layerPosition: "50% 50%",
  layerSize: "cover",
  layerOpacity: "0.2",
  layerFilter: "saturate(1) contrast(1.1)",
}
```

Expected: all values match the pre-change working-state contract; no artwork display-space value changed.

- [ ] **Step 4: Capture the dark background and restore light mode**

Temporarily set `document.documentElement.dataset.deniaTheme = "dark"` through CDP, capture:

```bash
bash sidecar/scripts/verify.sh --screenshot /tmp/denia-color-harmony-dark.png
```

Then delete `document.documentElement.dataset.deniaTheme`.

Expected: the dark background uses `rgb(18, 20, 47)` and muted berry/indigo gradients; the light theme is restored afterward.

- [ ] **Step 5: Run build and final scope audit**

Run:

```bash
npm run check
npm run build:kaboo
git diff HEAD~2 -- sidecar/src/denia-old-days-extension.js sidecar/assets sidecar/extension.json
git status --short --branch
```

Expected: checks and build pass; runtime, assets, and manifest diffs are empty.

- [ ] **Step 6: Complete the plan and commit**

Mark every checkbox complete, then run:

```bash
git add docs/superpowers/plans/2026-07-28-task-background-color-harmony.md
git commit -m "docs: complete task color harmony plan"
```
