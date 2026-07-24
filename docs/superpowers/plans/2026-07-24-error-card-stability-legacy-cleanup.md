# Error Card, Home Stability, and Legacy Cleanup Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use subagent-driven-development to execute this plan task-by-task.

**Goal:** Make explicit command-failure assistant cards select the existing error artwork, keep the home suggestion area geometrically stable while native actions remount, stop extension-only mutation refresh loops, and recoverably retire the confirmed legacy theme copy after preserving its unique art and Git history.

**Architecture:** Extend the current runtime’s state derivation with a narrowly scoped latest-assistant fallback instead of broad keyword matching. Replace the ephemeral suggestion deck’s layout responsibility with a persistent owned slot that only hosts real action proxies. Stabilize the observer by making observable writes idempotent and discarding mutation records caused solely by owned/theme DOM. Archive unique art outside all release inputs before exporting and trashing the exact legacy repository.

**Tech Stack:** Vanilla JavaScript/CSS, Node.js VM harness, Sidecar validator, Git bundle/worktree, macOS Trash.

---

### Task 1: Recognize explicit command-failure assistant cards

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.js`
- Test: `sidecar/tests/validate.mjs`

**Step 1: Write the failing tests**

Extend the VM harness so tests can create ordered user and assistant content units with short paragraphs. Add cases proving:

- `测试错误已触发： command not found，退出码为 127。` in the latest assistant unit selects `error` / `taskError`.
- the same text in a user unit does not select error.
- a generic discussion of “error”, an exit code of `0`, and a command failure missing one required signal do not select error.
- an older matching assistant followed by a normal latest assistant does not keep error sticky.
- insertion of a matching assistant via a child-list mutation schedules exactly one animation-frame refresh.
- a newly inserted structured node using `data-testid="...error..."` is observable.

**Step 2: Run the focused validator and confirm failure**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL because the ordinary assistant failure card still derives `complete`, and `data-testid` is absent from the observer filter.

**Step 3: Implement the conservative fallback**

In `sidecar/src/denia-old-days-extension.js`:

- Keep structured error markers and visible alert detection first.
- Inspect only the final `[data-content-search-unit-key$=":assistant"]`.
- Inspect independent visible paragraphs outside `pre`, `code`, and user-owned content.
- Normalize whitespace and reject text longer than 240 characters.
- Require all three signals:
  - prefix `测试错误已触发:` / `测试错误已触发：` / `命令执行失败:` / `命令执行失败：` / `command failed:`;
  - `command not found` or `命令未找到`;
  - a parsed nonzero decimal status from `退出码为 N`, `exit code N`, or `exited with status N`.
- Add `data-testid` to the observed attribute list.

Do not broaden matching to arbitrary `error`/`失败` prose and do not change the existing state precedence.

**Step 4: Run tests and confirm pass**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: PASS, including existing approval/working/complete state cases.

**Step 5: Commit**

```bash
git add sidecar/src/denia-old-days-extension.js sidecar/tests/validate.mjs
git commit -m "fix: recognize explicit command failure cards"
```

### Task 2: Stabilize the home suggestion slot and mutation observer

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.js`
- Modify: `sidecar/src/denia-old-days-extension.css`
- Modify: `sidecar/runtime/loader.mjs`
- Modify: `sidecar/tests/validate.mjs`
- Modify: `docs/current-theme-design.md`

**Step 1: Write the failing slot lifecycle tests**

Extend the harness and validator with a `[4] -> [0/3] -> [4]` lifecycle:

- Home creates `#denia-old-days-ds-suggestion-slot`.
- Four semantic native actions create exactly four enabled/disabled-aware proxies inside the slot.
- When the native actions temporarily disappear or drop below four, the deck is removed immediately but the slot remains.
- The empty slot contains no `button`, role, label, tab stop, pointer target, or fake action.
- The slot preserves the last valid measured block height so the next workspace sibling keeps the same y position.
- Restoring four actions rebinds proxies to the current native buttons and preserves order/click mapping.
- Leaving home and cleanup remove both slot and retained measurement.

Add responsive CSS assertions for a nonzero initial height fallback at desktop, two-column, and one-column breakpoints so the first late mount cannot shift the workspace.

