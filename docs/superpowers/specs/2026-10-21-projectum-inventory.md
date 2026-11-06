# Appendix A: Projectum as it stands (2026-10-21)

Read-only inventory of `website/site` on `main`. This is the foundation that
stays. Everything in the design builds on it.

## Routes (`src/app`)

- `/` landing page: hero, HowItWorks, `AskTheLab` chat (POSTs to the Worker root).
- `/login`: emailed 6-digit code or Google. A new address is asked for a name.
- `/signup`: same form with a role pick passed to Google, which rejects a mismatched address.
- `/projectum`: the only signed-in app. `AccountGate` sends signed-out users to login and shows pending partners a waiting note. View chosen client-side from `?view=`, `?project=`, `?problem=`. Views: `board`, `mine`, `claims`, `queue`, `overview`, `projects`, `project`, `problem` (`projectum-view.tsx:33-45`).
- `/projectum` error boundary posts to `/client-errors`.
- `/profile?u=<handle>`: public member profile (`GET /profiles/:handle`).

## Projectum components (`src/components/projectum`)

- `account-gate.tsx`, `projectum-view.tsx` (picks view by role, theme and sidebar cookies), `static-projectum.tsx` (shell).
- `app-sidebar.tsx`: nav by role (`navItems` :96). Partners: My Problems only. Others: Notice Board. Members add My Claims. Approvers add Approvals (count from `GET /queue`) and Overview. Everyone but partners: All Projects. Holds the bell and Settings.
- `notifications-menu.tsx`: bell, `GET /notifications` polled every minute while visible, `POST /notifications/read`.
- `problems-view.tsx` (NoticeBoard, MyProblems from `GET /problems`), `problem-form.tsx`, `problem-view.tsx` (problem plus claims, open/close, claim cards with phase-two actions).
- `claim-form.tsx`: action plan (approach, milestones, finishBy, teammates) to `POST /problems/:id/claims` or `POST /proposals`.
- `claims-view.tsx`: MyClaims (withdraw) and Approvals (`GET /queue`, claim review, submission review, meeting arranged, partner approve).
- `overview-view.tsx`: approver tables (`GET /overview`, account status, Claude access, partner approve).
- `phase-two.tsx`: PartnerActions (meeting, select), PhasePanel (phase milestones, complete).
- `pipeline-store.ts`: `useApi(path)` cache, `send()` refreshes every cached path, `submitWork` (multipart PDF), `downloadReport`.
- `project-store.ts`: boards from `GET /projects`, serial `PUT /projects/:id` queue.
- `project-board.tsx`: one board. Stage track Brainstorming, Solidifying, Prototype, Live. Plan, builds, launch, PhasePanel.
- `all-projects.tsx`, `project-folders.tsx` (sidebar tree, Add Project proposes), `add-project-dialog.tsx`, `plan-dialog.tsx` (Solidifying and Prototype gates: thesis, reasoning, steps with owners, techStack, link), `build-dialogs.tsx`, `live-dialog.tsx` (PDF report, contributions, credits confirmation, links; moves board to `live` and calls submitWork).
- `pipeline-ui.tsx`, `people-store.ts`, `people-menu.tsx`, `profile-settings.tsx`, `profile-photo.tsx`, `profile-store.ts`, `read-image.ts`, `profile-fields.tsx`, `settings-panel.tsx`, `settings-tabs.tsx`, `theme.ts`, `theme-switch.tsx`, `roles.ts` (manager, uiux, frontend, backend, data, qa, communication), `projectum-logo.tsx`.
- Siblings: `components/auth/*`, `components/profile/PublicProfile.tsx`, `components/ui/*` (shadcn).

## Board model (`src/lib/projects.ts`)

- `STAGES = brainstorming | solidifying | prototype | live`.
- `Plan { thesis, reasoning, techStack, steps[{id,text,ownerId}] }` filled on the way to Solidifying.
- `Prototype { githubUrl, supabase }` on the way to Prototype. `Build { number, note, techStack, at }` log from then on.
- `StageRecord` snapshots the project as it left each stage.
- `Launch { siteUrl, slidesUrl, demoUrl, contributions, at }` on the way to Live.
- `Project { id, name, description, thumbnail, notesUrl, color, people, stage, plan, prototype, builds, launch, ... }` stored as JSON in `projects.data`.

