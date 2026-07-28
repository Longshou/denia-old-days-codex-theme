# Denia Dark Theme Immersive Homepage Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a reliable host-theme marker and a paint-only dark theme for the Denia homepage and injected chrome, using the selected official panoramic artwork while preserving the light homepage, native input behavior, task routing, and unrelated layout.

**Architecture:** Extend the existing build-time artwork pipeline with one dark-home WebP and inject it through the current loader/object-URL lifecycle. Reuse the single existing `MutationObserver` to mirror `electron-light` and `electron-dark` onto `data-denia-theme`, then switch text and CSS through that marker. Keep the existing homepage visual layer non-interactive and fixed; dark mode turns its Hero into a transparent copy anchor while the main surface draws one full-bleed background.

**Tech Stack:** Node.js 20+, ESM, Sharp, vanilla JavaScript, CSS, the existing `sidecar/tests/validate.mjs` VM/runtime harness, and the Playwright-based loader verifier.

---

## Non-negotiable boundaries

- Preserve the existing uncommitted home-to-task cleanup fix in:
  - `sidecar/src/denia-old-days-extension.js`
  - `sidecar/tests/validate.mjs`
- Do not modify `isHomeView()`, route detection, mutation dirty-mask semantics, `removeHomeNodes()`, native composer discovery, native prompt text, native project button, suggestion-card text, or input value/placeholder behavior.
- Do not change the geometry, order, focus behavior, or event handling of the native composer, navigation, task main column, or sidebars.
- Deep-theme component changes are paint-only: colors, backgrounds, borders, shadows, and text contrast.
- Do not add a second observer, `matchMedia`, a scroll listener, a timer loop, a request-animation-frame loop, runtime fetches, canvas, WebGL, or animated particles.
- Keep the decorative home layer at `pointer-events: none`.
- Keep all existing light-theme manifest values and CSS declarations unchanged.
- Do not implement the bubble-drag selector from concept 2 in this branch.

## Approved dark-home copy

The dark UI uses original interface copy rather than claiming a canonical quote:

```text
DENIA · OLD DAYS AFTERGLOW
今晚，要让哪段思绪显影？
幻灭之形 · 观察中
```

The light UI remains:

```text
DENIA · OLD DAYS IN COLOR
今天要把什么写进手账？
布景之形 · 记录中
```

## Task 1: Lock the public contract with failing tests

**Files:**

- Modify: `sidecar/tests/validate.mjs`
- Reference: `sidecar/extension.json`
- Reference: `sidecar/src/denia-old-days-extension.js`
- Reference: `sidecar/src/denia-old-days-extension.css`
- Reference: `sidecar/runtime/loader.mjs`

**Step 1: Add manifest and copy assertions**

Extend `expectedAssets` with:

```js
darkHomeArtwork: "assets/denia-home-dark.webp"
```

Assert that the current light `eyebrow`, `headline`, and `statusText` values remain byte-for-byte unchanged, and that the dark fields are:

```js
darkEyebrow: "DENIA · OLD DAYS AFTERGLOW"
darkHeadline: "今晚，要让哪段思绪显影？"
darkStatusText: "幻灭之形 · 观察中"
```

**Step 2: Add source and runtime lifecycle assertions**

Add assertions that:

- the dark-home placeholder and sentinel are resolved by the loader;
- runtime creates one object URL for the new art and sets `--denia-old-days-art-dark`;
- `cleanup()` and loader fallback cleanup remove that property and revoke its URL;
- the artwork variable is consumed only by the deep-home surface, not by task rails or unrelated components.

**Step 3: Add host-theme synchronization assertions**

Extend the VM harness so the root node can begin with `electron-light`, `electron-dark`, both, or neither and can emit a root-class mutation.

Test:

- initial light maps to `data-denia-theme="light"`;
- initial dark maps to `data-denia-theme="dark"`;
- first unknown state falls back to light;
- a transient missing or conflicting class keeps the most recent valid value;
- a valid root-class change synchronizes the marker without constructing another observer;
- a theme-only mutation does not rebuild art URLs, create owned nodes, or enter the route/task refresh paths;
- cleanup removes `data-denia-theme`.

