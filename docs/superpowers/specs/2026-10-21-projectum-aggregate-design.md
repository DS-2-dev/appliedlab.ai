# Projectum aggregate: Kylar's workflow on our foundation

Date: 2026-10-21. Owner: Dante Smith. Status: draft for review.

Appendices (read both before planning):

- [Appendix A: Projectum as it stands](2026-10-21-projectum-inventory.md)
- [Appendix B: Gantry feature inventory](2026-10-21-gantry-inventory.md)

Kylar's branch is checked out read-only at
`/private/tmp/claude-501/-Users-dantesmith-project-website-site/3762158d-ff54-475b-8169-de6dce4c5a34/scratchpad/platform-v2`
and fetched as remote `kylar` (`kylar/platform-v2`) in `~/project`. Read its
code whenever Appendix B is not specific enough. Copy copy text, guard rules
and status vocabularies from it. Never copy its backend, its data access, or
its React shell.

## 1. Intent

Kylar Vierra took Projectum, rebuilt it from scratch as "Gantry" (Next.js 16
server plus Postgres), and in doing so filled in every workflow the GSBE deck
implies: a review gate on partner postings, organizations with a primary
account, teams, a milestone tree with baselines, end-of-term check-ins, a
deliveries organizer, meetings with slot scheduling, showcase with partner
consent, a leads CRM with applicant status pages, templates, categories, an
audit log, per-event notification preferences, and a keyboard-first shell.

The workflow is right. The stack is not ours. Dante's decision: **keep our
foundation and aggregate Kylar's features and workflow into it.** Nothing
about how Projectum is hosted, authenticated or stored changes. Kol's branch
(`Kols-Version-of-AI-platform-69`) is out of scope.

## 2. Goals

- Every workflow, rule, status and surface in Appendix B exists in Projectum,
  behaving the same way, unless this document says otherwise.
- Projectum's own foundation stays: static Next export on GitHub Pages,
  Cloudflare Worker plus D1, bearer-token sessions, the board with its stage
  track, the sidebar, the look and the voice.
- Shipped in phases. Each phase lands on `main`, deploys, and is usable on
  its own. Existing rows migrate forward at each phase; nothing is wiped.

## 3. Non-goals

- Adopting Gantry's stack, repo layout, Drizzle schema, server actions, SSE,
  PGlite, Vercel or Neon. None of it.
- A redesign. Gantry's look is a placeholder by Kylar's own note. Projectum's
  current design language carries the new surfaces. (A separate redesign
  pass may come later; it is not this project.)
- Phone layouts for Projectum. Projectum stays desktop-only. Public pages
  still work at phone width.
- Kol's additions.
- Real-time push. Polling stays.

## 4. Anti-goals (what would make this a failure even if it works)

- Breaking the deploy story: anything that needs a Node server, a long-lived
  process, or a host other than GitHub Pages plus Cloudflare.
- Losing a current row: a problem, claim, board, submission, report, meeting,
  selection, user or notification that exists today must exist, with its
  history intact, after every migration.
- Two vocabularies. One status name and one color per status, everywhere.
  Kylar's names are the names (Appendix B, section 1).
- A hand-off without a confirmation and an explanation. Every move that
  takes the ball out of someone's court shows what happens next and asks to
  confirm; every return shows the notes and what to do.
- Decoration that slows a task. Dense, fast, keyboard-reachable.

## 5. Constraints

- **Hosting.** Front end is a static export (`output: export`, trailing
  slash) built by GitHub Actions and served by GitHub Pages at appliedlab.ai.
  No server components, no server actions, no middleware, no ISR, no dynamic
  routes at build time. Everything dynamic is client-side against the Worker.
- **Backend.** One Cloudflare Worker (`worker/`), D1 (`appliedlab-projectum`),
  KV, Workers AI, cron triggers. Add an R2 bucket for files. Durable Objects
  are allowed only if a phase cannot be built without them; none is expected
  to need one.
- **Auth.** Bearer token in `Authorization`, held in localStorage, 60-day
  sessions, email code or Google. Role from email domain. No cookies.
