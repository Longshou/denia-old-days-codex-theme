# Denia State Art Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the empty or overpowering task-state rail with three curated, locally packaged Denia art crops whose composition, text cleanliness, and facial emotion match the five Codex task states.

**Architecture:** Keep the native Codex work area light and reserve a fixed right rail on task pages. The loader packages one existing homepage image plus three state-specific WebP crops; the runtime converts them to object URLs and drives a two-layer `current`/`next` rail with state-aware opacity, tint, and interruptible crossfades. The offline renderer uses the same crops and state mapping to produce review screenshots.

**Tech Stack:** Vanilla JavaScript runtime, native CSS, Node.js validation scripts, bundled Sharp for deterministic asset rendering, shell packaging.

## Global Constraints

- Work only in `/Users/bytedance/ByteDance/workspace/denia-old-days-codex-theme/.worktrees/official-art-revision` on branch `feat/official-art-revision`.
- Keep the main task workspace light; dark styling is restricted to the fixed right rail and existing state tokens.
- Do not use character PV or combat-demo frames. Preserve `old-days-bright-102s.jpg` only as the approved homepage story exception.
- Use `denia-garden-bubbles-warm.jpg` for `staged` and `working`, `denia-dark-direct-gaze.jpg` for `approval` and `error`, and a text-free crop of `denia-anniversary-direct-gaze.jpg` for `complete`.
- Preserve `denia-dual-form-panorama.jpg` as a complete `wide-scene` source; do not squeeze it into the rail.
- Stable states must have one focal face. Promotional text may not enter the effective crop. Error art may not smile.
- Runtime assets must be local WebP files smaller than 1 MiB each. No injected runtime network requests.
- Rail width is `clamp(280px, 20vw, 320px)` at `>=1180px`, `220px-260px` at `920px-1179px`, and hidden below `920px`.
- Motion may animate only `opacity`, `transform`, and `filter`, must settle within `900ms`, and must honor reduced motion and reduced transparency.
- Keep existing state priority `error > approval > working > complete > staged`.
- Do not upload to Kaboo Registry or any remote repository.

---

### Task 1: Register the curated official source files

