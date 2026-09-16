import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../src/", import.meta.url);

test("footer ends the page without a reveal runway", async () => {
  const footer = await readFile(new URL("components/SiteFooter.tsx", root), "utf8");

  assert.match(footer, /<footer/);
  assert.match(footer, /copy\.footer\.email/);
  // Officer and member were merged (2026-09-11); there is no officer door.
  assert.doesNotMatch(footer, /Officer sign-in|\/admin/);
  assert.doesNotMatch(
    footer,
    /footer-reveal|GooeyFilter|PixelOval|useEffect|useRef|window\.scrollTo/,
  );
});

test("global styles do not reserve space after the footer", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");

  assert.doesNotMatch(css, /\.footer-reveal-|--footer-reveal-progress/);
});