- **D1 is SQLite.** No arrays, no partial unique indexes on expressions with
  functions beyond what SQLite allows, no `FOR UPDATE`, no `LISTEN/NOTIFY`.
  Transactions are `db.batch()` (atomic, no reads inside). Concurrency is
  handled with conditional `UPDATE ... WHERE status IN (...)` and checking
  `changes`.
- **Email.** Resend, from the Lab's address. Inbound replies via Resend
  inbound webhook or Cloudflare Email Routing into the Worker.
- **Google.** The existing OAuth client. Incremental consent for
  `drive.file` and `calendar.events`. Tokens stored in D1, encrypted with
  `AUTH_SECRET`-derived keys.
- **Voice.** `npm run copy-lint` rules apply to every new string. Plain,
  no em dashes, no banned words. Kylar's UI copy is already plain; keep it.
- **Checks.** `npm run check` in `site/` and `npm run check` in `worker/`
  must pass at every commit. New pure logic gets `node:test` tests in
  `scripts/*.test.mjs` as today. Worker logic gets tests runnable with
  `wrangler dev` or Miniflare (builder's choice, one way, documented).

## 6. Decisions

### 6.1 The board absorbs the project model

Projectum's board (Brainstorming, Solidifying, Prototype, Live, with plan,
builds and launch) is the team's workspace. Gantry's project status is the
pipeline. Both exist, with one rule: **the pipeline status is the source of
truth for gates, court, visibility and notifications; the board stage is the
team's working view inside the Active status.**

Mapping:

| Pipeline status (new, canonical) | Board stage | Notes |
|---|---|---|
| claimed, plan_review, plan_returned | solidifying | The action plan is the Solidifying gate's content. Board is read-only to the team while `plan_review`. |
| active | solidifying → prototype | Team moves the board on its own. Prototype gate (GitHub URL, builds) stays as today. |
| submission_review | live | Submit work flips the board to Live and opens the submission review, as today. Board locked for the team. |
| submission_returned | prototype | Return clears the launch and drops the board back to Prototype, as today. |
| delivered, integrated, completion_review, complete | live | Phase 2 panel on the board, as today, with Gantry's integrate / request completion / confirm / return. |
| withdrawn | (board kept, read-only) | |

Concretely:

- **Plan steps become milestones.** The Solidifying dialog's `steps` (text,
  owner) become the top level of Gantry's milestone tree (title, criterion,
  due date, assignee, status, nesting to depth 3). Thesis, reasoning and
  tech stack stay as the plan's prose fields. The action plan a rep reviews
  is thesis + reasoning + tech stack + the milestone tree. Existing `steps`
  migrate to depth-0 milestones with `criterion` empty.
- **The build log becomes the progress log.** Builds stay (number, note, tech
  stack, at) and are one kind of progress-log entry. Free-form progress
  entries and milestone-linked entries are added alongside.
- **Baselines.** Approving the plan snapshots the milestone tree. Every later
  change is recorded with who, when and why, and the board shows the
  comparison, as Gantry does.
- **Stage records stay.** The board keeps its snapshot of each stage as it
  left it.
- **Brainstorming stays** for boards members create themselves before
  proposing a project. Proposing creates the self-directed posting and
  moves the pipeline to `claimed`; the board moves to Solidifying.

### 6.2 Roles

Four roles: `member`, `partner`, `rep`, `admin`. A user can hold more than
one (`roles` list), and picks a portal when they do, as in Gantry.

- Domain rule stays: `mail.weber.edu` → member, `weber.edu` → rep, else
  partner.
- **Admin replaces the approver concept.** Addresses in `APPROVERS` (and
  `APPROVER_EMAIL`) are admins. Admins can also be set from the admin People
  page. Reps are not admins by default any more; they get Gantry's rep
  permissions (gates, read-only everything, observe, partner notes).
- Gantry's permission matrix (Appendix B, section 1 "Authorization" and
  "Who sees what" in its `docs/ARCHITECTURE.md`) applies.

### 6.3 Onboarding and leads

- **Students stay instant.** A `mail.weber.edu` sign-in gets an active member
  account on first login, as today. Gantry's `leads.autoApproveStudents`
  setting exists and is on by default. Turning it off makes students wait
  like everyone else.
