// Organizations: a partner belongs to one, and one account is its primary.
// A partner signing up at a company's domain asks the primary to let them in;
// anyone else is approved by an admin, who makes them an org of their own.
// Everything else the primary does (edit, hand over, remove) is here too.

import { PERSONAL_DOMAINS, emailDomain } from "@/lib/email-rules";
import { cleanLine, cleanText } from "@/lib/problems";
import { type AccountEnv, type Json, type UserRow, handleFor, hasRole, isAdmin, isStaff, sendEmail } from "./accounts";
import { now, uuid } from "./db";
import { adminIds, emit, orgPrimaryOrAdmins, orgUserIds } from "./events";

export interface OrgRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  domain: string;
  industry: string;
  location: string;
  website: string;
  description: string;
  is_public: number;
  showcase_consent_default: number;
  primary_user_id: string | null;
  join_domain: number;
  created_at: string;
}

const ORG_COLS =
  "id, slug, name, kind, domain, industry, location, website, description, is_public, showcase_consent_default, primary_user_id, join_domain, created_at";

type Who = Pick<UserRow, "id" | "email" | "name" | "org_id">;

async function orgById(env: AccountEnv, id: string): Promise<OrgRow | null> {
  return env.DB.prepare(`SELECT ${ORG_COLS} FROM orgs WHERE id = ?`).bind(id).first<OrgRow>();
}

// The organization that owns a work domain. Personal domains (gmail.com and
// the like) belong to no one.
export async function orgForDomain(env: AccountEnv, domain: string): Promise<OrgRow | null> {
  const d = domain.trim().toLowerCase();
  if (!d || PERSONAL_DOMAINS.includes(d)) return null;
  return env.DB.prepare(`SELECT ${ORG_COLS} FROM orgs WHERE domain = ? ORDER BY created_at LIMIT 1`).bind(d).first<OrgRow>();
}

async function hasActivePrimary(env: AccountEnv, org: OrgRow): Promise<boolean> {
  if (!org.primary_user_id) return false;
  const row = await env.DB.prepare("SELECT 1 AS ok FROM users WHERE id = ? AND status = 'active'").bind(org.primary_user_id).first();
  return Boolean(row);
}

