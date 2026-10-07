// Site-wide links and where the Worker is. The site is static (GitHub Pages,
// scripts/build-pages.mjs), so everything server-side, Ask the Lab and
// Projectum accounts, goes to the Cloudflare Worker (worker/).

import { copy } from "@/content/copy";

// The site's section links, for the header and footer. They are How it
// works' steps, so the lists cannot drift.
export const NAV = copy.how.steps.map((s) => ({ id: s.id, label: s.label, href: `/#${s.id}` }));

export const JOIN_HREF = "/signup";
export const LOGIN_HREF = "/login";

// The Worker. NEXT_PUBLIC_ASK_URL points any build at another copy of it,
// such as `wrangler dev` on http://localhost:8787.
const WORKER_URL = (process.env.NEXT_PUBLIC_ASK_URL || "https://appliedlab-ask.now-playing.workers.dev").replace(/\/$/, "");

// Where Ask the Lab sends questions.
export const ASK_URL = WORKER_URL;

// Projectum accounts and projects.
export const ACCOUNT_URL = WORKER_URL;
