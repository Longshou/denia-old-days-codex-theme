import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const resolve = (relative) => path.join(root, relative);
const exists = (relative) => fs.existsSync(resolve(relative));
const read = (relative) => fs.readFileSync(resolve(relative), "utf8");
const json = (relative) => JSON.parse(read(relative));

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    env: options.env || process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`,
  );
  return result.stdout;
};

test("repository exposes the beginner installer surface", () => {
  for (const relative of [
    "Install Denia Old Days.command",
    "Uninstall Denia Old Days.command",
    "installer/bootstrap-macos.sh",
    "installer/install-macos.sh",
    "installer/uninstall-macos.sh",
    "installer/lib/common.sh",
    "scripts/build-github-release.mjs",
    "scripts/validate-github-release.mjs",
  ]) {
    assert.ok(exists(relative), `${relative} must exist`);
  }

  const packageJson = json("package.json");
  assert.equal(
    packageJson.scripts["build:release"],
    "npm run build:assets && node scripts/build-github-release.mjs",
  );
  assert.equal(
    packageJson.scripts["check:release"],
    "node scripts/validate-github-release.mjs release/denia-old-days-macos.zip",
  );
  assert.deepEqual(
    Object.keys(packageJson.scripts).sort(),
    ["build:assets", "build:release", "check", "check:release", "test:release"].sort(),
  );
});

test("README gives a true copy-paste path and a double-click path", () => {
  const readme = read("README.md");
  for (const token of [
    "Fei-Away/Codex-Dream-Skin",
    "Install Denia Old Days.command",
    "curl -fsSL",
    "installer/bootstrap-macos.sh",
    "sidecar/scripts/health.sh",
    "Uninstall Denia Old Days.command",
    "npm run build:release",
    "npm run check:release",
  ]) {
    assert.ok(readme.includes(token), `README missing ${token}`);
  }
});

test("release builder creates one self-contained macOS ZIP", async (context) => {
  assert.ok(exists("scripts/build-github-release.mjs"), "GitHub release builder must exist");
  const temporary = await fsPromises.mkdtemp(path.join(os.tmpdir(), "denia-github-release-test-"));
  context.after(() => fsPromises.rm(temporary, { recursive: true, force: true }));

  run(process.execPath, ["scripts/build-github-release.mjs", "--output", temporary]);
  const archive = path.join(temporary, "denia-old-days-macos.zip");
  assert.ok(fs.existsSync(archive), "stable release ZIP must exist");

  const entries = run("/usr/bin/unzip", ["-Z1", archive])
    .split(/\r?\n/u)
    .filter(Boolean);
  const releaseRoot = "Denia Old Days";
  const required = [
    "Install Denia Old Days.command",
    "Uninstall Denia Old Days.command",
    "README.md",
    "LICENSE",
    "NOTICE.md",
    "installer/bootstrap-macos.sh",
    "installer/install-macos.sh",
    "installer/uninstall-macos.sh",
    "installer/lib/common.sh",
    "theme/theme.json",
    "theme/background.jpg",
    "sidecar/extension.json",
    "sidecar/runtime/loader.mjs",
    "sidecar/scripts/health.sh",
    "sidecar/scripts/verify.sh",
    "previews/home.webp",
    "previews/task.webp",
    "SHA256SUMS",
  ];
  for (const relative of required) {
    assert.ok(entries.includes(`${releaseRoot}/${relative}`), `ZIP missing ${relative}`);
  }
  assert.ok(entries.some((entry) => entry.startsWith(`${releaseRoot}/sidecar/assets/`)));
});
