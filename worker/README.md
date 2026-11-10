# appliedlab-ask

The Cloudflare Worker behind the GitHub Pages site, which serves files only.
It answers Ask the Lab (`POST /`) and holds Projectum accounts and projects
(`/auth/*`, `/me`, `GET /approve`) and the Projectum pipeline: postings,
projects, boards, reviews, organizations, "in your court" and the shell
(see Projectum pipeline below).

## Projectum accounts

Sign-in is a 6-digit code emailed to the address, so one form both logs in
and signs up. The role comes from the domain: `@weber.edu` is a rep,
`@mail.weber.edu` a member, anything else a partner. Partners start pending,
and `APPROVER_EMAIL` gets a link that approves them. Members and reps see
every posting; partners see only their organization's. Data is in the
`appliedlab-projectum` D1 database (schema in `migrations/`).

Before the first deploy that carries `migrations/0010_gates_and_orgs.sql`,
rehearse it against a copy of the live database. From `worker/`:

```bash
bash scripts/dry-run-migration.sh
```

It exports the remote database (read only), applies 0010 to a throwaway
local copy and compares row counts; it exits non-zero if any table ends up
with fewer rows. `DRYRUN_SQL=path/to/export.sql` loads a file instead of
exporting. Deploy only when it passes.

The export stays at `worker/backups/<timestamp>.sql` (git ignores the
folder) and the script prints its path. Keep it until the deploy has
settled.

Right before `npm run deploy`, record a D1 Time Travel bookmark and write
down the id it prints:

```bash
npx wrangler d1 time-travel info appliedlab-projectum
```

If the migration goes wrong, put the database back to that point:

```bash
npx wrangler d1 time-travel restore appliedlab-projectum --bookmark=<id>
```

One-time setup, from `worker/`:

```bash
openssl rand -hex 32 | npx wrangler secret put AUTH_SECRET
npx wrangler secret put RESEND_API_KEY      # from resend.com, see below
npm run deploy
```

