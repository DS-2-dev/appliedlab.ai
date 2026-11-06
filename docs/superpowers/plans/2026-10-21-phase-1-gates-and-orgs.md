# Phase 1: Gates and Orgs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Projectum Gantry's pipeline backbone: four roles, organizations, postings with a review gate, projects with Gantry's statuses and a rounds-based action-plan gate, a reviews queue, "in your court", hand-off dialogs, and a migration that carries every current row forward.

**Architecture:** One shared, pure-data machine (`src/lib/pipeline/`) is imported by both the static site and the Worker. The Worker gets one `transition()` that authorizes, guards, writes a `db.batch()` and emits events plus notifications; every status change goes through it. The site adds a polled `/shell` store for counts and new views on the existing `/projectum` shell. D1 tables are rebuilt in dependency order (children first on drop) because D1 cannot turn foreign-key enforcement off.

**Tech Stack:** Next.js static export (site), Cloudflare Worker + D1 + KV (backend), `node:test` for site logic, Vitest with `@cloudflare/vitest-pool-workers` for the Worker, Resend for email.

**Spec:** `docs/superpowers/specs/2026-10-21-projectum-aggregate-design.md` (sections 5, 6.1 to 6.6, 6.10 phase 1, 6.11). Appendix A is the current code; Appendix B section 1a, 1b, 1f, 7 and the court rules are the behavior to match. Kylar's source is at `/private/tmp/claude-501/-Users-dantesmith-project-website-site/3762158d-ff54-475b-8169-de6dce4c5a34/scratchpad/platform-v2/src` (also `git show kylar/platform-v2:src/...` from `~/project`): copy its `lib/engine/machines.ts` posting and project machines and its `lib/engine/handoffs.ts` posting and project entries word for word.

## Global Constraints

- Front end stays a static export (`output: export`, trailing slash). No server components with data, no server actions, no middleware. Everything dynamic is client-side against the Worker.
- Backend is the one Worker in `worker/`, D1 `appliedlab-projectum`, KV `REPORTS`. No new bindings in this phase.
- Auth stays bearer token in `Authorization`, localStorage `projectum:session`, 60-day sessions. No cookies.
- D1 is SQLite: no arrays (JSON text), no `FOR UPDATE`; atomic writes via `db.batch()`; concurrent status changes guarded by `UPDATE ... WHERE id = ? AND status IN (...)` and `meta.changes`.
- Status names, labels, courts and hand-off copy are Gantry's, verbatim (Appendix B, section 1a and 1b). One vocabulary everywhere.
- Every hand-off shows a confirmation with "what happens next"; every return shows the notes and what to do.
- Role from email domain: `weber.edu` rep, `mail.weber.edu` member, else partner. Students stay instant. Admin = `roles` contains `admin` or email in `APPROVERS`/`APPROVER_EMAIL`.
- Every new UI string lives in `src/content/copy.ts` and passes `npm run copy-lint`: no em dashes, no banned words, no prose weekday or clock time.
- `npm run check` in `site/` and `npm run check` and `npm test` in `worker/` pass at every commit. Commit after every task.
- Migration must carry every existing problem, claim, claim member, board, submission, meeting, selection, user and notification forward. A dry run against a remote export is part of Task 3 and Task 23.
- Projectum is desktop-only. Public pages still work at phone width.

## Review Focus

1. Two reps click "Approve plan" on the same review within a second: exactly one wins, the other sees "already moved on", and the team gets one notification. Test in Task 6 (`transition` returns `state` on zero `changes`) and Task 10.
2. A partner whose organization has no primary (all partners removed) submits a join request: it must reach admins, not vanish. Test in Task 8 (`notifyJoinRequest` falls back to admins).
3. A member on a `plan_returned` project opens the board: it must be editable again (plan and milestones), and the rep's notes must be visible on the project page. Test in Task 10 (`boardAccess` for `plan_returned`) and Task 18.
4. A rep who is also on the project team (roles `["member","rep"]`) opens the review: the transition must refuse (`own-project`), and the queue must still list it for other reps. Test in Task 10.
5. Migration on a database where a pending claim has no board, a denied claim exists, and a problem was posted by a rep (no partner org): all three rows land with the mapped status, a board exists for every project, and the rep's posting belongs to the Lab org. Test in Task 3.

---

## File map

Site (`website/site/`):
- Create `src/lib/pipeline/domain.ts`: `Role`, `Court`, `PostingStatus`, `ProjectStatus`, `Level`, status lists, `LEVEL_INFO`, `ROLE_LABEL`.
- Create `src/lib/pipeline/machines.ts`: `postingMachine`, `projectMachine`, `MACHINES`, `stateOf`, `transitionsFrom`, `PROJECT_FLOW`, `projectStage`, `OPEN_PROJECT_STATUSES`, `boardStageFor`.
- Create `src/lib/pipeline/handoffs.ts`: `HANDOFF`, `NEXT_STEPS` for postings and projects.
- Create `src/lib/pipeline/court.ts`: `CourtItem` type and `courtSort`.
- Modify `src/lib/email-rules.ts`: no change to `roleForEmail`; add `PERSONAL_DOMAINS` and `emailDomain()`.
- Modify `src/lib/problems.ts`: `PostingDraft` replaces `ProblemDraft` (adds `disciplines`, `effort`, `tags`), `PlanDraft` replaces `ClaimDraft` minus teammates, `cleanPosting`, `postingIssues`, `cleanPlan`, `planIssues`, `cleanTeammates`.
- Modify `src/lib/account.ts`: `Account` gains `roles`, `admin`, `orgId`, `org`; `approver` removed.
- Create `src/components/projectum/shell-store.ts`: polled `/shell`.
- Create `src/components/projectum/status-pill.tsx`, `stage-bar.tsx`, `handoff-dialog.tsx`, `next-steps.tsx`, `court-list.tsx`, `inbox-view.tsx`, `reviews-view.tsx`, `review-view.tsx`, `org-view.tsx`, `postings-view.tsx`, `posting-view.tsx`, `posting-form.tsx`, `plan-editor.tsx`, `my-projects-view.tsx`, `transition-bar.tsx`.
- Modify `projectum-view.tsx`, `app-sidebar.tsx`, `pipeline-store.ts`, `project-store.ts`, `project-board.tsx`, `all-projects.tsx`, `overview-view.tsx`, `notifications-menu.tsx`, `account-gate.tsx`, `claim-form.tsx` (becomes a thin teammate picker used by claim), `src/content/copy.ts`.
- Delete `problems-view.tsx`, `problem-view.tsx`, `problem-form.tsx`, `claims-view.tsx` once replaced.
- Tests: `scripts/machines.test.mjs`, `scripts/handoffs.test.mjs`, `scripts/court.test.mjs`, `scripts/problems.test.mjs` (extended).

Worker (`website/site/worker/`):
- Create `migrations/0010_gates_and_orgs.sql`.
- Create `scripts/dry-run-migration.sh`.
- Create `src/db.ts` (row types, `now()`, `uuid()`, small SQL helpers), `src/events.ts` (`emit`, `notifyUsers`, `adminIds`, `repIds`, `orgUserIds`, `projectMemberIds`), `src/transition.ts`, `src/orgs.ts`, `src/postings.ts`, `src/projects.ts`, `src/reviews.ts`, `src/court.ts`, `src/shell.ts`, `src/taxonomy.ts`.
- Modify `src/accounts.ts` (roles, admin, org on `publicUser`, `createUser` org hook, approve path), `src/notify.ts` (keep bell handlers; `approverIds` becomes `adminIds` in `events.ts`), `src/pipeline.ts` (shrinks to boards, submissions, phase 2, overview, profile; all SQL on new tables), `src/reminders.ts`, `src/index.ts` (route order), `package.json`, `vitest.config.ts`, `README.md`.
- Tests: `test/helpers.ts`, `test/migration.test.ts`, `test/transition.test.ts`, `test/orgs.test.ts`, `test/postings.test.ts`, `test/projects.test.ts`, `test/reviews.test.ts`, `test/court.test.ts`, `test/shell.test.ts`.

Vocabulary in code from this phase on: **posting** (table `postings`), **project** (table `projects`: the pipeline row, formerly `claims`), **board** (table `boards`: the JSON workspace, formerly `projects`). The site's `Project` TypeScript type in `src/lib/projects.ts` keeps its name; it describes a board.

---

### Task 1: Shared pipeline domain, machines and hand-off copy

**Files:**
- Create: `src/lib/pipeline/domain.ts`, `src/lib/pipeline/machines.ts`, `src/lib/pipeline/handoffs.ts`
- Test: `scripts/machines.test.mjs`, `scripts/handoffs.test.mjs`

