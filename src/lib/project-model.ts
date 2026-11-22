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

// On a project's board a step is one of its action plan's milestones, and
// its text reads "<title>. <criterion>": what gets done, then how its
// success is judged (worker/src/boards.ts writes it the same way). A step
// with no criterion is its title alone. stepText and splitStep convert.
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

// A milestone as a step's text: "<title>. <criterion>", or the title alone
// without a criterion.
export function stepText(title: string, criterion: string): string {
  const t = cleanLine(title);
  const c = cleanLine(criterion);
  return cleanLine(c ? `${t}. ${c}` : t);
}

// A step's text back as a milestone, split at its first ". ".
export function splitStep(text: string): { title: string; criterion: string } {
  const cut = text.indexOf(". ");
  return cut < 0 ? { title: text.trim(), criterion: "" } : { title: text.slice(0, cut).trim(), criterion: text.slice(cut + 2).trim() };
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

// The project's main link: any https address, a repository, a Drive folder,
// a Figma file or a spreadsheet, since projects span every field. Stored
// links render as hrefs, so nothing else gets through.
export function isWorkUrl(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > MAX_URL) return false;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || !url.hostname.includes(".")) return false;
  return !url.username && !url.password;
}

// A tech stack line as its items, split on commas.
export function techStackItems(techStack: string): string[] {
  return techStack
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// "owner/repo" for display.
// A main link as a short label: a GitHub repository as owner/repo, any
// other link as its site, "drive.google.com".
export function linkLabel(value: string): string {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace(/^www\./, "");
    if (host === "github.com") return url.pathname.split("/").filter(Boolean).slice(0, 2).join("/") || host;
    return host;
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
