import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { RELEASE_COPY_SOURCES } from "./release-inputs.mjs";

const sourceRoot = path.resolve(import.meta.dirname, "..");
const releaseSource = (relative) => path.resolve(sourceRoot, relative);
const id = "denia-old-days";
const version = "0.1.0";
const rootName = "codex-dream-skin-denia-old-days-0.1.0";
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

const outputRoot = path.resolve(value("--output", path.join(sourceRoot, "sidecar/release/kaboo-local")));
const releaseDir = path.join(outputRoot, id, version);
const extension = JSON.parse(await fs.readFile(path.join(releaseSource(RELEASE_COPY_SOURCES.sidecar), "extension.json"), "utf8"));
const manifest = {
  schemaVersion: 1,
  kind: "codex-dream-skin",
  id,
  displayName: "达妮娅 · 旧日斑斓",
  version,
  summary: "达妮娅双形态学院手账，以暖色 P2 拍立得、深色全景首页、情绪状态美术栏和双主题原生右侧栏陪伴 Codex 任务。",
  description: "浅色模式保留暖色 P2 拍立得首页与虹彩泡泡；深色模式使用独立全景首页。任务页按等待、工作、审批、错误和完成状态切换四组本地角色美术；原生右侧栏随用户拖拽由笑容近景平滑过渡到完整宽幅舞台。",
  publisher: {
    id: "gongwenkang",
    displayName: "gongwenkang",
  },
  platform: {
    os: ["darwin"],
    arch: ["arm64", "amd64"],
  },
  requirements: {
    codexDesktop: true,
    codexDreamSkinStudio: `>=${extension.protocol.minimumDreamSkinVersion}`,
  },
  theme: {
    id,
    recommendedNativeAppearance: "light",
    basePath: "theme",
    sidecarPath: "sidecar",
  },
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
- Node.js 20 or newer for the package-local validator.

## Rendering architecture

\`theme/\` provides the portable base wallpaper and palette. \`sidecar/\` adds the removable \`cdp-loopback-v1\` component layer to the exact \`app://-/index.html\` renderer. Runtime artwork is package-local, no remote asset request is made, and the package does not modify the Codex application.

## Layout verification

The machine-readable contract is \`sidecar/layout-contract.json\`. It covers \`home-desktop\`, \`home-narrow\`, \`task-desktop\`, and \`task-narrow\`. After installation, run the exact verifier:

Installed verification command: \`kaboo-cli codex-theme verify ${id}\`.

\`\`\`bash
kaboo-cli codex-theme verify ${id}
\`\`\`

For visual review, run \`kaboo-cli codex-theme preview-local /absolute/path/to/catalog-version.json --target <target-id>\` once for every declared target while the matching Codex surface is open.

## AI adaptation fallback

If a Codex update changes native selectors or layout behavior, repair the canonical theme source, rebuild the package, and publish a new semantic version. Do not edit the installed immutable copy or teach Kaboo to emulate a retired runtime state schema.

## Troubleshooting

- A \`prepared\` install needs the explicit \`kaboo-cli codex-theme activate ${id} --restart\` flow before verification.
- If a task target cannot be opened, open one existing Codex task and rerun its preview.
- A layout assertion failure must be fixed in source and rebuilt; do not bypass \`sidecar/scripts/verify.sh\`.
`;

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    input: options.input,
    stdio: options.input == null ? "pipe" : ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return (result.stdout || "").trim();
}

async function writeJson(filePath, valueToWrite) {
  await fs.writeFile(filePath, `${JSON.stringify(valueToWrite, null, 2)}\n`);
}

