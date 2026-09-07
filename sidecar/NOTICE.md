# Package notice

## Package contents

`denia-old-days@0.1.2` contains one Codex Dream Skin base theme, one removable
Sidecar, package-local WebP artwork, two GitHub previews, beginner installer
scripts, and a machine-readable layout contract.

## Runtime boundary

The package requires the public
[Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) engine. That
engine is not bundled here. The Sidecar connects only to its verified loopback
CDP endpoint. Its primary target is `app://-/index.html`; compatible `app://`
renderer variants must pass an in-page Codex identity probe. It does not
request remote assets or change the Codex application, account, model, or API
configuration.

## Verification

`sidecar/scripts/health.sh` checks the current renderer without navigation.
`sidecar/scripts/verify.sh` runs the four targets declared by
`sidecar/layout-contract.json`. Release files are covered by the root
`SHA256SUMS` manifest.

## Licensing and artwork

The software in this repository is provided under the root `LICENSE`.
Third-party character artwork is not relicensed by that software license.
Source URLs and exact source hashes are recorded in `canon/sources.md` in the
GitHub repository.
