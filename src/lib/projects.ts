// Projectum projects: the data behind the sidebar's "Your Projects" list and a
// project's board. Pure functions over plain data, so they can be tested
// without a browser and the storage behind them can change (localStorage
// today, the database once projects have one) without touching the rules.

export const STAGES = ["brainstorming", "solidifying", "prototype", "live"] as const;
export type Stage = (typeof STAGES)[number];

// Role presets, in the order they are offered. Names, meanings and colours
// live with the components; a project can reword what each role means.
export const ROLE_IDS = ["manager", "uiux", "frontend", "backend", "data", "qa", "communication"] as const;
export type RoleId = (typeof ROLE_IDS)[number];

// The presets a project's folder can take in Your Projects. No preset keeps
// the sidebar's own grey.
export const FOLDER_COLORS = ["blue", "green", "amber", "rose"] as const;
export type FolderColor = (typeof FOLDER_COLORS)[number];
export const isFolderColor = (value: unknown): value is FolderColor => FOLDER_COLORS.includes(value as FolderColor);

export type Person = { id: string; name: string; role: RoleId | null };

export type Step = { id: string; text: string; ownerId: string };

// Filled in on the way from Brainstorming to Solidifying.
export type Plan = { thesis: string; reasoning: string; techStack: string; steps: Step[] };

// Added on the way from Solidifying to Prototype.
export type Prototype = { githubUrl: string; supabase: boolean };

// One entry in a prototype's build log. Build 1 starts with the move into
// Prototype and has no note; every build after it says what changed and
// records the tech stack at that point. `at` is an ISO timestamp, empty for
// a build 1 filled in for older saves.
export type Build = { number: number; note: string; techStack: string; at: string };

// The project as it stood when it left a stage, kept so past stages can be
// viewed (never edited) as they were. `at` is when it moved on, empty for a
// record filled in for older saves. The thumbnail stays out to spare
// browser storage, so past views show the current one.
export type StageRecord = {
  at: string;
  name: string;
  description: string;
  people: Person[];
  plan: Plan | null;
  // Only on the Prototype record.
  prototype: Prototype | null;
  roleMeanings: Partial<Record<RoleId, string>>;
};

// Added on the way from Prototype to Live: where to see the finished
// project, and what each person contributed, keyed by person id. Moving to
// Live (and every edit after) needs the contributions confirmed, so a stored
// launch is a confirmed one. `at` is when the project went live.
export type Launch = {
  siteUrl: string;
  slidesUrl: string;
  demoUrl: string;
  contributions: Record<string, string>;
  at: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  // A data: image URL. Required when a project is created; projects saved
  // before thumbnails existed load with none.
  thumbnail: string | null;
  // A Google Doc for meeting notes and anything else the team keeps, at
  // every stage. Required when a project is created or edited; projects
  // saved before it existed load with none ("") until someone adds it.
  notesUrl: string;
  // The folder's colour in Your Projects: a preset, or null for the grey.
  color: FolderColor | null;
  people: Person[];
  stage: Stage;
  plan: Plan | null;
  prototype: Prototype | null;
  // Oldest first. Empty until Prototype; at least build 1 from then on.
  builds: Build[];
  // One record for each stage the project has left.
  history: Partial<Record<Stage, StageRecord>>;
  launch: Launch | null;
  // Only the meanings this project has reworded.
  roleMeanings: Partial<Record<RoleId, string>>;
};

export const MAX_NAME = 60;
export const MAX_DESCRIPTION = 1000;
export const MAX_LONG_TEXT = 2000;
export const MAX_LINE = 200;
export const MAX_PEOPLE = 20;
export const MAX_STEPS = 20;
// The log keeps the latest builds, so a long-running prototype stays within
// browser storage.
export const MAX_BUILDS = 100;
// Characters of data URL. Uploads are downscaled to fit well under this.
export const MAX_THUMBNAIL = 400_000;

export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

export function cleanLine(text: string, max = MAX_LINE): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