**Step 4: Add theme-specific Hero-copy assertions**

Test that:

- light Hero uses the existing light trio;
- dark Hero uses the approved dark trio;
- switching the host theme updates existing Hero text nodes rather than recreating the Hero;
- native heading, inline project button, textarea placeholder/value, and suggestion text remain untouched.

**Step 5: Add CSS scope and regression assertions**

Require a deep-home selector rooted at:

```css
html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-home[data-denia-theme="dark"]
```

Assert:

- the deep-home main surface uses `--denia-old-days-art-dark`;
- the Hero paper surface becomes transparent;
- `.denia-old-days-ds-photo` and `.denia-old-days-ds-memory-bubbles` are hidden only in the deep home;
- native prompt and composer changes are paint-only;
- dark task/home chrome has readable semantic colors;
- no deep rule changes width, height, margin, padding, grid, flex, position, inset, transform, overflow, or DOM visibility outside explicitly approved decorative Hero children;
- reduced-transparency has a dark solid fallback;
- no drag, curve, canvas, WebGL, new observer, or runtime-network code is added.

**Step 6: Run the focused validator and confirm RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL on the first missing contract, beginning with `darkHomeArtwork` or the new dark-copy/theme assertions.

Do not weaken pre-existing assertions to make the new checks pass.

## Task 2: Add the selected artwork to the controlled build pipeline

**Files:**

- Add: `art/source/official/denia-home-dark-hjz.jpg`
- Modify: `scripts/release-inputs.mjs`
- Modify: `scripts/render-assets.mjs`
- Modify: `scripts/check-source.mjs`
- Modify: `canon/sources.md`
- Modify: `sidecar/extension.json`
- Generate: `sidecar/assets/denia-home-dark.webp`

**Step 1: Promote the approved source without recompression**

Copy:

```text
art/reference/visual-library/source-media/official-published-x/HJZ_QoAbEAAGOSi.jpg
```

to:

```text
art/source/official/denia-home-dark-hjz.jpg
```

Verify:

```bash
shasum -a 256 art/source/official/denia-home-dark-hjz.jpg
```

Expected:

```text
b4d5f5b17b83c0f855e8d09effadc01fdead43d01fb6c03b42c3f34860fe17ce
```

**Step 2: Declare source provenance**

Add the source path to `RENDERER_SOURCE_INPUTS`, add its fixed hash to `officialSources`, and document the source, original dimensions, selected use, and hash in `canon/sources.md`.

**Step 3: Add the runtime render target**

Add a `runtimeArt` item that emits:

```text
sidecar/assets/denia-home-dark.webp
```

Requirements:

- use a `16:9` crop derived from the `4096 × 2304` source;
- output at least `2048 × 1152`;
- keep the face and central memory orb visible;
- encode as WebP and tune quality only as needed to remain below `1 MiB`;
- do not apply blur, animated effects, generative alterations, or destructive source edits.

**Step 4: Expose the asset in the manifest**

Add:

```json
"darkHomeArtwork": "assets/denia-home-dark.webp"
```

Do not rename or repoint `runtimeWallpaper`.

Add `darkEyebrow` and `darkHeadline`; preserve all light keys exactly.

**Step 5: Build and validate the asset**

Run:

```bash
npm run build:kaboo
node scripts/check-source.mjs
```

Expected:

- the WebP exists;
- its dimensions are at least `2048 × 1152`;
- its size is under `1 MiB`;
- source and generated hashes/checklists pass.

**Step 6: Re-run the validator**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: asset/manifest assertions pass; runtime theme and CSS assertions still fail.

## Task 3: Extend the existing loader and object-URL lifecycle

**Files:**

- Modify: `sidecar/runtime/loader.mjs`
- Modify: `sidecar/src/denia-old-days-extension.js`
- Test: `sidecar/tests/validate.mjs`

**Step 1: Load and inject the dark-home binary**

