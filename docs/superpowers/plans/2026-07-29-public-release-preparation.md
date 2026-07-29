# Denia Old Days Public Release Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a minimal public source repository and a deterministic Kaboo-compatible `denia-old-days@0.1.0` release without changing the theme appearance.

**Architecture:** Keep canonical image inputs and Sidecar source in Git, generate runtime images and package artifacts locally, and validate the final ZIP through a focused source contract plus archive validator. Preserve the old repository in an external Git bundle, then replace `main` with one verified public-release commit.

**Tech Stack:** Node.js 20+, ECMAScript modules, `node:test`, Sharp 0.34.5, Bash, Git, Kaboo Codex Dream Skin schema v1.

## Global Constraints

- Keep the release identity exactly `denia-old-days@0.1.0`.
- Keep `requirements.codexDreamSkinStudio` at `>=1.2.0`.
- Do not change the existing theme appearance or runtime behavior outside verification output.
- Keep runtime network access disabled and restart policy `explicit-only`.
- The ZIP must have one root named `codex-dream-skin-denia-old-days-0.1.0`.
- The package README must use the `<!-- kaboo-theme-readme:v1 -->` contract.
- The layout contract must use schema version 1 and `css-pixel` coordinates.
- Do not configure a remote, push GitHub, or publish to Kaboo.
- Do not add README claims about artwork authorization or legal safety.

---

### Task 1: Preserve the original repository history

**Files:**
- Create outside repository: `/Users/bytedance/workspace/denia-old-days-codex-theme-prepublish-2026-07-29.bundle`
- Record in implementation handoff: original HEAD commit

**Interfaces:**
- Consumes: current `main` with 201 commits after the approved design commit
- Produces: a verified full-history Git bundle used as the recovery boundary for later cleanup

- [ ] **Step 1: Confirm the source branch and working tree**

Run:

```bash
git status --short --branch
git rev-parse HEAD
git rev-list --count HEAD
```

Expected: branch is `main`, the only pending file is this implementation plan before its plan commit, and the commit count is 201.

- [ ] **Step 2: Commit the implementation plan**

```bash
git add docs/superpowers/plans/2026-07-29-public-release-preparation.md
git commit -m "docs: plan public release preparation"
```

Expected: one documentation commit and a clean working tree.

- [ ] **Step 3: Create the complete history bundle**

```bash
git bundle create /Users/bytedance/workspace/denia-old-days-codex-theme-prepublish-2026-07-29.bundle --all
git bundle verify /Users/bytedance/workspace/denia-old-days-codex-theme-prepublish-2026-07-29.bundle
```

Expected: verification reports a complete history and lists `refs/heads/main`.

---

### Task 2: Add a public-source contract test

**Files:**
- Create: `scripts/public-release-contract.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: repository root resolved from `import.meta.dirname`
- Produces: `npm run test:release`, a zero-network source-tree gate

- [ ] **Step 1: Write the failing source contract**

Create `scripts/public-release-contract.test.mjs` with focused tests:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const json = (relative) => JSON.parse(read(relative));

test("public tree excludes local archives and evidence", () => {
  for (const relative of [
    "art/archive",
    "art/reference",
    "docs/superpowers",
    "docs/current-theme-design.md",
    "evidence",
  ]) {
    assert.equal(fs.existsSync(path.join(root, relative)), false, `${relative} must not ship`);
  }
});

test("Kaboo source declares the layout contract", () => {
  const extension = json("sidecar/extension.json");
  const contract = json("sidecar/layout-contract.json");
  assert.equal(extension.layoutContract, "layout-contract.json");
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.packageId, extension.id);
  assert.equal(contract.packageVersion, extension.version);
  assert.deepEqual(
    contract.requiredTargets.map(({ id }) => id),
    ["home-desktop", "home-narrow", "task-desktop", "task-narrow"],
  );
});

test("public README exposes reproducible Kaboo commands", () => {
  const readme = read("README.md");
  for (const token of [
    "npm ci",
    "npm run build:assets",
    "npm run check",
    "npm run build:kaboo",
    "kaboo-cli codex-theme preview-local",
    "kaboo-cli codex-theme install-local",
    "kaboo-cli codex-theme verify denia-old-days",
    "kaboo-cli codex-theme publish",
  ]) assert.match(readme, new RegExp(token.replace(/[.*+?^${}()|[\\]\\\\]/gu, "\\\\$&"), "u"));
});
```

