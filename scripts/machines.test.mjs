import assert from "node:assert/strict";
import test from "node:test";
const { MACHINES, stateOf, transitionsFrom, projectStage, boardStageFor, PROJECT_FLOW } = await import("../src/lib/pipeline/machines.ts");
const { HANDOFF } = await import("../src/lib/pipeline/handoffs.ts");

test("every state has a label, tone, court and hint", () => {
  for (const m of Object.values(MACHINES)) for (const [k, s] of Object.entries(m.states)) {
    assert.ok(s.label && s.tone && s.court && s.hint, k);
  }
});
test("every transition that hands off has hand-off copy", () => {
  for (const [kind, m] of Object.entries(MACHINES)) for (const [name, t] of Object.entries(m.transitions)) {
    if (t.handsTo) assert.equal(typeof HANDOFF[`${kind}.${name}`], "function", `${kind}.${name}`);
  }
});
test("transitions are offered by role", () => {
  assert.deepEqual(transitionsFrom("project", "plan_review", ["member"]).map((t) => t.name), []);
  assert.deepEqual(transitionsFrom("project", "plan_review", ["rep"]).map((t) => t.name).sort(), ["approvePlan", "returnPlan"]);
  // Admins may also withdraw (and submit): a Lab posting has no partner to do it.
  assert.deepEqual(transitionsFrom("posting", "in_review", ["member", "admin"]).map((t) => t.name).sort(), ["approve", "return", "withdraw"]);
  assert.deepEqual(transitionsFrom("posting", "draft", ["admin"]).map((t) => t.name).sort(), ["archive", "submit"]);
});
test("stage folding and board stage", () => {
  assert.equal(projectStage("plan_returned"), "plan_review");
  assert.equal(PROJECT_FLOW.length, 7);
  assert.equal(boardStageFor("claimed"), "solidifying");
  assert.equal(boardStageFor("active"), null);
  assert.equal(boardStageFor("submission_returned"), "prototype");
  assert.equal(boardStageFor("delivered"), "live");
});
test("unknown status is harmless", () => {
  assert.equal(stateOf("project", "nope").court, "none");
});

test("the stage bar marks the current stage, and none for a status off the flow", async () => {
  const { stageBarState } = await import("../src/lib/pipeline/machines.ts");
  assert.deepEqual(stageBarState("plan_returned"), { flow: PROJECT_FLOW, current: 1, returned: true });
  assert.equal(stageBarState("completion_review").current, PROJECT_FLOW.indexOf("integrated"));
  assert.equal(stageBarState("complete").current, PROJECT_FLOW.length - 1);
  for (const status of ["withdrawn", "made_up"]) {
    const s = stageBarState(status);
    assert.equal(s.current, null, status);
    assert.equal(s.returned, false, status);
  }
  // A self-directed project skips delivered and integrated.
  const self = stageBarState("complete", true);
  assert.deepEqual(self.flow, PROJECT_FLOW.filter((s) => s !== "delivered" && s !== "integrated"));
  assert.equal(self.current, self.flow.length - 1);
  assert.equal(stageBarState("withdrawn", true).current, null);
  assert.equal(stageBarState("delivered", true).current, self.flow.length - 1);
});
