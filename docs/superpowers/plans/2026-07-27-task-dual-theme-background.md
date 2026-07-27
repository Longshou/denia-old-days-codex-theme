# Denia Task Dual-Theme Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add quiet, character-specific light and dark background variants to task pages while leaving the home page and native task geometry unchanged.

**Architecture:** Define both Denia background palettes as scoped CSS custom properties, activate the light variant by default on task routes, and expose `data-denia-theme="dark"` as the explicit dark-theme interface for the follow-up theme task. Apply the selected palette only to the task-page `body`; static tests enforce selector isolation, exact palette values, responsive restraint, and reduced-transparency fallback.

**Tech Stack:** CSS custom properties and gradients, Node.js static CSS validation, existing Sidecar build and verification scripts.

## Global Constraints

- Only selectors containing `denia-old-days-ds-task` may apply the new background.
- Do not change the home page background, Hero, artwork, layout, or native suggestion-card behavior.
- Do not change task `main`, columns, scroll containers, composer, native cards, or state-art rail geometry.
- Do not add bitmap assets, remote requests, pointer targets, animation, parallax, `filter: blur()`, or repeating patterns.
- Light palette: `#F3EDF2`, `#E6A8B1`, `#5B6AAC`, `#7EC9E2`, `#312C5B`.
- Dark palette: `#0F133B`, `#1D255F`, `#2E3B7E`, `#5671B1`, `#95678F`, `#BE84A4`, `#D4AAC1`.
- The center reading area must remain quieter than the edges.
- Under `prefers-reduced-transparency: reduce`, task backgrounds must use the active solid color and no gradient image.
- The existing five task-art states and their transitions must remain unchanged.

---

### Task 1: Lock the task-background contract with failing tests

**Files:**
- Modify: `sidecar/tests/validate.mjs`
- Test: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: existing `stylesheetRules`, `assertCssDeclarations`, and `findCssRule` helpers.
- Produces: a static contract for light and dark palette variables, task-only application selectors, narrow-screen variants, and reduced-transparency fallback.

- [ ] **Step 1: Add exact palette and selector assertions**

Add the following contract after the existing task-main stacking-context assertions:

```js
const taskBackgroundRootSelector = ".denia-old-days-ds-extension";
const taskBackgroundBodySelector =
  "html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task body";
const taskBackgroundDarkSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]';

assertCssDeclarations(stylesheetRules, taskBackgroundRootSelector, {
  "--denia-task-background-color-light": "#F3EDF2",
  "--denia-task-background-color-dark": "#0F133B",
});
assertCssDeclarations(stylesheetRules, taskBackgroundBodySelector, {
  "background-color": "var(--denia-task-background-color)",
  "background-image": "var(--denia-task-background-image)",
  "background-attachment": "fixed",
  "background-position": "center",
  "background-repeat": "no-repeat",
  "background-size": "cover",
});
assertCssDeclarations(stylesheetRules, taskBackgroundDarkSelector, {
  "--denia-task-background-color": "var(--denia-task-background-color-dark)",
  "--denia-task-background-image": "var(--denia-task-background-image-dark)",
});
assertCssDeclarations(stylesheetRules, taskBackgroundBodySelector, {
  "background-image": "none",
}, ["prefers-reduced-transparency: reduce"]);

for (const rule of stylesheetRules) {
  if (![...rule.declarations.keys()].some((name) => name.startsWith("--denia-task-background"))) continue;
  if (rule.selectors.includes(taskBackgroundRootSelector)) continue;
  assert(
    rule.selectors.every((selector) => selector.includes(".denia-old-days-ds-task")),
    "task background activation must stay scoped to task routes",
  );
}

const taskBackgroundValues = stylesheetRules
  .flatMap((rule) => [...rule.declarations.entries()])
  .filter(([name]) => name.startsWith("--denia-task-background"))
  .map(([, value]) => value)
  .join(" ");
for (const forbidden of ["url(", "repeating-", "filter(", "animation"]) {
  assert(!taskBackgroundValues.includes(forbidden), `task background must not use ${forbidden}`);
}
```

- [ ] **Step 2: Run the Sidecar validator and confirm the new contract fails**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL because `--denia-task-background-color-light` and the task background selectors do not exist.

- [ ] **Step 3: Commit the failing contract**

```bash
git add sidecar/tests/validate.mjs
git commit -m "test: define dual-theme task background contract"
```

