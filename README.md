# Applied AI Lab website

The Lab's site: the landing (a star hero, How it works, and the Ask the Lab
chat), Projectum (the signed-in app) and the sign-in screens.

## Running it

```bash
npm install
npm run dev                                   # the site on :3000
cd worker && npm install && npm run dev       # the Worker on :8787
NEXT_PUBLIC_ASK_URL=http://localhost:8787 npm run dev   # site using it
```

The site is static. Everything server-side, Ask the Lab and Projectum
accounts, lives in the Cloudflare Worker (`worker/`, setup and deploy steps
in `worker/README.md`). Its address is in `src/lib/site.ts`, and
`NEXT_PUBLIC_ASK_URL` (the repo variable `ASK_URL` in the Pages build)
overrides it.

## GitHub Pages

The public site is served by GitHub Pages at appliedlab.ai:

```bash
npm run build:pages   # writes out/
```

`.github/workflows/pages.yml` runs it and deploys on every push to main of
the live repo, DS-2-dev/appliedlab.ai, which holds only this folder. Publish
to it with:

```bash
scripts/publish-live.sh "What changed"
```

It refuses to push unless the live copy matches this folder exactly.

The live repo's Settings > Pages > Source must stay on "GitHub Actions". On
"Deploy from a branch", GitHub also builds the repo's README as a page on
every push, and whichever deploy finishes last is what appliedlab.ai shows.

## Copy

Every public string lives in `src/content/copy.ts` and is PROVISIONAL until
Kylar's markup pass. The chat's facts live in `src/content/lab-knowledge.ts`.
Check voice compliance with:

```bash
node scripts/copy-lint.mjs
```

## Layout of things

- `src/content/copy.ts`: all public copy, one file.
- `src/lib/site.ts`: links and the Worker's address.
- `src/lib/account.ts`: the signed-in account, in the browser.
- `src/lib/projects.ts`: Projectum's project rules, pure and tested.
- `src/lib/ask.ts`: the Ask the Lab request, used by the Worker.
- `worker/`: accounts, projects and the chat, on Cloudflare.
- `design/`: the style rules (`STYLE.md`) and reference tokens.
- `src/app/globals.css`: tokens, the `kicker` and `short` helpers, and
  Projectum's surface.
