import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

for (const relative of ["canon", "art/source", "theme", "sidecar", "evidence"]) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`missing ${relative}`);
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
if (!readme.includes("denia-old-days@0.1.0")) throw new Error("README identity missing");

const theme = JSON.parse(fs.readFileSync(path.join(root, "theme/theme.json"), "utf8"));
if (theme.id !== "denia-old-days") throw new Error("theme id mismatch");

for (const relative of [
  "theme/background.jpg",
  "sidecar/assets/denia-old-days-hero.webp",
  "evidence/home.png",
  "evidence/task.png",
]) {
  const stat = fs.statSync(path.join(root, relative));
  if (!stat.isFile() || stat.size === 0) throw new Error(`empty ${relative}`);
}

console.log("source structure ok");
