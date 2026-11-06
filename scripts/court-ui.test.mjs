import assert from "node:assert/strict";
import test from "node:test";

const { courtStrip, notificationDot, STRIP_LIMIT } = await import("../src/components/projectum/court-helpers.ts");

const item = (id, urgency) => ({
  role: "member", kind: "project", id, title: id, subtitle: "", status: "claimed", urgency, since: "2026-10-01", href: "/",
});

test("the strip shows action items only, in order, up to the limit", () => {
  const items = [item("a", "action"), item("w", "work"), item("b", "action"), item("c", "action")];
  assert.deepEqual(courtStrip(items).shown.map((i) => i.id), ["a", "b", "c"]);
  assert.equal(courtStrip(items).more, 0);
  assert.deepEqual(courtStrip(items, 2).shown.map((i) => i.id), ["a", "b"]);
  assert.equal(courtStrip(items, 2).more, 1);
});

test("the strip holds five by default and counts the rest", () => {
  assert.equal(STRIP_LIMIT, 5);
  const many = Array.from({ length: 8 }, (_, i) => item(`i${i}`, "action"));
  const out = courtStrip(many);
  assert.equal(out.shown.length, 5);
  assert.equal(out.more, 3);
  assert.deepEqual(courtStrip([item("w", "work")]), { shown: [], more: 0 });
});

test("only an unread court notification wears the court dot", () => {
  assert.equal(notificationDot({ court: true, read: false }), "court");
  assert.equal(notificationDot({ court: false, read: false }), "unread");
  assert.equal(notificationDot({ court: true, read: true }), null);
  assert.equal(notificationDot({ court: false, read: true }), null);
});
