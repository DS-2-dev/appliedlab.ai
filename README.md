# Applied AI Lab website

Built from `website/spec-v2.md`. One-scroll landing, /rsvp (the printed-QR
target), partner-interest form, database-driven calendar, officer admin.

## Running it

```bash
npm install
npm run dev
```

With no env vars the site uses the local JSON store in `data/` and the admin
area offers a dev-preview sign-in (development builds only). This is the
full experience minus Google auth.

## Going live

1. Buy the domain (registrar account owned by ailab@weber.edu).
2. Create the club Supabase project (same ownership), run
   `supabase/migration.sql`, enable Google auth, seed the first officer row
   (instructions at the bottom of the migration file).
3. Copy `.env.example` to `.env.local` (locally) or set the two env vars in
   Vercel. The data layer and auth switch to Supabase automatically.
4. Deploy to Vercel from this directory. Set the same env vars there.
5. Generate the flier/banner QR pointing at `https://<domain>/rsvp` only
   after a phone scan of a test QR reaches the form and a row lands in the
   table (spec-v2 Phase A acceptance).

## GitHub Pages

The public site is a static build served by GitHub Pages:

```bash
npm run build:pages   # writes out/
```

`scripts/build-pages.mjs` leaves out everything that needs a server (sign-in,
API routes, server actions, proxy) and swaps in `pages-static/`, so Projectum
opens as its demo.
`.github/workflows/pages.yml` runs it and deploys on every push to main.

The Ask the Lab chat needs a server, which Pages lacks, so on the static
site it calls a Cloudflare Worker (`worker/`, deploy steps in
`worker/README.md`) whose URL the workflow passes in as
`NEXT_PUBLIC_ASK_URL` from the repo variable `ASK_URL`. Locally it uses
`/api/ask` with `ANTHROPIC_API_KEY` in `.env.local`.

## Copy

Every public string lives in `src/content/copy.ts` and is PROVISIONAL until
Kylar's markup pass. Check voice compliance any time with:

```bash
node scripts/copy-lint.mjs
```

Officer-editable strings (tagline, schedule line, follow-up days, offseason
line) live in settings, editable at /admin/settings.

## Layout of things

- `src/content/copy.ts`: all public copy, one file.
- `src/lib/data/`: the data seam. `local.ts` (JSON in `data/`) or
  `supabase.ts`, chosen by env vars in `index.ts`.
- `src/lib/auth.ts`: officer gate used by every admin page and API route.
- `design/`: the style rules (`STYLE.md`) and tokens for the redesign.
- `supabase/migration.sql`: schema + RLS, matches spec-v2 §5.1.
- `src/app/globals.css`: provisional brand tokens (one-file swap when the
  final tokens land).
