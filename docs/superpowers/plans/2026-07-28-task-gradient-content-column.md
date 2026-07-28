# Denia Task Gradient Content-Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move both Denia task-background gradient compositions out of the character rail and into the readable content column while keeping the center quiet.

**Architecture:** Keep the active theme color on the task-page `body`, but remove the gradient image from that surface. Paint the gradient only on `main.main-surface`, use that element as the percentage coordinate system, and constrain every full-width radial anchor to `12%–66%` so the `76%–100%` character rail no longer hides the composition.

**Tech Stack:** CSS custom properties and radial gradients, Node.js static CSS validation, CDP-backed Sidecar live verification.

## Global Constraints

- Only selectors containing `denia-old-days-ds-task` may apply the task background.
- The home page, character rail artwork, state mapping, transitions, layout, scroll containers, cards, and composer geometry must remain unchanged.
- `body` uses the active solid theme color and no gradient image.
- `main.main-surface` owns the active gradient image and uses its own box as the positioning coordinate system.
- Full-width light and dark radial-gradient anchors must stay at or left of `66%`; the character rail begins around `76%`.
- The reading center around `28%–54%` remains low contrast.
- Narrow-screen variants remain lower intensity.
- Reduced-transparency mode uses only the active solid theme color.

---

### Task 1: Lock content-column placement with a failing CSS contract

**Files:**
- Modify: `sidecar/tests/validate.mjs:476-550`
- Test: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: `stylesheetRules`, `findCssRule`, `assertCssDeclarations`, and `canonicalCssValue`.
- Produces: a static contract for solid-body paint, main-only gradients, and the `66%` character-rail safety boundary.

- [ ] **Step 1: Split body and main paint expectations**

Replace the shared body/main declaration loop with:

```js
assertCssDeclarations(stylesheetRules, taskBackgroundBodySelector, {
  "background-color": "var(--denia-task-background-color) !important",
  "background-image": "none !important",
});
assertCssDeclarations(stylesheetRules, taskBackgroundMainSelector, {
  "background-color": "var(--denia-task-background-color) !important",
  "background-image": "var(--denia-task-background-image) !important",
  "background-attachment": "scroll !important",
  "background-position": "center !important",
  "background-repeat": "no-repeat !important",
  "background-size": "cover !important",
});
```

- [ ] **Step 2: Add exact anchor and rail-safety assertions**

Add after the light/dark activation assertions:

```js
const taskBackgroundRootRule = findCssRule(stylesheetRules, taskBackgroundRootSelector);
const taskBackgroundFullImages = [
  taskBackgroundRootRule.declarations.get("--denia-task-background-image-light"),
  taskBackgroundRootRule.declarations.get("--denia-task-background-image-dark"),
];
for (const [label, value] of [
  ["light", taskBackgroundFullImages[0]],
  ["dark", taskBackgroundFullImages[1]],
]) {
  const horizontalAnchors = [...value.matchAll(/\bat\s+(\d+)%\s+\d+%/gu)]
    .map((match) => Number(match[1]));
  assert(horizontalAnchors.length >= 4, `${label} task background must expose its radial anchors`);
  assert(
    horizontalAnchors.every((anchor) => anchor <= 66),
    `${label} task background anchors must stay left of the character rail`,
  );
}
for (const requiredAnchor of ["at 62% 10%", "at 14% 90%", "at 64% 80%", "at 12% 12%"]) {
  assert(
    taskBackgroundFullImages.every((value) => value.includes(requiredAnchor)),
    `both task backgrounds must include content-column anchor ${requiredAnchor}`,
  );
}
```

- [ ] **Step 3: Run the validator and verify RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL because the body still owns the gradient and the existing full-width anchors include `82%`, `92%`, and `94%`.