Add this script to `package.json`:

```json
{
  "scripts": {
    "test:release": "node --test scripts/public-release-contract.test.mjs"
  }
}
```

- [ ] **Step 2: Run the test and confirm the intended failures**

Run:

```bash
npm run test:release
```

Expected: failures report the still-present archive/evidence directories, missing `sidecar/layout-contract.json`, and incomplete README commands.

- [ ] **Step 3: Commit the failing release contract**

```bash
git add package.json scripts/public-release-contract.test.mjs
git commit -m "test: define public release contract"
```

---

### Task 3: Reduce the source tree and make assets reproducible

**Files:**
- Delete: `art/archive/`
- Delete: `art/reference/`
- Delete: `docs/current-theme-design.md`
- Delete: `docs/superpowers/`
- Delete: `evidence/`
- Delete tracked generated file: `sidecar/assets/denia-home-dark.webp`
- Modify: `scripts/render-assets.mjs`
- Modify: `scripts/release-inputs.mjs`
- Modify: `scripts/check-source.mjs`
- Modify: `package.json`
- Create: `previews/home.webp`
- Create: `previews/task.webp`
- Rewrite: `canon/sources.md`

**Interfaces:**
- Consumes: the ten canonical files in `RENDERER_SOURCE_INPUTS`
- Produces: `npm run build:assets`, generated `theme/background.jpg`, generated `sidecar/assets/*.webp`, and two tracked optimized previews

- [ ] **Step 1: Remove the approved public-tree exclusions**

Run explicit path removal after Task 1 bundle verification:

```bash
git rm -r art/archive art/reference docs/current-theme-design.md docs/superpowers evidence
git rm sidecar/assets/denia-home-dark.webp
```

Expected: only approved archives, evidence, completed plans/specs, and the tracked generated WebP are staged for deletion.

- [ ] **Step 2: Redirect preview generation away from evidence**

In `scripts/render-assets.mjs`, create `previews/` with the existing output directories and write the publication previews directly:

```js
fs.mkdir(output("previews"), { recursive: true }),
```

Replace evidence writes with:

```js
sharp(homePreview)
  .resize({ width: 1600, withoutEnlargement: true })
  .webp({ quality: 82, effort: 6 })
  .toFile(output("previews/home.webp")),
sharp(taskWorking)
  .resize({ width: 1600, withoutEnlargement: true })
  .webp({ quality: 82, effort: 6 })
  .toFile(output("previews/task.webp")),
```

Keep any intermediate images in memory. Do not recreate the deleted `evidence/` directory.

- [ ] **Step 3: Point release inputs at the public previews**

Update `scripts/release-inputs.mjs`:

```js
export const RELEASE_COPY_SOURCES = Object.freeze({
  sidecar: "sidecar",
  themeDefinition: "theme/theme.json",
  themeBackground: "theme/background.jpg",
  homePreview: "previews/home.webp",
  taskPreview: "previews/task.webp",
  license: "LICENSE",
  notice: "sidecar/NOTICE.md",
});
```

- [ ] **Step 4: Remove archive and evidence assumptions from source checks**

In `scripts/check-source.mjs`:

- restrict required source directories to `canon`, `art/source`, `theme`, `sidecar`, and `previews`;
- remove every `art/archive`, `art/reference`, and `evidence/` hash/dimension assertion;
- require `previews/home.webp` and `previews/task.webp`;
- keep exact checks for canonical image inputs, generated runtime assets, release inputs, security markers, and runtime behavior.

- [ ] **Step 5: Add asset scripts**

Set the package scripts to:

```json
{
  "scripts": {
    "build:assets": "node scripts/render-assets.mjs",
    "build:kaboo": "npm run build:assets && node scripts/build-local-kaboo-release.mjs",
    "check": "npm run build:assets && node scripts/check-source.mjs && node sidecar/tests/validate.mjs sidecar && npm run test:release",
    "test:release": "node --test scripts/public-release-contract.test.mjs"
  }
}
```

- [ ] **Step 6: Rewrite the asset inventory**

Keep `canon/sources.md` limited to:

- each retained file under `art/source/`;
- its output asset path;
- source dimensions and SHA-256;
- output dimensions and SHA-256;
- the public source URL when already known.

Remove deleted internal library paths, curation notes, legal conclusions, and evidence image records.

- [ ] **Step 7: Generate and inspect assets**

