# appliedlab-ask

The Cloudflare Worker behind the GitHub Pages site, which serves files only.
It answers Ask the Lab (`POST /`) and keeps Join the Lab forms
(`POST /interest`).

## Ask the Lab

The chat sends its questions here. It uses the
same instructions and facts as the Next.js route (`src/lib/ask.ts`), allows
only the Lab's own origins, and limits each visitor to 6 questions a minute.

It has two engines:

- **Free (the default):** Cloudflare Workers AI, Llama 3.3 70B. Cloudflare's
  free daily allowance covers about 70 questions a day at this prompt's
  size. Past that, requests fail, the chat shows its email note, and the
  free plan never bills.
- **Claude:** set the `ANTHROPIC_API_KEY` secret and the Worker asks Claude
  instead, exactly as `/api/ask` does. Delete the secret to go back to free.

## Join the Lab

The Sign up page's form posts to `/interest`. The Worker checks it with the
site's rules (`src/lib/interest.ts`), allows 3 a minute per visitor, and
keeps each one in the `INTEREST` KV namespace, keyed by time, with the role,
name and email as metadata. No IP address is kept. To read them, from
`worker/`:

```bash
npx wrangler kv key list --binding INTEREST --remote          # who joined
npx wrangler kv key get --binding INTEREST --remote "<key>"   # one form, in full
npx wrangler kv key delete --binding INTEREST --remote "<key>"
```

They are also under Storage & Databases > Workers KV > INTEREST in the
Cloudflare dashboard.

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
and the Pages workflow builds the site against that address. If it ever
moves, set the repo variable `ASK_URL` (Settings > Secrets and variables >
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
