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
  assert.deepEqual(
    contract.requiredTargets,
    [
      { id: "home-desktop", route: "/", viewport: { width: 1440, height: 900 } },
      { id: "home-narrow", route: "/", viewport: { width: 390, height: 844 } },
      { id: "task-desktop", route: "/task/current", viewport: { width: 1440, height: 900 } },
      { id: "task-narrow", route: "/task/current", viewport: { width: 390, height: 844 } },
    ],
  );
  assert.match(loader, /Emulation\.setDeviceMetricsOverride/u);
  assert.match(loader, /layoutContract\.requiredTargets/u);
  assert.match(loader, /targets:\s*layoutResults/u);
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
  ]) {
    assert.match(readme, new RegExp(escapeRegex(token), "u"), `README missing ${token}`);
  }
});
