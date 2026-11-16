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

// Arch, the platform (its own Cloudflare Worker). This site stays the front door: its Log in and Sign up forms call
// Arch's /arch/api/site from the browser, the way they called the Projectum Worker, then hand people into Arch's
// Workspace. NEXT_PUBLIC_ARCH_URL points a build at another copy.
export const ARCH_URL = (process.env.NEXT_PUBLIC_ARCH_URL || "https://arch.nayidantestan.workers.dev").replace(/\/$/, "");
export const ACCOUNT_URL = `${ARCH_URL}/arch/api/site`;