## Worker (`worker/`)

Worker `appliedlab-ask`. Bindings: D1 `DB` (`appliedlab-projectum`), KV `REPORTS` (PDFs by submission id, alert throttle keys), Workers AI, rate limiters (`ASK_LIMITER` 6/min, `LOGIN_LIMITER` 5/min per address, `LOGIN_IP_LIMITER` 60/min per IP), cron `0 14 * * *`.

Vars: `ALLOWED_ORIGINS`, `APPROVER_EMAIL`, `APPROVERS`, `ALERT_EMAIL`, `SITE_URL`, `MAIL_FROM`. Secrets: `AUTH_SECRET`, `RESEND_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, optional `ANTHROPIC_API_KEY`.

Request flow (`index.ts route`): `/approve` before origin check; 256KB body cap except submissions; Google routes; origin check (403); OPTIONS; `/client-errors`; `handleAccounts`; `handlePipeline`; any other POST is Ask the Lab.

### Endpoints

Accounts (`accounts.ts`):

| Method | Path | Auth | Does |
|---|---|---|---|
| POST | /auth/start | rate-limited | emails a code (hashed, 10 min, 5 tries) |
| POST | /auth/verify | none | verifies; new address needs a name; returns `{token,user}` |
| GET | /auth/google/start, /callback | browser | OAuth with signed state; token in `/login/#token=` fragment |
| GET/POST | /approve?u&e&t | HMAC link, 30 days | approve a partner |
| POST | /auth/logout | session | |
| GET/PATCH | /me | session | account incl. level; name, avatar, profilePublic, hideName |
| GET | /people | non-partner | active members and reps |
| POST | /client-errors | origin | browser error to alert |

Pipeline (`pipeline.ts:1244-1315`), all need an active session except profiles:

| Method | Path | Who | Does |
|---|---|---|---|
| GET | /profiles/:handle | public | member profile |
| GET/POST | /notifications, /notifications/read | any | bell |
| GET | /problems | any | partner: own; others: open partner-origin problems plus `myClaim` |
| POST | /problems | partner or rep | create |
| GET/PATCH | /problems/:id | see / owner or rep | detail with claims, submission, meeting, selection; edit, open/close |
| POST | /problems/:id/claims | member | claim (open partner-origin only); emails approver |
| POST | /proposals | member | own project (origin=member) plus a claim |
| GET | /projects | any | boards (partner: own problems with accepted submission) |
| PUT/DELETE | /projects/:id | team or approver / approver | save / delete board |
| POST | /projects/:id/submissions | team or approver | multipart PDF ≤10MB, board in `live` with launch |
| GET | /submissions/:id/report | any; partner if accepted and own | PDF |
| GET | /claims/mine | any | |
| POST | /claims/:id/withdraw | team | pending/approved → withdrawn unless accepted or selected |
| POST | /claims/:id/meeting | owning partner | request meeting |
| POST | /claims/:id/select | owning partner | start phase 2 |
| PUT | /claims/:id/phase | team or approver | phase-2 milestones (≤12) |
| POST | /claims/:id/complete | owning partner or approver | |
| GET | /queue | approver | pending claims, partners, submissions, requested meetings |
| GET | /overview | approver | all problems, claims, people |
| POST | /accounts/:id/status | approver | removed/active |
| POST | /accounts/:id/claude | approver | claude_access |
| POST | /claims/:id/review | approver not on team | approve/deny plus note; approve opens board |
| POST | /submissions/:id/review | approver not on team | accept/return plus note |
| POST | /meetings/:id/arranged | approver | |
| POST | /partners/:id/approve | approver | |

### D1 schema (migrations 0001 to 0009)

