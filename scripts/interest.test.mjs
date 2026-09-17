import assert from "node:assert/strict";
import test from "node:test";

// Join the Lab's rules (src/lib/interest.ts), which the form, the local
// route and the Worker all run.
const { checkInterest } = await import("../src/lib/interest.ts");

const student = { role: "student", name: "Ann Lee", email: "Ann@Mail.Weber.edu", major: "Economics", year: "Second year" };

test("a complete student form passes, with the email normalized", () => {
  const r = checkInterest(student);
  assert.ok("value" in r);
  assert.equal(r.value.email, "ann@mail.weber.edu");
});

test("students and faculty need a Weber State email; organizations do not", () => {
  assert.ok("errors" in checkInterest({ ...student, email: "ann@gmail.com" }));
  assert.ok("errors" in checkInterest({ role: "faculty", name: "B", email: "b@gmail.com", department: "Math" }));
  assert.ok("value" in checkInterest({ role: "organization", name: "C", email: "c@acme.com", organization: "Acme" }));
});

test("each role's required fields are required", () => {
  const r = checkInterest({ role: "organization", name: "C", email: "c@acme.com" });
  assert.deepEqual(Object.keys(r.errors), ["organization"]);
  assert.ok("errors" in checkInterest({ ...student, year: "" }));
  assert.ok("errors" in checkInterest({ ...student, year: "Fifth year" }));
});

test("unknown roles, other roles' fields and long values are refused or dropped", () => {
  assert.ok("errors" in checkInterest({ ...student, role: "admin" }));
  assert.ok("errors" in checkInterest(null));
  const r = checkInterest({ ...student, organization: "Acme", website: "spam" });
  assert.equal(r.value.organization, undefined);
  assert.equal(r.value.website, undefined);
  assert.ok("errors" in checkInterest({ ...student, note: "x".repeat(1501) }));
  assert.ok("errors" in checkInterest({ ...student, major: "x".repeat(121) }));
});
