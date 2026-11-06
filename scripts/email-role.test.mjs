import assert from "node:assert/strict";
import test from "node:test";

// Projectum gives each account its role from the email domain, so the
// match must be exact: a suffix match would make every student a rep.
const { roleForEmail, emailDomain, PERSONAL_DOMAINS } = await import("../src/lib/email-rules.ts");

test("faculty and staff addresses are reps", () => {
  assert.equal(roleForEmail("prof@weber.edu"), "rep");
  assert.equal(roleForEmail("  Prof@Weber.EDU "), "rep");
});

test("student addresses are members, not reps", () => {
  assert.equal(roleForEmail("kid@mail.weber.edu"), "member");
});

test("every other address is a partner", () => {
  for (const email of ["boss@acme.com", "x@notweber.edu", "x@evil.weber.edu", "x@weber.edu.evil.com", "x@gmail.com"]) {
    assert.equal(roleForEmail(email), "partner", email);
  }
});

test("personal domains are known", () => {
  assert.equal(emailDomain("A@Gmail.com"), "gmail.com");
  assert.ok(PERSONAL_DOMAINS.includes("gmail.com"));
});
