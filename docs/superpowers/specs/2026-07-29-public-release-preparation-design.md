# Denia Old Days Public Release Preparation Design

## Goal

Prepare the Denia Old Days Codex theme source repository for a first public
GitHub release and a Kaboo Registry submission without changing the current
theme appearance.

The finished repository must:

- contain only the canonical source, tests, documentation, and small public
  previews needed to understand and reproduce the theme;
- satisfy the current Kaboo Codex Dream Skin package protocol;
- build the same release archive from two clean output directories;
- expose a concise GitHub README and complete ignore rules;
- publish from one clean root commit while preserving the existing history in
  a verified Git bundle outside the repository.

## Public repository boundary

Keep:

- root project metadata: `README.md`, `LICENSE`, `.gitignore`, `package.json`,
  and `package-lock.json`;
- `theme/` source metadata;
- `sidecar/` source, lifecycle scripts, runtime, tests, license, notice, and
  layout contract;
- `scripts/` source checks, asset renderer, release input map, and Kaboo
  release builder;
- the exact files under `art/source/` required by the asset renderer;
- a concise asset inventory with source paths, output paths, dimensions, and
  checksums;
- two compressed publication previews used by the GitHub README and Kaboo
  release.

Remove from the public tree:

- `art/reference/`;
- `art/archive/`;
- completed design and implementation records under `docs/superpowers/`;
- `docs/current-theme-design.md`;
- tracked and untracked validation evidence under `evidence/`;
- generated theme and Sidecar image assets;
- generated release packages;
- local runtime, dependency, worktree, editor, and operating-system files.

Generated assets remain reproducible from `art/source/` through
`scripts/render-assets.mjs`. The normal check and release commands generate
their inputs before validating or packaging them.

## Documentation

Rewrite the root README for a public repository. It contains:

1. a short theme description and two optimized previews;
2. supported platform and runtime requirements;
3. installation through Kaboo;
4. source checkout, dependency installation, asset generation, and checks;
5. local Kaboo build, executable preview, installation, verification, and
   publication commands;
6. the immutable version rule;
7. the reduced public directory map and security boundary.

The README does not state that artwork is licensed, authorized, safe to
redistribute, or legally risk-free. It also does not add a legal analysis.
The package keeps the `LICENSE` and `NOTICE.md` files required by the Kaboo
protocol.

The root license applies to original project code and documentation. The
Sidecar retains the same license text so the source tree and release archive
remain consistent.

## Ignore rules

The root `.gitignore` covers:

- macOS, Windows, and common editor metadata;
- Node dependencies, package-manager caches, logs, coverage, and temporary
  files;
- `.env` variants while allowing an example environment file;
- local worktrees and agent/runtime state;
- generated Base Theme and Sidecar image assets;
- local screenshots, executable-preview evidence, and test evidence;
- Kaboo release directories and archives.

`package-lock.json`, source manifests, tests, and the two curated public
previews remain tracked.

## Kaboo package compliance

Keep the first release identity at `denia-old-days@0.1.0`.

Add `sidecar/layout-contract.json` and reference it through
`sidecar/extension.json`. The contract uses schema version 1 and CSS-pixel
coordinates. It declares four targets:

- `home-desktop` at 1440×900;
- `home-narrow` at 390×844;
- `task-desktop` at 1440×900;
- `task-narrow` at 390×844.

Assertions cover:

- no horizontal overflow;
- expected theme route and extension state;
- visible composer on supported surfaces;
- visible home hero and prompt on home targets;
- correct task route, task artwork visibility policy, and readable task
  surface on task targets;
- viewport-relative alignment or size where absolute pixels would be brittle.

The Sidecar verifier writes one JSON document to stdout and diagnostics to
stderr. Its `targets` array exactly matches the layout contract. The loader
retains its existing install, remove, watch, screenshot, and diagnostic
behavior; package verification normalizes live measurements into the contract
shape.

The release builder generates a ZIP root README beginning with
`<!-- kaboo-theme-readme:v1 -->`. It identifies the exact package and minimum
Dream Skin runtime, then includes these required sections:

- `Runtime dependencies`;
- `Rendering architecture`;
- `Layout verification`;
- `AI adaptation fallback`;
- `Troubleshooting`.

The generated README points to `sidecar/layout-contract.json`, includes the
exact `kaboo-cli codex-theme verify denia-old-days` command, and directs
repairs to canonical source followed by a new semantic version.

The archive keeps exactly one top-level directory and includes the required
manifest, theme, Sidecar, previews, `SHA256SUMS`, README, license, and notice.
Every regular file except `SHA256SUMS` appears once in the checksum file.

## Build and verification

The source verification sequence is:

```bash
npm ci
npm run build:assets
npm run check
npm run build:kaboo
```

Run the Kaboo build into two clean temporary output directories. Compare
`bundle.zip` byte size and SHA-256. Both must match.

For each release:

- run the Sidecar validator;
- run `bash -n` for every shell file;
- run `node --check` for JavaScript and MJS files;
- run `unzip -t` for the final archive;
- validate manifest identity/version agreement;
- validate the v1 package README and layout contract;
- inspect the archive entry list and `SHA256SUMS`;
- scan tracked files for secrets, internal absolute paths, deleted-directory
  references, and generated artifacts.

If a compatible `kaboo-cli` is installed, run `preview-local`,
`install-local`, and `verify` against the exact final catalog. Missing local
Kaboo credentials or CLI installation is reported as an external verification
boundary rather than bypassed.

## Git history migration

Before changing history:

1. create a complete `--all` Git bundle outside the repository;
2. run `git bundle verify`;
3. record the bundle path and original HEAD.

After implementation and verification:

1. create an orphan public-release branch from the cleaned working tree;
2. commit the complete public tree once with a Conventional Commit message;
3. replace local `main` with the orphan branch;
4. remove references and reflogs to the old history only after bundle
   verification;
5. prune unreachable objects and confirm the resulting repository size;
6. verify that `main` contains one commit and a clean working tree.

No remote is added, no force push is performed, and no Kaboo publication is
executed.

## Acceptance criteria

- Removed archives, historical plans, evidence, and generated assets are not
  tracked.
- A fresh clone can install dependencies, render assets, pass checks, and
  build the Kaboo release.
- The two clean release builds have identical ZIP size and SHA-256.
- The release package satisfies the current Kaboo structure, README v1,
  layout-contract, checksum, and immutable-version rules.
- The root README contains working GitHub and Kaboo commands.
- The final `.gitignore` covers all generated and local-only files.
- The external Git bundle verifies and preserves the original 200-commit
  history.
- The final `main` branch contains one clean public-release commit.
