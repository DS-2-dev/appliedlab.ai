import { describe, it, expect } from "vitest";
import { makeEnv, applyMigrations, signIn, call, TEST_PASSWORD } from "./helpers";

type Env = ReturnType<typeof makeEnv>;

const code = async (env: Env, email: string) =>
  ((await (await call(env, null, "POST", "/auth/start", { email })).json()) as { devCode: string }).devCode;

const verify = (env: Env, body: Record<string, unknown>) => call(env, null, "POST", "/auth/verify", body);
const withPassword = (env: Env, email: string, password: string) =>
  call(env, null, "POST", "/auth/password", { email, password });
const check = async (env: Env, email: string) =>
  ((await (await call(env, null, "POST", "/auth/check", { email })).json()) as { password: boolean }).password;

describe("passwords", () => {
  it("a new account sets a password with its first code, then signs in with it", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const email = "sam@mail.weber.edu";
    const c = await code(env, email);
    expect(await (await verify(env, { email, code: c })).json()).toEqual({ needsName: true, needsPassword: true });
    expect(await (await verify(env, { email, code: c, name: "Sam" })).json()).toEqual({ needsPassword: true });
    const short = await verify(env, { email, code: c, name: "Sam", password: "short" });
    expect(short.status).toBe(400);
    expect(await short.json()).toEqual({ error: "password-short" });
    // None of those spent the code.
    const ok = await verify(env, { email, code: c, name: "Sam", password: TEST_PASSWORD });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toHaveProperty("token");

    expect(await check(env, email)).toBe(true);
    const good = await withPassword(env, email, TEST_PASSWORD);
    expect(good.status).toBe(200);
    const { token } = (await good.json()) as { token: string };
    expect((await call(env, token, "GET", "/me")).status).toBe(200);
    const bad = await withPassword(env, email, "not the password");
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "password" });
  });

  it("an account from before passwords is asked for one at its next code sign-in", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const email = "lee@mail.weber.edu";
    await signIn(env, email, "Pat");
    await env.DB.prepare("UPDATE users SET password_hash = NULL WHERE email = ?").bind(email).run();
    expect(await check(env, email)).toBe(false);
    expect((await withPassword(env, email, TEST_PASSWORD)).status).toBe(400);
    const c = await code(env, email);
    expect(await (await verify(env, { email, code: c })).json()).toEqual({ needsPassword: true });
    expect((await verify(env, { email, code: c, password: TEST_PASSWORD })).status).toBe(200);
    expect(await check(env, email)).toBe(true);
  });

  it("a code still signs in an account that has a password", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const email = "ana@mail.weber.edu";
    await signIn(env, email, "Pat");
    const res = await verify(env, { email, code: await code(env, email) });
    expect(await res.json()).toHaveProperty("token");
  });

  it("a reset sets a new password and signs out every other session", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const email = "kai@mail.weber.edu";
    const first = await signIn(env, email, "Pat");
    const c = await code(env, email);
    expect(await (await verify(env, { email, code: c, reset: true })).json()).toEqual({ needsPassword: true });
    const res = await verify(env, { email, code: c, reset: true, password: "a brand new one" });
    const { token } = (await res.json()) as { token: string };
    expect((await call(env, first.token, "GET", "/me")).status).toBe(401);
    expect((await call(env, token, "GET", "/me")).status).toBe(200);
    expect((await withPassword(env, email, TEST_PASSWORD)).status).toBe(400);
    expect((await withPassword(env, email, "a brand new one")).status).toBe(200);
  });

  it("an unknown address has no password and can't sign in with one", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    expect(await check(env, "nobody@mail.weber.edu")).toBe(false);
    expect(await (await withPassword(env, "nobody@mail.weber.edu", TEST_PASSWORD)).json()).toEqual({ error: "password" });
  });

  it("a removed account can't sign in with its password", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const email = "rio@mail.weber.edu";
    await signIn(env, email, "Pat");
    await env.DB.prepare("UPDATE users SET status = 'removed' WHERE email = ?").bind(email).run();
    const res = await withPassword(env, email, TEST_PASSWORD);
    expect(res.status).toBe(403);
  });
});
