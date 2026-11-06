import assert from "node:assert/strict";
import test from "node:test";

// Which board an id opens, and whether it is edited, locked or only viewed.
const { findBoard, boardMode, canMoveStage } = await import("../src/components/projectum/board-mode.ts");

const entry = (id, extra = {}) => ({ project: id ? { id } : null, editable: false, onTeam: false, status: "active", ...extra });

test("an id finds its board among every visible entry, editable or not", () => {
  const list = [entry(null), entry("a", { editable: true }), entry("b")];
  assert.equal(findBoard(list, "b"), list[2]);
  assert.equal(findBoard(list, "a"), list[1]);
  assert.equal(findBoard(list, "c"), null);
});

test("the team edits, finds it locked at a gate, and everyone else views", () => {
  assert.equal(boardMode(entry("a", { editable: true, onTeam: true })), "edit");
  for (const status of ["plan_review", "submission_review", "delivered", "completion_review"]) {
    assert.equal(boardMode(entry("a", { onTeam: true, status })), "locked", status);
  }
  assert.equal(boardMode(entry("a", { onTeam: false, status: "plan_review" })), "view");
  assert.equal(boardMode(entry("a", { onTeam: false, status: "delivered" })), "view");
  assert.equal(boardMode(entry("a", { onTeam: true, status: "complete" })), "view");
  assert.equal(boardMode(entry("a", { onTeam: false, status: null })), "view");
});

test("a colleague's entry, with only the brief, is found by its board id", () => {
  const colleague = { project: null, brief: { id: "c" }, editable: false, onTeam: false, status: "active" };
  const list = [entry("a"), colleague];
  assert.equal(findBoard(list, "c"), colleague);
  assert.equal(findBoard(list, "a"), list[0]);
});

test("stage moves open on a board of one's own and while the team works the approved plan", () => {
  assert.equal(canMoveStage(null), true);
  assert.equal(canMoveStage("active"), true);
  assert.equal(canMoveStage("submission_returned"), true);
  for (const status of ["claimed", "plan_review", "plan_returned", "submission_review", "delivered", "integrated", "completion_review", "complete", "withdrawn"]) {
    assert.equal(canMoveStage(status), false, status);
  }
});
