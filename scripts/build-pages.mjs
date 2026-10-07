// Builds the static copy of the site that GitHub Pages serves, into out/.
//
// Pages serves plain files. This copies the project into .pages-build/ and
// runs `next build` there with GITHUB_PAGES=1, a static export (see
// next.config.ts). The source tree is not touched.
//
//   npm run build:pages

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const stage = path.join(root, ".pages-build");

const SKIP = new Set([".git", "package-lock.json", ".next", ".pages-build", "node_modules", "out", "worker"]);

fs.rmSync(stage, { recursive: true, force: true });
for (const entry of fs.readdirSync(root)) {
  if (!SKIP.has(entry)) fs.cpSync(path.join(root, entry), path.join(stage, entry), { recursive: true });
}
fs.symlinkSync(path.join(root, "node_modules"), path.join(stage, "node_modules"), "dir");

execFileSync("npx", ["next", "build"], {
  cwd: stage,
  stdio: "inherit",
  env: { ...process.env, GITHUB_PAGES: "1" },
});

fs.rmSync(path.join(root, "out"), { recursive: true, force: true });
fs.renameSync(path.join(stage, "out"), path.join(root, "out"));
fs.rmSync(stage, { recursive: true, force: true });
console.log("Static site written to out/");
