# Package notice

## Package contents

`denia-old-days@0.1.0` contains one portable base theme, one removable Sidecar,
package-local WebP artwork, two publication previews, and a machine-readable
layout contract.

## Runtime boundary

The Sidecar connects only to the verified loopback CDP endpoint and the exact
`app://-/index.html` renderer. It does not request remote assets or change the
Codex application, account, model, or API configuration.

## Verification

`sidecar/scripts/verify.sh` emits the target set declared by
`sidecar/layout-contract.json`. Package files are covered by the root
`SHA256SUMS` manifest during Kaboo installation and publication.
