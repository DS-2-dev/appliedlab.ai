import { afterEach, expect, it, vi } from "vitest";
import { handleGoogle } from "../src/google-auth";
import { applyMigrations, call, makeEnv, signIn } from "./helpers";

afterEach(() => { vi.restoreAllMocks(); });

it("consumes one email code once across simultaneous sign-ins", async () => {
  const env = makeEnv();
  await applyMigrations(env.DB);
  const email = "code-once@mail.weber.edu";
  await signIn(env, email, "Test Member");
  const start = await call(env, null, "POST", "/auth/start", { email });
  const { devCode: code } = await start.json<{ devCode: string }>();
  const results = await Promise.all([1, 2].map(() => call(env, null, "POST", "/auth/verify", { email, code })));
  expect(results.map(r => r.status).sort()).toEqual([200, 400]);
});

it("invalidates undelivered codes and keeps their contents out of diagnostics", async () => {
  const env = { ...makeEnv(), RESEND_API_KEY: "test" };
  await applyMigrations(env.DB);
  const email = "delivery@mail.weber.edu";
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  let message = "";
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    message = JSON.parse(String(init?.body)).text;
    return new Response(message, { status: 503 });
  });
  expect((await call(env, null, "POST", "/auth/start", { email })).status).toBe(503);
  expect(await env.DB.prepare("SELECT email FROM login_codes WHERE email = ?").bind(email).first()).toBeNull();
  const code = message.match(/\b\d{6}\b/)?.[0];
  expect(code).toBeTruthy();
  expect(log.mock.calls.flat().join(" ")).not.toContain(code!);
});

it("requires mailbox proof on first Google link and recognizes only the linked subject afterward", async () => {
  const base = makeEnv();
  await applyMigrations(base.DB);
  const email = "google-link@mail.weber.edu";
  const member = await signIn(base, email, "Existing Member");
  const env = { ...base, GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "test", RESEND_API_KEY: "test" };
  const origin = env.SITE_URL;
  let subject = "provider-account-one";
  let message = "";
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    if (String(url) === "https://oauth2.googleapis.com/token") {
      const claims = { sub: subject, iss: "https://accounts.google.com", aud: "client", email, email_verified: true, exp: Date.now() / 1000 + 300 };
      return Response.json({ id_token: "header." + btoa(JSON.stringify(claims)) + ".signature" });
    }
    expect(String(url)).toBe("https://api.resend.com/emails");
    message = JSON.parse(String(init?.body)).text;
    return Response.json({ id: "sent" });
  });

  async function callback() {
    const start = await handleGoogle(new Request(origin + "/auth/google/start?" + new URLSearchParams({
      origin, nonce: "nonce-for-this-test-browser",
    })), env);
    const state = new URL(start!.headers.get("location")!).searchParams.get("state")!;
    const cookie = start!.headers.get("set-cookie")!.split(";")[0];
    const req = new Request(origin + "/auth/google/callback?" + new URLSearchParams({ state, code: "test" }), { headers: { cookie } });
    return { cookie, response: (await handleGoogle(req, env))! };
  }

  const first = await callback();
  expect(first.response.status).toBe(200);
  expect(first.response.headers.has("location")).toBe(false);
  const proof = message.match(/Google: ([\w-]{22})/)![1];
  const confirm = async (cookie: string) => (await handleGoogle(new Request(origin + "/auth/google/confirm", {
    method: "POST", headers: { cookie, origin }, body: new URLSearchParams({ proof }),
  }), env))!;
  expect((await confirm("g_nonce=other-browser")).status).toBe(400);
  expect((await confirm(first.cookie)).headers.get("location")).toContain("#token=");
  expect((await confirm(first.cookie)).status).toBe(400);
  expect(await env.DB.prepare("SELECT google_subject FROM users WHERE id = ?").bind(member.user.id).first())
    .toEqual({ google_subject: subject });
  expect((await callback()).response.headers.get("location")).toContain("#token=");
  subject = "different-provider-account";
  expect((await callback()).response.headers.get("location")).toContain("error=google-failed");
});
