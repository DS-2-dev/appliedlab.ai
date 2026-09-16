import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_BUILDS,
  MAX_PEOPLE,
  ROLE_IDS,
  addProject,
  buildProblems,
  currentBuild,
  editLaunch,
  isWebUrl,
  liveProblems,
  liveProject,
  normalizeUrl,
  startBuild,
  techStackItems,
  urlLabel,
  cleanDescription,
  editDetails,
  editPlan,
  editPrototype,
  githubRepo,
  isGithubUrl,
  isNotesUrl,
  prototypeProblems,
  prototypeProject,
  cleanName,
  cleanProjects,
  isThumbnail,
  projectProblem,
  removeProject,
  recolorProject,
  renameProject,
  sampleProject,
  solidifyProblems,
  solidifyProject,
} from "../src/lib/projects.ts";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const DOC = "https://docs.google.com/document/d/abc123/edit";
const p = (id, name, extra = {}) => ({
  id,
  name,
  description: "",
  thumbnail: PNG,
  notesUrl: DOC,
  color: null,
  people: [],
  stage: "brainstorming",
  plan: null,
  prototype: null,
  builds: [],
  history: {},
  launch: null,
  roleMeanings: {},
  ...extra,
});
const GH = "https://github.com/your-team/study-room-finder";
const meanings = Object.fromEntries(ROLE_IDS.map((id) => [id, `Meaning of ${id}`]));
const fullDraft = () => ({
  thesis: "The whole idea.",
  reasoning: "Why it is worth doing now.",
  techStack: "Next.js, Postgres",
  steps: [{ id: "s1", text: "Build the map", ownerId: "a" }],
  people: [{ id: "a", name: "Avery", role: "manager" }],
  meanings: { ...meanings },
});

test("projects add, rename and remove in a flat list", () => {
  let list = addProject([], p("a", "Alpha"));
  list = addProject(list, p("b", "Beta"));
  assert.deepEqual(list.map((x) => x.name), ["Alpha", "Beta"]);
  assert.equal(renameProject(list, "b", "Gamma")[1].name, "Gamma");
  assert.deepEqual(removeProject(list, "a").map((x) => x.id), ["b"]);
});

test("a new project needs a name, a thumbnail and a notes doc", () => {
  assert.equal(projectProblem({ name: "  ", thumbnail: PNG, notesUrl: DOC }), "name");
  assert.equal(projectProblem({ name: "Alpha", thumbnail: null, notesUrl: DOC }), "thumbnail");
  assert.equal(projectProblem({ name: "Alpha", thumbnail: "https://example.com/a.png", notesUrl: DOC }), "thumbnail");
  assert.equal(projectProblem({ name: "Alpha", thumbnail: PNG, notesUrl: "" }), "notes");
  assert.equal(projectProblem({ name: "Alpha", thumbnail: PNG, notesUrl: "https://example.com/notes" }), "notes");
  assert.equal(projectProblem({ name: "Alpha", thumbnail: PNG, notesUrl: DOC }), null);
});

test("notes docs are Google Docs over https", () => {
  assert.ok(isNotesUrl(DOC));
  assert.ok(isNotesUrl("docs.google.com/document/d/abc123"));
  assert.ok(isNotesUrl("https://docs.google.com/document/u/0/d/abc123/edit"));
  assert.ok(!isNotesUrl("https://docs.google.com/spreadsheets/d/abc123"));
  assert.ok(!isNotesUrl("http://docs.google.com/document/d/abc123"));
  assert.ok(!isNotesUrl("https://docs.google.com.evil.example/document/d/abc123"));
  assert.ok(!isNotesUrl("https://example.com/document/d/abc123"));
  assert.ok(!isNotesUrl("javascript:alert(1)"));
  assert.ok(!isNotesUrl(""));
  const bad = cleanProjects([solidifyProject(p("a", "Alpha"), fullDraft(), meanings)].map((x) => ({ ...x, notesUrl: "javascript:alert(1)" })))[0];
  assert.equal(bad.notesUrl, "", "a bad link loads as none");
  assert.equal(bad.stage, "solidifying", "and the stage stays");
  assert.equal(cleanProjects([p("a", "Alpha", { notesUrl: "docs.google.com/document/d/abc123" })])[0].notesUrl, "https://docs.google.com/document/d/abc123");
  const saved = editDetails(p("a", "Alpha", { notesUrl: "" }), { name: "Alpha", description: "", thumbnail: PNG, notesUrl: " docs.google.com/document/d/xyz ", people: [] });
  assert.equal(saved.notesUrl, "https://docs.google.com/document/d/xyz");
});