**Files:**
- Create: `art/source/official/denia-garden-bubbles-warm.jpg`
- Create: `art/source/official/denia-dark-direct-gaze.jpg`
- Create: `art/source/official/denia-anniversary-direct-gaze.jpg`
- Create: `art/source/official/denia-dual-form-panorama.jpg`
- Modify: `scripts/check-source.mjs`
- Modify: `canon/sources.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: curated files from `/Users/bytedance/ByteDance/workspace/denia-visual-library/production-ready/`.
- Produces: immutable, hash-checked build sources consumed by `scripts/render-assets.mjs`.

- [ ] **Step 1: Write the failing source-hash assertions**

Add these entries to `officialSources` in `scripts/check-source.mjs`:

```js
["art/source/official/denia-garden-bubbles-warm.jpg", "481bf5ff8fa4f54d5b696f6144fb3f6a7d3b2d8b580cf2a5baee39409110489b"],
["art/source/official/denia-dark-direct-gaze.jpg", "aae25be7ff9670c43a8f36a4019fa445c28fb51c57f69a477c008277bc197292"],
["art/source/official/denia-anniversary-direct-gaze.jpg", "dea27e716f9561131e2b5255ea60a84de2512e8e81886073f09c64e02739fc6e"],
["art/source/official/denia-dual-form-panorama.jpg", "646b290ae6a7584ce617cad85976f5caa6ae74e6d6678cd86a17a028266648b5"],
```

- [ ] **Step 2: Run the source check and verify it fails**

Run:

```bash
node scripts/check-source.mjs
```

Expected: failure reading the first missing curated source.

- [ ] **Step 3: Copy the four exact originals into the repository**

Copy by exact filename from the visual library. Do not resize or overwrite the visual-library originals.

- [ ] **Step 4: Document source provenance and layout intent**

Update `canon/sources.md` and `README.md` with dimensions, hashes, the official illustration index, the official anniversary post, the no-PV rule, and the `rail-portrait`/`wide-scene` split.

- [ ] **Step 5: Run the source check and verify it passes**

Run:

```bash
node scripts/check-source.mjs
```

Expected: `source structure ok`.

- [ ] **Step 6: Commit**

```bash
git add README.md canon/sources.md scripts/check-source.mjs art/source/official
git commit -m "assets: add curated Denia published artwork"
```

---

### Task 2: Generate text-free rail assets and matching evidence

**Files:**
- Modify: `scripts/render-assets.mjs`
- Modify: `scripts/check-source.mjs`
- Modify: `canon/sources.md`
- Generated and ignored: `sidecar/assets/denia-task-warm.webp`
- Generated and ignored: `sidecar/assets/denia-task-dark.webp`
- Generated and ignored: `sidecar/assets/denia-task-complete.webp`
- Generated and ignored: `evidence/task-staged.png`
- Generated and ignored: `evidence/task.png`
- Generated and ignored: `evidence/task-approval.png`
- Generated and ignored: `evidence/task-error.png`
- Generated and ignored: `evidence/task-complete.png`

**Interfaces:**
- Consumes: source files registered in Task 1 and `KABOO_SHARP_ENTRY`.
- Produces: three runtime WebP rail crops and five 1600x1000 state screenshots.

- [ ] **Step 1: Write failing generated-file and renderer assertions**

Extend `scripts/check-source.mjs` so `generatedFiles` requires the three new WebPs and `task-staged.png`, and so the renderer markers require:

```js
"TASK_RAIL_SOURCES",
"renderTaskRail",
"evidence/task-staged.png",
"denia-task-warm.webp",
"denia-task-dark.webp",
"denia-task-complete.webp",
```

Reject the old runtime rail source:

```js
if (rendererSource.includes('target: "sidecar/assets/denia-old-days-dark.webp"')) {
  throw new Error("renderer must not package the retired poster rail");
}
```

- [ ] **Step 2: Run the source check and verify it fails**

Expected: missing new generated runtime assets.

- [ ] **Step 3: Add deterministic crop specifications**

Define:

```js
const TASK_RAIL_SOURCES = Object.freeze({
  warm: {
    source: "official/denia-garden-bubbles-warm.jpg",
    extract: { left: 245, top: 0, width: 346, height: 1080 },
    target: "sidecar/assets/denia-task-warm.webp",
  },
  dark: {
    source: "official/denia-dark-direct-gaze.jpg",
    extract: { left: 1530, top: 0, width: 691, height: 2160 },
    target: "sidecar/assets/denia-task-dark.webp",
  },
  complete: {
    source: "official/denia-anniversary-direct-gaze.jpg",
    extract: { left: 330, top: 100, width: 464, height: 1450 },
    target: "sidecar/assets/denia-task-complete.webp",
  },
});
```

Render each crop to `640x2000` WebP with `fit: "cover"`, quality `86`, and `smartSubsample: true`. The complete extract ends above the anniversary banner.

- [ ] **Step 4: Replace the old preview rail mapping**

Use:

```js
const TASK_STATE_ART = Object.freeze({
  staged: { family: "warm", opacity: 0.11, tint: "rgba(255,250,246,.12)" },
  working: { family: "warm", opacity: 0.20, tint: "rgba(115,206,217,.08)" },
  approval: { family: "dark", opacity: 0.43, tint: "rgba(117,86,217,.12)" },
  error: { family: "dark", opacity: 0.56, tint: "rgba(228,90,168,.18)" },
  complete: { family: "complete", opacity: 0.28, tint: "rgba(229,197,111,.10)" },
});
```

Reserve a `320px` rail beginning at `x=1280`; keep task content left of `x=1248`. Apply the same one-way left fade in every state.

- [ ] **Step 5: Render assets**

Run:

```bash
KABOO_SHARP_ENTRY="/Applications/Codex.app/Contents/Resources/cua_node/lib/node_modules/sharp/lib/index.js" node scripts/render-assets.mjs
```

Expected: all runtime WebPs are non-empty and below 1 MiB; five task-state screenshots are written.

- [ ] **Step 6: Inspect all five screenshots**

Verify:

- warm states contain no bottom-right game logo;
- approval/error show the same unsmiling face and no anniversary headline;
- complete contains no anniversary banner or copyright line;
- rail art does not cover the composer or task cards;
- eyes remain in the same upper visual band.

- [ ] **Step 7: Re-run the source check**

Expected: `source structure ok`.

- [ ] **Step 8: Commit**

```bash
git add scripts/render-assets.mjs scripts/check-source.mjs canon/sources.md
git commit -m "build: render emotion-matched state rail assets"
```

---

### Task 3: Package and preload the three rail images

**Files:**
- Modify: `sidecar/extension.json`
- Modify: `sidecar/runtime/loader.mjs`
- Modify: `sidecar/src/denia-old-days-extension.js`
- Test: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: `assets/denia-task-warm.webp`, `assets/denia-task-dark.webp`, `assets/denia-task-complete.webp`.
- Produces: four private object URLs and four root CSS variables, including the existing homepage image.

- [ ] **Step 1: Write failing manifest, token, and lifecycle assertions**

Replace the legacy `stateArtwork` expectation with:

```js
const expectedAssets = {
  runtimeWallpaper: "assets/denia-old-days-bright.webp",
  taskWarmArtwork: "assets/denia-task-warm.webp",
  taskDarkArtwork: "assets/denia-task-dark.webp",
  taskCompleteArtwork: "assets/denia-task-complete.webp",
};
```

Require one runtime/loader token for each image and require the object URL map to contain:

```text
bright,taskWarm,taskDark,taskComplete
```

Require install, reinstall, and cleanup to create, set, remove, and revoke exactly four art URLs per install.

- [ ] **Step 2: Run the Sidecar validator and verify it fails**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: `unexpected taskWarmArtwork`.

- [ ] **Step 3: Extend the manifest and loader**

Add three task asset keys. Resolve, realpath-check, read, encode, stage, and substitute all three new files with unique placeholders and sentinels.

- [ ] **Step 4: Extend runtime artwork lifecycle**

Create:

```js
const artUrls = Object.freeze({
  bright: dataUrlToObjectUrl(brightArtDataUrl),
  taskWarm: dataUrlToObjectUrl(taskWarmArtDataUrl),
  taskDark: dataUrlToObjectUrl(taskDarkArtDataUrl),
  taskComplete: dataUrlToObjectUrl(taskCompleteArtDataUrl),
});
```

Set and later remove:

```text
--denia-old-days-art-bright
--denia-old-days-art-task-warm
--denia-old-days-art-task-dark
--denia-old-days-art-task-complete
```

Keep URLs private, revoke every URL on reinstall and cleanup, and keep `artReady` false unless all four succeed.

- [ ] **Step 5: Run the validator and verify it passes this task**

Expected: artwork lifecycle assertions pass; later rail assertions may still fail.

- [ ] **Step 6: Commit**

```bash
git add sidecar/extension.json sidecar/runtime/loader.mjs sidecar/src/denia-old-days-extension.js sidecar/tests/validate.mjs
git commit -m "feat: preload curated Denia state artwork"
```

---

### Task 4: Implement the fixed two-layer state rail

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.js`
- Modify: `sidecar/src/denia-old-days-extension.css`
- Modify: `sidecar/runtime/loader.mjs`
- Test: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: root art variables from Task 3 and `deriveFormState()`.
- Produces: `ensureStateArt()`, `syncStateArt(formState)`, fixed rail DOM, crossfade behavior, and live-verification evidence.

