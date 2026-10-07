// Lets `node --test` load the site's TypeScript the way the bundler does:
// `@/` means src/, and an import may leave off its .ts extension. Node
// strips the types itself. Used by `npm test` (package.json).

import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts"];

// The file a specifier names: itself, or with an extension added.
function find(base) {
  return EXTENSIONS.map((ext) => base + ext).find((p) => existsSync(p) && statSync(p).isFile());
}

registerHooks({
  resolve(specifier, context, next) {
    const base = specifier.startsWith("@/")
      ? SRC + specifier.slice(2)
      : specifier.startsWith(".") && context.parentURL?.startsWith("file:")
        ? fileURLToPath(new URL(specifier, context.parentURL))
        : null;
    const file = base && find(base);
    return next(file ? pathToFileURL(file).href : specifier, context);
  },
});
