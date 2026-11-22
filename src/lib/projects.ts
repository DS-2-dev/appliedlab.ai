import {
  STAGES,
  type Stage,
  ROLE_IDS,
  type RoleId,
  type FolderColor,
  isFolderColor,
  type Person,
  type Step,
  type Plan,
  type Prototype,
  type Build,
  type StageRecord,
  type Launch,
  type Project,
  MAX_LONG_TEXT,
  MAX_PEOPLE,
  MAX_STEPS,
  MAX_BUILDS,
  cleanName,
  cleanLine,
  cleanDescription,
  isRoleId,
  isWorkUrl,
  normalizeUrl,
  isWebUrl,
  isNotesUrl,
  isThumbnail,
} from "./project-model";

export * from "./project-model";

const str = (v: unknown) => (typeof v === "string" ? v : "");

function cleanPeople(value: unknown): Person[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { id, name, role } = item as Record<string, unknown>;
    if (typeof id !== "string" || !id || seen.has(id) || typeof name !== "string") continue;
    const clean = cleanName(name);
    if (!clean) continue;
    seen.add(id);
    out.push({ id, name: clean, role: isRoleId(role) ? role : null });
    if (out.length === MAX_PEOPLE) break;
  }
  return out;
}

function cleanPlan(value: unknown): Plan | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  const steps: Step[] = [];
  if (Array.isArray(p.steps)) {
    for (const s of p.steps) {
      if (!s || typeof s !== "object") continue;
      const { id, text, ownerId } = s as Record<string, unknown>;
      if (typeof id !== "string" || !id) continue;
      steps.push({ id, text: cleanLine(str(text)), ownerId: str(ownerId) });
      if (steps.length === MAX_STEPS) break;
    }
  }
  return {
    thesis: cleanDescription(str(p.thesis), MAX_LONG_TEXT),
    reasoning: cleanDescription(str(p.reasoning), MAX_LONG_TEXT),
    techStack: cleanLine(str(p.techStack)),
    steps,
  };
}

function cleanPrototype(value: unknown): Prototype | null {
  if (!value || typeof value !== "object") return null;
  const { githubUrl, supabase } = value as Record<string, unknown>;
  if (typeof githubUrl !== "string" || !isWorkUrl(githubUrl)) return null;
  return { githubUrl: githubUrl.trim(), supabase: supabase === true };
}

const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));

// Numbered from 1, in order, one entry per number. A build after the first
// without a note is dropped.
function cleanBuilds(value: unknown): Build[] {
  if (!Array.isArray(value)) return [];
  const byNumber = new Map<number, Build>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { number, note, techStack, at } = item as Record<string, unknown>;
    if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 1 || byNumber.has(number)) continue;
    const clean = cleanDescription(str(note));
    if (number > 1 && !clean) continue;
    byNumber.set(number, { number, note: clean, techStack: cleanLine(str(techStack)), at: isTimestamp(at) ? at : "" });
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number).slice(-MAX_BUILDS);
}

type RecordFields = Pick<Project, "name" | "description" | "people" | "plan" | "prototype" | "roleMeanings">;

// What a project in `stage` looks like as a record. Brainstorming has no
// plan and no roles yet, and only Prototype carries the prototype.
function recordFrom(fields: RecordFields, stage: Stage, at: string): StageRecord {
  const planned = stage !== "brainstorming";
  return {
    at,
    name: fields.name,
    description: fields.description,
    people: planned ? fields.people : fields.people.map((p) => ({ ...p, role: null })),
    plan: planned ? fields.plan : null,
    prototype: stage === "prototype" ? fields.prototype : null,
    roleMeanings: planned ? fields.roleMeanings : {},
  };
}

function cleanRecord(value: unknown, stage: Stage): StageRecord | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const name = cleanName(str(r.name));
  const plan = cleanPlan(r.plan);
  const prototype = cleanPrototype(r.prototype);
  if (!name || (stage !== "brainstorming" && !plan) || (stage === "prototype" && !prototype)) return null;
  return recordFrom(
    {
      name,
      description: cleanDescription(str(r.description)),
      people: cleanPeople(r.people),
      plan,
      prototype,
      roleMeanings: cleanMeanings(r.roleMeanings),
    },
    stage,
    isTimestamp(r.at) ? r.at : "",
  );
}

// A launch needs all three links and a contribution from everyone on the
// project; anything short of that is dropped.
function cleanLaunch(value: unknown, people: Person[]): Launch | null {
  if (!value || typeof value !== "object") return null;
  const l = value as Record<string, unknown>;
  const urls = [str(l.siteUrl), str(l.slidesUrl), str(l.demoUrl)].map((u) => u.trim());
  if (!urls.every(optionalUrl) || people.length === 0) return null;
  const raw = l.contributions && typeof l.contributions === "object" ? (l.contributions as Record<string, unknown>) : {};
  const contributions: Record<string, string> = {};
  for (const person of people) {
    const text = cleanLine(str(raw[person.id]));
    if (!text) return null;
    contributions[person.id] = text;
  }
  const [siteUrl, slidesUrl, demoUrl] = urls.map((u) => (u ? normalizeUrl(u) : ""));
  return { siteUrl, slidesUrl, demoUrl, contributions, at: isTimestamp(l.at) ? l.at : "" };
}

