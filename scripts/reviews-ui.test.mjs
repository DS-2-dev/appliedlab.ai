import assert from "node:assert/strict";
import test from "node:test";

const { GATE_MOVES, decisionLabel, decisionMode, gateLabel, isTyping, planSnapshot, postingSnapshot, queueKey, queueRows, reportSnapshot } =
  await import("../src/components/projectum/review-helpers.ts");
const { MACHINES } = await import("../src/lib/pipeline/machines.ts");

const entry = (id, extra = {}) => ({
  id,
  gate: "posting",
  title: `Title ${id}`,
  who: "Acme",
  waitingSince: "2026-10-01T00:00:00.000Z",
  assignedTo: null,
  ...extra,
});

test("gateLabel names each gate", () => {
  assert.equal(gateLabel("posting"), "Posting");
  assert.equal(gateLabel("action_plan"), "Action plan");
  assert.equal(gateLabel("submission"), "Submission");
});

test("each gate's two moves exist in its machine and leave the gate's review status", () => {
  const reviewStatus = { posting: "in_review", action_plan: "plan_review", submission: "submission_review" };
  for (const [gate, { kind, moves }] of Object.entries(GATE_MOVES)) {
    assert.equal(moves.length, 2);
    for (const m of moves) {
      const t = MACHINES[kind].transitions[m];
      assert.ok(t, `${kind}.${m}`);
      assert.ok(t.from.includes(reviewStatus[gate]), `${kind}.${m} from ${reviewStatus[gate]}`);
      assert.ok(t.by.includes("rep"));
    }
  }
  assert.deepEqual(GATE_MOVES.action_plan.moves, ["approvePlan", "returnPlan"]);
});

test("decisionLabel: an approved posting is published, an approved plan approved", () => {
  assert.equal(decisionLabel("posting", "approved"), "Published");
  assert.equal(decisionLabel("action_plan", "approved"), "Approved");
  assert.equal(decisionLabel("submission", "returned"), "Returned with notes");
});

test("queueRows keeps the order and builds labels, assignee and Take", () => {
  const rows = queueRows(
    [
      entry("a"),
      entry("b", { gate: "action_plan", assignedTo: { id: "me", name: "Me" } }),
      entry("c", { gate: "submission", assignedTo: { id: "x", name: "Rae" } }),
      entry("sub:s1", { gate: "submission" }),
    ],
    "me",
  );
  assert.deepEqual(
    rows.map((r) => [r.id, r.gate, r.assignee, r.canTake]),
    [
      ["a", "Posting", "Nobody yet", true],
      ["b", "Action plan", "You", false],
      ["c", "Submission", "Rae", false],
      ["sub:s1", "Submission", "Nobody yet", false],
    ],
  );
  assert.equal(rows[0].href, "/projectum?view=review&id=a");
  assert.equal(rows[3].href, "/projectum?view=review&id=sub%3As1");
  assert.equal(rows[0].title, "Title a");
  assert.equal(rows[0].who, "Acme");
});

test("queueKey: j and k move within the list, Enter opens the selected row", () => {
  assert.deepEqual(queueKey("j", -1, 3), { move: 0 });
  assert.deepEqual(queueKey("j", 1, 3), { move: 2 });
  assert.deepEqual(queueKey("j", 2, 3), { move: 2 });
  assert.deepEqual(queueKey("k", 2, 3), { move: 1 });
  assert.deepEqual(queueKey("k", 0, 3), { move: 0 });
  assert.deepEqual(queueKey("k", -1, 3), { move: 0 });
  assert.deepEqual(queueKey("Enter", 1, 3), { open: 1 });
  assert.equal(queueKey("Enter", -1, 3), null);
  assert.equal(queueKey("x", 0, 3), null);
  assert.equal(queueKey("j", -1, 0), null);
});

test("isTyping: inputs, textareas, selects and editable content keep their keys", () => {
  assert.equal(isTyping({ tagName: "INPUT" }), true);
  assert.equal(isTyping({ tagName: "TEXTAREA" }), true);
  assert.equal(isTyping({ tagName: "SELECT" }), true);
  assert.equal(isTyping({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTyping({ tagName: "BODY" }), false);
  assert.equal(isTyping(null), false);
});

test("snapshots read what was sent and tolerate junk", () => {
  const p = postingSnapshot({ title: "Snow pricing", summary: "S", disciplines: ["finance", 3], tags: ["Price Model"], effort: "small" });
  assert.equal(p.title, "Snow pricing");
  assert.deepEqual(p.disciplines, ["finance"]);
  assert.deepEqual(p.tags, ["price-model"]);
  assert.equal(p.effort, "small");
  assert.deepEqual(postingSnapshot(null).disciplines, []);
  const plan = planSnapshot({ approach: "A", milestones: [{ title: "T", criterion: "C" }, {}], finishBy: "2026-12-01" });
  assert.deepEqual(plan, { approach: "A", milestones: [{ title: "T", criterion: "C" }], finishBy: "2026-12-01" });
  assert.deepEqual(reportSnapshot({ reportName: "r.pdf", reportSize: 9, createdAt: "x" }), { reportName: "r.pdf", reportSize: 9, createdAt: "x" });
  assert.deepEqual(reportSnapshot("junk"), { reportName: "", reportSize: 0, createdAt: "" });
});

test("decisionMode: closed rounds, own work and everyone else", () => {
  const me = { id: "me", orgId: "org1" };
  const team = [{ id: "me", name: "Me" }];
  assert.equal(decisionMode({ reviewStatus: "approved", gate: "action_plan", me, subject: { team: [] } }), "closed");
  assert.equal(decisionMode({ reviewStatus: "open", gate: "completion", me, subject: {} }), "closed");
  assert.equal(decisionMode({ reviewStatus: "open", gate: "action_plan", me, subject: { team } }), "own");
  assert.equal(decisionMode({ reviewStatus: "open", gate: "submission", me, subject: { team } }), "own");
  assert.equal(decisionMode({ reviewStatus: "open", gate: "action_plan", me, subject: { team: [{ id: "x", name: "X" }] } }), "decide");
  assert.equal(decisionMode({ reviewStatus: "open", gate: "posting", me, subject: { orgId: "org1", author: { id: "y", name: "Y" } } }), "own");
  assert.equal(decisionMode({ reviewStatus: "open", gate: "posting", me, subject: { orgId: null, author: { id: "me", name: "Me" } } }), "own");
  assert.equal(decisionMode({ reviewStatus: "open", gate: "posting", me: { id: "me", orgId: null }, subject: { orgId: null, author: { id: "y", name: "Y" } } }), "decide");
});