test("a folder takes one of four colour presets, or none", () => {
  const list = [p("a", "Alpha"), p("b", "Beta")];
  const green = recolorProject(list, "a", "green");
  assert.equal(green[0].color, "green");
  assert.equal(green[1].color, null, "only that project changes");
  assert.equal(recolorProject(green, "a", null)[0].color, null, "back to the grey");
  assert.equal(cleanProjects([p("a", "Alpha", { color: "amber" })])[0].color, "amber");
  assert.equal(cleanProjects([p("a", "Alpha", { color: "purple" })])[0].color, null, "no preset outside the four");
  assert.equal(cleanProjects([p("a", "Alpha", { color: undefined })])[0].color, null, "older saves have none");
});

test("thumbnails must be inline images", () => {
  assert.ok(isThumbnail(PNG));
  assert.ok(isThumbnail("data:image/svg+xml;utf8,%3Csvg%3E"));
  assert.ok(!isThumbnail("javascript:alert(1)"));
  assert.ok(!isThumbnail("data:text/html,<script>"));
  assert.ok(!isThumbnail("https://example.com/a.png"));
  assert.ok(!isThumbnail("data:image/png;base64," + "A".repeat(500_000)));
});

test("solidifying needs every field filled", () => {
  assert.deepEqual(solidifyProblems(fullDraft()), []);
  const empty = {
    thesis: " ",
    reasoning: "",
    techStack: "",
    steps: [],
    people: [],
    meanings: { ...meanings, qa: "  " },
  };
  assert.deepEqual(solidifyProblems(empty), ["thesis", "reasoning", "techStack", "steps", "people", "meaning:qa"]);
  const d = fullDraft();
  d.steps.push({ id: "s2", text: "", ownerId: "gone" });
  d.people.push({ id: "b", name: "Blake", role: null });
  assert.deepEqual(solidifyProblems(d), ["step-text:s2", "step-owner:s2", "role:b"]);
});

test("solidifyProject moves only a complete brainstorming project", () => {
  const project = p("a", "Alpha");
  const moved = solidifyProject(project, fullDraft(), meanings);
  assert.equal(moved.stage, "solidifying");
  assert.equal(moved.plan.steps[0].ownerId, "a");
  assert.equal(moved.people[0].role, "manager");
  assert.deepEqual(moved.roleMeanings, {}, "unchanged meanings are not stored");
  const edited = fullDraft();
  edited.meanings.uiux = "Owns the look.";
  assert.deepEqual(solidifyProject(project, edited, meanings).roleMeanings, { uiux: "Owns the look." });
  assert.equal(solidifyProject(project, { ...fullDraft(), techStack: "" }, meanings), null);
  assert.equal(solidifyProject(moved, fullDraft(), meanings), null, "already solidifying");
});

test("editPlan saves a complete plan without changing the stage", () => {
  const moved = solidifyProject(p("a", "Alpha"), fullDraft(), meanings);
  const edited = editPlan(moved, { ...fullDraft(), techStack: "Next.js, Redis" }, meanings);
  assert.equal(edited.stage, "solidifying");
  assert.equal(edited.plan.techStack, "Next.js, Redis");
  assert.equal(editPlan(moved, { ...fullDraft(), reasoning: "" }, meanings), null, "still all required");
  assert.equal(editPlan(p("b", "Beta"), fullDraft(), meanings), null, "brainstorming has no plan to edit");
});

test("editDetails needs a name, thumbnail and notes doc, and leaves solidified people alone", () => {
  const people = [{ id: "z", name: "Zed", role: null }];
  const brainstorm = editDetails(p("a", "Alpha"), { name: " Alpha 2 ", description: "New.", thumbnail: PNG, notesUrl: DOC, people });
  assert.equal(brainstorm.name, "Alpha 2");
  assert.deepEqual(brainstorm.people, people);
  assert.equal(editDetails(p("a", "Alpha"), { name: "", description: "", thumbnail: PNG, notesUrl: DOC, people }), null);
  assert.equal(editDetails(p("a", "Alpha"), { name: "A", description: "", thumbnail: null, notesUrl: DOC, people }), null);
  assert.equal(editDetails(p("a", "Alpha"), { name: "A", description: "", thumbnail: PNG, notesUrl: "", people }), null);
  const moved = solidifyProject(p("a", "Alpha"), fullDraft(), meanings);
  const renamed = editDetails(moved, { name: "Renamed", description: "", thumbnail: PNG, notesUrl: DOC, people: [] });
  assert.equal(renamed.name, "Renamed");
  assert.deepEqual(renamed.people, moved.people, "people stay with the plan");
  assert.equal(renamed.stage, "solidifying");
});

