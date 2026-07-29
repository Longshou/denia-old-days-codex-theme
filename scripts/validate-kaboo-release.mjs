import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

const expectedId = "denia-old-days";
const expectedVersion = "0.1.0";
const expectedRoot = `codex-dream-skin-${expectedId}-${expectedVersion}`;
const expectedTargets = [
  { id: "home-desktop", route: "/", viewport: { width: 1440, height: 900 } },
  { id: "home-narrow", route: "/", viewport: { width: 390, height: 844 } },
  { id: "task-desktop", route: "/task/current", viewport: { width: 1440, height: 900 } },
  { id: "task-narrow", route: "/task/current", viewport: { width: 390, height: 844 } },
];
const readmeHeadings = [
  "## Runtime dependencies",
  "## Rendering architecture",
  "## Layout verification",
  "## AI adaptation fallback",
  "## Troubleshooting",
];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

const run = (command, args, { encoding = "utf8" } = {}) => {
  const result = spawnSync(command, args, {
    encoding,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8")
      : result.stderr || result.stdout || "";
    throw new Error(`${command} ${args.join(" ")} failed: ${detail.trim()}`);
  }
  return result.stdout;
};

const catalogPath = path.resolve(
  process.argv[2]
    || path.join(
      import.meta.dirname,
      "../sidecar/release/kaboo-local/denia-old-days/0.1.0/catalog-version.json",
    ),
);
assert(process.argv.length <= 3, "usage: node scripts/validate-kaboo-release.mjs [catalog-version.json]");

const catalogBytes = await fs.readFile(catalogPath);
const catalog = JSON.parse(catalogBytes.toString("utf8"));
const releaseDir = path.dirname(catalogPath);
const releaseEntries = (await fs.readdir(releaseDir)).sort();
assert(
  isDeepStrictEqual(releaseEntries, [
    "bundle.zip",
    "catalog-version.json",
    "manifest.json",
    "preview-home.webp",
    "preview-task.webp",
  ]),
  "release directory must contain exactly the catalog and four publishable files",
);
assert(catalog.packageId === expectedId, "catalog packageId is invalid");
assert(catalog.kind === "codex-dream-skin", "catalog kind is invalid");
assert(catalog.version === expectedVersion, "catalog version is invalid");
assert(catalog.artifactFile === "bundle.zip", "catalog artifactFile must be bundle.zip");

const archivePath = path.join(releaseDir, catalog.artifactFile);
const archiveBytes = await fs.readFile(archivePath);
assert(archiveBytes.length === catalog.artifactBytes, "catalog artifactBytes does not match bundle.zip");
assert(sha256(archiveBytes) === catalog.artifactSha256, "catalog artifactSha256 does not match bundle.zip");
run("/usr/bin/unzip", ["-t", archivePath]);

const archiveEntries = run("/usr/bin/unzip", ["-Z1", archivePath])
  .split(/\r?\n/u)
  .filter(Boolean);
assert(archiveEntries.length > 0, "bundle.zip is empty");
assert(new Set(archiveEntries).size === archiveEntries.length, "bundle.zip contains duplicate paths");
assert(
  new Set(archiveEntries.map((entry) => entry.toLocaleLowerCase("en-US"))).size === archiveEntries.length,
  "bundle.zip contains case-folded duplicate paths",
);
for (const entry of archiveEntries) {
  assert(!entry.startsWith("/") && !entry.includes("\\") && !entry.endsWith("/"), `unsafe ZIP path: ${entry}`);
  assert(path.posix.normalize(entry) === entry && !entry.split("/").includes(".."), `non-normalized ZIP path: ${entry}`);
}
const roots = new Set(archiveEntries.map((entry) => entry.split("/")[0]));
assert(roots.size === 1 && roots.has(expectedRoot), `bundle.zip root must be ${expectedRoot}`);

const relativeEntries = archiveEntries
  .map((entry) => entry.slice(expectedRoot.length + 1))
  .sort();
assert(relativeEntries.every(Boolean), "bundle.zip must not contain a bare root entry");
for (const relative of relativeEntries) {
  const top = relative.split("/")[0];
  assert(
    ["theme", "sidecar", "previews"].includes(top)
      || ["kaboo-package.json", "SHA256SUMS", "README.md", "LICENSE", "NOTICE.md"].includes(relative),
    `unexpected package path: ${relative}`,
  );
}
for (const required of [
  "kaboo-package.json",
  "theme/theme.json",
  "theme/background.jpg",
  "sidecar/extension.json",
  "sidecar/layout-contract.json",
  "sidecar/scripts/start.sh",
  "sidecar/scripts/stop.sh",
  "sidecar/scripts/verify.sh",
  "sidecar/tests/validate.mjs",
  "previews/home.webp",
  "previews/task.webp",
  "SHA256SUMS",
  "README.md",
  "LICENSE",
  "NOTICE.md",
]) {
  assert(relativeEntries.includes(required), `bundle.zip is missing ${required}`);
}
assert(
  isDeepStrictEqual(
    relativeEntries.filter((entry) => entry.startsWith("theme/")),
    ["theme/background.jpg", "theme/theme.json"],
  ),
  "theme/ may contain only background.jpg and theme.json",
);
assert(
  isDeepStrictEqual(
    relativeEntries.filter((entry) => entry.startsWith("previews/")),
    ["previews/home.webp", "previews/task.webp"],
  ),
  "previews/ must contain exactly home.webp and task.webp",
);

const archiveFile = (relative) => Buffer.from(run(
  "/usr/bin/unzip",
  ["-p", archivePath, `${expectedRoot}/${relative}`],
  { encoding: null },
));
const archiveText = (relative) => archiveFile(relative).toString("utf8");
const archiveJson = (relative) => JSON.parse(archiveText(relative));

const manifest = archiveJson("kaboo-package.json");
const extension = archiveJson("sidecar/extension.json");
const theme = archiveJson("theme/theme.json");
const layoutContract = archiveJson("sidecar/layout-contract.json");
assert(manifest.schemaVersion === 1 && manifest.kind === "codex-dream-skin", "package manifest kind is invalid");
assert(manifest.id === expectedId && manifest.version === expectedVersion, "package manifest identity is invalid");
assert(extension.schemaVersion === 1, "extension schemaVersion is invalid");
assert(extension.id === expectedId && extension.version === expectedVersion, "extension identity is invalid");
assert(theme.schemaVersion === 1 && theme.id === expectedId, "base theme identity is invalid");
assert(theme.version === expectedVersion, "base theme version is invalid");
assert(theme.image === "background.jpg", "base theme image path is invalid");
assert(extension.layoutContract === "layout-contract.json", "extension layoutContract pointer is invalid");
assert(layoutContract.schemaVersion === 1, "layout contract schemaVersion is invalid");
assert(layoutContract.packageId === expectedId, "layout contract packageId is invalid");
assert(layoutContract.packageVersion === expectedVersion, "layout contract packageVersion is invalid");
assert(layoutContract.coordinateSpace === "css-pixel", "layout contract coordinateSpace is invalid");
assert(isDeepStrictEqual(layoutContract.requiredTargets, expectedTargets), "layout contract target set is invalid");
assert(
  Array.isArray(layoutContract.assertions)
    && layoutContract.assertions.length >= 1
    && layoutContract.assertions.length <= 128,
  "layout contract must contain 1 to 128 assertions",
);
for (const assertion of layoutContract.assertions) {
  assert(/^[a-z0-9][a-z0-9-]*$/u.test(assertion.id), `invalid layout assertion id: ${assertion.id}`);
  assert(["equals", "range", "delta", "ratio"].includes(assertion.type), `invalid layout assertion type: ${assertion.type}`);
  assert(assertion.path?.startsWith("targets.*."), `layout assertion path must target every output: ${assertion.id}`);
  if (assertion.type === "delta" || assertion.type === "ratio") {
    assert(assertion.otherPath?.startsWith("targets.*."), `layout assertion otherPath is invalid: ${assertion.id}`);
  }
}
assert(isDeepStrictEqual(manifest, catalog.manifest), "catalog manifest differs from kaboo-package.json");
assert(isDeepStrictEqual(manifest, JSON.parse(await fs.readFile(path.join(releaseDir, "manifest.json"), "utf8"))), "manifest.json differs from kaboo-package.json");

const packageReadme = archiveText("README.md");
assert(packageReadme.startsWith("<!-- kaboo-theme-readme:v1 -->\n"), "README.md must start with the Kaboo v1 marker");
for (const heading of readmeHeadings) {
  assert(new RegExp(`^${heading}$`, "mu").test(packageReadme), `README.md is missing ${heading}`);
}
assert(packageReadme.includes("sidecar/layout-contract.json"), "README.md must point to the layout contract");
assert(
  packageReadme.includes(`\`kaboo-cli codex-theme verify ${expectedId}\``),
  "README.md must include the exact installed verify command",
);
assert(
  packageReadme.includes("canonical theme source")
    && packageReadme.includes("new semantic version")
    && packageReadme.includes("Do not edit the installed immutable copy"),
  "README.md must describe the AI adaptation fallback",
);
for (const script of ["start.sh", "stop.sh", "verify.sh"]) {
  const scriptText = archiveText(`sidecar/scripts/${script}`);
  assert(scriptText.includes('[ "$#" -eq 0 ]'), `${script} must expose a no-argument lifecycle surface`);
}

const checksumBytes = archiveFile("SHA256SUMS");
const checksumText = checksumBytes.toString("utf8");
assert(checksumText.endsWith("\n"), "SHA256SUMS must end with LF");
assert(!checksumText.includes("\r"), "SHA256SUMS must use LF line endings");
const checksumLines = checksumText.slice(0, -1).split("\n");
assert(checksumLines.length > 0 && checksumLines.every(Boolean), "SHA256SUMS must not contain blank lines");
const checksumEntries = new Map();
for (const [index, line] of checksumLines.entries()) {
  assert(/^[a-f0-9]{64}  .+$/u.test(line), `SHA256SUMS line ${index + 1} has invalid grammar`);
  const digest = line.slice(0, 64);
  const relative = line.slice(66);
  assert(relative === relative.trim().replace(/^\uFEFF|\uFEFF$/gu, ""), `SHA256SUMS path has trim whitespace: ${relative}`);
  assert(!relative.startsWith("*") && !relative.includes("\\") && !/\p{Cc}/u.test(relative), `SHA256SUMS path is unsafe: ${relative}`);
  assert(
    !path.posix.isAbsolute(relative)
      && path.posix.normalize(relative) === relative
      && relative !== "."
      && relative !== "SHA256SUMS"
      && !relative.endsWith("/"),
    `SHA256SUMS path is non-normalized: ${relative}`,
  );
  assert(!checksumEntries.has(relative), `SHA256SUMS contains duplicate path: ${relative}`);
  checksumEntries.set(relative, digest);
}
const checksumCoveredFiles = relativeEntries.filter((entry) => entry !== "SHA256SUMS").sort();
assert(
  isDeepStrictEqual([...checksumEntries.keys()].sort(), checksumCoveredFiles),
  "SHA256SUMS must cover every package file except itself exactly once",
);
for (const [relative, digest] of checksumEntries) {
  assert(sha256(archiveFile(relative)) === digest, `SHA256SUMS digest mismatch: ${relative}`);
}

const expandedBytes = relativeEntries
  .map((relative) => archiveFile(relative).length)
  .reduce((total, size) => total + size, 0);
assert(catalog.archiveFiles === relativeEntries.length, "catalog archiveFiles does not match the ZIP");
assert(catalog.expandedBytes === expandedBytes, "catalog expandedBytes does not match the ZIP");
for (const [kind, file] of Object.entries({ home: "preview-home.webp", task: "preview-task.webp" })) {
  assert(catalog.previewFiles?.[kind] === file, `catalog previewFiles.${kind} is invalid`);
  const siblingBytes = await fs.readFile(path.join(releaseDir, file));
  const packageBytes = archiveFile(`previews/${kind}.webp`);
  assert(isDeepStrictEqual(siblingBytes, packageBytes), `${file} differs from the package preview`);
  assert(
    siblingBytes.subarray(0, 4).toString("ascii") === "RIFF"
      && siblingBytes.subarray(8, 12).toString("ascii") === "WEBP",
    `${file} is not WebP`,
  );
}

console.log(`Kaboo release protocol ok: ${expectedId}@${expectedVersion}, ${relativeEntries.length} files`);
