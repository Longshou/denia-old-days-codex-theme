import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

for (const relative of ["canon", "art/source", "theme", "sidecar", "evidence"]) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`missing ${relative}`);
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
if (!readme.includes("denia-old-days@0.1.0")) throw new Error("README identity missing");

console.log("source structure ok");