test("GitHub links must be https github.com repositories", () => {
  assert.ok(isGithubUrl(GH));
  assert.ok(isGithubUrl(" https://www.github.com/a/b/tree/main "));
  assert.ok(!isGithubUrl("https://github.com/only-owner"));
  assert.ok(!isGithubUrl("http://github.com/a/b"));
  assert.ok(!isGithubUrl("https://gitlab.com/a/b"));
  assert.ok(!isGithubUrl("https://github.com.evil.example/a/b"));
  assert.ok(!isGithubUrl("https://user:pw@github.com/a/b"));
  assert.ok(!isGithubUrl("javascript:alert(1)//github.com/a/b"));
  assert.ok(!isGithubUrl(""));
  assert.equal(githubRepo(GH), "your-team/study-room-finder");
});

test("moving to Prototype needs the whole plan, a GitHub link and a Supabase answer", () => {
  const solid = solidifyProject(p("a", "Alpha"), fullDraft(), meanings);
  const draft = { ...fullDraft(), githubUrl: GH, supabase: false };
  assert.deepEqual(prototypeProblems(draft), []);
  assert.deepEqual(prototypeProblems({ ...draft, githubUrl: "nope", supabase: null }), ["githubUrl", "supabase"]);
  assert.deepEqual(prototypeProblems({ ...draft, thesis: "" }), ["thesis"]);
  const moved = prototypeProject(solid, { ...draft, techStack: "Next.js, Supabase" }, meanings);
  assert.equal(moved.stage, "prototype");
  assert.deepEqual(moved.prototype, { githubUrl: GH, supabase: false });
  assert.equal(moved.plan.techStack, "Next.js, Supabase", "plan edits made on the way are kept");
  assert.equal(prototypeProject(p("b", "Beta"), draft, meanings), null, "brainstorming skips no stage");
  assert.equal(prototypeProject(solid, { ...draft, supabase: null }, meanings), null);
  const edited = editPrototype(moved, { ...draft, supabase: true }, meanings);
  assert.equal(edited.stage, "prototype");
  assert.equal(edited.prototype.supabase, true);
  assert.equal(editPrototype(solid, draft, meanings), null, "solidifying has no prototype to edit");
});

test("a project in Prototype without its prototype data goes back to Solidifying", () => {
  const solid = solidifyProject(p("a", "Alpha"), fullDraft(), meanings);
  const moved = prototypeProject(solid, { ...fullDraft(), githubUrl: GH, supabase: true }, meanings);
  assert.equal(cleanProjects([moved])[0].stage, "prototype");
  assert.equal(cleanProjects([{ ...moved, prototype: null }])[0].stage, "solidifying");
  assert.equal(cleanProjects([{ ...moved, prototype: { githubUrl: "https://evil.example/a/b", supabase: true } }])[0].stage, "solidifying");
  assert.equal(cleanProjects([{ ...moved, prototype: { githubUrl: GH, supabase: "yes" } }])[0].stage, "solidifying");
  assert.equal(cleanProjects([{ ...moved, plan: null }])[0].stage, "brainstorming");
});