### Task 2: Move the gradient composition into the main content surface

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.css:15-37`
- Modify: `sidecar/src/denia-old-days-extension.css:74-84`
- Modify: `sidecar/src/denia-old-days-extension.css:951-956`
- Test: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: `--denia-task-background-color` and `--denia-task-background-image`.
- Produces: a solid task body and a content-column gradient on `main.main-surface`.

- [ ] **Step 1: Re-anchor the light and dark gradient variables**

Use this shared spatial skeleton:

```css
  --denia-task-background-image-light:
    radial-gradient(ellipse at 62% 10%, rgba(230, 168, 177, .22), rgba(230, 168, 177, .07) 24%, transparent 46%),
    radial-gradient(ellipse at 14% 90%, rgba(91, 106, 172, .14), transparent 42%),
    radial-gradient(circle at 64% 80%, rgba(126, 201, 226, .1), transparent 22%),
    radial-gradient(circle at 12% 12%, rgba(49, 44, 91, .055), transparent 18%),
    linear-gradient(135deg, rgba(255, 255, 255, .44), transparent 48%);
  --denia-task-background-image-dark:
    radial-gradient(ellipse at 62% 10%, rgba(190, 132, 164, .18), rgba(149, 103, 143, .06) 24%, transparent 46%),
    radial-gradient(ellipse at 14% 90%, rgba(46, 59, 126, .46), transparent 46%),
    radial-gradient(circle at 64% 80%, rgba(86, 113, 177, .18), transparent 24%),
    radial-gradient(circle at 12% 12%, rgba(149, 103, 143, .12), transparent 20%),
    radial-gradient(circle at 66% 88%, rgba(212, 170, 193, .1), transparent 6%),
    linear-gradient(145deg, rgba(29, 37, 95, .34), transparent 46%);
```

Keep compact anchors inside the visible column:

```css
  --denia-task-background-image-light-compact:
    radial-gradient(ellipse at 72% 4%, rgba(230, 168, 177, .14), transparent 40%),
    radial-gradient(ellipse at 8% 100%, rgba(91, 106, 172, .09), transparent 38%),
    linear-gradient(135deg, rgba(255, 255, 255, .38), transparent 52%);
  --denia-task-background-image-dark-compact:
    radial-gradient(ellipse at 72% 4%, rgba(190, 132, 164, .12), transparent 40%),
    radial-gradient(ellipse at 8% 100%, rgba(46, 59, 126, .28), transparent 42%),
    linear-gradient(145deg, rgba(29, 37, 95, .28), transparent 50%);
```

- [ ] **Step 2: Split body and main painting**

Replace the grouped paint rule with:

```css
html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task:has(main.main-surface:not(.dream-skin-home-shell)) body {
  background-color: var(--denia-task-background-color) !important;
  background-image: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task:has(main.main-surface:not(.dream-skin-home-shell)) main.main-surface:not(.dream-skin-home-shell) {
  background-color: var(--denia-task-background-color) !important;
  background-image: var(--denia-task-background-image) !important;
  background-attachment: scroll !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  background-size: cover !important;
}
```

- [ ] **Step 3: Keep reduced-transparency fallback on both surfaces**

Keep the existing reduced-transparency selector pair, with both surfaces resolving to:

```css
  background-color: var(--denia-task-background-color) !important;
  background-image: none !important;
```

- [ ] **Step 4: Run the validator and verify GREEN**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: `Validated 达妮娅 · 旧日斑斓 extension 0.1.0: 20 required files, removable sidecar protocol.`

### Task 3: Install, inspect, and ship the corrected composition

**Files:**
- Verify: `sidecar/src/denia-old-days-extension.css`
- Verify: `sidecar/tests/validate.mjs`
- Verify: installed Sidecar under `~/Library/Application Support/CodexDreamSkinExtensions/denia-old-days/package`

**Interfaces:**
- Consumes: the completed CSS and static contract.
- Produces: live light/dark screenshots and a verified local Kaboo package.

- [ ] **Step 1: Hot-install the current Sidecar**

Run:

```bash
bash sidecar/scripts/install.sh
```

Expected: installation succeeds and the LaunchAgent is active on port `9341`.

- [ ] **Step 2: Capture and inspect the real light task page**

Run:

```bash
bash sidecar/scripts/verify.sh --screenshot /tmp/denia-content-column-light.png
```

Expected: live verification reports `"pass": true`; the pink, blue-violet, and crystal-blue fields are visible in the content column while the center remains readable.

- [ ] **Step 3: Verify the dark spatial skeleton and restore light**

Temporarily set `data-denia-theme="dark"` through the active CDP target, capture `/tmp/denia-content-column-dark.png`, assert that `main.main-surface` computes to `rgb(15, 19, 59)` with radial gradients, then remove the attribute.

Expected: the dark gradient anchors appear in the same content-column regions and the live page returns to default light afterward.

- [ ] **Step 4: Run full repository verification**

Run:

```bash
git diff --check
npm run check
npm run build:kaboo
bash sidecar/scripts/verify.sh
```

Expected: every command exits zero, live verification reports `"pass": true`, and the build produces `bundle.zip` without missing files or checksum errors.

- [ ] **Step 5: Commit**

```bash
git add sidecar/src/denia-old-days-extension.css sidecar/tests/validate.mjs
git commit -m "fix: move task gradients into content column"
```
