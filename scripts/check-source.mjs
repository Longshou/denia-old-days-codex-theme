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
  ["art/source/official/denia-portrait.png", "95ad359595edc790084194504dbbd7a5245c6428b9ec78a1aca4dc7bab994245"],
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

const generatedFiles = [
  "theme/background.jpg",
  "sidecar/assets/denia-old-days-bright.webp",
  "sidecar/assets/denia-old-days-dark.webp",
  "sidecar/assets/denia-old-days-portrait.webp",
  "evidence/home.png",
  "evidence/task.png",
];

for (const relative of generatedFiles) {
  const stat = fs.statSync(path.join(root, relative));
  if (!stat.isFile() || stat.size === 0) throw new Error(`empty ${relative}`);
  if (relative.endsWith(".webp") && stat.size > 1024 * 1024) {
    throw new Error(`runtime artwork exceeds 1 MiB: ${relative}`);
  }
}

console.log("source structure ok");
