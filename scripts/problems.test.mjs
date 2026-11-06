import assert from "node:assert/strict";
import test from "node:test";

// The pipeline's rules, shared by the forms and the Worker.
const {
  cleanProblem, problemIssues, cleanClaim, claimIssues, cleanDate, cleanPhaseMilestones, cleanPosting, postingIssues, cleanPlan, planIssues, cleanTeammates,
  EFFORTS, LIMITS,
} = await import(
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

test("a posting is cleaned against the live disciplines", () => {
  const p = cleanPosting(
    {
      title: "  Snow   removal pricing ",
      summary: "An annual price model for snow removal",
      details: "a\r\n\r\n\r\n\r\nb",
      disciplines: ["finance", "astrology", "finance", 4],
      tags: ["Pricing Models", "pricing-models", "", "  Forecasting! ", "x".repeat(60), ...Array.from({ length: 12 }, (_, i) => `t${i}`)],
      effort: "medium",
      deliverable: "A spreadsheet",
      deadline: "2026-02-30",
    },
    ["finance", "design"],
  );
  assert.equal(p.title, "Snow removal pricing");
  assert.equal(p.details, "a\n\nb");
  assert.deepEqual(p.disciplines, ["finance"]);
  assert.equal(p.tags.length, 10);
  assert.deepEqual(p.tags.slice(0, 3), ["pricing-models", "forecasting", "x".repeat(40)]);
  assert.ok(p.tags.every((t) => t.length <= 40 && t === t.toLowerCase()));
  assert.equal(p.effort, "medium");
  assert.equal(p.deadline, "");
  assert.equal(cleanPosting({ effort: "huge" }, []).effort, "");
  assert.deepEqual(EFFORTS, ["small", "medium", "large", "multi"]);
  assert.equal(LIMITS.feedback, 2000);
});

test("a draft needs a title; sending needs a title, a summary and a discipline", () => {
  const empty = cleanPosting({}, ["finance"]);
  assert.deepEqual(postingIssues(empty, { forSubmit: false }), ["title"]);
  const short = cleanPosting({ title: "Snow", summary: "Too short" }, ["finance"]);
  assert.deepEqual(postingIssues(short, { forSubmit: false }), []);
  assert.deepEqual(postingIssues(short, { forSubmit: true }), ["summary", "disciplines"]);
  assert.deepEqual(postingIssues(cleanPosting({ title: "Sno" }, []), { forSubmit: true }), ["title", "summary", "disciplines"]);
  const ready = cleanPosting({ title: "Snow", summary: "An annual price model, please", disciplines: ["finance"] }, ["finance"]);
  assert.deepEqual(postingIssues(ready, { forSubmit: true }), []);
});

test("a plan is an approach, milestones and a finish date, checked like a claim", () => {
  const p = cleanPlan({
    approach: "  Regression on   costs ",
    milestones: [{ title: "Clean data", criterion: "No gaps" }, { title: "", criterion: "" }, "junk"],
    finishBy: "2026-11-14",
    teammates: ["a1"],
  });
  assert.deepEqual(p, { approach: "Regression on costs", milestones: [{ title: "Clean data", criterion: "No gaps" }], finishBy: "2026-11-14" });
  assert.deepEqual(planIssues(p), []);
  assert.deepEqual(cleanPlan(null), { approach: "", milestones: [], finishBy: "" });
  assert.deepEqual(planIssues(cleanPlan({})), ["approach", "milestones"]);
  assert.deepEqual(planIssues(cleanPlan({ approach: "x", milestones: [{ title: "t" }] })), ["milestone"]);
  assert.equal(cleanPlan({ milestones: Array.from({ length: 20 }, (_, i) => ({ title: `m${i}`, criterion: "c" })) }).milestones.length, LIMITS.milestones);
});

test("teammates are up to six distinct account ids", () => {
  assert.deepEqual(cleanTeammates(["a1", "a1", "bad id!", 7, "b-2"]), ["a1", "b-2"]);
  assert.deepEqual(cleanTeammates("a1"), []);
  assert.equal(cleanTeammates(Array.from({ length: 10 }, (_, i) => `u${i}`)).length, 6);
});
