import { describe, it, expect } from "vitest";
import { call } from "./helpers";
import { seedCourt } from "./court-seed";

type Shell = {
  court: number;
  reviews: number;
  unread: number;
  requests: number;
  notifications: Array<{ id: string; title: string; read: boolean; court: boolean; createdAt: string }>;
};
const shell = async (env: Parameters<typeof call>[0], token: string) => {
  const res = await call(env, token, "GET", "/shell");
  expect(res.status).toBe(200);
  return (await res.json()) as Shell;
};

describe("shell", () => {
  it("counts the court, the reviews, the requests and the unread", async () => {
    const { env, dana, rep, maya, nobody, admin } = await seedCourt();
    expect(await shell(env, maya.token)).toMatchObject({ court: 1, reviews: 0, requests: 0, unread: 0, notifications: [] });
    expect(await shell(env, nobody.token)).toMatchObject({ court: 0, reviews: 0, requests: 0 });
    // dana: Q_fresh and Q_old, P_ret and PR_del are actions; P_draft is work.
    expect(await shell(env, dana.token)).toMatchObject({ court: 4, reviews: 0, requests: 2 });
    // rep: the review and the meeting.
    expect(await shell(env, rep.token)).toMatchObject({ court: 2, reviews: 1, requests: 0 });
    // admin: review, meeting, three pending partners, two stale requests (Q_old, Q_orphan).
    expect(await shell(env, admin.token)).toMatchObject({ court: 1 + 1 + 4 + 2, reviews: 1, requests: 2 });
  });

  it("only counts open reviews at the four gates", async () => {
    const { env, rep } = await seedCourt();
    await env.DB.prepare("INSERT INTO reviews (id, gate, subject_id, round, status, opened_at) VALUES ('R2', 'posting', 'P_draft', 1, 'open', '2026-09-20T00:00:00.000Z')").run();
    await env.DB.prepare("INSERT INTO reviews (id, gate, subject_id, round, status, opened_at) VALUES ('R3', 'submission', 'PR_rev', 1, 'approved', '2026-09-20T00:00:00.000Z')").run();
    expect((await shell(env, rep.token)).reviews).toBe(2);
  });

  it("returns the 12 newest notifications and the unread count", async () => {
    const { env, maya } = await seedCourt();
    const rows = Array.from({ length: 15 }, (_, i) =>
      env.DB.prepare(
        "INSERT INTO notifications (id, user_id, kind, title, href, court, read_at, created_at) VALUES (?, ?, 'x', ?, '/projectum', 0, ?, ?)",
      ).bind(`n${i}`, maya.user.id, `Note ${i}`, i < 3 ? "2026-10-01T00:00:00.000Z" : null, `2026-09-${String(10 + i).padStart(2, "0")}T00:00:00.000Z`),
    );
    await env.DB.batch(rows);
    const s = await shell(env, maya.token);
    expect(s.unread).toBe(12);
    expect(s.notifications).toHaveLength(12);
    expect(s.notifications[0]).toMatchObject({ id: "n14", title: "Note 14", read: false, court: false });
    expect(s.notifications[11].id).toBe("n3");
  });
});