Run:

```bash
npm run build:assets
file previews/home.webp previews/task.webp theme/background.jpg sidecar/assets/*.webp
```

Expected: both previews are WebP, the Base Theme background is JPEG, and all Sidecar manifest assets exist.

- [ ] **Step 8: Run focused checks**

Run:

```bash
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
```

Expected: source and Sidecar checks pass after their assertions are updated.

- [ ] **Step 9: Commit the source reduction**

```bash
git add art canon package.json scripts sidecar previews theme
git commit -m "chore: reduce public theme sources"
```

---

### Task 4: Add the Kaboo layout contract and verifier output

**Files:**
- Create: `sidecar/layout-contract.json`
- Modify: `sidecar/extension.json`
- Modify: `sidecar/runtime/loader.mjs`
- Modify: `sidecar/tests/validate.mjs`
- Modify: `scripts/public-release-contract.test.mjs`

**Interfaces:**
- Consumes: live measurements from the existing `verifyExpression`
- Produces: `verify.sh` stdout shaped as `{ "targets": LayoutTargetResult[] }`, with IDs matching the contract

- [ ] **Step 1: Extend the failing contract tests**

Add tests that assert:

```js
const contract = json("sidecar/layout-contract.json");
assert.equal(contract.coordinateSpace, "css-pixel");
assert.deepEqual(
  contract.requiredTargets.map(({ viewport }) => viewport),
  [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ],
);
assert.ok(contract.assertions.length >= 4);
assert.ok(contract.assertions.every(({ path, otherPath }) =>
  path.startsWith("targets.*.") && (!otherPath || otherPath.startsWith("targets.*."))));
```

Extend `sidecar/tests/validate.mjs` to require:

```js
assert(manifest.layoutContract === "layout-contract.json", "manifest must declare layout contract");
assert(loader.includes("collectLayoutTargets"), "loader must collect the layout target matrix");
assert(loader.includes("targets: layoutTargets"), "verify stdout must expose contract targets");
```

- [ ] **Step 2: Run tests to verify the contract is absent**

Run:

```bash
node --test scripts/public-release-contract.test.mjs
node sidecar/tests/validate.mjs sidecar
```

Expected: failures name the missing layout contract and verifier collector.

- [ ] **Step 3: Create the layout contract**

Create `sidecar/layout-contract.json` with package identity, four target records, and assertions over these normalized result fields:

```json
{
  "schemaVersion": 1,
  "packageId": "denia-old-days",
  "packageVersion": "0.1.0",
  "coordinateSpace": "css-pixel",
  "requiredTargets": [
    {"id":"home-desktop","route":"/","viewport":{"width":1440,"height":900}},
    {"id":"home-narrow","route":"/","viewport":{"width":390,"height":844}},
    {"id":"task-desktop","route":"/task/current","viewport":{"width":1440,"height":900}},
    {"id":"task-narrow","route":"/task/current","viewport":{"width":390,"height":844}}
  ],
  "assertions": [
    {"id":"extension-active","type":"equals","path":"targets.*.result.extensionActive","expected":true},
    {"id":"surface-matches","type":"equals","path":"targets.*.result.surfaceMatches","expected":true},
    {"id":"no-overflow","type":"equals","path":"targets.*.result.overflowX","expected":false},
    {"id":"composer-visible","type":"equals","path":"targets.*.result.composerVisible","expected":true},
    {"id":"viewport-width","type":"delta","path":"targets.*.result.viewport.width","otherPath":"targets.*.viewport.width","min":0,"max":0},
    {"id":"viewport-height","type":"delta","path":"targets.*.result.viewport.height","otherPath":"targets.*.viewport.height","min":0,"max":0},
    {"id":"surface-readable","type":"equals","path":"targets.*.result.surfaceReadable","expected":true}
  ]
}
```

- [ ] **Step 4: Reference the contract from the extension**

Add beside `entrypoints` in `sidecar/extension.json`:

```json
"layoutContract": "layout-contract.json",
```

- [ ] **Step 5: Normalize live measurements**

In `sidecar/runtime/loader.mjs`:

- securely resolve and parse `manifest.layoutContract`;
- validate package ID/version agreement;
- add `collectLayoutTargets(session)` which preserves the original viewport and current surface, uses CDP device metrics for the four declared viewports, measures the live home/task surfaces, and restores the original state in `finally`;
- normalize every result to:

