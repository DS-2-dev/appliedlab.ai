# appliedlab-ask

The Cloudflare Worker behind the GitHub Pages site, which serves files only.
It answers Ask the Lab (`POST /`) and holds Projectum accounts and projects
(`/auth/*`, `/me`, `/projects`, `GET /approve`).

## Projectum accounts

Sign-in is a 6-digit code emailed to the address, so one form both logs in
and signs up. The role comes from the domain: `@weber.edu` is a rep,
`@mail.weber.edu` a member, anything else a partner. Partners start pending,
and `APPROVER_EMAIL` gets a link that approves them. Members and reps see
every project; partners see only their own. Data is in the
`appliedlab-projectum` D1 database (schema in `migrations/`).

One-time setup, from `worker/`:

```bash
npx wrangler d1 migrations apply appliedlab-projectum --remote
openssl rand -hex 32 | npx wrangler secret put AUTH_SECRET
npx wrangler secret put RESEND_API_KEY      # from resend.com, see below
npm run deploy
```

Email goes through [Resend](https://resend.com). Add `appliedlab.ai` as a
domain there and copy the DNS records it gives you into Squarespace's DNS
settings. Once Resend shows the domain verified, codes send from
`MAIL_FROM` in `wrangler.jsonc`. Until the key is set, sign-in answers that
email is still being set up.

Locally, `worker/.dev.vars` holds `AUTH_SECRET=...` and `DEV_CODES=1`, which
shows the code on the login form in place of an email. Run
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
