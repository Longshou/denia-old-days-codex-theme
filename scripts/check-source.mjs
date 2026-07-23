import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

for (const relative of ["canon", "art/source", "theme", "sidecar", "evidence"]) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`missing ${relative}`);
}

const officialSources = new Map([
  ["art/source/official/old-days-bright-102s.jpg", "d0989c926a8dcb8033c21e781fc6c99a5d6e550d3233dac2789ca688e9c7f1dd"],
  ["art/source/official/denia-poster-wide.png", "1a5fc296eba320eff8fcab37be15fd017dce4b682ce4a4695c2dabbe1e54e6b1"],
  ["art/source/official/denia-garden-bubbles-warm.jpg", "481bf5ff8fa4f54d5b696f6144fb3f6a7d3b2d8b580cf2a5baee39409110489b"],
  ["art/source/official/denia-dark-direct-gaze.jpg", "aae25be7ff9670c43a8f36a4019fa445c28fb51c57f69a477c008277bc197292"],
  ["art/source/official/denia-anniversary-direct-gaze.jpg", "dea27e716f9561131e2b5255ea60a84de2512e8e81886073f09c64e02739fc6e"],
  ["art/source/official/denia-dual-form-panorama.jpg", "646b290ae6a7584ce617cad85976f5caa6ae74e6d6678cd86a17a028266648b5"],
  ["art/source/official/denia-approval-dual-form.jpg", "3339a65536eb6b8cff762f4ac441df6358e857c8b25f0ddaecbade8e457f84c0"],
  ["art/source/official/denia-error-reaching.jpg", "42c2a49b83de911a01627501875e6df992ac26da556c90b2c64433883eb353f4"],
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
for (const marker of [
  "renderHomePreview",
  "renderTaskPreview",
  "P2_POLAROID",
  "SINGLE_SOURCE_HOME",
  "IRIDESCENT_MEMBRANE",
  "TASK_STATE_ART",
  "TASK_RAIL_SOURCES",
  "renderTaskRail",
  "evidence/home-compact.png",
  "evidence/task-staged.png",
  "evidence/task-approval.png",
  "evidence/task-error.png",
  "denia-task-warm.webp",
  "denia-task-approval.webp",
  "denia-task-error.webp",
  "denia-task-complete.webp",
  "renderTaskTransition",
  "evidence/task-working-to-approval-350ms.png",
  "evidence/task-error-to-complete-500ms.png",
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
  "start-local-test.command",
  "zip",
]) {
  if (!localReleaseBuilder.includes(marker)) throw new Error(`local Kaboo release builder missing ${marker}`);
}
const localInstallIndex = localReleaseBuilder.indexOf(
  '"$STUDIO_ROOT/scripts/install-dream-skin-macos.sh" --no-launchers --no-launch',
);
const themeInstallIndex = localReleaseBuilder.indexOf(
  'codex-theme install-local "$CATALOG"',
  localInstallIndex,
);
const studioStartIndex = localReleaseBuilder.indexOf(
  '"$STUDIO_ROOT/scripts/start-dream-skin-macos.sh" --port 9341',
  themeInstallIndex,
);
const themeActivateIndex = localReleaseBuilder.indexOf(
  "codex-theme activate ${id}",
  studioStartIndex,
);
if (
  localInstallIndex < 0
  || themeInstallIndex < localInstallIndex
  || studioStartIndex < themeInstallIndex
  || themeActivateIndex < studioStartIndex
) {
  throw new Error("local launcher must install Denia before starting Codex, then activate it");
}
for (const marker of [
  "四组本地角色美术",
  "warm garden-and-bubbles artwork",
  "approval uses the official dual-form vertical artwork",
  "error uses the separate official anniversary exhibition artwork with a complete unsmiling face and tense raised-arm movement",
  "complete uses the bright anniversary direct-gaze crop",
  "3339a65536eb6b8cff762f4ac441df6358e857c8b25f0ddaecbade8e457f84c0",
  "42c2a49b83de911a01627501875e6df992ac26da556c90b2c64433883eb353f4",
]) {
  if (!localReleaseBuilder.includes(marker)) throw new Error(`local Kaboo release builder missing separate task-art provenance: ${marker}`);
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

const generatedFiles = [
  "theme/background.jpg",
  "sidecar/assets/denia-old-days-bright.webp",
  "sidecar/assets/denia-task-warm.webp",
  "sidecar/assets/denia-task-approval.webp",
  "sidecar/assets/denia-task-error.webp",
  "sidecar/assets/denia-task-complete.webp",
  "evidence/home.png",
  "evidence/home-compact.png",
  "evidence/task-staged.png",
  "evidence/task.png",
  "evidence/task-approval.png",
  "evidence/task-error.png",
  "evidence/task-working-to-approval-350ms.png",
  "evidence/task-error-to-complete-500ms.png",
  "evidence/task-complete.png",
];

for (const relative of generatedFiles) {
  const stat = fs.statSync(path.join(root, relative));
  if (!stat.isFile() || stat.size === 0) throw new Error(`empty ${relative}`);
  if (relative.endsWith(".webp") && stat.size > 1024 * 1024) {
    throw new Error(`runtime artwork exceeds 1 MiB: ${relative}`);
  }
}

const expectedDimensions = new Map([
  ["evidence/home.png", [1600, 1000]],
  ["evidence/home-compact.png", [1200, 800]],
  ["evidence/task-staged.png", [1600, 1000]],
  ["evidence/task.png", [1600, 1000]],
  ["evidence/task-approval.png", [1600, 1000]],
  ["evidence/task-error.png", [1600, 1000]],
  ["evidence/task-working-to-approval-350ms.png", [1600, 1000]],
  ["evidence/task-error-to-complete-500ms.png", [1600, 1000]],
  ["evidence/task-complete.png", [1600, 1000]],
]);
for (const [relative, [expectedWidth, expectedHeight]] of expectedDimensions) {
  const bytes = fs.readFileSync(path.join(root, relative));
  if (bytes.toString("ascii", 1, 4) !== "PNG") throw new Error(`not a PNG: ${relative}`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`unexpected dimensions for ${relative}: ${width}x${height}`);
  }
}

const workingEvidence = fs.readFileSync(path.join(root, "evidence/task.png"));
const workingEvidenceHash = crypto.createHash("sha256").update(workingEvidence).digest("hex");
if (workingEvidenceHash !== "7719c000b70ed5f94858ebe4bf341c756fee77c1776bc43b47ec32d27f21d3e4") {
  throw new Error(`working evidence hash mismatch: ${workingEvidenceHash}`);
}
const errorRail = fs.readFileSync(path.join(root, "sidecar/assets/denia-task-error.webp"));
const errorRailHash = crypto.createHash("sha256").update(errorRail).digest("hex");
if (errorRailHash !== "55ebb464e95001b96f6a68c5a18054e80e0764450551e4e912a4c4b525f1c8c6") {
  throw new Error(`error rail face-safe crop hash mismatch: ${errorRailHash}`);
}

console.log("source structure ok");