test("Prototype starts at build 1 and each build logs what changed", () => {
  const solid = solidifyProject(p("a", "Alpha"), fullDraft(), meanings);
  const moved = prototypeProject(solid, { ...fullDraft(), githubUrl: GH, supabase: true }, meanings, "2026-09-01T10:00:00.000Z");
  assert.deepEqual(moved.builds, [{ number: 1, note: "", techStack: "Next.js, Postgres", at: "2026-09-01T10:00:00.000Z" }]);
  assert.equal(currentBuild(moved), 1);
  assert.deepEqual(buildProblems({ note: " ", techStack: "" }), ["note", "techStack"]);
  assert.equal(startBuild(moved, { note: "", techStack: "Next.js" }), null, "what changed is required");
  assert.equal(startBuild(solid, { note: "x", techStack: "y" }), null, "no builds before Prototype");
  const b2 = startBuild(moved, { note: "  Added the map. ", techStack: "Next.js, Supabase" }, "2026-09-02T10:00:00.000Z");
  assert.equal(currentBuild(b2), 2);
  assert.deepEqual(b2.builds[1], { number: 2, note: "Added the map.", techStack: "Next.js, Supabase", at: "2026-09-02T10:00:00.000Z" });
  assert.equal(b2.plan.techStack, "Next.js, Supabase", "the plan takes the new stack");
  assert.equal(b2.builds[0].techStack, "Next.js, Postgres", "older builds keep theirs");
  assert.equal(editPrototype(b2, { ...fullDraft(), githubUrl: GH, supabase: false }, meanings).builds.length, 2, "editing keeps the log");
  let many = b2;
  for (let i = 0; i < MAX_BUILDS + 5; i++) many = startBuild(many, { note: `n${i}`, techStack: "x" });
  assert.equal(many.builds.length, MAX_BUILDS, "the log keeps the latest builds");
  assert.equal(currentBuild(many), MAX_BUILDS + 7, "numbers keep counting");
  assert.deepEqual(techStackItems(" Next.js, ,Supabase "), ["Next.js", "Supabase"]);
});

test("stored build logs are cleaned, and older prototypes start at build 1", () => {
  const solid = solidifyProject(p("a", "Alpha"), fullDraft(), meanings);
  const moved = prototypeProject(solid, { ...fullDraft(), githubUrl: GH, supabase: true }, meanings, "2026-09-01T10:00:00.000Z");
  const old = { ...moved };
  delete old.builds;
  assert.deepEqual(cleanProjects([old])[0].builds, [{ number: 1, note: "", techStack: "Next.js, Postgres", at: "" }]);
  const messy = [
    { number: 3, note: "Third", techStack: "x", at: "not a date" },
    { number: 2, note: " ", techStack: "x", at: "" },
    { number: 1, note: "", techStack: "x", at: "2026-09-01T10:00:00.000Z" },
    { number: 3, note: "Dup", techStack: "x" },
    { number: 1.5, note: "Half" },
    "junk",
  ];
  assert.deepEqual(
    cleanProjects([{ ...moved, builds: messy }])[0].builds.map((b) => [b.number, b.note, b.at]),
    [[1, "", "2026-09-01T10:00:00.000Z"], [3, "Third", ""]],
  );
  assert.deepEqual(cleanProjects([{ ...solid, builds: moved.builds }])[0].builds, [], "no log before Prototype");
});

test("each move keeps a record of the stage it left", () => {
  const people = [{ id: "a", name: "Avery", role: null }];
  const start = p("a", "Alpha", { description: "First idea.", people });
  const solid = solidifyProject(start, fullDraft(), meanings, "2026-09-01T10:00:00.000Z");
  assert.deepEqual(solid.history.brainstorming, {
    at: "2026-09-01T10:00:00.000Z",
    name: "Alpha",
    description: "First idea.",
    people,
    plan: null,
    prototype: null,
    roleMeanings: {},
  });
  const renamed = editDetails(solid, { name: "Alpha 2", description: "Changed.", thumbnail: PNG, notesUrl: DOC, people: [] });
  assert.equal(renamed.history.brainstorming.name, "Alpha", "later edits leave the record alone");
  const moved = prototypeProject(renamed, { ...fullDraft(), techStack: "Next.js, Supabase", githubUrl: GH, supabase: true }, meanings, "2026-09-05T10:00:00.000Z");
  assert.equal(moved.history.solidifying.plan.techStack, "Next.js, Postgres", "the plan as it stood, before the form's edits");
  assert.equal(moved.history.solidifying.name, "Alpha 2");
  assert.equal(moved.history.solidifying.people[0].role, "manager");
  assert.equal(moved.plan.techStack, "Next.js, Supabase");
  assert.equal(moved.history.brainstorming.name, "Alpha");
});

