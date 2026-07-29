import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { RELEASE_COPY_SOURCES, RENDERER_SOURCE_INPUTS } from "./release-inputs.mjs";

const root = path.resolve(import.meta.dirname, "..");

for (const relative of ["canon", "art/source", "theme", "sidecar", "previews"]) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`missing ${relative}`);
}

const officialSources = new Map([
  ["art/source/official/old-days-bright-102s.jpg", "d0989c926a8dcb8033c21e781fc6c99a5d6e550d3233dac2789ca688e9c7f1dd"],
  ["art/source/official/denia-home-dark-hjz.jpg", "b4d5f5b17b83c0f855e8d09effadc01fdead43d01fb6c03b42c3f34860fe17ce"],
  ["art/source/official/denia-garden-bubbles-warm.jpg", "481bf5ff8fa4f54d5b696f6144fb3f6a7d3b2d8b580cf2a5baee39409110489b"],
  ["art/source/official/denia-anniversary-direct-gaze.jpg", "dea27e716f9561131e2b5255ea60a84de2512e8e81886073f09c64e02739fc6e"],
  ["art/source/official/denia-approval-dual-form.jpg", "3339a65536eb6b8cff762f4ac441df6358e857c8b25f0ddaecbade8e457f84c0"],
  ["art/source/official/denia-error-reaching.jpg", "42c2a49b83de911a01627501875e6df992ac26da556c90b2c64433883eb353f4"],
  ["art/source/official/denia-dark-form-smile-closeup.png", "1dcbfa127968c2386ad77da325f850ad4985bccc95959d915652df36dcba2296"],
  ["art/source/official/denia-right-sidebar-wide.jpg", "d312c86f21610d7d6b50b8d8fa9b9685ef4baa11d34c0ca72fd71a712bfa42ed"],
]);

for (const [relative, expected] of officialSources) {
  const bytes = fs.readFileSync(path.join(root, relative));
  const actual = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) throw new Error(`official source hash mismatch: ${relative}`);
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
if (!readme.includes("denia-old-days@0.1.0")) throw new Error("README identity missing");

const theme = JSON.parse(fs.readFileSync(path.join(root, "theme/theme.json"), "utf8"));
if (theme.id !== "denia-old-days") throw new Error("theme id mismatch");
if (theme.colors?.background !== "#f7eee9" || theme.colors?.panel !== "#fffaf6") {
  throw new Error("base theme must use the warm Denia paper palette");
}
if (fs.existsSync(path.join(root, "art/source/official/denia-portrait.png"))) {
  throw new Error("retired isolated portrait source must not remain in the theme");
}