- [ ] **Step 1: Write failing runtime and CSS assertions**

Require:

```text
#denia-old-days-ds-state-art
.denia-old-days-ds-state-art-current
.denia-old-days-ds-state-art-next
.denia-old-days-ds-state-art-tint
ensureStateArt
syncStateArt
transitionend
```

Require the rail to use `clamp(280px, 20vw, 320px)`, a left separator/fade, fixed eye-anchor crops, and `pointer-events: none`. Assert these target state opacities:

```text
staged .11
working .20
approval .43
error .56
complete .28
```

Assert `approval` and `error` resolve to the same `taskDark` family. Assert the old `chrome::after` artwork rail is absent.

- [ ] **Step 2: Run the validator and verify it fails**

Expected: missing state-art DOM/CSS assertion.

- [ ] **Step 3: Create the rail once**

`ensureStateArt()` appends this structure inside chrome without rebuilding it during refresh:

```html
<div id="denia-old-days-ds-state-art" class="denia-old-days-ds-state-art" aria-hidden="true">
  <span class="denia-old-days-ds-state-art-current"></span>
  <span class="denia-old-days-ds-state-art-next"></span>
  <span class="denia-old-days-ds-state-art-tint"></span>
</div>
```

Store current/next layer references and a numeric art generation in private runtime state. Do not expose object URLs.

- [ ] **Step 4: Implement interruptible state synchronization**

Use one mapping:

