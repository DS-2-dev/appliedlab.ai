import type { NextConfig } from "next";

// GITHUB_PAGES=1 is the static build GitHub Pages serves, run through
// scripts/build-pages.mjs. Pages serves plain files, so that build is an
// export with no image optimizer. `npm run dev` serves the same pages.
const pages = process.env.GITHUB_PAGES === "1";

const nextConfig: NextConfig = {
  ...(pages && {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
  }),

  // The dev-only overlay badge in the corner. Off so it stays out of the way
  // while the hero is being designed; affects development only.
  devIndicators: false,
};

export default nextConfig;