// The user's organization. Without one, they join the one at their domain
// (and take over as primary if it has none), or get a new one with them as
// primary. Writes users.org_id. A user who already has an org with no active
// primary (a partner the migration filed under their domain while still
// pending) takes over as its primary.
export async function ensureOrgFor(env: AccountEnv, user: Who): Promise<OrgRow> {
  if (user.org_id) {
    const own = await orgById(env, user.org_id);
    if (own) {
      if (await hasActivePrimary(env, own)) return own;
      await env.DB.prepare("UPDATE orgs SET primary_user_id = ? WHERE id = ?").bind(user.id, own.id).run();
      return { ...own, primary_user_id: user.id };
    }
  }
  const domain = emailDomain(user.email);
  let org = await orgForDomain(env, domain);
  const stmts: D1PreparedStatement[] = [];
  const takeOver = async (o: OrgRow): Promise<OrgRow> => {
    if (await hasActivePrimary(env, o)) return o;
    stmts.push(env.DB.prepare("UPDATE orgs SET primary_user_id = ? WHERE id = ?").bind(user.id, o.id));
    return { ...o, primary_user_id: user.id };
  };
  if (org) {
    org = await takeOver(org);
  } else {
    const personal = !domain || PERSONAL_DOMAINS.includes(domain);
    const label = domain.split(".")[0] ?? "";
    const fresh: OrgRow = {
      id: uuid(),
      slug: personal ? handleFor(user.name) : domain.replace(/\./g, "-"),
      name: personal ? user.name : label.charAt(0).toUpperCase() + label.slice(1),
      kind: "company",
      domain: personal ? "" : domain,
      industry: "",
      location: "",
      website: "",
      description: "",
      is_public: 1,
      showcase_consent_default: 0,
      primary_user_id: user.id,
      join_domain: 0,
      created_at: now(),
    };
    try {
      await env.DB.prepare(`INSERT INTO orgs (${ORG_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          fresh.id, fresh.slug, fresh.name, fresh.kind, fresh.domain, fresh.industry, fresh.location, fresh.website,
          fresh.description, fresh.is_public, fresh.showcase_consent_default, fresh.primary_user_id, fresh.join_domain, fresh.created_at,
        )
        .run();
      org = fresh;
    } catch (e) {
      // Two approvals for one new domain at once: use the org the other made.
      const again = await orgForDomain(env, domain);
      if (!again) throw e;
      org = await takeOver(again);
    }
  }
  stmts.push(
    env.DB.prepare("UPDATE users SET org_id = ? WHERE id = ?").bind(org.id, user.id),
    // A join request they had open is settled by being let in.
    env.DB.prepare("UPDATE org_requests SET status = 'cancelled', decided_at = ? WHERE user_id = ? AND status = 'pending'").bind(now(), user.id),
  );
  await env.DB.batch(stmts);
  return org;
}

// Queues a pending join request and the court notification for whoever
// decides it: the org's primary, or every admin when it has none. The caller
// runs the batch, then `after()` (the email).
async function queueJoinRequest(
  env: AccountEnv,
  stmts: D1PreparedStatement[],
  user: UserRow,
  org: OrgRow,
  message: string,
): Promise<{ after: () => Promise<void> }> {
  const id = uuid();
  const who = await orgPrimaryOrAdmins(env, org.id);
  stmts.push(
    env.DB.prepare("INSERT INTO org_requests (id, org_id, user_id, status, message, created_at) VALUES (?, ?, ?, 'pending', ?, ?)").bind(
      id, org.id, user.id, message, now(),
    ),
  );
  emit(env, stmts, {
    type: "org.join_requested",
    actor: user,
    subject: { kind: "org", id: org.id },
    orgId: org.id,
    payload: { requestId: id, userId: user.id },
    notify: [{ userIds: who, court: true, title: `${user.name} asked to join ${org.name}`, href: "/projectum?view=org" }],
  });
  return {
    after: async () => {
      for (const to of who) {
        const r = await env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(to).first<{ email: string }>();
        if (!r) continue;
        await sendEmail(
          env,
          r.email,
          `${user.name} asked to join ${org.name} on Projectum`,
          `${user.name} (${user.email}) asked to join ${org.name}.${message ? `\n\nThey wrote: ${message}` : ""}\n\nApprove or decline in Projectum:\n${env.SITE_URL}/projectum?view=org\n\nApplied AI Lab, Weber State University`,
        );
      }
    },
  };
}

// A partner signing up at a domain whose org already has a primary asks that
// primary to let them in. Returns null (and queues nothing) otherwise, so the
// admin approves them as before.
export async function onPartnerSignUp(
  env: AccountEnv,
  stmts: D1PreparedStatement[],
  user: UserRow,
): Promise<{ after: () => Promise<void> } | null> {
  if (user.role !== "partner") return null;
  const org = await orgForDomain(env, emailDomain(user.email));
  if (!org || !(await hasActivePrimary(env, org))) return null;
  return queueJoinRequest(env, stmts, user, org, "");
}

// The admins' bell for a partner or faculty member who needs the Lab's approval.
export async function notifyAdminsOfPending(env: AccountEnv, stmts: D1PreparedStatement[], user: UserRow): Promise<void> {
  emit(env, stmts, {
    type: "account.pending",
    actor: user,
    subject: { kind: "user", id: user.id },
    payload: {},
    notify: [
      { userIds: await adminIds(env), court: true, title: `${user.name} signed up as ${user.role === "rep" ? "faculty" : "a business"} and is waiting for approval`, href: "/projectum?view=overview" },
    ],
  });
}

// --- Endpoints ---------------------------------------------------------------

const LIMITS = { name: 100, industry: 100, location: 100, website: 200, description: 2000, message: 500, note: 300 };

function orgOut(o: OrgRow) {
  return {
    id: o.id,
    slug: o.slug,
    name: o.name,
    kind: o.kind,
    domain: o.domain,
    industry: o.industry,
    location: o.location,
    website: o.website,
    description: o.description,
    isPublic: Boolean(o.is_public),
    showcaseConsentDefault: Boolean(o.showcase_consent_default),
    primaryUserId: o.primary_user_id,
  };
}

type RequestRow = { id: string; message: string; created_at: string; uid: string; name: string; email: string };

async function view(env: AccountEnv, org: OrgRow, withRequests: boolean) {
  const people = await env.DB.prepare("SELECT id, name, email FROM users WHERE org_id = ? AND status = 'active' ORDER BY name COLLATE NOCASE")
    .bind(org.id)
    .all<{ id: string; name: string; email: string }>();
  const requests = withRequests
    ? (
        await env.DB.prepare(
          "SELECT r.id, r.message, r.created_at, u.id AS uid, u.name, u.email FROM org_requests r JOIN users u ON u.id = r.user_id " +
            "WHERE r.org_id = ? AND r.status = 'pending' ORDER BY r.created_at",
        )
          .bind(org.id)
          .all<RequestRow>()
      ).results
    : [];
  return {
    org: orgOut(org),
    people: people.results.map((p) => ({ ...p, primary: p.id === org.primary_user_id })),
    requests: requests.map((r) => ({
      id: r.id,
      user: { id: r.uid, name: r.name, email: r.email },
      message: r.message,
      createdAt: r.created_at,
    })),
  };
}

const canManage = (env: AccountEnv, user: UserRow, org: OrgRow) => isAdmin(env, user) || org.primary_user_id === user.id;

async function body(req: Request): Promise<Record<string, unknown>> {
  const b = (await req.json().catch(() => null)) as unknown;
  return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
}

// The caller's own org. An admin may name another with ?org=<id>.
async function mine(env: AccountEnv, user: UserRow, req?: Request): Promise<OrgRow | null> {
  const other = req && isAdmin(env, user) ? new URL(req.url).searchParams.get("org") : null;
  if (other) return orgById(env, other);
  return user.org_id ? orgById(env, user.org_id) : null;
}

async function patchOrg(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  const org = await mine(env, user, req);
  if (!org) return json({ error: "no-org" }, 404);
  if (!canManage(env, user, org)) return json({ error: "forbidden" }, 403);
  const b = await body(req);
  const next = { ...org };
  // Too long is refused, not cut short.
  for (const [key, max] of [["name", LIMITS.name], ["industry", LIMITS.industry], ["location", LIMITS.location], ["website", LIMITS.website]] as const) {
    if (!(key in b)) continue;
    if (typeof b[key] !== "string") return json({ error: key }, 400);
    const clean = cleanLine(b[key], max + 1);
    if (clean.length > max) return json({ error: key }, 400);
    next[key] = clean;
  }
  if (!next.name) return json({ error: "name" }, 400);
  if (next.website && !/^https?:\/\/\S+$/i.test(next.website)) return json({ error: "website" }, 400);
  if ("description" in b) {
    if (typeof b.description !== "string") return json({ error: "description" }, 400);
    const d = cleanText(b.description, LIMITS.description + 1);
    if (d.length > LIMITS.description) return json({ error: "description" }, 400);
    next.description = d;
  }
  for (const [key, col] of [["isPublic", "is_public"], ["showcaseConsentDefault", "showcase_consent_default"]] as const) {
    if (!(key in b)) continue;
    if (typeof b[key] !== "boolean") return json({ error: key }, 400);
    next[col] = b[key] ? 1 : 0;
  }
  await env.DB.prepare(
    "UPDATE orgs SET name = ?, industry = ?, location = ?, website = ?, description = ?, is_public = ?, showcase_consent_default = ? WHERE id = ?",
  )
    .bind(next.name, next.industry, next.location, next.website, next.description, next.is_public, next.showcase_consent_default, org.id)
    .run();
  return json({ org: orgOut(next) });
}

async function decide(req: Request, env: AccountEnv, user: UserRow, requestId: string, approve: boolean, json: Json): Promise<Response> {
  const r = await env.DB.prepare("SELECT id, org_id, user_id FROM org_requests WHERE id = ?")
    .bind(requestId)
    .first<{ id: string; org_id: string; user_id: string }>();
  if (!r) return json({ error: "not-found" }, 404);
  const org = await orgById(env, r.org_id);
  if (!org) return json({ error: "not-found" }, 404);
  if (!canManage(env, user, org)) return json({ error: "forbidden" }, 403);
  const note = cleanLine((await body(req)).note, LIMITS.note);
  const person = await env.DB.prepare("SELECT email, name, status, org_id FROM users WHERE id = ?")
    .bind(r.user_id)
    .first<{ email: string; name: string; status: string; org_id: string | null }>();
  if (approve && person?.status === "removed") return json({ error: "removed" }, 409);
  if (approve && person?.org_id && person.org_id !== org.id) return json({ error: "has-org" }, 409);
  // Only one decision wins.
  const won = await env.DB.prepare(
    "UPDATE org_requests SET status = ?, decided_at = ?, decided_by = ?, note = ? WHERE id = ? AND status = 'pending'",
  )
    .bind(approve ? "approved" : "declined", now(), user.id, note, r.id)
    .run();
  if (!won.meta.changes) return json({ error: "decided" }, 409);

  const stmts: D1PreparedStatement[] = [];
  if (approve) {
    // A pending account becomes active.
    stmts.push(
      env.DB.prepare("UPDATE users SET org_id = ?, status = CASE WHEN status = 'pending' THEN 'active' ELSE status END WHERE id = ?").bind(
        org.id, r.user_id,
      ),
    );
    emit(env, stmts, {
      type: "org.join_approved",
      actor: user,
      subject: { kind: "org", id: org.id },
      orgId: org.id,
      payload: { requestId: r.id, userId: r.user_id },
      notify: [{ userIds: [r.user_id], title: `${org.name} approved your request to join`, href: "/projectum" }],
    });
    if (person?.status === "pending") {
      emit(env, stmts, {
        type: "account.approved",
        actor: user,
        subject: { kind: "user", id: r.user_id },
        orgId: org.id,
        payload: {},
        notify: [],
      });
    }
  } else {
    emit(env, stmts, {
      type: "org.join_declined",
      actor: user,
      subject: { kind: "org", id: org.id },
      orgId: org.id,
      payload: { requestId: r.id, userId: r.user_id },
      notify: [{ userIds: [r.user_id], title: `${org.name} declined your request to join${note ? `: ${note}` : ""}`, href: "/projectum" }],
    });
  }
  try {
    await env.DB.batch(stmts);
  } catch (e) {
    // The batch rolled back, so put the request back for another try.
    await env.DB.prepare("UPDATE org_requests SET status = 'pending', decided_at = NULL, decided_by = NULL, note = '' WHERE id = ?").bind(r.id).run();
    throw e;
  }
  if (person) {
    await sendEmail(
      env,
      person.email,
      approve ? `You joined ${org.name} on Projectum` : `Your request to join ${org.name}`,
      approve
        ? `Hi ${person.name},\n\n${org.name} approved your request. Log in to get started:\n${env.SITE_URL}/login\n\nApplied AI Lab, Weber State University`
        : `Hi ${person.name},\n\n${org.name} declined your request to join.${note ? `\n\nNote: ${note}` : ""}\n\nApplied AI Lab, Weber State University`,
    );
  }
  return json({ ok: true });
}

// A partner with no org asks to join the one at their domain, for example
// after being removed from it.
async function requestJoin(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  if (!hasRole(env, user, "partner")) return json({ error: "forbidden" }, 403);
  if (user.org_id) return json({ error: "has-org" }, 409);
  const org = await orgForDomain(env, emailDomain(user.email));
  if (!org) return json({ error: "no-org" }, 404);
  const message = cleanText((await body(req)).message, LIMITS.message);
  const stmts: D1PreparedStatement[] = [];
  const queued = await queueJoinRequest(env, stmts, user, org, message);
  try {
    await env.DB.batch(stmts);
  } catch (e) {
    if (e instanceof Error && /UNIQUE/.test(e.message)) return json({ error: "pending" }, 409);
    throw e;
  }
  await queued.after();
  return json({ ok: true }, 201);
}

async function transfer(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  const org = await mine(env, user, req);
  if (!org) return json({ error: "no-org" }, 404);
  if (!canManage(env, user, org)) return json({ error: "forbidden" }, 403);
  const userId = (await body(req)).userId;
  if (typeof userId !== "string" || userId === org.primary_user_id) return json({ error: "user" }, 400);
  const target = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND org_id = ? AND status = 'active' AND role = 'partner'")
    .bind(userId, org.id)
    .first();
  if (!target) return json({ error: "not-member" }, 400);
  const stmts = [env.DB.prepare("UPDATE orgs SET primary_user_id = ? WHERE id = ?").bind(userId, org.id)];
  emit(env, stmts, {
    type: "org.primary_transferred",
    actor: user,
    subject: { kind: "org", id: org.id },
    orgId: org.id,
    payload: { to: userId },
    notify: [{ userIds: await orgUserIds(env, org.id), title: `${org.name} has a new primary contact`, href: "/projectum?view=org" }],
  });
  await env.DB.batch(stmts);
  return json({ ok: true });
}

async function removeMember(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  const org = await mine(env, user, req);
  if (!org) return json({ error: "no-org" }, 404);
  if (!canManage(env, user, org)) return json({ error: "forbidden" }, 403);
  const userId = (await body(req)).userId;
  if (typeof userId !== "string") return json({ error: "user" }, 400);
  if (userId === org.primary_user_id) return json({ error: "primary" }, 400);
  const target = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND org_id = ?").bind(userId, org.id).first();
  if (!target) return json({ error: "not-member" }, 400);
  const others = (await orgUserIds(env, org.id)).filter((id) => id !== userId);
  const stmts = [env.DB.prepare("UPDATE users SET org_id = NULL WHERE id = ?").bind(userId)];
  emit(env, stmts, {
    type: "org.member_removed",
    actor: user,
    subject: { kind: "org", id: org.id },
    orgId: org.id,
    payload: { userId },
    notify: [
      { userIds: [userId], title: `You were removed from ${org.name}`, href: "/projectum" },
      { userIds: others, title: `Someone was removed from ${org.name}`, href: "/projectum?view=org" },
    ],
  });
  await env.DB.batch(stmts);
  return json({ ok: true });
}

export async function handleOrgs(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (pathname !== "/orgs" && !pathname.startsWith("/orgs/")) return null;
  const m = req.method;
  if (pathname === "/orgs/mine") {
    if (m === "GET") {
      const org = await mine(env, user);
      if (!org) return json({ error: "no-org" }, 404);
      return json(await view(env, org, canManage(env, user, org)));
    }
    if (m === "PATCH") return patchOrg(req, env, user, json);
  }
  if (pathname === "/orgs/mine/transfer" && m === "POST") return transfer(req, env, user, json);
  if (pathname === "/orgs/mine/remove" && m === "POST") return removeMember(req, env, user, json);
  if (pathname === "/orgs/requests" && m === "POST") return requestJoin(req, env, user, json);
  const dec = pathname.match(/^\/orgs\/requests\/([\w-]{1,64})\/(approve|decline)$/);
  if (dec && m === "POST") return decide(req, env, user, dec[1], dec[2] === "approve", json);
  const one = pathname.match(/^\/orgs\/([\w-]{1,64})$/);
  if (one && m === "GET" && one[1] !== "mine" && one[1] !== "requests") {
    if (!isStaff(env, user)) return json({ error: "forbidden" }, 403);
    const org = await orgById(env, one[1]);
    if (!org) return json({ error: "not-found" }, 404);
    return json(await view(env, org, true));
  }
  return json({ error: "not-found" }, 404);
}
