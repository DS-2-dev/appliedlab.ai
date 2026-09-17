# pages-static

Files that replace their namesakes under `src/` in the GitHub Pages build
(`npm run build:pages`, see `scripts/build-pages.mjs`). Pages serves plain
files, so these are the versions with no server in them:

- `src/lib/auth-actions.ts`: the server actions, which a static export
  cannot hold, as stubs built on `src/lib/auth-static.ts`.

Everything else that differs by build reads `STATIC_SITE` from
`src/lib/site.ts`, which `npm run dev` turns on too, so the local preview
matches the live site.
