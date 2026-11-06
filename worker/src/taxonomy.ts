// The managed categories (disciplines now, tags later) that postings and
// projects are filed under. Read-only here; the rows live in the taxonomy
// table (migration 0010).

import type { AccountEnv, Json, UserRow } from "./accounts";

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

// GET /taxonomy, for any signed-in active user. Returns null for any other
// path, so the caller can route it elsewhere.
export async function handleTaxonomy(
  req: Request,
  env: AccountEnv,
  _user: UserRow,
  json: Json,
): Promise<Response | null> {
  if (new URL(req.url).pathname !== "/taxonomy") return null;
  if (req.method !== "GET") return json({ error: "method" }, 405);
  const [disciplines, tags] = await Promise.all([active(env, "discipline"), active(env, "tag")]);
  return json({ disciplines, tags });
}