Email goes through [Resend](https://resend.com). Add `appliedlab.ai` as a
domain there and copy the DNS records it gives you into Squarespace's DNS
settings. Once Resend shows the domain verified, codes send from
`MAIL_FROM` in `wrangler.jsonc`. Until the key is set, sign-in answers that
email is still being set up.

Locally, `worker/.dev.vars` holds `AUTH_SECRET=...`, `DEV_CODES=1`, which
shows the code on the login form in place of an email, and
`ALLOWED_ORIGINS=https://appliedlab.ai,http://localhost:3000,http://localhost:3100`
(the live Worker allows only appliedlab.ai). Run
`npx wrangler d1 migrations apply appliedlab-projectum --local` once, then
`npm run dev`, and run the site with
`NEXT_PUBLIC_ASK_URL=http://localhost:8787`.

### Google sign-in

"Continue with Google" goes through `/auth/google/start` and
`/auth/google/callback` here. Google proves the address, so the role comes
from it as with a code. Sign up's role pick travels along, and a new
account whose address doesn't match it is sent back with a note. Setup, in
the Google Cloud console:

1. Make a project, then open Google Auth Platform and set it up as an
   External app named Applied AI Lab. Under Audience, publish it. The
   `openid email profile` scopes need no Google review.
2. Under Clients, create a Web application client with these redirect URIs:
   - `https://appliedlab-ask.now-playing.workers.dev/auth/google/callback`
   - `http://localhost:8787/auth/google/callback`
3. From `worker/`:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npm run deploy
```

Until both are set, the button answers that Google sign-in is still being
set up. Locally, put both in `.dev.vars`.

To look at accounts:

```bash
npx wrangler d1 execute appliedlab-projectum --remote --command "SELECT email, name, role, status FROM users"
```

## Projectum pipeline

A partner's problem is a posting. A rep reviews it (gate 1), a team claims
it as a project and writes an action plan a rep reviews (gate 2), works on
its board, and submits a report a rep reviews (gate 3). The partner may then
bring the team on to implement it (phase 2). Every status change goes
through `src/transition.ts`; each gate keeps one row per round in `reviews`,
and `src/events.ts` writes the event log and the bell.

| Module | Routes |
| --- | --- |
| `accounts.ts` | `POST /auth/start`, `/auth/verify`, `/auth/check`, `/auth/password`, `/auth/logout`; `GET /auth/google/start`, `/auth/google/callback`; `GET`/`PATCH /me`; `GET /people` |
| `taxonomy.ts` | `GET /taxonomy` |
| `orgs.ts` | `GET`/`PATCH /orgs/mine`, `GET /orgs/:id` (staff), `POST /orgs/mine/transfer`, `/orgs/mine/remove`, `/orgs/requests`, `/orgs/requests/:id/approve`, `/orgs/requests/:id/decline` |
| `postings.ts` | `GET`/`POST /postings`, `GET`/`PATCH /postings/:id`, `POST /postings/:id/transition` |
| `projects.ts` | `POST /postings/:id/claim`, `POST /proposals`, `GET /projects`, `/projects/mine`, `/projects/:id`, `PUT /projects/:id/plan`, `POST /projects/:id/transition` |
| `boards.ts` | `GET /boards`, `PUT`/`DELETE /boards/:id` |
| `submissions.ts` | `POST /boards/:id/submissions`, `GET /submissions/:id/report` |
| `phase2.ts` | `PUT /projects/:id/phase`, `POST /projects/:id/complete`, `/projects/:id/meeting`, `/meetings/:id/arranged` |
| `reviews.ts` | `GET /reviews`, `GET /reviews/:id`, `POST /reviews/:id/take`, `/reviews/:id/assign` |
| `court.ts` | `GET /court` |
| `shell.ts` | `GET /shell` |
| `notify.ts` | `GET /notifications`, `POST /notifications/read` |
| `overview.ts` | `GET /overview`, `POST /accounts/:id/status`, `/accounts/:id/claude`, `/partners/:id/approve`, `GET /profiles/:handle` |

Tables added by migration 0010: `orgs`, `org_requests`, `taxonomy`,
`postings`, `projects` (what were claims), `project_members`, `reviews`,
`milestone_baselines` and `events`. `boards` (what were projects) holds the
JSON workspaces; `submissions`, `meetings` and `selections` now point at a
project. The old `/problems`, `/claims` and `/queue` routes are gone, and
so is `POST /submissions/:id/review`; decide with
`POST /projects/:id/transition` (`approveWork` or `returnWork`).

## Ask the Lab

The chat sends its questions here. It uses the
instructions and facts in `src/lib/ask.ts`, allows
only the Lab's own origins, and limits each visitor to 6 questions a minute.

It has two engines:

- **Free (the default):** Cloudflare Workers AI, Llama 3.3 70B. Cloudflare's
  free daily allowance covers about 70 questions a day at this prompt's
  size. Past that, requests fail, the chat shows its email note, and the
  free plan never bills.
- **Claude:** set the `ANTHROPIC_API_KEY` secret and the Worker asks Claude
  instead. Delete the secret to go back to free.

## First deploy

From `website/site` (the Worker uses the site's copy of the Anthropic SDK):

```bash
npm install
cd worker
npm install
npx wrangler login                          # opens Cloudflare in the browser
npm run deploy                              # prints the Worker's URL
npx wrangler secret put ANTHROPIC_API_KEY   # optional: switch to Claude
```

The Worker is deployed at `https://appliedlab-ask.now-playing.workers.dev`,
and `src/lib/site.ts` points the static site at that address. If it ever
moves, update it there, or set the repo variable `ASK_URL` (Settings > Secrets and variables >
Actions > Variables) to the new address and re-run the workflow.

`npm run deploy` applies any new database migrations first and deploys only
if they succeed, so the Worker never runs ahead of its tables.

## After that

- Redeploy (`npm run deploy`) when `src/content/lab-knowledge.ts`,
  `src/lib/ask.ts` or the schedule in `data/` changes. The schedule is
  bundled at deploy time.
- `npm run dev` runs it locally on port 8787. Put the key in
  `worker/.dev.vars` as `ANTHROPIC_API_KEY=...` (never committed), and run
  the site with `NEXT_PUBLIC_ASK_URL=http://localhost:8787`.
- `npm run check` type-checks and bundles without deploying.
- Allowed sites are `ALLOWED_ORIGINS` in `wrangler.jsonc`; the rate limit
  is `ratelimits` there too.

## Reminders

Once a day, with the health check, `src/reminders.ts`:

- emails `APPROVER_EMAIL` a summary when an open review, meeting request,
  new partner or request to join an organization has waited more than 3
  days, and puts it in every staff member's bell,
- tells a team 3 days or less before its deadline (the partner's or its own
  finish date, whichever comes first),
- tells a team when its board hasn't changed in 14 days.

Each is sent once, recorded in `reminders_sent`.

## When something breaks

`ALERT_EMAIL` (in `wrangler.jsonc`) gets an email, from `src/alerts.ts`, when:

- a request fails inside the Worker (the person sees a short error, not a
  broken page),
- Resend refuses an email, which means sign-in codes aren't going out,
- the daily health check (14:00 UTC, the cron in `wrangler.jsonc`) finds the
  database, report storage or Resend not answering,
- someone's browser hits an error in Projectum (`POST /client-errors`, sent
  by `src/lib/report-error.ts` and the crash screen in
  `src/app/projectum/error.tsx`).

Each distinct alert goes out at most once an hour, and 20 an hour at most.

To look closer:

```bash
npx wrangler tail                       # live logs; alerts start with [alert]
```

or Cloudflare dashboard > Workers & Pages > appliedlab-ask > Logs.

### Rolling the database back

D1 keeps every change for 30 days and can restore the database to any
minute in that window. This replaces everything, so export first:

```bash
npx wrangler d1 export appliedlab-projectum --remote --output backup-$(date +%F).sql
npx wrangler d1 time-travel info appliedlab-projectum                     # the current bookmark
npx wrangler d1 time-travel restore appliedlab-projectum --timestamp=2026-10-07T18:00:00Z
```

Submitted reports live in the `REPORTS` KV namespace, which time travel
doesn't cover; restoring the database leaves them in place.


## Tests

`npm test` runs Vitest inside workerd with `@cloudflare/vitest-plugin`,
against an empty local D1 and KV, so nothing touches the live database. Each
test builds its env with `makeEnv()`, applies the migrations with
`applyMigrations(env.DB)`, signs people in with `signIn()` and calls the
Worker with `call()` (all in `test/helpers.ts`). Rate limiters and Workers AI
are stubbed. Two lines of output are expected and harmless: Wrangler's
"AI bindings always access remote resources" warning (the binding is
stubbed, nothing is called) and a standardwebhooks sourcemap notice.
