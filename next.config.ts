import type { NextConfig } from "next";

// GITHUB_PAGES=1 is the static build GitHub Pages serves, run through
// scripts/build-pages.mjs. Pages has no server, so that build has no
// redirects and no image optimizer, and NEXT_PUBLIC_STATIC_SITE tells the
// client code which build it is in.
const pages = process.env.GITHUB_PAGES === "1";

const nextConfig: NextConfig = {
  ...(pages && {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
    env: { NEXT_PUBLIC_STATIC_SITE: "1" },
  }),

  // The dev-only overlay badge in the corner. Off so it stays out of the way
  // while the hero is being designed; affects development only.
  devIndicators: false,

  ...(!pages && { redirects }),
};

async function redirects() {
    return [
      // /partners used to redirect to /#partners, because the partner content
      // was a landing-page section (spec-v2 §2). It is a real route now, so
      // that redirect is gone. The old anchor still resolves for any link in
      // the wild that carries it.
      // Accounts (2026-09-11). Officer and member were merged into one kind
      // of account, and its one page is /projectum. The officer sign-in, the
      // officer screens and the member dashboard all came out; links to any
      // of them land on the account pages.
      { source: "/signin", destination: "/login", permanent: false },
      { source: "/admin", destination: "/projectum", permanent: false },
      { source: "/admin/:path*", destination: "/projectum", permanent: false },
      { source: "/dashboard", destination: "/projectum", permanent: false },
      // Statur was renamed Projectum (2026-09-12); old links keep working,
      // query string and all.
      { source: "/statur", destination: "/projectum", permanent: true },
      {
        source: "/plan",
        destination: "/handbook",
        permanent: false,
      },
      // The RSVP layer is gone (2026-08-17: everything is show-up). The route
      // may still be on early shared links, so it lands home.
      {
        source: "/rsvp",
        destination: "/",
        permanent: false,
      },
      // Cases and Showcase merged into /work (2026-08-18) until December
      // fills the record. Exact-match sources: /cases/[slug] still resolves.
      {
        source: "/cases",
        destination: "/work",
        permanent: false,
      },
      {
        source: "/showcase",
        destination: "/work",
        permanent: false,
      },
      // The four-page restructure (2026-08-22): the role pages and Purpose
      // fold into the landing as anchored sections.
      { source: "/about", destination: "/#purpose", permanent: false },
      { source: "/students", destination: "/#for-students", permanent: false },
      { source: "/faculty", destination: "/#for-faculty", permanent: false },
      { source: "/partners", destination: "/#for-organizations", permanent: false },
    ];
}

export default nextConfig;