const backgroundSource = fs.readFileSync(path.join(root, "art/source/background.svg"), "utf8");
const rendererSource = fs.readFileSync(path.join(root, "scripts/render-assets.mjs"), "utf8");
const localReleaseBuilder = fs.readFileSync(path.join(root, "scripts/build-local-kaboo-release.mjs"), "utf8");
const localLauncher = fs.readFileSync(path.join(root, "scripts/start-themed-codex.sh"), "utf8");
const runtimeCss = fs.readFileSync(path.join(root, "sidecar/src/denia-old-days-extension.css"), "utf8");
const runtimeJs = fs.readFileSync(path.join(root, "sidecar/src/denia-old-days-extension.js"), "utf8");
const runtimeLoader = fs.readFileSync(path.join(root, "sidecar/runtime/loader.mjs"), "utf8");
if (!backgroundSource.includes('id="denia-bubble-field"')) {
  throw new Error("background must define the Denia bubble field");
}
for (const retiredFragment of [
  "M147 138l15 25",
  'translate(1575 170) rotate(8)',
  'translate(269 820)',
]) {
  if (backgroundSource.includes(retiredFragment)) {
    throw new Error(`background still contains retired decoration: ${retiredFragment}`);
  }
}
for (const spineFragment of [
  "M948 145V960",
  "M965 154V953",
  "M923 234c-42-32-42 64 0 32h49c42 32 42-64 0-32z",
]) {
  if (backgroundSource.includes(spineFragment)) {
    throw new Error(`background must not contain a center spine: ${spineFragment}`);
  }
}
for (const retiredPaperPanelId of ["denia-paper-left", "denia-paper-right"]) {
  if (backgroundSource.includes(`id="${retiredPaperPanelId}"`)) {
    throw new Error(`background must not split paper at the center: ${retiredPaperPanelId}`);
  }
}
const paperSurface = backgroundSource.match(/<path id="denia-paper-surface"[^>]*>/)?.[0];
if (!paperSurface || !paperSurface.includes('fill="url(#paper)"')) {
  throw new Error("background must define one continuous paper surface");
}
if (!backgroundSource.includes('id="denia-paper-outline"')) {
  throw new Error("background must define one seam-free outer paper outline");
}
for (const previewSpineFragment of [
  "M596 65C573 121 583 672 596 733",
  "M772 87C746 172 756 798 772 910",
]) {
  if (rendererSource.includes(previewSpineFragment)) {
    throw new Error(`home preview must not contain a center spine: ${previewSpineFragment}`);
  }
}
for (const marker of [
  "renderHomePreview",
  "renderTaskPreview",
  "P2_POLAROID",
  "SINGLE_SOURCE_HOME",
  "IRIDESCENT_MEMBRANE",
  "TASK_STATE_ART",
  "TASK_RAIL_SOURCES",
  "renderTaskRail",
  "previews/home.webp",
  "previews/task.webp",
  "denia-task-warm.webp",
  "denia-task-approval.webp",
  "denia-task-error.webp",
  "denia-task-complete.webp",
]) {
  if (!rendererSource.includes(marker)) throw new Error(`renderer missing ${marker}`);
}
for (const geometry of [
  "const scale = spec.scale || 1;",
  "const stageWidth = Math.round(panelWidth * scale);",
  "const stageHeight = Math.round(1000 * scale);",
  "const stageLeft = Math.round((panelWidth - stageWidth) / 2 + (spec.shiftX || 0));",
  "const stageTop = Math.round((1000 - stageHeight) / 2);",
  '.resize(stageWidth, stageHeight, { fit: "cover", position: "centre" })',
  ".extract({ left: -stageLeft, top: -stageTop, width: panelWidth, height: 1000 })",
]) {
  if (!rendererSource.includes(geometry)) {
    throw new Error(`renderer missing task rail scale/shift geometry: ${geometry}`);
  }
}
const errorStateSpec = rendererSource.match(/\n  error: \{(?<body>[\s\S]*?)\n  \},\n  complete: \{/u)?.groups?.body || "";
if (!errorStateSpec || /\b(?:scale|shiftX)\s*:/u.test(errorStateSpec)) {
  throw new Error("error task art spec must not define scale or shiftX");
}
if (!rendererSource.includes("extract: { left: 1140, top: 100, width: 282, height: 880 }")) {
  throw new Error("error rail must keep the complete face inside the text-free artwork crop");
}
if (rendererSource.includes('target: "sidecar/assets/denia-old-days-dark.webp"')) {
  throw new Error("renderer must not package the retired poster rail");
}
if (rendererSource.includes('target: "sidecar/assets/denia-task-dark.webp"')) {
  throw new Error("renderer must not retain the shared approval/error rail asset");
}
for (const marker of [
  "codex-dream-skin-denia-old-days-0.1.0",
  "catalog-version.json",
  "SHA256SUMS",
  "preview-home.webp",
  "preview-task.webp",
  "zip",
]) {
  if (!localReleaseBuilder.includes(marker)) throw new Error(`local Kaboo release builder missing ${marker}`);
}
const workerTargetIndex = localLauncher.indexOf('WORKER_TARGET="gui/$(/usr/bin/id -u)/$WORKER_LABEL"');
const workerSubmitIndex = localLauncher.indexOf("/bin/launchctl submit");
const workerKickstartIndex = localLauncher.indexOf(
  '/bin/launchctl kickstart "$WORKER_TARGET"',
  workerSubmitIndex,
);
const workerStartedMessageIndex = localLauncher.indexOf(
  "The themed Codex startup is running.",
  workerSubmitIndex,
);
if (
  workerTargetIndex < 0
  || workerSubmitIndex < workerTargetIndex
  || workerKickstartIndex < workerSubmitIndex
  || workerStartedMessageIndex < workerKickstartIndex
) {
  throw new Error("local launcher must kickstart the submitted worker before reporting startup");
}
const waitForCodexToStopBody = localLauncher.match(
  /wait_for_codex_to_stop\(\) \{(?<body>[\s\S]*?)\n\}/u,
)?.groups?.body || "";
if (!/codex_is_running && fail "Codex did not quit within 20 seconds"\s+return 0\s*$/u.test(waitForCodexToStopBody)) {
  throw new Error("local launcher must return success after Codex has stopped");
}
const injectorDetectorProgram = localLauncher.match(
  /injector_is_running\(\) \{[\s\S]*?\/usr\/bin\/awk[^']*'(?<program>[\s\S]*?)'\n\}/u,
)?.groups?.program || "";
const injectorDetectorResult = spawnSync(
  "/usr/bin/awk",
  [
    "-v", "injector=/runtime/injector.mjs",
    "-v", "port=9341",
    "-v", "theme=/theme",
    injectorDetectorProgram,
  ],
  {
    encoding: "utf8",
    input: "node /runtime/injector.mjs --watch --port 9341 --theme-dir /theme\n",
  },
);
if (injectorDetectorResult.status !== 0) {
  throw new Error(`local launcher injector detector must accept a matching process: ${injectorDetectorResult.stderr.trim()}`);
}
const managedCodexLaunchIndex = localLauncher.indexOf("/usr/bin/open -n");
const managedCodexBundleIndex = localLauncher.indexOf('"$CODEX_BUNDLE"', managedCodexLaunchIndex);
const managedCodexArgsIndex = localLauncher.indexOf("--args", managedCodexBundleIndex);
const cdpWaitAfterManagedLaunchIndex = localLauncher.indexOf("\nwait_for_cdp\n", managedCodexArgsIndex);
if (
  managedCodexLaunchIndex < 0
  || managedCodexBundleIndex < managedCodexLaunchIndex
  || managedCodexArgsIndex < managedCodexBundleIndex
  || cdpWaitAfterManagedLaunchIndex < managedCodexArgsIndex
  || localLauncher.includes('/usr/bin/nohup "$CODEX_EXE"')
) {
  throw new Error("local launcher must start Codex as a managed LaunchServices application");
}
const injectorSubmitIndex = localLauncher.indexOf('/bin/launchctl submit \\\n    -l "$INJECTOR_LABEL"');
const injectorKickstartIndex = localLauncher.indexOf(
  '/bin/launchctl kickstart "$INJECTOR_TARGET"',
  injectorSubmitIndex,
);
if (
  injectorSubmitIndex < 0
  || injectorKickstartIndex < injectorSubmitIndex
  || localLauncher.includes('/usr/bin/nohup "$CODEX_NODE" "$INJECTOR"')
) {
  throw new Error("local launcher must keep the injector in its own launchd job");
}
const sidecarPathIndex = localLauncher.indexOf('SIDECAR_PATH="${CODEX_NODE%/*}:/usr/bin:/bin:/usr/sbin:/sbin"');
const sidecarStartIndex = localLauncher.indexOf(
  'PATH="$SIDECAR_PATH" "$EXTENSION_ROOT/scripts/start.sh"',
  sidecarPathIndex,
);
const sidecarVerifyIndex = localLauncher.indexOf(
  'PATH="$SIDECAR_PATH" "$EXTENSION_ROOT/scripts/verify.sh"',
  sidecarStartIndex,
);
if (
  sidecarPathIndex < 0
  || sidecarStartIndex < sidecarPathIndex
  || sidecarVerifyIndex < sidecarStartIndex
) {
  throw new Error("local launcher must provide Codex's Node runtime to the Sidecar scripts");
}
for (const [label, sourceText] of [
  ["asset renderer", rendererSource],
  ["local release builder", localReleaseBuilder],
  ["README", readme],
]) {
  for (const forbidden of [
    /\/Users\//u,
    /\/Applications\//u,
    /ByteDance\/workspace/u,
    /Codex-Dream-Skin/u,
    /\bKABOO_SHARP_ENTRY\b/u,
    /\bSTUDIO_ROOT\b/u,
    /\bKABOO_CLI\b/u,
    /start-local-test\.command/u,
  ]) {
    if (forbidden.test(sourceText)) {
      throw new Error(`${label} must use Kaboo's managed runtime instead of an external source checkout: ${forbidden}`);
    }
  }
}
for (const marker of [
  "暖色 P2 拍立得",
  "深色全景首页",
  "<!-- kaboo-theme-readme:v1 -->",
  "## Layout verification",
]) {
  if (!localReleaseBuilder.includes(marker)) throw new Error(`local Kaboo release builder missing theme description: ${marker}`);
}
if (!localReleaseBuilder.includes('recommendedNativeAppearance: "light"')) {
  throw new Error("local Kaboo release builder must keep the recommended native appearance light");
}
if (/approval\s*\/\s*error/iu.test(localReleaseBuilder)) {
  throw new Error("local Kaboo release builder must not describe approval/error as shared artwork");
}
for (const retiredFragment of [
  "official/denia-portrait.png",
  "--denia-old-days-art-portrait",
  "portraitFallback",
  "__DENIA_OLD_DAYS_EXTENSION_PORTRAIT_ART_JSON__",
]) {
  if ([rendererSource, runtimeCss, runtimeJs, runtimeLoader].some((sourceText) => sourceText.includes(retiredFragment))) {
    throw new Error(`implementation still uses retired isolated portrait asset: ${retiredFragment}`);
  }
}
if (!runtimeCss.includes("conic-gradient")) {
  throw new Error("runtime bubbles must use an iridescent membrane treatment");
}
if (!runtimeCss.includes(".denia-old-days-ds-photo::before")) {
  throw new Error("runtime polaroid must include a separate paper backing layer");
}
if (runtimeCss.includes("aspect-ratio: 3 / 4")) {
  throw new Error("compact home must preserve the shared cinematic source instead of switching to portrait framing");
}

const taskPreview = fs.readFileSync(path.join(root, "art/source/task-preview.svg"), "utf8");
if (!taskPreview.includes("观察记录 · WORKING")) throw new Error("task preview must declare the working state");
if (["完成显影", "已归档"].some((copy) => taskPreview.includes(copy))) {
  throw new Error("task preview must not mix working and complete states");
}
const composerBounds = taskPreview.match(
  /<g id="task-composer-safe" transform="translate\((?<left>\d+) (?<top>\d+)\)">\s*<rect width="(?<width>\d+)" height="(?<height>\d+)"/u,
)?.groups;
if (!composerBounds) throw new Error("task preview must expose deterministic composer bounds");
const composerRight = Number(composerBounds.left) + Number(composerBounds.width);
if (composerRight > 1220) {
  throw new Error(`task preview composer enters the rail safety zone: right edge ${composerRight}`);
}

const assertInsideRepository = (inputKind, candidates) => {
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error(`${inputKind} escapes the repository: ${resolved}`);
    }
    if (!fs.existsSync(resolved)) {
      throw new Error(`${inputKind} is missing: ${resolved}`);
    }
  }
};
if (!rendererSource.includes("RENDERER_SOURCE_INPUTS")) {
  throw new Error("renderer must use a structured source input list");
}
if (!localReleaseBuilder.includes("RELEASE_COPY_SOURCES")) {
  throw new Error("release builder must use a structured copy-source list");
}
const sidecarRoot = path.resolve(root, "sidecar");
const sidecarManifest = JSON.parse(fs.readFileSync(path.join(sidecarRoot, "extension.json"), "utf8"));
if (sidecarManifest.assets?.darkHomeArtwork !== "assets/denia-home-dark.webp") {
  throw new Error("dark home artwork manifest entry mismatch");
}
const manifestInputs = [
  sidecarManifest.entrypoints?.style,
  sidecarManifest.entrypoints?.runtime,
  ...Object.values(sidecarManifest.assets || {}),
].map((relative) => {
  if (typeof relative !== "string" || !relative) throw new Error("Sidecar manifest contains an invalid input path");
  return path.resolve(sidecarRoot, relative);
});
const rendererInputs = RENDERER_SOURCE_INPUTS.map((relative) => path.resolve(root, relative));
const releaseZipInputs = Object.values(RELEASE_COPY_SOURCES).map((relative) => path.resolve(root, relative));
for (const [name, inputs] of [
  ["Sidecar manifest", manifestInputs],
  ["renderer input list", rendererInputs],
  ["release ZIP input list", releaseZipInputs],
]) {
  assertInsideRepository(name, inputs);
}

const generatedFiles = [
  "theme/background.jpg",
  "sidecar/assets/denia-old-days-bright.webp",
  "sidecar/assets/denia-home-dark.webp",
  "sidecar/assets/denia-task-warm.webp",
  "sidecar/assets/denia-task-approval.webp",
  "sidecar/assets/denia-task-error.webp",
  "sidecar/assets/denia-task-complete.webp",
  "sidecar/assets/denia-right-sidebar.webp",
  "sidecar/assets/denia-right-sidebar-wide.webp",
  "previews/home.webp",
  "previews/task.webp",
];

for (const relative of generatedFiles) {
  const stat = fs.statSync(path.join(root, relative));
  if (!stat.isFile() || stat.size === 0) throw new Error(`empty ${relative}`);
  if (relative.endsWith(".webp") && stat.size >= 1024 * 1024) {
    throw new Error(`runtime artwork must remain below 1 MiB: ${relative}`);
  }
}

const darkHomeArtwork = path.join(root, "sidecar/assets/denia-home-dark.webp");
const darkHomeMetadata = await sharp(darkHomeArtwork).metadata();
if (darkHomeMetadata.format !== "webp" || (darkHomeMetadata.width || 0) < 2048 || (darkHomeMetadata.height || 0) < 1152) {
  throw new Error(`dark home artwork must be a WebP of at least 2048x1152: ${darkHomeMetadata.width}x${darkHomeMetadata.height}`);
}

const rightSidebarArtwork = path.join(root, "sidecar/assets/denia-right-sidebar.webp");
const rightSidebarMetadata = await sharp(rightSidebarArtwork).metadata();
if (
  rightSidebarMetadata.format !== "webp"
  || rightSidebarMetadata.width !== 640
  || rightSidebarMetadata.height !== 1600
) {
  throw new Error(
    `right sidebar artwork must be a 640x1600 WebP: ${rightSidebarMetadata.width}x${rightSidebarMetadata.height}`,
  );
}

const rightSidebarWideArtwork = path.join(root, "sidecar/assets/denia-right-sidebar-wide.webp");
const rightSidebarWideMetadata = await sharp(rightSidebarWideArtwork).metadata();
if (
  rightSidebarWideMetadata.format !== "webp"
  || rightSidebarWideMetadata.width !== 1840
  || rightSidebarWideMetadata.height !== 1080
) {
  throw new Error(
    `right sidebar wide artwork must be a 1840x1080 WebP: ${rightSidebarWideMetadata.width}x${rightSidebarWideMetadata.height}`,
  );
}

for (const relative of ["previews/home.webp", "previews/task.webp"]) {
  const metadata = await sharp(path.join(root, relative)).metadata();
  if (metadata.format !== "webp" || metadata.width !== 1600 || metadata.height !== 1000) {
    throw new Error(`public preview must be a 1600x1000 WebP: ${relative}`);
  }
}
const errorRail = fs.readFileSync(path.join(root, "sidecar/assets/denia-task-error.webp"));
const errorRailHash = crypto.createHash("sha256").update(errorRail).digest("hex");
if (errorRailHash !== "55ebb464e95001b96f6a68c5a18054e80e0764450551e4e912a4c4b525f1c8c6") {
  throw new Error(`error rail face-safe crop hash mismatch: ${errorRailHash}`);
}

console.log("source structure ok");
