# pages-static

Files that replace their namesakes under `src/` in the GitHub Pages build
(`npm run build:pages`, see `scripts/build-pages.mjs`). Pages serves plain
files, so these are the versions with no server in them:

- `src/app/projectum/page.tsx`: opens straight onto the demo account, no
  sign-in, and picks the view from the URL in the browser.
- `src/components/projectum/projectum-view.tsx`: that browser half.
- `src/components/projectum/settings-panel.tsx`: Settings without Log out.
- `src/lib/auth-actions.ts`: stubs for the server actions the shared header
  imports. Nothing on the static site can call them.

Keep each in step with its original when the original changes.
