import assert from "node:assert/strict";
import test from "node:test";

// The rules every sign-in path shares, tested against the module itself
// rather than its source text: these are security checks, and a pattern
// match on the file would pass a rule that does the wrong thing.
const rules = await import("../src/lib/auth-rules.ts");

test("only Weber State addresses are accepted", () => {
  assert.equal(rules.isWeberEmail("ann@weber.edu"), true);
  assert.equal(rules.isWeberEmail("ann@mail.weber.edu"), true);
  assert.equal(rules.isWeberEmail("  Ann@Mail.Weber.EDU "), true);

  assert.equal(rules.isWeberEmail("ann@gmail.com"), false);
  // Suffix tricks: the domain must be exactly one of the two.
  assert.equal(rules.isWeberEmail("ann@notweber.edu"), false);
  assert.equal(rules.isWeberEmail("ann@weber.edu.evil.com"), false);
  assert.equal(rules.isWeberEmail("ann@evil.weber.edu"), false);
  assert.equal(rules.isWeberEmail("weber.edu"), false);
  assert.equal(rules.isWeberEmail("a@b@weber.edu"), false);
  assert.equal(rules.isWeberEmail(""), false);
});

test("normalizeEmail trims and lowercases", () => {
  assert.equal(rules.normalizeEmail("  Ann@Weber.EDU "), "ann@weber.edu");
});

test("passwords are 8 to 72 characters", () => {
  assert.equal(rules.passwordProblem(""), "required");
  assert.equal(rules.passwordProblem("short"), "short");
  assert.equal(rules.passwordProblem("a".repeat(8)), null);
  assert.equal(rules.passwordProblem("a".repeat(72)), null);
  assert.equal(rules.passwordProblem("a".repeat(73)), "long");
});

test("safeNext only allows same-site relative paths", () => {
  assert.equal(rules.safeNext("/projectum"), "/projectum");
  assert.equal(rules.safeNext("/admin/events?x=1"), "/admin/events?x=1");

  assert.equal(rules.safeNext(null), "/projectum");
  assert.equal(rules.safeNext(""), "/projectum");
  assert.equal(rules.safeNext("https://evil.com"), "/projectum");
  assert.equal(rules.safeNext("//evil.com"), "/projectum");
  assert.equal(rules.safeNext("/\\evil.com"), "/projectum");
  assert.equal(rules.safeNext("dashboard"), "/projectum");
  assert.equal(rules.safeNext("/login"), "/projectum");
});

test("password hashes verify only the right password", async () => {
  const hash = await rules.hashPassword("correct horse");
  assert.match(hash, /^scrypt\$/);
  assert.notEqual(hash, await rules.hashPassword("correct horse"), "salted");
  assert.equal(await rules.verifyPassword("correct horse", hash), true);
  assert.equal(await rules.verifyPassword("wrong horse", hash), false);
  assert.equal(await rules.verifyPassword("anything", "not-a-hash"), false);
});

test("signed session tokens reject tampering and expiry", () => {
  const secret = "test-secret-test-secret-test-secret";
  const now = 1_700_000_000_000;
  const token = rules.signSession({ uid: "u1" }, secret, now + 60_000);

  assert.deepEqual(rules.readSession(token, secret, now), { uid: "u1" });
  assert.equal(rules.readSession(token, "other-secret-other-secret-other", now), null);
  assert.equal(rules.readSession(token, secret, now + 120_000), null, "expired");

  const [body, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ uid: "admin", exp: now + 60_000 })).toString("base64url");
  assert.equal(rules.readSession(`${forged}.${sig}`, secret, now), null);
  assert.equal(rules.readSession(`${body}.`, secret, now), null);
  assert.equal(rules.readSession("garbage", secret, now), null);
});