- **Partners and faculty go through Leads.** A first sign-in or a public
  join form creates a lead; the applicant gets a status page by signed link;
  an admin (or anyone granted lead access) follows up and decides. This
  replaces today's single approver email link. The `/approve` HMAC link is
  kept working as a shortcut that approves the lead.
- Partners belong to an organization. On first partner sign-in the person
  picks or creates their organization (join request to its primary, or a new
  org that an admin verifies). Existing partner users each get an
  organization created from their email domain (or their name when the
  domain is a personal mail provider), with themselves as primary.

### 6.4 Postings replace problems

- `problems` become `postings` with Gantry's statuses and gate 1 (rep
  review). Existing open problems migrate to `live`, closed to `closed`,
  member-origin ones to `kind = self`, `closed`, hidden from the board.
- A posting carries disciplines and tags from the managed taxonomy, effort,
  deadline, a body (see 6.7 documents), files, an optional sealed solution,
  and show-on-profile.
- Claims enter the project machine. `claim_members` become
  `project_members` with the claim owner as lead. Claim `plan` JSON migrates
  into the board's plan plus milestones. Status comes from the row's state:

  | Today | Project status after migration |
  |---|---|
  | claim `pending` | `plan_review`, with an open round-1 action-plan review. A board is created from the plan JSON at Solidifying (today boards only exist after approval). |
  | claim `approved`, no submission | `active` |
  | submission `pending` | `submission_review` |
  | submission `returned` | `submission_returned` |
  | submission `accepted`, no selection | `delivered` |
  | selection, not completed | `integrated` |
  | selection `completed_at` set | `complete` |
  | claim `withdrawn` | `withdrawn` |
  | claim `denied` | `plan_returned`, with the round-1 review closed as `returned` and the denial note as its feedback. Gantry has no terminal "reject", and that is the model we are adopting: the team may fix and resubmit. (Builder's call, confirmed by Dante.) |

  Review rounds, reviewer and decision time carry over from `reviewed_by`
  and `reviewed_at`. Meetings `requested` or `arranged` become meetings in
  `requested` (no slots yet) or `scheduled` (with `starts_at` empty, shown
  as "arranged" until someone sets a time).

### 6.5 Mechanics on our stack

| Gantry mechanism | Projectum mechanism |
|---|---|
| One transition function in a Postgres transaction | One `transition()` in the Worker: load, check `from`, authorize, guard, build statements, `db.batch()`, then notify. Status change uses `UPDATE ... WHERE id=? AND status IN (...)`; zero changes means "already moved on". |
| Machines as data (`machines.ts`) | Same file shape, shared between Worker and site via `src/lib/pipeline/machines.ts` (pure data, imported by both). Labels, courts, hotkeys, hand-off copy, next-steps copy live there. |
| SSE live bus | Polling. One `GET /shell` endpoint returns counts (court, reviews, deliveries, unread notifications, unread threads) plus the newest notifications; the shell polls it every 30 s while the tab is visible and after every mutation. Pages re-fetch their own data after mutations via the existing `send()` refresh. |
| Events table plus notifications plus outbox | Same three tables in D1. `notify()` writes events, per-user notifications by preference, and outbox rows, inside the same `batch()`. |
| Email instant and digest crons | Worker cron: hourly `deliverInstant` and `deliverDigests` (per user digest hour, Lab time); daily health, reminders, term check-ins, Drive sync, notification cleanup. |
| Files on disk or in Postgres | R2 bucket `appliedlab-files`. Worker streams with access checks. Reports move from KV to R2 in phase 5 (KV reads kept until migrated). |
| Sealed solutions with `node:crypto` | Web Crypto AES-256-GCM in the Worker, key in a secret `SEALED_SOLUTION_KEY`. Secure viewer is a client route that fetches plaintext with `no-store` and renders with copy and print blocked. |
| TipTap documents, server-rendered read views | TipTap in the client for editing; stored as ProseMirror JSON in D1. Read-only view renders from JSON in the client. Export to Word and PDF client-side with `docx` and `pdfmake`, as Gantry does. |
| Google Drive mirror with in-process queue | Mirror runs in the Worker: a mutation enqueues a per-user sync row; a cron drains it; "Sync now" calls the drain for one user. |
| Google Calendar event with Meet link | Phase 4 ships `.ics` files and "Add to Google Calendar" links, which need no OAuth scope. Creating the event with a Meet link from the confirmer's Google account needs the sensitive `calendar.events` scope, which puts Google's "unverified app" warning on our published OAuth client and caps it at 100 users until Google verifies the app. That connect button ships only after Dante completes Google verification (privacy policy page, homepage check); until then it is hidden. Drive's `drive.file` scope is non-sensitive and needs no review. |
| Inbound email webhook (Next route) | Same webhook on the Worker, same signed `lead+<id>.<sig>@` and `log+<user>.<sig>@` addresses. |
| Permission-aware search endpoint | `GET /search?q=` on the Worker using SQLite `LIKE` (and FTS5 if the builder finds it worth it). |
| `revalidatePath` for public pages | Public pages that show live data (home numbers, showcase, partners, member profiles, meetings agenda) fetch from the Worker on the client with short caching. Static shells build at deploy. |
| Access-code gate, demo sign-in | Not ported. Our local dev uses `DEV_CODES=1`. A demo seed script for local D1 is added (6.9). |
| Act-as (session stores `acting_as_user_id`) | Same: sessions table gets `acting_as_user_id` and `portal`. Every event stamps `via_user_id`. |

### 6.6 Court, notifications, preferences

- "In your court" is computed from live data by one Worker query per role,
  with Gantry's exact membership rules (Appendix B, section 7). It feeds the
  home page, the inbox and the sidebar badge.
- Notification preferences: per event in-app and email (off, instant,
  digest), court-only mode, quiet hours, digest hour, muted subjects. Court
  notifications are always delivered in-app. Message notifications are exempt
  from court-only. Same decision order as Gantry's `decide()`.
- The existing reminders (Lab digest, deadline, quiet board) stay and are
  re-expressed as events so they respect preferences.

### 6.7 Documents and files

- Three document kinds, as Gantry: in-app editor, uploaded file, linked
  Google Doc. Contexts: posting body, action plan, submission, milestone
  note, publication, personal.
- Today's PDF report upload is the "uploaded file" kind of the submission
  document. Today's `notesUrl` Google Doc is a linked document on the
  project. Both migrate without user action.
- Versions are snapshotted on every gate submission; reviewers read the
  frozen version.
- Folders, trash and restore, move, rename, links, Drive picker as in Gantry.

### 6.8 Public site

Gantry's public pages (about per role, join per role, pipeline explainer,
principles verbatim, meetings with public agenda, partners and partner
pages, showcase and entries, member profiles, student-work policy) are added
to the site in the site's existing design language. Static where they can
be; live numbers and lists fetched from the Worker client-side. The current
landing page stays and gains the live numbers.

