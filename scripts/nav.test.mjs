import assert from "node:assert/strict";
import test from "node:test";

// The sidebar's entries per role, and which view an address opens. nav.ts
// reads its labels from copy.ts, so this runs under scripts/test-loader.mjs.
const { navItems, pickView } = await import("../src/components/projectum/nav.ts");
const { copy } = await import("../src/content/copy.ts");

const N = copy.projectum.pipeline.nav;
const counts = { court: 3, reviews: 5, requests: 2 };
const me = (role, extra = {}) => ({ role, roles: [role], admin: false, ...extra });
const rows = (items) => items.map((i) => [i.view, i.label, i.href]);

test("a member gets the board, their projects and their court, with no All Projects", () => {
  assert.deepEqual(rows(navItems(me("member"), counts)), [
    ["board", N.board, "/projectum"],
    ["myprojects", N.myProjects, "/projectum?view=myprojects"],
    ["inbox", N.inbox, "/projectum?view=inbox"],
  ]);
  assert.equal(navItems(me("member"), counts).find((i) => i.view === "inbox").badge, 3);
});

test("a partner gets their postings, the organization and their court", () => {
  const items = navItems(me("partner"), counts);
  assert.deepEqual(rows(items), [
    ["postings", N.myPostings, "/projectum"],
    ["org", N.org, "/projectum?view=org"],
    ["inbox", N.inbox, "/projectum?view=inbox"],
  ]);
  assert.equal(items.find((i) => i.view === "org").badge, 2);
});

test("a rep gets the board, reviews, all projects and their court", () => {
  const items = navItems(me("rep"), counts);
  assert.deepEqual(rows(items), [
    ["board", N.board, "/projectum"],
    ["reviews", N.reviews, "/projectum?view=reviews"],
    ["projects", N.projects, "/projectum?view=projects"],
    ["inbox", N.inbox, "/projectum?view=inbox"],
  ]);
  assert.equal(items.find((i) => i.view === "reviews").badge, 5);
});

test("an admin gets all postings, reviews and the overview after their own role's entries", () => {
  const items = navItems(me("member", { admin: true, roles: ["member", "admin"] }), counts);
  assert.deepEqual(items.map((i) => i.view), ["board", "myprojects", "projects", "inbox", "postings", "reviews", "overview"]);
  const postings = items.find((i) => i.view === "postings");
  assert.deepEqual([postings.label, postings.href], [N.allPostings, "/projectum?view=postings"]);
  // A rep admin already has Reviews, so it is not added twice.
  assert.deepEqual(navItems(me("rep", { admin: true }), counts).map((i) => i.view), [
    "board", "reviews", "projects", "inbox", "postings", "overview",
  ]);
  // A partner admin already has their postings.
  assert.deepEqual(navItems(me("partner", { admin: true }), counts).map((i) => i.view), ["postings", "org", "inbox", "reviews", "overview"]);
  const overview = navItems(me("partner", { admin: true }), counts).at(-1);
  assert.deepEqual([overview.view, overview.label, overview.href], ["overview", N.overview, "/projectum?view=overview"]);
});

const ctx = (who, params = {}) => ({ id: null, posting: null, project: null, ...who, ...params });

test("each role lands on its own home", () => {
  assert.equal(pickView(null, ctx(me("member"))), "board");
  assert.equal(pickView(null, ctx(me("rep"))), "board");
  assert.equal(pickView(null, ctx(me("partner"))), "postings");
  assert.equal(pickView("board", ctx(me("partner"))), "postings");
  assert.equal(pickView("nonsense", ctx(me("member"))), "board");
});

test("a posting, a board and a project open from the address", () => {
  assert.equal(pickView(null, ctx(me("member"), { posting: "x" })), "posting");
  assert.equal(pickView("posting", ctx(me("partner"), { id: "x" })), "posting");
  assert.equal(pickView("posting", ctx(me("partner"))), "postings");
  assert.equal(pickView(null, ctx(me("member"), { project: "b1" })), "project");
  assert.equal(pickView(null, ctx(me("partner"), { project: "b1" })), "project");
  assert.equal(pickView("project", ctx(me("member"), { id: "p1" })), "project");
});

test("?posting= and ?project= win over a view the account may not open", () => {
  assert.equal(pickView("overview", ctx(me("member"), { posting: "x" })), "posting");
  assert.equal(pickView("reviews", ctx(me("partner"), { posting: "x" })), "posting");
  assert.equal(pickView("review", ctx(me("member"), { id: "r1", project: "b1" })), "project");
  assert.equal(pickView("myprojects", ctx(me("partner"), { project: "b1" })), "project");
});

test("reviews and the overview are for staff", () => {
  assert.equal(pickView("review", ctx(me("rep"), { id: "r1" })), "review");
  assert.equal(pickView("review", ctx(me("member", { admin: true }), { id: "r1" })), "review");
  assert.equal(pickView("review", ctx(me("member"), { id: "r1" })), "board");
  assert.equal(pickView("review", ctx(me("rep"))), "reviews");
  assert.equal(pickView("reviews", ctx(me("partner"))), "postings");
  assert.equal(pickView("queue", ctx(me("rep"))), "reviews");
  assert.equal(pickView("overview", ctx(me("rep"))), "board");
  assert.equal(pickView("overview", ctx(me("rep", { admin: true }))), "overview");
});

test("each role opens only its own views", () => {
  assert.equal(pickView("myprojects", ctx(me("member"))), "myprojects");
  assert.equal(pickView("myprojects", ctx(me("partner"))), "postings");
  assert.equal(pickView("projects", ctx(me("partner"))), "postings");
  assert.equal(pickView("projects", ctx(me("rep"))), "projects");
  assert.equal(pickView("projects", ctx(me("member"))), "board");
  assert.equal(pickView("projects", ctx(me("member", { admin: true, roles: ["member", "admin"] }))), "projects");
  assert.equal(pickView("org", ctx(me("partner"))), "org");
  assert.equal(pickView("org", ctx(me("member"))), "board");
  assert.equal(pickView("org", ctx(me("rep"), { id: "o1" })), "org");
  assert.equal(pickView("inbox", ctx(me("partner"))), "inbox");
  assert.equal(pickView("postings", ctx(me("member"))), "board");
  assert.equal(pickView("postings", ctx(me("rep"))), "board");
  assert.equal(pickView("postings", ctx(me("partner"))), "postings");
  assert.equal(pickView("postings", ctx(me("rep", { admin: true }))), "postings");
});
