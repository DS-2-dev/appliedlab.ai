import assert from "node:assert/strict";
import test from "node:test";

const { disciplineFacets, matchesDisciplines, postingSortKey, sortPostings, tagsFromText, latestReturnNotes, disciplineNames, emptyTeamsNote } = await import(
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

const { cleanPosting, postingIssues, isHttpsUrl } = await import("../src/lib/problems.ts");

test("a posting's Drive link must be empty or https", () => {
  const issues = (driveUrl) => postingIssues(cleanPosting({ title: "Snow", driveUrl }, []), { forSubmit: false });
  assert.deepEqual(issues(""), []);
  assert.deepEqual(issues("https://drive.google.com/drive/folders/abc"), []);
  for (const bad of ["javascript:alert(1)", "http://example.com", "data:text/html,hi", "example.com", "https://"]) {
    assert.deepEqual(issues(bad), ["driveUrl"], bad);
  }
  assert.equal(isHttpsUrl("https://a b.com"), false);
});

test("cleanPosting keeps the detail fields and defaults them to empty", () => {
  assert.equal(cleanPosting({}, []).why, "");
  assert.equal(cleanPosting({ keyMilestones: " one\r\ntwo " }, []).keyMilestones, "one\ntwo");
  assert.equal(cleanPosting({ goal: "x".repeat(2500) }, []).goal.length, 2000);
});

test("disciplineNames names an archived discipline too, and ignores archived tags", () => {
  const names = disciplineNames({
    disciplines: [{ slug: "finance", name: "Finance" }],
    retired: [
      { slug: "design", name: "Design", kind: "discipline" },
      { slug: "pricing", name: "Pricing", kind: "tag" },
    ],
  });
  assert.equal(names.get("finance"), "Finance");
  assert.equal(names.get("design"), "Design");
  assert.equal(names.has("pricing"), false);
  assert.equal(disciplineNames(undefined).size, 0);
});

test("emptyTeamsNote says the teams are private when the posting has some the viewer cannot see", () => {
  assert.equal(emptyTeamsNote(false, { open: 0, delivered: 0 }), "none");
  assert.equal(emptyTeamsNote(false, { open: 2, delivered: 0 }), "private");
  assert.equal(emptyTeamsNote(false, { open: 0, delivered: 1 }), "private");
  assert.equal(emptyTeamsNote(true, { open: 0, delivered: 0 }), "partner");
  assert.equal(emptyTeamsNote(true, { open: 3, delivered: 0 }), "partner");
});
