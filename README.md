# Applied AI Lab website

The Lab's site: the landing (a star hero, How it works, and the Ask the Lab
chat), Projectum (the project workspace) and the sign-in screens.

## Running it

```bash
npm install
npm run dev
```

With no env vars the site uses the local JSON store in `data/` (events,
settings, local accounts) and offers a dev-preview Projectum sign-in
(development builds only). Add `ANTHROPIC_API_KEY` to `.env.local` for Ask
the Lab to answer through `/api/ask` (see `.env.example`).

## Accounts

Create the club Supabase project (owned by ailab@weber.edu), run the SQL in
`supabase/`, enable Google auth, and set the two Supabase env vars. The data
layer and sign-in switch to Supabase automatically.

## GitHub Pages

The public site is a static build served by GitHub Pages at appliedlab.ai:

```bash
npm run build:pages   # writes out/
```

`scripts/build-pages.mjs` leaves out everything that needs a server (sign-in,
API routes, server actions, proxy) and swaps in `pages-static/`, so Projectum
opens as its demo. `.github/workflows/pages.yml` runs it and deploys on
every push to main.

Ask the Lab needs a server, which Pages lacks, so on the static site it
calls a Cloudflare Worker (`worker/`, deploy steps in `worker/README.md`).
The workflow passes the Worker's address in as `NEXT_PUBLIC_ASK_URL`.

## Copy

Every public string lives in `src/content/copy.ts` and is PROVISIONAL until
Kylar's markup pass. The chat's facts live in `src/content/lab-knowledge.ts`.
Check voice compliance with:

```bash
node scripts/copy-lint.mjs
```

## Layout of things

- `src/content/copy.ts`: all public copy, one file.
- `src/lib/site.ts`: what differs between the full and static builds.
- `src/lib/ask.ts`: the Ask the Lab request, shared by the route and the Worker.
- `src/lib/data/`: the data seam. `local.ts` (JSON in `data/`) or
  `supabase.ts`, chosen by env vars in `index.ts`.
- `src/lib/auth.ts`: who is signed in, for Projectum and the sign-in pages.
- `design/`: the style rules (`STYLE.md`) and reference tokens.
- `src/app/globals.css`: tokens, the `kicker` and `short` helpers, and
  Projectum's surface.
