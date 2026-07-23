import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const sharpEntry = process.env.KABOO_SHARP_ENTRY;
if (!sharpEntry) throw new Error("KABOO_SHARP_ENTRY is required");

const { default: sharp } = await import(pathToFileURL(path.resolve(sharpEntry)).href);
const source = (name) => path.join(root, "art/source", name);
const output = (name) => path.join(root, name);

await Promise.all([
  fs.mkdir(output("theme"), { recursive: true }),
  fs.mkdir(output("sidecar/assets"), { recursive: true }),
  fs.mkdir(output("evidence"), { recursive: true }),
]);

await sharp(source("background.svg"))
  .resize(1920, 1080, { fit: "cover" })
  .flatten({ background: "#eaf7f7" })
  .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
  .toFile(output("theme/background.jpg"));

const runtimeArt = [
  {
    source: "official/old-days-bright-102s.jpg",
    target: "sidecar/assets/denia-old-days-bright.webp",
    resize: { width: 1440, height: 810, fit: "cover", position: "centre" },
    webp: { quality: 86, smartSubsample: true },
  },
  {
    source: "official/denia-poster-wide.png",
    target: "sidecar/assets/denia-old-days-dark.webp",
    resize: { width: 1380, height: 810, fit: "cover", position: "centre" },
    webp: { quality: 84, smartSubsample: true },
  },
  {
    source: "official/denia-portrait.png",
    target: "sidecar/assets/denia-old-days-portrait.webp",
    resize: { width: 640, height: 996, fit: "inside", withoutEnlargement: true },
    webp: { quality: 88, alphaQuality: 92 },
  },
];

for (const item of runtimeArt) {
  await sharp(source(item.source))
    .resize(item.resize)
    .webp(item.webp)
    .toFile(output(item.target));
}

await fs.rm(output("sidecar/assets/denia-old-days-hero.webp"), { force: true });

const P2_POLAROID = Object.freeze({
  paper: "#fffdf5",
  paperShadow: "#335965",
  innerEdge: "#292743",
  coral: "#f29aab",
  cyan: "#86d5df",
});

function homeLayoutOverlay({ width, height, compact }) {
  if (compact) {
    return Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <rect x="54" y="44" width="1092" height="712" rx="32" fill="#f9ffff" fill-opacity=".76" stroke="#86d5df" stroke-opacity=".5"/>
        <text x="108" y="126" fill="#657f8b" font-family="Arial, sans-serif" font-size="11" letter-spacing="4">DENIA · OLD DAYS IN COLOR</text>
        <text x="108" y="177" fill="#263548" font-family="Arial, sans-serif" font-size="38" font-weight="700">今天要把什么写进手账？</text>
        <text x="108" y="213" fill="#647789" font-family="Arial, sans-serif" font-size="16">让思绪显影，也让每一步留下记录。</text>
        ${[
          ["翻阅并理解代码", 254],
          ["写下新的实现", 321],
          ["校对这页改动", 388],
          ["修补未完成的记录", 455],
        ].map(([label, y]) => `
          <rect x="108" y="${y}" width="492" height="52" rx="16" fill="#fff" stroke="#b8dde3"/>
          <text x="134" y="${y + 33}" fill="#263548" font-family="Arial, sans-serif" font-size="15">${label}</text>
        `).join("")}
        <rect x="108" y="642" width="548" height="72" rx="24" fill="#fff" fill-opacity=".94" stroke="#86d5df" stroke-width="2"/>
        <text x="140" y="685" fill="#7d939d" font-family="Arial, sans-serif" font-size="15">让达妮娅记录下一项任务…</text>
        <circle cx="613" cy="678" r="24" fill="#293448"/>
        <path d="M602 678h22M613 667v22" stroke="#f0d47a" stroke-width="3.5" stroke-linecap="round"/>
      </svg>`);
  }
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="84" y="72" width="1440" height="856" rx="42" fill="#f9ffff" fill-opacity=".72" stroke="#86d5df" stroke-opacity=".5"/>
      <text x="156" y="184" fill="#657f8b" font-family="Arial, sans-serif" font-size="14" letter-spacing="5">DENIA · OLD DAYS IN COLOR</text>
      <text x="156" y="252" fill="#263548" font-family="Arial, sans-serif" font-size="48" font-weight="700">今天要把什么写进手账？</text>
      <text x="156" y="300" fill="#647789" font-family="Arial, sans-serif" font-size="20">让思绪显影，也让每一步留下记录。</text>
      ${[
        ["翻阅并理解代码", 352],
        ["写下新的实现", 440],
        ["校对这页改动", 528],
        ["修补未完成的记录", 616],
      ].map(([label, y]) => `
        <rect x="156" y="${y}" width="472" height="70" rx="21" fill="#fff" stroke="#b8dde3"/>
        <text x="188" y="${y + 44}" fill="#263548" font-family="Arial, sans-serif" font-size="18">${label}</text>
      `).join("")}
      <rect x="156" y="765" width="562" height="92" rx="30" fill="#fff" fill-opacity=".92" stroke="#86d5df" stroke-width="2"/>
      <text x="196" y="820" fill="#7d939d" font-family="Arial, sans-serif" font-size="18">让达妮娅记录下一项任务…</text>
      <circle cx="664" cy="811" r="30" fill="#293448"/>
      <path d="M651 811h26M664 798v26" stroke="#f0d47a" stroke-width="4" stroke-linecap="round"/>
    </svg>`);
}

