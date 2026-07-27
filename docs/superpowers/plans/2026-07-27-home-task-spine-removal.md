# Home and Task Spine Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every center-spine, center seam, and repeated binding ring from the shared background and Sidecar UI without replacing them or changing layout.

**Architecture:** Treat the decoration as three independent layers: SVG base-theme artwork, viewport chrome CSS, and home-hero CSS. Add source-level negative contracts for each layer, delete the production fragments, regenerate canonical artifacts, then install and verify the local Kaboo package.

**Tech Stack:** SVG, CSS, Node.js ESM validation, Sharp asset rendering, Kaboo CLI

## Global Constraints

- Preserve the paper surfaces, rules, bubbles, hero photo, suggestion cards, composer, and task-state artwork.
- Do not add replacement artwork, download network assets, or alter page geometry.
- Remove the selectors completely, including obsolete responsive overrides.
- Preserve unrelated user files and leave `.superpowers/` untracked.
- Do not restart Codex unless hot installation cannot activate the package and the user explicitly approves a restart.

---

### Task 1: Lock the no-spine contract with failing tests

**Files:**
- Modify: `scripts/check-source.mjs:42-62`
- Modify: `sidecar/tests/validate.mjs:272-279`

**Interfaces:**
- Consumes: `art/source/background.svg`
- Consumes: parsed rules from `sidecar/src/denia-old-days-extension.css`
- Produces: a negative source contract for shared SVG and CSS center-spine decoration

- [ ] **Step 1: Reject the SVG seam and binding-ring fragments**

Add after the existing retired-decoration check:

```js
for (const spineFragment of [
  "M948 145V960",
  "M965 154V953",
  "M923 234c-42-32-42 64 0 32h49c42 32 42-64 0-32z",
]) {
  if (backgroundSource.includes(spineFragment)) {
    throw new Error(`background must not contain a center spine: ${spineFragment}`);
  }
}
```

- [ ] **Step 2: Reject both CSS-generated spines**

Add after `stylesheetRules` is parsed:

```js
for (const selector of [
  ".denia-old-days-ds-chrome::before",
  ".denia-old-days-ds-hero::before",
]) {
  assert(
    !stylesheetRules.some((rule) => rule.selectors.includes(selector)),
    `stylesheet must not define center-spine selector ${selector}`,
  );
}
```

- [ ] **Step 3: Run both checks and confirm RED**

Run:

```bash
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
```

Expected: the source check rejects `M948 145V960`, and the Sidecar validator rejects `.denia-old-days-ds-chrome::before`.

---

### Task 2: Remove the three production decoration layers

**Files:**
- Modify: `art/source/background.svg:45-54`
- Modify: `scripts/render-assets.mjs:148`
- Modify: `scripts/render-assets.mjs:178`
- Modify: `sidecar/src/denia-old-days-extension.css:58-69`
- Modify: `sidecar/src/denia-old-days-extension.css:310-319`
- Modify: `sidecar/src/denia-old-days-extension.css:947-949`
- Modify: `sidecar/src/denia-old-days-extension.css:978-980`

**Interfaces:**
- Removes: base-theme center seam and six binding rings
- Removes: viewport-wide repeated ring pseudo-element
- Removes: home-hero repeated ring pseudo-element

- [ ] **Step 1: Delete the shared SVG spine**

Delete the two center seam `<path>` elements and the complete six-path binding-ring `<g>`. Replace the two separately filled paper panels with one continuous paper surface plus one outer outline so their overlapping inner strokes and gradients cannot leave a residual seam. Keep the outer silhouette and ruled-line group unchanged.

- [ ] **Step 2: Delete preview-only center seams**

Delete the compact and wide center-seam paths from `homeLayoutOverlay` so generated evidence matches the live spineless UI.

- [ ] **Step 3: Delete the Sidecar spine pseudos**

Delete the complete `.denia-old-days-ds-chrome::before` and `.denia-old-days-ds-hero::before` rules.

- [ ] **Step 4: Delete stale responsive overrides**

Delete only the two `display: none` blocks that target those removed pseudo-elements. Keep all neighboring responsive rules unchanged.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run:

```bash
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
```

Expected: both commands exit zero.

- [ ] **Step 6: Commit the source fix**

Run:

```bash
git add art/source/background.svg scripts/render-assets.mjs sidecar/src/denia-old-days-extension.css scripts/check-source.mjs sidecar/tests/validate.mjs
git commit -m "fix: remove global spine decoration"
```

---

### Task 3: Regenerate and record canonical artifacts

**Files:**
- Regenerate: `theme/background.jpg`
- Regenerate: `evidence/home.png`
- Regenerate: `evidence/home-compact.png`
- Modify: `canon/sources.md:44-62`

**Interfaces:**
- Consumes: updated `art/source/background.svg`
- Produces: spineless base-theme image and home evidence at canonical dimensions

- [ ] **Step 1: Regenerate assets**

Run:

```bash
node scripts/render-assets.mjs
```

Expected: asset rendering completes without errors; task-state artwork remains unchanged.

- [ ] **Step 2: Inspect both home previews**

Open `evidence/home.png` and `evidence/home-compact.png`.

Confirm:

- No center seam or repeated ring appears.
- The paper outline, horizontal rules, bubbles, hero text, photo, cards, and composer remain intact.
- No empty central ornament cuts through content.

- [ ] **Step 3: Update canonical hashes**

Run:

```bash
shasum -a 256 art/source/background.svg theme/background.jpg evidence/home.png evidence/home-compact.png
```

Replace the four matching hashes in `canon/sources.md` with the exact output.

- [ ] **Step 4: Run full source validation and build**

Run:

```bash
npm run check
git diff --check
npm run build:kaboo
```

Expected: all commands exit zero and the local catalog is generated under `sidecar/release/kaboo-local/denia-old-days/0.1.0/`.

- [ ] **Step 5: Commit the provenance update**

Run:

```bash
git add canon/sources.md
git commit -m "docs: refresh spineless background provenance"
```

---

### Task 4: Install and verify the live home and task views

**Files:**
- Verify: `sidecar/release/kaboo-local/denia-old-days/0.1.0/catalog-version.json`
- Verify: installed Denia Old Days theme

**Interfaces:**
- Consumes: locally built Kaboo catalog
- Produces: active local theme and live screenshots for review

- [ ] **Step 1: Install the local package**

Run:

```bash
kaboo-cli codex-theme install-local sidecar/release/kaboo-local/denia-old-days/0.1.0/catalog-version.json
kaboo-cli codex-theme verify denia-old-days
```

Expected: installation activates hot and verification succeeds. If installation reports `prepared`, stop and request permission before restarting Codex.

- [ ] **Step 2: Capture the current task view**

Create a bounded temporary directory with `mktemp -d`, then run:

```bash
bash sidecar/scripts/verify.sh --screenshot "$SPINE_VERIFY_DIR/task.png"
```

Confirm the task body and composer contain no center seam or rings while right-side state artwork remains.

- [ ] **Step 3: Capture the home view**

Run:

```bash
bash sidecar/scripts/verify.sh --home --screenshot "$SPINE_VERIFY_DIR/home.png"
```

Confirm the home hero, cards, and composer contain no spine or rings and retain their previous geometry.

- [ ] **Step 4: Run the final repository checks**

Run:

```bash
npm run check
git diff --check
git status --short --branch
```

Expected: validation passes, tracked changes are committed, and only pre-existing untracked `.superpowers/` may remain.
