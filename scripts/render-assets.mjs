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

const homePhoto = await sharp(source("official/old-days-bright-102s.jpg"))
  .resize(610, 343, { fit: "cover", position: "centre" })
  .extend({ top: 18, right: 18, bottom: 52, left: 18, background: "#fffef8" })
  .rotate(-1.2, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const homeOverlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
  <rect x="84" y="72" width="1440" height="856" rx="42" fill="#f9ffff" fill-opacity=".72" stroke="#8fd2dd" stroke-opacity=".5"/>
  <text x="156" y="184" fill="#6b8491" font-family="Arial, sans-serif" font-size="14" letter-spacing="5">DENIA · OLD DAYS IN COLOR</text>
  <text x="156" y="252" fill="#263548" font-family="Arial, sans-serif" font-size="48" font-weight="700">今天要把什么写进手账？</text>
  <text x="156" y="300" fill="#647789" font-family="Arial, sans-serif" font-size="20">让思绪显影，也让每一步留下记录。</text>
  <rect x="156" y="352" width="472" height="70" rx="21" fill="#fff" stroke="#b8dde3"/>
  <text x="188" y="396" fill="#263548" font-family="Arial, sans-serif" font-size="18">翻阅并理解代码</text>
  <rect x="156" y="440" width="472" height="70" rx="21" fill="#fff" stroke="#b8dde3"/>
  <text x="188" y="484" fill="#263548" font-family="Arial, sans-serif" font-size="18">写下新的实现</text>
  <rect x="156" y="528" width="472" height="70" rx="21" fill="#fff" stroke="#b8dde3"/>
  <text x="188" y="572" fill="#263548" font-family="Arial, sans-serif" font-size="18">校对这页改动</text>
  <rect x="156" y="616" width="472" height="70" rx="21" fill="#fff" stroke="#b8dde3"/>
  <text x="188" y="660" fill="#263548" font-family="Arial, sans-serif" font-size="18">修补未完成的记录</text>
  <rect x="156" y="765" width="562" height="92" rx="30" fill="#fff" fill-opacity=".91" stroke="#8fd2dd" stroke-width="2"/>
  <text x="196" y="820" fill="#8b9da5" font-family="Arial, sans-serif" font-size="18">让达妮娅记录下一项任务…</text>
  <circle cx="664" cy="811" r="30" fill="#263548"/>
  <path d="M651 811h26M664 798v26" stroke="#f7d88a" stroke-width="4" stroke-linecap="round"/>
</svg>`);

const background = await sharp(source("background.svg"))
  .resize(1600, 1000, { fit: "cover" })
  .png()
  .toBuffer();

await sharp(background)
  .composite([
    { input: homeOverlay, left: 0, top: 0 },
    { input: homePhoto, left: 820, top: 218 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(output("evidence/home.png"));

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

console.log("rendered 6 Denia assets");