**Step 2: Write the failing observer-stability tests**

Give the VM MutationObserver harness record-level control and `attributeOldValue`. Add tests proving:

- class changes whose token delta contains only `denia-old-days-ds-*` do not schedule refresh;
- style/class/child-list changes inside an owned node do not schedule refresh;
- a mixed batch containing any native application mutation schedules one refresh;
- repeated refresh with unchanged state produces no further observable style/class writes;
- stable home and task views remain at no more than four refreshes over the equivalent two-second observation window.

**Step 3: Run the focused validator and confirm failure**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL because the deck currently owns the layout height and refresh rewrites observable art state.

**Step 4: Implement the stable slot**

In the runtime:

- Add `ensureSuggestionSlot()` and store its last valid content height in runtime state.
- Insert the slot after the hero; make the deck its only child.
- Move deck external margin to the slot.
- Measure the rendered deck block height after a valid mount and write a CSS custom property only when changed.
- When actions are incomplete, restore native classes and remove only the deck.
- On home teardown/cleanup, remove the slot and clear its retained measurement state.

In CSS:

- Make the slot visually empty and noninteractive.
- Set responsive initial height fallbacks matching the four-card rows:
  - desktop: one row;
  - medium: two rows;
  - narrow: four rows.
- Let the measured custom property override the fallback.
- Set the deck to fill the slot without external margin.

Update loader cleanup/verification lists to recognize the new owned slot and report its geometry without treating the empty slot as an action surface.

**Step 5: Make refresh writes idempotent**

Add small compare-before-write helpers for dataset values, CSS custom properties, and state classes. Apply them to:

- root form/sidebar datasets and home/task state classes;
- state-art rail dataset;
- state-art layer opacity, generation/family dataset, and active/leaving classes;
- any native/theme class sync performed on every refresh.

Do not disconnect the observer during refresh.

**Step 6: Filter extension-only mutation records**

Replace the direct observer callback with a record-aware callback:

- ignore attribute and child-list changes whose target is an owned node or its descendant;
- with `attributeOldValue: true`, ignore class records where the symmetric token difference is entirely `denia-old-days-ds-*`;
- ignore child-list records when every added/removed node is owned;
- schedule once when a batch contains any non-theme native mutation.

Preserve observation of real `style`, `class`, ARIA, state/status, and `data-testid` changes.

**Step 7: Update current design documentation**

Document the persistent empty slot, real-action-only proxy contract, responsive fallback heights, latest-assistant error fallback, and observer stability threshold.

