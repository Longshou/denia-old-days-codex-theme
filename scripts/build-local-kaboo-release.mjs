import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { RELEASE_COPY_SOURCES } from "./release-inputs.mjs";

const sourceRoot = path.resolve(import.meta.dirname, "..");
const source = (relative) => path.resolve(sourceRoot, relative);
const packageJson = JSON.parse(await fs.readFile(source("package.json"), "utf8"));
const extension = JSON.parse(await fs.readFile(source("sidecar/extension.json"), "utf8"));
const theme = JSON.parse(await fs.readFile(source("theme/theme.json"), "utf8"));
const layoutContract = JSON.parse(await fs.readFile(source("sidecar/layout-contract.json"), "utf8"));
const id = "denia-old-days";
const publisherId = "gongwenkang";
const version = packageJson.version;
const rootName = `codex-dream-skin-${id}-${version}`;
const args = process.argv.slice(2);

const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  if (index < 0) return fallback;
  const found = args[index + 1];
  if (!found || found.startsWith("--")) throw new Error(`${flag} requires a value`);
  return found;
};

for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--output") {
    index += 1;
    continue;
  }
  throw new Error(`Unknown argument: ${args[index]}`);
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(version)) {
  throw new Error(`package.json version must be semantic: ${version}`);
}
for (const [name, document, expectedId] of [
  ["sidecar extension", extension, extension.id],
  ["base theme", theme, theme.id],
]) {
  if (expectedId !== id || document.version !== version) {
    throw new Error(`${name} identity must match ${id}@${version}`);
  }
}
if (
  layoutContract.packageId !== id
  || layoutContract.packageVersion !== version
  || extension.protocol?.minimumDreamSkinVersion !== "1.2.0"
) {
  throw new Error("Kaboo package metadata must retain the managed Dream Skin 1.2.0 contract");
}

const outputRoot = path.resolve(value("--output", path.join(sourceRoot, "sidecar/release/kaboo-local")));
const releaseDir = path.join(outputRoot, id, version);
const manifest = {
  schemaVersion: 1,
  kind: "codex-dream-skin",
  id,
  displayName: "达妮娅 · 旧日斑斓",
  version,
  summary: "达妮娅双形态学院手账，以暖色 P2 拍立得、深色全景首页、情绪状态美术栏和双主题原生右侧栏陪伴 Codex 任务。",
  description: "浅色模式保留暖色 P2 拍立得首页与虹彩泡泡；深色模式使用独立全景首页。任务页按等待、工作、审批、错误和完成状态切换四组本地角色美术；原生右侧栏随用户拖拽由笑容近景平滑过渡到完整宽幅舞台。",
  publisher: { id: publisherId, displayName: publisherId },
  platform: { os: ["darwin"], arch: ["arm64", "amd64"] },
  requirements: { codexDesktop: true, codexDreamSkinStudio: `>=${extension.protocol.minimumDreamSkinVersion}` },
  theme: { id, recommendedNativeAppearance: "light", basePath: "theme", sidecarPath: "sidecar" },
  install: {
    strategy: "kaboo-cli",
    activation: "hot-if-endpoint-ready",
    restartPolicy: "explicit-only",
    retainedPreviousPackages: 0,
  },
  previews: [
    { kind: "home", path: "previews/home.webp" },
    { kind: "task", path: "previews/task.webp" },
  ],
  capabilities: ["base.wallpaper", ...extension.capabilities],
  security: {
    transport: extension.protocol.transport,
    rendererTarget: extension.protocol.target,
    modifiesOfficialApp: false,
    remoteRequests: false,
  },
};

