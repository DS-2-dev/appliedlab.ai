# pages-static

Files that replace their namesakes under `src/` in the GitHub Pages build
(`npm run build:pages`, see `scripts/build-pages.mjs`). Pages serves plain
files, so these are the versions with no server in them:

- `src/app/projectum/page.tsx`: opens straight onto the demo account, no
  sign-in, and picks the view from the URL in the browser.
- `src/components/projectum/projectum-view.tsx`: that browser half.
- `src/app/login/page.tsx`, `src/app/signup/page.tsx`: the same screens with
  no session check, Google sign-in off, and a link to the Projectum demo.
- `src/app/forgot-password/page.tsx`: the original, put back after the
  server routes are removed, so Log in's link has somewhere to go.
- `src/lib/auth-actions.ts`: stubs for the server actions. The forms above
  get a note that accounts open with the platform launch.

Keep each in step with its original when the original changes. Anything
else that differs by build reads `STATIC_SITE` from `src/lib/site.ts`.