test("stored stage records are cleaned, filled in and trimmed to the stages left", () => {
  const solid = solidifyProject(p("a", "Alpha"), fullDraft(), meanings, "2026-09-01T10:00:00.000Z");
  assert.deepEqual(cleanProjects([solid])[0].history, solid.history);
  const old = { ...solid, history: undefined };
  const filled = cleanProjects([old])[0].history;
  assert.equal(filled.brainstorming.at, "");
  assert.equal(filled.brainstorming.plan, null);
  assert.equal(filled.brainstorming.people[0].role, null, "brainstorming records carry no roles");
  const moved = prototypeProject(solid, { ...fullDraft(), githubUrl: GH, supabase: true }, meanings);
  const broken = cleanProjects([{ ...moved, history: { ...moved.history, solidifying: { name: "x", plan: "junk" }, live: moved.history.brainstorming } }])[0].history;
  assert.deepEqual(Object.keys(broken), ["brainstorming", "solidifying"], "only stages left");
  assert.equal(broken.solidifying.plan.techStack, "Next.js, Postgres", "a broken record is rebuilt");
  assert.deepEqual(cleanProjects([{ ...solid, stage: "brainstorming" }])[0].history, {});
});

test("links take http or https web addresses, and get https when typed bare", () => {
  assert.ok(isWebUrl("https://example.com"));
  assert.ok(isWebUrl("http://portal.example.edu"));
  assert.ok(isWebUrl("studyrooms.example.edu/path"));
  assert.equal(normalizeUrl(" studyrooms.example.edu "), "https://studyrooms.example.edu");
  assert.ok(!isWebUrl("javascript:alert(1)"));
  assert.ok(!isWebUrl("ftp://example.com"));
  assert.ok(!isWebUrl("https://localhost"));
  assert.ok(!isWebUrl("https://user:pw@example.com"));
  assert.ok(!isWebUrl(""));
  assert.equal(urlLabel("https://example.com/"), "example.com");
  assert.equal(urlLabel("https://example.com/deck"), "example.com/deck");
});

const liveDraft = (extra = {}) => ({
  siteUrl: "studyrooms.example.edu",
  slidesUrl: "https://slides.example.com/d",
  demoUrl: "https://video.example.com/v",
  contributions: { a: " Ran the plan. " },
  confirmed: true,
  ...extra,
});
const toPrototype = () =>
  prototypeProject(solidifyProject(p("a", "Alpha"), fullDraft(), meanings), { ...fullDraft(), githubUrl: GH, supabase: true }, meanings);

test("moving to Live needs three links, a contribution from everyone and the confirmation", () => {
  const proto = toPrototype();
  assert.deepEqual(liveProblems(liveDraft(), proto.people), []);
  assert.deepEqual(
    liveProblems({ siteUrl: "", slidesUrl: "nope", demoUrl: "javascript:x", contributions: {}, confirmed: false }, proto.people),
    ["siteUrl", "slidesUrl", "demoUrl", "contribution:a", "confirmed"],
  );
  assert.equal(liveProject(proto, liveDraft({ confirmed: false })), null);
  assert.equal(liveProject(solidifyProject(p("b", "Beta"), fullDraft(), meanings), liveDraft()), null, "Solidifying skips no stage");
  const live = liveProject(proto, liveDraft(), "2026-09-12T10:00:00.000Z");
  assert.equal(live.stage, "live");
  assert.deepEqual(live.launch, {
    siteUrl: "https://studyrooms.example.edu",
    slidesUrl: "https://slides.example.com/d",
    demoUrl: "https://video.example.com/v",
    contributions: { a: "Ran the plan." },
    at: "2026-09-12T10:00:00.000Z",
  });
  assert.deepEqual(live.history.prototype.prototype, proto.prototype, "Prototype is kept as it stood");
  assert.equal(startBuild(live, { note: "x", techStack: "y" }), null, "a Live build log is final");
  assert.equal(editPrototype(live, { ...fullDraft(), githubUrl: GH, supabase: false }, meanings), null, "a Live plan is final");
  const edited = editLaunch(live, liveDraft({ demoUrl: "https://video.example.com/v2" }));
  assert.equal(edited.launch.demoUrl, "https://video.example.com/v2");
  assert.equal(edited.launch.at, "2026-09-12T10:00:00.000Z", "the go-live date stays");
  assert.equal(editLaunch(live, liveDraft({ confirmed: false })), null, "every edit is confirmed again");
  assert.equal(editLaunch(proto, liveDraft()), null);
});