```js
{
  id: target.id,
  route: target.route,
  viewport: target.viewport,
  result: {
    extensionActive: measurement.id === manifest.id && measurement.installed,
    surfaceMatches: target.id.startsWith("home-") ? measurement.home : measurement.taskMode,
    overflowX: measurement.overflowX,
    composerVisible: measurement.composer?.visible === true,
    surfaceReadable: target.id.startsWith("home-")
      ? measurement.homeLayoutPreserved === true && measurement.heroCopy?.visible === true
      : measurement.taskPass === true,
    viewport: measurement.viewport,
  },
}
```

Diagnostics about unavailable routes go to stderr. The JSON stdout remains a single document. Existing `--once`, `--remove-once`, and `--watch` results remain unchanged.

- [ ] **Step 6: Run contract and Sidecar tests**

Run:

```bash
node --test scripts/public-release-contract.test.mjs
node sidecar/tests/validate.mjs sidecar
node --check sidecar/runtime/loader.mjs
bash -n sidecar/scripts/verify.sh
```

Expected: all static contract checks pass.

- [ ] **Step 7: Commit the layout protocol**

```bash
git add sidecar scripts/public-release-contract.test.mjs
git commit -m "feat: add Kaboo layout contract"
```

---

### Task 5: Generate and validate the current Kaboo package contract

**Files:**
- Modify: `scripts/build-local-kaboo-release.mjs`
- Create: `scripts/validate-kaboo-release.mjs`
- Modify: `scripts/public-release-contract.test.mjs`
- Modify: `package.json`
- Create: `LICENSE`
- Rewrite: `sidecar/NOTICE.md`

**Interfaces:**
- Consumes: a built `catalog-version.json` and sibling `bundle.zip`
- Produces: `node scripts/validate-kaboo-release.mjs <catalog>`, a local archive protocol gate

- [ ] **Step 1: Write failing package validation tests**

Add `scripts/validate-kaboo-release.mjs` with validations for:

- catalog ID/version/artifact filename;
- exact ZIP size and SHA-256;
- one expected archive root;
- required paths;
- only `theme/theme.json` and `theme/background.jpg` below `theme/`;
- three-way ID/version agreement;
- extension layout-contract reference and contract identity;
- package README v1 marker and required headings;
- checksum separator, normalized paths, unique coverage, and exact file hashes.

Expose:

```js
export async function validateKabooRelease(catalogPath) {
  return {
    packageId: "denia-old-days",
    version: "0.1.0",
    artifactSha256: catalog.artifactSha256,
    archiveFiles: catalog.archiveFiles,
  };
}
```

The CLI entry prints the returned JSON and exits nonzero on the first protocol error.

- [ ] **Step 2: Run the validator against the current build**

Run:

```bash
npm run build:kaboo
node scripts/validate-kaboo-release.mjs sidecar/release/kaboo-local/denia-old-days/0.1.0/catalog-version.json
```

Expected: failure reports the missing README v1 marker or layout contract.

- [ ] **Step 3: Generate the required package README**

Replace the builder's package README with content beginning:

```markdown
<!-- kaboo-theme-readme:v1 -->
# 达妮娅 · 旧日斑斓

Package: `denia-old-days@0.1.0`
Dream Skin runtime: `>=1.2.0`

## Runtime dependencies
## Rendering architecture
## Layout verification
## AI adaptation fallback
## Troubleshooting
```

The full generated text must state:

- no external Dream Skin checkout, Skill, Plugin, or global Node.js is needed for installation;
- normal use does not start, stop, or restart Codex;
- the contract is `sidecar/layout-contract.json`;
- the exact check is `kaboo-cli codex-theme verify denia-old-days`;
- installed checksum-protected files under `~/Library/Application Support` must not be patched;
- repairs happen in canonical source, add a regression assertion, pass every target, and publish a new semantic version.

- [ ] **Step 4: Keep a protocol-only notice**

Create root `LICENSE` from the existing Sidecar MIT license and keep
`sidecar/NOTICE.md` limited to package identity, source file inventory, and
runtime security properties. Do not add authorization or legal-safety claims.

- [ ] **Step 5: Add the release validator to package scripts**

Add:

```json
{
  "scripts": {
    "check:kaboo": "node scripts/validate-kaboo-release.mjs sidecar/release/kaboo-local/denia-old-days/0.1.0/catalog-version.json"
  }
}
```

- [ ] **Step 6: Build and validate**

