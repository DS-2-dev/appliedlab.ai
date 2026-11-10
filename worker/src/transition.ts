// The one code path for status changes. Postings, projects and (later)
// submissions all move through transition(): it finds the move in the shared
// machine (src/lib/pipeline/machines.ts), loads the context, checks the
// current status, authorizes the actor, checks feedback, runs the caller's
// guard, then writes.
//
// Concurrency. D1 has no row locks and a batch cannot abort part way on a
// condition, so the status row is the lock: the
//   UPDATE <table> SET status = ?, updated_at = ? WHERE id = ? AND status IN (<from>)
// runs alone first. If another request moved the row since we read it,
// meta.changes is 0 and we return "state" having written nothing. Only the
// winner goes on to run the hook statements and the event and notifications
// as a second env.DB.batch(). (Putting the UPDATE in the same batch would not
// help: by the time we saw changes = 0 the rest would already be committed.)
// Everything that can refuse (from, authorization, feedback, guard) runs
// before the UPDATE, and the hook's effects are built before it too, so a
// failure there leaves the row untouched.
//
// If the second batch fails (say a hook statement breaks a unique or foreign
// key constraint), we log it and compensate: UPDATE the row back to the
// status we read, WHERE status is still the one we set, and return "effects".
// Only a crash between the two batches, or a failed compensation (we then
// rethrow the batch's error), leaves the status changed without its event.
//
// Effects read state before the lock. Anything a hook derives (a round
// number, a count) can be stale by the time its statements run, so hooks must
// keep derived state on the locked row or re-check it with conditional SQL
// inside their own statements (INSERT ... SELECT ... WHERE, UPDATE ... WHERE).

import { MACHINES, type TransitionDef } from "@/lib/pipeline/machines";
import type { Role } from "@/lib/pipeline/domain";
import { isAdmin, rolesOf, type AccountEnv, type UserRow } from "./accounts";
import { emit } from "./events";
import { marks, now, type PostingRow, type ProjectRow } from "./db";

type Env = AccountEnv;

export type TransitionInput = {
  kind: "posting" | "project";
  id: string;
  name: string;
  feedback?: string;
  score?: number | null;
  // Hook input (integrate picks who comes on and says why); the engine
  // never reads them.
  memberIds?: string[];
  message?: string;
};

export type TransitionError = "not-found" | "state" | "forbidden" | "own-project" | "feedback" | "plan" | "unknown-transition" | "effects" | "blocked";

export type TransitionContext = {
  posting: PostingRow;
  project: ProjectRow | null;
  memberIds: string[];
  orgId: string | null;
  self: boolean;
  actorRoles: Role[];
};

type Refusal = { error: TransitionError; issues?: string[] };

export type Hooks = {
  // Returns a TransitionError (or one with issues) to refuse, null to allow.
  guard?: (ctx: TransitionContext, input: TransitionInput) => Promise<TransitionError | Refusal | null>;
  // Statements to add to the second batch, notifications to send, the
  // event's payload, and `after`: work (an email) that runs only once the
  // transition has succeeded. Its errors are logged and swallowed; the change
  // stands.
  effects: (
    ctx: TransitionContext,
    input: TransitionInput,
    at: string,
  ) => Promise<{ stmts: D1PreparedStatement[]; notify: Parameters<typeof emit>[2]["notify"]; payload?: Record<string, unknown>; after?: () => Promise<void> }>;
};

// The HTTP status each refusal goes out with.
export const TRANSITION_STATUS: Record<TransitionError, number> = {
  "not-found": 404,
  state: 409,
  forbidden: 403,
  "own-project": 403,
  feedback: 400,
  plan: 400,
  "unknown-transition": 400,
  effects: 500,
  // A move the rules hold back for now (reopen while the posting is off the board).
  blocked: 409,
};

export type TransitionResult = { ok: true; status: string } | { ok: false; error: TransitionError; issues?: string[] };

// Gate decisions a rep or admin may not take on their own work.
const GATES: Record<TransitionInput["kind"], readonly string[]> = {
  posting: ["approve", "return"],
  project: ["approvePlan", "returnPlan", "approveWork", "returnWork"],
};

const TABLE: Record<TransitionInput["kind"], string> = { posting: "postings", project: "projects" };

