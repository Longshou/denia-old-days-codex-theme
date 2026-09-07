import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";

const sourceRoot = path.resolve(import.meta.dirname, "..");
const sourceJson = async (relative) => JSON.parse(await fs.readFile(path.join(sourceRoot, relative), "utf8"));
const packageJson = await sourceJson("package.json");
const sourceExtension = await sourceJson("sidecar/extension.json");
const sourceTheme = await sourceJson("theme/theme.json");
const sourceLayout = await sourceJson("sidecar/layout-contract.json");
const expectedId = "denia-old-days";
const expectedPublisher = "gongwenkang";
const expectedVersion = packageJson.version;
const expectedRoot = `codex-dream-skin-${expectedId}-${expectedVersion}`;
const defaultCatalog = path.join(sourceRoot, "sidecar/release/kaboo-local", expectedId, expectedVersion, "catalog-version.json");

assert(process.argv.length <= 3, "usage: node scripts/validate-kaboo-release.mjs [catalog-version.json]");
assert.equal(sourceExtension.id, expectedId, "source Sidecar id is invalid");
assert.equal(sourceExtension.version, expectedVersion, "source Sidecar version differs from package.json");
assert.equal(sourceExtension.protocol.minimumDreamSkinVersion, "1.2.0", "source Sidecar must retain Dream Skin 1.2.0 support");
assert.equal(sourceTheme.id, expectedId, "source base theme id is invalid");
assert.equal(sourceTheme.version, expectedVersion, "source base theme version differs from package.json");
assert.equal(sourceLayout.packageId, expectedId, "source layout package id is invalid");
assert.equal(sourceLayout.packageVersion, expectedVersion, "source layout version differs from package.json");