Run:

```bash
npm run build:kaboo
npm run check:kaboo
```

Expected: the build succeeds and the validator prints package ID, version, archive SHA-256, and archive file count.

- [ ] **Step 7: Commit Kaboo package compliance**

```bash
git add LICENSE package.json scripts sidecar
git commit -m "build: align Kaboo package protocol"
```

---

### Task 6: Rewrite public documentation and ignore rules

**Files:**
- Rewrite: `.gitignore`
- Rewrite: `README.md`
- Modify: `scripts/public-release-contract.test.mjs`

**Interfaces:**
- Consumes: actual package scripts and release paths from Tasks 3–5
- Produces: clone-to-build and Kaboo publication instructions with no stale path

- [ ] **Step 1: Extend documentation assertions**

Require the README to include:

```js
for (const token of [
  "Node.js 20",
  "macOS",
  "previews/home.webp",
  "previews/task.webp",
  "sidecar/release/kaboo-local/denia-old-days/0.1.0/catalog-version.json",
  "Changing any published package byte requires a new semantic version.",
]) assert.ok(readme.includes(token), `README missing ${token}`);
```

Require `.gitignore` to cover:

```js
for (const pattern of [
  ".DS_Store",
  ".idea/",
  ".vscode/",
  "node_modules/",
  ".env*",
  ".runtime/",
  ".superpowers/",
  ".worktrees/",
  "theme/background.jpg",
  "sidecar/assets/*.webp",
  "sidecar/release/",
  "preview-evidence-*/",
]) assert.ok(ignore.split(/\r?\n/u).includes(pattern), `.gitignore missing ${pattern}`);
```

- [ ] **Step 2: Run tests and confirm stale docs fail**

Run:

```bash
node --test scripts/public-release-contract.test.mjs
```

Expected: README and `.gitignore` assertions fail before rewrites.

- [ ] **Step 3: Rewrite `.gitignore`**

Group exact patterns under comments for operating systems, editors, Node,
environment files, local agent/runtime state, generated theme assets, evidence,
and Kaboo releases. Keep:

```gitignore
.env*
!.env.example
```

- [ ] **Step 4: Rewrite `README.md`**

Use these sections:

```markdown
# Denia Old Days for Codex
## Preview
## Requirements
## Install from Kaboo
## Build from source
## Build a local Kaboo release
## Validate before publishing
## Publish to Kaboo
## Repository structure
## Runtime boundary
```

Use the exact npm and Kaboo commands implemented in the repository. Show both
preview images with relative Markdown paths. State the semantic-version
immutability rule in English exactly as tested.

- [ ] **Step 5: Run documentation tests**

Run:

```bash
node --test scripts/public-release-contract.test.mjs
git diff --check
```

Expected: all public-source contract tests pass and Markdown has no whitespace errors.

- [ ] **Step 6: Commit public documentation**

```bash
git add .gitignore README.md scripts/public-release-contract.test.mjs
git commit -m "docs: prepare GitHub release guide"
```

---

### Task 7: Verify reproducibility and the complete public tree

**Files:**
- No source changes expected
- Generate ignored outputs under two temporary directories

**Interfaces:**
- Consumes: cleaned source tree and all build/check scripts
- Produces: fresh evidence for tests, archive integrity, and deterministic output

- [ ] **Step 1: Reinstall from the lockfile**

Remove the explicit local dependency directory, then run:

```bash
npm ci
```

Expected: dependencies install from `package-lock.json` with exit code 0.

- [ ] **Step 2: Run the full repository check**

```bash
npm run check
```

Expected: source checks, Sidecar checks, and public-release tests all pass.

- [ ] **Step 3: Build twice into clean temporary directories**

```bash
release_a="$(mktemp -d /tmp/denia-kaboo-a.XXXXXX)"
release_b="$(mktemp -d /tmp/denia-kaboo-b.XXXXXX)"
node scripts/build-local-kaboo-release.mjs --output "$release_a"
node scripts/build-local-kaboo-release.mjs --output "$release_b"
```

Expected: both commands emit a catalog for `denia-old-days@0.1.0`.

- [ ] **Step 4: Compare artifact bytes**