const packageReadme = `<!-- kaboo-theme-readme:v1 -->
# 达妮娅 · 旧日斑斓

Kaboo Codex Dream Skin package \`${id}@${version}\`. The installed runtime must match the package identity and the minimum Dream Skin version declared in \`sidecar/extension.json\`.

## Runtime dependencies

- macOS on Apple Silicon or Intel.
- Codex Desktop with Kaboo's versioned Dream Skin runtime.
- Dream Skin runtime requirement: \`>=1.2.0\`.
- Kaboo CLI with the \`codex-theme\` command surface.
- Node.js 22 or newer for the package-local validator.

## Rendering architecture

\`theme/\` provides the portable base wallpaper and palette. \`sidecar/\` adds the removable \`cdp-loopback-v1\` component layer to the exact \`app://-/index.html\` renderer. Runtime artwork is package-local, no remote asset request is made, and the package does not modify the Codex application.

## Layout verification

The machine-readable contract is \`sidecar/layout-contract.json\`. After installation, run \`kaboo-cli codex-theme verify ${id}\`.

## AI adaptation fallback

If a Codex update changes native selectors or layout behavior, repair the canonical theme source, rebuild the package, and publish a new semantic version. Do not edit the installed immutable copy.

## Troubleshooting

- A \`prepared\` install needs \`kaboo-cli codex-theme activate ${id} --restart\` before verification.
- A layout assertion failure must be fixed in source and rebuilt; do not bypass \`sidecar/scripts/verify.sh\`.
`;

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    input: options.input,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(" ")} failed:\n${result.stderr || result.stdout}`);
  return (result.stdout || "").trim();
}

async function writeJson(filePath, valueToWrite) {
  await fs.writeFile(filePath, `${JSON.stringify(valueToWrite, null, 2)}\n`);
}

async function walkFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    const stat = await fs.lstat(candidate);
    if (stat.isSymbolicLink()) throw new Error(`Release must not contain symbolic links: ${candidate}`);
    if (stat.isDirectory()) files.push(...await walkFiles(candidate));
    else if (stat.isFile()) files.push(candidate);
    else throw new Error(`Unsupported release entry: ${candidate}`);
  }
  return files.sort();
}

const sha256 = async (filePath) => crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");

async function copyDirectory(from, to) {
  await walkFiles(from);
  await fs.cp(from, to, {
    recursive: true,
    filter: (candidate) => {
      const relative = path.relative(from, candidate);
      return path.basename(candidate) !== ".DS_Store" && relative !== "release" && !relative.startsWith(`release${path.sep}`);
    },
  });
}

async function normalizePackage(directory) {
  const timestamp = new Date("2026-07-30T00:00:00.000Z");
  const files = await walkFiles(directory);
  for (const filePath of files) {
    await fs.chmod(filePath, filePath.endsWith(".sh") || filePath.endsWith(".command") ? 0o755 : 0o644);
    await fs.utimes(filePath, timestamp, timestamp);
  }
  for (const filePath of files) {
    for (let parent = path.dirname(filePath); parent.startsWith(`${directory}${path.sep}`); parent = path.dirname(parent)) {
      await fs.utimes(parent, timestamp, timestamp);
    }
  }
  await fs.utimes(directory, timestamp, timestamp);
}

const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "denia-kaboo-release-"));
const bundleDir = path.join(temporaryRoot, rootName);
try {
  await fs.rm(releaseDir, { recursive: true, force: true });
  await Promise.all([
    fs.mkdir(path.join(bundleDir, "theme"), { recursive: true }),
    fs.mkdir(path.join(bundleDir, "sidecar"), { recursive: true }),
    fs.mkdir(path.join(bundleDir, "previews"), { recursive: true }),
    fs.mkdir(releaseDir, { recursive: true }),
  ]);
  await copyDirectory(source(RELEASE_COPY_SOURCES.sidecar), path.join(bundleDir, "sidecar"));
  await Promise.all([
    fs.copyFile(source(RELEASE_COPY_SOURCES.themeDefinition), path.join(bundleDir, "theme/theme.json")),
    fs.copyFile(source(RELEASE_COPY_SOURCES.themeBackground), path.join(bundleDir, "theme/background.jpg")),
    fs.copyFile(source(path.join(RELEASE_COPY_SOURCES.previews, "home.webp")), path.join(bundleDir, "previews/home.webp")),
    fs.copyFile(source(path.join(RELEASE_COPY_SOURCES.previews, "task.webp")), path.join(bundleDir, "previews/task.webp")),
    fs.copyFile(source(RELEASE_COPY_SOURCES.license), path.join(bundleDir, "LICENSE")),
  ]);
  await writeJson(path.join(bundleDir, "kaboo-package.json"), manifest);
  await fs.writeFile(path.join(bundleDir, "README.md"), packageReadme);
  await fs.writeFile(path.join(bundleDir, "NOTICE.md"), `${(await fs.readFile(source(RELEASE_COPY_SOURCES.notice), "utf8")).trim()}\n`);

  run(process.execPath, [path.join(bundleDir, "sidecar/tests/validate.mjs"), path.join(bundleDir, "sidecar")]);
  for (const filePath of await walkFiles(path.join(bundleDir, "sidecar"))) {
    if (filePath.endsWith(".sh")) run("/bin/bash", ["-n", filePath]);
    if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) run(process.execPath, ["--check", filePath]);
  }

  const filesBeforeChecksums = await walkFiles(bundleDir);
  await fs.writeFile(
    path.join(bundleDir, "SHA256SUMS"),
    `${(await Promise.all(filesBeforeChecksums.map(async (filePath) => `${await sha256(filePath)}  ${path.relative(bundleDir, filePath).split(path.sep).join("/")}`))).join("\n")}\n`,
  );
  await normalizePackage(bundleDir);

  const finalFiles = await walkFiles(bundleDir);
  const archivePath = path.join(releaseDir, "bundle.zip");
  const archiveEntries = finalFiles.map((filePath) => path.relative(temporaryRoot, filePath).split(path.sep).join("/"));
  run("/usr/bin/zip", ["-X", "-q", archivePath, "-@"], { cwd: temporaryRoot, input: `${archiveEntries.join("\n")}\n` });
  run("/usr/bin/unzip", ["-t", archivePath]);
  const artifact = await fs.stat(archivePath);
  const catalogVersion = {
    packageId: id,
    kind: "codex-dream-skin",
    version,
    artifactFile: "bundle.zip",
    artifactSha256: await sha256(archivePath),
    artifactBytes: artifact.size,
    expandedBytes: (await Promise.all(finalFiles.map(async (filePath) => (await fs.stat(filePath)).size))).reduce((total, size) => total + size, 0),
    archiveFiles: finalFiles.length,
    previewFiles: { home: "preview-home.webp", task: "preview-task.webp" },
    manifest,
  };
  await Promise.all([
    fs.copyFile(path.join(bundleDir, "previews/home.webp"), path.join(releaseDir, "preview-home.webp")),
    fs.copyFile(path.join(bundleDir, "previews/task.webp"), path.join(releaseDir, "preview-task.webp")),
    writeJson(path.join(releaseDir, "manifest.json"), manifest),
    writeJson(path.join(releaseDir, "catalog-version.json"), catalogVersion),
  ]);
  console.log(JSON.stringify({ releaseDir, ...catalogVersion }, null, 2));
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