export function cleanDescription(text: string, max = MAX_DESCRIPTION): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export const isRoleId = (value: unknown): value is RoleId => ROLE_IDS.includes(value as RoleId);

export const MAX_URL = 300;

// A repository on github.com over https: owner and repo at least. Stored
// links render as hrefs, so nothing else gets through.
export function isGithubUrl(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > MAX_URL) return false;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || (url.hostname !== "github.com" && url.hostname !== "www.github.com")) return false;
  if (url.username || url.password || url.port) return false;
  return url.pathname.split("/").filter(Boolean).length >= 2;
}

// A tech stack line as its items, split on commas.
export function techStackItems(techStack: string): string[] {
  return techStack
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// "owner/repo" for display.
export function githubRepo(value: string): string {
  try {
    return new URL(value.trim()).pathname.split("/").filter(Boolean).slice(0, 2).join("/");
  } catch {
    return value;
  }
}

// A link typed without a scheme ("example.com") gets https.
export function normalizeUrl(value: string): string {
  const text = value.trim();
  if (!text) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
}

// A web page over http or https with a real host name. Stored links render
// as hrefs, so nothing else gets through.
export function isWebUrl(value: string): boolean {
  const text = normalizeUrl(value);
  if (!text || text.length > MAX_URL) return false;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.username || url.password) return false;
  return url.hostname.includes(".");
}

// A Google Doc over https (docs.google.com/document/...), typed with or
// without the scheme. Stored links render as hrefs, so nothing else gets
// through.
export function isNotesUrl(value: string): boolean {
  const text = normalizeUrl(value);
  if (!text || text.length > MAX_URL) return false;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") return false;
  if (url.username || url.password || url.port) return false;
  return /^\/document\/(u\/\d+\/)?d\/[^/]+/.test(url.pathname);
}

// "example.com/path" for display.
export function urlLabel(value: string): string {
  try {
    const url = new URL(value);
    return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}

// Only inline raster or SVG images, so a stored thumbnail can never point
// the page at another site or at a script URL.
export function isThumbnail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_THUMBNAIL &&
    /^data:image\/(png|jpeg|webp|gif|svg\+xml)[;,]/.test(value)
  );
}

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
  if (typeof githubUrl !== "string" || !isGithubUrl(githubUrl) || typeof supabase !== "boolean") return null;
  return { githubUrl: githubUrl.trim(), supabase };
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
  const urls = [str(l.siteUrl), str(l.slidesUrl), str(l.demoUrl)];
  if (!urls.every(isWebUrl) || people.length === 0) return null;
  const raw = l.contributions && typeof l.contributions === "object" ? (l.contributions as Record<string, unknown>) : {};
  const contributions: Record<string, string> = {};
  for (const person of people) {
    const text = cleanLine(str(raw[person.id]));
    if (!text) return null;
    contributions[person.id] = text;
  }
  const [siteUrl, slidesUrl, demoUrl] = urls.map(normalizeUrl);
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
  if (!cleanLine(plan.techStack)) problems.push("techStack");
  if (plan.steps.length === 0) problems.push("steps");
  for (const step of plan.steps) {
    if (!cleanLine(step.text)) problems.push(`step-text:${step.id}`);
    if (!people.some((p) => p.id === step.ownerId)) problems.push(`step-owner:${step.id}`);
  }
  if (people.length === 0) problems.push("people");
  for (const person of people) if (!person.role) problems.push(`role:${person.id}`);
  return problems;
}

export type SolidifyDraft = Plan & { people: Person[]; meanings: Record<RoleId, string> };