```bash
shasum -a 256 \
  "$release_a/denia-old-days/0.1.0/bundle.zip" \
  "$release_b/denia-old-days/0.1.0/bundle.zip"
stat -f '%z %N' \
  "$release_a/denia-old-days/0.1.0/bundle.zip" \
  "$release_b/denia-old-days/0.1.0/bundle.zip"
cmp \
  "$release_a/denia-old-days/0.1.0/bundle.zip" \
  "$release_b/denia-old-days/0.1.0/bundle.zip"
```

Expected: SHA-256 and byte size match, and `cmp` exits 0.

- [ ] **Step 5: Validate both release directories**

```bash
node scripts/validate-kaboo-release.mjs "$release_a/denia-old-days/0.1.0/catalog-version.json"
node scripts/validate-kaboo-release.mjs "$release_b/denia-old-days/0.1.0/catalog-version.json"
unzip -t "$release_a/denia-old-days/0.1.0/bundle.zip"
```

Expected: both validators succeed and unzip reports no errors.

- [ ] **Step 6: Validate executable syntax**

```bash
find sidecar -type f -name '*.sh' -print0 | xargs -0 -n1 bash -n
find scripts sidecar -type f \( -name '*.js' -o -name '*.mjs' \) -print0 | xargs -0 -n1 node --check
```

Expected: every file exits 0.

- [ ] **Step 7: Audit the tracked public tree**

Run:

```bash
git ls-files
git status --ignored --short
rg -n '/Users/bytedance|art/reference|art/archive|docs/superpowers|evidence/' \
  --glob '!package-lock.json' \
  --glob '!scripts/public-release-contract.test.mjs' .
git grep -nE '(BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,})'
git diff --check
git status --short
```

Expected: no private paths, stale deleted-directory references, common secret
tokens, whitespace errors, or unexpected tracked/generated files remain.

- [ ] **Step 8: Record Kaboo live-check boundary**

Run:

```bash
command -v kaboo-cli
```

If present, run `preview-local` for all four target IDs, then `install-local`
and `verify denia-old-days`. If absent, record that static package validation
and deterministic archive checks passed while live Kaboo verification remains
external.

---

### Task 8: Replace `main` with one public-release commit

**Files:**
- Rewrite Git references and object database only
- Preserve: `/Users/bytedance/workspace/denia-old-days-codex-theme-prepublish-2026-07-29.bundle`

**Interfaces:**
- Consumes: verified clean working tree from Task 7
- Produces: local `main` with exactly one root commit and no old reachable objects

- [ ] **Step 1: Reverify the recovery bundle**

```bash
git bundle verify /Users/bytedance/workspace/denia-old-days-codex-theme-prepublish-2026-07-29.bundle
```

Expected: verification succeeds immediately before history replacement.

- [ ] **Step 2: Create the orphan public branch**

```bash
git switch --orphan codex/public-release
git add -A
git commit -m "feat: release Denia Old Days Codex theme"
```

Expected: the commit is a root commit containing the complete cleaned source tree.

- [ ] **Step 3: Replace local main**

```bash
git branch -D main
git branch -m main
```

Expected: the current branch is `main` and points at the new root commit.

- [ ] **Step 4: Remove old local object reachability**

After confirming the bundle again:

```bash
git reflog expire --expire=now --all
git gc --prune=now
```

Expected: old history remains available only through the external verified bundle.

- [ ] **Step 5: Remove local-only generated content**

Remove only explicit ignored targets:

```bash
rm -rf \
  .superpowers \
  .worktrees \
  node_modules \
  sidecar/release \
  theme/background.jpg
find . -name .DS_Store -type f -delete
find sidecar/assets -type f -name '*.webp' -delete
```

Expected: canonical tracked source and public previews remain; generated runtime files are absent.

- [ ] **Step 6: Verify final Git and repository state**

```bash
git status --short --branch
git rev-list --count HEAD
git log --oneline --decorate
git count-objects -vH
git ls-files | sort
git check-ignore -v node_modules theme/background.jpg sidecar/release/example.zip
```

Expected: clean `main`, one commit, reduced repository object size, minimal tracked tree, and correct ignore matches.

- [ ] **Step 7: Run a clean-clone smoke test**

Clone the local repository to a temporary directory:

```bash
smoke_root="$(mktemp -d /tmp/denia-public-smoke.XXXXXX)"
git clone --no-local . "$smoke_root/repo"
cd "$smoke_root/repo"
npm ci
npm run check
npm run build:kaboo
npm run check:kaboo
```

Expected: a fresh clone recreates every generated input, passes all checks, and builds a valid Kaboo release.

