import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
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
  description: "浅色模式保留暖色 P2 拍立得首页与虹彩泡泡；深色模式使用独立全景首页。任务页按等待、工作、审批、错误和完成状态切换四组本地角色美术，原生右侧栏在明暗模式共用笑容近景皮肤。",
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

const packageReadme = `# 达妮娅 · 旧日斑斓

Kaboo Codex Dream Skin local package \`${id}@${version}\`.

The Base Theme provides the warm paper environment. The removable Sidecar adds a warm P2 polaroid homepage in light mode, an independent dark panoramic homepage, iridescent bubbles, native action proxies, diary cards, composer treatment, an emotion-aware right artwork rail, and a shared portrait skin for the native right sidebar in both appearance modes.

The task rail uses warm garden-and-bubbles artwork for staged and working; approval uses the official dual-form vertical artwork; error uses the separate official anniversary exhibition artwork with a complete unsmiling face and tense raised-arm movement; complete uses the bright anniversary direct-gaze crop. It stays behind the native task UI without changing workspace or composer geometry, hides below 920px, and honors reduced-motion and reduced-transparency preferences.

This package does not modify Codex.app, app.asar, code signatures, accounts, models, or API configuration. It makes no runtime network request.

\`\`\`bash
kaboo-cli codex-theme install-local /absolute/path/to/catalog-version.json
kaboo-cli codex-theme status ${id}
\`\`\`

If the verified Dream Skin loopback endpoint is not ready, installation leaves the theme prepared and does not restart Codex. Start the user-authorized Dream Skin session, then run:

\`\`\`bash
kaboo-cli codex-theme activate ${id}
kaboo-cli codex-theme verify ${id}
\`\`\`
`;

const artworkNotice = `# Artwork, source, and IP notice

Denia Old Days is an internal, unofficial fan theme. It is not affiliated with, endorsed by, or sponsored by OpenAI, Kuro Games, or the Wuthering Waves rights holders. No ownership of, or redistribution license for, official material is claimed.

The package contains local WebP derivatives of reviewed official published artwork:

- Old Days in Color homepage story exception: \`d0989c926a8dcb8033c21e781fc6c99a5d6e550d3233dac2789ca688e9c7f1dd\`.
- Dark homepage (\`denia-home-dark.webp\`): a confirmed official-published X original archived from the visual library at \`source-media/official-published-x/HJZ_QoAbEAAGOSi.jpg\`; source 4096×2304, source SHA-256 \`b4d5f5b17b83c0f855e8d09effadc01fdead43d01fb6c03b42c3f34860fe17ce\`; runtime derivative 2048×1152, derivative SHA-256 \`24590e16aebd09dd2ce730d3302e3b58b2d271e62f295485a32e23f1a8ce5b0c\`.
- Right sidebar portrait (\`denia-right-sidebar.webp\`): an official-published Denia video frame; source 1080×1920, source SHA-256 \`1dcbfa127968c2386ad77da325f850ad4985bccc95959d915652df36dcba2296\`; runtime derivative 640×1600, derivative SHA-256 \`2f26b9623ad2df363479ee9c6895a718b7e8f158ed3bc65d747b9bebd386231c\`.
- Warm garden and bubbles rail: \`481bf5ff8fa4f54d5b696f6144fb3f6a7d3b2d8b580cf2a5baee39409110489b\`.
- Approval dual-form vertical rail: \`3339a65536eb6b8cff762f4ac441df6358e857c8b25f0ddaecbade8e457f84c0\`.
- Separate error anniversary exhibition rail cropped around the complete unsmiling face and tense raised-arm pose: \`42c2a49b83de911a01627501875e6df992ac26da556c90b2c64433883eb353f4\`.
- Anniversary complete rail: \`dea27e716f9561131e2b5255ea60a84de2512e8e81886073f09c64e02739fc6e\`.

The old dark direct-gaze source \`aae25be7ff9670c43a8f36a4019fa445c28fb51c57f69a477c008277bc197292\` remains only as a legacy source in the source repository; it is not the current approval or error runtime artwork.

Character PV and combat-demo frames are not used. Promotional text and logos are excluded from runtime crops. Registry publication remains blocked on a separate rights review.
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
    sharp(releaseSource(RELEASE_COPY_SOURCES.homePreview))
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(bundleDir, "previews/home.webp")),
    sharp(releaseSource(RELEASE_COPY_SOURCES.taskPreview))
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(bundleDir, "previews/task.webp")),
  ]);

  await writeJson(path.join(bundleDir, "kaboo-package.json"), manifest);
  await fs.writeFile(path.join(bundleDir, "README.md"), packageReadme);
  await fs.copyFile(releaseSource(RELEASE_COPY_SOURCES.license), path.join(bundleDir, "LICENSE"));
  const sidecarNotice = await fs.readFile(releaseSource(RELEASE_COPY_SOURCES.notice), "utf8");
  await fs.writeFile(path.join(bundleDir, "NOTICE.md"), `${artworkNotice}\n${sidecarNotice.trim()}\n`);

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
