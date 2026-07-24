# Repository Cleanup and Approval State Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the repository around one current design document and make native permission prompts select the dedicated approval artwork instead of the complete artwork.

**Architecture:** Keep every image, generated preview, provenance record, runtime component, compatibility cleanup, and the Kaboo local experience package. Remove only superseded process documents and two non-image local artifacts. Extend the existing runtime state recognizer with a narrowly scoped visible approval-action check, covered by the existing VM behavior harness.

**Tech Stack:** Node.js 24, ECMAScript modules, VM-based Sidecar behavior tests, Bash lifecycle scripts, Sharp asset renderer, Kaboo Codex Dream Skin local package.

## Global Constraints

- Preserve every file under `art/source/`, every generated image under `evidence/`, and all art provenance and hashes in `canon/sources.md`.
- Preserve `sidecar/release/kaboo-local/` because the local Bash launcher reads that directory.
- Preserve the fixed native task geometry: do not add width, margin, padding, grid, or flex overrides to task `main`, the composer, or native approval UI.
- Preserve the state-art mapping: `approval` uses `taskApproval`; `complete` uses `taskComplete`.
- A visible native permission action labeled `允许一次`, `始终允许`, `Allow once`, or `Always allow` must classify the task as `approval`, even when an assistant message already exists.
- Do not classify an ordinary standalone `Review changes` button as approval.
- Do not remove legacy renderer cleanup or compatibility guards unless a failing test proves they are dead and a replacement cleanup path exists.
- Do not upload, push, create a PR, publish to Registry, or restart Codex.

---

### Task 1: Consolidate Repository Documentation

**Files:**
- Keep: `docs/current-theme-design.md`
- Delete: `docs/reviews/2026-07-23-denia-state-transition-ui-ux-review.md`
- Delete: `docs/superpowers/plans/2026-07-23-denia-approval-error-separation.md`
- Delete: `docs/superpowers/plans/2026-07-23-denia-bubble-polaroid.md`
- Delete: `docs/superpowers/plans/2026-07-23-denia-state-art-rail.md`
- Delete: `docs/superpowers/plans/2026-07-23-native-task-layout.md`
- Delete: `docs/superpowers/specs/2026-07-23-denia-approval-error-separation-design.md`
- Delete: `docs/superpowers/specs/2026-07-23-denia-bubble-polaroid-design.md`
- Delete: `docs/superpowers/specs/2026-07-23-denia-state-transition-design.md`
- Delete: `docs/superpowers/specs/2026-07-23-native-task-layout-design.md`
- Delete at the end of this task: `docs/superpowers/plans/2026-07-24-repository-cleanup-and-approval-fix.md`

**Interfaces:**
- Consumes: the preservation boundary in `docs/current-theme-design.md`.
- Produces: a `docs/` tree whose only regular file is `docs/current-theme-design.md`.

- [ ] **Step 1: Record the preservation baseline**

Run:

```bash
git status --short
git ls-files art canon evidence > /tmp/denia-art-files-before.txt
```

Expected: the worktree is clean and the baseline list contains the tracked art, provenance, and evidence directory files.

- [ ] **Step 2: Delete only the superseded documents**

Use `apply_patch` to delete the ten exact files listed in this task. Do not use recursive filesystem deletion.

- [ ] **Step 3: Verify the document tree and art preservation**

Run:

```bash
test "$(find docs -type f -print | sort)" = "docs/current-theme-design.md"
git ls-files art canon evidence > /tmp/denia-art-files-after.txt
cmp /tmp/denia-art-files-before.txt /tmp/denia-art-files-after.txt
git diff --name-only -- art canon evidence
git diff --check
```

Expected: all commands exit `0`; the final `git diff --name-only` prints nothing.

- [ ] **Step 4: Commit the consolidation**

Run:

```bash
git add -A docs
git commit -m "docs: remove superseded Denia process notes"
```

Expected: one commit deleting the ten superseded documents while retaining `docs/current-theme-design.md`.

### Task 2: Recognize Native Permission Actions as Approval

**Files:**
- Modify: `sidecar/tests/validate.mjs`
- Modify: `sidecar/src/denia-old-days-extension.js`

**Interfaces:**
- Consumes: `approvalVisible(): boolean` and the existing `assertFormStateRecognition(payload)` VM harness.
- Produces: `approvalVisible()` returning `true` for visible permission action buttons before `deriveFormState()` falls through to `complete`.

- [ ] **Step 1: Add the failing permission-card regression case**

Inside `assertFormStateRecognition(payload)`, add this case before the existing completed-assistant case:

```js
  assert(
    runCase(({ document, main }) => {
      appendMarker({ document, main }, { "data-content-search-unit-key": "unit:assistant" });
      const permissionCard = document.createElement("div");
      permissionCard.textContent = "权限";
      const allow = document.createElement("button");
      allow.textContent = "允许一次";
      permissionCard.append(allow);
      main.append(permissionCard);
    }) === "approval",
    "a visible native allow-once action must outrank an existing assistant completion marker",
  );
```