- `users`: id, email uniq, name, role (`rep|member|partner`), status (`active|pending|removed`), avatar, created_at, profile_public, handle uniq, claude_access, hide_name.
- `login_codes`: email PK, code_hash, expires_at, attempts.
- `sessions`: token_hash PK, user_id, expires_at (60 days).
- `projects`: id, owner_id, data JSON, created_at, updated_at, claim_id uniq.
- `problems`: id, owner_id, title, summary, details, fields JSON, deliverable, deadline, status (`open|closed`), origin (`partner|member`), timestamps.
- `claims`: id, problem_id, owner_id, plan JSON, status (`pending|approved|denied|withdrawn`), review_note, reviewed_by, reviewed_at, created_at.
- `claim_members`: (claim_id, user_id).
- `submissions`: id, claim_id, project_id, submitted_by, report_name, report_size, status (`pending|accepted|returned`), review_note, reviewed_by, reviewed_at, created_at.
- `meetings`: id, claim_id, requested_by, message, status (`requested|arranged`), created_at, arranged_at.
- `selections`: claim_id PK, selected_by, message, milestones JSON, completed_at, created_at.
- Constraints: `submissions_open`, `meetings_open` unique indexes; `one_active_claim` trigger.
- `notifications`: id, user_id, kind, title, href, read_at, created_at.
- `reminders_sent`: key PK, sent_at.

### Auth, roles, levels

- Role from email domain (`src/lib/email-rules.ts roleForEmail`): `@weber.edu` rep, `@mail.weber.edu` member, else partner.
- Partners start `pending`; approver gets an HMAC link email and a bell notification.
- Approver (`accounts.ts:68 isApprover`): active rep, `APPROVER_EMAIL`, or in `APPROVERS`.
- Member level computed (`levelOf` :97): affiliate; sponsored on an approved claim; builder on an approved claim with a selection.

### Email, cron, alerts, bell

- `sendEmail` via Resend. Sends: sign-in code, partner approval request and approval, claim/proposal, claim decision, submission and decision, meeting request, selection, complete.
- Cron daily: `healthCheck`, `clearOldNotifications` (60 days), `sendReminders` (Lab digest after 3 days waiting; deadline within 3 days; quiet board 14 days; deduped in `reminders_sent`).
- Alerts to `ALERT_EMAIL`, throttled per distinct alert hourly, cap 20/hour.
- Bell kinds: claim-new/approved/denied, submission-new/accepted/returned, partner-new/approved, meeting-requested, selected, complete, team-submitted, reminder. `GET /notifications` returns latest 40 plus unread count.

### Permissions today

- Partner: own problems; approved claims with notes blanked; accepted submissions; boards on own problems with accepted submission. Can post/edit, request meeting, select, complete, hide name.
- Member: Notice Board, claims on a problem, all boards. Claim, propose, withdraw, edit own team's board until submitted, submit, phase-2 milestones, public profile.
- Rep: always approver; can post/edit any problem (API only); cannot claim.
- Approver: queue, overview, review claims and submissions (not own team), approve partners, arrange meetings, delete boards, accounts on/off, Claude access.

## Data seam

- Base URL `src/lib/site.ts`: `NEXT_PUBLIC_ASK_URL` or `https://appliedlab-ask.now-playing.workers.dev`.
- `src/lib/account.ts:90 api()`: `Authorization: Bearer <token>` from localStorage `projectum:session`; JSON unless FormData; 401 signs out; `useSyncExternalStore` plus storage event across tabs. No auth cookies.
- CORS: allowed origins only; GET/POST/PUT/PATCH/DELETE/OPTIONS; `cache-control: no-store`.

## Scripts, tests, deploy

- Site: `dev`, `build`, `build:pages`, `lint`, `copy-lint`, `test` (`node --test scripts/*.test.mjs`), `check`.
- Tests: `email-role`, `problems`, `projects` (pure lib functions). No Worker, D1 or UI tests.
- Worker: `dev`, `deploy` (applies remote D1 migrations, then `wrangler deploy`), `check`.
- Front end: `.github/workflows/pages.yml` on push to main: `npm run build:pages` static export to `out/`, deploy-pages. `scripts/publish-live.sh` rsyncs into `DS-2-dev/appliedlab.ai` whose Pages serves appliedlab.ai.
- Worker deployed by hand. Secrets via `wrangler secret put`.