### 6.9 Local development and demo data

- A seed script (`worker/scripts/seed-demo.ts`, run against local D1)
  creates Gantry's demo Lab: the organizations, members, reps, partners,
  pending accounts, leads, postings and projects in every status (Appendix
  B, section 10), with dates shifted forward by whole weeks so deadlines stay
  ahead. Development only; never run against the remote database.
- `DEV_CODES=1` sign-in works for any seeded address.

### 6.10 Phases

Each phase: D1 migration(s) that convert existing rows, Worker endpoints,
shared machine data, UI, tests, deploy. Later phases may reorder if a real
partner or a Thursday demo needs something sooner; Dante decides.

1. **Gates and orgs.** Roles list and admin role. Organizations with primary
   account and join requests. Postings with gate 1. Projects with Gantry
   statuses and the action-plan gate with rounds, required notes, baselines.
   Reviews queue and review page. Court list, inbox, shell counts polling.
   Hand-off dialogs and next-steps banners. Migration of problems, claims,
   claim members, boards. Taxonomy table seeded with the current fields.
2. **Workspace.** Milestone tree (list and map), progress log, milestone
   changes and baseline comparison, teams (invite, request, leave, remove,
   make lead), self-directed projects, withdraw, planned semesters, people
   directory, profiles with level, highlight and interests.