- [ ] **Step 2: Run the focused validator and confirm RED**

Run:

```bash
DENIA_VALIDATE_SKIP_STYLESHEET_FIXTURES=1 \
DENIA_VALIDATE_SKIP_MUTATION_FIXTURE=1 \
DENIA_VALIDATE_SKIP_SECURITY_FIXTURE=1 \
node sidecar/tests/validate.mjs sidecar
```

Expected: non-zero exit with `a visible native allow-once action must outrank an existing assistant completion marker`.

- [ ] **Step 3: Implement the narrow approval-action recognizer**

In `approvalVisible()`, after the stable-marker check and before the dialog fallback, add:

```js
    const approvalAction = [...document.querySelectorAll("button")].find((button) => {
      if (!visible(button)) return false;
      const text = (button.innerText || button.textContent || button.getAttribute("aria-label") || "")
        .replace(/\s+/gu, " ")
        .trim();
      return /^(allow once|always allow|允许一次|始终允许)$/iu.test(text);
    });
    if (approvalAction) return true;
```

Do not broaden the existing ordinary `Review changes` behavior.

- [ ] **Step 4: Run the focused validator and confirm GREEN**

Run:

```bash
DENIA_VALIDATE_SKIP_STYLESHEET_FIXTURES=1 \
DENIA_VALIDATE_SKIP_MUTATION_FIXTURE=1 \
DENIA_VALIDATE_SKIP_SECURITY_FIXTURE=1 \
node sidecar/tests/validate.mjs sidecar
```

Expected: exit `0` with `Validated 达妮娅 · 旧日斑斓 extension 0.1.0`.

- [ ] **Step 5: Run the complete Sidecar validation**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
git diff --check
```

Expected: both commands exit `0`.

- [ ] **Step 6: Commit the approval fix**

Run:

```bash
git add sidecar/src/denia-old-days-extension.js sidecar/tests/validate.mjs
git commit -m "fix: detect native permission approval cards"
```

Expected: one commit containing only the approval recognizer and its regression test.

### Task 3: Rebuild, Install, and Verify the Local Experience

**Files:**
- Generate: `theme/background.jpg`
- Generate: `sidecar/assets/*.webp`
- Generate: `evidence/*.png`
- Generate: `sidecar/release/kaboo-local/**`
- Remove locally: `.DS_Store`
- Remove locally: `sidecar/release/denia-old-days-v0.1.0.zip`

**Interfaces:**
- Consumes: the cleaned source tree and approval-state fix from Tasks 1–2.
- Produces: an updated local package and an active Sidecar whose renderer verifier returns `pass: true`.

- [ ] **Step 1: Regenerate all ignored image derivatives**

Run:

```bash
KABOO_SHARP_ENTRY=/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/lib/index.js \
node scripts/render-assets.mjs
```

Expected: exit `0`; all current runtime WebP and evidence PNG files exist.

- [ ] **Step 2: Run source and Sidecar checks**

Run:

```bash
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
```

Expected: both commands exit `0`.

- [ ] **Step 3: Rebuild the Kaboo local package**

Run:

```bash
KABOO_SHARP_ENTRY=/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/lib/index.js \
node scripts/build-local-kaboo-release.mjs
```

Expected: exit `0`; JSON output names `denia-old-days@0.1.0`, a new bundle SHA-256, and the Bash launcher path.

- [ ] **Step 4: Remove only the two approved non-image local artifacts**

Use `apply_patch` for tracked files. For the ignored `.DS_Store` and old standalone ZIP, move them to the macOS Trash if they exist. Do not remove `sidecar/release/kaboo-local/` or any image.

- [ ] **Step 5: Install and hot-activate exactly once**

Run:

```bash
KABOO_AUTO_UPDATE=0 /Users/bytedance/.local/share/kaboo/bin/kaboo-cli \
  codex-theme install-local \
  /Users/bytedance/workspace/denia-old-days-codex-theme/sidecar/release/kaboo-local/denia-old-days/0.1.0/catalog-version.json
```

If the command reports `active`, do not run a second activation command. If it reports `prepared`, run exactly once:

```bash
KABOO_AUTO_UPDATE=0 /Users/bytedance/.local/share/kaboo/bin/kaboo-cli \
  codex-theme activate denia-old-days
```

Expected: hot activation succeeds without restarting Codex.

- [ ] **Step 6: Verify the final state**

Run:

```bash
KABOO_AUTO_UPDATE=0 /Users/bytedance/.local/share/kaboo/bin/kaboo-cli codex-theme status denia-old-days
"/Users/bytedance/Library/Application Support/CodexDreamSkinExtensions/denia-old-days/package/scripts/verify.sh"
git status --short
```

Expected: Kaboo reports `activation=active`; Sidecar verification returns `installed: true`, `pass: true`; the tracked worktree is clean.
