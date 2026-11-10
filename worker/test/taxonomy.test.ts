import { describe, it, expect } from "vitest";
import { makeEnv, applyMigrations, signIn, call } from "./helpers";
import { activeDisciplineSlugs } from "../src/taxonomy";

const SEEDED = ["finance", "accounting", "business", "computer-science", "design", "mathematics", "marketing", "other"];

describe("GET /taxonomy", () => {
  it("refuses a signed-out caller", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    expect((await call(env, null, "GET", "/taxonomy")).status).toBe(401);
  });

  it("lists the seeded disciplines in order, other last", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const s = await signIn(env, "sam@mail.weber.edu", "Sam");
    const res = await call(env, s.token, "GET", "/taxonomy");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { disciplines: { slug: string; name: string }[]; tags: unknown[] };
    expect(body.disciplines.map((d) => d.slug)).toEqual(SEEDED);
    expect(body.disciplines[0]).toEqual({ slug: "finance", name: expect.any(String) });
    expect(body.tags).toEqual([]);
    expect(await activeDisciplineSlugs(env)).toEqual(SEEDED);
  });

  it("drops an inactive discipline", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const s = await signIn(env, "sam@mail.weber.edu", "Sam");
    await env.DB.prepare("UPDATE taxonomy SET active = 0 WHERE slug = 'design'").run();
    const body = (await (await call(env, s.token, "GET", "/taxonomy")).json()) as { disciplines: { slug: string }[] };
    expect(body.disciplines.map((d) => d.slug)).toEqual(SEEDED.filter((x) => x !== "design"));
  });
});

type Term = { id: string; kind: string; slug: string; name: string; description: string; active: boolean; position: number };