function bubbleTransitionOverlay({ width, height, compact }) {
  const bubbles = compact
    ? [
      { cx: 1094, cy: 118, r: 46 },
      { cx: 1034, cy: 154, r: 17 },
      { cx: 1104, cy: 642, r: 26 },
    ]
    : [
      { cx: 1454, cy: 176, r: 58 },
      { cx: 1384, cy: 218, r: 21 },
      { cx: 1422, cy: 694, r: 31 },
    ];
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <radialGradient id="memory-bubble" cx="29%" cy="24%" r="72%">
          <stop offset="0" stop-color="#fff" stop-opacity=".94"/>
          <stop offset=".24" stop-color="#fff" stop-opacity=".14"/>
          <stop offset=".58" stop-color="${P2_POLAROID.cyan}" stop-opacity=".2"/>
          <stop offset=".82" stop-color="${P2_POLAROID.coral}" stop-opacity=".18"/>
          <stop offset="1" stop-color="${P2_POLAROID.cyan}" stop-opacity=".05"/>
        </radialGradient>
      </defs>
      ${bubbles.map(({ cx, cy, r }) => `
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#memory-bubble)"
          stroke="${P2_POLAROID.cyan}" stroke-opacity=".72"/>
      `).join("")}
    </svg>`);
}

async function renderHomePreview({ compact }) {
  const size = compact ? { width: 1200, height: 800 } : { width: 1600, height: 1000 };
  const photoSpec = compact
    ? { width: 286, height: 430, file: "official/denia-portrait.png", fit: "contain", side: 11, bottom: 42 }
    : { width: 610, height: 343, file: "official/old-days-bright-102s.jpg", fit: "cover", side: 13, bottom: 57 };
  const frameWidth = photoSpec.width + photoSpec.side * 2;
  const frameHeight = photoSpec.height + photoSpec.side + photoSpec.bottom;
  const canvasInset = 30;
  const photo = await sharp(source(photoSpec.file))
    .resize(photoSpec.width, photoSpec.height, {
      fit: photoSpec.fit,
      position: "centre",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const paper = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${frameWidth + canvasInset * 2}" height="${frameHeight + canvasInset * 2}">
      <defs>
        <pattern id="grain" width="13" height="13" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="4" r=".7" fill="${P2_POLAROID.coral}" opacity=".06"/>
          <circle cx="10" cy="9" r=".65" fill="${P2_POLAROID.innerEdge}" opacity=".045"/>
        </pattern>
        <filter id="paper-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="16" stdDeviation="13" flood-color="${P2_POLAROID.paperShadow}" flood-opacity=".2"/>
        </filter>
      </defs>
      <g filter="url(#paper-shadow)">
        <rect x="${canvasInset + .5}" y="${canvasInset + .5}" width="${frameWidth - 1}" height="${frameHeight - 1}" rx="5"
          fill="${P2_POLAROID.paper}" stroke="#d8d2c4"/>
        <rect x="${canvasInset + 1}" y="${canvasInset + 1}" width="${frameWidth - 2}" height="${frameHeight - 2}" rx="4" fill="url(#grain)"/>
        <rect x="${canvasInset + photoSpec.side - 1}" y="${canvasInset + photoSpec.side - 1}"
          width="${photoSpec.width + 2}" height="${photoSpec.height + 2}"
          fill="none" stroke="${P2_POLAROID.innerEdge}" stroke-opacity=".14"/>
      </g>
    </svg>`);
  const polaroid = await sharp(paper)
    .composite([{
      input: photo,
      left: canvasInset + photoSpec.side,
      top: canvasInset + photoSpec.side,
    }])
    .rotate(-1.3, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const background = await sharp(source("background.svg"))
    .resize(size.width, size.height, { fit: "cover" })
    .png()
    .toBuffer();
  const position = compact ? { left: 776, top: 104 } : { left: 785, top: 174 };
  return sharp(background)
    .composite([
      { input: homeLayoutOverlay({ ...size, compact }), left: 0, top: 0 },
      { input: polaroid, ...position },
      { input: bubbleTransitionOverlay({ ...size, compact }), left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const [homePreview, compactHomePreview] = await Promise.all([
  renderHomePreview({ compact: false }),
  renderHomePreview({ compact: true }),
]);
await Promise.all([
  sharp(homePreview).toFile(output("evidence/home.png")),
  sharp(compactHomePreview).toFile(output("evidence/home-compact.png")),
]);

const [taskBackground, taskRailArt] = await Promise.all([
  sharp(source("task-preview.svg")).resize(1600, 1000, { fit: "cover" }).png().toBuffer(),
  sharp(output("sidecar/assets/denia-old-days-dark.webp"))
    .resize(148, 1000, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .linear([1, 1, 1, 0.16], [0, 0, 0, 0])
    .png()
    .toBuffer(),
]);

await sharp(taskBackground)
  .composite([{ input: taskRailArt, left: 1452, top: 0 }])
  .resize(1600, 1000, { fit: "cover" })
  .png({ compressionLevel: 9 })
  .toFile(output("evidence/task.png"));

for (const item of runtimeArt) {
  const stat = await fs.stat(output(item.target));
  if (stat.size > 1024 * 1024) {
    throw new Error(`runtime artwork exceeds 1 MiB: ${item.target}`);
  }
}

console.log("rendered 7 Denia assets");