function cleanMeanings(value: unknown): Partial<Record<RoleId, string>> {
  const out: Partial<Record<RoleId, string>> = {};
  if (!value || typeof value !== "object") return out;
  for (const id of ROLE_IDS) {
    const meaning = cleanLine(str((value as Record<string, unknown>)[id]));
    if (meaning) out[id] = meaning;
  }
  return out;
}

// What a plan is missing, as field keys the form can point at. Shared by the
// Solidifying form and by loading, so a project can only sit past
// Brainstorming with a complete plan and everyone given a role.
export function planProblems(plan: Plan, people: Person[]): string[] {
  const problems: string[] = [];
  if (!cleanDescription(plan.thesis, MAX_LONG_TEXT)) problems.push("thesis");
  if (!cleanDescription(plan.reasoning, MAX_LONG_TEXT)) problems.push("reasoning");
  if (plan.steps.length === 0) problems.push("steps");
  for (const step of plan.steps) {
    if (!cleanLine(step.text)) problems.push(`step-text:${step.id}`);
    if (!people.some((p) => p.id === step.ownerId)) problems.push(`step-owner:${step.id}`);
  }
  if (people.length === 0) problems.push("people");
  return problems;
}

export type SolidifyDraft = Plan & { people: Person[]; meanings: Record<RoleId, string> };

// Everything the Solidifying form still needs. Empty means the move is
// allowed.
export function solidifyProblems(draft: SolidifyDraft): string[] {
  return planProblems(draft, draft.people);
}

// Moves a brainstorming project into Solidifying with its plan, keeping a
// record of how it stood in Brainstorming. Null when the draft is
// incomplete or the project is past Brainstorming.
export function solidifyProject(
  project: Project,
  draft: SolidifyDraft,
  defaults: Record<RoleId, string>,
  at: string = new Date().toISOString(),
): Project | null {
  if (project.stage !== "brainstorming" || solidifyProblems(draft).length) return null;
  return {
    ...applyPlan(project, draft, defaults, "solidifying"),
    history: { ...project.history, brainstorming: recordFrom(project, "brainstorming", at) },
  };
}

// Saves an edited plan on a project already past Brainstorming. Every field
// stays required; the stage does not change.
export function editPlan(project: Project, draft: SolidifyDraft, defaults: Record<RoleId, string>): Project | null {
  if (project.stage === "brainstorming" || solidifyProblems(draft).length) return null;
  return applyPlan(project, draft, defaults, project.stage);
}

export type PrototypeDraft = SolidifyDraft & { githubUrl: string; supabase: boolean | null };

// Everything the Prototype form still needs: the whole plan again and the
// project's main link.
export function prototypeProblems(draft: PrototypeDraft): string[] {
  const problems = solidifyProblems(draft);
  if (!isWorkUrl(draft.githubUrl)) problems.push("githubUrl");
  return problems;
}

function withPrototype(project: Project, draft: PrototypeDraft, defaults: Record<RoleId, string>, stage: Stage): Project {
  return {
    ...applyPlan(project, draft, defaults, stage),
    prototype: { githubUrl: draft.githubUrl.trim(), supabase: draft.supabase === true },
  };
}

// Moves a solidifying project into Prototype as build 1, keeping a record
// of how it stood in Solidifying before the form's edits. Null when the
// draft is incomplete or the project is not in Solidifying.
export function prototypeProject(
  project: Project,
  draft: PrototypeDraft,
  defaults: Record<RoleId, string>,
  at: string = new Date().toISOString(),
): Project | null {
  if (project.stage !== "solidifying" || prototypeProblems(draft).length) return null;
  const moved = withPrototype(project, draft, defaults, "prototype");
  return {
    ...moved,
    builds: [{ number: 1, note: "", techStack: moved.plan?.techStack ?? "", at }],
    history: { ...project.history, solidifying: recordFrom(project, "solidifying", at) },
  };
}

export type BuildDraft = { note: string; techStack: string };

// What a new build still needs: what changed. The tools are optional.
export function buildProblems(draft: BuildDraft): string[] {
  return cleanDescription(draft.note) ? [] : ["note"];
}

// The build a prototype is on: the last one logged.
export function currentBuild(project: Project): number {
  return project.builds.length ? project.builds[project.builds.length - 1].number : 1;
}

