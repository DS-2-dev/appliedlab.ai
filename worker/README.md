# appliedlab-ask

The Cloudflare Worker that answers Ask the Lab on the GitHub Pages site.
Pages serves files only, so the chat sends its questions here. It runs the
same request as the Next.js route (`src/lib/ask.ts`), keeps the Claude API
key as a secret, allows only the Lab's own origins, and limits each visitor
to 6 questions a minute.

## First deploy

From `website/site` (the Worker uses the site's copy of the Anthropic SDK):

```bash
npm install
cd worker
npm install
npx wrangler login                          # opens Cloudflare in the browser
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when asked
npm run deploy                              # prints the Worker's URL
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