In `loader.mjs`, extend the existing parallel asset read with `manifest.assets.darkHomeArtwork`. Add the matching placeholder, sentinel, staged replacement, and `sentinelPayloads` entry.

Maintain the current one-pass template replacement; do not add runtime I/O.

**Step 2: Create and expose one object URL**

In the runtime template:

- add a dark-home data-URL constant beside the existing art constants;
- add `darkHome` to the frozen `artUrls` object;
- set `--denia-old-days-art-dark` once during installation;
- leave the existing `Object.values(artUrls).every(Boolean)` readiness check intact.

**Step 3: Extend both cleanup paths**

Remove `--denia-old-days-art-dark` from:

- runtime `cleanup()`;
- loader `cleanupExpression`.

Keep the existing `Object.values(artUrls)` revoke loop, which must now include the dark-home URL automatically.

**Step 4: Update live verification**

Teach the loader verification probe to read both bright and dark-home variables. In a deep-home run, accept the dark art only when the main home surface uses the generated object URL. In a light-home run, retain the existing photo-front bright-art assertion.

Do not weaken visibility, viewport, native-input, overflow, focus, or cleanup checks.

**Step 5: Run the focused validator**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: loader/art lifecycle assertions pass; theme sync and CSS assertions still fail.

## Task 4: Synchronize the host theme and swap Hero copy

**Files:**

- Modify: `sidecar/src/denia-old-days-extension.js`
- Test: `sidecar/tests/validate.mjs`

**Step 1: Add a pure theme detector**

Implement a helper whose only inputs are root classes and the previous valid theme:

- dark only → `dark`;
- light only → `light`;
- both or neither → previous valid theme;
- if no previous valid theme exists → `light`.

**Step 2: Add an idempotent synchronizer**

Implement `syncNativeTheme()` to:

- update the remembered valid theme;
- set `root.dataset.deniaTheme` only when the value changes;
- update existing Hero eyebrow/headline/status nodes in place;
- return whether it changed observable theme state.

Do not trigger a route/home/task refresh from this function.

**Step 3: Synchronize before the first decoration**

Call the synchronizer before initial page decoration so CSS and initial Hero copy see the correct marker.

When creating the Hero, select the light or dark manifest fields from the current marker. Add stable classes or data roles to the existing three text nodes so an in-place theme switch can target them without replacing the Hero.

**Step 4: Reuse the existing observer**

Observe root class attributes with the same `MutationObserver` instance that already observes page mutations. At the start of its callback:

- isolate root `class` mutation records;
- call `syncNativeTheme()` immediately;
- exclude theme-only records from route/task dirty-domain scheduling.

Do not change the existing home-to-task fast-cleanup branch or its trailing timer/frame behavior.

**Step 5: Clean the marker**

Delete `root.dataset.deniaTheme` during runtime cleanup and loader fallback cleanup.

**Step 6: Run validator and inspect the dirty diff**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
git diff -- sidecar/src/denia-old-days-extension.js sidecar/tests/validate.mjs
```

Expected:

- theme/copy tests pass;
- the pre-existing home-to-task guard and its regression assertions are still present byte-for-byte;
- only CSS assertions remain failing.

## Task 5: Implement the full-bleed deep-home and paint-only dark chrome

**Files:**

- Modify: `sidecar/src/denia-old-days-extension.css`
- Test: `sidecar/tests/validate.mjs`

**Step 1: Add scoped semantic tokens**

Add dark tokens under the root dark marker without changing light token values:

```css
--denia-dark-canvas: #12142f;
--denia-dark-surface: #1a1c3a;
--denia-dark-surface-raised: #202348;
--denia-dark-text: #f3eff6;
--denia-dark-text-muted: #bbb5c9;
--denia-dark-focus: #8dc5ea;
--denia-dark-character: #d98fb3;
--denia-dark-divider: rgba(141, 154, 211, 0.3);
```

Set `color-scheme: dark` only under `[data-denia-theme="dark"]`; keep light mode light.

**Step 2: Draw the selected artwork once**

Under the exact deep-home selector:

- set the main surface fallback to `#12142f`;
- use `--denia-old-days-art-dark` as the single image;
- use `cover`, no repeat, and a crop position that protects the face and memory orb;
- add only static gradients in the same background stack to darken the title and composer safe zones.