// Starts the next build on a project in Prototype, logging what changed.
// The tech stack given becomes the plan's. Null when the draft is
// incomplete or the project is not in Prototype; a Live project's log is
// final.
export function startBuild(project: Project, draft: BuildDraft, at: string = new Date().toISOString()): Project | null {
  if (project.stage !== "prototype" || !project.plan || buildProblems(draft).length) return null;
  const techStack = cleanLine(draft.techStack);
  const build: Build = { number: currentBuild(project) + 1, note: cleanDescription(draft.note), techStack, at };
  return {
    ...project,
    plan: { ...project.plan, techStack },
    builds: [...project.builds, build].slice(-MAX_BUILDS),
  };
}

export type LiveDraft = {
  siteUrl: string;
  slidesUrl: string;
  demoUrl: string;
  contributions: Record<string, string>;
  confirmed: boolean;
};

// A link a submission may leave out; any it gives must be a web address.
const optionalUrl = (value: string) => !value.trim() || isWebUrl(value);

// Everything the submission form still needs: a contribution from each
// person and the confirmation. The site, slides and demo links are optional,
// since not every project has them, but any given must be a web address.
// (The final report is a file, checked by the form and the Worker.)
export function liveProblems(draft: LiveDraft, people: Person[]): string[] {
  const problems: string[] = [];
  if (!optionalUrl(draft.siteUrl)) problems.push("siteUrl");
  if (!optionalUrl(draft.slidesUrl)) problems.push("slidesUrl");
  if (!optionalUrl(draft.demoUrl)) problems.push("demoUrl");
  for (const person of people) if (!cleanLine(draft.contributions[person.id] ?? "")) problems.push(`contribution:${person.id}`);
  if (!draft.confirmed) problems.push("confirmed");
  return problems;
}

function launchFrom(draft: LiveDraft, people: Person[], at: string): Launch {
  const link = (u: string) => (u.trim() ? normalizeUrl(u) : "");
  return {
    siteUrl: link(draft.siteUrl),
    slidesUrl: link(draft.slidesUrl),
    demoUrl: link(draft.demoUrl),
    contributions: Object.fromEntries(people.map((p) => [p.id, cleanLine(draft.contributions[p.id] ?? "")])),
    at,
  };
}

// Moves a prototype to Live, keeping a record of how it stood in Prototype.
// Null when the draft is incomplete or the project is not in Prototype.
export function liveProject(project: Project, draft: LiveDraft, at: string = new Date().toISOString()): Project | null {
  if (project.stage !== "prototype" || !project.plan || !project.prototype) return null;
  if (liveProblems(draft, project.people).length) return null;
  return {
    ...project,
    stage: "live",
    launch: launchFrom(draft, project.people, at),
    history: { ...project.history, prototype: recordFrom(project, "prototype", at) },
  };
}

// Saves edited links and contributions on a Live project. Every field stays
// required, the confirmation included, and the go-live date stays.
export function editLaunch(project: Project, draft: LiveDraft): Project | null {
  if (project.stage !== "live" || !project.launch || liveProblems(draft, project.people).length) return null;
  return { ...project, launch: launchFrom(draft, project.people, project.launch.at) };
}

// Saves an edited plan and prototype on a project in Prototype. Every field
// stays required; the stage does not change. Once Live, the plan is final.
export function editPrototype(project: Project, draft: PrototypeDraft, defaults: Record<RoleId, string>): Project | null {
  if (project.stage !== "prototype" || prototypeProblems(draft).length) return null;
  return withPrototype(project, draft, defaults, project.stage);
}

// Saves edited details (name, thumbnail, description, notes doc, people).
// Past Brainstorming, people carry roles and own steps, so they are edited
// with the plan and left alone here.
export function editDetails(
  project: Project,
  details: { name: string; description: string; thumbnail: string | null; notesUrl: string; people: Person[] },
): Project | null {
  if (projectProblem(details)) return null;
  return {
    ...project,
    name: cleanName(details.name),
    description: cleanDescription(details.description),
    thumbnail: details.thumbnail,
    notesUrl: normalizeUrl(details.notesUrl),
    people: project.stage === "brainstorming" ? details.people : project.people,
  };
}

function applyPlan(project: Project, draft: SolidifyDraft, defaults: Record<RoleId, string>, stage: Stage): Project {
  const roleMeanings: Partial<Record<RoleId, string>> = {};
  for (const id of ROLE_IDS) {
    const meaning = cleanLine(draft.meanings[id]);
    if (meaning !== defaults[id]) roleMeanings[id] = meaning;
  }
  return {
    ...project,
    stage,
    people: draft.people.map((p) => ({ ...p, name: cleanName(p.name) })),
    plan: {
      thesis: cleanDescription(draft.thesis, MAX_LONG_TEXT),
      reasoning: cleanDescription(draft.reasoning, MAX_LONG_TEXT),
      techStack: cleanLine(draft.techStack),
      steps: draft.steps.map((s) => ({ id: s.id, text: cleanLine(s.text), ownerId: s.ownerId })),
    },
    roleMeanings,
  };
}

