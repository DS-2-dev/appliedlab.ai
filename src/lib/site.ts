// Which build this is. The live site is the static GitHub Pages build
// (scripts/build-pages.mjs), and `npm run dev` runs the same static mode so
// the preview matches it: no accounts (the forms say so and Projectum opens
// as the demo), and the chat calls the Cloudflare Worker (worker/).
// `npm run dev:server` runs the full version with accounts and /api.

export const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === "1";

export const JOIN_HREF = "/signup";
export const LOGIN_HREF = "/login";

// Where Ask the Lab sends questions: the Worker on the static site, the
// local route otherwise.
export const ASK_URL =
  process.env.NEXT_PUBLIC_ASK_URL || (STATIC_SITE ? "https://appliedlab-ask.now-playing.workers.dev" : "/api/ask");