**Interfaces:**
- Produces: `type Role = "member" | "partner" | "rep" | "admin"`, `type Court = Role | "none"`, `POSTING_STATUSES`, `PROJECT_STATUSES`, `type PostingStatus`, `type ProjectStatus`, `LEVELS`, `type Level`, `LEVEL_INFO`, `ROLE_LABEL`.
- Produces: `type Tone`, `type StateDef = { label; tone; court; hint }`, `type TransitionDef<S> = { label; from; to; by: readonly Role[]; handsTo?; feedback?: "required"|"optional"; intent?; hotkey?; event }`, `postingMachine`, `projectMachine`, `MACHINES`, `type EntityKind = "posting" | "project"`, `stateOf(kind, status): StateDef`, `transitionsFrom(kind, status, roles?: readonly Role[]): Array<{ name: string } & TransitionDef<string>>` (a transition is offered when any of the viewer's roles is in `by`), `PROJECT_FLOW`, `projectStage(status)`, `OPEN_PROJECT_STATUSES`, `boardStageFor(status: ProjectStatus): "solidifying" | "prototype" | "live" | null` per spec 6.1 (claimed, plan_review, plan_returned → solidifying; active → null meaning "leave as is"; submission_review → live; submission_returned → prototype; delivered and later → live; withdrawn → null).
- Produces: `type CopyCtx`, `type HandoffCopy`, `type NextStepsCopy`, `HANDOFF: Record<string, (c: CopyCtx) => HandoffCopy>` keyed `posting.submit|approve|return|close`, `project.claim|submitPlan|approvePlan|returnPlan|submitWork|approveWork|returnWork|integrate|requestCompletion|confirmCompletion|returnCompletion|withdraw`; `NEXT_STEPS: Record<string, (c: CopyCtx) => NextStepsCopy>` keyed `project.<status>.member`, `project.<status>.partner`, `posting.<status>.partner` as in Gantry's file.

- [ ] **Step 1: Write the failing tests**

```js
// scripts/machines.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
const { MACHINES, stateOf, transitionsFrom, projectStage, boardStageFor, PROJECT_FLOW } = await import("../src/lib/pipeline/machines.ts");
const { HANDOFF } = await import("../src/lib/pipeline/handoffs.ts");

test("every state has a label, tone, court and hint", () => {
  for (const m of Object.values(MACHINES)) for (const [k, s] of Object.entries(m.states)) {
    assert.ok(s.label && s.tone && s.court && s.hint, k);
  }
});
test("every transition that hands off has hand-off copy", () => {
  for (const [kind, m] of Object.entries(MACHINES)) for (const [name, t] of Object.entries(m.transitions)) {
    if (t.handsTo) assert.equal(typeof HANDOFF[`${kind}.${name}`], "function", `${kind}.${name}`);
  }
});
test("transitions are offered by role", () => {
  assert.deepEqual(transitionsFrom("project", "plan_review", ["member"]).map((t) => t.name), []);
  assert.deepEqual(transitionsFrom("project", "plan_review", ["rep"]).map((t) => t.name).sort(), ["approvePlan", "returnPlan"]);
  assert.deepEqual(transitionsFrom("posting", "in_review", ["member", "admin"]).map((t) => t.name).sort(), ["approve", "return"]);
});
test("stage folding and board stage", () => {
  assert.equal(projectStage("plan_returned"), "plan_review");
  assert.equal(PROJECT_FLOW.length, 7);
  assert.equal(boardStageFor("claimed"), "solidifying");
  assert.equal(boardStageFor("active"), null);
  assert.equal(boardStageFor("submission_returned"), "prototype");
  assert.equal(boardStageFor("delivered"), "live");
});
test("unknown status is harmless", () => {
  assert.equal(stateOf("project", "nope").court, "none");
});
```

```js
// scripts/handoffs.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
const { HANDOFF, NEXT_STEPS } = await import("../src/lib/pipeline/handoffs.ts");
const ctx = { partner: "Kestrel", member: "Maya", posting: "Snow pricing" };
test("hand-off copy has a title, ordered steps and a confirm label", () => {
  for (const [k, f] of Object.entries(HANDOFF)) {
    const c = f(ctx);
    assert.ok(c.title && c.confirm && c.steps.length >= 1, k);
    assert.ok(!/—/.test(JSON.stringify(c)), `${k} has an em dash`);
  }
});
test("next steps exist for every member-court and partner-court project status", () => {
  for (const s of ["claimed", "plan_returned", "active", "submission_returned", "integrated"]) assert.ok(NEXT_STEPS[`project.${s}.member`], s);
  for (const s of ["delivered", "completion_review"]) assert.ok(NEXT_STEPS[`project.${s}.partner`], s);
  for (const s of ["draft", "returned", "in_review", "live"]) assert.ok(NEXT_STEPS[`posting.${s}.partner`], s);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- scripts/machines.test.mjs scripts/handoffs.test.mjs`
Expected: FAIL, cannot find module `src/lib/pipeline/machines.ts`.

- [ ] **Step 3: Write `domain.ts`, `machines.ts`, `handoffs.ts`**

Copy Gantry's posting and project machines and `HANDOFF`/`NEXT_STEPS` entries for postings and projects. Add `project.claim` to `HANDOFF` (Gantry has it). Replace any em dash with a comma or a new sentence. Add `boardStageFor` with the mapping in Interfaces. `transitionsFrom` takes `roles?: readonly Role[]` instead of Gantry's single role.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- scripts/machines.test.mjs scripts/handoffs.test.mjs`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline scripts/machines.test.mjs scripts/handoffs.test.mjs
git commit -m "Add the shared pipeline machine and hand-off copy"
```

---

### Task 2: Worker test harness

**Files:**
- Create: `worker/vitest.config.ts`, `worker/test/helpers.ts`, `worker/test/smoke.test.ts`
- Modify: `worker/package.json` (add `vitest`, `@cloudflare/vitest-pool-workers`; script `"test": "vitest run"`), `worker/tsconfig.json` (include `test/`), `worker/README.md` (one paragraph: how tests run).

**Interfaces:**
- Produces: `applyMigrations(db: D1Database): Promise<void>` (reads `migrations/*.sql` in order via `import.meta.glob` or `readMigrationFiles` from `@cloudflare/vitest-pool-workers`), `makeEnv(): Env` (bindings from `env` plus `AUTH_SECRET: "test"`, `APPROVER_EMAIL: "kylarvierra@mail.weber.edu"`, `APPROVERS: "dantesmith@mail.weber.edu"`, `SITE_URL: "https://test.local"`, `ALLOWED_ORIGINS: "https://test.local"`, `DEV_CODES: "1"`), `signIn(env, email: string, name?: string): Promise<{ token: string; user: UserRow }>` (calls `/auth/start` then `/auth/verify` with the dev code), `call(env, token: string | null, method: string, path: string, body?: unknown | FormData): Promise<Response>` (sets `origin: https://test.local` and bearer header), `seedLegacy(db)` is added in Task 3.

- [ ] **Step 1: Write the failing smoke test**

```ts
// worker/test/smoke.test.ts
import { describe, it, expect } from "vitest";
import { makeEnv, applyMigrations, signIn, call } from "./helpers";
describe("harness", () => {
  it("signs in a member and reads /me", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const { token } = await signIn(env, "sam@mail.weber.edu", "Sam");
    const res = await call(env, token, "GET", "/me");
    expect(res.status).toBe(200);
    expect((await res.json()).user.role).toBe("member");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd worker && npm test`
Expected: FAIL, `vitest` not found or helpers missing.

- [ ] **Step 3: Add vitest config and helpers**

`vitest.config.ts` uses `defineWorkersConfig` with `wrangler: { configPath: "./wrangler.jsonc" }`, `miniflare: { d1Databases: ["DB"], kvNamespaces: ["REPORTS"] }`, and `isolatedStorage: true`. `applyMigrations` uses `readD1Migrations` from `@cloudflare/vitest-pool-workers/config` in `setupFiles`, applying with `applyD1Migrations`. `call` invokes the exported default handler's `fetch(req, env, ctx)` with `createExecutionContext()` and `waitOnExecutionContext`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd worker && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/package.json worker/package-lock.json worker/vitest.config.ts worker/test worker/tsconfig.json worker/README.md
git commit -m "Add a Worker test harness on Miniflare with D1 migrations"
```

---

### Task 3: Migration 0010 and the dry run

**Files:**
- Create: `worker/migrations/0010_gates_and_orgs.sql`, `worker/scripts/dry-run-migration.sh`
- Test: `worker/test/migration.test.ts`, `worker/test/helpers.ts` (add `seedLegacy`)

**Interfaces:**
- Produces the new schema. Table and column names below are the contract for every later task.

```sql
-- users: add
ALTER TABLE users ADD COLUMN roles TEXT NOT NULL DEFAULT '[]';      -- JSON array of Role
ALTER TABLE users ADD COLUMN org_id TEXT REFERENCES orgs(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN level TEXT NOT NULL DEFAULT 'affiliate' CHECK (level IN ('affiliate','sponsored','builder'));
ALTER TABLE users ADD COLUMN level_locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN interests TEXT NOT NULL DEFAULT '[]';  -- JSON array of discipline slugs

CREATE TABLE orgs (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'company' CHECK (kind IN ('company','nonprofit','public','lab')),
  domain TEXT NOT NULL DEFAULT '', industry TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', is_public INTEGER NOT NULL DEFAULT 1,
  showcase_consent_default INTEGER NOT NULL DEFAULT 0, primary_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  join_domain INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE INDEX orgs_domain ON orgs(domain);

CREATE TABLE org_requests (id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  message TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, decided_at TEXT, decided_by TEXT, note TEXT NOT NULL DEFAULT '');
CREATE UNIQUE INDEX org_requests_pending ON org_requests(user_id) WHERE status = 'pending';

CREATE TABLE taxonomy (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('discipline','tag')), name TEXT NOT NULL,
  slug TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, position REAL NOT NULL,
  created_at TEXT NOT NULL, UNIQUE (kind, slug));

CREATE TABLE postings (id TEXT PRIMARY KEY, org_id TEXT REFERENCES orgs(id) ON DELETE SET NULL,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, summary TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '', disciplines TEXT NOT NULL DEFAULT '[]', tags TEXT NOT NULL DEFAULT '[]',
  effort TEXT NOT NULL DEFAULT '' CHECK (effort IN ('','small','medium','large','multi')),
  deliverable TEXT NOT NULL DEFAULT '', deadline TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft','in_review','returned','live','paused','closed','archived')),
  kind TEXT NOT NULL DEFAULT 'partner' CHECK (kind IN ('partner','self')), sealed INTEGER NOT NULL DEFAULT 0,
  show_on_profile INTEGER NOT NULL DEFAULT 1, submitted_at TEXT, published_at TEXT, closed_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX postings_org ON postings(org_id); CREATE INDEX postings_status ON postings(status);

CREATE TABLE projects (id TEXT PRIMARY KEY, posting_id TEXT NOT NULL REFERENCES postings(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('claimed','plan_review','plan_returned','active','submission_review','submission_returned','delivered','integrated','completion_review','complete','withdrawn')),
  phase TEXT NOT NULL DEFAULT 'parallel' CHECK (phase IN ('parallel','integrated')),
  plan TEXT NOT NULL DEFAULT '{"approach":"","milestones":[],"finishBy":""}',
  ai_disclosure TEXT NOT NULL DEFAULT '', planned_terms INTEGER NOT NULL DEFAULT 1,
  claimed_at TEXT NOT NULL, plan_submitted_at TEXT, activated_at TEXT, submitted_at TEXT, delivered_at TEXT,
  integrated_at TEXT, completed_at TEXT, withdrawn_at TEXT, updated_at TEXT NOT NULL);
CREATE INDEX projects_posting ON projects(posting_id); CREATE INDEX projects_status ON projects(status);

CREATE TABLE project_members (project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead','member')), joined_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id));
CREATE INDEX project_members_user ON project_members(user_id);
CREATE TRIGGER one_active_project BEFORE INSERT ON project_members BEGIN
  SELECT RAISE(ABORT, 'already-claimed') WHERE EXISTS (
    SELECT 1 FROM project_members m JOIN projects p ON p.id = m.project_id JOIN projects added ON added.id = NEW.project_id
    WHERE m.user_id = NEW.user_id AND p.posting_id = added.posting_id AND p.id <> NEW.project_id
      AND p.status NOT IN ('withdrawn','complete')); END;

CREATE TABLE reviews (id TEXT PRIMARY KEY, gate TEXT NOT NULL CHECK (gate IN ('posting','action_plan','submission','completion')),
  subject_id TEXT NOT NULL, round INTEGER NOT NULL, snapshot TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','returned','withdrawn')),
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL, decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT, feedback TEXT NOT NULL DEFAULT '', score INTEGER, opened_at TEXT NOT NULL);
CREATE INDEX reviews_subject ON reviews(gate, subject_id); CREATE INDEX reviews_open ON reviews(status) WHERE status = 'open';

CREATE TABLE milestone_baselines (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('plan_submitted','plan_approved','integrated','manual')), snapshot TEXT NOT NULL, taken_at TEXT NOT NULL);

CREATE TABLE events (id TEXT PRIMARY KEY, type TEXT NOT NULL, actor_id TEXT, via_user_id TEXT, subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL, posting_id TEXT, project_id TEXT, org_id TEXT, payload TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
CREATE INDEX events_subject ON events(subject_kind, subject_id, created_at); CREATE INDEX events_project ON events(project_id, created_at);

ALTER TABLE notifications ADD COLUMN court INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN event_id TEXT;

-- boards (was projects), submissions, meetings, selections: rebuilt with new FKs
CREATE TABLE boards (id TEXT PRIMARY KEY, project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE submissions_v2 (... same columns as submissions, with project_id REFERENCES projects(id) and board_id REFERENCES boards(id) replacing claim_id/project_id ...);
CREATE TABLE meetings_v2 (id, project_id REFERENCES projects(id), requested_by, message, status CHECK (status IN ('requested','scheduled','held','cancelled')), created_at, arranged_at);
CREATE TABLE selections_v2 (project_id PRIMARY KEY REFERENCES projects(id), selected_by, message, milestones, completed_at, created_at);
```

Data conversion, in this order inside the same migration file:

1. `UPDATE users SET roles = '["' || role || '"]'`.
2. Lab org: `INSERT INTO orgs (id, slug, name, kind, domain, created_at) VALUES ('org_lab', 'applied-ai-lab', 'Applied AI Lab', 'lab', 'weber.edu', <now>)`.
3. One org per distinct non-personal partner email domain: slug = domain with dots as dashes, name = domain's first label capitalized, `domain` = the domain, `primary_user_id` = the earliest-created active partner at that domain. Personal domains (`gmail.com`, `yahoo.com`, `outlook.com`, `hotmail.com`, `icloud.com`, `live.com`, `aol.com`, `proton.me`, `protonmail.com`, `me.com`, `msn.com`) get one org per partner user: slug = the user's handle-style slug of their name plus 4 random chars (do this in SQL with `lower(hex(randomblob(2)))`), name = the user's name, `domain = ''`, primary = that user. Then `UPDATE users SET org_id = ...` for every partner.
4. Taxonomy seed: disciplines `finance` Finance, `accounting` Accounting, `business` Business, `computer-science` Computer Science, `design` Design, `mathematics` Mathematics, `marketing` Marketing, `other` Other, positions 1 to 8.
5. `problems` → `postings`: `org_id` = owner's `org_id`, or `'org_lab'` when the owner is a rep; `author_id = owner_id`; `disciplines = fields`; `status` = `CASE WHEN origin='member' THEN 'closed' WHEN status='open' THEN 'live' ELSE 'closed' END`; `kind = CASE WHEN origin='member' THEN 'self' ELSE 'partner' END`; `published_at = CASE WHEN origin='partner' THEN created_at END`; `closed_at = CASE WHEN status='closed' THEN updated_at END`; `show_on_profile = CASE WHEN origin='member' THEN 0 ELSE 1 END`.
6. `claims` → `projects` with the spec 6.4 status table: `pending` → `plan_review`; `approved` with no submission → `active`; latest submission `pending` → `submission_review`; `returned` → `submission_returned`; `accepted` and no selection → `delivered`; selection without `completed_at` → `integrated`; selection completed → `complete`; `withdrawn` → `withdrawn`; `denied` → `plan_returned`. `lead_id = owner_id`, `plan = plan`, `claimed_at = created_at`, `plan_submitted_at = created_at`, `activated_at = CASE WHEN status='approved' THEN reviewed_at END`, `phase = CASE WHEN selection exists THEN 'integrated' ELSE 'parallel' END`, `integrated_at` = selection created_at, `completed_at` = selection completed_at, `withdrawn_at = CASE WHEN status='withdrawn' THEN reviewed_at END`, `updated_at = created_at`.
7. `claim_members` → `project_members` with `role = CASE WHEN user_id = lead_id THEN 'lead' ELSE 'member' END`, `joined_at` = project `claimed_at`. Insert leads first, then others (trigger is satisfied because old data already obeyed it).
8. Reviews: one `action_plan` review per migrated project with round 1, `snapshot = plan`, `opened_at = created_at`, and status `open` for `plan_review`, `approved` for anything that was `approved`, `returned` with `feedback = review_note` for `denied`, `withdrawn` for `withdrawn`; `decided_by = reviewed_by`, `decided_at = reviewed_at`.
9. Baselines: `plan_submitted` for every project (snapshot = plan milestones JSON), plus `plan_approved` for every project whose claim was approved, `taken_at = reviewed_at`.
10. `users.level`: `builder` when on any project with phase `integrated`, else `sponsored` when on any project in `active` or later (not withdrawn), else `affiliate`.
11. `projects`(old) → `boards`: `project_id = claim_id`. Then for every project with no board, insert a board from the plan the way `openBoard` does (stage `solidifying`, plan steps from milestones). This part runs in the Worker's first start, not SQL: see Task 10 `ensureBoards()`, called from `scheduled()` and from `GET /boards` once per isolate. (SQL cannot build the board JSON.)
12. `submissions` → `submissions_v2` (`project_id = claim_id`, `board_id = project_id`), `meetings` → `meetings_v2` (`scheduled` for `arranged`), `selections` → `selections_v2`.
13. Drop in this order: `DROP TRIGGER one_active_claim; DROP TABLE claim_members; DROP TABLE selections; DROP TABLE meetings; DROP TABLE submissions; DROP TABLE projects_old...`. Concretely: `ALTER TABLE projects RENAME TO boards_old` must happen **before** step 11's `CREATE TABLE boards`, so the first statement of the file is `ALTER TABLE projects RENAME TO boards_old;`. Children are dropped before parents: `claim_members`, `selections`, `meetings`, `submissions`, `boards_old`, then `claims`, then `problems`. Then `ALTER TABLE submissions_v2 RENAME TO submissions; ALTER TABLE meetings_v2 RENAME TO meetings; ALTER TABLE selections_v2 RENAME TO selections;` and recreate indexes `submissions_open` (`project_id` where status in pending, accepted), `meetings_open`, `submissions_project`, `meetings_project`.

- [ ] **Step 1: Write the failing migration test**

`seedLegacy(db)` in helpers applies migrations 0001 to 0009 only, then inserts: users rep `prof@weber.edu`, members `maya@mail.weber.edu` (handle `maya-abcd`), `eli@mail.weber.edu`, `ben@mail.weber.edu`, partners `dana@kestrel.example` (active), `owen@gmail.com` (active), `theo@cinder.example` (pending); problems P1 by dana (open), P2 by prof (open), P3 by maya (origin member), P4 by dana (closed); claims C1 maya on P1 approved with board and accepted submission and selection; C2 eli on P1 pending (no board); C3 ben on P2 denied with note "Too broad"; C4 maya on P3 approved with board, pending submission; C5 ben on P4 withdrawn; meeting on C1 arranged.

```ts
// worker/test/migration.test.ts
it("carries every row forward with the mapped status", async () => {
  const env = makeEnv(); await seedLegacy(env.DB); await applyMigration(env.DB, "0010_gates_and_orgs.sql");
  const rows = async (sql: string) => (await env.DB.prepare(sql).all()).results;
  expect((await rows("SELECT status, kind, org_id FROM postings ORDER BY title")).map((r) => [r.status, r.kind])).toEqual([["live","partner"],["live","partner"],["closed","self"],["closed","partner"]]);
  expect((await rows("SELECT org_id FROM postings WHERE title='P2'"))[0].org_id).toBe("org_lab");
  const statuses = Object.fromEntries((await rows("SELECT id, status FROM projects")).map((r) => [r.id, r.status]));
  expect(statuses).toEqual({ C1: "integrated", C2: "plan_review", C3: "plan_returned", C4: "submission_review", C5: "withdrawn" });
  expect((await rows("SELECT status, feedback FROM reviews WHERE subject_id='C3'"))[0]).toMatchObject({ status: "returned", feedback: "Too broad" });
  expect((await rows("SELECT COUNT(*) AS n FROM reviews WHERE status='open'"))[0].n).toBe(1);
  expect((await rows("SELECT role FROM project_members WHERE project_id='C1' AND user_id=(SELECT id FROM users WHERE email='maya@mail.weber.edu')"))[0].role).toBe("lead");
  expect((await rows("SELECT level FROM users WHERE email='maya@mail.weber.edu'"))[0].level).toBe("builder");
  expect((await rows("SELECT level FROM users WHERE email='eli@mail.weber.edu'"))[0].level).toBe("affiliate");
  expect((await rows("SELECT slug, domain FROM orgs ORDER BY slug")).length).toBe(4); // lab, kestrel-example, cinder-example, owen's personal org
  expect((await rows("SELECT roles FROM users WHERE email='prof@weber.edu'"))[0].roles).toBe('["rep"]');
  expect((await rows("SELECT COUNT(*) AS n FROM boards"))[0].n).toBe(2); // boards_old carried; C2's board comes from ensureBoards()
  expect((await rows("SELECT status FROM meetings"))[0].status).toBe("scheduled");
  expect((await rows("SELECT name FROM sqlite_master WHERE name IN ('problems','claims','claim_members','boards_old')")).length).toBe(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd worker && npm test -- migration`
Expected: FAIL, no such file `0010_gates_and_orgs.sql`.

- [ ] **Step 3: Write the migration**

Follow the schema and the 13 conversion steps above, in that order, with `ALTER TABLE projects RENAME TO boards_old;` as the first statement and `PRAGMA defer_foreign_keys = true;` as the second.

- [ ] **Step 4: Run to verify it passes**

Run: `cd worker && npm test -- migration`
Expected: PASS.

- [ ] **Step 5: Write the dry-run script**

`worker/scripts/dry-run-migration.sh`: exports the remote database with `wrangler d1 export appliedlab-projectum --remote --output /tmp/projectum-export.sql`, creates a throwaway local database `appliedlab-projectum-dryrun` with `wrangler d1 execute --local --file`, applies `migrations/0010_gates_and_orgs.sql` to it, and prints row counts for `postings`, `projects`, `project_members`, `boards`, `submissions`, `meetings`, `selections`, `orgs`, `reviews` next to the pre-migration counts of `problems`, `claims`, `claim_members`, `projects`, `submissions`, `meetings`, `selections`. Exit non-zero if any post count is lower than its pre count.

- [ ] **Step 6: Run the dry run**

Run: `cd worker && bash scripts/dry-run-migration.sh`
Expected: counts printed, exit 0.

- [ ] **Step 7: Commit**

```bash
git add worker/migrations/0010_gates_and_orgs.sql worker/scripts/dry-run-migration.sh worker/test
git commit -m "Rebuild the pipeline tables for postings, projects, orgs and reviews"
```

---

### Task 4: Roles, admin, level and org on the account

**Files:**
- Modify: `worker/src/accounts.ts`, `src/lib/account.ts`, `src/lib/email-rules.ts`
- Test: `worker/test/accounts.test.ts`, `scripts/email-role.test.mjs`

**Interfaces:**
- Produces (Worker): `UserRow` gains `roles: string` (JSON), `org_id: string | null`, `level: Level`, `level_locked: number`, `interests: string`; `USER_COLS` updated. `rolesOf(u: UserRow): Role[]` (parsed `roles`, deduped, always includes `u.role`). `isAdmin(env, u): boolean` = active and (`rolesOf` includes `admin` or email in `APPROVER_EMAIL`/`APPROVERS`). `hasRole(env, u, r: Role): boolean` (admin via `isAdmin`, others via `rolesOf`). `isStaff(env, u)` = rep or admin. `publicUser` returns `{ id, email, name, role, roles: Role[] (with "admin" added when isAdmin), admin: boolean, status, avatar, level, levelLocked, orgId, org: { id, slug, name, primary: boolean } | null, profilePublic, handle, claudeAccess, hideName, interests }`. `levelOf` is deleted; `level` is read from the row. Remove `isApprover` and every import of it (Task 12 finishes the pipeline side).
- Produces (site): `Account` with the same fields; `useAccount().admin`, `.roles`, `.org`. `PERSONAL_DOMAINS: readonly string[]` and `emailDomain(email): string` in `email-rules.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// worker/test/accounts.test.ts
it("an APPROVERS address is an admin, a plain rep is not", async () => {
  const env = makeEnv(); await applyMigrations(env.DB);
  const d = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
  const p = await signIn(env, "prof@weber.edu", "Prof");
  expect((await (await call(env, d.token, "GET", "/me")).json()).user).toMatchObject({ admin: true, roles: ["member", "admin"] });
  expect((await (await call(env, p.token, "GET", "/me")).json()).user).toMatchObject({ admin: false, roles: ["rep"], level: null });
});
it("a member's level comes from the row", async () => { /* set level='sponsored' via SQL, GET /me shows "sponsored" */ });
```

```js
// scripts/email-role.test.mjs (add)
test("personal domains are known", () => {
  assert.equal(emailDomain("A@Gmail.com"), "gmail.com");
  assert.ok(PERSONAL_DOMAINS.includes("gmail.com"));
});
```

- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement** the functions in Interfaces. `createUser` inserts `roles` as `'["<role>"]'`. Partners keep starting `pending`; the org hook is Task 8.
- [ ] **Step 4: Run to verify they pass** (`cd worker && npm test -- accounts`, `npm test -- scripts/email-role.test.mjs`)
- [ ] **Step 5: Commit** `git commit -m "Give accounts a roles list, an admin flag, a stored level and an organization"`

---

### Task 5: Events and notifications

**Files:**
- Create: `worker/src/events.ts`
- Modify: `worker/src/notify.ts` (keep `handleNotifications`, `clearOldNotifications`; `GET /notifications` now also returns `court`)
- Test: `worker/test/events.test.ts`

**Interfaces:**
- Produces: `type Recipients = { userIds: string[]; court?: boolean }`; `emit(env, stmts: D1PreparedStatement[], e: { type: string; actor: UserRow | null; subject: { kind: "posting"|"project"|"org"|"user"|"review"; id: string }; postingId?: string; projectId?: string; orgId?: string; payload?: Record<string, unknown>; notify: Array<Recipients & { title: string; href: string }> }): void` pushes INSERT statements for `events` and `notifications` onto `stmts` (the caller runs `env.DB.batch(stmts)`), excluding the actor from recipients and deduping ids. `adminIds(env)`, `repIds(env)`, `staffIds(env)` (union), `orgUserIds(env, orgId)`, `projectMemberIds(env, projectId)`, `orgPrimaryOrAdmins(env, orgId)` all return `Promise<string[]>`. `approverIds` in `notify.ts` is deleted; `teamIds` becomes `projectMemberIds`.

- [ ] **Step 1: Write the failing test**: `emit` with two notify groups and an actor who is in one group writes one event row and N-1 notification rows, with `court = 1` for the court group; `GET /notifications` returns `court: true` on that row.
- [ ] **Step 2: Run to verify it fails**
- [ ] **Step 3: Implement `events.ts`**; update `notify.ts` select to include `court`.
- [ ] **Step 4: Run to verify it passes**
- [ ] **Step 5: Commit** `git commit -m "Record events and write court-aware notifications in one batch"`

---

### Task 6: The transition engine

**Files:**
- Create: `worker/src/transition.ts`, `worker/src/db.ts`
- Test: `worker/test/transition.test.ts`

**Interfaces:**
- Produces (`db.ts`): `now(): string`, `uuid(): string`, `json<T>(text: string, fallback: T): T`, `marks(n: number): string`.
- Produces (`transition.ts`):

```ts
export type TransitionInput = { kind: "posting" | "project"; id: string; name: string; feedback?: string; score?: number | null; memberIds?: string[] };
export type TransitionError = "not-found" | "state" | "forbidden" | "own-project" | "feedback" | "plan" | "unknown-transition";
export type TransitionContext = {
  posting: PostingRow; project: ProjectRow | null; memberIds: string[]; orgId: string | null; self: boolean; actorRoles: Role[];
};
export type Hooks = {
  // Returns a TransitionError to refuse, or statements to add to the batch and notifications to send.
  guard?: (ctx: TransitionContext, input: TransitionInput) => Promise<TransitionError | null>;
  effects: (ctx: TransitionContext, input: TransitionInput, at: string) => Promise<{ stmts: D1PreparedStatement[]; notify: Parameters<typeof emit>[2]["notify"]; payload?: Record<string, unknown> }>;
};
export async function transition(env: Env, actor: UserRow, input: TransitionInput, hooks: Record<string, Hooks>): Promise<{ ok: true; status: string } | { ok: false; error: TransitionError; issues?: string[] }>;
```

Behavior: look up the machine (`MACHINES[kind]`) and transition `name` (unknown → `unknown-transition`); load context (posting always; project when kind is project); check `status ∈ from` else `state`; authorize per Gantry: admin and rep allowed when in `by`; partner needs `actor.org_id === ctx.orgId`; member needs `actor.id ∈ memberIds`; a rep or admin who is in `memberIds` is refused with `own-project` for gate decisions (`approvePlan`, `returnPlan`, `approveWork`, `returnWork`, posting `approve`/`return` when the actor is the posting's author); `feedback === "required"` with empty `feedback` → `feedback`; run `hooks[name].guard`; build statements: `UPDATE <table> SET status = ?, updated_at = ? WHERE id = ? AND status IN (<from>)` first, then hook statements, then `emit(...)` statements with `type = def.event`; run `env.DB.batch(stmts)`; if the UPDATE's `meta.changes === 0` the whole batch is already committed, so instead run the UPDATE **alone first** and return `state` when `changes` is 0, then run the rest as a second batch. (Two batches; the status row is the lock. Document this in a comment.)

- [ ] **Step 1: Write the failing tests**: a posting in `draft` with `submit` by its partner moves to `in_review` and writes one event; `submit` by a member returns `forbidden`; `approve` by a member returns `forbidden`; `return` without feedback returns `feedback`; two concurrent `approve` calls (`Promise.all`) yield one `ok` and one `state`; unknown name returns `unknown-transition`.
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement `db.ts` and `transition.ts`** with a minimal `hooks` map in the test (empty effects).
- [ ] **Step 4: Run to verify they pass**
- [ ] **Step 5: Commit** `git commit -m "Add the one code path for status changes"`

---

### Task 7: Taxonomy endpoint

**Files:**
- Create: `worker/src/taxonomy.ts`
- Test: `worker/test/taxonomy.test.ts`

**Interfaces:**
- Produces: `GET /taxonomy` → `{ disciplines: Array<{ slug: string; name: string }>, tags: Array<{ slug; name }> }`, active only, by position. Any signed-in user. `activeDisciplineSlugs(env): Promise<string[]>` for validation in Task 9.

- [ ] Steps: failing test (eight seeded disciplines in order, `other` last) → implement → pass → commit `"Serve the managed categories"`.

---

### Task 8: Organizations

**Files:**
- Create: `worker/src/orgs.ts`
- Modify: `worker/src/accounts.ts` (`createUser` partner hook; `approvePartner` and `approvePartnerInApp` call `ensureOrgFor`)
- Test: `worker/test/orgs.test.ts`

**Interfaces:**
- Produces:
  - `orgForDomain(env, domain: string): Promise<OrgRow | null>` (non-personal domains only).
  - `ensureOrgFor(env, user: UserRow): Promise<OrgRow>`: returns the user's org; otherwise attaches to `orgForDomain` or creates one (slug from domain, or name plus 4 random chars for personal domains), making the user primary when the org is new or has no primary; writes `users.org_id`.
  - `onPartnerSignUp(env, stmts, user)`: when `orgForDomain` matches and the org has a primary, insert an `org_requests` row (`pending`) and `emit` `org.join_requested` to `orgPrimaryOrAdmins` (court). Otherwise nothing (admin approval creates the org as today). Called from `createUser` after the user row exists.
  - Endpoints (partner, rep, admin as noted):
    - `GET /orgs/mine` → `{ org, people: Array<{ id, name, email, primary }>, requests: Array<{ id, user: { id, name, email }, message, createdAt }> }` (requests only for the primary or an admin; partner must have an org, else 404 `no-org`).
    - `PATCH /orgs/mine` `{ name?, industry?, location?, website?, description?, isPublic?, showcaseConsentDefault? }` by the primary or admin.
    - `POST /orgs/requests/:id/approve` and `/decline` `{ note? }` by the primary of that org or an admin. Approve: `org_requests.status = approved`, `users.org_id`, `users.status = 'active'`, emit `org.join_approved` to the user and `account.approved`. Decline: `declined` with note, emit `org.join_declined`.
    - `POST /orgs/mine/transfer` `{ userId }` by the primary or admin; emit `org.primary_transferred` to org users.
    - `POST /orgs/mine/remove` `{ userId }` by the primary or admin (not the primary themself); sets `users.org_id = NULL`; emit `org.member_removed` to the removed user and org users.
    - `GET /orgs/:id` for staff → same shape as `/orgs/mine`.
  - `handleOrgs(req, env, user, json): Promise<Response | null>`.

- [ ] **Step 1: Write the failing tests**: second partner at `kestrel.example` signing up creates a pending `org_requests` row and a court notification for dana (primary); dana approving activates the account and sets `org_id`; a partner at a domain whose org has no primary notifies admins (Review Focus 2); `gmail.com` partner approved by admin gets their own org and is primary; remove then re-request works.
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run to verify they pass**
- [ ] **Step 5: Commit** `git commit -m "Give partners organizations with a primary account and join requests"`

---

### Task 9: Postings with gate 1

**Files:**
- Create: `worker/src/postings.ts`
- Modify: `src/lib/problems.ts` (`PostingDraft`, `cleanPosting`, `postingIssues`, `EFFORTS`)
- Test: `worker/test/postings.test.ts`, `scripts/problems.test.mjs`

**Interfaces:**
- Produces (shared): `EFFORTS = ["small","medium","large","multi"]`, `type PostingDraft = { title; summary; details; disciplines: string[]; tags: string[]; effort: "" | Effort; deliverable; deadline }`, `cleanPosting(value, allowedDisciplines: string[]): PostingDraft`, `postingIssues(d): Array<"title"|"summary"|"disciplines">` (submit requires title ≥ 4 chars and summary ≥ 20 chars per Gantry; drafts need only a title). `LIMITS` gains `feedback: 2000`.
- Produces (Worker): `PostingRow` type; `postingOut(row, viewer)` → `{ id, orgId, org: { id, name, slug } | null, author: { id, name }, title, summary, details, disciplines, tags, effort, deliverable, deadline, status, kind, sealed, showOnProfile, submittedAt, publishedAt, closedAt, createdAt, counts: { open: number; delivered: number }, myProject: { id; status } | null, transitions: string[] (names allowed for this viewer), nextSteps: key | null, reviews: ReviewOut[] (staff and the org only) }`.
  - `GET /postings?scope=board|mine|all`: `board` = live partner postings (members and staff); `mine` = the viewer's org postings (partners) ; `all` = staff only, every posting with kind partner.
  - `POST /postings` `{ ...PostingDraft, send: boolean }` by a partner with an org or an admin (admin posts for the Lab org): creates `draft`; when `send`, runs `transition submit` in the same request.
  - `GET /postings/:id` (visibility: `canSeePosting` from Gantry: staff all; org its own; members live, paused, closed; self postings only via their project).
  - `PATCH /postings/:id` by the org or admin, not while `in_review` (`state`).
  - `POST /postings/:id/transition` `{ name, feedback? }` → `transition()` with hooks: `submit` guard = `postingIssues` empty else `plan` with issues; effects = `submitted_at`, open `posting` review round n with `snapshot = postingOut fields`, notify reps (court) `"<Org> sent “<title>” for review"` href `/projectum?view=review&id=<reviewId>`; `withdraw` closes the open review as `withdrawn`; `approve` effects = `published_at`, close review `approved` with feedback, notify org users `"“<title>” is live on the notice board"` and members whose `interests` overlap `disciplines` (non-court) `"New on the board: <title>"`; `return` closes `returned` with feedback (court to org users); `pause`, `resume`, `close` (sets `closed_at`, notifies members on open projects "closed to new claims"), `reopen`, `archive`.
  - `handlePostings(req, env, user, json): Promise<Response | null>`.
  - Emails: reps' `posting.submitted` and the org's `posting.published`/`posting.returned` also send email through `sendEmail` to `APPROVER_EMAIL` and the org's primary respectively (same wording as the notification plus the link).

- [ ] **Step 1: Write the failing tests**: partner creates draft, `send: true` moves to `in_review` and opens a round-1 review visible to a rep; rep `return` without feedback → 400 `feedback`; with feedback → `returned`, partner sees `nextSteps = "posting.returned.partner"` and `reviews[0].feedback`; partner resubmits → round 2; rep `approve` → `live`, appears in `scope=board` for a member, `publishedAt` set; member cannot `PATCH`; org cannot `PATCH` while `in_review`; `close` notifies the member on an open project.
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run to verify they pass**
- [ ] **Step 5: Commit** `git commit -m "Post problems as postings that a representative reviews before the board"`

---

### Task 10: Projects: claim, plan, the action-plan gate, withdraw, boards

**Files:**
- Create: `worker/src/projects.ts`
- Modify: `worker/src/pipeline.ts` (boards: `listBoards`, `boardAccess`, `saveBoard`, `deleteBoard`, `openBoard` move to `projects.ts` and read `boards`/`projects`), `src/lib/problems.ts` (`PlanDraft`, `cleanPlan`, `planIssues`, `cleanTeammates`)
- Test: `worker/test/projects.test.ts`, `scripts/problems.test.mjs`

**Interfaces:**
- Produces (shared): `type PlanDraft = { approach: string; milestones: Milestone[]; finishBy: string }`, `cleanPlan`, `planIssues` (same rules as `claimIssues`), `cleanTeammates(value): string[]` (≤ 6 ids).
- Produces (Worker):
  - `ProjectRow`; `projectOut(row, viewer)` → `{ id, postingId, posting: { id, title, kind, org: {id,name} | null }, status, phase, plan: PlanDraft, lead: Person, team: Person[], boardId: string | null, plannedTerms, claimedAt, activatedAt, submittedAt, deliveredAt, transitions: string[], nextSteps: key | null, reviews: ReviewOut[] (full view only), view: "full" | "partner" | "colleague" }` using Gantry's `projectView` rule (spec Appendix B 1b).
  - `POST /postings/:id/claim` `{ teammates?: string[] }` by a member: posting must be `live` and kind `partner`; idempotent per member (returns the existing open project); creates project `claimed` (plan empty), `project_members` (lead plus teammates, validated active members; the trigger enforces one open project per person per posting → 409 `already-claimed`), and a board at `solidifying` via `openBoard(project, posting, team)` with an empty plan; emits `project.claimed` to org users (non-court). Returns `{ id }` 201.
  - `POST /proposals` `{ posting: PostingDraft, plan?: PlanDraft, teammates?: string[] }` by a member: creates a `self` posting (`closed`, `show_on_profile = 0`, `org_id = NULL`, `author_id = member`), the project `claimed` with the plan if given, members, and the board. Returns `{ id: projectId, postingId }`.
  - `PUT /projects/:id/plan` `PlanDraft` by a team member while `claimed` or `plan_returned`; also mirrors into the board's `plan.thesis` (approach) and `plan.steps` (milestones) so the Solidifying dialog shows the same plan. 409 `state` otherwise.
  - `GET /projects/mine` → `{ projects: ProjectOut[] }` for the viewer's memberships (any status, newest first).
  - `GET /projects/:id` → `ProjectOut` by view rule; 404 when `none`.
  - `GET /projects?posting=<id>` → projects on a posting, by view rule (partners only once `plan_approved`, i.e. status not in claimed, plan_review, plan_returned, withdrawn).
  - `POST /projects/:id/transition` `{ name, feedback? }` → `transition()` with hooks: `submitPlan` guard = `planIssues(plan)` empty else `plan`; effects: `plan_submitted_at`, `milestone_baselines` `plan_submitted`, open `action_plan` review round n (`snapshot = plan`), board stage forced to `solidifying`, notify reps (court) `"<Lead> submitted an action plan for “<title>”"` href `/projectum?view=review&id=<reviewId>`, email `APPROVER_EMAIL`. `approvePlan` effects: `activated_at`, close review `approved` with feedback, baseline `plan_approved`, `UPDATE users SET level = 'sponsored' WHERE id IN (team) AND level = 'affiliate' AND level_locked = 0`, emit `member.level_changed` to those users, notify team (court) `"Your plan for “<title>” was approved. Your board is open."` href `/projectum?project=<boardId>`, notify org users (non-court, not for self), email team. `returnPlan` effects: close review `returned` with feedback, notify team (court) `"Your plan for “<title>” came back with notes"` href `/projectum?view=myprojects`, email team with the notes. `withdraw` effects: `withdrawn_at`, close open `action_plan`/`submission` reviews as `withdrawn`, notify org users (non-court).
  - `boardAccess(env, user, boardId)`: `"edit"` for admins; team members get `"edit"` when project status ∈ {claimed, plan_returned, active, submission_returned, integrated}, `"locked"` when ∈ {plan_review, submission_review, delivered, completion_review}, `"none"` when withdrawn or complete or not on team; reps `"none"` (read-only is the list). Saving a board while `claimed`/`plan_returned` also mirrors `plan.thesis`/`plan.steps` back into `projects.plan` (approach and milestones with criterion kept from the existing plan when the step text matches `"<title>. <criterion>"`, else criterion empty).
  - `GET /boards`, `PUT /boards/:id`, `DELETE /boards/:id` (admin), `POST /boards/:id/submissions`, `GET /submissions/:id/report` replace the `/projects` board routes. `listBoards` output keeps today's shape plus `projectId`, `status: ProjectStatus`, `postingId`, `postingTitle`, `view`.
  - `ensureBoards(env): Promise<number>`: creates a board for every project without one (migration step 11). Called from `scheduled()` and once per isolate on the first `GET /boards`.
  - `handleProjects(req, env, user, json)`, `handleBoards(req, env, user, headers, json)`.

- [ ] **Step 1: Write the failing tests**: claim creates project `claimed` with a board at `solidifying` and `view: "full"` for the lead, `"colleague"` for another member, 404 for the partner; a second claim by the same member returns the same id; `submitPlan` with an empty plan → 400 `plan`; with a plan → `plan_review`, one open round-1 review, board `locked` for the team (`PUT /boards/:id` → 409); rep on the team gets `own-project` (Review Focus 4); another rep `returnPlan` with feedback → `plan_returned`, board editable again, `reviews[0].feedback` visible to the lead (Review Focus 3); resubmit → round 2; `approvePlan` → `active`, team `level = sponsored`, partner now sees `view: "partner"`; two concurrent `approvePlan` → one `ok`, one `state`, one notification per team member (Review Focus 1); `withdraw` from `active` → `withdrawn`, open reviews closed; `ensureBoards` on a migrated database makes the missing board for C2.
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run to verify they pass**
- [ ] **Step 5: Commit** `git commit -m "Claim postings as projects and review action plans in rounds"`

---

### Task 11: Reviews queue and review detail

**Files:**
- Create: `worker/src/reviews.ts`
- Test: `worker/test/reviews.test.ts`

**Interfaces:**
- Produces: `type ReviewOut = { id, gate, subjectId, round, status, assignedTo: Person | null, decidedBy: Person | null, decidedAt, feedback, score, openedAt }`. `reviewsFor(env, gate, subjectId): Promise<ReviewOut[]>`.
  - `GET /reviews` (rep or admin) → `{ reviews: Array<ReviewOut & { title: string; who: string; posting: { id; title } ; project: { id; status; lead: Person; team: Person[] } | null; waitingSince: string }> }`: open reviews for gates `posting` and `action_plan`, plus one synthetic entry per pending `submissions` row (`gate: "submission"`, `id: "sub:" + submission.id`) so the queue is complete until phase 3; oldest first.
  - `GET /reviews/:id` → `{ review: ReviewOut; history: ReviewOut[] (all rounds for the subject); subject: PostingOut | ProjectOut; snapshot: unknown; board: Project | null (for action_plan) }`.
  - `POST /reviews/:id/take` sets `assigned_to = me` when unassigned or mine (409 `taken` otherwise); `POST /reviews/:id/assign` `{ userId }` admin only; emits `review.assigned` (court) to the assignee.
  - `handleReviews(req, env, user, json)`.

- [ ] Steps: failing tests (queue lists a posting review and a plan review oldest first and includes the pending submission; `take` twice by different reps → second 409; detail returns the frozen snapshot even after the plan is edited) → implement → pass → commit `"Add the reviews queue and review pages"`.

---

### Task 12: Rewire boards, submissions, phase 2, overview, reminders and profiles to the new tables

**Files:**
- Modify: `worker/src/pipeline.ts` (every SQL on `claims`, `claim_members`, `problems`, `projects` moves to `projects`, `project_members`, `postings`, `boards`; `isApprover` → `isAdmin`/`isStaff`; `submit` sets project status via `transition("submitWork")` and `reviewSubmission` via `approveWork`/`returnWork` with hooks that also update the `submissions` row and the board stage per `boardStageFor`; `selectTeam` via `integrate` (all members) ; `completePhase` via `confirmCompletion` by partner or admin, skipping `completion_review` by running `requestCompletion` then `confirmCompletion` in one request when the actor is the partner or admin), `worker/src/reminders.ts` (queries on `projects`/`reviews`; the Lab digest counts open reviews, pending partners, pending org requests, requested meetings), `worker/src/index.ts` (route order: accounts → orgs → taxonomy → postings → projects → reviews → court/shell → pipeline), `worker/src/notify.ts` (drop `approverIds`, `teamIds`)
- Test: `worker/test/pipeline.test.ts` (ported essentials), existing tests still pass

**Interfaces:**
- Produces: `/queue` deleted (replaced by `/reviews` and `/shell`). `/overview` admin only, shape unchanged plus `orgs: Array<{ id, name, people: number, primary: Person | null }>` and `requests: pending org requests`. `/partners/:id/approve` admin only and calls `ensureOrgFor`. `/accounts/:id/status` and `/accounts/:id/claude` admin only. `/profiles/:handle` reads level from the row and projects from `projects`.

- [ ] **Step 1: Write the failing tests**: member submits a board (PDF) on an `active` project → project `submission_review`, board `live`; rep `return` → `submission_returned`, board `prototype`, launch cleared; rep `accept` → `delivered`, partner can list the board and download the report; partner `select` → `integrated`, team level `builder`; partner `complete` → `complete`; `/queue` → 404; `/overview` by a rep → 403, by admin → 200 with `orgs`.
- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run to verify they pass**; also `cd worker && npm run check`.
- [ ] **Step 5: Commit** `git commit -m "Move boards, submissions and phase 2 onto the project pipeline"`

---

### Task 13: Court and shell counts

**Files:**
- Create: `worker/src/court.ts`, `worker/src/shell.ts`, `src/lib/pipeline/court.ts`
- Test: `worker/test/court.test.ts`, `worker/test/shell.test.ts`, `scripts/court.test.mjs`

**Interfaces:**
- Produces (shared): `type CourtItem = { role: Role; kind: "project" | "posting" | "review" | "org_request" | "meeting" | "submission" | "partner"; id: string; title: string; subtitle: string; status: string; urgency: "action" | "work"; since: string; href: string }`; `courtSort(items)`: action first, then oldest `since` first.
- Produces (Worker): `getCourt(env, user): Promise<CourtItem[]>` with Gantry's membership rules for this phase: member = own projects in claimed, plan_returned, active, submission_returned, integrated (action for claimed and `*_returned`, work otherwise); partner with org = org postings in draft (work) and returned (action), pending org requests when primary (action), org projects in delivered with no selection (action) and completion_review; rep or admin = open reviews unassigned or assigned to me (action), requested meetings (action); admin also = pending partner accounts (action), org requests older than 7 days or whose org has no primary (action). `href` values: project → `/projectum?project=<boardId>` (or `?view=myprojects` when no board), posting → `/projectum?posting=<id>`, review → `/projectum?view=review&id=<id>`, org request → `/projectum?view=org`, partner/meeting → `/projectum?view=overview`.
  - `GET /court` → `{ items: CourtItem[] }`.
  - `GET /shell` → `{ court: number (action items), reviews: number (open reviews, staff), unread: number, notifications: NotificationOut[] (12 newest), requests: number (org requests for the primary) }`.

- [ ] Steps: failing tests for each role's court membership on a seeded pipeline (member with a `plan_returned` project sees an action item; partner primary sees a pending request; rep sees the open review; admin sees the pending partner), `courtSort` order, `/shell` counts → implement → pass → commit `"Compute In your court and the shell counts"`.

---

### Task 14: Site data layer: types, stores, polling, sidebar

**Files:**
- Create: `src/components/projectum/shell-store.ts`
- Modify: `src/components/projectum/pipeline-store.ts` (types `Posting`, `ProjectOut`, `ReviewOut`, `CourtItem`, `Org`; `send()` also calls `pollShell()`), `src/components/projectum/project-store.ts` (`/projects` → `/boards`, `BoardEntry` gains `projectId`, `status`, `postingTitle`, `view`), `src/components/projectum/notifications-menu.tsx` (reads from `shell-store`), `src/components/projectum/app-sidebar.tsx` (nav per role), `src/components/projectum/projectum-view.tsx` (new views), `src/content/copy.ts`
- Test: `scripts/nav.test.mjs` (extract `navItems` into `src/components/projectum/nav.ts` so it is testable)

**Interfaces:**
- Produces: `useShell(): { court: number; reviews: number; unread: number; requests: number; notifications: NotificationOut[]; loaded: boolean }` polling `GET /shell` every 30 s while `document.visibilityState === "visible"`, immediately on focus, and via `pollShell()` after every `send()`; `markRead(ids | "all")`.
- Produces: `ProjectumView = "board" | "postings" | "posting" | "myprojects" | "projects" | "project" | "reviews" | "review" | "inbox" | "org" | "overview"`. `navItems(me: Account, counts: ShellCounts): NavItem[]`: member → Notice Board, My Projects, All Projects, In your court (badge court); partner → My Postings, Organization (badge requests), In your court; rep → Notice Board, Reviews (badge reviews), All Projects, In your court; admin (in addition to their base role) → Reviews, Overview. `pickView` maps `?posting=`, `?project=`, `?view=review&id=`.

- [ ] **Step 1: Write the failing test** for `navItems` per role and `pickView` for a partner asking `view=board` (falls to `postings`).
- [ ] **Step 2: Run to verify it fails**
- [ ] **Step 3: Implement** stores, nav, view routing with placeholder components for views that later tasks build (each renders the copy's title). Add copy keys under `copy.projectum.pipeline`: `nav.myPostings`, `nav.myProjects`, `nav.reviews`, `nav.inbox`, `nav.org`, and section titles.
- [ ] **Step 4: Run `npm run check`** (site). Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Poll the shell for counts and route the new Projectum views"`

---

### Task 15: Building blocks: status pill, stage bar, hand-off dialog, next steps, transition bar

**Files:**
- Create: `src/components/projectum/status-pill.tsx`, `stage-bar.tsx`, `handoff-dialog.tsx`, `next-steps.tsx`, `transition-bar.tsx`
- Modify: `src/app/globals.css` (tone tokens for the nine tones, light and dark), `src/content/copy.ts`

**Interfaces:**
- Produces: `<StatusPill kind="posting"|"project" status={s} />` (label and tone from `stateOf`, tooltip = hint plus "Whose move: <court>"); `<StageBar status={ProjectStatus} self={boolean} />` (segments from `PROJECT_FLOW`, self omits delivered and integrated, returned states red); `<HandoffDialog open copy={HandoffCopy} feedback={"required"|"optional"|undefined} onConfirm(feedback) onCancel />` (numbered steps, feedback textarea, confirm label from copy, ⌘/Ctrl+Enter confirms); `<NextSteps copyKey ctx />` renders `NEXT_STEPS[key](ctx)` with tone; `<TransitionBar kind id status roles ctx onDone />` renders one button per `transitionsFrom(kind, status, roles)`, opens `HandoffDialog` when the transition has `handsTo` or `feedback`, posts `POST /<kind>s/:id/transition` via `send()`, shows API errors (`state` → "Already moved on. Reload to see the latest.", `feedback` → "Add notes so they know what to change.").

- [ ] Steps: build components; add a `scripts/transition-bar.test.mjs` that checks `buttonsFor(kind, status, roles)` (a pure helper exported from `transition-bar.tsx`'s sibling `transition-buttons.ts`) returns Gantry's labels in machine order; `npm run check` passes; commit `"Add the status pill, stage bar, hand-off dialog and next steps"`.

---

### Task 16: Postings in the UI: notice board, my postings, posting form, posting page

**Files:**
- Create: `src/components/projectum/postings-view.tsx` (`NoticeBoard`, `MyPostings`), `posting-form.tsx`, `posting-view.tsx`
- Delete: `problems-view.tsx`, `problem-form.tsx`, `problem-view.tsx`
- Modify: `claim-form.tsx` → `claim-dialog.tsx` (teammate picker plus the `project.claim` hand-off), `src/content/copy.ts`

**Interfaces:**
- `NoticeBoard`: `GET /postings?scope=board`; cards show org, title, summary, disciplines, effort, deadline, `counts.open`, `StatusPill`; a discipline filter built from values present; "Claim" opens `ClaimDialog` (teammates from `/people`, then the `project.claim` hand-off, then `POST /postings/:id/claim`, then navigates to `?project=<boardId>`); shows "You're on this" with a link when `myProject`.
- `MyPostings` (partner): table with title, status pill, counts, updated; "Post a problem" opens `PostingForm`; a partner without an org sees the copy `pipeline.postings.noOrg` and a link to `?view=org`.
- `PostingForm`: fields from `PostingDraft` (disciplines from `GET /taxonomy`), buttons "Save draft" and "Send for review" (the latter runs the `posting.submit` hand-off).
- `PostingView` (`?posting=<id>`): header with status pill and `TransitionBar`, `NextSteps` for the org, details, review history (rounds with feedback), projects on it (`GET /projects?posting=`), edit button (org, not in review).

- [ ] Steps: build; `npm run check`; manual check against `wrangler dev` with `DEV_CODES=1`: partner posts, rep returns, partner resubmits, rep publishes, member sees it; commit `"Post, review and publish postings in Projectum"`.

---

### Task 17: Projects in the UI: my projects, plan editor, board header

**Files:**
- Create: `src/components/projectum/my-projects-view.tsx`, `plan-editor.tsx`
- Modify: `project-board.tsx` (header gets `StatusPill`, `StageBar`, `NextSteps`, `TransitionBar` for the project; Solidifying dialog's steps are the plan milestones; "Submit action plan" appears when status is `claimed`/`plan_returned`; board is read-only with a notice when `boardAccess` is `locked`), `all-projects.tsx` (status pill per card; colleagues see outline only), `plan-dialog.tsx` (milestone rows gain a criterion field), `src/lib/projects.ts` (no shape change; `Step` text convention `"<title>. <criterion>"` documented), `src/content/copy.ts`
- Delete: `claims-view.tsx` (`MyClaims`, `Approvals`)

**Interfaces:**
- `MyProjects` (`?view=myprojects`): `GET /projects/mine` rows with posting title, status pill, stage bar, team, next due (`plan.finishBy`), opened board link; `NextSteps` inline for `*_returned`.
- `PlanEditor`: approach, milestones (title, criterion), finish by; saves with `PUT /projects/:id/plan`; "Submit action plan" runs the `project.submitPlan` hand-off then `POST /projects/:id/transition`.
- Board header: when `plan_returned`, the latest review feedback shows above the plan with the `project.plan_returned.member` next steps.

- [ ] Steps: build; `npm run check`; manual: claim, write plan, submit, rep returns, notes visible, resubmit, approve, board unlocks at Solidifying; commit `"Write and submit action plans from the board"`.

---

### Task 18: Reviews queue and review page in the UI

**Files:**
- Create: `src/components/projectum/reviews-view.tsx`, `review-view.tsx`

**Interfaces:**
- `ReviewsView` (`?view=reviews`): `GET /reviews` rows (gate label, title, who, waiting since, assignee) with "Take" and open; j/k and enter move and open (keyboard only; the full hotkey registry is phase 8).
- `ReviewView` (`?view=review&id=`): for `posting` the frozen posting fields; for `action_plan` the frozen plan plus the board's read-only brief; history of rounds; `TransitionBar` restricted to the gate's two transitions; "Take" when unassigned. A submission entry (`sub:` id) opens today's submission review controls moved from `claims-view.tsx`.

- [ ] Steps: build; `npm run check`; commit `"Review postings and plans from one queue"`.

---

### Task 19: In your court and the inbox

**Files:**
- Create: `src/components/projectum/court-list.tsx`, `inbox-view.tsx`
- Modify: `postings-view.tsx` (`NoticeBoard` and `MyPostings` show a `CourtList` strip of up to 5 action items at the top with a link to the inbox), `notifications-menu.tsx` (court notifications get a dot)

**Interfaces:**
- `CourtList items limit? />`: fixed columns title, subtitle, status pill, since; empty state copy `pipeline.court.empty`.
- `InboxView` (`?view=inbox`): `GET /court` list plus notifications from `useShell` with "Mark all read".

- [ ] Steps: build; `npm run check`; commit `"Show everyone what is in their court"`.

---

### Task 20: Organization page and first-login org flow

**Files:**
- Create: `src/components/projectum/org-view.tsx`
- Modify: `account-gate.tsx` (a pending partner with a pending org request sees "Waiting for <org> to approve you" with the org name; a pending partner without one sees today's note), `profile-settings.tsx` (partner: org name link)

**Interfaces:**
- `OrgView` (`?view=org`, partners; staff via `?view=org&id=`): profile form (primary edits), people list with primary badge, pending requests with approve and decline (note), transfer primary, remove person; each uses the Task 8 endpoints via `send()`.

- [ ] Steps: build; `npm run check`; commit `"Add the organization page for partners"`.

---

### Task 21: Overview, settings and copy pass

**Files:**
- Modify: `overview-view.tsx` (admin only; adds organizations and pending join requests tables; account on/off and Claude access unchanged), `settings-tabs.tsx`/`profile-settings.tsx` (member interests picker from `/taxonomy`, saved via `PATCH /me { interests }`), `worker/src/accounts.ts` (`PATCH /me` accepts `interests`), `src/content/copy.ts`, `scripts/copy-lint.mjs` (no rule changes; run it)

- [ ] Steps: implement; `npm run check` in both; commit `"Give admins the overview and members an interests picker"`.

---

### Task 22: Remove the dead paths and update the docs

**Files:**
- Modify: `worker/README.md` (endpoint table, new tables, dry-run step before deploy), `worker/src/index.ts` header comment, `src/components/projectum/*` (no imports of deleted files), `AGENTS.md` is untouched.
- Delete: anything unreferenced (`grep -rn "claims-view\|problems-view\|problem-view\|problem-form\|/queue\|isApprover\|approverIds\|teamIds" src worker/src` returns nothing).

- [ ] Steps: grep clean; `npm run check` in both; `npm test` in worker; commit `"Tidy the pipeline after the gates and orgs change"`.

---

### Task 23: Ship

Run Step 2 (Worker deploy) and Step 4 (push `main`, Pages) back to back. Between them the new Worker serves the old site: tabs left open on the old site break until they reload, and expect a burst of admin alerts from those failed calls. Both settle once Pages is live.

- [ ] **Step 1:** `cd worker && bash scripts/dry-run-migration.sh` against the current remote export. Expected: exit 0, counts match. The script keeps the export at `worker/backups/<timestamp>.sql` and prints the path; keep that file until the deploy has settled.
- [ ] **Step 1b:** Record a D1 Time Travel bookmark right before deploying: `npx wrangler d1 time-travel info appliedlab-projectum`. Write down the bookmark id. To undo the migration: `npx wrangler d1 time-travel restore appliedlab-projectum --bookmark=<id>`.
- [ ] **Step 2:** `cd worker && npm run deploy` (applies 0010 remotely, then deploys). Expected: migration applied once, Worker live.
- [ ] **Step 3:** Call `GET /boards` once as an admin (or wait for the cron) so `ensureBoards()` creates boards for migrated `plan_review` projects. Check `SELECT COUNT(*) FROM projects p WHERE NOT EXISTS (SELECT 1 FROM boards b WHERE b.project_id = p.id) AND p.status NOT IN ('withdrawn','complete')` is 0 via `wrangler d1 execute --remote`.
- [ ] **Step 4:** Push `main`; confirm the Pages workflow is green; run `scripts/publish-live.sh "Gates and orgs"`.
- [ ] **Step 5:** Smoke test on appliedlab.ai as a member, a partner and a rep: notice board loads, a partner's old problems show as live postings, an old approved claim shows as an active project with its board, the rep sees the reviews queue, the bell works.
- [ ] **Step 6:** Commit any doc fixes and tag `phase-1`.

---

## Self-review notes

- Spec coverage: roles and admin (Task 4), orgs and join requests (8, 20), postings with gate 1 (9, 16), project statuses and the action-plan gate with rounds, required notes, baselines (10, 17), reviews queue and page (11, 18), court, inbox, shell polling (13, 14, 19), hand-off dialogs and next steps (15), migration (3, 23), taxonomy seed (3, 7). Phase 1 deliberately leaves the milestone tree, teams UI, messages, and act-as to later phases.
- Names used across tasks: `transition`, `emit`, `ensureOrgFor`, `boardAccess`, `boardStageFor`, `projectOut`, `postingOut`, `ReviewOut`, `CourtItem`, `useShell`, `send`, `/boards`, `/projects/:id/transition`, `/postings/:id/transition`.
- Two-batch note in Task 6 is the one place concurrency is decided; Tasks 9, 10 and 12 all go through it.
