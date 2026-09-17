// Which build this is, and the links that change with it. The static GitHub
// Pages build (scripts/build-pages.mjs) has no accounts and no /api, so
// joining and logging in open the Projectum demo there, and the chat calls
// the Cloudflare Worker (worker/) through NEXT_PUBLIC_ASK_URL.

import { copy } from "@/content/copy";

export const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === "1";

export const JOIN_HREF = STATIC_SITE ? "/projectum" : "/signup";
export const LOGIN_HREF = STATIC_SITE ? "/projectum" : "/login";
export const LOGIN_LABEL = STATIC_SITE ? copy.nav.demo : copy.nav.login;
export const SHOW_SIGNUP = !STATIC_SITE;

// Where Ask the Lab sends questions; null when there is nowhere to send them.
export const ASK_URL = process.env.NEXT_PUBLIC_ASK_URL || (STATIC_SITE ? null : "/api/ask");
