# Gantry Port Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Projectum to four of Gantry's rules (admin-set levels, reps held for approval, private projects; returned states kept) and add withdraw reasons with reopen, extra posting fields, a categories editor, notification settings and a daily digest.

**Architecture:** All server work is in the Cloudflare Worker (`website/site/worker/src`), with D1 schema changes as new numbered migrations and guarded SQL in `db.batch()`. The UI is the static Projectum app (`website/site/src/components/projectum`), talking to the Worker with the bearer token through `src/lib/account.ts` `api()` and `pipeline-store.ts` `send()`/`useApi()`.

**Tech Stack:** TypeScript, Cloudflare Workers + D1, vitest with `@cloudflare/vitest-plugin` (worker tests), node:test (site tests), Next.js static export, shadcn (Base UI) components.

**Spec:** `website/site/docs/superpowers/specs/2026-11-10-gantry-port-phase-a-design.md` (inventory: `2026-11-10-gantry-port-inventory.md` beside it).

## Global Constraints

- Keep the backend: Worker + D1 raw prepared SQL. No Drizzle, no new runtime dependencies.
- Every status change goes through `transition()` (`worker/src/transition.ts`); guarded `UPDATE ... WHERE status IN` and `db.batch()`.
- Each schema change is a new file `worker/migrations/00NN_<name>.sql`, numbered after `0011_passwords.sql` in task order.
- Rendered copy only in `src/content/copy.ts`; `node scripts/copy-lint.mjs` clean (no em dashes, no semicolons in prose, banned words).
- Commands: worker tests `cd website/site/worker && npx vitest run`; worker types `npx tsc --noEmit` in `worker/`; site tests `cd website/site && npm test`; site types `npx tsc --noEmit`.
- Levels are `affiliate | sponsored | builder`. Roles are `member | rep | partner` plus admin from `users.roles`/`APPROVERS`.
- Returned statuses (`returned`, `plan_returned`, `submission_returned`) stay exactly as they are.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- An admin who is also the member changes their own level: allowed only for admins; a member calling the level route gets 403.
- An APPROVERS address (`dantesmith@mail.weber.edu`, a member) and an @weber.edu admin listed in `APPROVERS` must never be held pending, or nobody can approve anyone.
- A rep who was already active before this change stays active (no migration flips existing rows).
- Reopening a project whose posting has since closed, or whose member already holds another active project (`one_active_project` trigger): the reopen is refused with a clear error, not a 500.
- A notification kind someone turned off in the app must still reach staff alerts that aren't notifications (`alerts.ts`), and the in-app bell count must match what was stored.

---

### Task 1: Levels are set by an Admin

**Files:**
- Modify: `worker/src/projects.ts` (approvePlan effects, ~370-410: drop the Sponsored promotion and its `member.level_changed` emits)
- Modify: `worker/src/phase2.ts` (integrate effects, ~40-65: drop the Builder promotion and emits)
- Modify: `worker/src/overview.ts` (route `POST /accounts/:id/level`, handler `setLevel`; header comment)
- Modify: `src/components/projectum/overview-view.tsx` (a level select on each member row)
- Modify: `src/content/copy.ts` (level select label, notification titles)
- Test: `worker/test/accounts.test.ts`, `worker/test/pipeline.test.ts`

**Interfaces:**
- Produces: `POST /accounts/:id/level` body `{ level: "affiliate" | "sponsored" | "builder" }`, admin only. 200 `{ ok: true, level }`; 400 `{ error: "level" }` for any other value or a non-member target; 403 non-admin; 404 unknown id. Emits `member.level_changed` with payload `{ level }`, notifying the member: "You are now an Affiliate" / "a Sponsored member" / "a Builder", href `/projectum`.

- [ ] **Step 1: Write failing tests**
  - `pipeline.test.ts`: approving a plan leaves every team member at `affiliate`; integrating leaves them at their prior level.
  - `accounts.test.ts` `"an admin sets a member's level"`: admin POSTs `{level:"builder"}` → 200, `/me` of the member shows `level: "builder"`, one notification of kind `member.level_changed`; a member POSTing → 403; `{level:"senior"}` → 400; a rep target → 400.
- [ ] **Step 2: Run them, expect failures** (`npx vitest run test/accounts.test.ts test/pipeline.test.ts`).
- [ ] **Step 3: Remove both automatic promotions and add `setLevel(req, env, actor, id, json)`** in overview.ts, wired in `handleAdmin` beside `status|claude`. Leave the `level_locked` column in place but stop reading it (no migration).
- [ ] **Step 4: Overview UI.** On each member row of the accounts tab, a `Select` of the three levels calling `send(\`/accounts/${id}/level\`, "POST", { level })`.
- [ ] **Step 5: Run worker tests, worker tsc, site tsc; expect pass.**
- [ ] **Step 6: Commit** "Let Admins set member levels, and stop promoting on approval".

