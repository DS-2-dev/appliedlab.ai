import assert from "node:assert/strict";
import test from "node:test";
const { HANDOFF, NEXT_STEPS } = await import("../src/lib/pipeline/handoffs.ts");
const ctx = { partner: "Kestrel", member: "Maya", posting: "Snow pricing" };
test("hand-off copy has a title, ordered steps and a confirm label", () => {
  for (const [k, f] of Object.entries(HANDOFF)) {
    const c = f(ctx);
    assert.ok(c.title && c.confirm && c.steps.length >= 1, k);
    assert.ok(!/—/.test(JSON.stringify(c)), `${k} has an em dash`);
  }
});
test("next steps exist for every member-court and partner-court project status", () => {
  for (const s of ["claimed", "plan_returned", "active", "submission_returned", "integrated"]) assert.ok(NEXT_STEPS[`project.${s}.member`], s);
  for (const s of ["delivered", "completion_review"]) assert.ok(NEXT_STEPS[`project.${s}.partner`], s);
  for (const s of ["draft", "returned", "in_review", "live"]) assert.ok(NEXT_STEPS[`posting.${s}.partner`], s);
});
