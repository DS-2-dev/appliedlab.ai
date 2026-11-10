// The managed categories (disciplines now, tags later) that postings and
// projects are filed under. Read-only here; the rows live in the taxonomy
// table (migration 0010). Anyone signed in reads the active terms; Admins
// add, rename, describe, reorder and archive them. A slug is made once, from
// the name, and never changes, so old postings keep their links.

import { isAdmin, type AccountEnv, type Json, type UserRow } from "./accounts";

interface TermRow {
  slug: string;
  name: string;
}

async function active(env: AccountEnv, kind: "discipline" | "tag"): Promise<TermRow[]> {
  const { results } = await env.DB.prepare(
    "SELECT slug, name FROM taxonomy WHERE kind = ? AND active = 1 ORDER BY position, name",
  )
    .bind(kind)
    .all<TermRow>();
  return results;
}

// For checking a submitted discipline against the live list.
export async function activeDisciplineSlugs(env: AccountEnv): Promise<string[]> {
  return (await active(env, "discipline")).map((t) => t.slug);
}

interface TermFull {
  id: string;
  kind: "discipline" | "tag";
  slug: string;
  name: string;
  description: string;
  active: number;
  position: number;
}

const toTerm = (r: TermFull) => ({ ...r, active: Boolean(r.active) });

async function allTerms(env: AccountEnv, kind: "discipline" | "tag") {
  const { results } = await env.DB.prepare(
    "SELECT id, kind, slug, name, description, active, position FROM taxonomy WHERE kind = ? ORDER BY position, name",
  )
    .bind(kind)
    .all<TermFull>();
  return results.map(toTerm);
}

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim().length <= max ? v.trim() : null);

async function addTerm(req: Request, env: AccountEnv, json: Json): Promise<Response> {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return json({ error: "body" }, 400);
  if (b.kind !== "discipline" && b.kind !== "tag") return json({ error: "kind" }, 400);
  const name = text(b.name, 60);
  const slug = name ? slugOf(name) : "";
  if (!name || !slug) return json({ error: "name" }, 400);
  const description = b.description === undefined ? "" : text(b.description, 300);
  if (description === null) return json({ error: "description" }, 400);
  const id = `${b.kind === "tag" ? "t" : "d"}_${crypto.randomUUID()}`;
  try {
    await env.DB.prepare(
      "INSERT INTO taxonomy (id, kind, name, slug, description, position, created_at) " +
        "VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM taxonomy WHERE kind = ?), ?)",
    )
      .bind(id, b.kind, name, slug, description, b.kind, new Date().toISOString())
      .run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e))) return json({ error: "slug" }, 409);
    throw e;
  }
  const term = await env.DB.prepare("SELECT id, kind, slug, name, description, active, position FROM taxonomy WHERE id = ?")
    .bind(id)
    .first<TermFull>();
  return json({ term: toTerm(term!) }, 201);
}

async function editTerm(req: Request, env: AccountEnv, id: string, json: Json): Promise<Response> {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return json({ error: "body" }, 400);
  const row = await env.DB.prepare("SELECT id FROM taxonomy WHERE id = ?").bind(id).first();
  if (!row) return json({ error: "not-found" }, 404);
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if ("name" in b) {
    const name = text(b.name, 60);
    if (!name) return json({ error: "name" }, 400);
    sets.push("name = ?");
    values.push(name);
  }
  if ("description" in b) {
    const description = text(b.description, 300);
    if (description === null) return json({ error: "description" }, 400);
    sets.push("description = ?");
    values.push(description);
  }
  if ("position" in b) {
    if (typeof b.position !== "number" || !Number.isFinite(b.position)) return json({ error: "position" }, 400);
    sets.push("position = ?");
    values.push(b.position);
  }
  if ("active" in b) {
    if (typeof b.active !== "boolean") return json({ error: "active" }, 400);
    sets.push("active = ?");
    values.push(b.active ? 1 : 0);
  }
  if (sets.length) await env.DB.prepare(`UPDATE taxonomy SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
  const term = await env.DB.prepare("SELECT id, kind, slug, name, description, active, position FROM taxonomy WHERE id = ?")
    .bind(id)
    .first<TermFull>();
  return json({ term: toTerm(term!) });
}

// GET /taxonomy for any signed-in active user (an Admin adds ?all=1 for the
// archived terms too, in full), and the Admin routes POST /taxonomy and
// PATCH /taxonomy/:id. Returns null for any other path, so the caller can
// route it elsewhere.
export async function handleTaxonomy(
  req: Request,
  env: AccountEnv,
  user: UserRow,
  json: Json,
): Promise<Response | null> {
  const url = new URL(req.url);
  const one = /^\/taxonomy\/([^/]+)$/.exec(url.pathname);
  if (url.pathname !== "/taxonomy" && !one) return null;
  if (req.method === "GET" && !one) {
    if (url.searchParams.get("all") === "1" && isAdmin(env, user)) {
      const [disciplines, tags] = await Promise.all([allTerms(env, "discipline"), allTerms(env, "tag")]);
      return json({ disciplines, tags });
    }
    const [disciplines, tags] = await Promise.all([active(env, "discipline"), active(env, "tag")]);
    // Archived terms, for naming old postings only; pickers use the lists above.
    const { results: retired } = await env.DB.prepare(
      "SELECT slug, name, kind FROM taxonomy WHERE active = 0 ORDER BY position, name",
    ).all<TermRow & { kind: string }>();
    return json({ disciplines, tags, retired });
  }
  const method = one ? "PATCH" : "POST";
  if (req.method !== method) return json({ error: "method" }, 405);
  if (!isAdmin(env, user)) return json({ error: "forbidden" }, 403);
  return one ? editTerm(req, env, decodeURIComponent(one[1]), json) : addTerm(req, env, json);
}
