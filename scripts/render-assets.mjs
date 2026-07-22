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

await sharp(source("hero.svg"))
  .resize({ width: 1400, withoutEnlargement: true })
  .webp({ quality: 86, alphaQuality: 92 })
  .toFile(output("sidecar/assets/denia-old-days-hero.webp"));

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
  <rect x="156" y="765" width="1010" height="92" rx="30" fill="#fff" fill-opacity=".91" stroke="#8fd2dd" stroke-width="2"/>
  <text x="196" y="820" fill="#8b9da5" font-family="Arial, sans-serif" font-size="18">让达妮娅记录下一项任务…</text>
  <circle cx="1112" cy="811" r="30" fill="#263548"/>
  <path d="M1099 811h26M1112 798v26" stroke="#f7d88a" stroke-width="4" stroke-linecap="round"/>
  <rect x="1178" y="112" width="238" height="46" rx="23" fill="#eaf7f7" stroke="#8fd2dd"/>
  <text x="1206" y="141" fill="#55717c" font-family="Arial, sans-serif" font-size="14">布景之形 · 记录中</text>
</svg>`);

const [background, hero] = await Promise.all([
  sharp(source("background.svg")).resize(1600, 1000, { fit: "cover" }).png().toBuffer(),
  sharp(source("hero.svg")).resize({ width: 760 }).png().toBuffer(),
]);

await sharp(background)
  .composite([
    { input: hero, left: 790, top: 128 },
    { input: homeOverlay, left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(output("evidence/home.png"));

await sharp(source("task-preview.svg"))
  .resize(1600, 1000, { fit: "cover" })
  .png({ compressionLevel: 9 })
  .toFile(output("evidence/task.png"));

const heroStat = await fs.stat(output("sidecar/assets/denia-old-days-hero.webp"));
if (heroStat.size > 1024 * 1024) throw new Error(`runtime hero exceeds 1 MiB: ${heroStat.size}`);

console.log("rendered 4 Denia assets");
