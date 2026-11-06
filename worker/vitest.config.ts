import path from "node:path";
import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

// Runs the tests inside workerd (Miniflare) with a real, empty D1 and KV. The
// migrations are read here, in Node, and handed to the tests as a binding;
// test/helpers.ts applies them.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        // The AI binding would otherwise open a remote session.
        remoteBindings: false,
        miniflare: {
          d1Databases: ["DB"],
          kvNamespaces: ["REPORTS"],
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    resolve: { alias: { "@": path.join(import.meta.dirname, "../src") } },
    test: { include: ["test/**/*.test.ts"] },
  };
});
