# Denia Approval and Error Art Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give approval and error independent official Denia artwork so approval shows both forms waiting for a decision while error shows a separate unsmiling, disrupted composition.

**Architecture:** Add two immutable official source files, render deterministic `640×2000` offline WebP rail crops, and replace the shared `taskDark` runtime family with `taskApproval` and `taskError`. Keep the existing two-layer rail and state detector; the new families make `approval → error` a real interruptible crossfade while the offline renderer and live validator verify the same mapping.

**Tech Stack:** Vanilla JavaScript, native CSS, Node.js validation and VM fixtures, bundled Sharp, shell packaging.

## Global Constraints

- Work only in `/Users/bytedance/ByteDance/workspace/denia-old-days-codex-theme/.worktrees/official-art-revision` on branch `feat/official-art-revision`.
- Approval source is the official `1871×3327` anniversary image `HIWo1PrbMAA7jS-.jpg`, SHA-256 `3339a65536eb6b8cff762f4ac441df6358e857c8b25f0ddaecbade8e457f84c0`.
- Error source is the official `1920×1080` anniversary illustration `HJIw0-rbcAAU68K.jpg`, SHA-256 `42c2a49b83de911a01627501875e6df992ac26da556c90b2c64433883eb353f4`.
- Approval must keep the bright foreground face readable and the dark-form gaze recognizable; error must keep the face and reaching hand while showing no smile.
- Official marks, illustration-frame text, signatures, copyright lines, and white outer frames may not enter either effective rail crop.
- Keep the task work area light and visually separate from the fixed right rail.
- Preserve the rail width and breakpoints: `clamp(280px, 20vw, 320px)` at `>=1180px`, compact rail at `920px–1179px`, hidden below `920px`.
- Runtime artwork must stay local, use no new dependency or network request, and remain below `1 MiB` per WebP.
- Preserve state priority `error > approval > working > complete > staged`.
- `working → approval` must settle in `220–320ms`; `approval → error` must use a real cross-image transition in `180–240ms`.
- Reduced motion removes movement and swaps opacity in at most `120ms`; error uses no looping glitch, shake, or flash.
- Preserve existing home, staged, working, and complete artwork behavior.
- Do not push, merge, create a PR, or upload to Kaboo Registry.

---

### Task 1: Register the selected official approval and error sources

