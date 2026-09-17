// Which build this is. The live site is the static GitHub Pages build
// (scripts/build-pages.mjs), and `npm run dev` runs the same static mode so
// the preview matches it: no accounts (the forms say so and Projectum opens
// as the demo), and the chat calls the Cloudflare Worker (worker/).
// `npm run dev:server` runs the full version with accounts and /api.

import { copy } from "@/content/copy";

export const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === "1";

// The site's section links, for the header and footer. They are How it
// works' steps, so the lists cannot drift.
export const NAV = copy.how.steps.map((s) => ({ id: s.id, label: s.label, href: `/#${s.id}` }));

export const JOIN_HREF = "/signup";
export const LOGIN_HREF = "/login";

// The Worker (worker/), which the static site calls for the chat and the
// join form. NEXT_PUBLIC_ASK_URL points any build at another copy of it,
// such as `wrangler dev`.
const WORKER_URL = (process.env.NEXT_PUBLIC_ASK_URL || "https://appliedlab-ask.now-playing.workers.dev").replace(/\/$/, "");
const USE_WORKER = STATIC_SITE || Boolean(process.env.NEXT_PUBLIC_ASK_URL);

// Where Ask the Lab sends questions, and where Join the Lab sends the form.
export const ASK_URL = USE_WORKER ? WORKER_URL : "/api/ask";
export const INTEREST_URL = USE_WORKER ? `${WORKER_URL}/interest` : "/api/interest";
