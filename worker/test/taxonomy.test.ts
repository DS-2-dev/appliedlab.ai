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
