import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const sourceRoot = path.resolve(import.meta.dirname, "..");
const archivePath = path.resolve(
  process.argv[2] || path.join(sourceRoot, "release/denia-old-days-macos.zip"),
);
assert(process.argv.length <= 3, "usage: node scripts/validate-github-release.mjs [archive.zip]");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  return result.stdout || "";
}

async function walkFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    const stat = await fs.lstat(candidate);
    assert(!stat.isSymbolicLink(), `release contains a symbolic link: ${candidate}`);
    if (stat.isDirectory()) files.push(...await walkFiles(candidate));
    else if (stat.isFile()) files.push(candidate);
    else assert.fail(`release contains an unsupported entry: ${candidate}`);
  }
  return files.sort();
}

const sha256 = async (filePath) =>
  crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");

run("/usr/bin/unzip", ["-t", archivePath]);
const archiveEntries = run("/usr/bin/unzip", ["-Z1", archivePath])
  .split(/\r?\n/u)
  .filter(Boolean);
assert(archiveEntries.length > 0, "release ZIP is empty");
assert.equal(new Set(archiveEntries).size, archiveEntries.length, "release ZIP has duplicate paths");
assert.equal(
  new Set(archiveEntries.map((entry) => entry.toLocaleLowerCase("en-US"))).size,
  archiveEntries.length,
  "release ZIP has case-folded duplicate paths",
);
for (const entry of archiveEntries) {
  assert(!entry.startsWith("/") && !entry.includes("\\") && !entry.endsWith("/"), `unsafe ZIP path: ${entry}`);
  assert.equal(path.posix.normalize(entry), entry, `non-normalized ZIP path: ${entry}`);
  assert(!entry.split("/").includes(".."), `parent traversal in ZIP path: ${entry}`);
}

const releaseRootName = "Denia Old Days";
assert.deepEqual(
  [...new Set(archiveEntries.map((entry) => entry.split("/")[0]))],
  [releaseRootName],
  `release ZIP root must be ${releaseRootName}`,
);
const relativeEntries = archiveEntries.map((entry) => entry.slice(releaseRootName.length + 1));
for (const relative of relativeEntries) {
  const top = relative.split("/")[0];
  assert(
    ["installer", "theme", "sidecar", "previews"].includes(top)
      || [
        "Install Denia Old Days.command",
        "Uninstall Denia Old Days.command",
        "README.md",
        "LICENSE",
        "NOTICE.md",
        "release.json",
        "SHA256SUMS",
      ].includes(relative),
    `unexpected release path: ${relative}`,
  );
}
for (const required of [
  "Install Denia Old Days.command",
  "Uninstall Denia Old Days.command",
  "README.md",
  "LICENSE",
  "NOTICE.md",
  "release.json",
  "SHA256SUMS",
  "installer/bootstrap-macos.sh",
  "installer/install-macos.sh",
  "installer/uninstall-macos.sh",
  "installer/lib/common.sh",
  "theme/theme.json",
  "theme/background.jpg",
  "sidecar/extension.json",
  "sidecar/layout-contract.json",
  "sidecar/runtime/loader.mjs",
  "sidecar/scripts/health.sh",
  "sidecar/scripts/verify.sh",
  "sidecar/tests/validate.mjs",
  "previews/home.webp",
  "previews/task.webp",
]) {
  assert(relativeEntries.includes(required), `release ZIP is missing ${required}`);
}

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "denia-release-validation-"));
try {
  run("/usr/bin/unzip", ["-q", archivePath, "-d", temporary]);
  const bundleDir = path.join(temporary, releaseRootName);
  const allFiles = await walkFiles(bundleDir);
  const releaseMetadata = JSON.parse(await fs.readFile(path.join(bundleDir, "release.json"), "utf8"));
  const theme = JSON.parse(await fs.readFile(path.join(bundleDir, "theme/theme.json"), "utf8"));
  const extension = JSON.parse(await fs.readFile(path.join(bundleDir, "sidecar/extension.json"), "utf8"));
  assert.equal(releaseMetadata.id, "denia-old-days");
  assert.equal(theme.id, releaseMetadata.id);
  assert.equal(extension.id, releaseMetadata.id);
  assert.equal(theme.version, releaseMetadata.version);
  assert.equal(extension.version, releaseMetadata.version);
  for (const [relative, constant] of [
    ["installer/lib/common.sh", "THEME_VERSION"],
    ["sidecar/scripts/common.sh", "EXTENSION_VERSION"],
  ]) {
    const source = await fs.readFile(path.join(bundleDir, relative), "utf8");
    const shellVersion = source.match(new RegExp(`^${constant}="([^"]+)"$`, "mu"))?.[1];
    assert.equal(shellVersion, releaseMetadata.version, `${relative} version must match the release`);
  }

  const checksumText = await fs.readFile(path.join(bundleDir, "SHA256SUMS"), "utf8");
  const checksumEntries = new Map();
  for (const line of checksumText.trim().split("\n")) {
    const match = /^([0-9a-f]{64})  ([^\r\n]+)$/u.exec(line);
    assert(match, `invalid SHA256SUMS line: ${line}`);
    assert(!checksumEntries.has(match[2]), `duplicate SHA256SUMS path: ${match[2]}`);
    checksumEntries.set(match[2], match[1]);
  }
  const checksummedFiles = allFiles
    .map((filePath) => path.relative(bundleDir, filePath).split(path.sep).join("/"))
    .filter((relative) => relative !== "SHA256SUMS")
    .sort();
  assert.deepEqual([...checksumEntries.keys()].sort(), checksummedFiles, "SHA256SUMS coverage is incomplete");
  for (const [relative, expected] of checksumEntries) {
    assert.equal(await sha256(path.join(bundleDir, relative)), expected, `checksum mismatch: ${relative}`);
  }

  const executableFiles = allFiles.filter((filePath) =>
    filePath.endsWith(".sh") || filePath.endsWith(".command"));
  assert(executableFiles.length >= 15, "release executable inventory is unexpectedly small");
  for (const filePath of executableFiles) {
    const relative = path.relative(bundleDir, filePath).split(path.sep).join("/");
    const stat = await fs.stat(filePath);
    assert((stat.mode & 0o111) !== 0, `${relative} must be executable`);
    run("/bin/bash", ["-n", filePath]);
  }
  run(process.execPath, [
    path.join(bundleDir, "sidecar/tests/validate.mjs"),
    path.join(bundleDir, "sidecar"),
  ]);
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}

console.log(`GitHub release package ok: ${archivePath} (${archiveEntries.length} files)`);