Do not add `filter`, full-screen `backdrop-filter`, `mix-blend-mode`, or another image DOM node.

**Step 3: Convert the Hero into a copy anchor**

Only in deep home:

- remove the paper background, border, and warm shadow;
- preserve a stable Hero rectangle for native-prompt measurement;
- keep the copy at the left/top safe zone;
- hide the existing `.denia-old-days-ds-photo` and `.denia-old-days-ds-memory-bubbles`;
- style the title/status with readable soft-white and muted-lavender colors plus a restrained text shadow or small opaque panel.

The visual layer stays non-interactive.

**Step 4: Repaint the native prompt and composer**

In deep home:

- retain the native prompt’s existing transform/shift and DOM;
- change only text color and restrained text shadow;
- repaint composer, text, placeholder, attachment, and send button;
- preserve dimensions, line wrapping, scroll behavior, positions, hit areas, focus order, and native handlers.

**Step 5: Repaint injected sidebars and task chrome**

Use `[data-denia-theme="dark"]` paint-only overrides for the existing injected sidebar surfaces, project rows, observation card, completion card, and shared composer chrome.

Allowed properties:

- color;
- background/background-color;
- border/border-color;
- box-shadow;
- outline;
- opacity where it does not hide semantic content.

Do not override syntax highlighting, terminal, diff, editor colors, or any layout property.

**Step 6: Add responsive and accessibility fallbacks**

- Below `920px`, adjust only deep-home crop position and safe-zone paint; keep the existing responsive layout.
- In short viewports, keep the native prompt and composer visible and do not cover the face/orb.
- Under `prefers-reduced-transparency: reduce`, use solid dark surfaces and remove composer blur.
- Preserve the existing reduced-motion rule.
- Keep the `3px` crystal-blue focus ring.

**Step 7: Run the validator and confirm GREEN**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: PASS.

## Task 6: Generate evidence and run full verification

**Files:**

- Possibly generated: evidence outputs controlled by the existing render/build scripts
- Verify only: all changed files

**Step 1: Run the complete repository check**

Run:

```bash
npm run check
```

Expected: PASS with no source, asset, CSS, runtime, cleanup, or regression errors.

**Step 2: Run the installed-page verifier**

Use the existing loader verification flow against both light and dark home states. Confirm:

- light homepage still uses the warm scrapbook/polaroid composition;
- dark homepage uses the selected panoramic art;
- Hero copy changes in place;
- native project control and composer remain visible and operable;
- long text wraps/scrolls using native behavior;
- no horizontal overflow;
- task view removes fixed home visuals immediately;
- task art and status rails remain functional;
- cleanup removes nodes, marker, properties, and object URLs.

If a live Codex target is unavailable, report that limitation explicitly and do not claim visual runtime verification.

**Step 3: Inspect performance invariants**

Confirm from the runtime probe and static checks:

- exactly one `MutationObserver`;
- no new network or scroll listeners;
- no repeated object-URL generation on theme switch;
- no new ongoing animation loop;
- stable two-second refresh increment remains within the existing budget;
- no new interactive nodes in the decorative home layer.

**Step 4: Review the final diff**

Run:

```bash
git status --short
git diff --stat
git diff --check
git diff -- sidecar/src/denia-old-days-extension.js sidecar/tests/validate.mjs
```

Verify that unrelated layout and the pre-existing home-to-task cleanup work are preserved.

**Step 5: Request code review**

Dispatch a fresh reviewer with:

- the design specification;
- this implementation plan;
- the branch base commit;
- the final diff;
- explicit focus on theme-state races, cleanup, native input behavior, dark selector leakage, contrast, asset size, and the preserved uncommitted route fix.

Resolve all important findings and re-run the complete verification suite before reporting completion.