```js
const stateArtSpecs = Object.freeze({
  staged: { family: "taskWarm", opacity: ".11" },
  working: { family: "taskWarm", opacity: ".20" },
  approval: { family: "taskDark", opacity: ".43" },
  error: { family: "taskDark", opacity: ".56" },
  complete: { family: "taskComplete", opacity: ".28" },
});
```

For the same family, update opacity/tint without changing the image. For a new family, configure the inactive layer, increment the generation, crossfade using CSS classes, and clear the old layer only from `transitionend` when it is no longer current. Do not use a transition cleanup timeout or animation lock. Under reduced motion, swap immediately.

- [ ] **Step 5: Implement the visual separation**

Use a fixed right rail with:

- a `1px` low-contrast left border;
- a `32px-48px` one-way mask/fade on the rail, not on the work area;
- a restrained warm paper backing;
- per-state tint in the tint layer;
- outgoing `240ms` fade and incoming `420ms` fade, total state settling below `900ms`;
- no looping glitch or particle animation.

Apply main content padding only at task breakpoints:

```css
@media (min-width: 1180px) {
  .denia-old-days-ds-task [role="main"],
  .denia-old-days-ds-task main {
    padding-inline-end: calc(var(--denia-state-rail-width) + 24px) !important;
  }
}
```

Use a `220px-260px` rail and `16px` safety gap at `920px-1179px`. Hide the rail and remove reserved padding below `920px`.

- [ ] **Step 6: Update live verification**

Inspect the real rail element instead of `chrome::after`. Require a visible rail in every task state above `919px`, the state family expected by the current form state, no horizontal overflow, and a complete-state final card.

- [ ] **Step 7: Run the full Sidecar validator**

Expected: all assertions pass with no warnings.

- [ ] **Step 8: Commit**

```bash
git add sidecar/src/denia-old-days-extension.js sidecar/src/denia-old-days-extension.css sidecar/runtime/loader.mjs sidecar/tests/validate.mjs
git commit -m "feat: add fixed emotion-aware task art rail"
```

---

### Task 5: Complete accessibility, packaging, and visual review

**Files:**
- Modify if needed: `sidecar/src/denia-old-days-extension.css`
- Modify if needed: `sidecar/src/denia-old-days-extension.js`
- Modify: `sidecar/README.md`
- Modify: `canon/sources.md`

**Interfaces:**
- Consumes: complete implementation from Tasks 1-4.
- Produces: verified local package and user-review screenshots; no remote upload.

- [ ] **Step 1: Verify reduced-motion and reduced-transparency behavior**

Confirm reduced motion removes crossfade delay/transform and directly shows the target layer. Confirm reduced transparency replaces rail glass with a solid backing and preserves text contrast.

- [ ] **Step 2: Run syntax and source verification**

```bash
node --check sidecar/src/denia-old-days-extension.js
node --check sidecar/runtime/loader.mjs
node scripts/check-source.mjs
```

- [ ] **Step 3: Run the full Sidecar validator**

```bash
node sidecar/tests/validate.mjs sidecar
```

- [ ] **Step 4: Build the local package**

```bash
bash sidecar/package.sh
```

Expected: local release zip created; no remote action.

- [ ] **Step 5: Inspect all generated screenshots**

Review `home.png`, `home-compact.png`, `task-staged.png`, `task.png`, `task-approval.png`, `task-error.png`, and `task-complete.png`. Re-run the renderer after any crop or tint adjustment.

- [ ] **Step 6: Run the frontend pre-flight audit**

Check the applicable redesign items:

- design read and `5/5/5` dials remain accurate;
- one light page theme, with dark emotion isolated to the rail;
- one radius system and restrained shadows;
- no visible em-dash characters added;
- no promotional text inside any rail crop;
- no smiling error image;
- no content overlap at desktop, medium, and narrow widths;
- motion communicates state change, uses only opacity/transform/filter, and honors reduced motion;
- no new network request or dependency;
- cleanup removes DOM, CSS variables, listeners, and object URLs.

- [ ] **Step 7: Commit documentation or final refinements**

```bash
git add sidecar/README.md canon/sources.md sidecar/src sidecar/runtime sidecar/tests scripts README.md
git commit -m "docs: record Denia state rail verification"
```

- [ ] **Step 8: Stop at local experience handoff**

Keep the feature branch and worktree intact. Do not merge, push, create a PR, or upload to Registry. Provide the user with the local install/start command and the generated screenshots for testing.
