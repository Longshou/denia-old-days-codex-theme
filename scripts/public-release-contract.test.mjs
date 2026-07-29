import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const resolve = (relative) => path.join(root, relative);
const exists = (relative) => fs.existsSync(resolve(relative));
const read = (relative) => fs.readFileSync(resolve(relative), "utf8");
const json = (relative) => JSON.parse(read(relative));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

test("public tree excludes local archives and evidence", () => {
  for (const relative of [
    "art/archive",
    "art/reference",
    "docs/superpowers",
    "docs/current-theme-design.md",
    "evidence",
  ]) {
    assert.equal(exists(relative), false, `${relative} must not ship`);
  }
});

test("Kaboo source declares the layout contract", () => {
  assert.ok(exists("sidecar/layout-contract.json"), "sidecar/layout-contract.json must exist");
  const extension = json("sidecar/extension.json");
  const contract = json("sidecar/layout-contract.json");
  const loader = read("sidecar/runtime/loader.mjs");
  assert.equal(extension.layoutContract, "layout-contract.json");
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.packageId, extension.id);
  assert.equal(contract.packageVersion, extension.version);
  assert.equal(contract.coordinateSpace, "css-pixel");
  assert.deepEqual(
    contract.requiredTargets,
    [
      { id: "home-desktop", route: "/", viewport: { width: 1440, height: 900 } },
      { id: "home-narrow", route: "/", viewport: { width: 390, height: 844 } },
      { id: "task-desktop", route: "/task/current", viewport: { width: 1440, height: 900 } },
      { id: "task-narrow", route: "/task/current", viewport: { width: 390, height: 844 } },
    ],
  );
  assert.ok(contract.assertions.length >= 1);
  assert.ok(contract.assertions.every(({ path }) => path.startsWith("targets.*.result.")));
  assert.match(loader, /Emulation\.setDeviceMetricsOverride/u);
  assert.match(loader, /layoutContract\.requiredTargets/u);
  assert.match(loader, /targets:\s*layoutResults/u);
  assert.match(read("sidecar/scripts/install.sh"), /\n  layout-contract\.json \\\n/u);
  assert.match(read("sidecar/scripts/verify.sh"), /--verify/u);
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
    "Changing any published package byte requires a new semantic version.",
  ]) {
    assert.match(readme, new RegExp(escapeRegex(token), "u"), `README missing ${token}`);
  }
  assert.doesNotMatch(readme, /copyright|版权|侵权|侵删|再分发许可|非官方|不隶属/iu);
});

test(".gitignore separates generated and local-only files", () => {
  const ignored = read(".gitignore");
  for (const token of [
    "node_modules/",
    "/theme/background.jpg",
    "/sidecar/assets/*.webp",
    "/sidecar/release/",
    "/evidence/",
    "/art/archive/",
    "/art/reference/",
    "/docs/superpowers/",
    "/.worktrees/",
  ]) {
    assert.match(ignored, new RegExp(escapeRegex(token), "u"), `.gitignore missing ${token}`);
  }
});

test("Kaboo release builder exposes an offline protocol validator", () => {
  assert.ok(exists("scripts/validate-kaboo-release.mjs"), "release validator must exist");
  const packageJson = json("package.json");
  assert.equal(
    packageJson.scripts["check:kaboo"],
    "node scripts/validate-kaboo-release.mjs sidecar/release/kaboo-local/denia-old-days/0.1.0/catalog-version.json",
  );
  const builder = read("scripts/build-local-kaboo-release.mjs");
  for (const token of [
    "<!-- kaboo-theme-readme:v1 -->",
    "## Runtime dependencies",
    "## Rendering architecture",
    "## Layout verification",
    "## AI adaptation fallback",
    "## Troubleshooting",
  ]) {
    assert.match(builder, new RegExp(escapeRegex(token), "u"), `package README missing ${token}`);
  }
});