const catalogPath = path.resolve(process.argv[2] || defaultCatalog);
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const run = (command, args, encoding = "utf8") => {
  const result = spawnSync(command, args, { encoding, maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
};

const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
const releaseDir = path.dirname(catalogPath);
assert.deepEqual(
  (await fs.readdir(releaseDir)).sort(),
  ["bundle.zip", "catalog-version.json", "manifest.json", "preview-home.webp", "preview-task.webp"],
  "release directory must contain exactly five publishable files",
);
assert.equal(catalog.packageId, expectedId, "catalog packageId is invalid");
assert.equal(catalog.kind, "codex-dream-skin", "catalog kind is invalid");
assert.equal(catalog.version, expectedVersion, "catalog version is invalid");
assert.equal(catalog.artifactFile, "bundle.zip", "catalog artifact must be bundle.zip");

const archivePath = path.join(releaseDir, catalog.artifactFile);
const archiveBytes = await fs.readFile(archivePath);
assert.equal(archiveBytes.length, catalog.artifactBytes, "catalog artifactBytes does not match bundle.zip");
assert.equal(sha256(archiveBytes), catalog.artifactSha256, "catalog artifactSha256 does not match bundle.zip");
run("/usr/bin/unzip", ["-t", archivePath]);

const archiveEntries = run("/usr/bin/unzip", ["-Z1", archivePath]).split(/\r?\n/u).filter(Boolean);
assert(archiveEntries.length > 0, "bundle.zip is empty");
assert.equal(new Set(archiveEntries).size, archiveEntries.length, "bundle.zip contains duplicate paths");
assert.equal(new Set(archiveEntries.map((entry) => entry.toLocaleLowerCase("en-US"))).size, archiveEntries.length, "bundle.zip has case-folded duplicate paths");
for (const entry of archiveEntries) {
  assert(!entry.startsWith("/") && !entry.includes("\\") && !entry.endsWith("/"), `unsafe ZIP path: ${entry}`);
  assert.equal(path.posix.normalize(entry), entry, `non-normalized ZIP path: ${entry}`);
  assert(!entry.split("/").includes(".."), `parent traversal in ZIP path: ${entry}`);
}
assert.deepEqual([...new Set(archiveEntries.map((entry) => entry.split("/")[0]))], [expectedRoot], `bundle.zip root must be ${expectedRoot}`);
const relativeEntries = archiveEntries.map((entry) => entry.slice(expectedRoot.length + 1)).sort();
for (const relative of relativeEntries) {
  const top = relative.split("/")[0];
  assert(
    ["theme", "sidecar", "previews"].includes(top)
      || ["kaboo-package.json", "SHA256SUMS", "README.md", "LICENSE", "NOTICE.md"].includes(relative),
    `unexpected package path: ${relative}`,
  );
}
for (const required of [
  "kaboo-package.json", "SHA256SUMS", "README.md", "LICENSE", "NOTICE.md",
  "theme/theme.json", "theme/background.jpg",
  "sidecar/extension.json", "sidecar/layout-contract.json", "sidecar/runtime/loader.mjs",
  "sidecar/scripts/start.sh", "sidecar/scripts/stop.sh", "sidecar/scripts/verify.sh", "sidecar/tests/validate.mjs",
  "previews/home.webp", "previews/task.webp",
]) assert(relativeEntries.includes(required), `bundle.zip is missing ${required}`);
assert.deepEqual(relativeEntries.filter((entry) => entry.startsWith("theme/")), ["theme/background.jpg", "theme/theme.json"], "theme/ may contain only its portable pair");
assert.deepEqual(relativeEntries.filter((entry) => entry.startsWith("previews/")), ["previews/home.webp", "previews/task.webp"], "previews/ must contain exactly two images");

const archiveFile = (relative) => Buffer.from(run("/usr/bin/unzip", ["-p", archivePath, `${expectedRoot}/${relative}`], null));
const archiveJson = (relative) => JSON.parse(archiveFile(relative).toString("utf8"));
const manifest = archiveJson("kaboo-package.json");
const extension = archiveJson("sidecar/extension.json");
const theme = archiveJson("theme/theme.json");
const layout = archiveJson("sidecar/layout-contract.json");
assert.equal(manifest.schemaVersion, 1, "package schemaVersion is invalid");
assert.equal(manifest.kind, "codex-dream-skin", "package kind is invalid");
assert.equal(manifest.id, expectedId, "package id is invalid");
assert.equal(manifest.version, expectedVersion, "package version is invalid");
assert.deepEqual(manifest.publisher, { id: expectedPublisher, displayName: expectedPublisher }, "package publisher is invalid");
assert.equal(manifest.requirements?.codexDreamSkinStudio, ">=1.2.0", "package must support managed Dream Skin 1.2.0");
assert.equal(manifest.install?.strategy, "kaboo-cli", "package install strategy is invalid");
assert.equal(manifest.install?.restartPolicy, "explicit-only", "package restart policy is invalid");
assert.equal(manifest.theme?.recommendedNativeAppearance, "light", "package native appearance recommendation is invalid");
assert.equal(manifest.security?.transport, "cdp-loopback-v1", "package transport is invalid");
assert.equal(manifest.security?.rendererTarget, "app://-/index.html", "package renderer target is invalid");
assert.equal(manifest.security?.modifiesOfficialApp, false, "package must not modify Codex");
assert.equal(manifest.security?.remoteRequests, false, "package must not request remote assets");
assert.equal(extension.id, expectedId, "Sidecar id is invalid");
assert.equal(extension.version, expectedVersion, "Sidecar version is invalid");
assert.equal(extension.protocol?.minimumDreamSkinVersion, "1.2.0", "Sidecar minimum runtime is invalid");
assert.equal(theme.id, expectedId, "base theme id is invalid");
assert.equal(theme.version, expectedVersion, "base theme version is invalid");
assert.equal(theme.image, "background.jpg", "base theme image is invalid");
assert.equal(layout.packageId, expectedId, "layout package id is invalid");
assert.equal(layout.packageVersion, expectedVersion, "layout package version is invalid");
assert(["css-pixel", "normalized-viewport"].includes(layout.coordinateSpace), "layout coordinate space is invalid");
assert(Array.isArray(layout.requiredTargets) && layout.requiredTargets.length >= 1 && layout.requiredTargets.length <= 16, "layout target count is invalid");
assert(Array.isArray(layout.assertions) && layout.assertions.length >= 1 && layout.assertions.length <= 128, "layout assertion count is invalid");
for (const assertion of layout.assertions) {
  assert(assertion.path?.startsWith("targets.*."), `layout assertion path is invalid: ${assertion.id}`);
  if (["delta", "ratio"].includes(assertion.type)) assert(assertion.otherPath?.startsWith("targets.*."), `layout assertion otherPath is invalid: ${assertion.id}`);
}
assert(isDeepStrictEqual(extension, sourceExtension), "archived Sidecar metadata differs from source");
assert(isDeepStrictEqual(theme, sourceTheme), "archived base theme metadata differs from source");
assert(isDeepStrictEqual(layout, sourceLayout), "archived layout contract differs from source");
assert(isDeepStrictEqual(manifest, catalog.manifest), "catalog manifest differs from kaboo-package.json");
assert(isDeepStrictEqual(manifest, JSON.parse(await fs.readFile(path.join(releaseDir, "manifest.json"), "utf8"))), "manifest.json differs from kaboo-package.json");

const packageReadme = archiveFile("README.md").toString("utf8");
assert(packageReadme.startsWith("<!-- kaboo-theme-readme:v1 -->\n"), "README.md must start with the Kaboo v1 marker");
for (const heading of ["## Runtime dependencies", "## Rendering architecture", "## Layout verification", "## AI adaptation fallback", "## Troubleshooting"]) {
  assert(new RegExp(`^${heading}$`, "mu").test(packageReadme), `README.md is missing ${heading}`);
}
assert(packageReadme.includes(`kaboo-cli codex-theme verify ${expectedId}`), "README.md must include the installed verify command");
assert(packageReadme.includes("sidecar/layout-contract.json"), "README.md must point to the layout contract");
assert(packageReadme.includes("canonical theme source") && packageReadme.includes("Do not edit the installed immutable copy"), "README.md must describe the immutable-source repair route");
for (const script of ["start.sh", "stop.sh", "verify.sh"]) {
  assert(archiveFile(`sidecar/scripts/${script}`).toString("utf8").includes('[ "$#" -eq 0 ]'), `${script} must expose only its no-argument lifecycle surface`);
}

const checksumEntries = new Map();
const checksumText = archiveFile("SHA256SUMS").toString("utf8");
assert(checksumText.endsWith("\n") && !checksumText.includes("\r"), "SHA256SUMS must use LF and end with LF");
for (const line of checksumText.trimEnd().split("\n")) {
  const match = /^([a-f0-9]{64})  ([^\r\n]+)$/u.exec(line);
  assert(match && !checksumEntries.has(match[2]), `invalid or duplicate SHA256SUMS entry: ${line}`);
  assert(
    !match[2].startsWith("*")
      && !match[2].includes("\\")
      && !/[\p{Cc}]/u.test(match[2])
      && match[2] === match[2].trim().replace(/^\uFEFF|\uFEFF$/gu, "")
      && !path.posix.isAbsolute(match[2])
      && path.posix.normalize(match[2]) === match[2]
      && !match[2].split("/").includes("..")
      && !match[2].endsWith("/")
      && match[2] !== "SHA256SUMS",
    `unsafe SHA256SUMS path: ${match[2]}`,
  );
  checksumEntries.set(match[2], match[1]);
}
const covered = relativeEntries.filter((relative) => relative !== "SHA256SUMS");
assert.deepEqual([...checksumEntries.keys()].sort(), covered, "SHA256SUMS coverage is incomplete");
for (const [relative, expected] of checksumEntries) assert.equal(sha256(archiveFile(relative)), expected, `checksum mismatch: ${relative}`);

const expandedBytes = relativeEntries.reduce((total, relative) => total + archiveFile(relative).length, 0);
assert.equal(catalog.archiveFiles, relativeEntries.length, "catalog archiveFiles is invalid");
assert.equal(catalog.expandedBytes, expandedBytes, "catalog expandedBytes is invalid");
for (const [kind, filename] of Object.entries({ home: "preview-home.webp", task: "preview-task.webp" })) {
  assert.equal(catalog.previewFiles?.[kind], filename, `catalog previewFiles.${kind} is invalid`);
  const sibling = await fs.readFile(path.join(releaseDir, filename));
  const archived = archiveFile(`previews/${kind}.webp`);
  assert(isDeepStrictEqual(sibling, archived), `${filename} differs from the archived preview`);
  assert.equal(sibling.subarray(0, 4).toString("ascii"), "RIFF", `${filename} is not WebP`);
  assert.equal(sibling.subarray(8, 12).toString("ascii"), "WEBP", `${filename} is not WebP`);
}

console.log(`Kaboo release protocol ok: ${expectedId}@${expectedVersion}, ${relativeEntries.length} files`);