async function loadContext(env: Env, actor: UserRow, input: TransitionInput): Promise<TransitionContext | null> {
  let project: ProjectRow | null = null;
  let postingId = input.id;
  if (input.kind === "project") {
    project = await env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(input.id).first<ProjectRow>();
    if (!project) return null;
    postingId = project.posting_id;
  }
  const posting = await env.DB.prepare("SELECT * FROM postings WHERE id = ?").bind(postingId).first<PostingRow>();
  if (!posting) return null;
  let memberIds: string[] = [];
  if (project) {
    const { results } = await env.DB.prepare("SELECT user_id FROM project_members WHERE project_id = ?")
      .bind(project.id)
      .all<{ user_id: string }>();
    memberIds = results.map((r) => r.user_id);
  }
  const self = posting.kind === "self";
  const actorRoles: Role[] = rolesOf(actor);
  if (isAdmin(env, actor)) actorRoles.push("admin");
  return { posting, project, memberIds, orgId: self ? null : posting.org_id, self, actorRoles };
}

// Whether any role the actor holds, and the transition allows, applies here.
function authorized(def: TransitionDef<string>, actor: UserRow, ctx: TransitionContext): boolean {
  if (actor.status !== "active") return false;
  return def.by.some((r) => {
    if (!ctx.actorRoles.includes(r)) return false;
    if (r === "admin" || r === "rep") return true;
    if (r === "partner") return !!ctx.orgId && actor.org_id === ctx.orgId;
    if (r === "member") return ctx.memberIds.includes(actor.id);
    return false;
  });
}

// A reviewer deciding on their own work: a project they are on, or a posting
// they wrote or their organization owns.
function ownWork(kind: TransitionInput["kind"], actor: UserRow, ctx: TransitionContext): boolean {
  if (kind === "project") return ctx.memberIds.includes(actor.id);
  return ctx.posting.author_id === actor.id || (!!ctx.orgId && actor.org_id === ctx.orgId);
}

export async function transition(env: Env, actor: UserRow, input: TransitionInput, hooks: Record<string, Hooks>): Promise<TransitionResult> {
  const transitions = MACHINES[input.kind].transitions as Record<string, TransitionDef<string>>;
  const def = Object.hasOwn(transitions, input.name) ? transitions[input.name] : undefined;
  if (!def) return { ok: false, error: "unknown-transition" };

  const ctx = await loadContext(env, actor, input);
  if (!ctx) return { ok: false, error: "not-found" };
  const current = input.kind === "project" ? ctx.project!.status : ctx.posting.status;
  if (!def.from.includes(current)) return { ok: false, error: "state" };

  if (!authorized(def, actor, ctx)) return { ok: false, error: "forbidden" };
  if (GATES[input.kind].includes(input.name) && ownWork(input.kind, actor, ctx)) return { ok: false, error: "own-project" };
  if (def.feedback === "required" && !input.feedback?.trim()) return { ok: false, error: "feedback" };

  const hook = Object.hasOwn(hooks, input.name) ? hooks[input.name] : undefined;
  if (hook?.guard) {
    const refused = await hook.guard(ctx, input);
    if (refused) return { ok: false, ...(typeof refused === "string" ? { error: refused } : refused) };
  }

  const at = now();
  const effects: Awaited<ReturnType<Hooks["effects"]>> = hook ? await hook.effects(ctx, input, at) : { stmts: [], notify: [] };

  // The lock: alone, first. See the comment at the top of the file. A
  // restoring move (reopen) goes back to the status the row left.
  const table = TABLE[input.kind];
  const target = def.restore ? (ctx.project?.withdrawn_from ?? def.to) : def.to;
  const moved = await env.DB.prepare(`UPDATE ${table} SET status = ?, updated_at = ? WHERE id = ? AND status IN (${marks(def.from.length)})`)
    .bind(target, at, input.id, ...def.from)
    .run();
  if (moved.meta.changes === 0) return { ok: false, error: "state" };

  const stmts = [...effects.stmts];
  emit(env, stmts, {
    type: def.event,
    actor,
    subject: { kind: input.kind, id: input.id },
    postingId: ctx.posting.id,
    projectId: ctx.project?.id,
    orgId: ctx.orgId ?? undefined,
    payload: effects.payload,
    notify: effects.notify,
  });
  try {
    await env.DB.batch(stmts);
  } catch (err) {
    console.error("transition effects failed", input.kind, input.id, input.name, err);
    // Put the row back, unless someone has moved it on since.
    try {
      await env.DB.prepare(`UPDATE ${table} SET status = ?, updated_at = ? WHERE id = ? AND status = ?`)
        .bind(current, at, input.id, target)
        .run();
    } catch {
      throw err;
    }
    return { ok: false, error: "effects" };
  }
  if (effects.after) {
    try {
      await effects.after();
    } catch (err) {
      console.error("transition after failed", input.kind, input.id, input.name, err);
    }
  }
  return { ok: true, status: target };
}
