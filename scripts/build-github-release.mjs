import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { RELEASE_COPY_SOURCES } from "./release-inputs.mjs";

const sourceRoot = path.resolve(import.meta.dirname, "..");
const releaseSource = (relative) => path.resolve(sourceRoot, relative);
const packageJson = JSON.parse(await fs.readFile(path.join(sourceRoot, "package.json"), "utf8"));
const version = packageJson.version;
const rootName = "Denia Old Days";
const archiveName = "denia-old-days-macos.zip";
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

const outputRoot = path.resolve(value("--output", path.join(sourceRoot, "release")));
const archivePath = path.join(outputRoot, archiveName);

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    input: options.input,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return (result.stdout || "").trim();
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

async function sha256(filePath) {
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

async function copyDirectory(source, destination) {
  await walkFiles(source);
  await fs.cp(source, destination, {
    recursive: true,
    filter: (candidate) => {
      const relative = path.relative(source, candidate);
      return path.basename(candidate) !== ".DS_Store"
        && relative !== "release"
        && !relative.startsWith(`release${path.sep}`);
    },
  });
}

async function normalizePackage(directory) {
  const timestamp = new Date("2026-07-30T00:00:00.000Z");
  const files = await walkFiles(directory);
  for (const filePath of files) {
    const executable = filePath.endsWith(".sh") || filePath.endsWith(".command");
    await fs.chmod(filePath, executable ? 0o755 : 0o644);
    await fs.utimes(filePath, timestamp, timestamp);
  }
  const directories = [directory];
  for (const filePath of files) {
    let parent = path.dirname(filePath);
    while (parent.startsWith(`${directory}${path.sep}`)) {
      directories.push(parent);
      parent = path.dirname(parent);
    }
  }
  for (const candidate of new Set(directories)) await fs.utimes(candidate, timestamp, timestamp);
}

const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "denia-github-release-"));
const bundleDir = path.join(temporaryRoot, rootName);
try {
  await fs.mkdir(bundleDir, { recursive: true });
  await Promise.all([
    fs.copyFile(releaseSource(RELEASE_COPY_SOURCES.installCommand), path.join(bundleDir, "Install Denia Old Days.command")),
    fs.copyFile(releaseSource(RELEASE_COPY_SOURCES.uninstallCommand), path.join(bundleDir, "Uninstall Denia Old Days.command")),
    fs.copyFile(releaseSource(RELEASE_COPY_SOURCES.readme), path.join(bundleDir, "README.md")),
    fs.copyFile(releaseSource(RELEASE_COPY_SOURCES.license), path.join(bundleDir, "LICENSE")),
    fs.copyFile(releaseSource(RELEASE_COPY_SOURCES.notice), path.join(bundleDir, "NOTICE.md")),
  ]);
  await Promise.all([
    copyDirectory(releaseSource(RELEASE_COPY_SOURCES.installer), path.join(bundleDir, "installer")),
    copyDirectory(releaseSource(RELEASE_COPY_SOURCES.sidecar), path.join(bundleDir, "sidecar")),
    copyDirectory(releaseSource(RELEASE_COPY_SOURCES.previews), path.join(bundleDir, "previews")),
  ]);
  await fs.mkdir(path.join(bundleDir, "theme"), { recursive: true });
  await Promise.all([
    fs.copyFile(releaseSource(RELEASE_COPY_SOURCES.themeDefinition), path.join(bundleDir, "theme/theme.json")),
    fs.copyFile(releaseSource(RELEASE_COPY_SOURCES.themeBackground), path.join(bundleDir, "theme/background.jpg")),
  ]);

  const releaseMetadata = {
    schemaVersion: 1,
    id: "denia-old-days",
    version,
    name: "达妮娅 · 旧日斑斓",
    platform: "macOS",
    architecture: ["arm64", "x64"],
    baseEngine: "https://github.com/Fei-Away/Codex-Dream-Skin",
    install: "Install Denia Old Days.command",
    uninstall: "Uninstall Denia Old Days.command",
  };
  await fs.writeFile(
    path.join(bundleDir, "release.json"),
    `${JSON.stringify(releaseMetadata, null, 2)}\n`,
  );

  const filesBeforeChecksums = await walkFiles(bundleDir);
  const checksums = [];
  for (const filePath of filesBeforeChecksums) {
    const relative = path.relative(bundleDir, filePath).split(path.sep).join("/");
    checksums.push(`${await sha256(filePath)}  ${relative}`);
  }
  await fs.writeFile(path.join(bundleDir, "SHA256SUMS"), `${checksums.join("\n")}\n`);
  await normalizePackage(bundleDir);

  await fs.mkdir(outputRoot, { recursive: true });
  await fs.rm(archivePath, { force: true });
  const archiveEntries = (await walkFiles(bundleDir)).map((filePath) =>
    path.relative(temporaryRoot, filePath).split(path.sep).join("/"));
  run("/usr/bin/zip", ["-X", "-q", archivePath, "-@"], {
    cwd: temporaryRoot,
    input: `${archiveEntries.join("\n")}\n`,
  });
  run("/usr/bin/unzip", ["-t", archivePath]);

  const archiveStat = await fs.stat(archivePath);
  console.log(JSON.stringify({
    archive: archivePath,
    sha256: await sha256(archivePath),
    bytes: archiveStat.size,
    files: archiveEntries.length,
    version,
  }, null, 2));
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
