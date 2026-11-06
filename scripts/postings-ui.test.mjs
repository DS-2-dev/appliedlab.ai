import assert from "node:assert/strict";
import test from "node:test";

const { disciplineFacets, matchesDisciplines, postingSortKey, sortPostings, tagsFromText, latestReturnNotes } = await import(
  "../src/components/projectum/posting-helpers.ts"
);

const at = (d) => `2026-10-${String(d).padStart(2, "0")}T00:00:00.000Z`;
const posting = (id, extra = {}) => ({
  id,
  disciplines: [],
  createdAt: at(1),
  submittedAt: null,
  publishedAt: null,
  closedAt: null,
  reviews: [],
  ...extra,
});

test("disciplineFacets counts only disciplines present, most used first, then taxonomy order", () => {
  const list = [
    posting("a", { disciplines: ["design", "finance"] }),
    posting("b", { disciplines: ["finance", "finance"] }),
    posting("c", { disciplines: ["marketing"] }),
  ];
  assert.deepEqual(disciplineFacets(list, ["marketing", "design", "finance"]), [
    { slug: "finance", count: 2 },
    { slug: "marketing", count: 1 },
    { slug: "design", count: 1 },
  ]);
  assert.deepEqual(disciplineFacets([]), []);
  // Without an order, ties fall back to the slug.
  assert.deepEqual(disciplineFacets(list).map((f) => f.slug), ["finance", "design", "marketing"]);
});

test("matchesDisciplines shows everything with nothing picked, and any match otherwise", () => {
  const p = posting("a", { disciplines: ["design", "finance"] });
  assert.equal(matchesDisciplines(p, []), true);
  assert.equal(matchesDisciplines(p, ["finance", "marketing"]), true);
  assert.equal(matchesDisciplines(p, ["marketing"]), false);
});

test("postingSortKey is the latest move, reviews included", () => {
  assert.equal(postingSortKey(posting("a")), at(1));
  assert.equal(postingSortKey(posting("a", { submittedAt: at(3), publishedAt: at(5) })), at(5));
  assert.equal(postingSortKey(posting("a", { submittedAt: at(3), reviews: [{ openedAt: at(3), decidedAt: at(9) }] })), at(9));
  const sorted = sortPostings([posting("old"), posting("new", { closedAt: at(20) }), posting("mid", { submittedAt: at(10) })]);
  assert.deepEqual(sorted.map((p) => p.id), ["new", "mid", "old"]);
});

test("tagsFromText splits on commas and drops blanks", () => {
  assert.deepEqual(tagsFromText(" pricing, forecasting ,, "), ["pricing", "forecasting"]);
  assert.deepEqual(tagsFromText(""), []);
});

test("latestReturnNotes gives the newest decided round's notes only when it was a return", () => {
  const returned = { round: 1, status: "returned", feedback: "Say who uses it." };
  assert.equal(latestReturnNotes([returned]), "Say who uses it.");
  // Resubmitted: the open round 2 does not hide round 1's notes.
  assert.equal(latestReturnNotes([{ round: 2, status: "open", feedback: "" }, returned]), "Say who uses it.");
  assert.equal(latestReturnNotes([returned, { round: 2, status: "approved", feedback: "" }]), "");
  assert.equal(latestReturnNotes([]), "");
});
