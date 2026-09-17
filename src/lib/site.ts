// Which build this is, and the links that change with it. The static GitHub
// Pages build (scripts/build-pages.mjs) has no server, so its Log in and
// Sign up pages are stand-ins (pages-static/) that point to the Projectum
// demo, and the chat calls the Cloudflare Worker (worker/) through
// NEXT_PUBLIC_ASK_URL.

export const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === "1";

export const JOIN_HREF = "/signup";
export const LOGIN_HREF = "/login";

// Where Ask the Lab sends questions; null when there is nowhere to send them.
export const ASK_URL = process.env.NEXT_PUBLIC_ASK_URL || (STATIC_SITE ? null : "/api/ask");