// The board moved to `stage` whatever its plan says. cleanProjects sends a
// board with an unfinished plan back to Brainstorming, but a claimed
// project's board sits in Solidifying while the plan is written (the Worker
// holds it there too).
export function atStage(board: Project, stage: Stage): Project {
  if (board.stage === stage) return board;
  const brainstorming = board.history.brainstorming ?? {
    at: "",
    name: board.name,
    description: board.description,
    people: board.people.map((p) => ({ ...p, role: null })),
    plan: null,
    prototype: null,
    roleMeanings: {},
  };
  return { ...board, stage, history: { ...board.history, brainstorming } };
}

// Stored data is untrusted (another tab, an older shape, hand edits), so
// anything malformed is dropped or reset rather than rendered. Older saves
// that were only a folder name load as a brainstorming project with no
// thumbnail, and anything they nested is dropped. A project past
// Brainstorming without a complete plan goes back to Brainstorming, and one
// in Prototype or later without its GitHub link and Supabase answer goes
// back to Solidifying, and one in Live without a complete launch goes back
// to Prototype. A prototype saved before builds existed starts its
// log at build 1, and a stage left before records were kept gets one made
// from what the project has now. A notes link that is not a Google Doc
// loads as none, leaving the stage alone.
export function cleanProjects(value: unknown): Project[] {
  if (!Array.isArray(value)) return [];
  const out: Project[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== "string" || !p.id || typeof p.name !== "string") continue;
    const name = cleanName(p.name);
    if (!name) continue;
    const people = cleanPeople(p.people);
    const plan = cleanPlan(p.plan);
    const prototype = cleanPrototype(p.prototype);
    let stage: Stage = STAGES.includes(p.stage as Stage) ? (p.stage as Stage) : "brainstorming";
    if (stage !== "brainstorming" && (!plan || planProblems(plan, people).length)) stage = "brainstorming";
    if ((stage === "prototype" || stage === "live") && !prototype) stage = "solidifying";
    const launch = stage === "live" ? cleanLaunch(p.launch, people) : null;
    if (stage === "live" && !launch) stage = "prototype";
    let builds: Build[] = [];
    if (stage === "prototype" || stage === "live") {
      builds = cleanBuilds(p.builds);
      if (!builds.length) builds = [{ number: 1, note: "", techStack: plan?.techStack ?? "", at: "" }];
    }
    const description = typeof p.description === "string" ? cleanDescription(p.description) : "";
    const roleMeanings = cleanMeanings(p.roleMeanings);
    const rawHistory = p.history && typeof p.history === "object" ? (p.history as Record<string, unknown>) : {};
    const history: Partial<Record<Stage, StageRecord>> = {};
    for (const left of STAGES.slice(0, STAGES.indexOf(stage))) {
      history[left] =
        cleanRecord(rawHistory[left], left) ??
        recordFrom({ name, description, people, plan, prototype, roleMeanings }, left, "");
    }
    out.push({
      id: p.id,
      name,
      description,
      thumbnail: isThumbnail(p.thumbnail) ? p.thumbnail : null,
      notesUrl: typeof p.notesUrl === "string" && isNotesUrl(p.notesUrl) ? normalizeUrl(p.notesUrl) : "",
      color: isFolderColor(p.color) ? p.color : null,
      people,
      stage,
      plan,
      prototype,
      builds,
      history,
      launch,
      roleMeanings,
    });
  }
  return out;
}

// What stops a project from being created or its details saved, first
// problem first.
export function projectProblem(draft: {
  name: string;
  thumbnail: string | null;
  notesUrl: string;
}): "name" | "thumbnail" | "notes" | null {
  if (!cleanName(draft.name)) return "name";
  // Optional, since boards open from approved plans without one, but only
  // an inline image is kept.
  if (draft.thumbnail !== null && !isThumbnail(draft.thumbnail)) return "thumbnail";
  if (!isNotesUrl(draft.notesUrl)) return "notes";
  return null;
}

export function addProject(list: Project[], project: Project): Project[] {
  return [...list, project];
}

export function renameProject(list: Project[], id: string, name: string): Project[] {
  return list.map((p) => (p.id === id ? { ...p, name } : p));
}

export function recolorProject(list: Project[], id: string, color: FolderColor | null): Project[] {
  return list.map((p) => (p.id === id ? { ...p, color } : p));
}

export function removeProject(list: Project[], id: string): Project[] {
  return list.filter((p) => p.id !== id);
}

export function replaceProject(list: Project[], project: Project): Project[] {
  return list.map((p) => (p.id === project.id ? project : p));
}