### Task 2: Faculty wait for approval like partners

**Files:**
- Modify: `worker/src/accounts.ts` (`createUser` ~380: status `pending` for `rep` too, except APPROVERS addresses; `askApproval` and `approvePartner` wording by role; `ensureOrgFor` only for partners)
- Modify: `worker/src/overview.ts` (`approvePartnerInApp` → `approveAccountInApp`; route `POST /accounts/:id/approve`, keep `/partners/:id/approve` as an alias; skip `ensureOrgFor` for reps)
- Modify: `worker/src/orgs.ts` only if `notifyAdminsOfPartner` needs a role-neutral sibling `notifyAdminsOfPending(env, stmts, user)`
- Modify: `src/components/projectum/overview-view.tsx` (pending reps listed with Approve, button calls `/accounts/:id/approve`)
- Modify: `src/content/copy.ts` (`auth.pending` rep wording)
- Test: `worker/test/accounts.test.ts`, `worker/test/orgs.test.ts`

**Interfaces:**
- Consumes: `isAdmin(env, user)` (accounts.ts) for the APPROVERS exemption.
- Produces: `POST /accounts/:id/approve` (admin): pending → active, emits `account.approved`, emails the person; 409 `{ error: "state" }` if not pending. A pending rep's `/me` has `status: "pending"` and `pendingOrgName: null`.

- [ ] **Step 1: Failing tests:** a new `prof@weber.edu` sign-up is `pending` and the approver gets an approval email (dev log path); `/accounts/:id/approve` by an admin makes it `active` and does not create an org; an @weber.edu address listed in `APPROVERS` signs up `active`; an existing active rep row is untouched by sign-in.
- [ ] **Step 2: Run, expect failures.**
- [ ] **Step 3: Implement** the role-aware hold, approval email ("New faculty on Projectum: {name}" / partner wording kept), signed-link page wording ("signed up as faculty"), and the in-app route.
- [ ] **Step 4: UI and copy:** the waiting page (`account-gate.tsx` via `copy.auth.pending`) reads for faculty: heading "Your account is waiting for approval", body "The Lab confirms each faculty account, and we'll email you once yours is approved." Overview shows pending reps beside pending partners.
- [ ] **Step 5: Run all worker tests and both tsc; expect pass.**
- [ ] **Step 6: Commit** "Hold new faculty accounts for approval, like partners".

### Task 3: Projects are private to their people

**Files:**
- Modify: `worker/src/projects.ts` (`projectView`: no `"colleague"`; non-team members get `"none"`; remove the `View` member `"colleague"` and its handling in `projectOut`)
- Modify: `worker/src/boards.ts` (`listBoards`: drop the colleague/outline branch)
- Modify: `src/components/projectum/nav.ts` (members lose `projects` / All Projects; `pickView("projects")` falls back to home for members)
- Modify: any UI reading `view === "colleague"` (grep `colleague` in `src/`)
- Test: `worker/test/pipeline.test.ts`, `scripts/nav.test.mjs`

**Interfaces:**
- Produces: `View = "full" | "partner" | "none"`. `GET /projects`, `GET /projects/:id`, `GET /boards` return nothing for a member who isn't on the team (404 for `/projects/:id`).

- [ ] **Step 1: Failing tests:** member B gets 404 on member A's project and doesn't see it in `/boards` or `/projects`; reps and admins still see it all; the posting's partner still sees it once active; nav for a member has no All Projects.
- [ ] **Step 2: Run, expect failures.**
- [ ] **Step 3: Implement**; grep `colleague` across worker and site and remove every branch.
- [ ] **Step 4: Run worker and site tests and tsc; expect pass.**
- [ ] **Step 5: Commit** "Keep each project private to its team, partner and staff".

### Task 4: Withdraw with a reason, and Admin reopen