async function walkFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Local release must not contain links: ${candidate}`);
    if (entry.isDirectory()) files.push(...await walkFiles(candidate));
    else if (entry.isFile()) files.push(candidate);
    else throw new Error(`Unsupported local release entry: ${candidate}`);
  }
  return files.sort();
}

async function sha256(filePath) {
  const bytes = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function normalizeTimes(directory) {
  const normalized = new Date("2026-07-19T00:00:00.000Z");
  const visit = async (candidate) => {
    const stat = await fs.lstat(candidate);
    if (stat.isDirectory()) {
      for (const entry of await fs.readdir(candidate)) await visit(path.join(candidate, entry));
    }
    await fs.utimes(candidate, normalized, normalized);
  };
  await visit(directory);
}

const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "denia-kaboo-local-"));
const bundleDir = path.join(temporaryRoot, rootName);
try {
  await fs.rm(releaseDir, { recursive: true, force: true });
  await fs.mkdir(path.join(bundleDir, "theme"), { recursive: true });
  await fs.mkdir(path.join(bundleDir, "sidecar"), { recursive: true });
  await fs.mkdir(path.join(bundleDir, "previews"), { recursive: true });
  await fs.mkdir(releaseDir, { recursive: true });

  await fs.cp(releaseSource(RELEASE_COPY_SOURCES.sidecar), path.join(bundleDir, "sidecar"), {
    recursive: true,
    filter: (candidate) => {
      const relative = path.relative(releaseSource(RELEASE_COPY_SOURCES.sidecar), candidate);
      return relative !== "release"
        && !relative.startsWith(`release${path.sep}`)
        && path.basename(candidate) !== ".DS_Store";
    },
  });
  await fs.copyFile(releaseSource(RELEASE_COPY_SOURCES.themeDefinition), path.join(bundleDir, "theme/theme.json"));
  await fs.copyFile(releaseSource(RELEASE_COPY_SOURCES.themeBackground), path.join(bundleDir, "theme/background.jpg"));

  await Promise.all([
    fs.copyFile(releaseSource(RELEASE_COPY_SOURCES.homePreview), path.join(bundleDir, "previews/home.webp")),
    fs.copyFile(releaseSource(RELEASE_COPY_SOURCES.taskPreview), path.join(bundleDir, "previews/task.webp")),
  ]);

  await writeJson(path.join(bundleDir, "kaboo-package.json"), manifest);
  await fs.writeFile(path.join(bundleDir, "README.md"), packageReadme);
  await fs.copyFile(releaseSource(RELEASE_COPY_SOURCES.license), path.join(bundleDir, "LICENSE"));
  const sidecarNotice = await fs.readFile(releaseSource(RELEASE_COPY_SOURCES.notice), "utf8");
  await fs.writeFile(path.join(bundleDir, "NOTICE.md"), `${sidecarNotice.trim()}\n`);

  run(process.execPath, [
    path.join(bundleDir, "sidecar/tests/validate.mjs"),
    path.join(bundleDir, "sidecar"),
  ]);
  for (const filePath of await walkFiles(path.join(bundleDir, "sidecar"))) {
    if (filePath.endsWith(".sh")) run("/bin/bash", ["-n", filePath]);
    if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) run(process.execPath, ["--check", filePath]);
  }

  const filesBeforeChecksums = await walkFiles(bundleDir);
  const checksumLines = [];
  for (const filePath of filesBeforeChecksums) {
    const relative = path.relative(bundleDir, filePath).split(path.sep).join("/");
    checksumLines.push(`${await sha256(filePath)}  ${relative}`);
  }
  await fs.writeFile(path.join(bundleDir, "SHA256SUMS"), `${checksumLines.join("\n")}\n`);
  await normalizeTimes(bundleDir);

  const finalFiles = await walkFiles(bundleDir);
  const expandedBytes = (
    await Promise.all(finalFiles.map(async (filePath) => (await fs.stat(filePath)).size))
  ).reduce((total, size) => total + size, 0);
  const archivePath = path.join(releaseDir, "bundle.zip");
  const archiveEntries = finalFiles.map((filePath) =>
    path.relative(temporaryRoot, filePath).split(path.sep).join("/"));
  run("/usr/bin/zip", ["-X", "-q", archivePath, "-@"], {
    cwd: temporaryRoot,
    input: `${archiveEntries.join("\n")}\n`,
  });
  run("/usr/bin/unzip", ["-t", archivePath]);

  await Promise.all([
    fs.copyFile(path.join(bundleDir, "previews/home.webp"), path.join(releaseDir, "preview-home.webp")),
    fs.copyFile(path.join(bundleDir, "previews/task.webp"), path.join(releaseDir, "preview-task.webp")),
    writeJson(path.join(releaseDir, "manifest.json"), manifest),
  ]);
  const artifact = await fs.stat(archivePath);
  const catalogVersion = {
    packageId: id,
    kind: "codex-dream-skin",
    version,
    artifactFile: "bundle.zip",
    artifactSha256: await sha256(archivePath),
    artifactBytes: artifact.size,
    expandedBytes,
    archiveFiles: finalFiles.length,
    previewFiles: {
      home: "preview-home.webp",
      task: "preview-task.webp",
    },
    manifest,
  };
  await writeJson(path.join(releaseDir, "catalog-version.json"), catalogVersion);
  console.log(JSON.stringify({ releaseDir, ...catalogVersion }, null, 2));
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