**Files:**
- Create: `art/source/official/denia-approval-dual-form.jpg`
- Create: `art/source/official/denia-error-reaching.jpg`
- Modify: `scripts/check-source.mjs`
- Modify: `canon/sources.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the two selected files in `/Users/bytedance/ByteDance/workspace/denia-visual-library/source-media/official-published-x/`.
- Produces: immutable hash-checked source paths consumed by `TASK_RAIL_SOURCES` in Task 2.

- [ ] **Step 1: Add failing source-hash assertions**

Add these exact entries to `officialSources` in `scripts/check-source.mjs`:

```js
["art/source/official/denia-approval-dual-form.jpg", "3339a65536eb6b8cff762f4ac441df6358e857c8b25f0ddaecbade8e457f84c0"],
["art/source/official/denia-error-reaching.jpg", "42c2a49b83de911a01627501875e6df992ac26da556c90b2c64433883eb353f4"],
```

- [ ] **Step 2: Run the source check and verify it fails**

Run:

```bash
node scripts/check-source.mjs
```

Expected: non-zero exit while reading `art/source/official/denia-approval-dual-form.jpg`.

- [ ] **Step 3: Copy the two exact binary sources**

Run:

```bash
/bin/cp /Users/bytedance/ByteDance/workspace/denia-visual-library/source-media/official-published-x/HIWo1PrbMAA7jS-.jpg art/source/official/denia-approval-dual-form.jpg
/bin/cp /Users/bytedance/ByteDance/workspace/denia-visual-library/source-media/official-published-x/HJIw0-rbcAAU68K.jpg art/source/official/denia-error-reaching.jpg
```

Do not resize or overwrite the visual-library copies.

- [ ] **Step 4: Document provenance and state responsibilities**

Add `Approval rail` and `Error rail` rows to `canon/sources.md` with the exact dimensions and hashes from Global Constraints. Update `README.md` so the state-art summary reads:

```markdown
- 审批侧栏：官方周年双形态竖幅贺图，保留明色正脸与上方暗色注视，表达等待用户决定。
- 错误侧栏：官方周年插画展发布图，保留无笑意正脸与伸手动作，表达秩序失衡。
```

Remove statements that approval and error share one dark image.

- [ ] **Step 5: Run the source check and verify it passes**

Run:

```bash
node scripts/check-source.mjs
```

Expected: `source structure ok`.

- [ ] **Step 6: Commit the source registration**

```bash
git add art/source/official/denia-approval-dual-form.jpg art/source/official/denia-error-reaching.jpg scripts/check-source.mjs canon/sources.md README.md
git commit -m "assets: add separate Denia approval and error art"
```

---

### Task 2: Render independent rail assets and evidence

**Files:**
- Modify: `scripts/render-assets.mjs`
- Modify: `scripts/check-source.mjs`
- Generated and ignored: `sidecar/assets/denia-task-approval.webp`
- Generated and ignored: `sidecar/assets/denia-task-error.webp`
- Generated and ignored: `evidence/task-approval.png`
- Generated and ignored: `evidence/task-error.png`
- Generated and ignored: `evidence/task-working-to-approval-350ms.png`
- Generated and ignored: `evidence/task-error-to-complete-500ms.png`

**Interfaces:**
- Consumes: `art/source/official/denia-approval-dual-form.jpg` and `art/source/official/denia-error-reaching.jpg`.
- Produces: `640×2000` WebPs used by the Sidecar plus `1600×1000` static and transition evidence used in visual review.

- [ ] **Step 1: Add failing generated-file and renderer assertions**

Replace the retired dark output in `generatedFiles` with:

```js
"sidecar/assets/denia-task-approval.webp",
"sidecar/assets/denia-task-error.webp",
```

Add:

```js
"evidence/task-working-to-approval-350ms.png",
"evidence/task-error-to-complete-500ms.png",
```

Add both evidence files to `expectedDimensions` with `[1600, 1000]`. Require these renderer markers:

```js
"denia-task-approval.webp",
"denia-task-error.webp",
"renderTaskTransition",
"evidence/task-working-to-approval-350ms.png",
"evidence/task-error-to-complete-500ms.png",
```

Reject the retired output:

```js
if (rendererSource.includes('target: "sidecar/assets/denia-task-dark.webp"')) {
  throw new Error("renderer must not retain the shared approval/error rail asset");
}
```

- [ ] **Step 2: Run the source check and verify it fails**

Run:

```bash
node scripts/check-source.mjs
```

Expected: failure with `renderer missing denia-task-approval.webp`.

- [ ] **Step 3: Split `TASK_RAIL_SOURCES` into semantic families**

Keep the existing `warm` and `complete` entries, remove `dark`, and add:

```js
approval: {
  source: "official/denia-approval-dual-form.jpg",
  extract: { left: 470, top: 220, width: 896, height: 2800 },
  target: "sidecar/assets/denia-task-approval.webp",
},
error: {
  source: "official/denia-error-reaching.jpg",
  extract: { left: 1040, top: 80, width: 288, height: 900 },
  target: "sidecar/assets/denia-task-error.webp",
},
```

Continue rendering every entry with:

```js
.resize(640, 2000, { fit: "cover", position: "centre" })
.webp({ quality: 86, smartSubsample: true })
```

After rendering, remove the obsolete generated file:

```js
await fs.rm(output("sidecar/assets/denia-task-dark.webp"), { force: true });
```

- [ ] **Step 4: Make the offline state mapping match the approved design**

Replace only the approval and error entries in `TASK_STATE_ART`:

```js
approval: {
  family: "approval",
  opacity: 0.43,
  tint: "rgba(117,86,217,.12)",
  observation: "等待确认 / APPROVAL",
  page: "当前页 / 等待确认",
  pill: "双形之页 / 等待决定",
  accent: "#866cdb",
},
error: {
  family: "error",
  opacity: 0.56,
  tint: "rgba(228,90,168,.18)",
  modulate: { brightness: 0.92, saturation: 1.04 },
  linear: { gain: 1.08, offset: -8 },
  observation: "异常记录 / ERROR",
  page: "当前页 / 检查失败项",
  pill: "幻灭之形 / 检查中",
  accent: "#d45a95",
},
```

Do not carry the retired error-only `scale: 1.055` or `shiftX: -7`; the new composition supplies the visual difference.

- [ ] **Step 5: Extract one reusable rail renderer and add transition evidence**

Move the panel-building portion of `renderTaskPreview` into:

```js
async function renderTaskRailPanel(state) {
  const spec = TASK_STATE_ART[state];
  const panelWidth = 320;
  let stagePipeline = sharp(output(TASK_RAIL_SOURCES[spec.family].target))
    .resize(panelWidth, 1000, { fit: "cover", position: "centre" });
  if (spec.modulate) stagePipeline = stagePipeline.modulate(spec.modulate);
  if (spec.linear) stagePipeline = stagePipeline.linear(spec.linear.gain, spec.linear.offset);
  const stage = await stagePipeline.ensureAlpha(spec.opacity).png().toBuffer();
  const panelBacking = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${panelWidth}" height="1000">
      <rect width="${panelWidth}" height="1000" fill="#f5eeee"/>
    </svg>`);
  const panelOverlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${panelWidth}" height="1000">
      <defs>
        <linearGradient id="panel-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#eef9f8"/>
          <stop offset=".12" stop-color="#eef9f8" stop-opacity=".82"/>
          <stop offset=".28" stop-color="#eef9f8" stop-opacity=".24"/>
          <stop offset=".46" stop-color="#eef9f8" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="${panelWidth}" height="1000" fill="${spec.tint}"/>
      ${state === "complete"
        ? '<radialGradient id="paper-fog" cx="92%" cy="92%" r="36%"><stop offset="0" stop-color="#f7eee9" stop-opacity=".34"/><stop offset="1" stop-color="#f7eee9" stop-opacity="0"/></radialGradient><rect width="320" height="1000" fill="url(#paper-fog)"/>'
        : ""}
      <rect width="${panelWidth}" height="1000" fill="url(#panel-fade)"/>
      <path d="M1 0V1000" stroke="${state === "error" ? "#e45aa8" : "#73ced9"}"
        stroke-opacity="${state === "error" ? ".32" : ".28"}"/>
    </svg>`);
  return sharp(panelBacking)
    .composite([
      { input: stage, left: 0, top: 0 },
      { input: panelOverlay, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}
```

Make `renderTaskPreview(state)` composite the returned panel at `left: 1280`. Add:

```js
async function renderTaskTransition(fromState, toState, progress) {
  const fromPreview = await renderTaskPreview(fromState);
  const toRail = await renderTaskRailPanel(toState);
  const fadedRail = await sharp(toRail)
    .removeAlpha()
    .ensureAlpha(progress)
    .png()
    .toBuffer();
  return sharp(fromPreview)
    .composite([{ input: fadedRail, left: 1280, top: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
```

Generate:

```js
const [taskWorkingToApproval, taskErrorToComplete] = await Promise.all([
  renderTaskTransition("working", "approval", 0.82),
  renderTaskTransition("error", "complete", 0.92),
]);
await Promise.all([
  sharp(taskWorkingToApproval).toFile(output("evidence/task-working-to-approval-350ms.png")),
  sharp(taskErrorToComplete).toFile(output("evidence/task-error-to-complete-500ms.png")),
]);
```

- [ ] **Step 6: Render and inspect the outputs**

Run:

```bash
KABOO_SHARP_ENTRY="/Applications/Codex.app/Contents/Resources/cua_node/lib/node_modules/sharp/lib/index.js" node scripts/render-assets.mjs
```

Expected: fifteen generated assets, both new WebPs below `1 MiB`, and both transition PNGs at `1600×1000`.

Inspect `task-approval.png`, `task-error.png`, and both transition PNGs. Reject the crop if either source’s external text or frame enters the rail, if the approval dark-form gaze is unreadable, or if the error face/hand is lost.

- [ ] **Step 7: Re-run the source check**

Run:

```bash
node scripts/check-source.mjs
```

Expected: `source structure ok`.

- [ ] **Step 8: Commit the render pipeline**

```bash
git add scripts/render-assets.mjs scripts/check-source.mjs
git commit -m "build: render distinct approval and error rails"
```

---

### Task 3: Package and crossfade five artwork families

**Files:**
- Modify: `sidecar/extension.json`
- Modify: `sidecar/runtime/loader.mjs`
- Modify: `sidecar/src/denia-old-days-extension.js`
- Modify: `sidecar/src/denia-old-days-extension.css`
- Test: `sidecar/tests/validate.mjs`

**Interfaces:**
- Consumes: `assets/denia-task-approval.webp` and `assets/denia-task-error.webp`.
- Produces: five private object URLs, five root artwork variables, separate `taskApproval`/`taskError` families, and a real approval-to-error crossfade.

- [ ] **Step 1: Write failing manifest, token, mapping, CSS, and lifecycle assertions**

Use this expected manifest asset map:

```js
const expectedAssets = {
  runtimeWallpaper: "assets/denia-old-days-bright.webp",
  taskWarmArtwork: "assets/denia-task-warm.webp",
  taskApprovalArtwork: "assets/denia-task-approval.webp",
  taskErrorArtwork: "assets/denia-task-error.webp",
  taskCompleteArtwork: "assets/denia-task-complete.webp",
};
```

Replace the dark runtime token with:

```js
"__DENIA_OLD_DAYS_EXTENSION_TASK_APPROVAL_ART_JSON__",
"__DENIA_OLD_DAYS_EXTENSION_TASK_ERROR_ART_JSON__",
```

Update the mapping assertions to:

```js
["approval", "taskApproval", ".43"],
["error", "taskError", ".56"],
```

Update artwork lifecycle expectations to this ordered map and five URLs:

```js
const expectedArtworkKeys = "bright,taskWarm,taskApproval,taskError,taskComplete";
const propertyNames = ["bright", "task-warm", "task-approval", "task-error", "task-complete"]
  .map((name) => `--denia-old-days-art-${name}`);
```

Require the stylesheet to host approval and error only on:

```js
["--denia-old-days-art-task-approval", {
  selector: '.denia-old-days-ds-state-art-layer[data-denia-art-family="taskApproval"]',
  property: "--denia-state-art-image",
  atRuleFragments: [],
}],
["--denia-old-days-art-task-error", {
  selector: '.denia-old-days-ds-state-art-layer[data-denia-art-family="taskError"]',
  property: "--denia-state-art-image",
  atRuleFragments: [],
}],
```

In `assertStateArtRailLifecycle`, require approval to create generation `2`, error to crossfade to `taskError` and create generation `3`, and complete to create generation `4`. Require the outgoing approval layer to carry `is-leaving` during the error transition.

- [ ] **Step 2: Run the Sidecar validator and verify it fails**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: failure reporting `unexpected taskApprovalArtwork`.

- [ ] **Step 3: Extend the manifest and loader**

Replace `taskDarkArtwork` in `sidecar/extension.json` with:

```json
"taskApprovalArtwork": "assets/denia-task-approval.webp",
"taskErrorArtwork": "assets/denia-task-error.webp"
```

In `sidecar/runtime/loader.mjs`, resolve and read both new paths. Replace the dark placeholder/sentinel with:

```js
taskApproval: "__DENIA_OLD_DAYS_EXTENSION_TASK_APPROVAL_ART_JSON__",
taskError: "__DENIA_OLD_DAYS_EXTENSION_TASK_ERROR_ART_JSON__",
```

and:

```js
taskApproval: "@@DENIA_RUNTIME_TASK_APPROVAL_ART_7F3A@@",
taskError: "@@DENIA_RUNTIME_TASK_ERROR_ART_7F3A@@",
```

Stage and substitute both tokens in the same order as the manifest assets. Update `cleanupExpression` and `verifyExpression` to use:

```js
approval: "taskApproval",
error: "taskError",
```

and:

```js
taskApproval: "--denia-old-days-art-task-approval",
taskError: "--denia-old-days-art-task-error",
```

- [ ] **Step 4: Extend runtime artwork lifecycle and state mapping**

Replace the dark runtime input with:

```js
const taskApprovalArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_TASK_APPROVAL_ART_JSON__;
const taskErrorArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_TASK_ERROR_ART_JSON__;
```

Use:

```js
const stateArtSpecs = Object.freeze({
  staged: Object.freeze({ family: "taskWarm", opacity: ".11" }),
  working: Object.freeze({ family: "taskWarm", opacity: ".20" }),
  approval: Object.freeze({ family: "taskApproval", opacity: ".43" }),
  error: Object.freeze({ family: "taskError", opacity: ".56" }),
  complete: Object.freeze({ family: "taskComplete", opacity: ".28" }),
});
```

Build and expose only through CSS variables:

```js
const artUrls = Object.freeze({
  bright: dataUrlToObjectUrl(brightArtDataUrl),
  taskWarm: dataUrlToObjectUrl(taskWarmArtDataUrl),
  taskApproval: dataUrlToObjectUrl(taskApprovalArtDataUrl),
  taskError: dataUrlToObjectUrl(taskErrorArtDataUrl),
  taskComplete: dataUrlToObjectUrl(taskCompleteArtDataUrl),
});
root.style.setProperty("--denia-old-days-art-task-approval", `url("${artUrls.taskApproval}")`);
root.style.setProperty("--denia-old-days-art-task-error", `url("${artUrls.taskError}")`);
```

Replace the cleanup variable list with:

```js
for (const name of ["bright", "task-warm", "task-approval", "task-error", "task-complete"]) {
  root.style.removeProperty(`--denia-old-days-art-${name}`);
}
```

The loader’s fallback cleanup may additionally remove the legacy `--denia-old-days-art-task-dark` variable. Do not expose object URLs on public runtime state.

- [ ] **Step 5: Bind the new families and transition timing in CSS**

Replace the shared dark selector with:

```css
.denia-old-days-ds-state-art-layer[data-denia-art-family="taskApproval"] {
  --denia-state-art-image: var(--denia-old-days-art-task-approval);
}

.denia-old-days-ds-state-art-layer[data-denia-art-family="taskError"] {
  --denia-state-art-image: var(--denia-old-days-art-task-error);
}
```

Set the base layer transition to:

```css
transition:
  opacity 300ms cubic-bezier(.22, 1, .36, 1),
  transform 360ms cubic-bezier(.22, 1, .36, 1),
  filter 360ms cubic-bezier(.22, 1, .36, 1);
```

Use an `180ms` leaving duration. Give the error entry a faster crossfade and restrained treatment:

```css
.denia-old-days-ds-extension[data-denia-form-state="error"]
  .denia-old-days-ds-state-art-layer[data-denia-art-family="taskError"].is-active {
  filter: brightness(.92) saturate(1.04) contrast(1.08);
  transform: translateX(-2px) scale(1.015);
  transition-duration: 220ms, 260ms, 260ms;
}
```

Keep the existing tint, rail border, breakpoints, reduced-transparency behavior, and global reduced-motion override.

- [ ] **Step 6: Update live and VM lifecycle fixtures**

Use:

```js
const familyForState = {
  staged: "taskWarm",
  working: "taskWarm",
  approval: "taskApproval",
  error: "taskError",
  complete: "taskComplete",
};
const artUrlForFamily = {
  taskWarm: "blob:warm",
  taskApproval: "blob:approval",
  taskError: "blob:error",
  taskComplete: "blob:complete",
};
```

In the rail lifecycle fixture, after approval:

```js
approval.remove();
const error = appendMarker(animated, main, { "data-state": "error" });
state.refresh();
const errorLayer = activeLayer(rail);
const approvalLeaving = rail.querySelector(
  '.denia-old-days-ds-state-art-layer[data-denia-art-family="taskApproval"]',
);
assert(errorLayer?.dataset.deniaArtFamily === "taskError", "error must use separate disrupted artwork");
assert(approvalLeaving?.classList.contains("is-leaving"), "approval must crossfade out during error");
assert(state.artGeneration === 3, "error must create its own artwork generation");
```

Update all artwork-count assertions from four/eight URLs to five/ten URLs, preserving exact creation, replacement, removal, and revocation order.

- [ ] **Step 7: Run the full Sidecar validator**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: `Validated 达妮娅 · 旧日斑斓 extension 0.1.0`.

- [ ] **Step 8: Commit the runtime separation**

```bash
git add sidecar/extension.json sidecar/runtime/loader.mjs sidecar/src/denia-old-days-extension.js sidecar/src/denia-old-days-extension.css sidecar/tests/validate.mjs
git commit -m "feat: separate Denia approval and error states"
```

---

### Task 4: Verify, document, package, and stop at local experience handoff

**Files:**
- Modify: `canon/sources.md`
- Modify if evidence requires it: `scripts/render-assets.mjs`
- Modify if live review requires it: `sidecar/src/denia-old-days-extension.css`
- Generated and ignored: `sidecar/release/denia-old-days-v0.1.0.zip`
- Generated and ignored: `sidecar/release/kaboo-local/`
- Generated and ignored: `evidence/*.png`

**Interfaces:**
- Consumes: complete source, render, and runtime changes from Tasks 1–3.
- Produces: verified evidence screenshots, an offline local package, and local testing commands; no remote action.

- [ ] **Step 1: Run syntax, source, and Sidecar verification**

```bash
node --check scripts/render-assets.mjs
node --check sidecar/src/denia-old-days-extension.js
node --check sidecar/runtime/loader.mjs
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
```

Expected: all commands exit `0`; the source check prints `source structure ok`; the Sidecar validator prints its validated extension line.

- [ ] **Step 2: Inspect the approval/error evidence as a set**

Open and compare:

```text
evidence/task-approval.png
evidence/task-error.png
evidence/task-working-to-approval-350ms.png
evidence/task-error-to-complete-500ms.png
evidence/task.png
evidence/task-complete.png
```

The visual gate passes only when:

- approval contains both forms and the bright face still reads at rail size;
- error contains an unsmiling face and reaching gesture;
- no source text, logo, signature, copyright line, white frame, or crop halo is visible;
- approval and error remain distinguishable with state labels covered;
- the light work area remains dominant and readable;
- the transition frames show a controlled change rather than a hard flash;
- working and complete remain visually unchanged.

If a crop misses its anchors, adjust only the corresponding `extract` rectangle in `TASK_RAIL_SOURCES`, re-render, and re-run `node scripts/check-source.mjs`.

- [ ] **Step 3: Record deterministic generated hashes**

Run:

```bash
node -e '
const crypto=require("node:crypto"),fs=require("node:fs");
for(const file of [
  "sidecar/assets/denia-task-approval.webp",
  "sidecar/assets/denia-task-error.webp",
  "evidence/task-approval.png",
  "evidence/task-error.png",
  "evidence/task-working-to-approval-350ms.png",
  "evidence/task-error-to-complete-500ms.png"
]) console.log(file,crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"));
'
```

Replace the retired dark-rail and duplicate-error rows in `canon/sources.md` with the exact six lines produced by the command, including each file’s dimensions and final extract rectangle.

- [ ] **Step 4: Build both offline packages**

```bash
bash sidecar/package.sh
KABOO_SHARP_ENTRY="/Applications/Codex.app/Contents/Resources/cua_node/lib/node_modules/sharp/lib/index.js" node scripts/build-local-kaboo-release.mjs
```

Expected:

```text
sidecar/release/denia-old-days-v0.1.0.zip
sidecar/release/kaboo-local/start-local-test.command
```

- [ ] **Step 5: Run the final frontend audit**

Confirm:

- design read remains an existing Codex task workspace with `5/5/4` design dials;
- artwork is confined to the right rail and does not become a mixed full-page wallpaper;
- the dual-form approval image does not read as a lone standing portrait;
- error is emotionally appropriate and does not smile;
- one radius and restrained shadow system remains intact;
- no new promotional copy, em-dash character, runtime request, or dependency was added;
- desktop and medium layouts reserve content space; narrow layout hides the rail;
- reduced motion and reduced transparency still pass;
- cleanup removes five CSS variables, five object URLs, listeners, and owned DOM;
- no remote repository or Registry action occurred.

- [ ] **Step 6: Commit verification records**

```bash
git add canon/sources.md scripts/render-assets.mjs sidecar/src/denia-old-days-extension.css
git commit -m "docs: verify separate Denia state artwork"
```

Skip the commit only when the listed tracked files have no final-review changes.

- [ ] **Step 7: Stop at user testing**

Keep the worktree and branch intact. Hand off:

```bash
cd /Users/bytedance/ByteDance/workspace/denia-old-days-codex-theme/.worktrees/official-art-revision
open sidecar/release/kaboo-local/start-local-test.command
```

Provide the user with clickable paths for the approval, error, transition, working, and complete screenshots. Do not merge, push, create a PR, or upload to Kaboo Registry.