**Step 8: Run validation**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
node scripts/check-source.mjs
```

Expected: PASS.

If a running Codex renderer is available, use the existing read-only live verification path to confirm:

- slot height is unchanged across action remount;
- an empty slot has no interactive descendants;
- stable home and task views increase `refreshes` by at most four in two seconds.

Do not launch or restart Codex.

**Step 9: Commit**

```bash
git add sidecar/src/denia-old-days-extension.js sidecar/src/denia-old-days-extension.css sidecar/runtime/loader.mjs sidecar/tests/validate.mjs docs/current-theme-design.md
git commit -m "fix: stabilize home suggestion layout"
```

### Task 3: Archive unique legacy artwork outside release inputs

**Files:**
- Create: `art/archive/legacy-main-7851e38/background.svg`
- Create: `art/archive/legacy-main-7851e38/hero.svg`
- Create: `art/archive/legacy-main-7851e38/task-preview.svg`
- Create: `art/archive/legacy-main-7851e38/PROVENANCE.md`
- Create: `art/reference/visual-library-2026-07-23/production-ready/dark-stage-complete.jpg`
- Create: `art/reference/visual-library-2026-07-23/production-ready/old-days-half-face-clean.jpg`
- Create: `art/reference/visual-library-2026-07-23/PROVENANCE.md`
- Modify: `scripts/check-source.mjs`

**Step 1: Add failing archive-boundary assertions**

Extend source checks to require the five files and exact SHA-256 hashes:

```text
f434bc0fbf01523e8198f7f41bdb546c98186e99a6c0c5ab44a5ca6ed1a6df1a  background.svg
a7cacba007ae990c9b02bba07fdf9437c0a40b6028189109c21c37c3090671ec  hero.svg
ed9b47544f1fbd589d1124b8c63a6a650811632dcce6d5340fd8ddb1092d9ade  task-preview.svg
d312c86f21610d7d6b50b8d8fa9b9685ef4baa11d34c0ca72fd71a712bfa42ed  dark-stage-complete.jpg
c908f50f08dcc345a442ae9de73112d59725fdd2352114c142955093c13deb37  old-days-half-face-clean.jpg
```

Assert that neither archive directory appears in the Sidecar manifest, renderer input list, or release ZIP input list.

**Step 2: Run source checks and confirm failure**

Run:

```bash
node scripts/check-source.mjs
```

Expected: FAIL because the archive files are not present yet.

**Step 3: Copy only the audited unique files**

Copy the three SVGs from:

`/Users/bytedance/ByteDance/workspace/denia-old-days-codex-theme/art/source/`

Copy the two production candidates from:

`/Users/bytedance/ByteDance/workspace/denia-visual-library/production-ready/`

Do not copy the eight official images already byte-identical to the current repository.

**Step 4: Record provenance**

Each `PROVENANCE.md` must record source path, source commit/date where known, exact SHA-256, audit date `2026-07-24`, and the boundary “reference/archive only; never automatically packaged.”

**Step 5: Run validation and confirm pass**

Run:

```bash
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
```

Expected: PASS.

**Step 6: Commit**

```bash
git add art/archive art/reference scripts/check-source.mjs
git commit -m "chore: archive unique legacy artwork"
```

### Task 4: Preserve every pure image from the visual library

**Files:**
- Create: `art/reference/visual-library-full-2026-07-24/production-ready/**`
- Create: `art/reference/visual-library-full-2026-07-24/reference-only/**`
- Create: `art/reference/visual-library-full-2026-07-24/source-media/**`
- Create: `art/reference/visual-library-full-2026-07-24/MANIFEST.tsv`
- Create: `art/reference/visual-library-full-2026-07-24/PROVENANCE.md`
- Delete: `art/reference/visual-library-2026-07-23/`
- Modify: `scripts/check-source.mjs`
- Modify: `docs/current-theme-design.md`

**Step 1: Add failing full-library checks**

Require:

- exactly 139 image rows and 139 destination image files;
- total image bytes `57,419,633`;
- sorted manifest header
  `source_relative_path\tsize_bytes\tsha256`;
- aggregate SHA-256
  `3ec0442a857f4800c7d9b7e29741d9ef3a09e3975b35575806e453d45ecd11a8`
  over sorted `SHA256  relative-path` lines;
- every destination size/hash matches its manifest row;
- only image MIME types exist below the three copied source directories;
- the full-library root cannot enter manifest, renderer inputs, or release inputs.

Run `node scripts/check-source.mjs` and confirm it fails because the full snapshot is absent.

**Step 2: Copy all images byte-for-byte**

From `/Users/bytedance/ByteDance/workspace/denia-visual-library`, recursively copy every
regular file whose `file --mime-type` is `image/*`, preserving its source-relative path
below `art/reference/visual-library-full-2026-07-24/`.

Keep all duplicate paths. Do not hardlink, deduplicate, rename, recompress, strip metadata,
or copy HTML, JSON, Markdown, MP4, `.DS_Store`, caches, or project files.

**Step 3: Generate manifest and provenance**

Generate `MANIFEST.tsv` from destination bytes, sorted lexicographically, with exactly
139 data rows.

Write concise `PROVENANCE.md` containing:

- source collection name/path and audit date;
- 139 images / 57,419,633 bytes;
- MIME and SHA-256 identification method;
- intentional exclusion of project and video files;
- source/attribution facts transcribed from the old README, manifest, and SOURCES without
  copying those project files or inventing license claims;
- five retained internal duplicate groups and existing `art/` overlap;
- “reference only; never automatically packaged.”

**Step 4: Remove the superseded two-file snapshot**

Delete `art/reference/visual-library-2026-07-23/` only after both images are present with
matching hashes at:

- `visual-library-full-2026-07-24/production-ready/dark-stage-complete.jpg`
- `visual-library-full-2026-07-24/production-ready/old-days-half-face-clean.jpg`

Update source checks and current design documentation to point at the full snapshot.

**Step 5: Verify and commit**

Run:

```bash
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
git diff --check
```

Commit:

```bash
git add art/reference scripts/check-source.mjs docs/current-theme-design.md
git commit -m "chore: preserve full Denia visual library"
```

### Task 5: Review, recoverably clean the old repositories, integrate, and update the local package

**Files:**
- Create outside repo: `/Users/bytedance/Archives/denia-old-days-codex-theme-legacy-7851e38.bundle`
- Move outside repo:
  `/Users/bytedance/ByteDance/workspace/denia-old-days-codex-theme`
  to
  `/Users/bytedance/.Trash/denia-old-days-codex-theme-legacy-7851e38-20260724`
- Move outside repo:
  `/Users/bytedance/ByteDance/workspace/denia-visual-library`
  to
  `/Users/bytedance/.Trash/denia-visual-library-20260724-cleanup`

**Step 1: Run whole-branch review**

Use a fresh reviewer against base `1129cfe`. Resolve all correctness or scope findings before cleanup.

**Step 2: Run proportional pre-cleanup verification**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
node scripts/check-source.mjs
git diff --check 1129cfe...HEAD
```

Verify the three archived SVG hashes and the 139-row visual-library manifest/aggregate hash.
Confirm Dream Skin, Kaboo, both cleanup sources, and the current repository exist.

**Step 3: Export and verify the legacy Git history**

Create `/Users/bytedance/Archives` if absent. From the exact old repository:

```bash
git bundle create /Users/bytedance/Archives/denia-old-days-codex-theme-legacy-7851e38.bundle --all
git bundle verify /Users/bytedance/Archives/denia-old-days-codex-theme-legacy-7851e38.bundle
```

Stop immediately if bundle verification fails.

**Step 4: Remove the linked legacy worktree**

From the old repository, resolve the registered path with `git worktree list --porcelain`, confirm it is exactly `.worktrees/official-art-revision`, then run:

```bash
git worktree remove /Users/bytedance/ByteDance/workspace/denia-old-days-codex-theme/.worktrees/official-art-revision
```

Do not use `rm -rf`.

**Step 5: Move only the clean legacy main tree to Trash**

Reconfirm:

- `git status --short` is empty;
- target Trash path does not already exist;
- current builds and LaunchAgent files do not reference the old path.

Then move the exact directory to:

`/Users/bytedance/.Trash/denia-old-days-codex-theme-legacy-7851e38-20260724`

Confirm the old path is absent, the Trash destination exists, and the three protected projects remain.

**Step 6: Move the image-only visual library source to Trash**

Reconfirm all 139 destination paths, sizes and hashes. Confirm the visual-library source
is still not Git, contains no symlinks, and has no open `lsof +D` handles. Confirm the
Trash target does not exist.

Move the exact source directory in one operation to:

`/Users/bytedance/.Trash/denia-visual-library-20260724-cleanup`

Do not use `rm -rf`. Verify the old path is absent, the Trash target is present, and its
139 source images still match `MANIFEST.tsv`.

**Step 7: Fast-forward main**

In `/Users/bytedance/workspace/denia-old-days-codex-theme`:

```bash
git merge --ff-only codex/error-card-stability-cleanup
```

Do not push or create a PR.

**Step 8: Build and update the local test package once**

Use the repository’s existing release build path to regenerate:

`/Users/bytedance/workspace/denia-old-days-codex-theme/sidecar/release/kaboo-local`

Install/apply the updated local package using the existing non-launching install path. Do not invoke `start-local-test.command`, start a launcher, or restart Codex.

**Step 9: Final verification**

Run only:

```bash
node sidecar/tests/validate.mjs sidecar
node scripts/check-source.mjs
```

Also verify release ZIP integrity, archived hashes, the full visual manifest, bundle
verification, both Trash destinations, and protected project presence.

Report:

- the error-state detection boundary;
- the noninteractive stable suggestion slot behavior;
- the observer refresh stability result;
- exact archived art and recoverable cleanup locations;
- that the bash launcher now points at the regenerated local package;
- that nothing was uploaded, published, launched, or restarted.
