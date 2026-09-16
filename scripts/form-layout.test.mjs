import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const components = new URL("../src/components/", import.meta.url);
const app = new URL("../src/app/", import.meta.url);

async function source(path) {
  return readFile(new URL(path, components), "utf8");
}

test("public forms use balanced horizontal desktop field layouts", async () => {
  const [audience, inquiry, join, field, section, home] = await Promise.all([
    source("AudienceSwitch.tsx"),
    source("InquiryForm.tsx"),
    source("JoinForm.tsx"),
    source("ui/Field.tsx"),
    source("Section.tsx"),
    readFile(new URL("page.tsx", app), "utf8"),
  ]);

  assert.match(audience, /max-w-3xl/);
  assert.doesNotMatch(audience, /max-w-\[30rem\]/);
  assert.match(inquiry, /sm:grid-cols-2/);
  assert.match(inquiry, /rows=\{4\}/);
  assert.match(join, /<form[^>]+max-w-none/);
  assert.match(join, /sm:grid-cols-3/);
  assert.ok(
    field.indexOf('{children}') < field.indexOf("{help ?"),
    "helper text should render after the control",
  );
  assert.match(section, /compact\?: boolean/);
  assert.match(home, /id="signup"[\s\S]*?compact/);
});

test("display headings use Goudy Bookletter at its native weight", async () => {
  const css = await readFile(new URL("globals.css", app), "utf8");

  assert.match(
    css,
    /--font-display:\s*"goudy-bookletter-1911"[^;]*serif;/,
  );
  assert.match(css, /\.display\s*\{[^}]*font-weight:\s*400;[^}]*font-style:\s*normal;/s);
});

test("signup orb stays inside the right viewport edge", async () => {
  const orb = await source("visuals/SignupOrb.tsx");

  assert.doesNotMatch(orb, /right-\[\s*-\d/);
  assert.match(orb, /right-\[clamp\(/);
});