### Task 2: Implement both character-specific background variants

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.css`
- Test: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: the contract introduced in Task 1.
- Produces: `--denia-task-background-color`, `--denia-task-background-image`, and the future-facing `data-denia-theme="dark"` activation interface.

- [ ] **Step 1: Add light, dark, and compact gradient variables**

Extend `.denia-old-days-ds-extension` with the following variables:

```css
  --denia-task-background-color-light: #F3EDF2;
  --denia-task-background-image-light:
    radial-gradient(ellipse at 92% 8%, rgba(230, 168, 177, .22), rgba(230, 168, 177, .07) 24%, transparent 48%),
    radial-gradient(ellipse at 6% 92%, rgba(91, 106, 172, .14), transparent 44%),
    radial-gradient(circle at 82% 82%, rgba(126, 201, 226, .1), transparent 24%),
    radial-gradient(circle at 10% 10%, rgba(49, 44, 91, .055), transparent 18%),
    linear-gradient(135deg, rgba(255, 255, 255, .44), transparent 48%);
  --denia-task-background-image-light-compact:
    radial-gradient(ellipse at 100% 4%, rgba(230, 168, 177, .14), transparent 42%),
    radial-gradient(ellipse at 0 100%, rgba(91, 106, 172, .09), transparent 40%),
    linear-gradient(135deg, rgba(255, 255, 255, .38), transparent 52%);
  --denia-task-background-color-dark: #0F133B;
  --denia-task-background-image-dark:
    radial-gradient(ellipse at 92% 8%, rgba(190, 132, 164, .18), rgba(149, 103, 143, .06) 24%, transparent 48%),
    radial-gradient(ellipse at 6% 92%, rgba(46, 59, 126, .46), transparent 48%),
    radial-gradient(circle at 82% 82%, rgba(86, 113, 177, .18), transparent 26%),
    radial-gradient(circle at 10% 10%, rgba(149, 103, 143, .12), transparent 20%),
    radial-gradient(circle at 94% 88%, rgba(212, 170, 193, .1), transparent 6%),
    linear-gradient(145deg, rgba(29, 37, 95, .34), transparent 46%);
  --denia-task-background-image-dark-compact:
    radial-gradient(ellipse at 100% 4%, rgba(190, 132, 164, .12), transparent 42%),
    radial-gradient(ellipse at 0 100%, rgba(46, 59, 126, .28), transparent 44%),
    linear-gradient(145deg, rgba(29, 37, 95, .28), transparent 50%);
```

- [ ] **Step 2: Add task-only activation and body paint**

Add the scoped rules directly after the shared `body::before` rule:

```css
html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task {
  --denia-task-background-color: var(--denia-task-background-color-light);
  --denia-task-background-image: var(--denia-task-background-image-light);
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"] {
  --denia-task-background-color: var(--denia-task-background-color-dark);
  --denia-task-background-image: var(--denia-task-background-image-dark);
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task body {
  background-color: var(--denia-task-background-color);
  background-image: var(--denia-task-background-image);
  background-attachment: fixed;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task body::before {
  background: none;
}
```

- [ ] **Step 3: Add narrow-screen palette reduction**

Inside `@media (max-width: 919px)`, add:

```css
  html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task {
    --denia-task-background-image: var(--denia-task-background-image-light-compact);
  }

  html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"] {
    --denia-task-background-image: var(--denia-task-background-image-dark-compact);
  }
```

- [ ] **Step 4: Add reduced-transparency fallback**

Inside `@media (prefers-reduced-transparency: reduce)`, add:

```css
  html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task body {
    background-color: var(--denia-task-background-color);
    background-image: none;
  }
```

- [ ] **Step 5: Run the validator**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: PASS with the existing “Validated 达妮娅 · 旧日斑斓 extension 0.1.0” summary.

- [ ] **Step 6: Commit the implementation**

```bash
git add sidecar/src/denia-old-days-extension.css
git commit -m "feat: add Denia dual-theme task backgrounds"
```

### Task 3: Document the final interface and verify the deliverable

**Files:**
- Modify: `docs/current-theme-design.md`
- Modify: `docs/superpowers/specs/2026-07-27-task-dual-theme-background-design.md`
- Verify: `sidecar/src/denia-old-days-extension.css`
- Verify: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: `data-denia-theme="dark"` and the task background custom properties from Task 2.
- Produces: maintained documentation and full validation evidence.

- [ ] **Step 1: Update current theme documentation**

Add to the task-page section:

```markdown
- 任务正文背景使用达妮娅双形态色板：默认浅色为珠光粉白、发色粉、蓝紫与晶体蓝；`data-denia-theme="dark"` 使用虚空海军蓝、靛蓝、钴蓝和克制粉紫。
- 背景只使用静态柔焦渐变，正文中心保持低干扰；不使用人物、手账、具象花朵、位图、动画或重复纹理。
```

- [ ] **Step 2: Clarify dark-theme activation timing in the design spec**

Replace the ambiguous system-preference fallback statement with:

```markdown
本次实现以 `data-denia-theme="dark"` 作为显式接口，默认仍使用浅色背景。系统深色偏好不会单独切换背景，避免在完整深色内容表面尚未接入时出现深色背景与浅色正文混用；后续双主题任务统一维护该属性。
```

- [ ] **Step 3: Run source and Sidecar checks**

Run:

```bash
npm run check
```

Expected: `source structure ok` followed by the Sidecar validation success summary.

- [ ] **Step 4: Build the local Kaboo release**

Run:

```bash
npm run build:kaboo
```

Expected: a successful local package under `sidecar/release/kaboo-local/` with no missing asset or checksum errors.

- [ ] **Step 5: Audit scope and palette**

Run:

```bash
git diff --check
rg -n "denia-task-background|data-denia-theme" sidecar/src/denia-old-days-extension.css sidecar/tests/validate.mjs docs/current-theme-design.md
rg -n "denia-task-background|data-denia-theme" sidecar/src/denia-old-days-extension.js sidecar/runtime/loader.mjs
```

Expected:

- The first command is silent.
- The second command shows the CSS contract, tests, and documentation.
- The third command is silent because this task adds no runtime DOM behavior.

- [ ] **Step 6: Commit documentation**

```bash
git add docs/current-theme-design.md docs/superpowers/specs/2026-07-27-task-dual-theme-background-design.md
git commit -m "docs: document Denia task background themes"
```