**Files:**
- Create: `worker/migrations/0012_withdraw_reason.sql` (`ALTER TABLE projects ADD COLUMN withdrawn_from TEXT;` and `ADD COLUMN withdrawn_reason TEXT;`)
- Modify: `src/lib/pipeline/machines.ts` (`withdraw`: `feedback: "required"`; new `reopen`: `from: ["withdrawn"]`, `to: "claimed"`, `by: ["admin"]`, `restore: true`, `event: "project.reopened"`, label "Reopen"; add `restore?: boolean` to `TransitionDef`)
- Modify: `worker/src/transition.ts` (the lock update's target is `def.restore ? ctx.project?.withdrawn_from ?? def.to : def.to`, and the rollback uses the same target)
- Modify: `worker/src/projects.ts` (withdraw effects store `withdrawn_from = <current status>`, `withdrawn_reason = feedback`; reopen effects clear both and refuse with `"state"` if the posting isn't `live`; `projectOut` exposes `withdrawnReason` to full viewers)
- Modify: `src/lib/pipeline/handoffs.ts` / handoff dialog copy so Release claim asks "Why are you releasing this claim?" (feedback required) and Reopen confirms
- Test: `worker/test/pipeline.test.ts`, `scripts/machines.test.mjs`

**Interfaces:**
- Produces: `TransitionDef.restore?: boolean`; project rows gain `withdrawn_from: string | null`, `withdrawn_reason: string | null`; `ProjectOut.withdrawnReason?: string`.

- [ ] **Step 1: Failing tests:** withdraw without feedback → 400 `feedback`; with feedback → `withdrawn`, reason stored, `withdrawn_from` = prior status; admin reopen → back to that status (test from `active` and from `claimed`); member reopen → 403; reopen when the member now holds another active project → refused `state`/trigger error mapped to 409, never 500; machines test: `reopen` exists with `restore: true`.
- [ ] **Step 2: Run, expect failures.**
- [ ] **Step 3: Implement** migration, machine, transition target, effects. Catch the `one_active_project` trigger error in the reopen path and return `{ ok: false, error: "state" }`.
- [ ] **Step 4: UI:** the reason shows on the project page for full viewers; Reopen appears for admins on withdrawn projects via the existing transition buttons.
- [ ] **Step 5: Run all tests and tsc; expect pass.**
- [ ] **Step 6: Commit** "Ask why a claim is released, and let Admins reopen it".

### Task 5: More posting detail

**Files:**
- Create: `worker/migrations/0013_posting_detail.sql` (TEXT NOT NULL DEFAULT '' columns on `postings`: `business_model`, `why`, `dependencies`, `achieves`, `goal`, `key_milestones`, `drive_url`)
- Modify: `src/lib/problems.ts` (`LIMITS`: 2000 chars each, `drive_url` 500; validation: `drive_url` empty or `https://` URL)
- Modify: `worker/src/postings.ts` (create/patch accept the seven fields, validated with the shared rules; `postingOut` returns them as `businessModel, why, dependencies, achieves, goal, keyMilestones, driveUrl`)
- Modify: `src/components/projectum/posting-form.tsx` (a "More detail" disclosure with the seven fields), `posting-view.tsx` (shows filled ones under labelled headings; Drive link opens in a new tab with `rel="noopener noreferrer"`)
- Modify: `src/content/copy.ts` (labels: Business model, Why it matters, Dependencies, What it achieves, Goal, Key milestones, Drive folder)
- Test: `worker/test/postings.test.ts`, `scripts/postings-ui.test.mjs`

**Interfaces:**
- Produces: `PostingOut` gains the seven camelCase string fields (empty string when unset).

- [ ] **Step 1: Failing tests:** create with all seven round-trips through `GET /postings/:id`; `driveUrl: "javascript:alert(1)"` → 400 with issue `driveUrl`; 2001-char `why` → 400; omitted fields are `""`.
- [ ] **Step 2: Run, expect failures.**
- [ ] **Step 3: Implement** migration, limits, Worker, form, view, copy.
- [ ] **Step 4: Run all tests, tsc, copy-lint; expect pass.**
- [ ] **Step 5: Commit** "Give postings Gantry's extra detail fields".

### Task 6: Admins edit the categories

**Files:**
- Modify: `worker/src/taxonomy.ts` (admin routes; `GET /taxonomy?all=1` for admins includes archived with `active`)
- Create: `src/components/projectum/categories-admin.tsx` (list per kind, add, rename, describe, move up/down, archive/restore)
- Modify: `src/components/projectum/overview-view.tsx` (a Categories tab)
- Modify: `src/content/copy.ts`
- Test: `worker/test/taxonomy.test.ts` (new)

**Interfaces:**
- Produces: `POST /taxonomy` `{ kind, name, description? }` → 201 `{ term: { id, kind, slug, name, description, active, position } }`, slug from name (lowercase, hyphens), 409 `{ error: "slug" }` on a duplicate; `PATCH /taxonomy/:id` `{ name?, description?, active?, position? }` → 200 `{ term }`. Admin only (403 otherwise). Slugs never change after creation, so old postings keep their links.

- [ ] **Step 1: Failing tests:** admin adds "Data Science" → slug `data-science`, appears in `GET /taxonomy`; archive → gone from `GET /taxonomy` and refused by posting create (`activeDisciplineSlugs`), still on an existing posting; rename keeps slug; member → 403; duplicate → 409.
- [ ] **Step 2: Run, expect failures.**
- [ ] **Step 3: Implement** routes and UI.
- [ ] **Step 4: Run tests, tsc, copy-lint; expect pass.**
- [ ] **Step 5: Commit** "Let Admins add, rename, order and archive categories".

### Task 7: Notification settings and email

**Files:**
- Create: `worker/migrations/0014_notification_prefs.sql` (`notification_prefs (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, in_app INTEGER NOT NULL, email INTEGER NOT NULL, PRIMARY KEY (user_id, kind))`; `ALTER TABLE notifications ADD COLUMN email_pending INTEGER NOT NULL DEFAULT 0`)
- Create: `src/lib/notification-kinds.ts` (the list of kinds people can set: `{ kind, label, group, defaults: Record<Role, { inApp: boolean; email: boolean }> }` built from the event types `emit()` notifies on)
- Modify: `worker/src/events.ts` (`emit` inserts each notification with `INSERT ... SELECT ... WHERE NOT EXISTS (in_app = 0 pref)`, and sets `email_pending` from the pref or the role default)
- Modify: `worker/src/notify.ts` (routes `GET /me/notification-prefs`, `PUT /me/notification-prefs` `{ prefs: [{ kind, inApp, email }] }`; `sendPendingEmails(env)` sends and clears `email_pending` rows, called with `ctx.waitUntil` after each request that wrote notifications, and from the cron as a sweep)
- Modify: `src/components/projectum/settings-panel.tsx` (a Notifications section: one row per kind, two switches)
- Modify: `src/content/copy.ts`
- Test: `worker/test/events.test.ts`, `worker/test/notify.test.ts` (new)

**Interfaces:**
- Consumes: `sendEmail(env, to, subject, text)` (accounts.ts).
- Produces: `notificationKinds: NotificationKind[]` and `defaultsFor(role: Role): Record<string, { inApp: boolean; email: boolean }>` from `src/lib/notification-kinds.ts`; `sendPendingEmails(env: Env): Promise<number>`.

- [ ] **Step 1: Failing tests:** with no prefs, a member gets the in-app notification and `email_pending` per the role default; `in_app: false` for that kind stores nothing; `email: true` marks it and `sendPendingEmails` sends one email whose body links `${SITE_URL}${href}` and clears the flag; PUT with an unknown kind → 400; GET returns defaults merged with saved prefs.
- [ ] **Step 2: Run, expect failures.**
- [ ] **Step 3: Implement** migration, kinds list, emit change, routes, sender, settings UI.
- [ ] **Step 4: Run all tests, tsc, copy-lint; expect pass.**
- [ ] **Step 5: Commit** "Let people choose which notifications show and which email them".

### Task 8: Daily digest

**Files:**
- Create: `worker/migrations/0015_digest.sql` (`ALTER TABLE users ADD COLUMN digest INTEGER NOT NULL DEFAULT 0;` and `ADD COLUMN digest_sent_at TEXT;`)
- Modify: `worker/src/notify.ts` (`sendDigests(env, now)`: for each active user with `digest = 1`, the unread notifications created after `digest_sent_at` (or the last 24 hours), one email listing their titles with links, then `digest_sent_at = now`; nothing sent when the list is empty)
- Modify: `worker/src/index.ts` (`scheduled` calls `sendDigests` beside the reminders)
- Modify: `worker/src/accounts.ts` (`PATCH /me` accepts `{ digest: boolean }` for every role; `/me` returns `digest`)
- Modify: `src/components/projectum/settings-panel.tsx` (a "Daily digest" switch), `src/content/copy.ts`
- Test: `worker/test/notify.test.ts`

**Interfaces:**
- Produces: `sendDigests(env: Env, now: Date): Promise<number>` (emails sent); `Account.digest: boolean`.

- [ ] **Step 1: Failing tests:** a user with digest on and two unread notifications gets one email listing both, and a second run the same day sends nothing; digest off sends nothing; read notifications are left out.
- [ ] **Step 2: Run, expect failures.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all tests, tsc, copy-lint; expect pass.**
- [ ] **Step 5: Commit** "Send an optional daily digest of unread notifications".

### Task 9: Ship (needs Dante's explicit OK)

- [ ] **Step 1:** `cd worker && bash scripts/dry-run-migration.sh` against a fresh export. Expected: exit 0, every row carried forward, migrations 0012-0015 applied to the copy.
- [ ] **Step 2:** `npx wrangler d1 time-travel info appliedlab-projectum` and record the bookmark.
- [ ] **Step 3:** `npm run deploy` in `worker/`, then immediately merge to `main`, push, and `scripts/publish-live.sh "Gantry port phase A"`.
- [ ] **Step 4:** Smoke test: an admin sets a level; a new @weber.edu sign-up waits for approval; a member can't open another member's project; withdraw asks why and admin reopen works; a posting shows its extra detail; categories edit; notification switches save; the digest switch saves.
- [ ] **Step 5:** Tag `phase-a`.
