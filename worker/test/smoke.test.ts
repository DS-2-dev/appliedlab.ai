import { describe, it, expect } from "vitest";
import { makeEnv, applyMigrations, signIn, call } from "./helpers";

describe("harness", () => {
  it("signs in a member and reads /me", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const { token } = await signIn(env, "sam@mail.weber.edu", "Sam");
    const res = await call(env, token, "GET", "/me");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { user: { role: string } }).user.role).toBe("member");
  });
});