3. **Delivery.** Submission with AI disclosure, score, frozen snapshot.
   Deliveries organizer (kanban and list). Student-work policy and
   acknowledgment, share and unshare work. Phase 2 in full. Showcase with
   partner consent, admin redaction, public showcase pages.
4. **Conversation.** Threads and messages (direct, project, posting, org,
   meeting). Meetings with slots, accept, confirm, `.ics`, Google Calendar,
   rep auto-assignment. Notification preferences, events catalog, outbox,
   instant and digest email. Reminders re-expressed as events.
5. **Documents and files.** R2. Documents with three kinds, versions, export.
   Folders, files, trash, links, Drive picker. Reports move to R2. Sealed
   solutions and the secure viewer. Drive mirror and Calendar connect in
   Settings → Integrations.
6. **Leads.** Join forms per role, applicant status pages, leads list and
   detail with feed, notes, email out and in, templates (universal, shared,
   personal, `/` picker), lead access grants, auto-approve students setting,
   org join flow on first partner sign-in, `/approve` link kept as shortcut.
7. **Admin.** Dashboard widgets, admin queue and tasks (AI seat, welcome
   partner, lead follow-up), people and levels with lock, invite, act-as
   with banner, portal switch, observe, categories (add, rename, merge,
   retire, reorder), audit log with facets and CSV, Lab settings (terms,
   weekly meeting, contact), term check-ins and seat renewals, agenda.
8. **Shell and public.** Hotkey registry, `g` navigation, per-page
   bindings, ⌘K palette with server search, `?` sheet, pointer conventions.
   Public pages from 6.8. Demo seed script. Shortcut settings page.

Phases 1 to 3 are the pipeline and must ship in order. Phases 4 to 8 are
independent of one another and can be reordered or interleaved.

### 6.11 Calls made during review

- Posting body is plain text until documents land in phase 5.
- Phase 6 (leads) builds after phase 4, since it needs the outbox and the
  inbound webhook. Between phases 1 and 6, partners are still approved by
  admins through the existing link, and get an organization created from
  their email domain on approval.
- Claim-time teammates stay as direct adds until teams land in phase 2.
- Members see other teams' projects as outlines only (Gantry's matrix).
  Reps lose problem posting (they never had a button for it).
- Gantry's dynamic routes become `?param=` routes on `/projectum`, as today.

## 7. Left to the builder

- Exact D1 table and column names, as long as they follow Appendix B's
  shapes and today's naming style (snake_case, text ids, ISO timestamps).
- How to split the Worker into modules as it grows (today: `accounts.ts`,
  `pipeline.ts`, `notify.ts`, `reminders.ts`, `alerts.ts`).
- Component structure inside `src/components/projectum`, as long as new
  surfaces reuse the existing sidebar, dialogs, `pipeline-ui.tsx`
  primitives and shadcn `ui/`.
- The polling interval details and backoff.
- Whether to use SQLite FTS5 for search.
- Test tooling for the Worker.
- Migration scripts' exact steps, as long as every current row survives and
  a dry run against a D1 export is part of each phase's checklist.
- Order within a phase.

## 8. Open questions for Dante

One to answer before phase 3 decides how shared work is stored:

0. **R2 and the Workers plan.** `worker/wrangler.jsonc` notes that reports
   went to KV because R2 was not enabled on the account (it needs a payment
   method). Phases 3 and 5 assume an R2 bucket. If R2 is not coming, files
   stay limited to the current PDF-in-KV (25 MB value cap) and documents are
   editor or Google-link only. The plan tier also sets the request budget for
   the shell poll (free tier: 100k requests a day), which fixes the interval.

Two to answer before their phases:

1. Phase 4: should partners be able to export a delivered submission to
   Word or PDF (Gantry allows it under the policy), or read it only on the
   platform?
2. Phase 7: the semester calendar defaults (Kylar guessed Summer 2026 to
   Spring 2028). Confirm against the WSU academic calendar in `reference/`.
