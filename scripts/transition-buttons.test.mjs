import assert from "node:assert/strict";
import test from "node:test";
const { buttonsFor, errorText, allowedButtons } = await import("../src/components/projectum/transition-buttons.ts");

test("buttonsFor lists a role's transitions with labels in machine order", () => {
  const b = buttonsFor("project", "plan_review", ["rep"]);
  assert.deepEqual(b.map((x) => x.name), ["approvePlan", "returnPlan"]);
  assert.ok(b.every((x) => x.label));
});
test("buttonsFor is empty for a role with no move", () => {
  assert.deepEqual(buttonsFor("project", "plan_review", ["member"]), []);
});
test("exclude drops named transitions", () => {
  assert.deepEqual(buttonsFor("project", "plan_review", ["rep"], { exclude: ["returnPlan"] }).map((x) => x.name), ["approvePlan"]);
});
test("allowedButtons intersects the server's list with the machine", () => {
  const names = (a) => allowedButtons("project", "plan_review", ["rep"], a).map((x) => x.name);
  assert.deepEqual(names(["returnPlan", "nope"]), ["returnPlan"]);
  assert.deepEqual(names([]), []);
  assert.deepEqual(names(undefined), ["approvePlan", "returnPlan"]);
});
test("errorText maps codes", () => {
  assert.match(errorText("plan", ["title"]), /title/);
  assert.match(errorText("state"), /Reload/);
  assert.match(errorText("feedback"), /notes/);
  assert.equal(errorText("zzz"), "Something went wrong.");
});
