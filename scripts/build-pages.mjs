// Builds the static copy of the site that GitHub Pages serves, into out/.
//
// Pages serves plain files: no server, so no sign-in, API routes, server
// actions or proxy. This copies the project into .pages-build/, takes those
// out, lays pages-static/ over the top (its README lists what each file
// replaces), marks the remaining pages static, and runs `next build` there
// with GITHUB_PAGES=1 (see next.config.ts). The source tree is not touched.
//
//   npm run build:pages

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const stage = path.join(root, ".pages-build");

// Routes and files that need a server. The pages that stay (Log in, Sign
// up, Projectum) switch on NEXT_PUBLIC_STATIC_SITE themselves.
const SERVER_ONLY = ["src/proxy.ts", "src/app/api", "src/app/reset-password"];

const SKIP = new Set([".git", "package-lock.json", ".next", ".pages-build", "node_modules", "out", "pages-static", "worker"]);

fs.rmSync(stage, { recursive: true, force: true });
for (const entry of fs.readdirSync(root)) {
  if (!SKIP.has(entry)) fs.cpSync(path.join(root, entry), path.join(stage, entry), { recursive: true });
}
fs.symlinkSync(path.join(root, "node_modules"), path.join(stage, "node_modules"), "dir");

for (const p of SERVER_ONLY) fs.rmSync(path.join(stage, p), { recursive: true, force: true });
fs.cpSync(path.join(root, "pages-static/src"), path.join(stage, "src"), { recursive: true });

// Pages are built once, so "render on every request" becomes "render now".
for (const file of fs.readdirSync(path.join(stage, "src/app"), { recursive: true })) {
  if (!/\.(tsx?)$/.test(file)) continue;
  const full = path.join(stage, "src/app", file);
  const text = fs.readFileSync(full, "utf8");
  if (text.includes('dynamic = "force-dynamic"')) {
    fs.writeFileSync(full, text.replaceAll('dynamic = "force-dynamic"', 'dynamic = "force-static"'));
  }
}

execFileSync("npx", ["next", "build"], {
  cwd: stage,
  stdio: "inherit",
  env: { ...process.env, GITHUB_PAGES: "1", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
});

fs.rmSync(path.join(root, "out"), { recursive: true, force: true });
fs.renameSync(path.join(stage, "out"), path.join(root, "out"));
fs.rmSync(stage, { recursive: true, force: true });
console.log("Static site written to out/");