// Everything the Solidifying form still needs. Empty means the move is
// allowed.
export function solidifyProblems(draft: SolidifyDraft): string[] {
  const problems = planProblems(draft, draft.people);
  for (const id of ROLE_IDS) if (!cleanLine(draft.meanings[id] ?? "")) problems.push(`meaning:${id}`);
  return problems;
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

// Everything the Prototype form still needs: the whole plan again, the
// GitHub link, and a yes or no on Supabase.
export function prototypeProblems(draft: PrototypeDraft): string[] {
  const problems = solidifyProblems(draft);
  if (!isGithubUrl(draft.githubUrl)) problems.push("githubUrl");
  if (draft.supabase === null) problems.push("supabase");
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

// What a new build still needs: what changed, and the tech stack now.
export function buildProblems(draft: BuildDraft): string[] {
  const problems: string[] = [];
  if (!cleanDescription(draft.note)) problems.push("note");
  if (!cleanLine(draft.techStack)) problems.push("techStack");
  return problems;
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

// Everything the Live form still needs: the three links, a contribution
// from each person, and the confirmation.
export function liveProblems(draft: LiveDraft, people: Person[]): string[] {
  const problems: string[] = [];
  if (!isWebUrl(draft.siteUrl)) problems.push("siteUrl");
  if (!isWebUrl(draft.slidesUrl)) problems.push("slidesUrl");
  if (!isWebUrl(draft.demoUrl)) problems.push("demoUrl");
  for (const person of people) if (!cleanLine(draft.contributions[person.id] ?? "")) problems.push(`contribution:${person.id}`);
  if (!draft.confirmed) problems.push("confirmed");
  return problems;
}

function launchFrom(draft: LiveDraft, people: Person[], at: string): Launch {
  return {
    siteUrl: normalizeUrl(draft.siteUrl),
    slidesUrl: normalizeUrl(draft.slidesUrl),
    demoUrl: normalizeUrl(draft.demoUrl),
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
  if (!isThumbnail(draft.thumbnail)) return "thumbnail";
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

// Sample projects for All Projects, written as plain data in the copy file:
// people by name, step owners and credits by name, builds oldest first.
export type SampleData = {
  name: string;
  stage: string;
  icon: string;
  description: string;
  notesUrl: string;
  people: readonly { name: string; role?: string }[];
  plan?: {
    thesis: string;
    reasoning: string;
    techStack: string;
    steps: readonly { text: string; owner: string }[];
  };
  prototype?: {
    githubUrl: string;
    supabase: boolean;
    builds: readonly { note: string; techStack: string; at: string }[];
  };
  launch?: {
    siteUrl: string;
    slidesUrl: string;
    demoUrl: string;
    at: string;
    contributions: Readonly<Record<string, string>>;
  };
};

const slugOf = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// One sample as a Project. It goes through cleanProjects like any saved
// project, so a sample missing what its stage needs moves back a stage
// rather than rendering half-filled.
export function sampleProject(data: SampleData): Project | null {
  const id = `sample-${slugOf(data.name)}`;
  const people = data.people.map((p) => ({ id: `${id}-${slugOf(p.name)}`, name: p.name, role: p.role ?? null }));
  const idOf = (name: string) => people.find((p) => p.name === name)?.id ?? "";
  const { plan, prototype, launch } = data;
  const raw = {
    id,
    name: data.name,
    description: data.description,
    thumbnail: null,
    notesUrl: data.notesUrl,
    people,
    stage: data.stage,
    plan: plan
      ? {
          thesis: plan.thesis,
          reasoning: plan.reasoning,
          techStack: plan.techStack,
          steps: plan.steps.map((s, i) => ({ id: `${id}-step-${i + 1}`, text: s.text, ownerId: idOf(s.owner) })),
        }
      : null,
    prototype: prototype ? { githubUrl: prototype.githubUrl, supabase: prototype.supabase } : null,
    builds: (prototype?.builds ?? []).map((b, i) => ({ number: i + 1, ...b })),
    history: {},
    launch: launch
      ? {
          siteUrl: launch.siteUrl,
          slidesUrl: launch.slidesUrl,
          demoUrl: launch.demoUrl,
          at: launch.at,
          contributions: Object.fromEntries(people.map((p) => [p.id, launch.contributions[p.name] ?? ""])),
        }
      : null,
    roleMeanings: {},
  };
  return cleanProjects([raw])[0] ?? null;
}
