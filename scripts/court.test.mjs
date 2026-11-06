import assert from "node:assert/strict";
import test from "node:test";
const { courtSort } = await import("../src/lib/pipeline/court.ts");

const item = (id, urgency, since) => ({
  role: "member", kind: "project", id, title: id, subtitle: "", status: "x", urgency, since, href: "/",
});

test("action comes before work, then oldest first", () => {
  const out = courtSort([
    item("w-old", "work", "2026-01-01"),
    item("a-new", "action", "2026-03-01"),
    item("a-old", "action", "2026-02-01"),
    item("w-new", "work", "2026-02-01"),
  ]);
  assert.deepEqual(out.map((i) => i.id), ["a-old", "a-new", "w-old", "w-new"]);
});
test("equal keys keep their order and the input is not changed", () => {
  const input = [item("a", "action", "2026-01-01"), item("b", "action", "2026-01-01")];
  assert.deepEqual(courtSort(input).map((i) => i.id), ["a", "b"]);
  assert.deepEqual(input.map((i) => i.id), ["a", "b"]);
  assert.deepEqual(courtSort([]), []);
});