describe("admin categories", () => {
  const setup = async (member: string) => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    // Tests in a file share one database: back to the seeded terms.
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM taxonomy WHERE id NOT IN (${SEEDED.map(() => "?").join(",")})`).bind(...SEEDED.map((x) => `d_${x}`)),
      env.DB.prepare("UPDATE taxonomy SET active = 1"),
      ...SEEDED.map((x, i) => env.DB.prepare("UPDATE taxonomy SET position = ? WHERE id = ?").bind(i + 1, `d_${x}`)),
    ]);
    const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
    const sam = await signIn(env, member, "Sam");
    return { env, admin, sam };
  };
  const add = async (env: ReturnType<typeof makeEnv>, token: string, body: unknown) => {
    const res = await call(env, token, "POST", "/taxonomy", body);
    return { res, term: ((await res.clone().json()) as { term: Term }).term };
  };
  const slugs = async (env: ReturnType<typeof makeEnv>, token: string) =>
    ((await (await call(env, token, "GET", "/taxonomy")).json()) as { disciplines: { slug: string }[] }).disciplines.map((d) => d.slug);

  it("adds a term with a slug from its name, last in its kind, listed for everyone", async () => {
    const { env, admin, sam } = await setup("tx-add@mail.weber.edu");
    const { res, term } = await add(env, admin.token, { kind: "discipline", name: "  Data  Science! ", description: "Models" });
    expect(res.status).toBe(201);
    expect(term).toMatchObject({ kind: "discipline", slug: "data-science", name: "Data  Science!", description: "Models", active: true, position: 9 });
    expect(await slugs(env, sam.token)).toEqual([...SEEDED, "data-science"]);
    expect((await add(env, admin.token, { kind: "tag", name: "Pricing" })).term.position).toBe(1);
  });

  it("refuses a duplicate slug, an empty one, a bad kind and a long name", async () => {
    const { env, admin } = await setup("tx-bad@mail.weber.edu");
    expect((await add(env, admin.token, { kind: "discipline", name: "design" })).res.status).toBe(409);
    expect(await (await call(env, admin.token, "POST", "/taxonomy", { kind: "discipline", name: "design" })).json()).toEqual({ error: "slug" });
    const empty = await call(env, admin.token, "POST", "/taxonomy", { kind: "discipline", name: "!!!" });
    expect([empty.status, await empty.json()]).toEqual([400, { error: "name" }]);
    expect((await call(env, admin.token, "POST", "/taxonomy", { kind: "x", name: "A" })).status).toBe(400);
    expect((await call(env, admin.token, "POST", "/taxonomy", { kind: "tag", name: "a".repeat(61) })).status).toBe(400);
  });

  it("is the Admin's alone", async () => {
    const { env, sam } = await setup("tx-member@mail.weber.edu");
    expect((await call(env, sam.token, "POST", "/taxonomy", { kind: "tag", name: "Nope" })).status).toBe(403);
    expect((await call(env, sam.token, "PATCH", "/taxonomy/d_design", { name: "Nope" })).status).toBe(403);
    const all = (await (await call(env, sam.token, "GET", "/taxonomy?all=1")).json()) as { disciplines: Record<string, unknown>[] };
    expect(all.disciplines[0]).toEqual({ slug: "finance", name: expect.any(String) });
  });

  it("renames and describes without changing the slug, and validates the patch", async () => {
    const { env, admin } = await setup("tx-rename@mail.weber.edu");
    const res = await call(env, admin.token, "PATCH", "/taxonomy/d_design", { name: "Product Design", description: "Look and feel" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { term: Term }).term).toMatchObject({ slug: "design", name: "Product Design", description: "Look and feel" });
    for (const bad of [{ name: "" }, { description: "x".repeat(301) }, { position: "1" }, { position: null }, { active: "no" }]) {
      expect((await call(env, admin.token, "PATCH", "/taxonomy/d_design", bad)).status).toBe(400);
    }
    expect((await call(env, admin.token, "PATCH", "/taxonomy/nope", { name: "A" })).status).toBe(404);
  });

  it("archives out of the public list and posting create, restores, and reorders", async () => {
    const { env, admin, sam } = await setup("tx-archive@mail.weber.edu");
    expect((await call(env, admin.token, "PATCH", "/taxonomy/d_design", { active: false })).status).toBe(200);
    expect(await slugs(env, sam.token)).not.toContain("design");
    expect(await activeDisciplineSlugs(env)).not.toContain("design");
    const all = (await (await call(env, admin.token, "GET", "/taxonomy?all=1")).json()) as { disciplines: Term[] };
    expect(all.disciplines.find((d) => d.slug === "design")).toMatchObject({ active: false });
    const pub = (await (await call(env, sam.token, "GET", "/taxonomy")).json()) as { retired: unknown[] };
    expect(pub.retired).toEqual([{ slug: "design", name: expect.any(String), kind: "discipline" }]);
    await call(env, admin.token, "PATCH", "/taxonomy/d_design", { active: true });
    expect(await slugs(env, sam.token)).toContain("design");
    await call(env, admin.token, "PATCH", "/taxonomy/d_other", { position: 0 });
    expect((await slugs(env, sam.token))[0]).toBe("other");
  });
});

describe("PATCH /me interests", () => {
  const stored = async (env: Awaited<ReturnType<typeof makeEnv>>, email: string) =>
    (await env.DB.prepare("SELECT interests FROM users WHERE email = ?").bind(email).first<{ interests: string }>())?.interests;

  it("keeps a member's active disciplines once each, drops the rest, and returns them", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const s = await signIn(env, "sam@mail.weber.edu", "Sam");
    await env.DB.prepare("UPDATE taxonomy SET active = 0 WHERE slug = 'design'").run();
    const res = await call(env, s.token, "PATCH", "/me", { interests: ["finance", "design", "nope", 7, "finance", "marketing"] });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { user: { interests: string[] } }).user.interests).toEqual(["finance", "marketing"]);
    expect(await stored(env, "sam@mail.weber.edu")).toBe('["finance","marketing"]');
    expect((await call(env, s.token, "PATCH", "/me", { interests: [] })).status).toBe(200);
    expect(await stored(env, "sam@mail.weber.edu")).toBe("[]");
  });

  it("refuses a list that is not a list, and a partner", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const s = await signIn(env, "sam@mail.weber.edu", "Sam");
    expect((await call(env, s.token, "PATCH", "/me", { interests: "finance" })).status).toBe(400);
    const p = await signIn(env, "dana@kestrel.example", "Dana");
    expect((await call(env, p.token, "PATCH", "/me", { interests: ["finance"] })).status).toBe(400);
  });
});
