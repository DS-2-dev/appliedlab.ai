import assert from "node:assert/strict";
import test from "node:test";

// Where a project opens, the notes it came back with, and the plan editor's draft.
const { isPlanning, projectHref, returnNotes, draftFrom, draftToPlan, planChanged } = await import(
  "../src/components/projectum/project-helpers.ts"
);
const { stepText, splitStep } = await import("../src/lib/projects.ts");

test("the plan is written while claimed or returned", () => {
  assert.equal(isPlanning("claimed"), true);
  assert.equal(isPlanning("plan_returned"), true);
  for (const s of ["plan_review", "active", "submission_returned", "withdrawn"]) assert.equal(isPlanning(s), false, s);
});

test("a project opens its board, or its own page without one", () => {
  assert.equal(projectHref({ id: "p 1", boardId: "b1" }), "/projectum?project=b1");
  assert.equal(projectHref({ id: "p 1", boardId: null }), "/projectum?view=project&id=p%201");
});

test("return notes come from the newest round at the gate the status names", () => {
  const reviews = [
    { gate: "action_plan", round: 1, status: "returned", feedback: "Add a finish date." },
    { gate: "action_plan", round: 2, status: "returned", feedback: "Say how milestone 2 is judged." },
    { gate: "submission", round: 1, status: "returned", feedback: "The report is missing." },
  ];
  assert.equal(returnNotes("plan_returned", reviews), "Say how milestone 2 is judged.");
  assert.equal(returnNotes("submission_returned", reviews), "The report is missing.");
  assert.equal(returnNotes("active", reviews), "");
  // An approval after a return means nothing to show.
  assert.equal(returnNotes("plan_returned", [...reviews, { gate: "action_plan", round: 3, status: "approved", feedback: "" }]), "");
});

test("the draft starts with a row to fill, and empty rows are dropped when sent", () => {
  assert.deepEqual(draftFrom({ approach: "", milestones: [], finishBy: "" }).milestones, [{ title: "", criterion: "" }]);
  const saved = { approach: "Model it", milestones: [{ title: "Data", criterion: "Cleaned" }], finishBy: "2026-12-01" };
  assert.deepEqual(draftFrom(saved), saved);
  const draft = { approach: " Model it ", milestones: [{ title: " Data ", criterion: "Cleaned " }, { title: "", criterion: " " }], finishBy: "2026-12-01" };
  assert.deepEqual(draftToPlan(draft), saved);
  assert.equal(planChanged(draft, saved), false);
  assert.equal(planChanged({ ...draft, finishBy: "" }, saved), true);
});

test("a milestone is a step's text as title then criterion, and splits back", () => {
  assert.equal(stepText("Clean the data", "Every row has a date"), "Clean the data. Every row has a date");
  assert.equal(stepText("  Clean   the data ", ""), "Clean the data");
  assert.deepEqual(splitStep("Clean the data. Every row has a date"), { title: "Clean the data", criterion: "Every row has a date" });
  assert.deepEqual(splitStep("Clean the data"), { title: "Clean the data", criterion: "" });
  // Only the first ". " splits, so a criterion may hold sentences of its own.
  assert.deepEqual(splitStep("Ship it. Live. Used daily"), { title: "Ship it", criterion: "Live. Used daily" });
  const m = { title: "Pilot", criterion: "Two stores use it" };
  assert.deepEqual(splitStep(stepText(m.title, m.criterion)), m);
});
