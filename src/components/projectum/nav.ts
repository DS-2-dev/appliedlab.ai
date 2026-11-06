// Projectum's views, which of them the sidebar lists for an account, and
// which one an address opens. Pure, so scripts/nav.test.mjs can check every
// role without rendering anything; the sidebar adds the icons.

import { copy } from "@/content/copy";
import type { Account } from "@/lib/account";

export type ProjectumView =
  | "board"
  | "postings"
  | "posting"
  | "myprojects"
  | "projects"
  | "project"
  | "reviews"
  | "review"
  | "inbox"
  | "org"
  | "overview";

export type NavItem = { view: ProjectumView; label: string; href: string; badge?: number };

// The counts the sidebar's badges show, from GET /shell.
export type ShellCounts = { court: number; reviews: number; requests: number };

type Who = Pick<Account, "role" | "roles" | "admin">;

const N = copy.projectum.pipeline.nav;
const HOME = "/projectum";
const at = (view: string) => `${HOME}?view=${view}`;

const isAdmin = (me: Who) => me.admin || me.roles.includes("admin");
const isStaff = (me: Who) => isAdmin(me) || me.role === "rep" || me.roles.includes("rep");
const isPartner = (me: Who) => me.role === "partner";
const isMember = (me: Who) => me.role === "member" || me.roles.includes("member");

// The sidebar's entries, by the account's own role: a member works on
// projects, a partner posts and runs the organization, a rep reviews. An
// admin also gets All postings, Reviews and the Overview, after the rest.
export function navItems(me: Who, counts: ShellCounts): NavItem[] {
  const court: NavItem = { view: "inbox", label: N.inbox, href: at("inbox"), badge: counts.court };
  const reviews: NavItem = { view: "reviews", label: N.reviews, href: at("reviews"), badge: counts.reviews };
  const projects: NavItem = { view: "projects", label: N.projects, href: at("projects") };
  const items: NavItem[] =
    me.role === "partner"
      ? [
          { view: "postings", label: N.myPostings, href: HOME },
          { view: "org", label: N.org, href: at("org"), badge: counts.requests },
          court,
        ]
      : me.role === "rep"
        ? [{ view: "board", label: N.board, href: HOME }, reviews, projects, court]
        : [
            { view: "board", label: N.board, href: HOME },
            { view: "myprojects", label: N.myProjects, href: at("myprojects") },
            projects,
            court,
          ];
  if (isAdmin(me)) {
    // Every partner posting, and where an admin posts for the Lab.
    if (!items.some((i) => i.view === "postings")) items.push({ view: "postings", label: N.allPostings, href: at("postings") });
    if (!items.some((i) => i.view === "reviews")) items.push(reviews);
    items.push({ view: "overview", label: N.overview, href: at("overview") });
  }
  return items;
}

// What the address names besides ?view=: ?id= for the view's subject,
// ?posting= for a posting and ?project= for a board.
export type ViewContext = Who & { id: string | null; posting: string | null; project: string | null };

// Which view the address asks for, held to what the account may open. A
// partner's home is My Postings, everyone else's the Notice Board.
export function pickView(asked: string | null, ctx: ViewContext): ProjectumView {
  const home: ProjectumView = isPartner(ctx) ? "postings" : "board";
  if (ctx.posting) return "posting";
  if (ctx.project) return "project";
  switch (asked) {
    case "posting":
      return ctx.id ? "posting" : home;
    case "project":
      return ctx.id ? "project" : home;
    case "review":
      if (!isStaff(ctx)) return home;
      return ctx.id ? "review" : "reviews";
    // ?view=queue is the older name for the reviews queue.
    case "reviews":
    case "queue":
      return isStaff(ctx) ? "reviews" : home;
    case "overview":
      return isAdmin(ctx) ? "overview" : home;
    case "org":
      return isPartner(ctx) || (isStaff(ctx) && ctx.id) ? "org" : home;
    case "postings":
      return isPartner(ctx) || isAdmin(ctx) ? "postings" : home;
    case "myprojects":
      return isMember(ctx) ? "myprojects" : home;
    case "projects":
      return isPartner(ctx) ? home : "projects";
    case "inbox":
      return "inbox";
    default:
      return home;
  }
}
