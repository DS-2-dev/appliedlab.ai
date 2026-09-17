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
      // Accounts (2026-09-11). Officer and member were merged into one kind
      // of account, and its one page is /projectum.
      { source: "/signin", destination: "/login", permanent: false },
      { source: "/admin", destination: "/projectum", permanent: false },
      { source: "/admin/:path*", destination: "/projectum", permanent: false },
      { source: "/dashboard", destination: "/projectum", permanent: false },
      // Statur was renamed Projectum (2026-09-12); old links keep working,
      // query string and all.
      { source: "/statur", destination: "/projectum", permanent: true },
      // The public pages were cleared for the redesign (2026-09-16); links
      // to them land home.
      {
        source: "/:page(join|work|handbook|cases|showcase|plan|rsvp|about|students|faculty|partners|calendar\\.ics)",
        destination: "/",
        permanent: false,
      },
      { source: "/cases/:slug", destination: "/", permanent: false },
    ];
}

export default nextConfig;