test("a Live project without a complete launch goes back to Prototype", () => {
  const live = liveProject(toPrototype(), liveDraft());
  assert.equal(cleanProjects([live])[0].stage, "live");
  assert.deepEqual(cleanProjects([live])[0].launch, live.launch);
  assert.equal(cleanProjects([{ ...live, launch: null }])[0].stage, "prototype");
  assert.equal(cleanProjects([{ ...live, launch: { ...live.launch, slidesUrl: "javascript:alert(1)" } }])[0].stage, "prototype");
  assert.equal(cleanProjects([{ ...live, launch: { ...live.launch, contributions: {} } }])[0].stage, "prototype");
  assert.equal(cleanProjects([{ ...live, stage: "prototype" }])[0].launch, null, "no launch before Live");
  assert.equal(cleanProjects([{ ...live, history: {} }])[0].history.prototype.prototype.githubUrl, GH, "a missing Prototype record is rebuilt");
});

test("every sample project keeps its stage and what that stage needs", async () => {
  const { copy } = await import("../src/content/copy.ts");
  const data = copy.projectum.demo.samples;
  const samples = data.map(sampleProject);
  assert.equal(new Set(samples.map((s) => s.id)).size, samples.length, "ids are unique");
  for (const [i, s] of samples.entries()) {
    const name = data[i].name;
    assert.equal(s.stage, data[i].stage, `${name} stays in ${data[i].stage}`);
    if (s.stage !== "brainstorming") assert.ok(s.plan && s.people.every((p) => p.role), `${name} has a plan and roles`);
    if (s.stage === "prototype" || s.stage === "live") assert.ok(s.prototype && s.builds.length >= 1, `${name} has builds`);
    if (s.stage === "live") assert.ok(s.launch, `${name} has a launch`);
    assert.ok(isNotesUrl(s.notesUrl), `${name} has a notes doc`);
  }
  assert.deepEqual([...new Set(samples.map((s) => s.stage))].sort(), ["brainstorming", "live", "prototype", "solidifying"]);
});

test("stored lists are cleaned before they render", () => {
  assert.deepEqual(cleanProjects("nope"), []);
  const cleaned = cleanProjects([
    null,
    { id: "", name: "x" },
    { id: "a", name: "   " },
    {
      id: "b",
      name: "  Keep  me ",
      description: 5,
      thumbnail: "javascript:alert(1)",
      stage: "shipped",
      people: [{ id: "p1", name: "Avery", role: "wizard" }, { id: "p1", name: "Dup" }, { id: "", name: "No id" }, "junk"],
    },
  ]);
  assert.deepEqual(cleaned, [
    p("b", "Keep me", { thumbnail: null, notesUrl: "", people: [{ id: "p1", name: "Avery", role: null }] }),
  ]);
  const many = Array.from({ length: MAX_PEOPLE + 5 }, (_, i) => ({ id: `p${i}`, name: `P ${i}` }));
  assert.equal(cleanProjects([p("c", "C", { people: many })])[0].people.length, MAX_PEOPLE);
});

test("a project past Brainstorming without a complete plan goes back", () => {
  const moved = solidifyProject(p("a", "Alpha"), fullDraft(), meanings);
  assert.equal(cleanProjects([moved])[0].stage, "solidifying");
  assert.equal(cleanProjects([{ ...moved, plan: null }])[0].stage, "brainstorming");
  assert.equal(cleanProjects([{ ...moved, people: [{ id: "a", name: "Avery", role: null }] }])[0].stage, "brainstorming");
  assert.equal(cleanProjects([{ ...p("z", "Z"), stage: "live" }])[0].stage, "brainstorming");
});

test("older folder-only saves load as brainstorming projects", () => {
  const old = [{ id: "a", name: "Alpha", children: [{ id: "b", name: "Brief", children: [] }] }];
  assert.deepEqual(cleanProjects(old), [p("a", "Alpha", { thumbnail: null, notesUrl: "" })]);
});

test("names and descriptions are tidied and capped", () => {
  assert.equal(cleanName("  a   b  "), "a b");
  assert.equal(cleanName("x".repeat(100)).length, 60);
  assert.equal(cleanDescription("  one\r\n\n\n\ntwo   three  "), "one\n\ntwo three");
  assert.equal(cleanDescription("x".repeat(2000)).length, 1000);
});
