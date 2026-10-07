import assert from "node:assert/strict";
import test from "node:test";

// The pipeline's rules, shared by the forms and the Worker.
const { cleanProblem, problemIssues, cleanClaim, claimIssues, cleanDate, cleanPhaseMilestones, LIMITS } = await import(
  "../src/lib/problems.ts"
);

test("dates must be real calendar days", () => {
  assert.equal(cleanDate("2026-11-14"), "2026-11-14");
  assert.equal(cleanDate("2026-02-30"), "");
  assert.equal(cleanDate("11/14/2026"), "");
  assert.equal(cleanDate(undefined), "");
});

test("a problem is cleaned and checked", () => {
  const p = cleanProblem({
    title: "  Snow   removal pricing ",
    summary: "An annual price model",
    details: "a\r\n\r\n\r\n\r\nb",
    fields: ["finance", "finance", "nope", 3],
    deliverable: "",
    deadline: "2026-13-01",
  });
  assert.equal(p.title, "Snow removal pricing");
  assert.deepEqual(p.fields, ["finance"]);
  assert.equal(p.details, "a\n\nb");
  assert.equal(p.deadline, "");
  assert.deepEqual(problemIssues(p), []);
  assert.deepEqual(problemIssues(cleanProblem({})), ["title", "summary", "fields"]);
  assert.equal(cleanProblem({ title: "x".repeat(500) }).title.length, LIMITS.title);
  assert.deepEqual(cleanProblem(null).fields, []);
});

test("an action plan needs an approach and complete milestones", () => {
  const c = cleanClaim({
    approach: "Regression on five years of costs",
    milestones: [{ title: "Clean data", criterion: "No gaps" }, { title: "", criterion: "" }, "junk"],
    finishBy: "2026-11-14",
    teammates: ["a1", "a1", "bad id!", 7],
  });
  assert.equal(c.milestones.length, 1);
  assert.deepEqual(c.teammates, ["a1"]);
  assert.deepEqual(claimIssues(c), []);
  assert.deepEqual(claimIssues(cleanClaim({ approach: "x" })), ["milestones"]);
  assert.deepEqual(claimIssues(cleanClaim({ approach: "x", milestones: [{ title: "t" }] })), ["milestone"]);
  assert.deepEqual(claimIssues(cleanClaim({})), ["approach", "milestones"]);
  const many = cleanClaim({ milestones: Array.from({ length: 20 }, (_, i) => ({ title: `m${i}`, criterion: "c" })) });
  assert.equal(many.milestones.length, LIMITS.milestones);
});

test("phase 2 milestones keep a title and a done flag", () => {
  assert.deepEqual(cleanPhaseMilestones([{ title: " Go live ", done: true }, { title: "", done: true }, { title: "Train staff", done: "yes" }, 5]), [
    { title: "Go live", done: true },
    { title: "Train staff", done: false },
  ]);
  assert.deepEqual(cleanPhaseMilestones(null), []);
  assert.equal(cleanPhaseMilestones(Array.from({ length: 30 }, (_, i) => ({ title: `m${i}` }))).length, LIMITS.phaseMilestones);
});
